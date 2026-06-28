import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { Durability, CardValueRow, PillarRollup, ContentValue } from './content-value-types';

// Pha A — "Đo giá trị & độ bền" bài đã đăng. Đọc insights ĐÃ capture (cards.insights_* + lifecycle +
// posted_at) → value × aliveness → phân loại Winner/Rising/Steady/Decaying/Dead + rollup theo pillar.
// Mục tiêu #4: biết bài nào giá trị cao + tồn tại lâu để NHÂN ĐÔI; bài nào chết để bỏ.
//
// SCALE (1M bài): KHÔNG load toàn bộ rows về JS. Tất cả classify/aggregate làm TRONG SQL:
//  - threshold = percentile_cont trong tập còn sống (1 query, O(1) memory)
//  - counts + pillar rollup = GROUP BY (1 query mỗi cái)
//  - bảng cards = chỉ LIMIT top-N theo value (truncated flag báo nếu cắt)
// → memory phẳng bất kể 66 hay 1M bài; chỉ percentile_cont phải sort (Postgres lo, index posted_at).
// Types + DURABILITY_META = file riêng content-value-types.ts (client-safe; file này import @mos2/db = server-only).
export type { Durability, CardValueRow, PillarRollup, ContentValue } from './content-value-types';

const EMPTY_COUNTS = (): Record<Durability, number> => ({ winner: 0, rising: 0, steady: 0, decaying: 0, dead: 0 });
const CARD_LIMIT = 500; // bảng chỉ hiện top-N theo value; counts/pillars vẫn tính full trong SQL

export async function getContentValue(projectId?: string): Promise<ContentValue> {
  const db = getDb();
  if (!db) return { cards: [], pillars: [], counts: EMPTY_COUNTS(), total: 0, truncated: false };
  try {
    const where = projectId ? sql`AND c.project_id = ${projectId}` : sql``;
    // CTE classify trong SQL: value = score + log10(views+1)*5; dead = lifecycle match regex;
    // threshold percentile trong tập CÒN SỐNG; winner/rising/decaying/steady theo tuổi + percentile.
    const base = sql`
      WITH scope AS (
        SELECT c.id, c.title, c.post_url, c.posted_at, c.pillar_id, c.project_id,
               p.name AS pillar_name, pr.name AS project_name,
               COALESCE(c.insights_views_count,0) AS views, COALESCE(c.insights_score,0) AS score,
               c.insights_upvote_ratio AS upvote_ratio, c.post_lifecycle AS lifecycle,
               EXTRACT(day FROM now() - c.posted_at)::int AS age_days,
               ROUND((COALESCE(c.insights_score,0) + log(10, COALESCE(c.insights_views_count,0)+1) * 5)::numeric, 1) AS value_score,
               (c.post_lifecycle ~* 'removed|dead|reject|delet|takedown|ban') AS is_dead
        FROM cards c
        LEFT JOIN content_pillars p ON p.id = c.pillar_id
        LEFT JOIN projects pr ON pr.id = c.project_id
        WHERE c.posted_at IS NOT NULL ${where}
      ),
      th AS (
        SELECT percentile_cont(0.66) WITHIN GROUP (ORDER BY value_score) AS hi,
               percentile_cont(0.34) WITHIN GROUP (ORDER BY value_score) AS lo
        FROM scope WHERE NOT is_dead
      ),
      classed AS (
        SELECT s.*, CASE
          WHEN s.is_dead THEN 'dead'
          WHEN s.value_score >= th.hi THEN (CASE WHEN s.age_days >= 14 THEN 'winner' ELSE 'rising' END)
          WHEN s.age_days >= 21 AND s.value_score <= th.lo THEN 'decaying'
          ELSE 'steady' END AS durability
        FROM scope s CROSS JOIN th
      )`;

    const [cardsR, countsR, pillarsR] = await Promise.all([
      db.execute(sql`${base} SELECT * FROM classed ORDER BY value_score DESC NULLS LAST LIMIT ${CARD_LIMIT}`),
      db.execute(sql`${base} SELECT durability, count(*)::int AS n FROM classed GROUP BY durability`),
      db.execute(sql`${base}
        SELECT COALESCE(pillar_id::text,'none') AS key, COALESCE(MAX(pillar_name),'(no pillar)') AS pillar_name,
               count(*)::int AS posts, ROUND(SUM(value_score)::numeric,1)::float8 AS total_value,
               COUNT(*) FILTER (WHERE durability='winner')::int AS winners
        FROM classed GROUP BY pillar_id ORDER BY total_value DESC NULLS LAST LIMIT 40`),
    ]);

    const cards: CardValueRow[] = (cardsR as unknown as Array<Record<string, unknown>>).map((x) => ({
      id: Number(x.id), title: String(x.title || '(untitled)'), postUrl: x.post_url ? String(x.post_url) : null,
      postedAt: x.posted_at ? String(x.posted_at) : null, pillarId: x.pillar_id != null ? Number(x.pillar_id) : null,
      pillarName: x.pillar_name ? String(x.pillar_name) : null,
      projectId: x.project_id ? String(x.project_id) : null, projectName: x.project_name ? String(x.project_name) : null,
      views: Number(x.views ?? 0), score: Number(x.score ?? 0), upvoteRatio: x.upvote_ratio != null ? Number(x.upvote_ratio) : null,
      lifecycle: x.lifecycle ? String(x.lifecycle) : null, ageDays: Number(x.age_days ?? 0),
      valueScore: Number(x.value_score ?? 0), durability: String(x.durability || 'steady') as Durability,
    }));

    const counts = EMPTY_COUNTS();
    let total = 0;
    for (const row of countsR as unknown as Array<{ durability: string; n: number }>) {
      const d = String(row.durability) as Durability; const n = Number(row.n);
      if (d in counts) counts[d] = n; total += n;
    }

    const pillars: PillarRollup[] = (pillarsR as unknown as Array<Record<string, unknown>>).map((x) => ({
      key: String(x.key), pillarName: String(x.pillar_name || '(no pillar)'),
      posts: Number(x.posts ?? 0), totalValue: Number(x.total_value ?? 0), winners: Number(x.winners ?? 0),
    }));

    return { cards, pillars, counts, total, truncated: total > cards.length };
  } catch { return { cards: [], pillars: [], counts: EMPTY_COUNTS(), total: 0, truncated: false }; }
}
