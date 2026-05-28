'use server';

// Seeding cadence layer — recurring brand-awareness / periodic seeding
// per community brief (account × habitat). next_due is computed-on-read
// (no cron in v1). Semi-auto: generateDueDrafts() drops one prefilled
// draft card into backlog for each due schedule the user can then
// review/post and mark seeded.

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { Phase } from '@/lib/phase-plan';
import { PHASES } from '@/lib/phase-plan';
import { createPostForBriefPhase } from './brief-posts';
import { effectiveMix, pickFormatByRotation, formatMeta, postCompleteness } from '@/lib/content-formats';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const DAY = 86_400_000;

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

function parsePhase(v: unknown): Phase {
  const s = String(v ?? 'warm-up');
  return (PHASES as readonly string[]).includes(s) ? (s as Phase) : 'warm-up';
}
function parsePhaseArr(v: unknown): Phase[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((x): x is Phase => (PHASES as readonly string[]).includes(x));
}

// Bài "đủ data" = có NỘI DUNG thật (không chỉ scaffold/placeholder) +
// (nếu loại visual) có media gắn. Dùng chung cho pipeline + cockpit.
// postCompleteness / VISUAL_NEEDS_MEDIA / meaningfulLen đã chuyển sang
// content-formats.ts (client-safe) — import từ đó để brief modal cũng dùng
// được trong PostRow badge optimistic.

export type SeedingStatus = 'overdue' | 'due' | 'upcoming' | 'paused' | 'off-phase' | 'not-joined';

export interface TouchEntry { at: string; cardId: number | null; phase: string }

export interface SeedingQueueItem {
  scheduleId: number;
  briefId: number;
  accountId: number;
  accountHandle: string;
  accountStatus: string;            // platform_accounts.status (active/banned/blocked/…)
  accountBlockReason: string | null;
  platformLabel: string;
  platformKey: string;
  platformCategory: string;         // platforms.category — quyết định format hỗ trợ
  phaseFormatMix: Record<string, number> | null; // override mix của phase hiện tại (nếu có)
  laneType: string;                 // seeding_schedules.content_type ('mix' | loại cố định)
  laneLang: string;                 // seeding_schedules.language ('' = kế thừa habitat)
  habitatLang: string;              // habitat.language (để hiển thị lang hiệu lực khi lane='')
  habitatId: number;
  habitatName: string;
  habitatKind: string;
  habitatPlatformKey: string;       // habitats.platform_key ('' nếu chưa set)
  habitatUrl: string | null;
  habitatIsOwn: boolean;            // 0077: habitat own brand mình

  tribeName: string | null;
  tribeId: number | null;
  currentPhase: Phase;
  frequencyDays: number;
  activePhases: Phase[];
  paused: boolean;
  autoDraft: boolean;
  lastSeededAt: string | null;
  nextDueAt: string;
  status: SeedingStatus;
  daysUntilDue: number;          // negative = overdue by N days
  touches30d: number;
  lastTouchAt: string | null;
  adherencePct: number;          // 0..100, touches30d vs expected in 30d
  backlogCount: number;          // backlog cards for this brief × currentPhase
  completeCount: number;         // trong số đó, bài đã đủ data (nội dung + media)
  // Bài đã đăng thực sự (từ cards.posted_at) — phân biệt với touch_log
  // (cốt yếu khi card cũ đã có post_url mà chưa qua markSeeded).
  postedCount: number;           // tổng bài đã đăng trong brief
  postedCount30d: number;        // bài đăng trong 30d
  lastPostedAt: string | null;   // posted_at gần nhất
  // Aggregate metrics từ cards.insights_* (chỉ tính bài đã đăng + insights synced)
  totalViews: number;            // 0 nếu chưa có insight nào
  totalScore: number;
  totalReplies: number;
  insightSampleCount: number;    // bao nhiêu bài có insights — biết coverage
}

function statusOf(
  nextDueMs: number, frequencyDays: number, paused: boolean,
  currentPhase: Phase, activePhases: Phase[],
  joinStatus: string,
): SeedingStatus {
  // 0057: membership gate — chưa join thì không thể seed (đăng vào community
  // chưa join = bài lạc / spam → block ngay tầng status). Ưu tiên cao nhất.
  if (joinStatus !== 'joined') return 'not-joined';
  if (paused) return 'paused';
  if (activePhases.length > 0 && !activePhases.includes(currentPhase)) return 'off-phase';
  const now = Date.now();
  if (now >= nextDueMs + frequencyDays * DAY * 2) return 'overdue';
  if (now >= nextDueMs) return 'due';
  return 'upcoming';
}

// resolveLastSeededMs — nguồn truth của "lần đăng gần nhất":
//   1. cards.posted_at MAX (bài đăng thật, kể cả khi chưa markSeeded)
//   2. last_seeded_at (touch_log) — fallback cho lane chưa post nhưng đã chốt
//      nhịp thủ công (legacy)
//   3. created_at — không có signal nào, dùng để tính delay nextDueMs đầu tiên
// Trả MS để tính nextDueMs.
function resolveLastSeededMs(
  lastPostedAt: Date | null,
  lastSeededAt: Date | null,
  createdAt: Date,
): { lastMs: number; source: 'posted' | 'seeded' | 'created' } {
  const candidates: Array<{ ms: number; source: 'posted' | 'seeded' | 'created' }> = [];
  if (lastPostedAt) candidates.push({ ms: lastPostedAt.getTime(), source: 'posted' });
  if (lastSeededAt) candidates.push({ ms: lastSeededAt.getTime(), source: 'seeded' });
  candidates.push({ ms: createdAt.getTime(), source: 'created' });
  // Lấy max → reset overdue khi có bài posted mới nhất (kể cả posted < lastSeeded).
  candidates.sort((a, b) => b.ms - a.ms);
  const top = candidates[0]!;
  return { lastMs: top.ms, source: top.source };
}

export async function listSeedingQueue(projectId: string): Promise<SeedingQueueItem[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT
      ss.id AS schedule_id, ss.brief_id, ss.frequency_days, ss.active_phases,
      ss.paused, ss.auto_draft, ss.last_seeded_at, ss.touch_log, ss.created_at,
      ss.content_type AS lane_type, ss.language AS lane_lang,
      b.account_id, b.habitat_id, b.current_phase, b.join_status, h.language AS habitat_lang,
      pa.handle AS account_handle, pa.status AS account_status,
      pa.block_reason AS account_block_reason, p.label AS platform_label,
      pa.platform_key AS platform_key, p.category AS platform_category,
      h.name AS habitat_name, h.kind AS habitat_kind,
      h.platform_key AS habitat_platform_key, h.url AS habitat_url,
      COALESCE(h.is_own, false) AS habitat_is_own,
      t.name AS tribe_name, t.id AS tribe_id,
      (SELECT e->'formatMix' FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(b.phase_plan) = 'array' THEN b.phase_plan ELSE '[]'::jsonb END
       ) e WHERE e->>'phase' = b.current_phase LIMIT 1) AS phase_format_mix,
      (SELECT count(*)::int FROM cards c
         WHERE c.brief_id = b.id AND c.brief_phase = b.current_phase AND c.col = 'backlog'
           AND c.archived_at IS NULL) AS backlog_count,
      (SELECT count(*)::int FROM cards c
         WHERE c.brief_id = b.id AND c.brief_phase = b.current_phase AND c.col = 'backlog'
           AND c.archived_at IS NULL
           AND (
             CASE WHEN c.content_type IN ('image','carousel','story')
               -- visual: ảnh là chính → chỉ cần media, caption optional
               THEN c.media_asset_id IS NOT NULL
               -- text-first: cần nội dung thật (không phải scaffold/placeholder)
               ELSE char_length(btrim(coalesce(c.body_target,''))) > 80
                    AND left(btrim(coalesce(c.body_target,'')), 2) <> '_('
                    AND left(btrim(coalesce(c.body_target,'')), 1) <> '#'
             END
           )
        ) AS complete_count,
      -- Posted cards aggregate (cross-phase: brief đã có bài posted nào,
      -- không phụ thuộc currentPhase). Dùng để reset overdue + show metrics.
      (SELECT count(*)::int FROM cards c
         WHERE c.brief_id = b.id AND c.post_url IS NOT NULL
           AND c.posted_at IS NOT NULL AND c.archived_at IS NULL) AS posted_count,
      (SELECT count(*)::int FROM cards c
         WHERE c.brief_id = b.id AND c.post_url IS NOT NULL
           AND c.archived_at IS NULL
           AND c.posted_at > NOW() - INTERVAL '30 days') AS posted_count_30d,
      (SELECT max(c.posted_at) FROM cards c
         WHERE c.brief_id = b.id AND c.post_url IS NOT NULL
           AND c.archived_at IS NULL) AS last_posted_at,
      (SELECT coalesce(sum(c.insights_views_count), 0)::bigint FROM cards c
         WHERE c.brief_id = b.id AND c.archived_at IS NULL
           AND c.insights_fetched_at IS NOT NULL) AS total_views,
      (SELECT coalesce(sum(c.insights_score), 0)::bigint FROM cards c
         WHERE c.brief_id = b.id AND c.archived_at IS NULL
           AND c.insights_fetched_at IS NOT NULL) AS total_score,
      (SELECT coalesce(sum(c.insights_reply_count), 0)::bigint FROM cards c
         WHERE c.brief_id = b.id AND c.archived_at IS NULL
           AND c.insights_fetched_at IS NOT NULL) AS total_replies,
      (SELECT count(*)::int FROM cards c
         WHERE c.brief_id = b.id AND c.archived_at IS NULL
           AND c.insights_fetched_at IS NOT NULL) AS insight_sample_count
    FROM seeding_schedules ss
    JOIN community_briefs b ON b.id = ss.brief_id
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN platforms p ON p.key = pa.platform_key
    JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN tribes t ON t.id = h.tribe_id
    WHERE ss.tenant_id = ${TENANT} AND ss.project_id = ${projectId}
  `);
  const now = Date.now();
  const list = (rows as unknown as Array<Record<string, unknown>>).map((r) => {
    const freq = Math.max(1, Number(r.frequency_days ?? 3));
    const lastSeeded = r.last_seeded_at ? new Date(String(r.last_seeded_at)) : null;
    const lastPosted = r.last_posted_at ? new Date(String(r.last_posted_at)) : null;
    const createdAt = new Date(String(r.created_at));
    // Resolve "lần đăng gần nhất" — ưu tiên cards.posted_at thật để brief
    // đã có bài đăng KHÔNG bị quá hạn dù chưa qua markSeeded thủ công.
    const { lastMs } = resolveLastSeededMs(lastPosted, lastSeeded, createdAt);
    const nextDueMs = lastMs + freq * DAY;
    const currentPhase = parsePhase(r.current_phase);
    const activePhases = parsePhaseArr(r.active_phases);
    const paused = Boolean(r.paused);
    const log: TouchEntry[] = Array.isArray(r.touch_log) ? (r.touch_log as TouchEntry[]) : [];
    const touches30d = log.filter((e) => e.at && now - new Date(e.at).getTime() <= 30 * DAY).length;
    const lastTouch = log.length ? log[log.length - 1]!.at : null;
    const expected30 = Math.max(1, Math.round(30 / freq));
    const adherencePct = Math.min(100, Math.round((touches30d / expected30) * 100));
    return {
      scheduleId: Number(r.schedule_id),
      briefId: Number(r.brief_id),
      accountId: Number(r.account_id),
      accountHandle: r.account_handle ? String(r.account_handle) : 'no-handle',
      accountStatus: String(r.account_status ?? 'active'),
      accountBlockReason: r.account_block_reason ? String(r.account_block_reason) : null,
      platformLabel: String(r.platform_label ?? ''),
      platformKey: String(r.platform_key ?? ''),
      platformCategory: String(r.platform_category ?? 'other'),
      phaseFormatMix: (r.phase_format_mix && typeof r.phase_format_mix === 'object' && !Array.isArray(r.phase_format_mix))
        ? (r.phase_format_mix as Record<string, number>) : null,
      laneType: String(r.lane_type ?? 'mix'),
      laneLang: String(r.lane_lang ?? ''),
      habitatLang: String(r.habitat_lang ?? '') || 'en',
      habitatId: Number(r.habitat_id),
      habitatName: String(r.habitat_name ?? `Habitat #${r.habitat_id}`),
      habitatKind: String(r.habitat_kind ?? 'forum'),
      habitatPlatformKey: String(r.habitat_platform_key ?? ''),
      habitatUrl: r.habitat_url ? String(r.habitat_url) : null,
      habitatIsOwn: Boolean(r.habitat_is_own),
      tribeName: r.tribe_name ? String(r.tribe_name) : null,
      tribeId: r.tribe_id != null ? Number(r.tribe_id) : null,
      currentPhase,
      frequencyDays: freq,
      activePhases,
      paused,
      autoDraft: Boolean(r.auto_draft),
      lastSeededAt: lastSeeded ? lastSeeded.toISOString() : null,
      nextDueAt: new Date(nextDueMs).toISOString(),
      status: statusOf(nextDueMs, freq, paused, currentPhase, activePhases, String(r.join_status ?? 'joined')),
      daysUntilDue: Math.round((nextDueMs - now) / DAY),
      touches30d,
      lastTouchAt: lastTouch,
      adherencePct,
      backlogCount: Number(r.backlog_count ?? 0),
      completeCount: Number(r.complete_count ?? 0),
      postedCount: Number(r.posted_count ?? 0),
      postedCount30d: Number(r.posted_count_30d ?? 0),
      lastPostedAt: lastPosted ? lastPosted.toISOString() : null,
      totalViews: Number(r.total_views ?? 0),
      totalScore: Number(r.total_score ?? 0),
      totalReplies: Number(r.total_replies ?? 0),
      insightSampleCount: Number(r.insight_sample_count ?? 0),
    } as SeedingQueueItem;
  });
  // Order: overdue → due → upcoming → off-phase → paused; then soonest due.
  // 'not-joined' xếp sau cùng vì là gating issue cần khắc phục trước,
  // không phải workflow item — hiện ở cuối queue, có badge riêng trên UI.
  const rank: Record<SeedingStatus, number> = { overdue: 0, due: 1, upcoming: 2, 'off-phase': 3, paused: 4, 'not-joined': 5 };
  return list.sort((a, b) =>
    rank[a.status] - rank[b.status] || a.daysUntilDue - b.daysUntilDue);
}

// Create-or-update 1 LANE của brief. Lane key = (brief, content_type,
// language). Bỏ trống type/lang → lane mặc định ('mix','') tương thích
// "+ lịch" cũ. Truyền scheduleId để sửa đúng 1 lane (đổi cả freq, không
// đụng type/lang/cadence).
export async function upsertSchedule(
  projectId: string, briefId: number,
  patch: {
    scheduleId?: number;
    contentType?: string; language?: string;
    frequencyDays?: number; activePhases?: Phase[]; paused?: boolean; autoDraft?: boolean;
  },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = ensureDb();
  const chk = await db.execute(sql`
    SELECT 1 FROM community_briefs WHERE id = ${briefId} AND project_id = ${projectId}
  `);
  if ((chk as unknown as Array<unknown>).length === 0) return { ok: false, error: 'brief not in project' };
  const freq = patch.frequencyDays != null ? Math.max(1, Math.round(patch.frequencyDays)) : 3;
  const phases = JSON.stringify(patch.activePhases ?? []);
  const paused = patch.paused ?? false;
  const autoDraft = patch.autoDraft ?? true;
  const ct = (patch.contentType ?? 'mix').trim() || 'mix';
  const lang = (patch.language ?? '').trim();

  // Sửa đúng 1 lane theo scheduleId (giữ nguyên type/lang của lane đó).
  if (patch.scheduleId != null) {
    const res = await db.execute(sql`
      UPDATE seeding_schedules SET
        frequency_days = ${freq},
        active_phases  = ${phases}::jsonb,
        paused         = ${paused},
        auto_draft     = ${autoDraft},
        updated_at     = now()
      WHERE id = ${patch.scheduleId} AND project_id = ${projectId} AND brief_id = ${briefId}
      RETURNING id
    `);
    const id = Number((res as unknown as Array<{ id: number }>)[0]?.id);
    if (!id) return { ok: false, error: 'lane not found' };
    revalidatePath(`/p/${projectId}/seeding`);
    revalidatePath(`/p/${projectId}/tribes`);
    return { ok: true, id };
  }

  const res = await db.execute(sql`
    INSERT INTO seeding_schedules
      (tenant_id, project_id, brief_id, content_type, language, frequency_days, active_phases, paused, auto_draft)
    VALUES (${TENANT}, ${projectId}, ${briefId}, ${ct}, ${lang}, ${freq}, ${phases}::jsonb, ${paused}, ${autoDraft})
    ON CONFLICT (brief_id, content_type, language) DO UPDATE SET
      frequency_days = EXCLUDED.frequency_days,
      active_phases  = EXCLUDED.active_phases,
      paused         = EXCLUDED.paused,
      auto_draft     = EXCLUDED.auto_draft,
      updated_at     = now()
    RETURNING id
  `);
  const id = Number((res as unknown as Array<{ id: number }>)[0]?.id);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, id };
}

export interface LaneRow {
  scheduleId: number;
  contentType: string;
  language: string;
  frequencyDays: number;
  activePhases: Phase[];
  paused: boolean;
  autoDraft: boolean;
  lastSeededAt: string | null;
  touches: number;
}
export interface BriefLanesView {
  briefId: number;
  accountHandle: string;
  habitatName: string;
  habitatLang: string;
  currentPhase: Phase;
  platformKey: string;
  platformCategory: string;
  lanes: LaneRow[];
  suggested: { frequencyDays: number; activePhases: Phase[] };
}

// Tất cả lane của 1 brief + context để modal thao tác đầy đủ.
export async function listBriefLanes(
  projectId: string, briefId: number,
): Promise<{ ok: boolean; view?: BriefLanesView; error?: string }> {
  const db = ensureDb();
  const ctxRows = await db.execute(sql`
    SELECT b.current_phase, pa.handle AS account_handle, pa.platform_key,
           p.category AS platform_category, h.name AS habitat_name,
           h.language AS habitat_lang
    FROM community_briefs b
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN platforms p ON p.key = pa.platform_key
    JOIN habitats h ON h.id = b.habitat_id
    WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const c = (ctxRows as unknown as Array<Record<string, unknown>>)[0];
  if (!c) return { ok: false, error: 'brief not in project' };
  const laneRows = await db.execute(sql`
    SELECT id, content_type, language, frequency_days, active_phases,
           paused, auto_draft, last_seeded_at, touch_log
    FROM seeding_schedules
    WHERE project_id = ${projectId} AND brief_id = ${briefId}
    ORDER BY content_type, language
  `);
  const lanes: LaneRow[] = (laneRows as unknown as Array<Record<string, unknown>>).map((r) => ({
    scheduleId: Number(r.id),
    contentType: String(r.content_type ?? 'mix'),
    language: String(r.language ?? ''),
    frequencyDays: Math.max(1, Number(r.frequency_days ?? 3)),
    activePhases: parsePhaseArr(r.active_phases),
    paused: Boolean(r.paused),
    autoDraft: r.auto_draft == null ? true : Boolean(r.auto_draft),
    lastSeededAt: r.last_seeded_at ? new Date(String(r.last_seeded_at)).toISOString() : null,
    touches: Array.isArray(r.touch_log) ? (r.touch_log as unknown[]).length : 0,
  }));
  const sug = await suggestScheduleDefaults(briefId);
  return {
    ok: true,
    view: {
      briefId,
      accountHandle: c.account_handle ? String(c.account_handle) : 'no-handle',
      habitatName: String(c.habitat_name ?? ''),
      habitatLang: (c.habitat_lang ? String(c.habitat_lang) : '') || 'en',
      currentPhase: parsePhase(c.current_phase),
      platformKey: String(c.platform_key ?? ''),
      platformCategory: String(c.platform_category ?? 'other'),
      lanes,
      suggested: sug,
    },
  };
}

// ── Pipeline bài cho 1 brief (account×habitat của 1 dòng) ────────
// 3 nhóm: Cần chuẩn bị (nháp backlog chưa sẵn sàng) / Sẽ đăng (đã sẵn
// sàng, chưa seed) / Đã đăng (có trong touch_log của lane, kèm ngày).
export interface PipelineCard {
  id: number;
  cardRef: string;
  title: string;
  col: string;
  contentType: string;
  targetLang: string;
  phase: string;
  dispatchReady: boolean;
  complete: boolean;           // đã đủ data (nội dung + media nếu visual)
  missing: string[];           // thiếu gì: ['nội dung','ảnh']
  createdAt: string;
  updatedAt: string;
}
export interface PostedEntry {
  at: string;
  phase: string;
  cardId: number | null;
  cardRef: string | null;
  title: string | null;
  contentType: string | null;
  deleted: boolean;            // card đã bị xoá nhưng touch_log còn ghi
}
export interface BriefPipeline {
  briefId: number;
  accountHandle: string;
  habitatName: string;
  prep: PipelineCard[];
  upcoming: PipelineCard[];
  posted: PostedEntry[];
}

export async function listBriefPipeline(
  projectId: string, briefId: number,
): Promise<{ ok: boolean; pipeline?: BriefPipeline; error?: string }> {
  const db = ensureDb();
  const ctx = await db.execute(sql`
    SELECT pa.handle AS account_handle, h.name AS habitat_name
    FROM community_briefs b
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN habitats h ON h.id = b.habitat_id
    WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const c = (ctx as unknown as Array<Record<string, unknown>>)[0];
  if (!c) return { ok: false, error: 'brief not in project' };

  const cardRows = await db.execute(sql`
    SELECT id, card_ref, title, col, content_type, target_lang,
           brief_phase, dispatch_ready, body_target, media_asset_id, parent_url,
           created_at, updated_at
    FROM cards
    WHERE project_id = ${projectId} AND brief_id = ${briefId} AND archived_at IS NULL
    ORDER BY updated_at DESC
  `);
  const cards = (cardRows as unknown as Array<Record<string, unknown>>);
  const cardById = new Map<number, Record<string, unknown>>();
  for (const r of cards) cardById.set(Number(r.id), r);

  // touch_log union qua mọi lane của brief
  const touchRows = await db.execute(sql`
    SELECT (e->>'at') AS at, (e->>'phase') AS phase, (e->>'cardId') AS card_id
    FROM seeding_schedules ss, jsonb_array_elements(
      CASE WHEN jsonb_typeof(ss.touch_log)='array' THEN ss.touch_log ELSE '[]'::jsonb END
    ) e
    WHERE ss.project_id = ${projectId} AND ss.brief_id = ${briefId}
  `);
  const touches = (touchRows as unknown as Array<Record<string, unknown>>);
  const postedCardIds = new Set<number>();
  for (const t of touches) {
    const cid = t.card_id != null && String(t.card_id) !== '' ? Number(t.card_id) : null;
    if (cid != null) postedCardIds.add(cid);
  }

  const mkCard = (r: Record<string, unknown>): PipelineCard => {
    const ct = String(r.content_type ?? 'text');
    const mid = r.media_asset_id != null ? Number(r.media_asset_id) : null;
    const cmp = postCompleteness(ct, String(r.body_target ?? ''), mid, r.parent_url ? String(r.parent_url) : null);
    return {
      id: Number(r.id),
      cardRef: String(r.card_ref ?? ''),
      title: String(r.title ?? ''),
      col: String(r.col ?? 'backlog'),
      contentType: ct,
      targetLang: String(r.target_lang ?? 'en'),
      phase: String(r.brief_phase ?? ''),
      dispatchReady: Boolean(r.dispatch_ready),
      complete: cmp.complete,
      missing: cmp.missing,
      createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    };
  };

  const prep: PipelineCard[] = [];
  const upcoming: PipelineCard[] = [];
  for (const r of cards) {
    const id = Number(r.id);
    if (postedCardIds.has(id)) continue; // đã đăng → nhóm posted
    const ready = Boolean(r.dispatch_ready) || String(r.col ?? 'backlog') !== 'backlog';
    (ready ? upcoming : prep).push(mkCard(r));
  }

  const posted: PostedEntry[] = touches
    .map((t) => {
      const cid = t.card_id != null && String(t.card_id) !== '' ? Number(t.card_id) : null;
      const cr = cid != null ? cardById.get(cid) : undefined;
      return {
        at: t.at ? new Date(String(t.at)).toISOString() : '',
        phase: String(t.phase ?? ''),
        cardId: cid,
        cardRef: cr ? String(cr.card_ref ?? '') : null,
        title: cr ? String(cr.title ?? '') : null,
        contentType: cr ? String(cr.content_type ?? 'text') : null,
        deleted: cid != null && !cr,
      };
    })
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  return {
    ok: true,
    pipeline: {
      briefId,
      accountHandle: c.account_handle ? String(c.account_handle) : 'no-handle',
      habitatName: String(c.habitat_name ?? ''),
      prep,
      upcoming,
      posted,
    },
  };
}

export interface ScheduleDetail {
  exists: boolean;
  scheduleId: number | null;
  briefId: number;
  frequencyDays: number;
  activePhases: Phase[];
  paused: boolean;
  autoDraft: boolean;
  currentPhase: Phase;
  accountHandle: string;
  habitatName: string;
  lastSeededAt: string | null;
}

// Load the schedule for a brief (with brief/account/habitat context). If
// no schedule exists yet, returns deterministic suggested defaults so the
// modal can pre-fill a sensible first schedule.
export async function getScheduleForBrief(
  projectId: string, briefId: number,
): Promise<{ ok: boolean; detail?: ScheduleDetail; error?: string }> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT ss.id AS schedule_id, ss.frequency_days, ss.active_phases, ss.paused,
           ss.auto_draft, ss.last_seeded_at,
           b.current_phase, pa.handle AS account_handle, h.name AS habitat_name
    FROM community_briefs b
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN seeding_schedules ss ON ss.brief_id = b.id
    WHERE b.id = ${briefId} AND b.project_id = ${projectId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'brief not in project' };
  const exists = r.schedule_id != null;
  let frequencyDays = 3;
  let activePhases: Phase[] = [];
  if (exists) {
    frequencyDays = Math.max(1, Number(r.frequency_days ?? 3));
    activePhases = parsePhaseArr(r.active_phases);
  } else {
    const sug = await suggestScheduleDefaults(briefId);
    frequencyDays = sug.frequencyDays;
    activePhases = sug.activePhases;
  }
  return {
    ok: true,
    detail: {
      exists,
      scheduleId: exists ? Number(r.schedule_id) : null,
      briefId,
      frequencyDays,
      activePhases,
      paused: Boolean(r.paused),
      autoDraft: r.auto_draft == null ? true : Boolean(r.auto_draft),
      currentPhase: parsePhase(r.current_phase),
      accountHandle: r.account_handle ? String(r.account_handle) : 'no-handle',
      habitatName: String(r.habitat_name ?? ''),
      lastSeededAt: r.last_seeded_at ? new Date(String(r.last_seeded_at)).toISOString() : null,
    },
  };
}

export async function deleteSchedule(
  projectId: string, scheduleId: number,
): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.execute(sql`
    DELETE FROM seeding_schedules WHERE id = ${scheduleId} AND project_id = ${projectId}
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

// Record a seed touch: append to touch_log + bump last_seeded_at so the
// schedule rolls forward.
// Điều kiện để được "chốt nhịp" 1 brief: account dùng được + đúng nền
// tảng + có ÍT NHẤT 1 bài đã duyệt (rời cột Ý tưởng hoặc dispatch_ready).
// blockers = chặn cứng; warnings = vẫn cho nhưng cảnh báo.
export interface SeedGuard { blockers: string[]; warnings: string[] }
async function seedGuard(
  projectId: string, briefId: number, requireApprovedCardId?: number,
): Promise<SeedGuard> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT pa.status AS acct_status, pa.platform_key AS acct_pf, pa.handle,
           h.kind AS hkind, h.platform_key AS hpf, h.min_account_age_days AS min_age,
           (SELECT count(*)::int FROM cards c
              WHERE c.brief_id = b.id AND c.archived_at IS NULL
                AND (c.col <> 'backlog' OR c.dispatch_ready = true)) AS approved_cnt
    FROM community_briefs b
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN habitats h ON h.id = b.habitat_id
    WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!r) return { blockers: ['brief not found'], warnings };

  const st = String(r.acct_status ?? 'todo');
  if (st === 'todo' || st === 'creating') blockers.push(`account chưa sẵn sàng (status ${st.toUpperCase()}) — chưa thể đã seed`);
  if (st === 'blocked' || st === 'banned') blockers.push(`account đã ngưng (${st.toUpperCase()})`);
  if (st === 'warming') warnings.push('account đang WARMING — chỉ seed nhẹ, tránh link/CTA');
  if (st === 'limited') warnings.push('account LIMITED — seed thận trọng');

  // sai nền tảng
  const acctPf = String(r.acct_pf ?? '');
  const hpf = String(r.hpf ?? '');
  const hkind = String(r.hkind ?? '');
  const km: Record<string, string> = { subreddit: 'reddit', 'discord-server': 'discord', discord: 'discord', 'fb-group': 'facebook', telegram: 'telegram', youtube: 'youtube' };
  const expected = hpf || km[hkind] || '';
  if (expected && acctPf && expected !== acctPf) {
    blockers.push(`account "${acctPf}" sai nền tảng (kênh cần ${expected}) — dùng "tự fix"`);
  } else if (!expected && acctPf && ['forum', 'cafe', 'hashtag', 'hashtag-community', 'other'].includes(hkind)) {
    warnings.push(`kênh ngoài (${hkind}) — đảm bảo "${acctPf}" thật sự đăng được ở đây`);
  }

  const approved = Number(r.approved_cnt ?? 0);
  if (approved === 0) blockers.push('chưa có bài nào đã duyệt (rời cột Ý tưởng hoặc dispatch-ready) — không có gì để seed');

  const minAge = Number(r.min_age ?? 0);
  if (minAge > 0) warnings.push(`habitat yêu cầu account ≥ ${minAge} ngày tuổi — tự kiểm tra (hệ thống không verify tuổi thật)`);

  if (requireApprovedCardId != null) {
    const cr = await db.execute(sql`
      SELECT col, dispatch_ready FROM cards
      WHERE id = ${requireApprovedCardId} AND project_id = ${projectId} AND brief_id = ${briefId} LIMIT 1
    `);
    const c = (cr as unknown as Array<Record<string, unknown>>)[0];
    if (!c) blockers.push('card không thuộc brief');
    else if (String(c.col) === 'backlog' && !c.dispatch_ready)
      blockers.push('bài này chưa duyệt (còn ở cột Ý tưởng & chưa dispatch-ready) — duyệt/đẩy ready trước khi đánh dấu đã đăng');
  }
  return { blockers, warnings };
}

// Brief id của 1 lane (cho guard từ scheduleId).
async function briefIdOfSchedule(projectId: string, scheduleId: number): Promise<number | null> {
  const db = ensureDb();
  const r = await db.execute(sql`
    SELECT brief_id FROM seeding_schedules WHERE id = ${scheduleId} AND project_id = ${projectId} LIMIT 1
  `);
  const row = (r as unknown as Array<{ brief_id: number }>)[0];
  return row ? Number(row.brief_id) : null;
}

export async function markSeeded(
  projectId: string, scheduleId: number,
  cardId: number | null, phase: string,
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const db = ensureDb();
  const bid = await briefIdOfSchedule(projectId, scheduleId);
  if (bid == null) return { ok: false, error: 'schedule not found' };
  const g = await seedGuard(projectId, bid, cardId ?? undefined);
  if (g.blockers.length > 0) {
    return { ok: false, error: `Không thể chốt nhịp: ${g.blockers.join('; ')}` };
  }
  const entry: TouchEntry = { at: new Date().toISOString(), cardId, phase };
  const res = await db.execute(sql`
    UPDATE seeding_schedules
    SET last_seeded_at = now(),
        touch_log = touch_log || ${JSON.stringify([entry])}::jsonb,
        updated_at = now()
    WHERE id = ${scheduleId} AND project_id = ${projectId}
    RETURNING id
  `);
  if ((res as unknown as Array<unknown>).length === 0) return { ok: false, error: 'schedule not found' };
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, warnings: g.warnings };
}

// Hoàn tác lần chốt nhịp gần nhất của 1 lane (gỡ touch cuối + tính lại
// last_seeded_at theo touch trước đó). Cho trường hợp bấm nhầm.
export async function undoLastSeed(
  projectId: string, scheduleId: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT touch_log FROM seeding_schedules
    WHERE id = ${scheduleId} AND project_id = ${projectId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'schedule not found' };
  const log: TouchEntry[] = Array.isArray(r.touch_log) ? (r.touch_log as TouchEntry[]) : [];
  if (log.length === 0) return { ok: false, error: 'chưa có lần chốt nào để hoàn tác' };
  const next = log.slice(0, -1);
  const prevAt = next.length ? next[next.length - 1]!.at : null;
  await db.execute(sql`
    UPDATE seeding_schedules
    SET touch_log = ${JSON.stringify(next)}::jsonb,
        last_seeded_at = ${prevAt ? sql`${prevAt}::timestamptz` : sql`NULL`},
        updated_at = now()
    WHERE id = ${scheduleId} AND project_id = ${projectId}
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

// Đánh dấu 1 CARD cụ thể đã đăng (từ Pipeline). Tự chọn đúng lane khớp
// content_type + language của card (fallback: cùng type / lane mix / lane
// bất kỳ của brief), ghi touch_log có cardId → Pipeline xếp card sang
// "Đã đăng" + dời nhịp lane đó. Có truy vết bài thật.
export async function markCardSeeded(
  projectId: string, briefId: number, cardId: number,
): Promise<{ ok: boolean; laneType?: string; error?: string; warnings?: string[] }> {
  const db = ensureDb();
  const g = await seedGuard(projectId, briefId, cardId);
  if (g.blockers.length > 0) {
    return { ok: false, error: `Không thể đánh dấu đã đăng: ${g.blockers.join('; ')}` };
  }
  const cardRows = await db.execute(sql`
    SELECT content_type, target_lang, brief_phase
    FROM cards WHERE id = ${cardId} AND project_id = ${projectId} AND brief_id = ${briefId} LIMIT 1
  `);
  const c = (cardRows as unknown as Array<Record<string, unknown>>)[0];
  if (!c) return { ok: false, error: 'card not in brief' };
  const ct = String(c.content_type ?? 'text');
  const lang = String(c.target_lang ?? '');
  const phase = String(c.brief_phase ?? '');

  const laneRows = await db.execute(sql`
    SELECT id, content_type, language FROM seeding_schedules
    WHERE project_id = ${projectId} AND brief_id = ${briefId}
  `);
  const lanes = (laneRows as unknown as Array<{ id: number; content_type: string; language: string }>);
  if (lanes.length === 0) return { ok: false, error: 'brief chưa có lane seeding — tạo lane (⚙) trước' };
  const pick =
    lanes.find((l) => l.content_type === ct && l.language === lang) ||
    lanes.find((l) => l.content_type === ct && (l.language ?? '') === '') ||
    lanes.find((l) => l.content_type === 'mix') ||
    lanes[0]!;

  const entry: TouchEntry = { at: new Date().toISOString(), cardId, phase };
  await db.execute(sql`
    UPDATE seeding_schedules
    SET last_seeded_at = now(),
        touch_log = touch_log || ${JSON.stringify([entry])}::jsonb,
        updated_at = now()
    WHERE id = ${pick.id} AND project_id = ${projectId}
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/board`);
  return { ok: true, laneType: pick.content_type, warnings: g.warnings };
}

// Wrap markCardSeeded với metadata "đã đăng" (post URL, screenshot, note,
// timestamp). User flow: bấm "🚀 Đăng bài" → copy + mở community → đăng tay
// → quay lại → modal confirm với 4 field (url required, others optional) →
// gọi action này → card có đủ data để monitor reply (qua URL) + audit trail
// (screenshot/note) + đánh dấu seeded (cadence tracking).
export async function confirmCardPosted(
  projectId: string,
  briefId: number,
  cardId: number,
  payload: {
    postUrl: string;
    postedAt?: string;               // ISO timestamp; default now()
    postScreenshotUrl?: string | null;
    postNote?: string | null;
  },
): Promise<{ ok: boolean; laneType?: string; warnings?: string[]; error?: string }> {
  const db = ensureDb();
  // Validate URL — tránh user paste rác. URL platform thường http(s).
  const url = payload.postUrl.trim();
  if (!url) return { ok: false, error: 'URL bài đã đăng là bắt buộc' };
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'URL không hợp lệ (cần bắt đầu http:// hoặc https://)' };

  const postedAt = payload.postedAt ? new Date(payload.postedAt) : new Date();
  if (isNaN(postedAt.getTime())) return { ok: false, error: 'Thời gian đăng không hợp lệ' };

  // 0057 GATE: account phải active. join_status có thể là 'not_joined'
  // nhưng user vẫn post được (vd r/Astrology_Vedic không yêu cầu approval) —
  // chính việc post thành công = bằng chứng đã join. Auto-upgrade
  // join_status='joined' khi mark-posted thay vì block.
  const readyCheck = await db.execute(sql`
    SELECT b.join_status, pa.status AS account_status
      FROM community_briefs b
      JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const rc = (readyCheck as unknown as Array<{ join_status: string; account_status: string }>)[0];
  if (!rc) return { ok: false, error: 'Brief không tồn tại trong project' };
  // Chỉ block khi account dead (banned/suspended). Membership-level block bỏ
  // qua — user post được = đã trong community thật, MOS2 join_status stale.
  if (rc.account_status !== 'active' && rc.account_status !== 'warming') {
    return {
      ok: false,
      error: `❌ Account đang ở trạng thái '${rc.account_status}', không post được. Mở account modal đổi sang active.`,
    };
  }
  // Auto-upgrade join_status nếu chưa joined (vì user đã post thành công).
  const wasNotJoined = rc.join_status !== 'joined';
  if (wasNotJoined) {
    await db.execute(sql`
      UPDATE community_briefs SET join_status = 'joined', updated_at = now()
       WHERE id = ${briefId} AND project_id = ${projectId}
    `);
  }

  // 1. Update card với metadata đã đăng
  await db.execute(sql`
    UPDATE cards SET
      post_url = ${url},
      posted_at = ${postedAt.toISOString()},
      post_screenshot_url = ${payload.postScreenshotUrl ?? null},
      post_note = ${payload.postNote ?? null},
      updated_at = now()
    WHERE id = ${cardId} AND project_id = ${projectId}
  `);

  // 2. Trigger seeding cadence tracking (touch_log + last_seeded_at)
  const seedRes = await markCardSeeded(projectId, briefId, cardId);
  if (!seedRes.ok) {
    // Card đã update field xong, nhưng cadence tracking fail — vẫn coi ok.
    // Reply monitor cron sẽ pull bài qua post_url, không phụ thuộc seeding lane.
    return { ok: true, warnings: [`Cadence tracking warning: ${seedRes.error}`] };
  }
  return { ok: true, laneType: seedRes.laneType, warnings: seedRes.warnings };
}

// Unpost: xoá metadata đã đăng (khi user lỡ bấm). KHÔNG xoá touch_log
// (audit trail giữ nguyên).
export async function unconfirmCardPosted(
  projectId: string, cardId: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.execute(sql`
    UPDATE cards SET
      post_url = NULL, posted_at = NULL,
      post_screenshot_url = NULL, post_note = NULL,
      updated_at = now()
    WHERE id = ${cardId} AND project_id = ${projectId}
  `);
  return { ok: true };
}

// Deterministic suggestion from the brief's phase plan (no LLM): parse
// PhaseEntry.cadence text → frequency_days; active_phases = phases with
// estimatedPosts > 0 (fallback value+seed).
export async function suggestScheduleDefaults(
  briefId: number,
): Promise<{ frequencyDays: number; activePhases: Phase[] }> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT current_phase, phase_plan FROM community_briefs WHERE id = ${briefId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  const fallback = { frequencyDays: 3, activePhases: ['value', 'seed'] as Phase[] };
  if (!r) return fallback;
  const plan = Array.isArray(r.phase_plan) ? (r.phase_plan as Array<Record<string, unknown>>) : [];
  const cur = parsePhase(r.current_phase);
  const curEntry = plan.find((p) => p.phase === cur) ?? plan[0];
  const cadence = String(curEntry?.cadence ?? '');
  const activePhases = plan
    .filter((p) => Number(p.estimatedPosts ?? 0) > 0)
    .map((p) => p.phase)
    .filter((x): x is Phase => (PHASES as readonly string[]).includes(String(x)));

  // Parse "N <unit>/day|week|month" → days between posts.
  let freq = 3;
  const m = cadence.toLowerCase().match(/(\d+(?:\.\d+)?)\s*[a-zà-ỹ\s]*\/\s*(\d+\s*)?(day|week|month|ngày|tuần|tháng)/);
  if (m) {
    const qty = Math.max(0.5, parseFloat(m[1]!));
    const per = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
    const unitDays = /week|tuần/.test(m[3]!) ? 7 : /month|tháng/.test(m[3]!) ? 30 : 1;
    freq = Math.max(1, Math.round((unitDays * per) / qty));
  }
  return {
    frequencyDays: Math.min(60, freq),
    activePhases: activePhases.length ? [...new Set(activePhases)] : fallback.activePhases,
  };
}

// Semi-auto: for every due/overdue, in-phase, auto_draft schedule that
// has NO backlog card yet for brief × currentPhase, drop one prefilled
// draft into backlog so there's always something queued to post.
export interface GenerateDueResult {
  ok: boolean;
  created: number;
  dueTotal: number;          // lịch đến hạn/quá hạn
  skippedAutoOff: number;    // đến hạn nhưng auto_draft tắt (PLAN-only)
  skippedHasBacklog: number; // đến hạn, auto bật, nhưng đã có nháp chờ
  error?: string;
}

// Chọn content_type kế tiếp cho 1 brief×phase: mix hiệu lực
// (PhaseEntry.formatMix override → mặc định theo platform) + xoay vòng
// deterministic theo số card community-seed đã có của brief.
async function pickContentType(
  projectId: string, briefId: number, phase: Phase,
  platformKey: string, category: string,
): Promise<string> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT b.phase_plan,
      (SELECT count(*)::int FROM cards c
         WHERE c.brief_id = b.id AND c.tags @> '["community-seed"]'::jsonb) AS seed_n
    FROM community_briefs b WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  const plan = Array.isArray(r?.phase_plan) ? (r!.phase_plan as Array<Record<string, unknown>>) : [];
  const entry = plan.find((p) => p.phase === phase);
  const override = (entry?.formatMix && typeof entry.formatMix === 'object')
    ? (entry.formatMix as Record<string, number>) : null;
  const mix = effectiveMix(platformKey, category, override);
  return pickFormatByRotation(mix, Number(r?.seed_n ?? 0));
}

export async function generateDueDrafts(projectId: string): Promise<GenerateDueResult> {
  const queue = await listSeedingQueue(projectId);
  const due = queue.filter((q) => q.status === 'due' || q.status === 'overdue');
  const skippedAutoOff = due.filter((q) => !q.autoDraft).length;
  const skippedHasBacklog = due.filter((q) => q.autoDraft && q.backlogCount > 0).length;
  const targets = due.filter((q) => q.autoDraft && q.backlogCount === 0);
  let created = 0;
  for (const q of targets) {
    // Lane type cố định → dùng luôn; lane 'mix' → xoay theo formatMix.
    const ct = q.laneType && q.laneType !== 'mix'
      ? q.laneType
      : await pickContentType(projectId, q.briefId, q.currentPhase, q.platformKey, q.platformCategory);
    const res = await createPostForBriefPhase(
      projectId, q.briefId, q.currentPhase, ct, q.laneLang || undefined);
    if (res.ok) created++;
  }
  if (created > 0) {
    revalidatePath(`/p/${projectId}/seeding`);
    revalidatePath(`/p/${projectId}/board`);
  }
  return {
    ok: true, created,
    dueTotal: due.length, skippedAutoOff, skippedHasBacklog,
  };
}

// Tạo 1 nháp cho đúng 1 brief × phase (per-row), chạy kể cả khi auto_draft
// tắt hoặc chưa đến hạn. contentType: chỉ định loại; bỏ trống = tự xoay
// theo mix hiệu lực của brief×phase.
export async function generateOneDraft(
  projectId: string, briefId: number, phase: Phase,
  contentType?: string,
  ctx?: { platformKey: string; platformCategory: string; laneType?: string; laneLang?: string },
): Promise<{ ok: boolean; cardRef?: string; contentType?: string; error?: string }> {
  let ct = contentType;
  if (!ct) {
    // Không chọn loại cụ thể → ưu tiên loại cố định của lane, else xoay mix.
    ct = ctx?.laneType && ctx.laneType !== 'mix'
      ? ctx.laneType
      : await pickContentType(
          projectId, briefId, phase,
          ctx?.platformKey ?? '', ctx?.platformCategory ?? 'other');
  }
  const res = await createPostForBriefPhase(
    projectId, briefId, phase, ct, ctx?.laneLang || undefined);
  if (res.ok) {
    revalidatePath(`/p/${projectId}/seeding`);
    revalidatePath(`/p/${projectId}/board`);
  }
  return { ok: res.ok, cardRef: res.cardRef, contentType: formatMeta(ct).key, error: res.error };
}

// ── Account chết / mất quyền ────────────────────────────────────
// Khi 1 account không còn dùng được (banned / mất login), thao tác
// NGAY tại Seeding: đổi status + block_reason, cascade TẠM DỪNG mọi
// lịch của account đó (không xoá → khôi phục được). Lịch sử đã seed
// (touch_log + card đã đăng) GIỮ NGUYÊN làm audit; chỉ đếm nháp chưa
// đăng để người dùng tự quyết dọn.

export interface RetireAccountResult {
  ok: boolean;
  accountId: number;
  schedulesPaused: number;   // số lịch của account này vừa tạm dừng
  seededTouches: number;     // tổng lần đã seed (lịch sử — giữ nguyên)
  unpostedDrafts: number;    // nháp community-seed còn ở backlog (chưa đăng)
  error?: string;
}

// briefs (ids) của account trong project
function accountBriefIdsSql(projectId: string, accountId: number) {
  return sql`SELECT id FROM community_briefs WHERE project_id = ${projectId} AND account_id = ${accountId}`;
}

export async function retireAccount(
  projectId: string, accountId: number,
  status: 'banned' | 'blocked', reason: string,
): Promise<RetireAccountResult> {
  const db = ensureDb();
  const note = `[${new Date().toISOString().slice(0, 10)}] seeding: account ${status} — ${reason || 'no reason'}`;
  const upd = await db.execute(sql`
    UPDATE platform_accounts
    SET status = ${status},
        block_reason = ${reason || status},
        notes = CASE WHEN COALESCE(notes,'') = '' THEN ${note}
                     ELSE notes || E'\n' || ${note} END,
        updated_at = now()
    WHERE id = ${accountId} AND project_id = ${projectId}
    RETURNING id
  `);
  if ((upd as unknown as Array<unknown>).length === 0) {
    return { ok: false, accountId, schedulesPaused: 0, seededTouches: 0, unpostedDrafts: 0, error: 'account not in project' };
  }
  const paused = await db.execute(sql`
    UPDATE seeding_schedules
    SET paused = true, updated_at = now()
    WHERE project_id = ${projectId}
      AND brief_id IN (${accountBriefIdsSql(projectId, accountId)})
      AND paused = false
    RETURNING id
  `);
  const touchRows = await db.execute(sql`
    SELECT COALESCE(SUM(jsonb_array_length(COALESCE(touch_log, '[]'::jsonb))),0)::int AS n
    FROM seeding_schedules
    WHERE project_id = ${projectId} AND brief_id IN (${accountBriefIdsSql(projectId, accountId)})
  `);
  const draftRows = await db.execute(sql`
    SELECT count(*)::int AS n FROM cards
    WHERE project_id = ${projectId} AND col = 'backlog'
      AND tags @> '["community-seed"]'::jsonb
      AND brief_id IN (${accountBriefIdsSql(projectId, accountId)})
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/resources`);
  return {
    ok: true, accountId,
    schedulesPaused: (paused as unknown as Array<unknown>).length,
    seededTouches: Number((touchRows as unknown as Array<{ n: number }>)[0]?.n ?? 0),
    unpostedDrafts: Number((draftRows as unknown as Array<{ n: number }>)[0]?.n ?? 0),
  };
}

// Khôi phục account: status → active, xoá block_reason, và bỏ tạm dừng
// các lịch (resume flow). Ghi note để truy vết.
export async function reviveAccount(
  projectId: string, accountId: number,
): Promise<{ ok: boolean; schedulesResumed: number; error?: string }> {
  const db = ensureDb();
  const note = `[${new Date().toISOString().slice(0, 10)}] seeding: account revived`;
  const upd = await db.execute(sql`
    UPDATE platform_accounts
    SET status = 'active', block_reason = NULL,
        notes = CASE WHEN COALESCE(notes,'') = '' THEN ${note}
                     ELSE notes || E'\n' || ${note} END,
        updated_at = now()
    WHERE id = ${accountId} AND project_id = ${projectId}
    RETURNING id
  `);
  if ((upd as unknown as Array<unknown>).length === 0) {
    return { ok: false, schedulesResumed: 0, error: 'account not in project' };
  }
  const resumed = await db.execute(sql`
    UPDATE seeding_schedules
    SET paused = false, updated_at = now()
    WHERE project_id = ${projectId}
      AND brief_id IN (${accountBriefIdsSql(projectId, accountId)})
      AND paused = true
    RETURNING id
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, schedulesResumed: (resumed as unknown as Array<unknown>).length };
}

// Dọn nháp community-seed CHƯA ĐĂNG (col=backlog) của 1 account chết.
// Destructive → UI phải confirm. Card đã đăng + touch_log KHÔNG đụng.
export async function cleanupUnpostedDrafts(
  projectId: string, accountId: number,
): Promise<{ ok: boolean; deleted: number }> {
  const db = ensureDb();
  const del = await db.execute(sql`
    DELETE FROM cards
    WHERE project_id = ${projectId} AND col = 'backlog'
      AND tags @> '["community-seed"]'::jsonb
      AND brief_id IN (${accountBriefIdsSql(projectId, accountId)})
    RETURNING id
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/board`);
  return { ok: true, deleted: (del as unknown as Array<unknown>).length };
}
