'use server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { CadenceRow, ContentCadence, HabitatPlaybook, PlaybookPost, PlaybookAccount } from './content-value-types';
import { phaseAction } from './content-value-types';
import { upsertBrief, initPhasePlanFromDefaults } from './community-briefs';

// Pha B — "Đến hạn → đăng nơi bền" (#3 cadence + #1 đăng tiện). Cadence/độ-bền KHÔNG có cột riêng →
// DERIVE từ lịch sử đăng theo HABITAT (pillar_id rỗng trên bài posted; 64/66 bài có habitat_id).
//  - daysSince = now - max(posted_at) → "đến hạn"
//  - bestValue = max(value) habitat đó từng đạt → "nơi bền" (chỗ bài từng landed)
//  - bucket: due (bền + lâu chưa đăng → ĐĂNG TIẾP) · watch (bền + mới) · cold (nguội) · weak (value≈0, cân nhắc bỏ)
// SỐNG TRONG drawer node `habitat` của Architecture Studio (KHÔNG page riêng — feedback_no_new_pages).
// 'use server' → getHabitatPlaybook gọi được trực tiếp từ client (bung row "đăng gì").

const OVERDUE_DAYS = 10;  // chưa đăng ≥10 ngày = đến hạn (tunable)
const WEAK_VALUE = 2;     // best_value < 2 = nơi gần như ko ra giá trị

export async function getContentCadence(projectId?: string): Promise<ContentCadence> {
  const db = getDb();
  if (!db) return { rows: [], durableCut: 0 };
  try {
    const where = projectId ? sql`AND c.project_id = ${projectId}` : sql``;
    const r = await db.execute(sql`
      WITH hv AS (
        SELECT c.habitat_id,
               count(*)::int AS posts,
               (now()::date - max(c.posted_at)::date)::int AS days_since,
               ROUND(AVG(COALESCE(c.insights_score,0) + log(10, COALESCE(c.insights_views_count,0)+1)*5)::numeric, 1) AS avg_value,
               ROUND(MAX(COALESCE(c.insights_score,0) + log(10, COALESCE(c.insights_views_count,0)+1)*5)::numeric, 1) AS best_value
        FROM cards c
        WHERE c.posted_at IS NOT NULL AND c.habitat_id IS NOT NULL ${where}
        GROUP BY c.habitat_id
      )
      SELECT hv.*, h.name, h.url, h.platform_key, h.status, h.project_id, pr.name AS project_name
      FROM hv JOIN habitats h ON h.id = hv.habitat_id LEFT JOIN projects pr ON pr.id = h.project_id
      ORDER BY days_since DESC`);

    const raw = (r as unknown as Array<Record<string, unknown>>).map((x) => ({
      habitatId: Number(x.habitat_id), name: String(x.name || '(habitat)'), url: x.url ? String(x.url) : null,
      platformKey: x.platform_key ? String(x.platform_key) : null, status: x.status ? String(x.status) : null,
      projectId: x.project_id ? String(x.project_id) : null, projectName: x.project_name ? String(x.project_name) : null,
      posts: Number(x.posts ?? 0), daysSince: Number(x.days_since ?? 0),
      avgValue: Number(x.avg_value ?? 0), bestValue: Number(x.best_value ?? 0),
    }));

    // ngưỡng "bền" thích nghi = median best_value của các habitat từng ra giá trị (>0). Min 3 để khỏi nhiễu.
    const nz = raw.map((x) => x.bestValue).filter((v) => v > 0).sort((a, b) => a - b);
    const durableCut = Math.max(3, nz.length ? (nz[Math.floor(nz.length / 2)] ?? 0) : 0);

    const rows: CadenceRow[] = raw.map((x) => {
      let bucket: CadenceRow['bucket'];
      if (x.bestValue < WEAK_VALUE) bucket = 'weak';
      else if (x.bestValue >= durableCut) bucket = x.daysSince >= OVERDUE_DAYS ? 'due' : 'watch';
      else bucket = x.daysSince >= OVERDUE_DAYS ? 'cold' : 'watch';
      return { ...x, bucket };
    });
    // sắp: due (đăng tiếp) → cold → watch → weak; trong nhóm theo lâu-chưa-đăng giảm dần
    const rank = { due: 0, cold: 1, watch: 2, weak: 3 } as const;
    rows.sort((a, b) => rank[a.bucket] - rank[b.bucket] || b.daysSince - a.daysSince);
    return { rows, durableCut: Math.round(durableCut * 10) / 10 };
  } catch { return { rows: [], durableCut: 0 }; }
}

// "Đăng gì" khi 1 nơi đến hạn — lazy-load lúc bung row (detail-on-demand, scale-safe).
// = kế hoạch giai đoạn (brief mới nhất của habitat: phase + tone + pillar) + top winner để LẶP công thức.
export async function getHabitatPlaybook(habitatId: number): Promise<HabitatPlaybook> {
  const empty: HabitatPlaybook = { habitatId, name: '', url: null, projectId: null, phase: null, tone: null, pillarName: null, nextAction: phaseAction(null), topPosts: [], accounts: [] };
  const db = getDb();
  if (!db || !habitatId) return empty;
  try {
    const [hR, bR, pR, aR] = await Promise.all([
      db.execute(sql`SELECT name, url, project_id FROM habitats WHERE id = ${habitatId} LIMIT 1`),
      db.execute(sql`
        SELECT b.current_phase, b.tone, p.name AS pillar_name
        FROM community_briefs b LEFT JOIN content_pillars p ON p.id = b.primary_pillar_id
        WHERE b.habitat_id = ${habitatId}
        ORDER BY (b.current_phase IS NOT NULL) DESC, b.id DESC LIMIT 1`),
      db.execute(sql`
        SELECT id, title, content_kind, post_url,
               ROUND((COALESCE(insights_score,0) + log(10, COALESCE(insights_views_count,0)+1)*5)::numeric, 1) AS value,
               (now()::date - posted_at::date)::int AS days_ago
        FROM cards WHERE habitat_id = ${habitatId} AND posted_at IS NOT NULL
        ORDER BY value DESC NULLS LAST LIMIT 3`),
      // accounts đăng ở nơi này (từ cards thực + brief) + browser profile + proxy quản lý
      db.execute(sql`
        SELECT a.id, a.handle, a.platform_key, a.status, a.account_kind, a.has_2fa, a.auth_method, a.cookie_session_needed,
               bp.label AS bp_label, bp.tool AS bp_tool, bp.user_agent AS bp_ua,
               px.label AS px_label, px.type AS px_type, px.location AS px_loc, px.health AS px_health,
               (SELECT count(*)::int FROM cards c WHERE c.account_id = a.id AND c.habitat_id = ${habitatId} AND c.posted_at IS NOT NULL) AS posts_here,
               EXISTS (SELECT 1 FROM community_briefs br WHERE br.account_id = a.id AND br.habitat_id = ${habitatId}) AS from_brief
        FROM platform_accounts a
        LEFT JOIN browser_profiles bp ON bp.id = a.browser_profile_id
        LEFT JOIN proxies px ON px.id = a.proxy_id
        WHERE a.id IN (
          SELECT account_id FROM cards WHERE habitat_id = ${habitatId} AND account_id IS NOT NULL
          UNION SELECT account_id FROM community_briefs WHERE habitat_id = ${habitatId} AND account_id IS NOT NULL
        )
        ORDER BY posts_here DESC, a.handle`),
    ]);
    const h = (hR as unknown as Array<Record<string, unknown>>)[0] || {};
    const b = (bR as unknown as Array<Record<string, unknown>>)[0] || {};
    const phase = b.current_phase ? String(b.current_phase) : null;
    const topPosts: PlaybookPost[] = (pR as unknown as Array<Record<string, unknown>>).map((x) => ({
      id: Number(x.id), title: String(x.title || '(untitled)'), value: Number(x.value ?? 0),
      contentKind: x.content_kind ? String(x.content_kind) : null, url: x.post_url ? String(x.post_url) : null,
      daysAgo: Number(x.days_ago ?? 0),
    }));
    const accounts: PlaybookAccount[] = (aR as unknown as Array<Record<string, unknown>>).map((x) => ({
      id: Number(x.id), handle: String(x.handle || '(no handle)'), platformKey: x.platform_key ? String(x.platform_key) : null,
      status: x.status ? String(x.status) : null, accountKind: x.account_kind ? String(x.account_kind) : null,
      has2fa: !!x.has_2fa, authMethod: x.auth_method ? String(x.auth_method) : null, cookieNeeded: !!x.cookie_session_needed,
      postsHere: Number(x.posts_here ?? 0), fromBrief: !!x.from_brief,
      browser: (x.bp_label || x.bp_tool || x.bp_ua) ? { label: x.bp_label ? String(x.bp_label) : null, tool: x.bp_tool ? String(x.bp_tool) : null, userAgent: x.bp_ua ? String(x.bp_ua) : null } : null,
      proxy: (x.px_label || x.px_type || x.px_loc) ? { label: x.px_label ? String(x.px_label) : null, type: x.px_type ? String(x.px_type) : null, location: x.px_loc ? String(x.px_loc) : null, health: x.px_health ? String(x.px_health) : null } : null,
    }));
    return {
      habitatId, name: String(h.name || ''), url: h.url ? String(h.url) : null,
      projectId: h.project_id ? String(h.project_id) : null,
      phase, tone: b.tone ? String(b.tone) : null, pillarName: b.pillar_name ? String(b.pillar_name) : null,
      nextAction: phaseAction(phase), topPosts, accounts,
    };
  } catch { return empty; }
}

// Pha C — ĐÓNG VÒNG: nơi đến hạn mà CHƯA có kế hoạch (brief) → sinh brief gợi ý từ winner đã landed
// ở chính nơi đó (Pha A insight → kế hoạch). Chọn account đăng nhiều nhất ở đây làm chủ brief, seed
// approach = lặp công thức winner, đặt current_phase='warm-up' để Pha B hiện ngay.
export async function createBriefFromWinners(habitatId: number): Promise<{ ok: boolean; briefId?: number; error?: string }> {
  const db = getDb();
  if (!db || !habitatId) return { ok: false, error: 'no db' };
  try {
    const hR = await db.execute(sql`SELECT project_id FROM habitats WHERE id = ${habitatId} LIMIT 1`);
    const projectId = String(((hR as unknown as Array<Record<string, unknown>>)[0]?.project_id) || '');
    if (!projectId) return { ok: false, error: 'habitat không thuộc project' };

    // account đăng nhiều nhất ở nơi này (ưu tiên đang theo brief), fallback brief account
    const aR = await db.execute(sql`
      SELECT account_id, count(*)::int AS n FROM cards
      WHERE habitat_id = ${habitatId} AND account_id IS NOT NULL AND posted_at IS NOT NULL
      GROUP BY account_id ORDER BY n DESC LIMIT 1`);
    let accountId = Number(((aR as unknown as Array<Record<string, unknown>>)[0]?.account_id) || 0);
    if (!accountId) {
      const bR = await db.execute(sql`SELECT account_id FROM community_briefs WHERE habitat_id = ${habitatId} AND account_id IS NOT NULL LIMIT 1`);
      accountId = Number(((bR as unknown as Array<Record<string, unknown>>)[0]?.account_id) || 0);
    }
    if (!accountId) return { ok: false, error: 'chưa có account nào đăng ở đây để gắn brief' };

    const wR = await db.execute(sql`
      SELECT title, content_kind,
             ROUND((COALESCE(insights_score,0) + log(10, COALESCE(insights_views_count,0)+1)*5)::numeric, 1) AS value
      FROM cards WHERE habitat_id = ${habitatId} AND posted_at IS NOT NULL
      ORDER BY value DESC NULLS LAST LIMIT 3`);
    const winners = (wR as unknown as Array<Record<string, unknown>>);
    const approachMd = winners.length
      ? 'Lặp công thức đã hiệu quả ở nơi này:\n' + winners.map((w) => `- (${w.value}) [${w.content_kind || 'post'}] ${w.title}`).join('\n')
      : 'Bắt đầu warm-up: tương tác giá trị, chưa nhắc sản phẩm.';
    const templates = winners.map((w) => ({ label: String(w.content_kind || 'post'), body: String(w.title || '') })).filter((t) => t.body);

    const up = await upsertBrief(projectId, accountId, habitatId, { approachMd, templates });
    if (!up.ok || !up.id) return { ok: false, error: up.error || 'upsert fail' };
    // đặt phase khởi đầu để Pha B hiện kế hoạch ngay (warm-up an toàn, ko cần account joined)
    await db.execute(sql`UPDATE community_briefs SET current_phase = COALESCE(current_phase, 'warm-up'), updated_at = now() WHERE id = ${up.id}`);
    try { await initPhasePlanFromDefaults(projectId, up.id); } catch { /* phase plan optional */ }
    return { ok: true, briefId: up.id };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
