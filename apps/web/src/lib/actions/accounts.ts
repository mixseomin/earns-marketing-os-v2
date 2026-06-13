'use server';

// Server Actions for platform account CRUD + warmup checklist updates.

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, platformAccounts, platforms } from '@mos2/db';
import {
  fetchDirectusAccountsByPlatform, fetchDirectusAccount,
  createDirectusAccount, updateDirectusAccount,
  findDirectusPlatformBySlug,
  normalizeStatus, denormalizeStatus, directusEnabled,
  type DirectusAccount, type DirectusAccountWritable,
} from '../bridge/directus';
import { encryptValue, decryptValue, cryptoEnabled } from '../crypto';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export type AccountStatus =
  | 'todo' | 'creating' | 'warming' | 'active' | 'limited' | 'blocked' | 'banned';

// 0058: phân biệt user vs bot/app account. Logic gate khác nhau hoàn toàn —
// xem brief-readiness.ts cho rule details + accountKindMeta() ở status-meta.
export type AccountKind = 'user' | 'bot' | 'app';

export type AuthMethod =
  | 'password' | 'sso-google' | 'sso-github' | 'sso-x' | 'sso-linkedin'
  | 'sso-facebook' | 'sso-apple' | 'magic-link' | 'passkey' | 'phone-otp';

export interface AccountInput {
  platformKey: string;
  handle?: string | null;
  email?: string | null;
  status?: AccountStatus;
  authMethod?: AuthMethod | null;
  has2fa?: boolean;
  recoveryInfo?: string | null;
  monthlyCost?: number;
  collectStats?: boolean;
  blockReason?: string | null;
  notes?: string | null;
  tags?: string[];
  ownerUserId?: number | null;
  persona?: Record<string, string>;
  // 0058: bot/app fields. Khi accountKind='bot'|'app' thì client_id required +
  // bot_token thay cho password.
  accountKind?: AccountKind;
  clientId?: string | null;
  // bot_token raw set qua setAccountApiToken / setAccountBotToken (encrypted).
}

export interface ChecklistEntry {
  done: boolean;
  value?: number | string | null;
  target?: number | null;
  updatedAt?: string;
}

async function findById(projectId: string, id: number) {
  const db = ensureDb();
  // project_id on platform_accounts may be NULL (multi-brand) — verify access via pivot.
  // Use query builder (returns camelCase) instead of raw execute (returns snake_case).
  const rows = await db
    .select()
    .from(platformAccounts)
    .where(and(
      eq(platformAccounts.tenantId, TENANT),
      eq(platformAccounts.id, id),
      sql`EXISTS (SELECT 1 FROM project_accounts pj WHERE pj.account_id = ${platformAccounts.id} AND pj.project_id = ${projectId})`,
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAccount(projectId: string, input: AccountInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = ensureDb();
  if (!input.platformKey) return { ok: false, error: 'platformKey required' };

  // Verify platform exists in catalog.
  const pf = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, input.platformKey)).limit(1);
  if (pf.length === 0) return { ok: false, error: `Platform "${input.platformKey}" not in catalog` };

  const [row] = await db
    .insert(platformAccounts)
    .values({
      tenantId: TENANT,
      projectId,
      platformKey: input.platformKey,
      handle: input.handle ?? null,
      email: input.email ?? null,
      status: input.status ?? 'todo',
      authMethod: input.authMethod ?? null,
      has2fa: input.has2fa ?? false,
      recoveryInfo: input.recoveryInfo ?? null,
      monthlyCost: input.monthlyCost ?? 0,
      collectStats: input.collectStats ?? false,
      blockReason: input.blockReason ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      warmupChecklist: {},
      ownerUserId: input.ownerUserId ?? null,
      persona: input.persona ?? {},
      accountKind: input.accountKind ?? 'user',
    })
    .returning({ id: platformAccounts.id });

  // Pivot: account vừa tạo mặc định 'primary' 100% cho project owner.
  if (row?.id) {
    await db.execute(sql`
      INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
      VALUES (${projectId}, ${row.id}, 'primary', 100)
      ON CONFLICT DO NOTHING
    `);

    // Auto-push sang Directus (single source of truth cho asset). Lỗi
    // không block create — local đã insert OK. Warning log để debug.
    if (directusEnabled()) {
      try {
        await pushAccountToDirectus(projectId, row.id);
      } catch (e) {
        console.warn('[accounts] auto-push to Directus failed', e);
      }
    }
  }

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, id: row?.id };
}

// ── Multi-brand sharing ──────────────────────────────────────────
// Liên kết account hiện có với project khác (vd: @tuan_builds dùng cho
// Astrolas + Orit). role: 'primary' (account chính của brand) | 'shared'.
// contentRatio: % content từ account này dành cho project (0-100).
export async function linkAccountToProject(
  accountId: number,
  projectId: string,
  role: 'primary' | 'shared' = 'shared',
  contentRatio = 0,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.execute(sql`
    INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
    VALUES (${projectId}, ${accountId}, ${role}, ${contentRatio})
    ON CONFLICT (project_id, account_id) DO UPDATE
      SET role = EXCLUDED.role, content_ratio = EXCLUDED.content_ratio
  `);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

export async function unlinkAccountFromProject(
  accountId: number,
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.execute(sql`
    DELETE FROM project_accounts
    WHERE account_id = ${accountId} AND project_id = ${projectId}
  `);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

// ── Account grants (share account cho agents + users khác ngoài owner) ──
export interface AccountGrantRow {
  id: number;
  granteeKind: 'agent' | 'user';
  granteeId: string;        // agent_ref hoặc user_id (string)
  granteeLabel: string;     // tên hiển thị (label agent / displayName user)
  role: 'use' | 'admin';
  notes: string | null;
  grantedAt: Date;
}

export async function listAccountGrants(accountId: number): Promise<AccountGrantRow[]> {
  const db = ensureDb();
  // Join để lấy label cho cả agent + user trong 1 query
  const rows = await db.execute(sql`
    SELECT g.id, g.grantee_kind, g.grantee_id, g.role, g.notes, g.granted_at,
           CASE g.grantee_kind
             WHEN 'agent' THEN COALESCE(a.label, a.agent_ref)
             WHEN 'user'  THEN COALESCE(m.display_name, u.name, u.email, '?')
           END AS grantee_label
    FROM account_grants g
    LEFT JOIN agents a ON g.grantee_kind = 'agent' AND a.agent_ref = g.grantee_id
    LEFT JOIN users  u ON g.grantee_kind = 'user'  AND u.id::text = g.grantee_id
    LEFT JOIN members m ON g.grantee_kind = 'user' AND m.user_id::text = g.grantee_id AND m.project_id IS NULL
    WHERE g.account_id = ${accountId}
    ORDER BY g.grantee_kind, g.granted_at DESC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    granteeKind: String(r.grantee_kind) as 'agent' | 'user',
    granteeId: String(r.grantee_id),
    granteeLabel: String(r.grantee_label ?? '?'),
    role: String(r.role) as 'use' | 'admin',
    notes: (r.notes as string | null) ?? null,
    grantedAt: new Date(r.granted_at as string),
  }));
}

export async function addAccountGrant(
  accountId: number,
  granteeKind: 'agent' | 'user',
  granteeId: string,
  role: 'use' | 'admin' = 'use',
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  try {
    await db.execute(sql`
      INSERT INTO account_grants (account_id, grantee_kind, grantee_id, role, notes)
      VALUES (${accountId}, ${granteeKind}, ${granteeId}, ${role}, ${notes ?? null})
      ON CONFLICT (account_id, grantee_kind, grantee_id) DO UPDATE
        SET role = EXCLUDED.role, notes = EXCLUDED.notes
    `);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeAccountGrant(grantId: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.execute(sql`DELETE FROM account_grants WHERE id = ${grantId}`);
  return { ok: true };
}

// Lấy danh sách agents available cho project hiện tại (để picker share)
export async function listProjectAgentsForGrant(projectId: string): Promise<Array<{
  agentRef: string;
  label: string | null;
  squadKey: string | null;
}>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT a.agent_ref, a.label, s.squad_key
    FROM agents a
    LEFT JOIN squads s ON s.id = a.squad_id
    WHERE a.project_id = ${projectId} AND a.status = 'active'
    ORDER BY s.squad_key, a.agent_ref
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    agentRef: String(r.agent_ref),
    label: r.label ? String(r.label) : null,
    squadKey: r.squad_key ? String(r.squad_key) : null,
  }));
}

// Trả về tất cả projects đang share 1 account (cho UI "Used by" badge).
export async function listAccountProjects(accountId: number): Promise<Array<{
  projectId: string;
  projectName: string;
  role: string;
  contentRatio: number;
}>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT pj.project_id, p.name AS project_name, pj.role, pj.content_ratio
    FROM project_accounts pj
    JOIN projects p ON p.id = pj.project_id
    WHERE pj.account_id = ${accountId}
    ORDER BY pj.role DESC, p.name
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    projectId: String(r['project_id']),
    projectName: String(r['project_name']),
    role: String(r['role']),
    contentRatio: Number(r['content_ratio'] ?? 0),
  }));
}

// Panel "Projects tham gia" cho account editor: participations (primary=profile-target)
// + danh sách project có thể tham gia thêm.
export async function accountProjectsPanel(accountId: number): Promise<{
  participations: Array<{ projectId: string; name: string; emoji: string; role: string }>;
  allProjects: Array<{ id: string; name: string; emoji: string }>;
}> {
  const db = ensureDb();
  const parts = await db.execute(sql`
    SELECT pj.project_id, pj.role, p.name, p.emoji
    FROM project_accounts pj LEFT JOIN projects p ON p.id = pj.project_id
    WHERE pj.account_id = ${accountId}
    ORDER BY (pj.role = 'primary') DESC, p.name
  `);
  const all = await db.execute(sql`
    SELECT id, name, emoji FROM projects WHERE is_demo = false AND archived_at IS NULL ORDER BY name
  `);
  return {
    participations: (parts as unknown as Array<Record<string, unknown>>).map((r) => ({
      projectId: String(r['project_id']), name: String(r['name'] ?? r['project_id']), emoji: r['emoji'] ? String(r['emoji']) : '', role: String(r['role'] ?? 'shared'),
    })),
    allProjects: (all as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r['id']), name: String(r['name'] ?? r['id']), emoji: r['emoji'] ? String(r['emoji']) : '',
    })),
  };
}

// Đổi PROFILE-TARGET (project chính) — NON-DESTRUCTIVE: primary cũ tụt 'shared' (giữ tham gia).
export async function setAccountPrimaryProject(accountId: number, newProjectId: string): Promise<{ ok: boolean; error?: string; oldPrimary?: string }> {
  const db = ensureDb();
  const cur = await db.execute(sql`SELECT project_id FROM project_accounts WHERE account_id = ${accountId} AND role = 'primary' LIMIT 1`);
  const oldPrimary = (cur as unknown as Array<{ project_id: string }>)[0]?.project_id || '';
  if (oldPrimary === newProjectId) return { ok: true, oldPrimary };
  await db.transaction(async (tx) => {
    if (oldPrimary) await tx.execute(sql`UPDATE project_accounts SET role = 'shared' WHERE account_id = ${accountId} AND project_id = ${oldPrimary}`);
    await tx.execute(sql`INSERT INTO project_accounts (project_id, account_id, role, content_ratio) VALUES (${newProjectId}, ${accountId}, 'primary', 100) ON CONFLICT (project_id, account_id) DO UPDATE SET role = 'primary'`);
    await tx.execute(sql`UPDATE platform_accounts SET project_id = ${newProjectId} WHERE id = ${accountId}`);
  });
  for (const p of [oldPrimary, newProjectId]) { if (p) { revalidatePath(`/p/${p}/resources`); revalidatePath(`/p/${p}/seeding`); } }
  return { ok: true, oldPrimary };
}

// Tham gia thêm project (shared; primary nếu account chưa có primary nào).
export async function joinAccountProjectShared(accountId: number, projectId: string): Promise<{ ok: boolean; role: string }> {
  const db = ensureDb();
  const cur = await db.execute(sql`SELECT 1 FROM project_accounts WHERE account_id = ${accountId} AND role = 'primary' LIMIT 1`);
  const role = (cur as unknown as Array<unknown>).length > 0 ? 'shared' : 'primary';
  await db.execute(sql`INSERT INTO project_accounts (project_id, account_id, role, content_ratio) VALUES (${projectId}, ${accountId}, ${role}, ${role === 'primary' ? 100 : 0}) ON CONFLICT (project_id, account_id) DO NOTHING`);
  if (role === 'primary') await db.execute(sql`UPDATE platform_accounts SET project_id = ${projectId} WHERE id = ${accountId}`);
  revalidatePath(`/p/${projectId}/resources`); revalidatePath(`/p/${projectId}/seeding`);
  return { ok: true, role };
}

// Rời project (chỉ 'shared'; primary phải đổi project chính trước).
export async function leaveAccountProject(accountId: number, projectId: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const cur = await db.execute(sql`SELECT role FROM project_accounts WHERE account_id = ${accountId} AND project_id = ${projectId} LIMIT 1`);
  const role = (cur as unknown as Array<{ role: string }>)[0]?.role;
  if (role === 'primary') return { ok: false, error: 'Không thể rời project chính — đặt project khác làm chính trước.' };
  await db.execute(sql`DELETE FROM project_accounts WHERE account_id = ${accountId} AND project_id = ${projectId}`);
  revalidatePath(`/p/${projectId}/resources`); revalidatePath(`/p/${projectId}/seeding`);
  return { ok: true };
}

export async function updateAccount(projectId: string, id: number, patch: Partial<AccountInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  const set: Partial<typeof platformAccounts.$inferInsert> = { updatedAt: new Date() };
  if (patch.handle !== undefined) set.handle = patch.handle;
  if (patch.email !== undefined) set.email = patch.email;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.authMethod !== undefined) set.authMethod = patch.authMethod;
  if (patch.has2fa !== undefined) set.has2fa = patch.has2fa;
  if (patch.recoveryInfo !== undefined) set.recoveryInfo = patch.recoveryInfo;
  if (patch.monthlyCost !== undefined) set.monthlyCost = patch.monthlyCost | 0;
  if (patch.collectStats !== undefined) set.collectStats = patch.collectStats;
  if (patch.blockReason !== undefined) set.blockReason = patch.blockReason;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.platformKey !== undefined) set.platformKey = patch.platformKey;
  if (patch.ownerUserId !== undefined) set.ownerUserId = patch.ownerUserId;
  if (patch.persona !== undefined) set.persona = patch.persona;
  if (patch.accountKind !== undefined) set.accountKind = patch.accountKind;
  if (patch.clientId !== undefined) set.clientId = patch.clientId;

  await db.update(platformAccounts).set(set).where(eq(platformAccounts.id, acc.id));

  // CASCADE 0057: nếu account chuyển sang todo/creating/blocked/banned →
  // tất cả community_briefs của account này phải reset join_status='not_joined'
  // (logically: account chưa tồn tại hoặc đã ban → không thể là member community).
  // Giữ joined_at làm lịch sử ('đã từng join') nhưng đổi status để gate fire.
  if (patch.status !== undefined) {
    const s = patch.status;
    if (s === 'todo' || s === 'creating' || s === 'blocked' || s === 'banned') {
      await db.execute(sql`
        UPDATE community_briefs
           SET join_status = 'not_joined', updated_at = now()
         WHERE account_id = ${acc.id} AND join_status != 'not_joined'
      `);
    }
  }

  // Auto-push update sang Directus. Lỗi không block — local đã update OK.
  if (directusEnabled()) {
    try {
      await pushAccountToDirectus(projectId, acc.id);
    } catch (e) {
      console.warn('[accounts] auto-push update to Directus failed', e);
    }
  }

  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

export async function setAccountStatus(projectId: string, id: number, status: AccountStatus, blockReason?: string | null): Promise<{ ok: boolean; error?: string }> {
  return updateAccount(projectId, id, { status, blockReason: blockReason ?? null });
}

export async function deleteAccount(projectId: string, id: number): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  await db.delete(platformAccounts).where(eq(platformAccounts.id, acc.id));
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

// 1 account (AccountRow đầy đủ) để sửa TẠI CHỖ từ trang Seeding —
// reuse mapper của data.listAccounts (tránh drift). Dynamic import tránh
// kéo data layer vào client bundle.
export async function getAccountForEdit(projectId: string, id: number) {
  const { getAccountRow } = await import('@/lib/data');
  return getAccountRow(projectId, id);
}

// ── Bridge: Directus as.on.tc (READ-ONLY import) ─────────────

export interface DirectusAccountSummary {
  directusId: string;
  platform: string;
  handle: string | null;
  email: string | null;
  status: string;             // normalized to mos2 state machine
  authMethod: string | null;
  has2fa: boolean;
  tags: string[];
  notes: string | null;
  duplicateCount: number;     // 1 if unique; >1 if Directus has dupes (case variants)
  duplicatePlatformKeys: string[]; // raw platform values found across dupes
  localAccountId: number | null; // populated by listDirectusAccountsForPlatform — null = not imported
}

function summarize(d: DirectusAccount): DirectusAccountSummary {
  return {
    directusId: d.id,
    platform: d.platform || '',
    handle: d.handle,
    email: d.email,
    status: normalizeStatus(d.status),
    authMethod: d.auth_method,
    has2fa: !!d.has_2fa,
    tags: Array.isArray(d.tags) ? d.tags : [],
    notes: d.notes,
    duplicateCount: 1,
    duplicatePlatformKeys: [d.platform || ''],
    localAccountId: null,
  };
}

// MOS2-native accounts on a platform within a project. Used by the
// AccountFormModal when in "pick or create" mode (e.g. opened from
// habitat drawer "+ Add account") so the user can attach an EXISTING
// MOS2 account instead of creating a duplicate or only being able to
// pick from the Directus mirror.
//
// Each row also carries:
//   briefedHabitats — habitat names this account already has briefs in,
//                      so the picker can show "đã có brief ở 2 tribe khác".
//   alreadyBriefedHere — bool, true when caller passes excludeHabitatId
//                          AND a brief exists for that pair (we still
//                          return the row but flag it).
export async function listAccountsForProjectByPlatform(
  projectId: string, platformKey: string, excludeHabitatId?: number,
): Promise<Array<{
  id: number;
  handle: string | null;
  email: string | null;
  status: string;
  tags: string[];
  briefedHabitats: string[];
  alreadyBriefedHere: boolean;
}>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT
      pa.id, pa.handle, pa.email, pa.status, pa.tags,
      COALESCE(
        ARRAY(
          SELECT h.name FROM community_briefs b
          JOIN habitats h ON h.id = b.habitat_id
          WHERE b.account_id = pa.id
          ORDER BY h.name
        ),
        ARRAY[]::text[]
      ) AS briefed_habitats,
      ${excludeHabitatId != null
        ? sql`EXISTS (SELECT 1 FROM community_briefs b WHERE b.account_id = pa.id AND b.habitat_id = ${excludeHabitatId})`
        : sql`false`} AS already_briefed_here
    FROM platform_accounts pa
    JOIN project_accounts pj ON pj.account_id = pa.id AND pj.project_id = ${projectId}
    WHERE pa.tenant_id = ${TENANT}
      AND pa.platform_key = ${platformKey.toLowerCase()}
    ORDER BY pa.handle ASC NULLS LAST
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    handle: r.handle ? String(r.handle) : null,
    email:  r.email  ? String(r.email)  : null,
    status: String(r.status ?? 'todo'),
    tags:   Array.isArray(r.tags) ? (r.tags as string[]) : [],
    briefedHabitats: Array.isArray(r.briefed_habitats) ? (r.briefed_habitats as string[]) : [],
    alreadyBriefedHere: !!r.already_briefed_here,
  }));
}

export async function listDirectusAccountsForPlatform(platformKey: string): Promise<{
  ok: boolean; enabled: boolean; accounts: DirectusAccountSummary[]; error?: string;
}> {
  if (!directusEnabled()) return { ok: true, enabled: false, accounts: [] };
  try {
    const data = await fetchDirectusAccountsByPlatform(platformKey);
    // Defensive dedupe: Directus sometimes has same logical account stored
    // under different platform-key casings (e.g. 'buymeacoffee' + 'BuyMeACoffee').
    // Collapse to one row per (lowercased platform, handle) — keep the first seen
    // (sorted by handle from API) but track how many duplicates exist + their
    // platform-key variants so the UI can flag the data-quality issue.
    const dedup = new Map<string, DirectusAccountSummary>();
    for (const a of data) {
      const key = `${(a.platform || '').toLowerCase()}|${a.handle ?? ''}`;
      const existing = dedup.get(key);
      if (existing) {
        existing.duplicateCount += 1;
        if (a.platform && !existing.duplicatePlatformKeys.includes(a.platform)) {
          existing.duplicatePlatformKeys.push(a.platform);
        }
        continue;
      }
      dedup.set(key, summarize(a));
    }
    const summaries = Array.from(dedup.values());
    // Enrich with localAccountId: any MOS2 account whose tags include
    // `imported:directus:<id>` OR matches (platform, handle) of a directus row.
    if (summaries.length > 0) {
      const db = ensureDb();
      const handles = summaries.map((s) => s.handle).filter((h): h is string => !!h);
      // Drizzle inArray() handles the pg array binding properly — earlier
      // raw `handle = ANY(${handles})` failed with "op ANY/ALL (array)
      // requires array on right side" because the JS array was bound as
      // a scalar parameter.
      if (handles.length > 0) {
        const localRows = await db
          .select({
            id: platformAccounts.id,
            handle: platformAccounts.handle,
            tags: platformAccounts.tags,
          })
          .from(platformAccounts)
          .where(and(
            eq(platformAccounts.tenantId, TENANT),
            eq(platformAccounts.platformKey, platformKey.toLowerCase()),
            inArray(platformAccounts.handle, handles),
          ));
        for (const s of summaries) {
          // Tag match first (survives handle rename)
          const byTag = localRows.find((r) => Array.isArray(r.tags) && (r.tags as string[]).includes(`imported:directus:${s.directusId}`));
          if (byTag) { s.localAccountId = byTag.id; continue; }
          const byHandle = localRows.find((r) => r.handle && r.handle === s.handle);
          if (byHandle) s.localAccountId = byHandle.id;
        }
      }
    }
    return { ok: true, enabled: true, accounts: summaries };
  } catch (e) {
    return { ok: false, enabled: true, accounts: [], error: (e as Error).message };
  }
}

export async function importDirectusAccount(projectId: string, directusId: string): Promise<{ ok: boolean; id?: number; alreadyExists?: boolean; error?: string }> {
  if (!directusEnabled()) return { ok: false, error: 'Directus bridge disabled' };
  const db = ensureDb();

  const d = await fetchDirectusAccount(directusId);
  if (!d) return { ok: false, error: 'Directus account not found' };
  if (!d.platform) return { ok: false, error: 'Directus account has no platform set' };

  const platformKey = d.platform.toLowerCase();
  const pf = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, platformKey)).limit(1);
  if (pf.length === 0) {
    return { ok: false, error: `Platform "${d.platform}" not in MOS2 catalog. Add to catalog first.` };
  }

  // Idempotent (tenant-scoped): account đã tồn tại ở tenant ⇒ chỉ link vào pivot
  // cho project hiện tại (multi-brand). Nếu pivot đã có ⇒ no-op.
  if (d.handle) {
    const existing = await db
      .select({ id: platformAccounts.id })
      .from(platformAccounts)
      .where(and(
        eq(platformAccounts.tenantId, TENANT),
        eq(platformAccounts.platformKey, platformKey),
        eq(platformAccounts.handle, d.handle),
      ))
      .limit(1);
    if (existing.length > 0) {
      const accId = existing[0]!.id;
      await db.execute(sql`
        INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
        VALUES (${projectId}, ${accId}, 'shared', 0)
        ON CONFLICT DO NOTHING
      `);
      revalidatePath(`/p/${projectId}/resources`);
      return { ok: true, id: accId, alreadyExists: true };
    }
  }

  const importedTag = `imported:directus:${d.id}`;
  const tags = Array.isArray(d.tags) ? [...d.tags, importedTag] : [importedTag];

  const [row] = await db
    .insert(platformAccounts)
    .values({
      tenantId: TENANT,
      projectId,
      platformKey,
      handle: d.handle,
      email: d.email,
      status: normalizeStatus(d.status),
      authMethod: d.auth_method,
      has2fa: !!d.has_2fa,
      recoveryInfo: d.recovery_info ?? null,
      monthlyCost: d.monthly_cost ?? 0,
      collectStats: !!d.collect_stats,
      blockReason: null,
      notes: d.notes,
      tags,
      warmupChecklist: (d.warmup_checklist as Record<string, unknown>) || {},
    })
    .returning({ id: platformAccounts.id });

  if (row?.id) {
    await db.execute(sql`
      INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
      VALUES (${projectId}, ${row.id}, 'primary', 100)
      ON CONFLICT DO NOTHING
    `);
  }

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, id: row?.id };
}

// Push MOS2 account → Directus. If account has tag `imported:directus:<id>`,
// PATCH that row; otherwise POST new + tag the local row with the new directus id.
export async function pushAccountToDirectus(
  projectId: string, accountId: number,
): Promise<{ ok: boolean; directusId?: string; created?: boolean; error?: string }> {
  if (!directusEnabled()) return { ok: false, error: 'Directus bridge disabled' };
  const acc = await findById(projectId, accountId);
  if (!acc) return { ok: false, error: 'account not found' };

  const tags = Array.isArray(acc.tags) ? (acc.tags as string[]) : [];
  const importTag = tags.find((t) => t.startsWith('imported:directus:'));
  const existingDirectusId = importTag ? importTag.slice('imported:directus:'.length) : null;

  // Resolve platform_id (m2o uuid) qua slug lookup. Directus UI filter
  // "Platform là Discord" dùng platform_id picker, không phải text field.
  // Bỏ qua platform_id nếu lookup fail (legacy `platform` text vẫn được set).
  let platformId: string | null = null;
  try {
    const p = await findDirectusPlatformBySlug(acc.platformKey);
    platformId = p?.id ?? null;
  } catch (e) {
    console.warn('[accounts] findDirectusPlatformBySlug failed', e);
  }

  const payload: DirectusAccountWritable = {
    platform: acc.platformKey,
    platform_id: platformId,
    handle: acc.handle ?? null,
    email: acc.email ?? null,
    status: denormalizeStatus(acc.status),
    auth_method: acc.authMethod ?? null,
    has_2fa: !!acc.has2fa,
    monthly_cost: acc.monthlyCost ?? 0,
    collect_stats: !!acc.collectStats,
    tags: tags.filter((t) => !t.startsWith('imported:directus:')),
    notes: acc.notes ?? null,
    recovery_info: acc.recoveryInfo ?? null,
    warmup_checklist: (acc.warmupChecklist as Record<string, unknown>) ?? {},
  };

  try {
    if (existingDirectusId) {
      await updateDirectusAccount(existingDirectusId, payload);
      return { ok: true, directusId: existingDirectusId, created: false };
    }
    const created = await createDirectusAccount(payload);
    // Tag the local account with new directus id so subsequent pushes PATCH
    const db = ensureDb();
    const newTags = [...tags, `imported:directus:${created.id}`];
    await db.update(platformAccounts)
      .set({ tags: newTags, updatedAt: new Date() })
      .where(eq(platformAccounts.id, accountId));
    revalidatePath(`/p/${projectId}/resources`);
    return { ok: true, directusId: created.id, created: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function toggleChecklistItem(projectId: string, id: number, itemKey: string, done: boolean, value?: number | string | null): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  const checklist = (acc.warmupChecklist as Record<string, ChecklistEntry>) || {};
  checklist[itemKey] = {
    done,
    value: value ?? null,
    target: checklist[itemKey]?.target ?? null,
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(platformAccounts)
    .set({ warmupChecklist: checklist, updatedAt: new Date() })
    .where(eq(platformAccounts.id, acc.id));

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

// ── API token encryption (Phase 8 — pgcrypto) ────────────────────
// Write-only flow: setAccountApiToken stores encrypted; UI never reads back.
// Reveal: revealAccountApiToken returns plaintext one-time (server action call).
// Clear: clearAccountApiToken sets column NULL.

export async function setAccountApiToken(
  projectId: string, id: number, plaintext: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!cryptoEnabled()) return { ok: false, error: 'MOS2_SECRET_KEY chưa cấu hình trên server' };
  if (!plaintext.trim()) return { ok: false, error: 'token rỗng' };
  const db = ensureDb();
  try {
    const enc = await encryptValue(plaintext);
    await db.update(platformAccounts)
      .set({ apiTokenEnc: enc, updatedAt: new Date() })
      .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)));
    revalidatePath(`/p/${projectId}/resources`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function revealAccountApiToken(
  projectId: string, id: number,
): Promise<{ ok: boolean; plaintext?: string; error?: string }> {
  if (!cryptoEnabled()) return { ok: false, error: 'MOS2_SECRET_KEY chưa cấu hình' };
  const db = ensureDb();
  const rows = await db.select({ enc: platformAccounts.apiTokenEnc })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'account not found' };
  if (!rows[0]!.enc) return { ok: true, plaintext: '' };
  try {
    const plain = await decryptValue(rows[0]!.enc);
    return { ok: true, plaintext: plain };
  } catch (e) {
    return { ok: false, error: `decrypt failed: ${(e as Error).message}` };
  }
}

export async function clearAccountApiToken(
  projectId: string, id: number,
): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(platformAccounts)
    .set({ apiTokenEnc: null, updatedAt: new Date() })
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)));
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

// ── Platform sync ────────────────────────────────────────────────────
// Fetch profile từ platform API (Discord/Reddit/X/Telegram/Slack/...)
// dùng token đã encrypt, merge về platform_accounts + persona.

export async function syncAccountFromPlatform(
  projectId: string, id: number,
): Promise<{
  ok: boolean;
  updated?: string[];        // list field tên đã update
  profile?: Record<string, unknown>;
  error?: string;
}> {
  if (!cryptoEnabled()) return { ok: false, error: 'MOS2_SECRET_KEY chưa cấu hình' };
  const { getSyncer } = await import('@/lib/platform-syncers');
  const db = ensureDb();

  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  const syncer = getSyncer(acc.platformKey);
  if (!syncer) {
    return { ok: false, error: `Platform "${acc.platformKey}" chưa support sync (chỉ: discord/reddit/x/telegram/slack)` };
  }

  // Pick token: bot_token nếu account_kind='bot', else api_token.
  const isBot = acc.accountKind === 'bot' || acc.accountKind === 'app';
  const encColumn = isBot ? acc.botTokenEnc : acc.apiTokenEnc;
  if (!encColumn) {
    return {
      ok: false,
      error: isBot
        ? 'Account chưa có bot_token. Set qua field "Bot token" trong modal.'
        : 'Account chưa có api_token. Set qua field "API token".',
    };
  }
  let token: string;
  try {
    token = await decryptValue(encColumn);
  } catch (e) {
    return { ok: false, error: `decrypt token fail: ${(e as Error).message}` };
  }
  if (!token) return { ok: false, error: 'Token decrypt empty' };

  const res = await syncer.fetch({
    token,
    clientId: acc.clientId,
    accountKind: acc.accountKind,
  });
  if (!res.ok || !res.profile) {
    return { ok: false, error: res.error ?? 'Syncer trả không OK' };
  }
  const p = res.profile;

  // Merge: chỉ overwrite nếu profile có giá trị non-null. Local edit của user
  // KHÔNG bị mất nếu API không trả field đó.
  const updated: string[] = [];
  const set: Partial<typeof platformAccounts.$inferInsert> = { updatedAt: new Date() };
  if (p.handle && p.handle !== acc.handle) { set.handle = p.handle; updated.push('handle'); }
  if (p.email && p.email !== acc.email) { set.email = p.email; updated.push('email'); }
  if (typeof p.mfaEnabled === 'boolean' && p.mfaEnabled !== acc.has2fa) {
    set.has2fa = p.mfaEnabled; updated.push('has_2fa');
  }
  if (p.externalId && p.externalId !== acc.clientId) {
    set.clientId = p.externalId; updated.push('client_id');
  }

  // Merge persona: giữ field user đã set, overwrite các field từ API.
  const currentPersona = (acc.persona as Record<string, string> | null) ?? {};
  const newPersona: Record<string, string> = { ...currentPersona };
  if (p.displayName) newPersona.displayName = p.displayName;
  if (p.avatarUrl) newPersona.avatarUrl = p.avatarUrl;
  if (typeof p.verified === 'boolean') newPersona.verified = String(p.verified);
  if (p.tier) newPersona.tier = p.tier;
  if (p.followerCount != null) newPersona.followerCount = String(p.followerCount);
  if (p.followingCount != null) newPersona.followingCount = String(p.followingCount);
  // Extra fields → stringify để fit persona shape Record<string,string>.
  for (const [k, v] of Object.entries(p.extra ?? {})) {
    if (v == null) continue;
    newPersona[`platform_${k}`] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  if (JSON.stringify(newPersona) !== JSON.stringify(currentPersona)) {
    set.persona = newPersona;
    updated.push('persona');
  }

  if (updated.length === 0) {
    return { ok: true, updated: [], profile: p as unknown as Record<string, unknown> };
  }

  await db.update(platformAccounts).set(set).where(eq(platformAccounts.id, acc.id));

  // Cascade push sang Directus (cùng pattern updateAccount).
  if (directusEnabled()) {
    try { await pushAccountToDirectus(projectId, acc.id); }
    catch (e) { console.warn('[sync] push to Directus failed', e); }
  }

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, updated, profile: p as unknown as Record<string, unknown> };
}
