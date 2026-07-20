import { NextResponse } from 'next/server';
import { getDb, platformAccounts, platforms } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { checkAuth } from '../../_auth';
import { reconcilePlatformKey } from '@/lib/resolve-platform';

export const dynamic = 'force-dynamic';

// POST /api/ext/accounts/import  { platform, accounts:[{handle, accountType?, notes?, avatar?}] }
// Bulk-import the social accounts/Pages the operator owns (e.g. every FB Page from the "Your profiles &
// Pages" switcher) as GLOBAL, project-agnostic accounts (project_id = null) so they're reusable across
// every project + the "gửi bằng" picker. DEDUP is free: the existing unique index
// (tenant_id, platform_key, handle) → onConflictDoNothing, so re-running never duplicates. No junction
// (these are portfolio assets, not tied to one project). Reuses the same platform_accounts infra as the
// single-account POST. Returns created vs already-had counts.
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { platform?: string; accounts?: Array<{ handle?: string; accountType?: string; notes?: string; avatar?: string }> };
  const platform = String(body.platform || '').trim();
  const rows = Array.isArray(body.accounts) ? body.accounts : [];
  if (!platform || !rows.length) return NextResponse.json({ ok: false, error: 'platform + accounts[] required' }, { status: 400 });

  const platformSlug = await reconcilePlatformKey(db, platform);
  const [existingPlatform] = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, platformSlug)).limit(1);
  if (!existingPlatform) {
    await db.insert(platforms).values({ key: platformSlug, label: platform, signupUrl: '', description: 'Auto-created by MOS2 Crew (Pages import)' }).onConflictDoNothing();
  }

  // Dedup + trim in-payload first (the switcher can repeat rows), cap for safety.
  const seen = new Set<string>();
  const clean = rows
    .map((r) => ({ handle: String(r.handle || '').trim(), accountType: (['personal', 'brand', 'seeding'] as const).includes(r.accountType as never) ? String(r.accountType) : 'brand', notes: r.notes ? String(r.notes).slice(0, 300) : null }))
    .filter((r) => r.handle && r.handle.length <= 120 && !seen.has(r.handle.toLowerCase()) && seen.add(r.handle.toLowerCase()))
    .slice(0, 500);

  let created = 0;
  const createdHandles: string[] = [];
  for (const r of clean) {
    const ins = await db.insert(platformAccounts).values({
      platformKey: platformSlug, projectId: null, handle: r.handle, status: 'active', accountType: r.accountType, notes: r.notes,
    }).onConflictDoNothing().returning({ id: platformAccounts.id });
    if (ins.length) { created++; createdHandles.push(r.handle); }
  }
  return NextResponse.json({ ok: true, platform: platformSlug, total: clean.length, created, existed: clean.length - created, createdHandles });
}
