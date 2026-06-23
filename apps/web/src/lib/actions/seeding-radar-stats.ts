'use server';

// Seeding Radar — aggregate stats cho quản lý/thống kê (KHÔNG có ở per-board panel).
// Nguồn: board_project_score (fit/tier/approach/manual) + platform_boards (catalog) +
// habitats.board_id → community_briefs → cards (tracked/posted). SQL đã validate trên prod.
// Surface: cockpit view "📡 Radar" + Studio node board_project_score.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

function db() {
  const d = getDb();
  if (!d) throw new Error('DATABASE_URL not configured');
  return d;
}
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface SeedingFunnel {
  scored: number;          // #board đã chấm cho project
  avgFit: number;          // fit trung bình
  skipped: number;         // manual_tier='SKIP'
  withApproach: number;    // có angle bắc cầu
  goIsh: number;           // manual GO hoặc fit>=70
  mid: number;             // fit 50-69 (đáng cân nhắc)
  habitatsLinked: number;  // board đã adopt thành habitat
  briefs: number;          // habitat đã có brief
  posted: number;          // card đã đăng
  backlog: Array<{ boardId: number; name: string; url: string; fit: number; manualTier: string | null }>;  // GO/fit cao chưa có brief = low-hanging
}

// Funnel + backlog cho 1 project. discovered(scored) → GO/ADD → tracked(habitat) → brief → posted.
export async function getSeedingFunnel(projectId: string): Promise<SeedingFunnel> {
  const rows = await db().execute(sql`
    WITH s AS (SELECT * FROM board_project_score WHERE project_id = ${projectId})
    SELECT
      (SELECT count(*) FROM s) AS scored,
      (SELECT round(avg(fit))::int FROM s) AS avg_fit,
      (SELECT count(*) FROM s WHERE manual_tier='SKIP') AS skipped,
      (SELECT count(*) FROM s WHERE approach <> '') AS with_approach,
      (SELECT count(*) FROM s WHERE manual_tier='GO' OR fit>=70) AS go_ish,
      (SELECT count(*) FROM s WHERE fit>=50 AND fit<70 AND manual_tier IS DISTINCT FROM 'SKIP') AS mid,
      (SELECT count(DISTINCT h.id) FROM habitats h WHERE h.project_id=${projectId} AND h.board_id IN (SELECT board_id FROM s)) AS habitats_linked,
      (SELECT count(DISTINCT b.id) FROM community_briefs b JOIN habitats h ON h.id=b.habitat_id WHERE h.project_id=${projectId} AND h.board_id IN (SELECT board_id FROM s)) AS briefs,
      (SELECT count(DISTINCT c.id) FROM cards c JOIN community_briefs b ON b.id=c.brief_id JOIN habitats h ON h.id=b.habitat_id WHERE h.project_id=${projectId} AND h.board_id IN (SELECT board_id FROM s) AND c.post_url IS NOT NULL) AS posted
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0] || {};

  const back = await db().execute(sql`
    SELECT pb.id, pb.name, pb.url, bps.fit, bps.manual_tier
      FROM board_project_score bps JOIN platform_boards pb ON pb.id = bps.board_id
     WHERE bps.project_id = ${projectId}
       AND (bps.manual_tier='GO' OR bps.fit>=60) AND bps.manual_tier IS DISTINCT FROM 'SKIP'
       AND NOT EXISTS (SELECT 1 FROM habitats h JOIN community_briefs b ON b.habitat_id=h.id
                        WHERE h.board_id=bps.board_id AND h.project_id=bps.project_id)
     ORDER BY bps.fit DESC LIMIT 20
  `);

  return {
    scored: num(r.scored), avgFit: num(r.avg_fit), skipped: num(r.skipped), withApproach: num(r.with_approach),
    goIsh: num(r.go_ish), mid: num(r.mid), habitatsLinked: num(r.habitats_linked), briefs: num(r.briefs), posted: num(r.posted),
    backlog: (back as unknown as Array<Record<string, unknown>>).map((x) => ({
      boardId: num(x.id), name: String(x.name ?? ''), url: String(x.url ?? ''), fit: num(x.fit), manualTier: x.manual_tier ? String(x.manual_tier) : null,
    })),
  };
}

export interface PlaybookStat { id: number; title: string; uses: number; applied: number; avgFit: number; projects: number }

// Hiệu quả thư viện approach: mỗi angle = uses + #board áp dụng + avg fit + #project. → promote/retire.
export async function getApproachPlaybookStats(): Promise<PlaybookStat[]> {
  const rows = await db().execute(sql`
    SELECT ap.id, ap.title, ap.uses,
           count(bps.id) AS applied, round(avg(bps.fit)) AS avg_fit, count(DISTINCT bps.project_id) AS projects
      FROM approach_playbooks ap
      LEFT JOIN board_project_score bps ON bps.approach_playbook_id = ap.id
     GROUP BY ap.id, ap.title, ap.uses
     ORDER BY ap.uses DESC NULLS LAST, applied DESC
     LIMIT 50
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: num(x.id), title: String(x.title ?? ''), uses: num(x.uses), applied: num(x.applied), avgFit: num(x.avg_fit), projects: num(x.projects),
  }));
}

export interface CoverageRow { platform: string; engine: string | null; boards: number; withSignal: number; scored: number }

// Độ phủ catalog per platform/technology: tổng board · %có-signal · %scored → lộ chỗ mỏng/stale.
export async function getBoardCatalogCoverage(): Promise<CoverageRow[]> {
  const rows = await db().execute(sql`
    SELECT COALESCE(pb.platform_key, pb.technology_key, '?') AS plat, pb.technology_key AS eng,
           count(*) AS boards,
           count(*) FILTER (WHERE pb.dominant_topics IS NOT NULL OR pb.description <> '') AS with_signal,
           count(DISTINCT bps.board_id) AS scored
      FROM platform_boards pb
      LEFT JOIN board_project_score bps ON bps.board_id = pb.id
     GROUP BY 1, 2
     ORDER BY boards DESC
     LIMIT 40
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((x) => ({
    platform: String(x.plat ?? '?'), engine: x.eng ? String(x.eng) : null, boards: num(x.boards), withSignal: num(x.with_signal), scored: num(x.scored),
  }));
}
