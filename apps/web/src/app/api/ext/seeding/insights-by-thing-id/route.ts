import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

// POST /api/ext/seeding/insights-by-thing-id
// Body: {
//   thingId: string,           // Reddit comment id (vd "oo53o90") — bỏ prefix t1_
//   views?, score?, upvoteRatio?, replyCount?, shareCount?, awardCount?,
//   // Optional context — nếu card chưa exist, dùng để auto-create:
//   postUrl?: string,          // full Reddit comment URL
//   authorHandle?: string,     // username comment, vd "Lithervard"
//   bodyText?: string,         // preview comment body từ insights page
//   rawJson?: unknown,
// }
//
// Flow:
//   1. Tìm card có post_url ILIKE '%/<thingId>/%' → update insights.
//   2. Miss → nếu có postUrl + authorHandle: resolve account_id (handle match)
//      và habitat_id (parse subreddit từ URL, match h.name = 'r/X'
//      case-insensitive). Tìm community_brief khớp (account_id, habitat_id)
//      cross-project. Auto-create card mới attach brief đó.
//   3. Account/habitat OK nhưng KHÔNG có brief → tạo ghost brief thuộc project
//      '_orphan' (seed migration 0075) để vẫn track metrics. Sau user assign
//      sang project thật qua MOS2 UI.
//   4. Thiếu account/habitat → trả ok:false + reason để ext biết action.

interface InsightsBody {
  thingId?: string;
  views?: number;
  score?: number;
  upvoteRatio?: number;
  replyCount?: number;
  shareCount?: number;
  awardCount?: number;
  postUrl?: string;
  authorHandle?: string;
  bodyText?: string;
  topCountries?: Array<{ country: string; pct: number }>;
  topReplies?: Array<{ author: string; ago?: string; body: string; score?: number | null }>;
  rawJson?: unknown;
}

// Parse Reddit comment URL: /r/Astrology_Vedic/comments/1to8wdg/astrology_reading/oo53o90/
// → { subreddit: 'r/Astrology_Vedic', postId: '1to8wdg', slug: 'astrology_reading', commentId: 'oo53o90' }
function parseRedditCommentUrl(url: string): {
  subredditPath: string; postId: string; slug: string; commentId: string;
} | null {
  try {
    const u = new URL(url);
    if (!u.host.includes('reddit.com')) return null;
    const m = u.pathname.match(/^\/r\/([^/]+)\/comments\/([^/]+)\/([^/]*)\/([a-z0-9]+)\/?$/i);
    if (!m) return null;
    return {
      subredditPath: `r/${m[1]}`,
      postId: m[2]!,
      slug: m[3] ?? '',
      commentId: m[4]!,
    };
  } catch { return null; }
}

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as InsightsBody;
  const thingId = String(body.thingId ?? '').trim().replace(/^t1_/, '');
  if (!thingId || !/^[a-z0-9]{4,12}$/i.test(thingId)) {
    return NextResponse.json({ ok: false, error: 'thingId required (alphanum)' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Step 1: tìm card existing match thingId
  const pattern = `%/${thingId}/%`;
  const existingRows = await db.execute(sql`
    SELECT id, post_url FROM cards
    WHERE post_url ILIKE ${pattern}
      AND archived_at IS NULL
    ORDER BY posted_at DESC NULLS LAST
    LIMIT 1
  `);
  let card = (existingRows as unknown as Array<Record<string, unknown>>)[0];
  let createdNew = false;
  let createdInOrphan = false;

  // Step 2: card miss → auto-create nếu đủ context
  if (!card) {
    const postUrl = String(body.postUrl ?? '').trim();
    const authorHandle = String(body.authorHandle ?? '').trim().replace(/^u\//i, '').replace(/^@/, '');
    if (!postUrl || !authorHandle) {
      return NextResponse.json({
        ok: false,
        reason: 'missing_context',
        error: 'Card chưa exist + ext không gửi postUrl/authorHandle → không thể auto-create. Cần postUrl + authorHandle.',
      }, { status: 200 });
    }
    const parsed = parseRedditCommentUrl(postUrl);
    if (!parsed) {
      return NextResponse.json({
        ok: false,
        reason: 'invalid_post_url',
        error: `Không parse được Reddit URL: ${postUrl}`,
      }, { status: 200 });
    }
    if (parsed.commentId.toLowerCase() !== thingId.toLowerCase()) {
      return NextResponse.json({
        ok: false,
        reason: 'thing_id_mismatch',
        error: `thingId (${thingId}) khác commentId trong URL (${parsed.commentId})`,
      }, { status: 200 });
    }

    // Resolve account_id (handle case-sensitive — Reddit usernames case-preserving)
    const accountRows = await db.execute(sql`
      SELECT id FROM platform_accounts
      WHERE platform_key = 'reddit'
        AND LOWER(handle) = LOWER(${authorHandle})
      LIMIT 1
    `);
    const acct = (accountRows as unknown as Array<Record<string, unknown>>)[0];
    if (!acct) {
      return NextResponse.json({
        ok: false,
        reason: 'account_not_found',
        error: `Account @${authorHandle} chưa tồn tại trong MOS2. Tạo account trước.`,
        hint: { authorHandle },
      }, { status: 200 });
    }
    const accountId = Number(acct.id);

    // Resolve habitat_id (name match case-insensitive)
    const habitatRows = await db.execute(sql`
      SELECT id, project_id, language FROM habitats
      WHERE platform_key = 'reddit'
        AND LOWER(name) = LOWER(${parsed.subredditPath})
      LIMIT 1
    `);
    const hab = (habitatRows as unknown as Array<Record<string, unknown>>)[0];
    if (!hab) {
      return NextResponse.json({
        ok: false,
        reason: 'habitat_not_found',
        error: `Habitat ${parsed.subredditPath} chưa tồn tại trong MOS2. Tạo habitat trước.`,
        hint: { subreddit: parsed.subredditPath },
      }, { status: 200 });
    }
    const habitatId = Number(hab.id);
    const habitatLang = String(hab.language ?? 'en');

    // Tìm brief khớp (account, habitat) cross-project. Ưu tiên brief có
    // updated_at gần nhất nếu nhiều brief cùng pair (rare).
    const briefRows = await db.execute(sql`
      SELECT id, project_id FROM community_briefs
      WHERE account_id = ${accountId} AND habitat_id = ${habitatId}
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    let brief = (briefRows as unknown as Array<Record<string, unknown>>)[0];

    // Step 3: không có brief → tạo ghost brief trong '_orphan' project
    if (!brief) {
      const ghostRows = await db.execute(sql`
        INSERT INTO community_briefs (
          tenant_id, project_id, account_id, habitat_id,
          current_phase, join_status, tone,
          approach_md, do_md, dont_md
        )
        VALUES (
          'self', '_orphan', ${accountId}, ${habitatId},
          'warm-up', 'joined', '',
          '(auto-created from Reddit insights — assign sang project thật khi user xác nhận)',
          '', ''
        )
        RETURNING id, project_id
      `);
      brief = (ghostRows as unknown as Array<Record<string, unknown>>)[0]!;
      createdInOrphan = true;
    }

    const briefId = Number(brief.id);
    const projectId = String(brief.project_id);

    // Tạo card. card_ref dùng convention EXT-<thingId> tránh đụng SEED-N.
    // squad_key NOT NULL → fallback 'wf-writer' (default seeding squad).
    const newCardRows = await db.execute(sql`
      INSERT INTO cards (
        tenant_id, project_id, brief_id, card_ref, squad_key,
        title, body_target, content_type, target_lang,
        post_url, posted_at,
        parent_url, parent_title, parent_author,
        answer_source,
        col, level, brief_phase, agent_kind,
        post_lifecycle, post_lifecycle_at, post_lifecycle_note
      )
      VALUES (
        'self', ${projectId}, ${briefId}, ${`EXT-${thingId}`}, 'wf-writer',
        ${`Reddit comment ${thingId}`},
        ${String(body.bodyText ?? '').slice(0, 4000)},
        'comment', ${habitatLang},
        ${postUrl}, NOW(),
        ${`https://www.reddit.com/r/${parsed.subredditPath.slice(2)}/comments/${parsed.postId}/${parsed.slug}/`},
        ${`r/${parsed.subredditPath.slice(2)} thread ${parsed.postId}`},
        ${`u/${authorHandle}`},
        'external',
        'production', 1, 'warm-up', 'community-seed',
        'live', NOW(), 'auto-imported from Reddit insights page'
      )
      RETURNING id, post_url
    `);
    card = (newCardRows as unknown as Array<Record<string, unknown>>)[0]!;
    createdNew = true;
  }

  const cardId = Number(card!.id);

  // Step 4: apply insights vào card (existing or newly-created)
  const sets: ReturnType<typeof sql>[] = [];
  if (body.views != null) sets.push(sql`insights_views_count = ${Math.round(Number(body.views))}`);
  if (body.score != null) sets.push(sql`insights_score = ${Math.round(Number(body.score))}`);
  if (body.upvoteRatio != null) {
    const r = Math.max(0, Math.min(1, Number(body.upvoteRatio)));
    sets.push(sql`insights_upvote_ratio = ${r}`);
  }
  if (body.replyCount != null) sets.push(sql`insights_reply_count = ${Math.round(Number(body.replyCount))}`);
  if (body.shareCount != null) sets.push(sql`insights_share_count = ${Math.round(Number(body.shareCount))}`);
  if (body.awardCount != null) sets.push(sql`insights_award_count = ${Math.round(Number(body.awardCount))}`);
  if (Array.isArray(body.topCountries)) {
    sets.push(sql`insights_top_countries = ${JSON.stringify(body.topCountries.slice(0, 10))}::jsonb`);
  }
  if (Array.isArray(body.topReplies)) {
    sets.push(sql`insights_top_replies = ${JSON.stringify(body.topReplies.slice(0, 5))}::jsonb`);
  }
  if (body.rawJson) sets.push(sql`insights_raw_json = ${JSON.stringify(body.rawJson)}::jsonb`);
  sets.push(sql`insights_fetched_at = NOW()`);
  sets.push(sql`updated_at = NOW()`);

  if (sets.length > 2) {
    const setClause = sql.join(sets, sql`, `);
    await db.execute(sql`UPDATE cards SET ${setClause} WHERE id = ${cardId}`);
  }

  return NextResponse.json({
    ok: true,
    cardId,
    postUrl: String(card!.post_url ?? ''),
    createdNew,
    createdInOrphan,
    fields: {
      views: body.views,
      score: body.score,
      upvoteRatio: body.upvoteRatio,
      replyCount: body.replyCount,
      shareCount: body.shareCount,
      awardCount: body.awardCount,
    },
  });
}
