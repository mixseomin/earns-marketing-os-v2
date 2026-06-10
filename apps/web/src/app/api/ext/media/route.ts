import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, mediaAssets } from '@mos2/db';
import { and, eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// GET /api/ext/media?projectId=<id>&kind=image&limit=60
// → { ok, media: [{ id, url, filename, kind, mimeType, width, height, tags, source }] }
// Project media library for the on-page profile assist (avatar/banner/cover
// pickers). Project-scoped — media_assets has no per-account column; callers
// rank by tag match to the field client-side.
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get('projectId') ?? '').trim();
  const kind = (searchParams.get('kind') ?? 'image').trim();
  const limit = Math.min(Number(searchParams.get('limit') ?? 60) || 60, 120);
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  const conds = [eq(mediaAssets.tenantId, TENANT), eq(mediaAssets.projectId, projectId)];
  if (kind && kind !== 'all') conds.push(eq(mediaAssets.kind, kind));

  const rows = await db
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      filename: mediaAssets.filename,
      kind: mediaAssets.kind,
      mimeType: mediaAssets.mimeType,
      width: mediaAssets.width,
      height: mediaAssets.height,
      tags: mediaAssets.tags,
      source: mediaAssets.source,
    })
    .from(mediaAssets)
    .where(and(...conds))
    .orderBy(desc(mediaAssets.id))
    .limit(limit);

  return NextResponse.json({ ok: true, media: rows });
}
