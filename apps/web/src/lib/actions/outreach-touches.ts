'use server';

// Multi-channel outreach touches — CRUD + per-channel content gen + mark-sent. Email/form live on the
// prospect (auto-send unchanged); these are the EXTRA channels (social DM, comment, dev). A touch
// marked 'sent' advances the prospect (→ backlink task sync). See 2026-07-20-outreach-multichannel-plan.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { syncProspectToTask } from './backlink-outreach-sync';
import { genChannelContent } from '@/lib/outreach/touch-content';
import { firstNameOf } from '@/lib/outreach/link-task';
import { reconcilePlatformKey } from '@/lib/resolve-platform';

async function isAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

export interface SentAs { kind?: 'account' | 'identity'; id?: number; label?: string }
export interface Touch { id: number; channel: string; targetRef: string; content: string; status: string; sentAt: string | null; sentAs: SentAs }

const mapTouch = (r: Record<string, unknown>): Touch => ({
  id: Number(r.id), channel: String(r.channel), targetRef: String(r.target_ref ?? ''), content: String(r.content ?? ''),
  status: String(r.status ?? 'to_send'), sentAt: r.sent_at ? String(r.sent_at) : null,
  sentAs: (r.sent_as && typeof r.sent_as === 'object') ? r.sent_as as SentAs : {},
});

// Campaign sender for this prospect (de-hardcode the email drawer's From line). Fallback = militarycalc.
export async function getProspectSender(projectId: string, prospectId: number): Promise<{ name: string; email: string }> {
  const db = getDb(); if (!db) return { name: 'Jake Miller', email: 'hello@militarycalc.com' };
  const rows = await db.execute(sql`SELECT c.from_name, c.from_email FROM outreach_prospects p LEFT JOIN outreach_campaigns c ON c.id = p.campaign_id WHERE p.id = ${prospectId} AND p.project_id = ${projectId} LIMIT 1`);
  const r = (rows as unknown as Array<{ from_name: string | null; from_email: string | null }>)[0];
  return { name: r?.from_name || 'Jake Miller', email: r?.from_email || 'hello@militarycalc.com' };
}

// Flat touch summary for the whole project → the list can show which channels each prospect was reached
// through (so social touches aren't invisible/scattered). Client builds the per-prospect map.
export interface TouchSummary { prospectId: number; channel: string; status: string }
export async function listTouchSummaries(projectId: string): Promise<TouchSummary[]> {
  const db = getDb(); if (!db) return [];
  const rows = await db.execute(sql`SELECT prospect_id, channel, status FROM outreach_touches WHERE project_id = ${projectId}`);
  return (rows as unknown as Array<{ prospect_id: number; channel: string; status: string }>).map((r) => ({ prospectId: Number(r.prospect_id), channel: String(r.channel), status: String(r.status) }));
}

export async function listTouches(projectId: string, prospectId: number): Promise<Touch[]> {
  const db = getDb(); if (!db) return [];
  const rows = await db.execute(sql`SELECT id, channel, target_ref, content, status, sent_at, sent_as FROM outreach_touches WHERE prospect_id = ${prospectId} AND project_id = ${projectId} ORDER BY created_at`);
  return (rows as unknown as Array<Record<string, unknown>>).map(mapTouch);
}

// "Gửi bằng" (comment/DM as) options for a channel: the project's accounts for that channel's platform
// first, then its other accounts, then identities (personas). Generic — any channel picks who acted.
export interface SendAsOption { kind: 'account' | 'identity'; id: number; label: string; sub: string; match: boolean; avatar?: string; editable?: boolean }
const CHANNEL_PLATFORM: Record<string, string[]> = {
  facebook: ['facebook'], x: ['x', 'twitter'], linkedin: ['linkedin'], instagram: ['instagram'],
  reddit: ['reddit'], youtube: ['youtube'], telegram: ['telegram'], discord: ['discord'],
  medium: ['medium'], devto: ['devto', 'dev-to'], github: ['github'],
};
export async function listSendAs(projectId: string, channel: string): Promise<SendAsOption[]> {
  const db = getDb(); if (!db) return [];
  const plats = CHANNEL_PLATFORM[channel] || [];
  // GLOBAL POOL: FB Pages / social accounts anh sở hữu = asset portfolio-wide, tái dùng MỌI dự án. Lấy TẤT CẢ
  // account của platform kênh này (bất kể project), + account của project này ở platform khác (ngữ cảnh) + identities.
  const accts = (await db.execute(sql`
    SELECT pa.id, pa.platform_key, pa.handle, pa.account_type, pa.project_id,
           pa.persona->>'avatar' AS avatar, pa.persona->>'displayName' AS display,
           (pa.platform_key = ANY(${plats}::text[])) AS platmatch
    FROM platform_accounts pa
    WHERE pa.tenant_id = 'self' AND COALESCE(pa.handle, '') <> ''
      AND ( pa.platform_key = ANY(${plats}::text[])
            OR EXISTS (SELECT 1 FROM project_accounts pj WHERE pj.account_id = pa.id AND pj.project_id = ${projectId}) )
    ORDER BY (pa.platform_key = ANY(${plats}::text[])) DESC, pa.platform_key, pa.id`)) as unknown as Array<{ id: number; platform_key: string; handle: string; account_type: string; project_id: string | null; avatar: string | null; display: string | null; platmatch: boolean }>;
  const idents = (await db.execute(sql`SELECT id, kind, COALESCE(NULLIF(display_name, ''), name) AS label FROM identities WHERE project_id = ${projectId} OR project_id IS NULL ORDER BY (project_id IS NOT NULL) DESC, id`)) as unknown as Array<{ id: number; kind: string; label: string }>;
  const opts: SendAsOption[] = [];
  for (const a of accts) opts.push({ kind: 'account', id: Number(a.id), label: (a.display && a.display.trim()) || '@' + a.handle, sub: `${a.platform_key} · ${a.account_type}`, match: a.platmatch === true, avatar: a.avatar || undefined, editable: a.project_id === null });
  for (const i of idents) opts.push({ kind: 'identity', id: Number(i.id), label: String(i.label), sub: `persona · ${i.kind}`, match: false });
  return opts;   // already platform-match-first from SQL
}

// Inline "thêm nhanh" from the "Gửi bằng" picker when the identity you acted as isn't saved yet. Creates
// a GLOBAL (project_id null) account for the channel's platform — dedup via the unique index. Same infra
// as the FB Pages import, one at a time. Returns the new option to select immediately.
export async function addSendAsAccount(projectId: string, channel: string, handle: string): Promise<{ ok: boolean; option?: SendAsOption; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const h = handle.trim(); if (!h) return { ok: false, error: 'nhập tên/handle' };
  try {
    const platform = await reconcilePlatformKey(db, (CHANNEL_PLATFORM[channel] || [channel])[0] || channel);
    await db.execute(sql`INSERT INTO platforms (key, label, signup_url, description) VALUES (${platform}, ${platform}, '', 'Auto (send-as)') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_accounts (tenant_id, platform_key, project_id, handle, status, account_type) VALUES ('self', ${platform}, NULL, ${h}, 'active', 'brand') ON CONFLICT (tenant_id, platform_key, handle) DO NOTHING`);
    const ex = (await db.execute(sql`SELECT id FROM platform_accounts WHERE tenant_id = 'self' AND platform_key = ${platform} AND handle = ${h} LIMIT 1`)) as unknown as Array<{ id: number }>;
    const id = Number(ex[0]?.id);
    if (!id) return { ok: false, error: 'không tạo được' };
    return { ok: true, option: { kind: 'account', id, label: '@' + h, sub: `${platform} · brand`, match: true } };
  } catch (e) { return { ok: false, error: `thêm lỗi: ${(e as Error).message}` }; }
}

// Rename a send-as account (CRUD update). GLOBAL accounts only (project-owned ones are managed in the vault).
export async function renameSendAsAccount(accountId: number, handle: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const h = handle.trim(); if (!h) return { ok: false, error: 'nhập tên' };
  try {
    await db.execute(sql`UPDATE platform_accounts SET handle = ${h}, persona = COALESCE(persona, '{}'::jsonb) || jsonb_build_object('displayName', ${h}::text), updated_at = now() WHERE id = ${accountId} AND project_id IS NULL`);
    return { ok: true };
  } catch (e) { return { ok: false, error: /unique|duplicate/i.test(String(e)) ? 'tên đã tồn tại' : `sửa lỗi: ${(e as Error).message}` }; }
}

// Delete a send-as account (CRUD delete). GLOBAL accounts only → never nukes a project's real vault account.
export async function deleteSendAsAccount(accountId: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM platform_accounts WHERE id = ${accountId} AND project_id IS NULL`);
  return { ok: true };
}

// Add (or re-target) a channel for this prospect. Unique (prospect, channel) → idempotent.
export async function addTouch(projectId: string, prospectId: number, channel: string, targetRef: string): Promise<{ ok: boolean; touch?: Touch; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    const ins = await db.execute(sql`
      INSERT INTO outreach_touches (tenant_id, prospect_id, project_id, channel, target_ref)
      VALUES ('self', ${prospectId}, ${projectId}, ${channel}, ${targetRef || null})
      ON CONFLICT (prospect_id, channel) DO UPDATE SET target_ref = COALESCE(EXCLUDED.target_ref, outreach_touches.target_ref), updated_at = now()
      RETURNING id, channel, target_ref, content, status, sent_at, sent_as`);
    revalidatePath(`/p/${projectId}/outreach`);
    return { ok: true, touch: mapTouch((ins as unknown as Array<Record<string, unknown>>)[0]!) };
  } catch (e) { return { ok: false, error: `add touch lỗi: ${(e as Error).message}` }; }
}

export async function saveTouch(projectId: string, touchId: number, patch: { targetRef?: string; content?: string; sentAs?: SentAs }): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const sentAsFrag = patch.sentAs !== undefined ? sql`, sent_as = ${JSON.stringify(patch.sentAs)}::jsonb` : sql``;
  await db.execute(sql`UPDATE outreach_touches SET target_ref = COALESCE(${patch.targetRef ?? null}, target_ref), content = COALESCE(${patch.content ?? null}, content)${sentAsFrag}, updated_at = now() WHERE id = ${touchId} AND project_id = ${projectId}`);
  return { ok: true };
}

// Generate the per-channel message for a touch (voice differs from email). Saves + returns it.
export async function genTouch(projectId: string, prospectId: number, touchId: number): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    const rows = await db.execute(sql`
      SELECT t.channel, t.target_ref, p.agent_name, p.company, p.website AS p_site,
             c.from_name, pr.name AS product, pr.website AS website, pr.one_liner,
             ht.title AS src_title, ht.prep_payload->>'source_url' AS src_url
      FROM outreach_touches t
      JOIN outreach_prospects p ON p.id = t.prospect_id
      LEFT JOIN outreach_campaigns c ON c.id = p.campaign_id
      LEFT JOIN projects pr ON pr.id = t.project_id
      LEFT JOIN human_tasks ht ON ht.id = p.task_id
      WHERE t.id = ${touchId} AND t.project_id = ${projectId} LIMIT 1`);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) return { ok: false, error: 'touch not found' };
    const content = await genChannelContent({
      product: String(r.product || ''), website: String(r.website || ''), oneLiner: String(r.one_liner || ''),
      ownerName: String(r.agent_name || r.company || ''), sourceTitle: String(r.src_title || ''),
      sourceUrl: String(r.src_url || r.p_site || ''), targetRef: String(r.target_ref || ''),
      channel: String(r.channel), signer: firstNameOf(String(r.from_name || '')) || 'Jake',
    });
    if (!content) return { ok: false, error: 'không sinh được nội dung' };
    await db.execute(sql`UPDATE outreach_touches SET content = ${content}, updated_at = now() WHERE id = ${touchId}`);
    return { ok: true, content };
  } catch (e) { return { ok: false, error: `gen lỗi: ${(e as Error).message}` }; }
}

// Mark a touch sent (ext-assisted: operator pasted + sent). Advances the prospect if still to_send so
// the backlink task reflects "reached out" (syncProspectToTask). meta can carry the permalink.
export async function markTouchSent(projectId: string, prospectId: number, touchId: number, meta?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    await db.execute(sql`UPDATE outreach_touches SET status = 'sent', sent_at = COALESCE(sent_at, now()), meta = meta || ${JSON.stringify(meta || {})}::jsonb, updated_at = now() WHERE id = ${touchId} AND project_id = ${projectId}`);
    // Advance prospect to 'sent' if still queued → reflect onto the backlink task.
    await db.execute(sql`UPDATE outreach_prospects SET status = 'sent', sent_at = COALESCE(sent_at, now()), next_followup_at = COALESCE(next_followup_at, now() + interval '5 days'), updated_at = now() WHERE id = ${prospectId} AND status = 'to_send'`);
    await syncProspectToTask(prospectId);
    revalidatePath(`/p/${projectId}/outreach`);
    return { ok: true };
  } catch (e) { return { ok: false, error: `mark lỗi: ${(e as Error).message}` }; }
}

export async function deleteTouch(projectId: string, touchId: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM outreach_touches WHERE id = ${touchId} AND project_id = ${projectId}`);
  revalidatePath(`/p/${projectId}/outreach`);
  return { ok: true };
}
