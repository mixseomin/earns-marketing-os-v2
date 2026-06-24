import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/seeding/seeded-list?platformKey=&technologyKey=&projectId=
// Mọi bài ĐÃ seed (có post_url HOẶC lifecycle posted/pending-approval) trên platform/engine này,
// xuyên habitat — để ext show "danh sách bài đã đăng trên site này". Filter project tuỳ chọn.
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const p = new URL(req.url).searchParams;
  const platformKey = p.get('platformKey') ? canonPlatformKey(p.get('platformKey')!) : null;
  const technologyKey = p.get('technologyKey') || null;
  const projectId = p.get('projectId') || null;
  if (!platformKey && !technologyKey) return errorResponse('platformKey or technologyKey required', 400);
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  try {
    const rows = await db.execute(sql`
      SELECT c.id, c.post_url, c.posted_at, c.post_lifecycle, c.brief_phase, c.scheduled_at,
        COALESCE(NULLIF(c.parent_title,''), h.name, '') AS thread,
        LEFT(COALESCE(NULLIF(c.body_target,''), c.body, ''), 100) AS excerpt,
        c.insights_views_count AS views, c.insights_score AS score, c.insights_reply_count AS replies
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = COALESCE(c.habitat_id, b.habitat_id)
      LEFT JOIN platform_accounts pa ON pa.id = COALESCE(c.account_id, b.account_id)
      WHERE c.archived_at IS NULL
        AND (c.post_url IS NOT NULL OR c.post_lifecycle IN ('posted','pending-approval'))
        AND (
          (${platformKey}::text IS NOT NULL AND COALESCE(NULLIF(h.platform_key,''), NULLIF(pa.platform_key,'')) = ${platformKey})
          OR (${technologyKey}::text IS NOT NULL AND NULLIF(h.technology_key,'') = ${technologyKey})
        )
        AND (${projectId}::text IS NULL OR c.project_id = ${projectId})
      ORDER BY c.posted_at DESC NULLS LAST, c.id DESC
      LIMIT 100`);
    const list = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      postUrl: r.post_url ? String(r.post_url) : null,
      postedAt: r.posted_at ? String(r.posted_at) : null,
      lifecycle: r.post_lifecycle ? String(r.post_lifecycle) : null,
      phase: r.brief_phase ? String(r.brief_phase) : null,
      scheduledAt: r.scheduled_at ? String(r.scheduled_at) : null,
      thread: r.thread ? String(r.thread) : '',
      excerpt: r.excerpt ? String(r.excerpt) : '',
      views: r.views == null ? null : Number(r.views),
      score: r.score == null ? null : Number(r.score),
      replies: r.replies == null ? null : Number(r.replies),
    }));
    return NextResponse.json({ ok: true, count: list.length, posts: list });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}
