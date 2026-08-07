'use server';

// Multi-channel outreach touches — CRUD + per-channel content gen + mark-sent. Email/form live on the
// prospect (auto-send unchanged); these are the EXTRA channels (social DM, comment, dev). A touch
// marked 'sent' advances the prospect (→ backlink task sync). See 2026-07-20-outreach-multichannel-plan.
import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { touchEntity } from '@/lib/touch-entity';
import { getCurrentUser } from '@/lib/auth';
import { syncProspectToTask } from './backlink-outreach-sync';
import { genChannelContent } from '@/lib/outreach/touch-content';
import { firstNameOf } from '@/lib/outreach/link-task';
import { reconcilePlatformKey } from '@/lib/resolve-platform';
import { fetchDirectusAccountsByPlatform, directusEnabled, type DirectusAccount } from '@/lib/bridge/directus';

async function isAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

export interface SentAs { kind?: 'account' | 'identity'; id?: number; label?: string }
export interface Touch { id: number; channel: string; targetRef: string; content: string; status: string; sentAt: string | null; sentAs: SentAs; resultUrl: string }

const mapTouch = (r: Record<string, unknown>): Touch => ({
  id: Number(r.id), channel: String(r.channel), targetRef: String(r.target_ref ?? ''), content: String(r.content ?? ''),
  status: String(r.status ?? 'to_send'), sentAt: r.sent_at ? String(r.sent_at) : null,
  sentAs: (r.sent_as && typeof r.sent_as === 'object') ? r.sent_as as SentAs : {},
  resultUrl: (r.meta && typeof r.meta === 'object' && (r.meta as Record<string, unknown>).resultUrl) ? String((r.meta as Record<string, unknown>).resultUrl) : '',
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
  const rows = await db.execute(sql`SELECT id, channel, target_ref, content, status, sent_at, sent_as, meta FROM outreach_touches WHERE prospect_id = ${prospectId} AND project_id = ${projectId} ORDER BY created_at`);
  return (rows as unknown as Array<Record<string, unknown>>).map(mapTouch);
}

// "Gửi bằng" (comment/DM as) options for a channel: the project's accounts for that channel's platform
// first, then its other accounts, then identities (personas). Generic — any channel picks who acted.
export interface SendAsOption { kind: 'account' | 'identity'; id: number; label: string; sub: string; match: boolean; avatar?: string; editable?: boolean; url?: string; followers?: number; directusId?: string }
const CHANNEL_PLATFORM: Record<string, string[]> = {
  facebook: ['facebook'], x: ['x', 'twitter'], linkedin: ['linkedin'], instagram: ['instagram'],
  reddit: ['reddit'], youtube: ['youtube'], telegram: ['telegram'], discord: ['discord'],
  medium: ['medium'], devto: ['devto', 'dev-to'], github: ['github'],
};
// Directus `accounts` is the master asset registry (as.on.tc). A page there carries handle + notes(profile URL)
// + stats(followers). Pull those into the picker instead of re-typing. Extract the rich bits:
const urlFromNotes = (notes?: string | null): string | undefined => { const m = (notes || '').match(/https?:\/\/\S+/); return m ? m[0].replace(/[)\].,]+$/, '') : undefined; };
const followersOf = (stats: unknown): number | undefined => {
  if (stats && typeof stats === 'object') { const s = stats as Record<string, unknown>; const n = Number(s.followers ?? s.friends); if (Number.isFinite(n) && n > 0) return n; }
  return undefined;
};
// Cache the Directus fetch per platform for the process lifetime — listSendAs runs on the drawer's
// auto-default hot path and the registry barely changes within a session. ponytail: no TTL, restart clears;
// failures aren't cached. adoptSendAsFromDirectus fetches fresh (it mutates), so no stale-after-write.
const _dxCache = new Map<string, Promise<DirectusAccount[]>>();
function dxAccounts(pk: string): Promise<DirectusAccount[]> {
  const hit = _dxCache.get(pk); if (hit) return hit;
  const p = fetchDirectusAccountsByPlatform(pk).catch(() => { _dxCache.delete(pk); return [] as DirectusAccount[]; });
  _dxCache.set(pk, p); return p;
}
export async function listSendAs(projectId: string, channel: string): Promise<SendAsOption[]> {
  const db = getDb(); if (!db) return [];
  const plats = CHANNEL_PLATFORM[channel] || [];
  // Bind each platform as its own param inside an ARRAY[...] literal. `${jsArray}::text[]` mis-serializes a
  // single-element array (pg sends the bare scalar → "malformed array literal: facebook", 22P02). sql.join
  // spreads them → ARRAY['facebook']::text[]; empty → ARRAY[]::text[] (still valid).
  const platArr = sql`ARRAY[${sql.join(plats.map((p) => sql`${p}`), sql`, `)}]::text[]`;
  // PLATFORM-STRICT: 1 kênh (FB) CHỈ hiện account của platform đó — FB Page/brand anh sở hữu, portfolio-wide
  // (bất kể project). KHÔNG kéo account platform khác của project vào (user: "modal FB chỉ danh tính FB").
  // Kênh KHÔNG map platform (plats rỗng) → fallback account của project (ngữ cảnh chung).
  const scope = plats.length
    ? sql`pa.platform_key = ANY(${platArr})`
    : sql`EXISTS (SELECT 1 FROM project_accounts pj WHERE pj.account_id = pa.id AND pj.project_id = ${projectId})`;
  const accts = (await db.execute(sql`
    SELECT pa.id, pa.platform_key, pa.handle, pa.account_type, pa.project_id,
           pa.persona->>'avatar' AS avatar, pa.persona->>'displayName' AS display,
           pa.persona->>'followerCount' AS followers,
           COALESCE(pa.persona->>'fbUrl', pa.persona->>'url', pa.persona->>'profileUrl') AS url,
           (pa.platform_key = ANY(${platArr})) AS platmatch
    FROM platform_accounts pa
    WHERE pa.tenant_id = 'self' AND COALESCE(pa.handle, '') <> '' AND (${scope})
    ORDER BY (pa.platform_key = ANY(${platArr})) DESC, pa.platform_key, pa.id DESC`)) as unknown as Array<{ id: number; platform_key: string; handle: string; account_type: string; project_id: string | null; avatar: string | null; display: string | null; followers: string | null; url: string | null; platmatch: boolean }>;   // id DESC = mới tạo lên đầu (thấy ngay, không lọt cuối)
  // Persona chung (identities) không thuộc platform nào → CHỈ cho kênh không map platform. FB/social = chỉ account platform đó.
  const idents = plats.length ? [] : ((await db.execute(sql`SELECT id, kind, COALESCE(NULLIF(display_name, ''), name) AS label FROM identities WHERE project_id = ${projectId} OR project_id IS NULL ORDER BY (project_id IS NOT NULL) DESC, id`)) as unknown as Array<{ id: number; kind: string; label: string }>);
  const opts: SendAsOption[] = [];
  const seen = new Set<string>();
  for (const a of accts) {
    const h = (a.handle || '').trim().toLowerCase(); if (h) seen.add(h);
    opts.push({ kind: 'account', id: Number(a.id), label: (a.display && a.display.trim()) || '@' + a.handle, sub: `${a.platform_key} · ${a.account_type}`, match: false, avatar: a.avatar || undefined, editable: a.project_id === null, url: a.url || undefined, followers: a.followers ? Number(a.followers) || undefined : undefined });
  }
  // Merge the master registry (Directus) — pages anh đã có ở as.on.tc mà MOS2 chưa nhập. Chọn 1 cái sẽ
  // adopt vào global pool (adoptSendAsFromDirectus). Dedup theo handle vs MOS2 + trong chính Directus.
  if (plats.length && directusEnabled()) {
    for (const pk of plats) {
      let rows: DirectusAccount[] = []; try { rows = await dxAccounts(pk); } catch { rows = []; }
      for (const d of rows) {
        const h = (d.handle || '').trim().toLowerCase(); if (!h || seen.has(h)) continue; seen.add(h);
        opts.push({ kind: 'account', id: 0, directusId: d.id, label: '@' + (d.handle || ''), sub: `${d.platform || pk} · Directus`, match: false, editable: false, url: urlFromNotes(d.notes), followers: followersOf(d.stats) });
      }
    }
  }
  for (const i of idents) opts.push({ kind: 'identity', id: Number(i.id), label: String(i.label), sub: `persona · ${i.kind}`, match: false });
  return opts;   // MOS2 accounts first, then Directus-only, then identities
}

// Full detail of a GLOBAL send-as account for the edit drawer (rich entity, not just the name).
export async function getSendAsAccount(accountId: number): Promise<{ id: number; handle: string; displayName: string; fbUrl: string; followers: string; status: string; platformKey: string } | null> {
  const db = getDb(); if (!db) return null;
  const rows = (await db.execute(sql`SELECT id, handle, platform_key, status, persona->>'displayName' AS display,
    COALESCE(persona->>'fbUrl', persona->>'url', persona->>'profileUrl') AS url, persona->>'followerCount' AS followers
    FROM platform_accounts WHERE id = ${accountId} LIMIT 1`)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0]; if (!r) return null;
  return { id: Number(r.id), handle: String(r.handle ?? ''), displayName: String(r.display ?? ''), fbUrl: String(r.url ?? ''), followers: String(r.followers ?? ''), status: String(r.status ?? 'active'), platformKey: String(r.platform_key ?? '') };
}

// Update a GLOBAL send-as account (rich edit — name/handle/url/followers/status). project_id IS NULL only.
export async function updateSendAsAccount(accountId: number, patch: { handle?: string; displayName?: string; fbUrl?: string; followers?: string; status?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    const persona: Record<string, string> = {};
    if (patch.displayName !== undefined) persona.displayName = patch.displayName;
    if (patch.fbUrl !== undefined) persona.fbUrl = patch.fbUrl;
    if (patch.followers !== undefined) persona.followerCount = patch.followers;
    const parts: SQL[] = [];
    if (patch.handle !== undefined && patch.handle.trim()) parts.push(sql`handle = ${patch.handle.trim()}`);
    if (patch.status) parts.push(sql`status = ${patch.status}`);
    parts.push(sql`persona = COALESCE(persona, '{}'::jsonb) || ${JSON.stringify(persona)}::jsonb`);
    parts.push(sql`updated_at = now()`);
    await db.execute(sql`UPDATE platform_accounts SET ${sql.join(parts, sql`, `)} WHERE id = ${accountId} AND project_id IS NULL`);
    return { ok: true };
  } catch (e) { return { ok: false, error: /unique|duplicate/i.test(String(e)) ? 'handle đã tồn tại' : `sửa lỗi: ${(e as Error).message}` }; }
}

// Create a GLOBAL send-as account WITH details (the create-drawer path — user fills name/handle/URL/followers,
// not a bare inline handle). Handle derives from displayName if left blank. Dedup via the partial unique index.
export async function createSendAsAccount(projectId: string, channel: string, fields: { handle?: string; displayName?: string; fbUrl?: string; followers?: string; status?: string }): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const name = (fields.displayName || '').trim();
  let handle = (fields.handle || '').trim();
  if (!handle) handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (!handle) return { ok: false, error: 'nhập Tên hiển thị hoặc Handle' };
  try {
    const platform = await reconcilePlatformKey(db, (CHANNEL_PLATFORM[channel] || [channel])[0] || channel);
    await db.execute(sql`INSERT INTO platforms (key, label, signup_url, description) VALUES (${platform}, ${platform}, '', 'Auto (send-as)') ON CONFLICT (key) DO NOTHING`);
    const persona: Record<string, string> = { source: 'manual' };
    if (name) persona.displayName = name;
    if (fields.fbUrl?.trim()) persona.fbUrl = fields.fbUrl.trim();
    if (fields.followers?.trim()) persona.followerCount = fields.followers.trim();
    const status = fields.status || 'active';
    await db.execute(sql`INSERT INTO platform_accounts (tenant_id, platform_key, project_id, handle, status, account_type, persona)
      VALUES ('self', ${platform}, NULL, ${handle}, ${status}, 'brand', ${JSON.stringify(persona)}::jsonb)
      ON CONFLICT (tenant_id, platform_key, handle) WHERE handle IS NOT NULL DO UPDATE SET persona = platform_accounts.persona || EXCLUDED.persona, status = EXCLUDED.status, updated_at = now()`);
    const ex = (await db.execute(sql`SELECT id FROM platform_accounts WHERE tenant_id = 'self' AND platform_key = ${platform} AND handle = ${handle} LIMIT 1`)) as unknown as Array<{ id: number }>;
    const id = Number(ex[0]?.id); if (!id) return { ok: false, error: 'không tạo được' };
    return { ok: true, id };
  } catch (e) { return { ok: false, error: /unique|duplicate/i.test(String(e)) ? 'handle đã tồn tại' : `tạo lỗi: ${(e as Error).message}` }; }
}

// Adopt a Directus account (master registry) into the GLOBAL send-as pool so a touch references a stable
// local id + it's reused everywhere. Enriches persona with the URL + followers from Directus. Dedup via the
// unique index. Returns the resolved option (real int id).
export async function adoptSendAsFromDirectus(projectId: string, channel: string, directusId: string): Promise<{ ok: boolean; option?: SendAsOption; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!directusEnabled()) return { ok: false, error: 'directus off' };
  try {
    const pk0 = (CHANNEL_PLATFORM[channel] || [channel])[0] || channel;
    const rows = await fetchDirectusAccountsByPlatform(pk0);
    const d = rows.find((x) => x.id === directusId);
    if (!d || !d.handle) return { ok: false, error: 'không thấy account Directus' };
    const platform = await reconcilePlatformKey(db, (d.platform || pk0).toLowerCase());
    const url = urlFromNotes(d.notes); const followers = followersOf(d.stats);
    const persona: Record<string, string> = { displayName: d.handle, source: 'directus', directusId };
    if (url) persona.fbUrl = url; if (followers) persona.followerCount = String(followers);
    await db.execute(sql`INSERT INTO platforms (key, label, signup_url, description) VALUES (${platform}, ${platform}, '', 'Auto (send-as)') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_accounts (tenant_id, platform_key, project_id, handle, status, account_type, persona)
      VALUES ('self', ${platform}, NULL, ${d.handle}, 'active', 'brand', ${JSON.stringify(persona)}::jsonb)
      ON CONFLICT (tenant_id, platform_key, handle) WHERE handle IS NOT NULL DO UPDATE SET persona = platform_accounts.persona || EXCLUDED.persona, updated_at = now()`);
    const ex = (await db.execute(sql`SELECT id FROM platform_accounts WHERE tenant_id = 'self' AND platform_key = ${platform} AND handle = ${d.handle} LIMIT 1`)) as unknown as Array<{ id: number }>;
    const id = Number(ex[0]?.id); if (!id) return { ok: false, error: 'không tạo được' };
    return { ok: true, option: { kind: 'account', id, label: '@' + d.handle, sub: `${platform} · brand`, match: true, editable: true, url, followers } };
  } catch (e) { return { ok: false, error: `adopt lỗi: ${(e as Error).message}` }; }
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
    // Unique index is PARTIAL (accounts_tenant_platform_handle_uniq … WHERE handle IS NOT NULL) → ON CONFLICT
    // MUST repeat the predicate or pg errors "no unique or exclusion constraint matching".
    await db.execute(sql`INSERT INTO platform_accounts (tenant_id, platform_key, project_id, handle, status, account_type) VALUES ('self', ${platform}, NULL, ${h}, 'active', 'brand') ON CONFLICT (tenant_id, platform_key, handle) WHERE handle IS NOT NULL DO NOTHING`);
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
    // Always INSERT a fresh touch — same channel can repeat (FB 1, FB 2…); the unique index was dropped (0149).
    const ins = await db.execute(sql`
      INSERT INTO outreach_touches (tenant_id, prospect_id, project_id, channel, target_ref)
      VALUES ('self', ${prospectId}, ${projectId}, ${channel}, ${targetRef || null})
      RETURNING id, channel, target_ref, content, status, sent_at, sent_as, meta`);
    await touchEntity('outreach', { projectId });
    return { ok: true, touch: mapTouch((ins as unknown as Array<Record<string, unknown>>)[0]!) };
  } catch (e) { return { ok: false, error: `add touch lỗi: ${(e as Error).message}` }; }
}

export async function saveTouch(projectId: string, touchId: number, patch: { targetRef?: string; content?: string; sentAs?: SentAs; resultUrl?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const sentAsFrag = patch.sentAs !== undefined ? sql`, sent_as = ${JSON.stringify(patch.sentAs)}::jsonb` : sql``;
  // resultUrl = tracking/placement link (the comment/post URL where our link landed) → meta.resultUrl.
  const metaFrag = patch.resultUrl !== undefined ? sql`, meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ resultUrl: patch.resultUrl })}::jsonb` : sql``;
  await db.execute(sql`UPDATE outreach_touches SET target_ref = COALESCE(${patch.targetRef ?? null}, target_ref), content = COALESCE(${patch.content ?? null}, content)${sentAsFrag}${metaFrag}, updated_at = now() WHERE id = ${touchId} AND project_id = ${projectId}`);
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
    await touchEntity('outreach', { projectId });
    return { ok: true };
  } catch (e) { return { ok: false, error: `mark lỗi: ${(e as Error).message}` }; }
}

export async function deleteTouch(projectId: string, touchId: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM outreach_touches WHERE id = ${touchId} AND project_id = ${projectId}`);
  await touchEntity('outreach', { projectId });
  return { ok: true };
}
