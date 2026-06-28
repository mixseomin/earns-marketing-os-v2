'use server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { CadenceRow, ContentCadence, HabitatPlaybook, PlaybookPost } from './content-value-types';
import { phaseAction } from './content-value-types';

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
  const empty: HabitatPlaybook = { habitatId, name: '', url: null, projectId: null, phase: null, tone: null, pillarName: null, nextAction: phaseAction(null), topPosts: [] };
  const db = getDb();
  if (!db || !habitatId) return empty;
  try {
    const [hR, bR, pR] = await Promise.all([
      db.execute(sql`SELECT name, url, project_id FROM habitats WHERE id = ${habitatId} LIMIT 1`),
      db.execute(sql`
        SELECT b.current_phase, b.tone, p.name AS pillar_name
        FROM community_briefs b LEFT JOIN content_pillars p ON p.id = b.primary_pillar_id
        WHERE b.habitat_id = ${habitatId}
        ORDER BY (b.current_phase IS NOT NULL) DESC, b.id DESC LIMIT 1`),
      db.execute(sql`
        SELECT title, content_kind, post_url,
               ROUND((COALESCE(insights_score,0) + log(10, COALESCE(insights_views_count,0)+1)*5)::numeric, 1) AS value,
               (now()::date - posted_at::date)::int AS days_ago
        FROM cards WHERE habitat_id = ${habitatId} AND posted_at IS NOT NULL
        ORDER BY value DESC NULLS LAST LIMIT 3`),
    ]);
    const h = (hR as unknown as Array<Record<string, unknown>>)[0] || {};
    const b = (bR as unknown as Array<Record<string, unknown>>)[0] || {};
    const phase = b.current_phase ? String(b.current_phase) : null;
    const topPosts: PlaybookPost[] = (pR as unknown as Array<Record<string, unknown>>).map((x) => ({
      title: String(x.title || '(untitled)'), value: Number(x.value ?? 0),
      contentKind: x.content_kind ? String(x.content_kind) : null, url: x.post_url ? String(x.post_url) : null,
      daysAgo: Number(x.days_ago ?? 0),
    }));
    return {
      habitatId, name: String(h.name || ''), url: h.url ? String(h.url) : null,
      projectId: h.project_id ? String(h.project_id) : null,
      phase, tone: b.tone ? String(b.tone) : null, pillarName: b.pillar_name ? String(b.pillar_name) : null,
      nextAction: phaseAction(phase), topPosts,
    };
  } catch { return empty; }
}
