import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts, platforms, projectAccounts } from '@mos2/db';
import { and, eq, sql } from 'drizzle-orm';
import { upsertDirectusAccountByHandle } from '@/lib/bridge/directus';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/accounts/map — JOIN account vào 1 project (idempotent).
// Body: { platformKey | platform, handle, projectId }
//
// Model: account THAM GIA nhiều project (junction), profile-target = ĐÚNG 1 primary.
//  - account chưa có primary nào (mới / chưa map) → junction này = 'primary' (profile-target) + set project_id.
//  - đã có primary ở project khác → junction 'shared' (tham gia thêm), KHÔNG đổi primary.
//  - cùng project đã primary → idempotent.
// Đổi profile-target dùng /accounts/set-primary (non-destructive).
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const body = (await req.json()) as { platformKey?: string; platform?: string; handle?: string; projectId?: string };
  const rawHandle = (body.handle ?? '').trim().replace(/^\/+/, '').replace(/^u\//i, '').replace(/^user\//i, '').replace(/^@/, '').trim();
  const platformRaw = (body.platformKey ?? body.platform ?? '').trim();
  // canon alias (x→twitter) — 1 nguồn key, khớp create/list/stats (tránh row-split x/twitter, bug P0).
  const platformSlug = canonPlatformKey(platformRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const projectId = (body.projectId ?? '').trim();

  if (!rawHandle || !platformSlug || !projectId) {
    return errorResponse('platformKey + handle + projectId required', 400);
  }

  // Find-or-create platform (giống POST /accounts)
  const [existingPlatform] = await db
    .select({ key: platforms.key })
    .from(platforms)
    .where(eq(platforms.key, platformSlug))
    .limit(1);
  if (!existingPlatform) {
    await db.insert(platforms).values({
      key: platformSlug,
      label: platformRaw || platformSlug,
      signupUrl: '',
      description: 'Auto-created by MOS2 Crew extension (map)',
    }).onConflictDoNothing();
  }

  // Upsert account theo (platform_key, lower(handle)) — case-insensitive.
  const [existing] = await db
    .select({ id: platformAccounts.id, projectId: platformAccounts.projectId })
    .from(platformAccounts)
    .where(and(
      eq(platformAccounts.platformKey, platformSlug),
      sql`lower(trim(${platformAccounts.handle})) = lower(trim(${rawHandle}))`,
    ))
    .limit(1);

  let accountId: number;
  let created = false;
  if (existing?.id) {
    accountId = existing.id;
  } else {
    const [row] = await db
      .insert(platformAccounts)
      .values({
        platformKey: platformSlug,
        projectId,
        handle: rawHandle,
        status: 'todo',
        tags: ['ext-detected'],
      })
      .returning({ id: platformAccounts.id });
    accountId = row!.id;
    created = true;
  }

  // Role JOIN: account chưa có primary → project này = primary (profile-target);
  // đã có primary ở project khác → 'shared' (tham gia thêm). Single-primary đảm bảo
  // bởi partial unique index project_accounts_one_primary.
  let role: 'primary' | 'shared' = 'primary';
  if (!created) {
    const [prim] = await db
      .select({ pid: projectAccounts.projectId })
      .from(projectAccounts)
      .where(and(eq(projectAccounts.accountId, accountId), eq(projectAccounts.role, 'primary')))
      .limit(1);
    if (prim?.pid) role = prim.pid === projectId ? 'primary' : 'shared';
  }
  // project_id (legacy) = mirror profile-target → chỉ set khi role primary.
  if (role === 'primary') {
    await db.update(platformAccounts).set({ projectId }).where(eq(platformAccounts.id, accountId));
  }
  // Ensure junction — bắt buộc để account hiện trên dashboard (INNER JOIN).
  await db.insert(projectAccounts)
    .values({ projectId, accountId, role, contentRatio: role === 'primary' ? 100 : 0 })
    .onConflictDoNothing();

  // Reverse-sync → Directus inventory (dedupe theo handle, non-blocking) — account
  // map từ ext cũng vào inventory chính. Chỉ cần khi account vừa tạo.
  let directus: { ok: boolean; created?: boolean } | undefined;
  if (created) {
    try {
      directus = await upsertDirectusAccountByHandle({ platformKey: platformSlug, handle: rawHandle, email: null, status: 'active', notes: null });
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true, accountId, projectId, role, created, directus });
}
