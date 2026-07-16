import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platformAccounts, platforms, projectAccounts, identities } from '@mos2/db';
import { and, desc, eq, exists, ilike, or, sql } from 'drizzle-orm';
import { fetchDirectusAccountsByPlatform, upsertDirectusAccountByHandle } from '@/lib/bridge/directus';
import { reconcilePlatformKey } from '@/lib/resolve-platform';
import { encryptValue } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// GET /api/ext/accounts?platform=Reddit&handle=u/john   → duplicate check
// GET /api/ext/accounts?host=reddit.com&projectId=orit  → site accounts for regkit
export async function GET(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ found: false });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  const handle = searchParams.get('handle');
  const host = searchParams.get('host');
  const projectId = searchParams.get('projectId');
  // project↔account scoping = JUNCTION project_accounts (single source of truth, khớp readers.
  // listAccountsByProject). KHÔNG đọc scalar platform_accounts.project_id (vestigial → bug #28 khi 2 lệch).
  const inProject = (pid: string) => exists(db.select().from(projectAccounts).where(and(
    eq(projectAccounts.accountId, platformAccounts.id), eq(projectAccounts.projectId, pid),
  )));

  // Precheck cho capture account đã login: account TRÙNG (email UNIQUE trên site / handle) + identity KHỚP
  // (email/handle_base) → tránh tạo 2 acc = 1 email + auto-gắn persona đúng.
  if (searchParams.get('precheck')) {
    const email = (searchParams.get('email') ?? '').trim().toLowerCase();
    const hdl = (searchParams.get('handle') ?? '').trim();
    const slug = platform ? await reconcilePlatformKey(db, platform) : '';
    let account: Record<string, unknown> | null = null;
    let identity: Record<string, unknown> | null = null;
    if (slug && (email || hdl)) {
      const emailCond = email ? sql`lower(${platformAccounts.email}) = ${email}` : undefined;
      const handleCond = hdl ? eq(platformAccounts.handle, hdl) : undefined;
      const [acc] = await db
        .select({ id: platformAccounts.id, handle: platformAccounts.handle, email: platformAccounts.email, status: platformAccounts.status, projectId: platformAccounts.projectId, accountType: platformAccounts.accountType })
        .from(platformAccounts)
        .where(and(eq(platformAccounts.platformKey, slug), or(emailCond, handleCond)))
        .limit(1);
      account = acc ?? null;
    }
    if (email) {
      const [idn] = await db.select({ id: identities.id, name: identities.name, handleBase: identities.handleBase, kind: identities.kind, projectId: identities.projectId })
        .from(identities).where(sql`lower(${identities.email}) = ${email}`).limit(1);
      identity = idn ?? null;
    }
    if (!identity && hdl) {
      const [idn] = await db.select({ id: identities.id, name: identities.name, handleBase: identities.handleBase, kind: identities.kind, projectId: identities.projectId })
        .from(identities).where(sql`lower(${identities.handleBase}) = ${hdl.toLowerCase()}`).limit(1);
      identity = idn ?? null;
    }
    return NextResponse.json({ precheck: true, account, identity });
  }

  // #4: list ALL account (cross-platform) cho picker "liên kết account". Nhẹ: id·handle·platform·status.
  if (searchParams.get('list') === 'all') {
    const rows = await db
      .select({ id: platformAccounts.id, handle: platformAccounts.handle, platformKey: platformAccounts.platformKey, status: platformAccounts.status })
      .from(platformAccounts)
      .where(sql`${platformAccounts.handle} IS NOT NULL AND ${platformAccounts.handle} <> ''`)
      .orderBy(desc(platformAccounts.updatedAt))
      .limit(500);
    return NextResponse.json({ accounts: rows });
  }

  // Duplicate check
  if (platform && handle) {
    // canon alias (x→twitter, bsky→bluesky) — ext gửi key của nó, catalog + stats query canonical.
    // Không canon = account ghi row 'x' nhưng stats query 'twitter' → account_not_found (bug P0).
    const slug = await reconcilePlatformKey(db, platform);
    const [row] = await db
      .select({ id: platformAccounts.id, handle: platformAccounts.handle })
      .from(platformAccounts)
      .where(and(eq(platformAccounts.platformKey, slug), eq(platformAccounts.handle, handle)))
      .limit(1);
    return NextResponse.json({ found: !!row, account: row ?? null });
  }

  // List accounts by platform (account chip picker trong ext) — chọn account
  // dùng cho habitat. Filter platform (+ project nếu truyền).
  if (platform && !handle) {
    const slug = await reconcilePlatformKey(db, platform);
    const rows = await db
      .select({
        id: platformAccounts.id,
        handle: platformAccounts.handle,
        email: platformAccounts.email,
        status: platformAccounts.status,
        accountType: platformAccounts.accountType,   // P/B/S → console "loại" select đọc lại đúng giá trị (else revert 'brand')
        notes: platformAccounts.notes,
        platformKey: platformAccounts.platformKey,
        projectId: platformAccounts.projectId,   // home project (profile-target) → default cho project-picker của login pill
      })
      .from(platformAccounts)
      .where(and(
        eq(platformAccounts.platformKey, slug),
        projectId ? inProject(projectId) : undefined,
      ))
      .orderBy(desc(platformAccounts.updatedAt))
      .limit(100);
    const out: Array<Record<string, unknown>> = rows.filter((r) => r.handle).map((r) => ({ ...r, source: 'mos2' }));
    // Merge accounts từ earns Directus (inventory chính) — account FB/... user
    // đã có sẵn ở Directus nhưng chưa import vào MOS2. Dedupe theo handle.
    const seen = new Set(out.map((r) => String(r.handle).toLowerCase()));
    try {
      const da = await fetchDirectusAccountsByPlatform(platform);
      for (const a of da) {
        const h = (a.handle ?? '').trim();
        if (!h || seen.has(h.toLowerCase())) continue;
        seen.add(h.toLowerCase());
        out.push({ id: null, handle: h, email: a.email ?? null, status: a.status ?? null, notes: a.notes ?? null, platformKey: slug, source: 'directus' });
      }
    } catch (e) {
      console.warn('[ext/accounts] directus merge fail:', (e as Error).message);
    }
    // login_challenges (per-platform): site cần xác minh gì khi login (device email code / SMS /
    // 2FA…) → ext báo trước cho user chuẩn bị. Raw sql vì cột chưa có trong Drizzle schema.
    let loginChallenges: unknown[] = [];
    try {
      const pc = await db.execute(sql`SELECT login_challenges FROM platforms WHERE key = ${slug} LIMIT 1`);
      const lc = (pc as unknown as Array<{ login_challenges: unknown }>)[0]?.login_challenges;
      if (Array.isArray(lc)) loginChallenges = lc;
    } catch { /* cột có thể chưa migrate */ }
    return NextResponse.json({ accounts: out, loginChallenges });
  }

  // Site accounts for regkit picker
  if (host) {
    const rows = await db
      .select({
        id: platformAccounts.id,
        handle: platformAccounts.handle,
        email: platformAccounts.email,
        status: platformAccounts.status,
        accountType: platformAccounts.accountType,
        notes: platformAccounts.notes,
        platformKey: platformAccounts.platformKey,
        platformLabel: platforms.label,
        signupUrl: platforms.signupUrl,
      })
      .from(platformAccounts)
      .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
      .where(
        and(
          projectId ? inProject(projectId) : undefined,
          or(
            ilike(platforms.signupUrl, `%${host}%`),
            ilike(platformAccounts.notes, `%${host}%`),
          ),
        ),
      )
      .limit(50);
    return NextResponse.json({ accounts: rows });
  }

  return NextResponse.json({ error: 'Missing params' }, { status: 400 });
}

// POST /api/ext/accounts — create new account from extension
// Body: { projectId, platform, handle, notes }
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await req.json() as {
    projectId?: string;
    platform: string;
    handle: string;
    email?: string;
    status?: string;
    notes?: string;
    accountType?: string;   // P/B/S — personal|brand|seeding (mig 0131)
    identityId?: number;     // link persona → account.persona.identityId (🤖 sinh dùng giọng/nhân vật)
    authMethod?: string;     // capture logged-in = 'manual'/'password'
    password?: string;       // creds đã đăng ký → mã hoá password_enc (trước đây bỏ → account ko có pass)
  };

  const platformSlug = await reconcilePlatformKey(db, body.platform);
  const passwordEnc = body.password?.trim() ? await encryptValue(body.password.trim()) : null;

  // Find or create platform
  const [existingPlatform] = await db
    .select({ key: platforms.key })
    .from(platforms)
    .where(eq(platforms.key, platformSlug))
    .limit(1);

  if (!existingPlatform) {
    await db.insert(platforms).values({
      key: platformSlug,
      label: body.platform,
      signupUrl: '',
      description: `Auto-created by MOS2 Crew extension`,
    }).onConflictDoNothing();
  }

  // Account + junction ATOMIC trong 1 TRANSACTION. Junction project_accounts = SOURCE OF TRUTH cho
  // project↔account (dashboard listAccountsByProject INNER JOIN nó). Thiếu junction = account VÔ HÌNH ở
  // vault (bug #28). Trước đây 2 await rời → account tạo xong nhưng junction lỗi = orphan. Giờ cùng tx →
  // hoặc cả hai, hoặc không gì. Idempotent: onConflictDoNothing (trùng handle ko 500) + tra account sẵn có.
  const { accountId, existed } = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(platformAccounts)
      .values({
        platformKey: platformSlug,
        projectId: body.projectId ?? null,   // scalar = display/home only; junction là truth
        handle: body.handle,
        email: body.email?.trim() || null,
        status: body.status?.trim() || 'todo',
        notes: body.notes ?? null,
        accountType: (['personal', 'brand', 'seeding'] as const).includes(body.accountType as 'personal' | 'brand' | 'seeding') ? String(body.accountType) : 'brand',
        authMethod: body.authMethod?.trim() || null,
        // capture logged-in (status active) → đánh dấu đã verify + link persona để 🤖 sinh đúng giọng.
        lastVerifiedAt: body.status?.trim() === 'active' ? new Date() : null,
        persona: body.identityId ? { identityId: Number(body.identityId) } : {},
        passwordEnc,
        tags: ['ext-detected'],
      })
      .onConflictDoNothing()
      .returning({ id: platformAccounts.id });
    let id: number | null = row?.id ?? null;
    if (!id) {
      const [ex] = await tx
        .select({ id: platformAccounts.id })
        .from(platformAccounts)
        .where(and(eq(platformAccounts.platformKey, platformSlug), eq(platformAccounts.handle, body.handle)))
        .limit(1);
      id = ex?.id ?? null;
    }
    if (id && body.projectId) {
      await tx.insert(projectAccounts)
        .values({ projectId: body.projectId, accountId: id, role: 'primary' })
        .onConflictDoNothing();
    }
    return { accountId: id, existed: !row };
  });

  // Reverse-sync → Directus (await, non-fatal) — account tạo ở ext cũng vào
  // inventory Directus. Dedupe theo handle trong upsertDirectusAccountByHandle.
  let directus: { ok: boolean; created?: boolean } | undefined;
  if (accountId) {
    try {
      directus = await upsertDirectusAccountByHandle({
        platformKey: platformSlug, handle: body.handle,
        email: body.email?.trim() || null, status: body.status?.trim() || 'active', notes: body.notes ?? null,
      });
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true, id: accountId, existed, directus });
}
