import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/ext/channels/posts?habitatId=&externalId=  (hoặc channelDbId=)
// List card ĐÃ ĐĂNG (post_url not null) thuộc 1 sub-forum/channel → ext sub-forum
// reader hiện "đã đăng N bài · time ago · link · lifecycle" ưu tiên.
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  const url = new URL(req.url);
  const habitatId = Number(url.searchParams.get('habitatId') ?? 0);
  const externalId = (url.searchParams.get('externalId') ?? '').trim();
  const channelDbId = Number(url.searchParams.get('channelDbId') ?? 0);
  if (!channelDbId && !(habitatId && externalId)) {
    return NextResponse.json({ ok: false, error: 'channelDbId hoặc (habitatId + externalId) required' }, { status: 400 });
  }

  // Resolve channel db id.
  let cid = channelDbId;
  if (!cid) {
    const rows = await db.execute(sql`
      SELECT id FROM habitat_channels
       WHERE habitat_id = ${habitatId} AND external_id = ${externalId}
       LIMIT 1`);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) return NextResponse.json({ ok: true, channelDbId: null, posts: [], postedCount: 0, draftCount: 0 });
    cid = Number(r.id);
  }

  const rows = await db.execute(sql`
    SELECT c.id, c.content_type, c.title, c.parent_url, c.post_url, c.posted_at,
           c.post_lifecycle, c.created_at,
           c.insights_views_count, c.insights_score, c.insights_reply_count
      FROM cards c
     WHERE c.channel_id = ${cid}
       AND c.archived_at IS NULL
     ORDER BY (c.posted_at IS NULL), c.posted_at DESC NULLS LAST, c.created_at DESC
     LIMIT 30`);
  const all = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    contentType: String(r.content_type ?? ''),
    title: r.title ? String(r.title) : '',
    parentUrl: r.parent_url ? String(r.parent_url) : null,
    postUrl: r.post_url ? String(r.post_url) : null,
    postedAt: r.posted_at ? String(r.posted_at) : null,
    lifecycle: r.post_lifecycle ? String(r.post_lifecycle) : null,
    createdAt: String(r.created_at ?? ''),
    views: r.insights_views_count != null ? Number(r.insights_views_count) : null,
    score: r.insights_score != null ? Number(r.insights_score) : null,
    replies: r.insights_reply_count != null ? Number(r.insights_reply_count) : null,
  }));
  const posts = all.filter((p) => p.postUrl);
  return NextResponse.json({
    ok: true,
    channelDbId: cid,
    posts,                              // chỉ bài đã đăng (có post_url)
    postedCount: posts.length,
    draftCount: all.length - posts.length,
  });
}
