'use server';

// Posts (cards) cho 1 brief × phase cụ thể. Dùng trong PhaseEntryEditor để
// list + tạo + sửa bài viết draft. Mỗi post là 1 row trong cards với
// brief_id + brief_phase + col mặc định = 'backlog'.

import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import type { Phase } from '@/lib/phase-plan';
import { PHASE_LABEL } from '@/lib/phase-plan';
import { formatMeta } from '@/lib/content-formats';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const DEFAULT_SQUAD = 'wf-writer';
const DEFAULT_COL = 'backlog';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface BriefPost {
  id: number;
  cardRef: string;
  title: string;             // bản đăng thật theo target_lang
  titleReview: string;       // bản vi review (0067) — fallback từ title nếu rỗng
  body: string;              // legacy field - chỉ dùng nếu body_review + body_target rỗng
  bodyReview: string;        // luôn vi-VN
  bodyTarget: string;        // theo target_lang
  targetLang: string;        // en|fr|vi|zh|ko|ja - auto từ habitat.language
  parentUrl: string | null;     // URL thread/post gốc (comment/reply only)
  parentTitle: string | null;   // Title của parent
  parentBody: string | null;    // Body của parent (AI nạp prompt)
  parentAuthor: string | null;  // Handle author của parent
  parentSnippets: Array<{ author?: string; text: string }>; // top comments
  // 0070: nguồn body_target — manual | ai | astrolas | astrolas-mock | null
  answerSource: string | null;
  answerSources: Array<{ title: string; url: string; snippet?: string; type?: string }>;
  contentType: string;       // text|image|video|link|thread|poll|carousel|story|doc
  mediaAssetId: number | null;
  mediaUrl: string | null;   // ảnh/video thật kèm bài (preview render)
  mediaKind: string | null;  // image|video|...
  channelId: number | null;  // habitat_channels.id — null = habitat-level rules
  channelName: string | null;
  // Content Pillar override (card-level). NULL = inherit brief.primary_pillar_id.
  pillarId: number | null;
  pillarName: string | null;        // resolved name (override OR inherit)
  // Effective voice cho card này — resolve order: channel.override > pillar.voice
  // > habitat.voice. Server tính sẵn để VoiceContextPill khỏi fetch riêng từng card.
  effectiveVoice: string;
  voiceSource: 'channel' | 'pillar' | 'habitat' | 'default';
  // Distribution channel kind (seed|blog|email|thread) — khác content_type là medium
  contentKind: string;
  col: string;
  level: number;
  urgent: boolean;
  tags: string[];
  briefId: number | null;
  briefPhase: string | null;
  agentKind: string | null;
  dispatchReady: boolean;
  // Dispatch metadata — set khi confirmCardPosted() được gọi
  postUrl: string | null;
  postedAt: string | null;
  postScreenshotUrl: string | null;
  postNote: string | null;
  // Reddit/community insights — null nếu chưa sync.
  insightsViewsCount: number | null;
  insightsScore: number | null;
  insightsUpvoteRatio: number | null;       // 0.0-1.0
  insightsReplyCount: number | null;
  insightsShareCount: number | null;
  insightsAwardCount: number | null;
  insightsFetchedAt: string | null;
  // Geo + top replies (migration 0076) — null nếu chưa sync.
  insightsTopCountries: Array<{ country: string; pct: number }> | null;
  insightsTopReplies: Array<{ author: string; ago?: string; body: string; score?: number | null }> | null;
  // Lifecycle status: 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement' | null
  postLifecycle: string | null;
  createdAt: string;
  updatedAt: string;
}

// List all posts (cards) for 1 brief × phase. Sorted: most recently updated first.
export async function listPostsForBriefPhase(briefId: number, phase: Phase): Promise<BriefPost[]> {
  const db = ensureDb();
  // 1 query với LEFT JOIN media_assets thay vì cards-then-media (2 round-trips).
  // Server actions của Next có overhead serialization/RSC framing cao —
  // giảm số round-trip là tối ưu lớn nhất ở tầng này.
  const rows = await db.execute(sql`
    SELECT c.id, c.card_ref, c.title, c.title_review, c.body, c.body_review, c.body_target,
           c.target_lang, c.parent_url, c.parent_title, c.parent_body, c.parent_author, c.parent_snippets,
           c.answer_source, c.answer_sources,
           c.content_type, c.media_asset_id, c.channel_id,
           c.pillar_id, c.content_kind, c.col, c.level,
           c.urgent, c.tags, c.brief_id, c.brief_phase, c.agent_kind,
           c.dispatch_ready, c.post_url, c.posted_at, c.post_screenshot_url, c.post_note,
           c.insights_views_count, c.insights_score, c.insights_upvote_ratio,
           c.insights_reply_count, c.insights_share_count, c.insights_award_count,
           c.insights_fetched_at,
           c.insights_top_countries, c.insights_top_replies,
           c.post_lifecycle,
           c.created_at, c.updated_at,
           m.url AS media_url, m.kind AS media_kind,
           hc.name AS channel_name,
           -- Resolved pillar name: card.pillar_id override OR brief.primary_pillar_id
           cp.name AS pillar_name,
           -- Voice resolved: channel.override > pillar.voice > habitat.voice > 'regular'
           COALESCE(NULLIF(hc.voice_profile_override, ''),
                    NULLIF(cp.voice_profile, ''),
                    NULLIF(h.voice_profile, ''),
                    'regular') AS effective_voice,
           CASE
             WHEN hc.voice_profile_override IS NOT NULL AND hc.voice_profile_override != '' THEN 'channel'
             WHEN cp.voice_profile IS NOT NULL AND cp.voice_profile != '' THEN 'pillar'
             WHEN h.voice_profile IS NOT NULL AND h.voice_profile != '' THEN 'habitat'
             ELSE 'default'
           END AS voice_source
      FROM cards c
      LEFT JOIN media_assets m ON m.id = c.media_asset_id
      LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = b.habitat_id
      LEFT JOIN content_pillars cp ON cp.id = COALESCE(c.pillar_id, b.primary_pillar_id)
     WHERE c.brief_id = ${briefId} AND c.brief_phase = ${phase}
       AND c.archived_at IS NULL
     ORDER BY c.updated_at DESC
  `);
  type Row = {
    id: number; card_ref: string; title: string | null; title_review: string | null;
    body: string | null; body_review: string | null; body_target: string | null;
    target_lang: string | null; parent_url: string | null; parent_title: string | null;
    parent_body: string | null; parent_author: string | null; parent_snippets: unknown;
    answer_source: string | null; answer_sources: unknown;
    content_type: string | null;
    media_asset_id: number | null; channel_id: number | null;
    pillar_id: number | null; content_kind: string | null;
    col: string; level: number;
    urgent: boolean; tags: unknown; brief_id: number | null;
    brief_phase: string | null; agent_kind: string | null;
    dispatch_ready: boolean; created_at: Date | string; updated_at: Date | string;
    media_url: string | null; media_kind: string | null;
    channel_name: string | null;
    pillar_name: string | null;
    effective_voice: string | null;
    voice_source: string | null;
    post_url: string | null;
    posted_at: Date | string | null;
    post_screenshot_url: string | null;
    post_note: string | null;
    insights_views_count: number | string | null;
    insights_score: number | string | null;
    insights_upvote_ratio: number | string | null;
    insights_reply_count: number | string | null;
    insights_share_count: number | string | null;
    insights_award_count: number | string | null;
    insights_fetched_at: Date | string | null;
    insights_top_countries: unknown;
    insights_top_replies: unknown;
    post_lifecycle: string | null;
  };
  return (rows as unknown as Row[]).map((r) => ({
    id: Number(r.id),     // cast pg bigint string → number
    cardRef: r.card_ref,
    title: r.title ?? '',
    titleReview: r.title_review ?? r.title ?? '',
    body: r.body ?? '',
    bodyReview: r.body_review ?? '',
    bodyTarget: r.body_target ?? '',
    targetLang: r.target_lang ?? 'en',
    parentUrl: r.parent_url ?? null,
    parentTitle: r.parent_title ?? null,
    parentBody: r.parent_body ?? null,
    parentAuthor: r.parent_author ?? null,
    parentSnippets: Array.isArray(r.parent_snippets) ? r.parent_snippets as Array<{ author?: string; text: string }> : [],
    answerSource: r.answer_source ?? null,
    answerSources: Array.isArray(r.answer_sources) ? r.answer_sources as Array<{ title: string; url: string; snippet?: string; type?: string }> : [],
    contentType: r.content_type ?? 'text',
    // Cast Number cho bigint fields (pg-driver default trả string).
    mediaAssetId: r.media_asset_id != null ? Number(r.media_asset_id) : null,
    mediaUrl: r.media_url ?? null,
    mediaKind: r.media_kind ?? null,
    channelId: r.channel_id != null ? Number(r.channel_id) : null,
    channelName: r.channel_name ?? null,
    // Cast Number — pg-driver trả bigint dạng string. Nếu giữ string,
    // chip pillar so sánh `p.id === currentId` (number === string) sai → ẩn.
    pillarId: r.pillar_id != null ? Number(r.pillar_id) : null,
    pillarName: r.pillar_name ?? null,
    effectiveVoice: r.effective_voice ?? 'regular',
    voiceSource: ((r.voice_source ?? 'default') as BriefPost['voiceSource']),
    contentKind: r.content_kind ?? 'seed',
    col: r.col,
    level: r.level,
    urgent: r.urgent,
    tags: (r.tags as string[]) ?? [],
    briefId: r.brief_id != null ? Number(r.brief_id) : null,
    briefPhase: r.brief_phase,
    agentKind: r.agent_kind,
    dispatchReady: r.dispatch_ready,
    postUrl: r.post_url ?? null,
    postedAt: r.posted_at instanceof Date ? r.posted_at.toISOString() : (r.posted_at ? String(r.posted_at) : null),
    postScreenshotUrl: r.post_screenshot_url ?? null,
    postNote: r.post_note ?? null,
    insightsViewsCount: r.insights_views_count != null ? Number(r.insights_views_count) : null,
    insightsScore: r.insights_score != null ? Number(r.insights_score) : null,
    insightsUpvoteRatio: r.insights_upvote_ratio != null ? Number(r.insights_upvote_ratio) : null,
    insightsReplyCount: r.insights_reply_count != null ? Number(r.insights_reply_count) : null,
    insightsShareCount: r.insights_share_count != null ? Number(r.insights_share_count) : null,
    insightsAwardCount: r.insights_award_count != null ? Number(r.insights_award_count) : null,
    insightsFetchedAt: r.insights_fetched_at instanceof Date ? r.insights_fetched_at.toISOString() : (r.insights_fetched_at ? String(r.insights_fetched_at) : null),
    insightsTopCountries: Array.isArray(r.insights_top_countries) ? r.insights_top_countries as Array<{ country: string; pct: number }> : null,
    insightsTopReplies: Array.isArray(r.insights_top_replies) ? r.insights_top_replies as Array<{ author: string; ago?: string; body: string; score?: number | null }> : null,
    postLifecycle: r.post_lifecycle ? String(r.post_lifecycle) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}

// ──────────────────────────────────────────────────────────────────
// RecentPostedCard — slim shape cho "📨 Vừa đăng" section trên cockpit.
// Cross-brief, sort posted_at desc, default 7 ngày gần nhất.
// ──────────────────────────────────────────────────────────────────
// EngagementAttempt — 1 card trong group "thread engagement" theo parent_url.
// Bao gồm cả card đã archive (để xem history), cross-brief, cross-account.
// ──────────────────────────────────────────────────────────────────
export interface EngagementAttempt {
  id: number;
  cardRef: string;
  bodyTarget: string;
  contentType: string;
  briefId: number | null;
  habitatId: number | null;
  habitatName: string | null;
  accountId: number | null;
  accountHandle: string | null;
  platformKey: string | null;
  postUrl: string | null;
  postedAt: string | null;
  archivedAt: string | null;
  postLifecycle: string | null;        // 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement' | null
  postLifecycleAt: string | null;
  postLifecycleNote: string | null;
  // Insights inline (P2 từ trước)
  insightsViewsCount: number | null;
  insightsScore: number | null;
  insightsUpvoteRatio: number | null;
  insightsReplyCount: number | null;
  insightsTopCountries: Array<{ country: string; pct: number }> | null;
  insightsTopReplies: Array<{ author: string; ago?: string; body: string; score?: number | null }> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParentEngagementSummary {
  parentUrl: string;
  parentTitle: string | null;
  totalAttempts: number;
  postedCount: number;          // có post_url
  liveCount: number;            // post_lifecycle = 'live'
  ghostedCount: number;
  removedCount: number;         // removed-by-mod + self-deleted
  lowEngagementCount: number;
  draftCount: number;           // chưa post (post_url null)
  archivedCount: number;
  accountsEngaged: string[];    // unique handles
  lastAttemptAt: string | null;
  attempts: EngagementAttempt[]; // sort posted_at desc, archived last
}

// Get all engagement attempts for 1 parent_url. Cross-brief, cross-account,
// includes archived. Sort: archived LAST, then posted_at DESC (mới nhất trước).
export async function listEngagementsByParentUrl(
  projectId: string,
  parentUrl: string,
): Promise<ParentEngagementSummary | null> {
  if (!parentUrl?.trim()) return null;
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT c.id, c.card_ref, c.body_target, c.content_type, c.parent_title,
           c.brief_id, c.post_url, c.posted_at, c.archived_at,
           c.post_lifecycle, c.post_lifecycle_at, c.post_lifecycle_note,
           c.insights_views_count, c.insights_score, c.insights_upvote_ratio,
           c.insights_reply_count,
           c.insights_top_countries, c.insights_top_replies,
           c.created_at, c.updated_at,
           b.habitat_id, b.account_id,
           h.name AS habitat_name,
           h.platform_key,
           pa.handle AS account_handle, pa.account_kind AS account_kind
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = b.habitat_id
      LEFT JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE c.project_id = ${projectId} AND c.parent_url = ${parentUrl}
     ORDER BY
       (c.archived_at IS NOT NULL) ASC,
       c.posted_at DESC NULLS LAST,
       c.created_at DESC
  `);
  const data = rows as unknown as Array<Record<string, unknown>>;
  if (data.length === 0) return null;

  const attempts: EngagementAttempt[] = data.map((r) => ({
    id: Number(r.id),
    cardRef: String(r.card_ref ?? ''),
    bodyTarget: String(r.body_target ?? '').slice(0, 300),
    contentType: String(r.content_type ?? 'text'),
    briefId: r.brief_id != null ? Number(r.brief_id) : null,
    habitatId: r.habitat_id != null ? Number(r.habitat_id) : null,
    habitatName: r.habitat_name ? String(r.habitat_name) : null,
    accountId: r.account_id != null ? Number(r.account_id) : null,
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    accountKind: String(r.account_kind ?? 'user'),
    platformKey: r.platform_key ? String(r.platform_key) : null,
    postUrl: r.post_url ? String(r.post_url) : null,
    postedAt: r.posted_at instanceof Date ? r.posted_at.toISOString() : (r.posted_at ? String(r.posted_at) : null),
    archivedAt: r.archived_at instanceof Date ? r.archived_at.toISOString() : (r.archived_at ? String(r.archived_at) : null),
    postLifecycle: r.post_lifecycle ? String(r.post_lifecycle) : null,
    postLifecycleAt: r.post_lifecycle_at instanceof Date ? r.post_lifecycle_at.toISOString() : (r.post_lifecycle_at ? String(r.post_lifecycle_at) : null),
    postLifecycleNote: r.post_lifecycle_note ? String(r.post_lifecycle_note) : null,
    insightsViewsCount: r.insights_views_count != null ? Number(r.insights_views_count) : null,
    insightsScore: r.insights_score != null ? Number(r.insights_score) : null,
    insightsUpvoteRatio: r.insights_upvote_ratio != null ? Number(r.insights_upvote_ratio) : null,
    insightsReplyCount: r.insights_reply_count != null ? Number(r.insights_reply_count) : null,
    insightsTopCountries: Array.isArray(r.insights_top_countries) ? r.insights_top_countries as Array<{ country: string; pct: number }> : null,
    insightsTopReplies: Array.isArray(r.insights_top_replies) ? r.insights_top_replies as Array<{ author: string; ago?: string; body: string; score?: number | null }> : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));

  const accountsSet = new Set<string>();
  let postedCount = 0, liveCount = 0, ghostedCount = 0, removedCount = 0;
  let lowEngagementCount = 0, draftCount = 0, archivedCount = 0;
  let lastAttemptAt: string | null = null;
  for (const a of attempts) {
    if (a.accountHandle) accountsSet.add(a.accountHandle);
    if (a.archivedAt) archivedCount++;
    if (a.postUrl) postedCount++; else draftCount++;
    if (a.postLifecycle === 'live') liveCount++;
    else if (a.postLifecycle === 'ghosted') ghostedCount++;
    else if (a.postLifecycle === 'removed-by-mod' || a.postLifecycle === 'self-deleted') removedCount++;
    else if (a.postLifecycle === 'low-engagement') lowEngagementCount++;
    if (a.postedAt && (!lastAttemptAt || a.postedAt > lastAttemptAt)) lastAttemptAt = a.postedAt;
  }

  const parentTitle = data.find((r) => r.parent_title)?.parent_title;

  return {
    parentUrl,
    parentTitle: parentTitle ? String(parentTitle) : null,
    totalAttempts: attempts.length,
    postedCount, liveCount, ghostedCount, removedCount, lowEngagementCount,
    draftCount, archivedCount,
    accountsEngaged: Array.from(accountsSet),
    lastAttemptAt,
    attempts,
  };
}

// List tất cả parent_url có ≥1 attempt cho 1 brief, kèm summary stats.
// Dùng cho "🧵 Threads đã engage" section trong brief modal.
export async function listEngagedThreadsForBrief(
  briefId: number,
): Promise<Array<{
  parentUrl: string;
  parentTitle: string | null;
  attemptCount: number;
  postedCount: number;
  liveCount: number;
  ghostedCount: number;
  removedCount: number;
  lastAttemptAt: string | null;
}>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT c.parent_url,
           MAX(c.parent_title) AS parent_title,
           COUNT(*) AS attempt_count,
           COUNT(c.post_url) AS posted_count,
           COUNT(*) FILTER (WHERE c.post_lifecycle = 'live') AS live_count,
           COUNT(*) FILTER (WHERE c.post_lifecycle = 'ghosted') AS ghosted_count,
           COUNT(*) FILTER (WHERE c.post_lifecycle IN ('removed-by-mod', 'self-deleted')) AS removed_count,
           MAX(c.posted_at) AS last_attempt_at
      FROM cards c
     WHERE c.brief_id = ${briefId}
       AND c.parent_url IS NOT NULL
       AND c.parent_url != ''
     GROUP BY c.parent_url
     ORDER BY MAX(c.posted_at) DESC NULLS LAST, MAX(c.created_at) DESC
     LIMIT 50
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    parentUrl: String(r.parent_url ?? ''),
    parentTitle: r.parent_title ? String(r.parent_title) : null,
    attemptCount: Number(r.attempt_count ?? 0),
    postedCount: Number(r.posted_count ?? 0),
    liveCount: Number(r.live_count ?? 0),
    ghostedCount: Number(r.ghosted_count ?? 0),
    removedCount: Number(r.removed_count ?? 0),
    lastAttemptAt: r.last_attempt_at instanceof Date ? r.last_attempt_at.toISOString() : (r.last_attempt_at ? String(r.last_attempt_at) : null),
  }));
}

// Update post_lifecycle cho 1 card (manual mark hoặc cron auto-detect).
export async function updateCardLifecycle(
  cardId: number,
  lifecycle: 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement' | null,
  note?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const checkRows = await db.execute(sql`
    SELECT id FROM cards WHERE id = ${cardId} LIMIT 1
  `);
  if (!(checkRows as unknown as Array<unknown>)[0]) {
    return { ok: false, error: 'Card not found' };
  }
  await db.execute(sql`
    UPDATE cards SET
      post_lifecycle = ${lifecycle},
      post_lifecycle_at = NOW(),
      post_lifecycle_note = ${note ?? null},
      updated_at = NOW()
     WHERE id = ${cardId}
  `);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────
export interface RecentPostedCard {
  id: number;
  cardRef: string;
  title: string;
  bodyTarget: string;     // preview 200 chars
  contentType: string;
  targetLang: string;
  postUrl: string;
  postedAt: string;
  briefId: number | null;
  habitatId: number | null;
  habitatName: string;
  platformLabel: string;
  platformKey: string | null;
  accountHandle: string | null;
  accountKind: string;             // 0058: user|bot|app
  // Insights inline (P2)
  insightsViewsCount: number | null;
  insightsScore: number | null;
  insightsUpvoteRatio: number | null;
  insightsReplyCount: number | null;
  insightsFetchedAt: string | null;
  // Lifecycle status — null nếu chưa mark
  postLifecycle: string | null;
  // Phase card thuộc về (warm-up/value/bridge/seed/direct/cooldown) — focus
  // đúng phase khi mở brief modal qua URL ?bfp=<phase>.
  briefPhase: string | null;
  // Sub-channel của habitat (Discord channel, Slack channel...). Null nếu
  // card đăng habitat-level (subreddit/forum 1 ruleset).
  channelName: string | null;
  // Số attempts cùng parent_url (>= 1, include self). Khi >1 = thread engaged
  // nhiều lần (re-post sau ghost / multi-account). UI prefix "🧵 ×N".
  parentAttemptCount: number;
}

export async function listRecentPostedCards(
  projectId: string,
  opts?: { days?: number; limit?: number },
): Promise<RecentPostedCard[]> {
  const db = ensureDb();
  const days = opts?.days ?? 7;
  const limit = opts?.limit ?? 50;
  const rows = await db.execute(sql`
    SELECT c.id, c.card_ref, c.title, c.body_target, c.content_type, c.target_lang,
           c.post_url, c.posted_at, c.parent_url,
           c.post_lifecycle, c.brief_phase,
           c.brief_id, c.channel_id,
           c.insights_views_count, c.insights_score, c.insights_upvote_ratio,
           c.insights_reply_count, c.insights_fetched_at,
           b.habitat_id,
           h.name AS habitat_name,
           p.label AS platform_label, p.key AS platform_key,
           pa.handle AS account_handle, pa.account_kind AS account_kind,
           hc.name AS channel_name,
           -- COUNT attempts cùng parent_url (>= 1, include self). Window function
           -- để tránh subquery; project-scoped để cross-brief OK.
           (SELECT COUNT(*) FROM cards c2
              WHERE c2.project_id = c.project_id
                AND c2.parent_url = c.parent_url
                AND c2.parent_url IS NOT NULL) AS parent_attempt_count
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE c.project_id = ${projectId}
      AND c.post_url IS NOT NULL
      AND c.archived_at IS NULL
      AND c.posted_at IS NOT NULL
      AND c.posted_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
    ORDER BY c.posted_at DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    cardRef: String(r.card_ref ?? ''),
    title: String(r.title ?? ''),
    bodyTarget: String(r.body_target ?? '').slice(0, 200),
    contentType: String(r.content_type ?? 'text'),
    targetLang: String(r.target_lang ?? 'en'),
    postUrl: String(r.post_url ?? ''),
    postedAt: r.posted_at instanceof Date ? r.posted_at.toISOString() : String(r.posted_at),
    briefId: r.brief_id != null ? Number(r.brief_id) : null,
    habitatId: r.habitat_id != null ? Number(r.habitat_id) : null,
    habitatName: String(r.habitat_name ?? ''),
    platformLabel: String(r.platform_label ?? ''),
    platformKey: r.platform_key ? String(r.platform_key) : null,
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    accountKind: String(r.account_kind ?? 'user'),
    insightsViewsCount: r.insights_views_count != null ? Number(r.insights_views_count) : null,
    insightsScore: r.insights_score != null ? Number(r.insights_score) : null,
    insightsUpvoteRatio: r.insights_upvote_ratio != null ? Number(r.insights_upvote_ratio) : null,
    insightsReplyCount: r.insights_reply_count != null ? Number(r.insights_reply_count) : null,
    insightsFetchedAt: r.insights_fetched_at instanceof Date ? r.insights_fetched_at.toISOString() : (r.insights_fetched_at ? String(r.insights_fetched_at) : null),
    postLifecycle: r.post_lifecycle ? String(r.post_lifecycle) : null,
    briefPhase: r.brief_phase ? String(r.brief_phase) : null,
    channelName: r.channel_name ? String(r.channel_name) : null,
    parentAttemptCount: Number(r.parent_attempt_count ?? 1),
  }));
}

// Generate next card_ref unique trong project. Pattern: SEED-{N}
async function nextCardRef(projectId: string): Promise<string> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT card_ref FROM cards
    WHERE project_id = ${projectId} AND card_ref LIKE 'SEED-%'
    ORDER BY id DESC LIMIT 1
  `);
  const last = (rows as unknown as Array<{ card_ref: string }>)[0]?.card_ref ?? '';
  const n = Number(last.replace(/^SEED-/, '')) || 0;
  return `SEED-${n + 1}`;
}

// Build prefilled body từ brief context. Trả 2 bản: bodyReview (VN scaffolding
// có context phase) + bodyTarget (template ngôn ngữ target hoặc placeholder).
// AI sinh draft thật chạy sau (action generateFullDraft).
async function buildPrefillBody(
  briefId: number, phase: Phase, contentType: string, langOverride?: string,
): Promise<{
  title: string;
  bodyReview: string;
  bodyTarget: string;
  targetLang: string;
}> {
  const fmt = formatMeta(contentType);
  const db = ensureDb();
  const briefRows = await db.execute(sql`
    SELECT b.narrative_md, b.tone, b.approach_md, b.phase_plan,
           h.name AS habitat_name, h.kind AS habitat_kind, h.language AS habitat_lang,
           pa.handle AS account_handle
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE b.id = ${briefId}
    LIMIT 1
  `);
  const r = (briefRows as unknown as Array<Record<string, unknown>>)[0];
  // Lane có thể override ngôn ngữ; '' = kế thừa habitat.language.
  const targetLang = (langOverride && langOverride.trim())
    ? langOverride.trim()
    : ((r?.habitat_lang ? String(r.habitat_lang) : '') || 'en');
  if (!r) {
    return {
      title: `[${PHASE_LABEL[phase]} · ${fmt.label}] Bài viết mới`,
      bodyReview: '',
      bodyTarget: '',
      targetLang,
    };
  }

  const plan = (r.phase_plan as Array<{ phase: string; goal?: string; hooks?: string[]; doMd?: string; dontMd?: string; tone?: string }> | null) ?? [];
  const phaseEntry = plan.find((p) => p.phase === phase);
  const hookSuggestion = (phaseEntry?.hooks ?? [])[0] ?? '';

  const title = hookSuggestion
    ? `[${PHASE_LABEL[phase]} · ${fmt.label}] ${hookSuggestion.slice(0, 80)}`
    : `[${PHASE_LABEL[phase]} · ${fmt.label}] ${fmt.icon} cho ${r.habitat_name}`;

  // KHÔNG còn scaffold/placeholder text: body để TRỐNG. Scaffold cũ
  // (metadata + "## Mục tiêu phase" + narrative) trông giống mô tả brief
  // → user tưởng "Sinh draft" ghi đè mô tả. Context (phase/hook/narrative)
  // AI vẫn tự load từ loadPostContext khi sinh. Editor hiện placeholder hint.
  void phaseEntry; // context dùng ở generateFullDraft, không prefill nữa
  return { title, bodyReview: '', bodyTarget: '', targetLang };
}

export async function createPostForBriefPhase(
  projectId: string, briefId: number, phase: Phase,
  contentType: string = 'text', langOverride?: string,
  // channelId tuỳ chọn: null/undefined = auto-pick từ habitat channels (chỉ
  // áp dụng khi habitat là Discord/Slack/Telegram). Khi không tìm được
  // channel phù hợp → null (habitat-level post).
  channelIdOverride?: number | null,
  // pillarId tuỳ chọn: null/undefined = kế thừa brief.primary_pillar_id.
  // Truyền giá trị = override pillar cho card (vd distribute theo pillarMix).
  pillarIdOverride?: number | null,
): Promise<{ ok: boolean; id?: number; cardRef?: string; channelId?: number | null; pillarId?: number | null; error?: string }> {
  const db = ensureDb();
  // Verify brief belongs to project + lấy habitat_id để auto-pick channel.
  // Cũng pull join_status + account.status để gate 2-layer (account ready +
  // membership ready). Bug 2026-05-22: brief 11 có account=todo nhưng
  // joinStatus=joined → impossible. Bây giờ gate cả 2 tầng.
  const briefCheck = await db.execute(sql`
    SELECT b.id, b.habitat_id, b.join_status, pa.status AS account_status, h.platform_key
      FROM community_briefs b
      LEFT JOIN habitats h ON h.id = b.habitat_id
      LEFT JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE b.id = ${briefId} AND b.project_id = ${projectId}
  `);
  const briefRow = (briefCheck as unknown as Array<Record<string, unknown>>)[0];
  if (!briefRow) {
    return { ok: false, error: 'brief not in project' };
  }
  // Layer 1 GATE: account phải active (không phải todo/creating/limited/blocked/banned).
  // Áp dụng cho mọi phase — account chưa tồn tại thì warmup cũng vô nghĩa.
  const accountStatus = String(briefRow.account_status ?? 'todo');
  if (accountStatus !== 'active') {
    const { accountStatusMeta } = await import('@/lib/status-meta');
    const meta = accountStatusMeta(accountStatus);
    return {
      ok: false,
      error: `❌ Account đang "${meta.label}" — ${meta.hint}. Fix account trước khi tạo bài.`,
    };
  }
  // Layer 2 GATE: bridge/seed/direct yêu cầu joined. warm-up + value cho phép prep
  // khi account active nhưng chưa join (chuẩn bị nội dung trước khi gửi join request).
  const joinStatus = String(briefRow.join_status ?? 'not_joined');
  if (joinStatus !== 'joined' && ['bridge', 'seed', 'direct'].includes(phase)) {
    return {
      ok: false,
      error: `❌ Brief đang "${joinStatus}" — không tạo bài phase ${phase} khi chưa join. Đánh dấu "đã join" ở header chip trước.`,
    };
  }
  const habitatId = briefRow.habitat_id ? Number(briefRow.habitat_id) : null;
  const platformKey = briefRow.platform_key ? String(briefRow.platform_key) : '';
  const isDiscordLike = ['discord', 'slack', 'telegram'].includes(platformKey);

  const ct = formatMeta(contentType).key; // chuẩn hoá về key hợp lệ
  const ref = await nextCardRef(projectId);
  const { title, bodyReview, bodyTarget, targetLang } = await buildPrefillBody(briefId, phase, ct, langOverride);

  // Auto-pick channel nếu Discord-like + chưa được override + có channels.
  // Inline import để tránh circular dep (card-channel imports voice-profile,
  // voice-profile được brief-posts dùng indirectly via post-draft).
  let resolvedChannelId: number | null = channelIdOverride ?? null;
  if (isDiscordLike && habitatId != null && channelIdOverride == null) {
    try {
      const { suggestChannelForNewPost } = await import('./card-channel');
      const sugg = await suggestChannelForNewPost(habitatId, phase, ct);
      if (sugg.ok) resolvedChannelId = sugg.channelId;
    } catch { /* silent fallback to null */ }
  }

  const inserted = await db.insert(cards).values({
    tenantId: TENANT,
    projectId,
    cardRef: ref,
    col: DEFAULT_COL,
    title,
    body: bodyTarget, // legacy field
    bodyReview,
    bodyTarget,
    targetLang,
    contentType: ct,
    squadKey: DEFAULT_SQUAD,
    level: 2,
    tags: ['community-seed', `brief:${briefId}`, `phase:${phase}`, `lang:${targetLang}`, `type:${ct}`],
    briefId,
    briefPhase: phase,
    ...(resolvedChannelId != null ? { channelId: resolvedChannelId } : {}),
    // Pillar override per-card (vd từ distribute pillarMix). NULL = inherit brief.primary_pillar_id.
    ...(pillarIdOverride != null ? { pillarId: pillarIdOverride } : {}),
  }).returning({ id: cards.id, cardRef: cards.cardRef });

  // KHÔNG revalidatePath — client setState local (PostsForPhase bumpKey + onLocalPatch).
  return {
    ok: true,
    id: inserted[0]?.id, cardRef: inserted[0]?.cardRef,
    channelId: resolvedChannelId,
    pillarId: pillarIdOverride ?? null,
  };
}

export async function updatePost(
  projectId: string, cardId: number,
  patch: {
    title?: string; titleReview?: string; body?: string;
    bodyReview?: string; bodyTarget?: string; targetLang?: string;
    parentUrl?: string | null;
    parentTitle?: string | null;
    parentBody?: string | null;
    parentAuthor?: string | null;
    parentSnippets?: Array<{ author?: string; text: string }>;
    contentType?: string;
    channelId?: number | null;
    col?: string; urgent?: boolean; dispatchReady?: boolean;
  },
): Promise<{ ok: boolean }> {
  const db = ensureDb();
  // contentType: chuẩn hoá về key hợp lệ (giống lúc tạo) — tránh ghi giá trị lạ.
  const ct = patch.contentType != null ? formatMeta(patch.contentType).key : undefined;
  await db.update(cards)
    .set({
      ...(patch.title != null ? { title: patch.title } : {}),
      ...(patch.titleReview != null ? { titleReview: patch.titleReview } : {}),
      ...(patch.body != null ? { body: patch.body } : {}),
      ...(patch.bodyReview != null ? { bodyReview: patch.bodyReview } : {}),
      ...(patch.bodyTarget != null ? { bodyTarget: patch.bodyTarget } : {}),
      ...(patch.targetLang != null ? { targetLang: patch.targetLang } : {}),
      ...(patch.parentUrl !== undefined ? { parentUrl: patch.parentUrl } : {}),
      ...(patch.parentTitle !== undefined ? { parentTitle: patch.parentTitle } : {}),
      ...(patch.parentBody !== undefined ? { parentBody: patch.parentBody } : {}),
      ...(patch.parentAuthor !== undefined ? { parentAuthor: patch.parentAuthor } : {}),
      ...(patch.parentSnippets !== undefined ? { parentSnippets: patch.parentSnippets } : {}),
      ...(ct != null ? { contentType: ct } : {}),
      ...(patch.channelId !== undefined ? { channelId: patch.channelId } : {}),
      ...(patch.col != null ? { col: patch.col } : {}),
      ...(patch.urgent != null ? { urgent: patch.urgent } : {}),
      ...(patch.dispatchReady != null ? { dispatchReady: patch.dispatchReady } : {}),
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId));
  // KHÔNG revalidatePath — client setState local (PostsForPhase bumpKey + onLocalPatch).
  return { ok: true };
}

export async function deletePost(projectId: string, cardId: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.delete(cards).where(eq(cards.id, cardId));
  // KHÔNG revalidatePath — client setState local (PostsForPhase bumpKey + onLocalPatch).
  return { ok: true };
}

// Combo: tạo N placeholder cards cùng lúc cho 1 phase. Dùng cho button
// "+ Tạo batch N bài" — sau đó UI sẽ gọi generateBatchForPhase để AI fill content.
// Với Discord/Slack/Telegram habitats: distribute N posts qua N channels khác
// nhau (round-robin theo phase suitability) → cover nhiều surface trong server
// thay vì N posts cùng channel #general.
export async function createPlaceholdersForBriefPhase(
  projectId: string, briefId: number, phase: Phase, count: number,
): Promise<{ ok: boolean; created: number[]; error?: string }> {
  const db = ensureDb();

  // Pull habitat + phase_plan + 2-layer gate (account + join)
  const briefRow = await db.execute(sql`
    SELECT b.habitat_id, b.phase_plan, b.join_status, pa.status AS account_status, h.platform_key
      FROM community_briefs b
      LEFT JOIN habitats h ON h.id = b.habitat_id
      LEFT JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const br = (briefRow as unknown as Array<Record<string, unknown>>)[0];
  // Layer 1 GATE: account-level (xem comment trong createPostForBriefPhase)
  const accountStatus = String(br?.account_status ?? 'todo');
  if (accountStatus !== 'active') {
    const { accountStatusMeta } = await import('@/lib/status-meta');
    const meta = accountStatusMeta(accountStatus);
    return {
      ok: false, created: [],
      error: `❌ Account đang "${meta.label}" — ${meta.hint}. Fix account trước khi batch tạo bài.`,
    };
  }
  // Layer 2 GATE: batch (mọi phase) cần membership thật
  const joinStatus = String(br?.join_status ?? 'not_joined');
  if (joinStatus !== 'joined') {
    return {
      ok: false, created: [],
      error: `❌ Brief đang "${joinStatus}" — không tạo batch khi chưa join community. Đánh dấu "đã join" trước.`,
    };
  }
  const habitatId = br?.habitat_id ? Number(br.habitat_id) : null;
  const platformKey = br?.platform_key ? String(br.platform_key) : '';
  const isDiscordLike = ['discord', 'slack', 'telegram'].includes(platformKey);
  const plan = Array.isArray(br?.phase_plan) ? (br?.phase_plan as Array<Record<string, unknown>>) : [];
  const phaseEntry = plan.find((p) => p.phase === phase);
  const pillarMix = (phaseEntry?.pillarMix && typeof phaseEntry.pillarMix === 'object')
    ? phaseEntry.pillarMix as Record<string, number> : null;

  // Pre-compute channel assignments
  let channelAssignments: Array<number | null> = new Array(count).fill(null);
  if (isDiscordLike && habitatId != null) {
    try {
      const { distributeChannelsForPlaceholders } = await import('./card-channel');
      const ids = await distributeChannelsForPlaceholders(habitatId, phase, 'text', count);
      if (ids.length === count) channelAssignments = ids.map((id) => id != null ? Number(id) : null);
    } catch { /* fallback: all null */ }
  }

  // Pre-compute pillar assignments — distribute N posts theo pillarMix weights.
  // Vd mix = { "1": 4, "2": 4, "3": 2 } + N=10 → expand thành [1,1,1,1,2,2,2,2,3,3]
  // shuffle để xen kẽ (không 4 bài pillar 1 liền nhau).
  let pillarAssignments: Array<number | null> = new Array(count).fill(null);
  if (pillarMix) {
    const weights = Object.entries(pillarMix)
      .map(([id, w]) => ({ id: Number(id), weight: Math.max(0, Number(w) || 0) }))
      .filter((x) => x.id > 0 && x.weight > 0);
    if (weights.length > 0) {
      const total = weights.reduce((s, x) => s + x.weight, 0);
      // Expand: số card mỗi pillar = round(count * weight/total), correct phần lẻ
      const counts = weights.map((w) => Math.round((count * w.weight) / total));
      let sum = counts.reduce((s, n) => s + n, 0);
      // Sửa rounding error (sum có thể != count): bù vào pillar weight cao nhất
      while (sum < count) { counts[0]!++; sum++; }
      while (sum > count) { counts[0]!--; sum--; }
      // Build list rồi interleave: zip nhau thay vì 4 cái pillar 1 liền nhau
      const buckets: number[][] = weights.map((w, i) => new Array(counts[i]!).fill(w.id));
      const interleaved: number[] = [];
      while (interleaved.length < count) {
        for (const bucket of buckets) {
          const id = bucket.shift();
          if (id != null) interleaved.push(id);
          if (interleaved.length >= count) break;
        }
      }
      pillarAssignments = interleaved.slice(0, count);
    }
  }

  const created: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await createPostForBriefPhase(
      projectId, briefId, phase, 'text', undefined,
      channelAssignments[i],     // null = habitat-level
      pillarAssignments[i],      // null = inherit brief default
    );
    if (!res.ok) return { ok: false, created, error: res.error };
    if (res.id) created.push(res.id);
  }
  return { ok: true, created };
}

// ────────────────────────────────────────────────────────────────────
// listAllPostedCards — danh sách FULL bài đã đăng cross-brief / cross-time
// với filter mạnh. Dùng cho tab "Tất cả bài đăng" trong /seeding.
// Khác listRecentPostedCards (7d, 50 limit, chỉ posted_at IS NOT NULL):
//   - time range linh hoạt
//   - filter lifecycle / platform / habitat / account / brief / AI-detect
//   - threshold min-views/score/replies
//   - sort theo posted/views/score/replies/ratio
//   - pagination offset+limit
// ────────────────────────────────────────────────────────────────────

export type PostedSortKey =
  | 'posted_desc' | 'posted_asc'
  | 'views_desc' | 'score_desc' | 'replies_desc' | 'ratio_desc'
  | 'cost_desc' | 'cost_asc'
  | 'duration_desc' | 'duration_asc';

export interface AllPostedFilters {
  days?: number | null;            // null = all-time, default 7
  lifecycles?: string[];           // include nếu set; mặc định = exclude removed
  hideRemoved?: boolean;           // default true (hide removed-by-mod + self-deleted)
  platformKeys?: string[];
  habitatIds?: number[];
  accountIds?: number[];
  briefIds?: number[];
  contentTypes?: string[];
  aiDetectionOnly?: boolean;       // true = chỉ habitats.ai_content_detection=true
  ownership?: 'own' | 'external';  // filter theo habitats.is_own
  accountKind?: string;            // filter theo platform_accounts.account_kind (user|bot|app)
  minViews?: number | null;
  minScore?: number | null;
  minReplies?: number | null;
  q?: string;                      // search habitat/account/title/body
  sort?: PostedSortKey;
  limit?: number;
  offset?: number;
}

export interface AllPostedCard extends RecentPostedCard {
  briefRef: string | null;         // BRF-12 — gọn hơn briefId
  briefTitle: string | null;
  briefPhase: string | null;       // card.brief_phase — focus đúng phase khi mở modal
  squadKey: string | null;
  aiContentDetection: boolean;
  habitatIsOwn: boolean;           // 0077
  // Chi phí AI gen version cuối cùng (gen_cost_usd, USD). Null = chưa gen
  // bằng AI / manual writer / legacy.
  genCostUsd: number | null;
  // Thời gian gen AI version cuối (ms).
  genDurationMs: number | null;
}

export interface AllPostedResult {
  rows: AllPostedCard[];
  total: number;       // tổng match filter (cho pagination)
  facets: {
    lifecycleCounts: Record<string, number>;   // bao gồm null=>'_none'
    platformCounts: Record<string, number>;
    contentTypeCounts: Record<string, number>;
  };
}

const REMOVED_LIFECYCLES_SET = ['removed-by-mod', 'self-deleted'];

function buildPostedWhere(projectId: string, f: AllPostedFilters) {
  const conds: ReturnType<typeof sql>[] = [
    sql`c.project_id = ${projectId}`,
    sql`c.post_url IS NOT NULL`,
    sql`c.archived_at IS NULL`,
    sql`c.posted_at IS NOT NULL`,
  ];

  if (f.days != null && f.days > 0) {
    conds.push(sql`c.posted_at > NOW() - INTERVAL '${sql.raw(String(f.days))} days'`);
  }

  // Lifecycle filter:
  // - lifecycles set rõ → IN (...), include null nếu '_none' có trong list
  // - else hideRemoved (default true) → exclude removed-by-mod + self-deleted
  if (f.lifecycles && f.lifecycles.length > 0) {
    const concrete = f.lifecycles.filter((l) => l !== '_none');
    const includeNone = f.lifecycles.includes('_none');
    const parts: ReturnType<typeof sql>[] = [];
    if (concrete.length > 0) {
      parts.push(sql`c.post_lifecycle IN (${sql.join(concrete.map((l) => sql`${l}`), sql`, `)})`);
    }
    if (includeNone) parts.push(sql`c.post_lifecycle IS NULL`);
    if (parts.length > 0) {
      conds.push(sql`(${sql.join(parts, sql` OR `)})`);
    }
  } else if (f.hideRemoved !== false) {
    conds.push(sql`(c.post_lifecycle IS NULL OR c.post_lifecycle NOT IN (${sql.join(REMOVED_LIFECYCLES_SET.map((l) => sql`${l}`), sql`, `)}))`);
  }

  if (f.platformKeys && f.platformKeys.length > 0) {
    conds.push(sql`p.key IN (${sql.join(f.platformKeys.map((k) => sql`${k}`), sql`, `)})`);
  }
  if (f.habitatIds && f.habitatIds.length > 0) {
    conds.push(sql`b.habitat_id IN (${sql.join(f.habitatIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  if (f.accountIds && f.accountIds.length > 0) {
    conds.push(sql`b.account_id IN (${sql.join(f.accountIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  if (f.briefIds && f.briefIds.length > 0) {
    conds.push(sql`c.brief_id IN (${sql.join(f.briefIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  if (f.contentTypes && f.contentTypes.length > 0) {
    conds.push(sql`c.content_type IN (${sql.join(f.contentTypes.map((t) => sql`${t}`), sql`, `)})`);
  }
  if (f.aiDetectionOnly) {
    conds.push(sql`h.ai_content_detection = TRUE`);
  }
  if (f.ownership === 'own') {
    conds.push(sql`COALESCE(h.is_own, FALSE) = TRUE`);
  } else if (f.ownership === 'external') {
    conds.push(sql`COALESCE(h.is_own, FALSE) = FALSE`);
  }
  if (f.accountKind && f.accountKind.trim()) {
    conds.push(sql`COALESCE(pa.account_kind, 'user') = ${f.accountKind}`);
  }
  if (f.minViews != null) conds.push(sql`COALESCE(c.insights_views_count, 0) >= ${f.minViews}`);
  if (f.minScore != null) conds.push(sql`COALESCE(c.insights_score, 0) >= ${f.minScore}`);
  if (f.minReplies != null) conds.push(sql`COALESCE(c.insights_reply_count, 0) >= ${f.minReplies}`);

  // Search ILIKE qua nhiều cột — habitat name, account handle, card title/body.
  if (f.q && f.q.trim()) {
    const pattern = `%${f.q.trim()}%`;
    conds.push(sql`(
      h.name ILIKE ${pattern}
      OR pa.handle ILIKE ${pattern}
      OR c.title ILIKE ${pattern}
      OR c.body_target ILIKE ${pattern}
    )`);
  }

  return sql.join(conds, sql` AND `);
}

function orderByFor(sort: PostedSortKey | undefined) {
  switch (sort) {
    case 'posted_asc':   return sql`c.posted_at ASC`;
    case 'views_desc':   return sql`COALESCE(c.insights_views_count, 0) DESC, c.posted_at DESC`;
    case 'score_desc':   return sql`COALESCE(c.insights_score, 0) DESC, c.posted_at DESC`;
    case 'replies_desc': return sql`COALESCE(c.insights_reply_count, 0) DESC, c.posted_at DESC`;
    case 'ratio_desc':   return sql`COALESCE(c.insights_upvote_ratio, 0) DESC, c.posted_at DESC`;
    case 'cost_desc':    return sql`COALESCE(c.gen_cost_usd, 0) DESC, c.posted_at DESC`;
    case 'cost_asc':     return sql`COALESCE(c.gen_cost_usd, 0) ASC, c.posted_at DESC`;
    case 'duration_desc':return sql`COALESCE(c.gen_duration_ms, 0) DESC, c.posted_at DESC`;
    case 'duration_asc': return sql`COALESCE(c.gen_duration_ms, 0) ASC, c.posted_at DESC`;
    case 'posted_desc':
    default:             return sql`c.posted_at DESC`;
  }
}

export async function listAllPostedCards(
  projectId: string,
  filters: AllPostedFilters = {},
): Promise<AllPostedResult> {
  const db = ensureDb();
  const f: AllPostedFilters = {
    days: filters.days === null ? null : (filters.days ?? 7),
    lifecycles: filters.lifecycles,
    hideRemoved: filters.hideRemoved !== false,
    platformKeys: filters.platformKeys,
    habitatIds: filters.habitatIds,
    accountIds: filters.accountIds,
    briefIds: filters.briefIds,
    contentTypes: filters.contentTypes,
    aiDetectionOnly: filters.aiDetectionOnly,
    ownership: filters.ownership,
    accountKind: filters.accountKind,
    minViews: filters.minViews ?? null,
    minScore: filters.minScore ?? null,
    minReplies: filters.minReplies ?? null,
    q: filters.q,
    sort: filters.sort ?? 'posted_desc',
    limit: Math.min(filters.limit ?? 50, 200),
    offset: Math.max(filters.offset ?? 0, 0),
  };
  const where = buildPostedWhere(projectId, f);
  const order = orderByFor(f.sort);

  const rows = await db.execute(sql`
    SELECT c.id, c.card_ref, c.title, c.body_target, c.content_type, c.target_lang,
           c.post_url, c.posted_at, c.parent_url,
           c.post_lifecycle, c.squad_key, c.brief_phase,
           c.brief_id, c.channel_id, c.gen_cost_usd, c.gen_duration_ms,
           c.insights_views_count, c.insights_score, c.insights_upvote_ratio,
           c.insights_reply_count, c.insights_fetched_at,
           b.habitat_id, b.account_id, b.current_phase AS brief_phase_now,
           h.name AS habitat_name, COALESCE(h.ai_content_detection, FALSE) AS ai_detect,
           COALESCE(h.is_own, FALSE) AS habitat_is_own,
           p.label AS platform_label, p.key AS platform_key,
           pa.handle AS account_handle, pa.account_kind AS account_kind,
           hc.name AS channel_name,
           (SELECT COUNT(*) FROM cards c2
              WHERE c2.project_id = c.project_id
                AND c2.parent_url = c.parent_url
                AND c2.parent_url IS NOT NULL) AS parent_attempt_count
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${f.limit} OFFSET ${f.offset}
  `);

  const totalRows = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    WHERE ${where}
  `);
  const total = Number((totalRows as unknown as Array<{ n: number }>)[0]?.n ?? 0);

  // Facets: 3 query riêng cho lifecycle / platform / content_type
  // (TÔN TRỌNG cùng filter áp dụng — chip count match danh sách).
  const lcRows = await db.execute(sql`
    SELECT COALESCE(c.post_lifecycle, '_none') AS k, COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    WHERE ${where}
    GROUP BY 1
  `);
  const lcMap: Record<string, number> = {};
  for (const r of lcRows as unknown as Array<{ k: string; n: number }>) lcMap[r.k] = Number(r.n);

  const pkRows = await db.execute(sql`
    SELECT COALESCE(p.key, '_none') AS k, COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    WHERE ${where}
    GROUP BY 1
  `);
  const pkMap: Record<string, number> = {};
  for (const r of pkRows as unknown as Array<{ k: string; n: number }>) pkMap[r.k] = Number(r.n);

  const ctRows = await db.execute(sql`
    SELECT COALESCE(c.content_type, 'text') AS k, COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    WHERE ${where}
    GROUP BY 1
  `);
  const ctMap: Record<string, number> = {};
  for (const r of ctRows as unknown as Array<{ k: string; n: number }>) ctMap[r.k] = Number(r.n);

  const mapped: AllPostedCard[] = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    cardRef: String(r.card_ref ?? ''),
    title: String(r.title ?? ''),
    bodyTarget: String(r.body_target ?? '').slice(0, 200),
    contentType: String(r.content_type ?? 'text'),
    targetLang: String(r.target_lang ?? 'en'),
    postUrl: String(r.post_url ?? ''),
    postedAt: r.posted_at instanceof Date ? r.posted_at.toISOString() : String(r.posted_at),
    briefId: r.brief_id != null ? Number(r.brief_id) : null,
    briefRef: r.brief_id != null ? `BRF-${r.brief_id}` : null,
    briefTitle: r.brief_phase_now ? String(r.brief_phase_now) : null,
    squadKey: r.squad_key ? String(r.squad_key) : null,
    briefPhase: r.brief_phase ? String(r.brief_phase) : null,
    genCostUsd: r.gen_cost_usd != null ? Number(r.gen_cost_usd) : null,
    genDurationMs: r.gen_duration_ms != null ? Number(r.gen_duration_ms) : null,
    habitatId: r.habitat_id != null ? Number(r.habitat_id) : null,
    habitatName: String(r.habitat_name ?? ''),
    platformLabel: String(r.platform_label ?? ''),
    platformKey: r.platform_key ? String(r.platform_key) : null,
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    accountKind: String(r.account_kind ?? 'user'),
    aiContentDetection: Boolean(r.ai_detect),
    habitatIsOwn: Boolean(r.habitat_is_own),
    insightsViewsCount: r.insights_views_count != null ? Number(r.insights_views_count) : null,
    insightsScore: r.insights_score != null ? Number(r.insights_score) : null,
    insightsUpvoteRatio: r.insights_upvote_ratio != null ? Number(r.insights_upvote_ratio) : null,
    insightsReplyCount: r.insights_reply_count != null ? Number(r.insights_reply_count) : null,
    insightsFetchedAt: r.insights_fetched_at instanceof Date ? r.insights_fetched_at.toISOString() : (r.insights_fetched_at ? String(r.insights_fetched_at) : null),
    postLifecycle: r.post_lifecycle ? String(r.post_lifecycle) : null,
    channelName: r.channel_name ? String(r.channel_name) : null,
    parentAttemptCount: Number(r.parent_attempt_count ?? 1),
  }));

  return {
    rows: mapped,
    total,
    facets: { lifecycleCounts: lcMap, platformCounts: pkMap, contentTypeCounts: ctMap },
  };
}

// Options cho filter dropdown — load 1 lần khi mở tab.
export interface PostedFilterOptions {
  platforms: Array<{ key: string; label: string; count: number }>;
  habitats: Array<{ id: number; name: string; platformKey: string | null; aiDetection: boolean; count: number }>;
  accounts: Array<{ id: number; handle: string; platformKey: string | null; count: number }>;
  briefs: Array<{ id: number; ref: string; title: string; count: number }>;
  contentTypes: Array<{ key: string; count: number }>;
}

export async function getPostedFilterOptions(projectId: string): Promise<PostedFilterOptions> {
  const db = ensureDb();
  // Chỉ list options thực sự có card posted (giảm noise dropdown).
  const baseWhere = sql`
    c.project_id = ${projectId}
    AND c.post_url IS NOT NULL
    AND c.archived_at IS NULL
    AND c.posted_at IS NOT NULL
  `;

  const platforms = await db.execute(sql`
    SELECT p.key, p.label, COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    WHERE ${baseWhere} AND p.key IS NOT NULL
    GROUP BY p.key, p.label
    ORDER BY n DESC
  `);
  const habitats = await db.execute(sql`
    SELECT h.id, h.name, h.platform_key, COALESCE(h.ai_content_detection, FALSE) AS ai_detect,
           COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    WHERE ${baseWhere} AND h.id IS NOT NULL
    GROUP BY h.id, h.name, h.platform_key, h.ai_content_detection
    ORDER BY n DESC
  `);
  const accounts = await db.execute(sql`
    SELECT pa.id, pa.handle, pa.platform_key, COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE ${baseWhere} AND pa.id IS NOT NULL
    GROUP BY pa.id, pa.handle, pa.platform_key
    ORDER BY n DESC
  `);
  // Brief KHÔNG có card_ref/headline trong schema → dùng `BRF-{id}` + habitat.name
  // làm title gợi nhớ. Account handle để phân biệt brief same habitat khác account.
  const briefs = await db.execute(sql`
    SELECT b.id, h.name AS habitat_name, pa.handle AS account_handle, COUNT(*)::int AS n
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE ${baseWhere} AND b.id IS NOT NULL
    GROUP BY b.id, h.name, pa.handle
    ORDER BY n DESC
  `);
  const cts = await db.execute(sql`
    SELECT c.content_type AS k, COUNT(*)::int AS n
    FROM cards c
    WHERE ${baseWhere}
    GROUP BY c.content_type
    ORDER BY n DESC
  `);

  return {
    platforms: (platforms as unknown as Array<Record<string, unknown>>).map((r) => ({
      key: String(r.key), label: String(r.label ?? r.key), count: Number(r.n),
    })),
    habitats: (habitats as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), name: String(r.name ?? ''),
      platformKey: r.platform_key ? String(r.platform_key) : null,
      aiDetection: Boolean(r.ai_detect), count: Number(r.n),
    })),
    accounts: (accounts as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), handle: String(r.handle ?? ''),
      platformKey: r.platform_key ? String(r.platform_key) : null, count: Number(r.n),
    })),
    briefs: (briefs as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), ref: `BRF-${r.id}`,
      title: `${r.habitat_name ?? '(no habitat)'}${r.account_handle ? ` · @${r.account_handle}` : ''}`,
      count: Number(r.n),
    })),
    contentTypes: (cts as unknown as Array<Record<string, unknown>>).map((r) => ({
      key: String(r.k ?? 'text'), count: Number(r.n),
    })),
  };
}

// listCostVersions — trả các "version" gen AI cùng parent_url (sibling drafts)
// + duration + model + tổng cost. Mỗi lần regen ext = card mới với same
// parent_url → đây là gần với "version history" nhất có thể.
// Nếu card không có parent_url (post chính, không phải comment/reply) →
// chỉ trả 1 entry = chính nó.

export interface CostVersion {
  id: number;
  cardRef: string;
  costUsd: number | null;
  durationMs: number | null;
  modelUsed: string | null;
  answerSource: string | null;
  createdAt: string;
  isCurrent: boolean;       // true nếu là card đang được focus (id match)
  isPosted: boolean;        // có post_url
}

export interface CostBreakdown {
  versions: CostVersion[];
  totalCostUsd: number;
  totalDurationMs: number;
  versionCount: number;
}

export async function listCostVersions(
  cardId: number,
): Promise<CostBreakdown> {
  if (!Number.isFinite(cardId) || cardId <= 0) {
    return { versions: [], totalCostUsd: 0, totalDurationMs: 0, versionCount: 0 };
  }
  const db = ensureDb();

  const target = await db.execute(sql`
    SELECT parent_url, project_id FROM cards WHERE id = ${cardId} LIMIT 1
  `);
  const tr = (target as unknown as Array<Record<string, unknown>>)[0];
  if (!tr) return { versions: [], totalCostUsd: 0, totalDurationMs: 0, versionCount: 0 };

  const parentUrl = tr.parent_url ? String(tr.parent_url) : null;
  const projectId = String(tr.project_id);

  const rows = parentUrl
    ? await db.execute(sql`
        SELECT id, card_ref, gen_cost_usd, gen_duration_ms, gen_model_used,
               answer_source, post_url, created_at
        FROM cards
        WHERE project_id = ${projectId}
          AND parent_url = ${parentUrl}
          AND archived_at IS NULL
        ORDER BY created_at ASC
      `)
    : await db.execute(sql`
        SELECT id, card_ref, gen_cost_usd, gen_duration_ms, gen_model_used,
               answer_source, post_url, created_at
        FROM cards
        WHERE id = ${cardId}
        LIMIT 1
      `);

  const versions: CostVersion[] = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    cardRef: String(r.card_ref ?? ''),
    costUsd: r.gen_cost_usd != null ? Number(r.gen_cost_usd) : null,
    durationMs: r.gen_duration_ms != null ? Number(r.gen_duration_ms) : null,
    modelUsed: r.gen_model_used ? String(r.gen_model_used) : null,
    answerSource: r.answer_source ? String(r.answer_source) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    isCurrent: Number(r.id) === cardId,
    isPosted: !!r.post_url,
  }));

  const totalCostUsd = versions.reduce((s, v) => s + (v.costUsd ?? 0), 0);
  const totalDurationMs = versions.reduce((s, v) => s + (v.durationMs ?? 0), 0);

  return {
    versions,
    totalCostUsd,
    totalDurationMs,
    versionCount: versions.length,
  };
}

