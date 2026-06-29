import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { appendInsightsSnapshot, insightsScalarSets } from '@/lib/insights-snapshot';
import { canonPlatformKey, detectPlatformKeyFromUrl } from '@/lib/habitat-platform-map';
import { parsePostUrl, normalizeThingId, isValidThingId, postUrlSearchPattern } from '@/lib/platform-url-parsers';
import { firstRow, errorResponse } from '@/lib/ext-route';

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
// Flow (platform-neutral — URL-parse dispatch ở @/lib/platform-url-parsers):
//   1. Tìm card có post_url khớp thingId (pattern theo platform) → update insights.
//   2. Miss → nếu có postUrl + authorHandle: resolve account_id (handle match)
//      và habitat_id (parse container từ URL, vd subreddit 'r/X', match h.name
//      case-insensitive). Tìm community_brief khớp (account_id, habitat_id)
//      cross-project. Auto-create card mới.
//   3. Account/habitat OK nhưng KHÔNG có brief (0096) → card carry account_id+
//      habitat_id TRỰC TIẾP, brief_id NULL, project '_orphan' bucket. Readers
//      COALESCE(card,brief). Sau user assign sang project thật qua MOS2 UI.
//   4. Thiếu account/habitat → trả ok:false + reason để ext biết action.

interface InsightsBody {
  thingId?: string;
  views?: number;
  score?: number;
  upvoteRatio?: number;
  replyCount?: number;
  shareCount?: number;
  awardCount?: number;
  engagements?: number;       // X Post Analytics (modal-only): Engagements
  detailExpands?: number;     // Detail expands
  profileVisits?: number;     // Profile visits
  postUrl?: string;
  authorHandle?: string;
  bodyText?: string;
  platformKey?: string;            // ext gửi (x/reddit/bsky…); thiếu → suy từ postUrl host, mặc định reddit
  topCountries?: Array<{ country: string; pct: number }>;
  topReplies?: Array<{ author: string; ago?: string; body: string; score?: number | null }>;
  rawJson?: unknown;
}

// URL-parse per-platform sống ở @/lib/platform-url-parsers (parsePostUrl/normalizeThingId/…).
// Endpoint này chỉ dispatch theo platform_key → thêm platform = thêm spec ở module đó.

export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as InsightsBody;
  // Platform suy từ body.platformKey → postUrl host → mặc định reddit (back-compat).
  const pk = canonPlatformKey(body.platformKey) || detectPlatformKeyFromUrl(String(body.postUrl ?? '')) || 'reddit';
  const thingId = normalizeThingId(pk, String(body.thingId ?? ''));
  if (!thingId || !isValidThingId(pk, thingId)) {
    return errorResponse('thingId required (valid id for platform)', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // Step 1: tìm card existing match thingId
  const pattern = postUrlSearchPattern(pk, thingId);
  const existingRows = await db.execute(sql`
    SELECT id, post_url, project_id FROM cards
    WHERE post_url ILIKE ${pattern}
      AND archived_at IS NULL
    ORDER BY posted_at DESC NULLS LAST
    LIMIT 1
  `);
  let card = firstRow(existingRows);
  let createdNew = false;
  let createdInOrphan = false;

  // Step 2: card miss → auto-create nếu đủ context
  if (!card) {
    const postUrl = String(body.postUrl ?? '').trim();
    const authorHandle = String(body.authorHandle ?? '').trim().replace(/^u\//i, '').replace(/^@/, '');
    if (!postUrl || !authorHandle) {
      return errorResponse('Card chưa exist + ext không gửi postUrl/authorHandle → không thể auto-create. Cần postUrl + authorHandle.', 200, {
        reason: 'missing_context',
      });
    }
    const parsed = parsePostUrl(postUrl, pk);
    if (!parsed) {
      return errorResponse(`Không parse được URL (${pk}): ${postUrl}`, 200, {
        reason: 'invalid_post_url',
      });
    }
    if (parsed.leafId.toLowerCase() !== thingId.toLowerCase()) {
      return errorResponse(`thingId (${thingId}) khác id trong URL (${parsed.leafId})`, 200, {
        reason: 'thing_id_mismatch',
      });
    }

    // Resolve account_id (handle case-sensitive — Reddit usernames case-preserving)
    const accountRows = await db.execute(sql`
      SELECT id FROM platform_accounts
      WHERE platform_key = ${pk}
        AND LOWER(handle) = LOWER(${authorHandle})
      LIMIT 1
    `);
    const acct = firstRow(accountRows);
    if (!acct) {
      return errorResponse(`Account @${authorHandle} chưa tồn tại trong MOS2. Tạo account trước.`, 200, {
        reason: 'account_not_found',
        hint: { authorHandle },
      });
    }
    const accountId = Number(acct.id);

    // Resolve habitat_id (name match case-insensitive)
    const habitatRows = await db.execute(sql`
      SELECT id, project_id, language FROM habitats
      WHERE platform_key = ${pk}
        AND LOWER(name) = LOWER(${parsed.containerName})
      LIMIT 1
    `);
    const hab = firstRow(habitatRows);
    if (!hab) {
      return errorResponse(`Habitat ${parsed.containerName} chưa tồn tại trong MOS2. Tạo habitat trước.`, 200, {
        reason: 'habitat_not_found',
        hint: { container: parsed.containerName },
      });
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
    const brief = firstRow(briefRows);

    // Step 3: KHÔNG còn tạo ghost brief (0096). Card carry account_id+habitat_id TRỰC TIẾP, brief_id NULL.
    // Orphan (chưa có brief thật) → project_id '_orphan' bucket, brief_id NULL — readers COALESCE(card,brief).
    const briefId: number | null = brief ? Number(brief.id) : null;
    const projectId = brief ? String(brief.project_id) : '_orphan';
    if (!brief) createdInOrphan = true;

    // Tạo card. card_ref dùng convention EXT-<thingId> tránh đụng SEED-N.
    // squad_key NOT NULL → fallback 'wf-writer' (default seeding squad).
    const newCardRows = await db.execute(sql`
      INSERT INTO cards (
        tenant_id, project_id, brief_id, account_id, habitat_id, card_ref, squad_key,
        title, body_target, content_type, target_lang,
        post_url, posted_at,
        parent_url, parent_title, parent_author,
        answer_source,
        col, level, brief_phase, agent_kind,
        post_lifecycle, post_lifecycle_at, post_lifecycle_note
      )
      VALUES (
        'self', ${projectId}, ${briefId}, ${accountId}, ${habitatId}, ${`EXT-${thingId}`}, 'wf-writer',
        ${`${parsed.containerName || pk} ${thingId}`},
        ${String(body.bodyText ?? '').slice(0, 4000)},
        'comment', ${habitatLang},
        ${postUrl}, NOW(),
        ${parsed.threadUrl},
        ${`${parsed.containerName} thread ${parsed.postId}`},
        ${`${parsed.authorPrefix}${authorHandle}`},
        'external',
        'production', 1, 'warm-up', 'community-seed',
        'live', NOW(), 'auto-imported from Reddit insights page'
      )
      RETURNING id, post_url, project_id
    `);
    card = firstRow(newCardRows)!;
    createdNew = true;
  }

  const cardId = Number(card!.id);

  // Step 4: apply insights vào card (existing or newly-created)
  const sets: ReturnType<typeof sql>[] = [];
  sets.push(...insightsScalarSets(body));
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
    await appendInsightsSnapshot(db, cardId);   // 0093: time-series (throttled, non-fatal)
  }

  return NextResponse.json({
    ok: true,
    cardId,
    projectId: String(card!.project_id ?? ''),
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
