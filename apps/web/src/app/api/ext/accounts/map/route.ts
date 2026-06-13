import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts, platforms, projectAccounts } from '@mos2/db';
import { and, eq, sql } from 'drizzle-orm';
import { upsertDirectusAccountByHandle } from '@/lib/bridge/directus';

export const dynamic = 'force-dynamic';

// POST /api/ext/accounts/map — gán account đang login vào 1 project (idempotent).
// Body: { platformKey | platform, handle, projectId }
//
// Khác /api/ext/accounts POST (luôn insert account MỚI): endpoint này UPSERT theo
// (platform_key, lower(handle)) → tồn tại thì reuse + chỉ thêm junction. Dùng cho
// "account đang login chưa map project nào" → 1 click map từ widget/popup.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const body = (await req.json()) as { platformKey?: string; platform?: string; handle?: string; projectId?: string };
  const rawHandle = (body.handle ?? '').trim().replace(/^\/+/, '').replace(/^u\//i, '').replace(/^user\//i, '').replace(/^@/, '').trim();
  const platformRaw = (body.platformKey ?? body.platform ?? '').trim();
  const platformSlug = platformRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const projectId = (body.projectId ?? '').trim();

  if (!rawHandle || !platformSlug || !projectId) {
    return NextResponse.json({ ok: false, error: 'platformKey + handle + projectId required' }, { status: 400 });
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
    // Set project_id (legacy owner) nếu đang trống — không ghi đè owner cũ.
    if (!existing.projectId) {
      await db.update(platformAccounts).set({ projectId }).where(eq(platformAccounts.id, accountId));
    }
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

  // Ensure junction — bắt buộc để account hiện trên dashboard (INNER JOIN).
  await db.insert(projectAccounts)
    .values({ projectId, accountId, role: 'primary' })
    .onConflictDoNothing();

  // Reverse-sync → Directus inventory (dedupe theo handle, non-blocking) — account
  // map từ ext cũng vào inventory chính. Chỉ cần khi account vừa tạo.
  let directus: { ok: boolean; created?: boolean } | undefined;
  if (created) {
    try {
      directus = await upsertDirectusAccountByHandle({ platformKey: platformSlug, handle: rawHandle, email: null, status: 'active', notes: null });
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true, accountId, projectId, created, directus });
}
