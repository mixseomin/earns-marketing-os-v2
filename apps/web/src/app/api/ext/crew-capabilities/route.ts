import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/crew-capabilities — ext buildCapabilities() (đọc cfg tables LIVE) self-report matrix năng lực.
// Upsert theo version (1 row/version). Architecture Studio đọc row mới nhất. Single source = ext cfg thật.
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = (await req.json().catch(() => null)) as { version?: string; platforms?: unknown; tech?: unknown } | null;
  if (!body || typeof body !== 'object' || !body.platforms || !body.tech) return errorResponse('invalid capabilities payload', 400);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const version = String(body.version || '').slice(0, 40) || 'unknown';
  await db.execute(sql`
    INSERT INTO crew_capabilities (version, data) VALUES (${version}, ${JSON.stringify(body)}::jsonb)
    ON CONFLICT (version) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`);
  return NextResponse.json({ ok: true, version });
}
