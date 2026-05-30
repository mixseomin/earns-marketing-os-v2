import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platformAccounts, platforms } from '@mos2/db';
import { and, eq, ilike, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/ext/accounts?platform=Reddit&handle=u/john   → duplicate check
// GET /api/ext/accounts?host=reddit.com&projectId=orit  → site accounts for regkit
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ found: false });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  const handle = searchParams.get('handle');
  const host = searchParams.get('host');
  const projectId = searchParams.get('projectId');

  // Duplicate check
  if (platform && handle) {
    const slug = platform.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const [row] = await db
      .select({ id: platformAccounts.id, handle: platformAccounts.handle })
      .from(platformAccounts)
      .where(and(eq(platformAccounts.platformKey, slug), eq(platformAccounts.handle, handle)))
      .limit(1);
    return NextResponse.json({ found: !!row, account: row ?? null });
  }

  // Site accounts for regkit picker
  if (host) {
    const rows = await db
      .select({
        id: platformAccounts.id,
        handle: platformAccounts.handle,
        email: platformAccounts.email,
        status: platformAccounts.status,
        notes: platformAccounts.notes,
        platformKey: platformAccounts.platformKey,
        platformLabel: platforms.label,
        signupUrl: platforms.signupUrl,
      })
      .from(platformAccounts)
      .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
      .where(
        and(
          projectId ? eq(platformAccounts.projectId, projectId) : undefined,
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
  const err = checkAuth(req);
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
  };

  const platformSlug = body.platform.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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

  const [row] = await db
    .insert(platformAccounts)
    .values({
      platformKey: platformSlug,
      projectId: body.projectId ?? null,
      handle: body.handle,
      email: body.email?.trim() || null,
      status: body.status?.trim() || 'todo',
      notes: body.notes ?? null,
      tags: ['ext-detected'],
    })
    .returning({ id: platformAccounts.id });

  return NextResponse.json({ ok: true, id: row?.id });
}
