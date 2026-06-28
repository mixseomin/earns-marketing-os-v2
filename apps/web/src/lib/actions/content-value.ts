import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { Durability, CardValueRow, PillarRollup, ContentValue } from './content-value-types';

// Pha A — "Đo giá trị & độ bền" bài đã đăng. Đọc insights ĐÃ capture (cards.insights_* + lifecycle +
// posted_at) → value × aliveness → phân loại Winner/Rising/Steady/Decaying/Dead + rollup theo pillar.
// Mục tiêu #4: biết bài nào giá trị cao + tồn tại lâu để NHÂN ĐÔI; bài nào chết để bỏ.
// Types + DURABILITY_META = file riêng content-value-types.ts (client-safe; file này import @mos2/db = server-only).
export type { Durability, CardValueRow, PillarRollup, ContentValue } from './content-value-types';

const EMPTY_COUNTS = (): Record<Durability, number> => ({ winner: 0, rising: 0, steady: 0, decaying: 0, dead: 0 });
const DEAD_RE = /removed|dead|reject|delet|takedown|ban/i;
// value = score (ups-downs) + views log-damped (forum/reddit score thường thấp → views bù). Tunable.
const valueOf = (score: number, views: number) => Math.round((score + Math.log10(views + 1) * 5) * 10) / 10;

export async function getContentValue(projectId?: string): Promise<ContentValue> {
  const db = getDb();
  if (!db) return { cards: [], pillars: [], counts: EMPTY_COUNTS(), total: 0 };
  try {
    const where = projectId ? sql`AND c.project_id = ${projectId}` : sql``;
    const r = await db.execute(sql`
      SELECT c.id, c.title, c.post_url, c.posted_at, c.pillar_id, c.project_id,
             p.name AS pillar_name, pr.name AS project_name,
             c.insights_views_count AS views, c.insights_score AS score, c.insights_upvote_ratio AS upvote_ratio,
             c.post_lifecycle AS lifecycle, EXTRACT(day FROM now() - c.posted_at)::int AS age_days
      FROM cards c LEFT JOIN content_pillars p ON p.id = c.pillar_id LEFT JOIN projects pr ON pr.id = c.project_id
      WHERE c.posted_at IS NOT NULL ${where}
      ORDER BY c.posted_at DESC`);
    const cards: CardValueRow[] = (r as unknown as Array<Record<string, unknown>>).map((x) => {
      const views = Number(x.views ?? 0), score = Number(x.score ?? 0);
      return {
        id: Number(x.id), title: String(x.title || '(untitled)'), postUrl: x.post_url ? String(x.post_url) : null,
        postedAt: x.posted_at ? String(x.posted_at) : null, pillarId: x.pillar_id != null ? Number(x.pillar_id) : null,
        pillarName: x.pillar_name ? String(x.pillar_name) : null,
        projectId: x.project_id ? String(x.project_id) : null, projectName: x.project_name ? String(x.project_name) : null,
        views, score, upvoteRatio: x.upvote_ratio != null ? Number(x.upvote_ratio) : null,
        lifecycle: x.lifecycle ? String(x.lifecycle) : null, ageDays: Number(x.age_days ?? 0),
        valueScore: valueOf(score, views), durability: 'steady',
      };
    });
    // ngưỡng theo percentile trong tập CÒN SỐNG (thích nghi quy mô, ko hardcode con số tuyệt đối)
    const alive = cards.filter((c) => !(c.lifecycle && DEAD_RE.test(c.lifecycle)));
    const sorted = alive.map((c) => c.valueScore).sort((a, b) => a - b);
    const pct = (p: number) => (sorted.length ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0) : 0);
    const hi = pct(0.66), lo = pct(0.34);
    for (const c of cards) {
      if (c.lifecycle && DEAD_RE.test(c.lifecycle)) { c.durability = 'dead'; continue; }
      if (c.valueScore >= hi) c.durability = c.ageDays >= 14 ? 'winner' : 'rising';
      else if (c.ageDays >= 21 && c.valueScore <= lo) c.durability = 'decaying';
      else c.durability = 'steady';
    }
    const counts = EMPTY_COUNTS();
    for (const c of cards) counts[c.durability]++;
    const pmap = new Map<string, PillarRollup>();
    for (const c of cards) {
      const key = c.pillarId != null ? String(c.pillarId) : 'none';
      const cur = pmap.get(key) || { key, pillarName: c.pillarName || '(no pillar)', posts: 0, totalValue: 0, winners: 0 };
      cur.posts++; cur.totalValue = Math.round((cur.totalValue + c.valueScore) * 10) / 10; if (c.durability === 'winner') cur.winners++;
      pmap.set(key, cur);
    }
    const pillars = [...pmap.values()].sort((a, b) => b.totalValue - a.totalValue);
    cards.sort((a, b) => b.valueScore - a.valueScore);
    return { cards, pillars, counts, total: cards.length };
  } catch { return { cards: [], pillars: [], counts: EMPTY_COUNTS(), total: 0 }; }
}
