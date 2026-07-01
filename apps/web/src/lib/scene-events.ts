import { sql, type SQL } from 'drizzle-orm';

// ── Scene event taxonomy + bảng điểm familiarity — 1 NGUỒN CONFIG ─────────────────
// Tách 2 tầng (yêu cầu user): (1) chuẩn hoá EVENT (kind/dir/toggle) → (2) tra điểm.
//   - dir='ours'   = mình chủ động (follow/like/reply/…); dir='theirs' = họ engage lại (reciprocation).
//   - toggle=true  = có nghịch đảo (unfollow/unlike/unbookmark) → ext dùng model state-sync (on/off →
//                    present/absent), KHÔNG bắt "event" rời. toggle=false = one-shot (reply/repost/mention).
//   - score        = trọng số cộng vào familiarity (0..100, cap 100).
// Backend recomputeFamiliarity + ext (_KIND_LABEL) CÙNG đọc list này → hết lệch điểm.
// Lưu editable ở app_settings key='scene_events'. Thiếu row → DEFAULT dưới (default sống ở 1 chỗ = đây).

export type SceneEvent = {
  kind: string;                 // 'follow' | 'like' | … ; 'theirs' = bucket reciprocation ; 'default' = fallback
  label: string;
  emoji: string;
  dir: 'ours' | 'theirs';
  toggle: boolean;
  score: number;
  desc?: string;
};

export const DEFAULT_SCENE_EVENTS: SceneEvent[] = [
  { kind: 'theirs',   label: 'Họ engage lại', emoji: '↩', dir: 'theirs', toggle: false, score: 30, desc: 'Reciprocation — họ reply/like lại mình. Nặng nhất (bất kể loại).' },
  { kind: 'follow',   label: 'Follow',        emoji: '👤', dir: 'ours',   toggle: true,  score: 25 },
  { kind: 'quote',    label: 'Quote',         emoji: '❝',  dir: 'ours',   toggle: false, score: 22 },
  { kind: 'reply',    label: 'Reply',         emoji: '💬', dir: 'ours',   toggle: false, score: 20 },
  { kind: 'repost',   label: 'Repost',        emoji: '🔁', dir: 'ours',   toggle: false, score: 15 },
  { kind: 'mention',  label: 'Mention',       emoji: '@',  dir: 'ours',   toggle: false, score: 12 },
  { kind: 'like',     label: 'Like',          emoji: '❤️', dir: 'ours',   toggle: true,  score: 8 },
  { kind: 'bookmark', label: 'Bookmark',      emoji: '🔖', dir: 'ours',   toggle: true,  score: 5 },
  { kind: 'default',  label: 'Khác',          emoji: '•',  dir: 'ours',   toggle: false, score: 10, desc: 'Loại chưa khai — fallback.' },
];

type Executor = { execute: (q: SQL) => Promise<unknown> };

export async function getSceneEvents(db: Executor | null | undefined): Promise<SceneEvent[]> {
  if (!db) return DEFAULT_SCENE_EVENTS;
  try {
    const r = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'scene_events' LIMIT 1`);
    const row = (r as unknown as Array<{ value?: unknown }>)[0];
    const v = row?.value;
    if (Array.isArray(v) && v.length && v.every((e) => e && typeof (e as SceneEvent).kind === 'string')) {
      return v as SceneEvent[];
    }
  } catch { /* bảng chưa có / lỗi → default */ }
  return DEFAULT_SCENE_EVENTS;
}

// Build CASE tính điểm từ taxonomy (dùng trong recomputeFamiliarity). direction='theirs' override kind.
export function familiarityScoreCase(events: SceneEvent[]): SQL {
  const theirs = events.find((e) => e.dir === 'theirs')?.score ?? 30;
  const def = events.find((e) => e.kind === 'default')?.score ?? 10;
  const ours = events.filter((e) => e.dir === 'ours' && e.kind !== 'default');
  const whens = ours.map((e) => sql`WHEN kind = ${e.kind} THEN ${Math.round(e.score)}`);
  return sql`CASE WHEN direction = 'theirs' THEN ${Math.round(theirs)} ${sql.join(whens, sql` `)} ELSE ${Math.round(def)} END`;
}
