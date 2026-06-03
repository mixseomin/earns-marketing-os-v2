import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { normalizeParentUrl } from '@/lib/parent-url';

// GET /api/ext/seeding/list-drafts?parentUrl=<url>&habitatId=<id>
//
// Trả list ALL draft cards có parent_url khớp (= history các lần gen
// AI/Astrolas cùng 1 thread). Ext side panel render dropdown select để
// switch giữa drafts + display meta cost/duration/model/confidence.

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const np = normalizeParentUrl(url.searchParams.get('parentUrl'));
  const habitatId = Number(url.searchParams.get('habitatId') ?? 0);

  if (!np) {
    return NextResponse.json({ ok: false, error: 'parentUrl required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Filter theo parentUrl + (optional) habitatId — đảm bảo chỉ show drafts
  // của habitat hiện tại nếu pass.
  const rows = await db.execute(sql`
    SELECT
      c.id, c.card_ref, c.content_type, c.target_lang,
      c.body_target, c.body_review, c.title,
      c.answer_source, c.answer_sources,
      c.gen_cost_usd, c.gen_duration_ms, c.gen_model_used,
      c.gen_confidence, c.gen_tools_called, c.gen_warnings, c.gen_log_id,
      c.post_url, c.posted_at,
      c.insights_views_count, c.insights_score, c.insights_upvote_ratio,
      c.insights_reply_count, c.insights_share_count, c.insights_award_count,
      c.insights_fetched_at,
      c.created_at, c.updated_at,
      b.id AS brief_id, b.habitat_id,
      h.name AS habitat_name
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    WHERE rtrim(split_part(c.parent_url, '?', 1), '/') = ${np}
      AND c.archived_at IS NULL
      ${habitatId > 0 ? sql`AND b.habitat_id = ${habitatId}` : sql``}
    ORDER BY c.created_at DESC
    LIMIT 50
  `);

  const drafts = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    cardRef: String(r.card_ref ?? ''),
    contentType: String(r.content_type ?? 'text'),
    targetLang: String(r.target_lang ?? 'en'),
    bodyTarget: String(r.body_target ?? ''),
    bodyReview: String(r.body_review ?? ''),
    title: String(r.title ?? ''),
    answerSource: r.answer_source ? String(r.answer_source) : null,
    answerSources: Array.isArray(r.answer_sources) ? r.answer_sources : [],
    cost: r.gen_cost_usd != null ? Number(r.gen_cost_usd) : null,
    durationMs: r.gen_duration_ms != null ? Number(r.gen_duration_ms) : null,
    modelUsed: r.gen_model_used ? String(r.gen_model_used) : null,
    confidence: r.gen_confidence != null ? Number(r.gen_confidence) : null,
    toolsCalled: Array.isArray(r.gen_tools_called) ? r.gen_tools_called : [],
    warnings: Array.isArray(r.gen_warnings) ? r.gen_warnings : [],
    logId: r.gen_log_id ? String(r.gen_log_id) : null,
    postUrl: r.post_url ? String(r.post_url) : null,
    postedAt: r.posted_at ? String(r.posted_at) : null,
    insightsViewsCount: r.insights_views_count != null ? Number(r.insights_views_count) : null,
    insightsScore: r.insights_score != null ? Number(r.insights_score) : null,
    insightsUpvoteRatio: r.insights_upvote_ratio != null ? Number(r.insights_upvote_ratio) : null,
    insightsReplyCount: r.insights_reply_count != null ? Number(r.insights_reply_count) : null,
    insightsShareCount: r.insights_share_count != null ? Number(r.insights_share_count) : null,
    insightsAwardCount: r.insights_award_count != null ? Number(r.insights_award_count) : null,
    insightsFetchedAt: r.insights_fetched_at ? String(r.insights_fetched_at) : null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
    briefId: r.brief_id ? Number(r.brief_id) : null,
    habitatId: r.habitat_id ? Number(r.habitat_id) : null,
    habitatName: r.habitat_name ? String(r.habitat_name) : null,
  }));

  return NextResponse.json({ ok: true, drafts, count: drafts.length });
}
