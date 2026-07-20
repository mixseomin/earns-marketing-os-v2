import { NextResponse } from 'next/server';
import { getDb, platformAccounts, platforms } from '@mos2/db';
import { eq, sql } from 'drizzle-orm';
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

  const body = await req.json().catch(() => ({})) as { platform?: string; accounts?: Array<{ handle?: string; name?: string; url?: string; avatar?: string; accountType?: string; notes?: string }> };
  const platform = String(body.platform || '').trim();
  const rows = Array.isArray(body.accounts) ? body.accounts : [];
  if (!platform || !rows.length) return NextResponse.json({ ok: false, error: 'platform + accounts[] required' }, { status: 400 });

  const platformSlug = await reconcilePlatformKey(db, platform);
  const [existingPlatform] = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, platformSlug)).limit(1);
  if (!existingPlatform) {
    await db.insert(platforms).values({ key: platformSlug, label: platform, signupUrl: '', description: 'Auto-created by MOS2 Crew (Pages import)' }).onConflictDoNothing();
  }

  // Dedup + trim in-payload first (the switcher can repeat rows), cap for safety. handle = display name
  // (stable key both the ext + the inline add converge on → no divergent duplicate). url/avatar enrich the
  // asset so it's a REAL Page (not a loose name): stored in persona {displayName, fbUrl, avatar, source}.
  const seen = new Set<string>();
  const clean = rows
    .map((r) => ({
      handle: String(r.handle || r.name || '').trim(),
      name: String(r.name || r.handle || '').trim(),
      url: r.url ? String(r.url).slice(0, 500) : '',
      avatar: r.avatar ? String(r.avatar).slice(0, 1000) : '',
      accountType: (['personal', 'brand', 'seeding'] as const).includes(r.accountType as never) ? String(r.accountType) : 'brand',
      notes: r.notes ? String(r.notes).slice(0, 300) : null,
    }))
    .filter((r) => r.handle && r.handle.length <= 120 && !seen.has(r.handle.toLowerCase()) && seen.add(r.handle.toLowerCase()))
    .slice(0, 500);

  let created = 0, enriched = 0;
  const createdHandles: string[] = [];
  for (const r of clean) {
    const persona = { displayName: r.name, fbUrl: r.url, avatar: r.avatar, source: 'fb-switcher' };
    const ins = await db.insert(platformAccounts).values({
      platformKey: platformSlug, projectId: null, handle: r.handle, status: 'active', accountType: r.accountType, notes: r.notes, persona,
    }).onConflictDoNothing().returning({ id: platformAccounts.id });
    if (ins.length) { created++; createdHandles.push(r.handle); }
    else if (r.url || r.avatar) {
      // Existed → backfill the real-asset fields onto the account's persona if they were missing.
      const up = await db.execute(sql`UPDATE platform_accounts SET persona = COALESCE(persona,'{}'::jsonb) || ${JSON.stringify(persona)}::jsonb, updated_at = now()
        WHERE tenant_id='self' AND platform_key=${platformSlug} AND handle=${r.handle} AND COALESCE(persona->>'fbUrl','')='' AND COALESCE(persona->>'avatar','')=''`);
      if ((up as unknown as { rowCount?: number }).rowCount) enriched++;
    }
  }
  return NextResponse.json({ ok: true, platform: platformSlug, total: clean.length, created, enriched, existed: clean.length - created, createdHandles });
}
