import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getDb } from '@mos2/db';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/ext/platform-detect
// Ext fingerprint-detects the forum engine on a site (xenforo/phpbb/discourse/…)
// and reports it here. We record it in platform_tech_detections (discovery inbox)
// so Studio "Template Adoption" can suggest binding the platform → inherit the
// technology selector pack. We DO NOT bind automatically (no silent override) and
// skip platforms already bound to the detected tech. Unknown tech keys are ignored.
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('db unavailable', 200);
  let body: { platformKey?: string; technologyKey?: string; hostname?: string; url?: string };
  try { body = await req.json(); } catch { return errorResponse('bad json', 400); }
  const rawKey = (body.platformKey || '').toString().trim();
  const tech = (body.technologyKey || '').toString().trim().toLowerCase();
  const host = (body.hostname || '').toString().trim().toLowerCase().replace(/^www\./, '').slice(0, 200);
  if (!rawKey || !tech || !host) return errorResponse('platformKey, technologyKey, hostname required', 400);
  const platformKey = canonPlatformKey(rawKey);
  const url = (body.url || '').toString().slice(0, 500) || null;
  try {
    // tech must exist in the catalog — drops noise from unknown fingerprints
    const known = await db.execute(sql`SELECT 1 FROM platform_technologies WHERE key = ${tech} LIMIT 1`);
    if (!(known as unknown as unknown[]).length) return NextResponse.json({ ok: true, known: false });
    // already bound to this exact tech? nothing to suggest
    const cur = await db.execute(sql`SELECT technology_key FROM platforms WHERE key = ${platformKey} LIMIT 1`);
    const bound = (cur as unknown as Array<{ technology_key: string | null }>)[0]?.technology_key ?? null;
    if (bound === tech) return NextResponse.json({ ok: true, known: true, alreadyBound: true });
    await db.execute(sql`
      INSERT INTO platform_tech_detections (host, platform_key, technology_key, url, hits, first_seen, last_seen)
      VALUES (${host}, ${platformKey}, ${tech}, ${url}, 1, now(), now())
      ON CONFLICT (host) DO UPDATE SET
        platform_key = EXCLUDED.platform_key,
        technology_key = EXCLUDED.technology_key,
        url = COALESCE(EXCLUDED.url, platform_tech_detections.url),
        hits = platform_tech_detections.hits + 1,
        last_seen = now()`);
    return NextResponse.json({ ok: true, known: true, alreadyBound: false, platformKey, technologyKey: tech });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}
