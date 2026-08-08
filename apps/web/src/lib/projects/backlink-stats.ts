// Per-site backlink-campaign stats — the links WE actively went after, as opposed
// to the Bing LINKS column (links Bing counted pointing at us).
//
// Source: human_tasks with platform_key='backlink'. One source row can target
// several sites at once, each with its own state, held in
// prep_payload.site_status = { "<site slug>": "<status>" }. So we aggregate by
// unrolling that jsonb rather than by task row.
//
// Statuses in use: pending · claimed · submitted · review · completed · verified · broken.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export type BacklinkSiteStats = {
  total: number;
  done: number;      // completed + verified — link is actually live
  inflight: number;  // claimed + submitted + review — worked on, not confirmed yet
  pending: number;   // not started
  broken: number;    // was live, went dead
  byStatus: Record<string, number>;
};

const DONE = new Set(['completed', 'verified']);
// 'review' = làm xong nhưng CHƯA duyệt → vẫn là việc đang chạy, không phải done (và tuyệt đối không
// rơi vào nhánh cuối 'pending' như hồi mới thêm trạng thái mà quên bảng thống kê).
const INFLIGHT = new Set(['claimed', 'submitted', 'review']);

type Row = { site: string; status: string; n: number | string };

export async function loadBacklinkStats(): Promise<Record<string, BacklinkSiteStats> | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db.execute(sql`
      SELECT k.key AS site, k.value AS status, COUNT(*)::int AS n
      FROM human_tasks t, jsonb_each_text(COALESCE(t.prep_payload->'site_status', '{}'::jsonb)) k
      WHERE t.platform_key = 'backlink'
      GROUP BY 1, 2
    `);
    const out: Record<string, BacklinkSiteStats> = {};
    for (const row of (r as unknown as Row[])) {
      const site = String(row.site);
      const status = String(row.status || '').toLowerCase();
      const n = Number(row.n || 0);
      const e = (out[site] ||= { total: 0, done: 0, inflight: 0, pending: 0, broken: 0, byStatus: {} });
      e.total += n;
      e.byStatus[status] = (e.byStatus[status] || 0) + n;
      if (DONE.has(status)) e.done += n;
      else if (INFLIGHT.has(status)) e.inflight += n;
      else if (status === 'broken') e.broken += n;
      else e.pending += n;
    }
    return out;
  } catch {
    return null;
  }
}

// domain → backlink site key. The key is a slug: SITE_META.project when the
// domain has a MOS2 project, else the first domain label (paydochub.com →
// paydochub, chatlt.com → chatlt), which matches every current site_status key.
export function pickBacklinks(
  stats: Record<string, BacklinkSiteStats> | null,
  domain: string,
  project?: string,
): BacklinkSiteStats | null {
  if (!stats) return null;
  const key = project || domain.split('.')[0] || domain;
  return stats[key] ?? null;
}
