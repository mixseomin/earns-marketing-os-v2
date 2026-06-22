// board-scorer.ts — Seeding Radar Phase 3 fit scoring. ACCOUNT-FREE (board topics vs project
// pillars only). Pipeline: keyword prefilter (B) → forbidden hard-exclude (B-HARD) → LLM (C).
// NOT brief-suggest (that is account-coupled). See decision 2026-06-22-seeding-radar.
import { sql } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL } from './openai';
import { getDb } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;
export interface PillarContext { keyMessages: string[]; seoKeywords: string[]; forbiddenMsgs: string[]; languages: string[] }
export interface BoardContext { name: string; description: string; dominantTopics: string[]; forbiddenTopics: string[]; language: string; members: number }

// ── shared context loaders (reused by /boards/score + /boards/approach — DRY) ──
const asArr = (v: unknown): string[] => Array.isArray(v) ? v.map((x) => String(x)) : [];
export interface PillarLoad { pillar: PillarContext; ids: string[]; status: string }
export async function loadPillarContext(db: Db, projectId: string): Promise<PillarLoad | null> {
  const rows = (await db.execute(sql`SELECT id, key_messages, seo_keywords, forbidden_msgs, languages, status FROM content_pillars WHERE project_id = ${projectId} AND tenant_id = 'self'`)) as Array<Record<string, unknown>>;
  if (!rows.length) return null;
  return {
    pillar: {
      keyMessages: rows.flatMap((p) => asArr(p.key_messages)),
      seoKeywords: rows.flatMap((p) => asArr(p.seo_keywords)),
      forbiddenMsgs: rows.flatMap((p) => asArr(p.forbidden_msgs)),
      languages: [...new Set(rows.flatMap((p) => asArr(p.languages)))],
    },
    ids: rows.map((p) => String(p.id)).sort(),
    status: rows.map((p) => String(p.status ?? '')).join(','),
  };
}
// board topic signals = catalog-level (user-editable, override) → fall back to any adopting habitat.
// Board-level signals (platform_boards.dominant_topics/...) are what the panel edits; they win so a
// board the user has hand-tuned scores by those exact factors regardless of habitat state.
export async function loadBoardContexts(db: Db, boardIds: number[]): Promise<Map<number, BoardContext>> {
  const out = new Map<number, BoardContext>();
  if (!boardIds.length) return out;
  const rows = (await db.execute(sql`
    SELECT pb.id, pb.name, pb.description, pb.members,
           CASE WHEN jsonb_array_length(COALESCE(pb.dominant_topics, '[]'::jsonb)) > 0
                THEN pb.dominant_topics ELSE COALESCE(h.dominant_topics, '[]'::jsonb) END AS dominant_topics,
           CASE WHEN jsonb_array_length(COALESCE(pb.forbidden_topics, '[]'::jsonb)) > 0
                THEN pb.forbidden_topics ELSE COALESCE(h.forbidden_topics, '[]'::jsonb) END AS forbidden_topics,
           COALESCE(NULLIF(pb.language, ''), h.language, '') AS language
    FROM platform_boards pb
    LEFT JOIN LATERAL (
      SELECT dominant_topics, forbidden_topics, language FROM habitats
      WHERE board_id = pb.id AND jsonb_array_length(COALESCE(dominant_topics, '[]'::jsonb)) > 0 LIMIT 1
    ) h ON true
    WHERE pb.tenant_id = 'self' AND pb.id IN (${sql.join(boardIds.map((b) => sql`${b}`), sql`, `)})`)) as Array<Record<string, unknown>>;
  for (const r of rows) out.set(Number(r.id), {
    name: String(r.name ?? ''), description: String(r.description ?? ''),
    dominantTopics: asArr(r.dominant_topics), forbiddenTopics: asArr(r.forbidden_topics),
    language: String(r.language ?? ''), members: Number(r.members ?? 0),
  });
  return out;
}
export interface ScoreResult { fit: number; topicTier: 'TRACK' | 'LOW'; reason: string; model: string; tokens: number }

const STOP = new Set('the a an and or of to in for on with about from is are be this that your you we our it as at by'.split(' '));
function toks(...xs: (string | string[])[]): Set<string> {
  const out = new Set<string>();
  for (const x of xs) {
    const s = Array.isArray(x) ? x.join(' ') : x;
    for (const w of String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
      if (w.length >= 3 && !STOP.has(w)) out.add(w);
    }
  }
  return out;
}

// B) cheap keyword overlap 0..1 (dumb exact-match — generous, real ranking is LLM's job).
export function keywordFit(board: BoardContext, pillar: PillarContext): number {
  const bt = toks(board.name, board.description, board.dominantTopics);
  const pt = toks(pillar.keyMessages, pillar.seoKeywords);
  if (!bt.size || !pt.size) return 0;
  let hit = 0; for (const w of pt) if (bt.has(w)) hit++;
  return hit / Math.min(pt.size, 40);
}

// B-HARD) forbidden overlap → hard exclude regardless of topic overlap.
export function forbiddenConflict(board: BoardContext, pillar: PillarContext): boolean {
  const bForb = toks(board.forbiddenTopics), pForb = toks(pillar.forbiddenMsgs);
  const bTop = toks(board.dominantTopics, board.name), pKey = toks(pillar.keyMessages);
  for (const w of pForb) if (bTop.has(w)) return true;   // pillar-forbidden topic dominates the board
  for (const w of bForb) if (pKey.has(w)) return true;   // board forbids what the pillar pushes
  return false;
}

// C) LLM topic-fit. `approach` = optional per-board angle: when set, fit is scored ASSUMING the
// project uses that angle to bridge to the board (a clever authentic bridge can lift an off-topic
// board). Returns null on AI-disabled / parse fail (caller falls back to keyword tier).
export async function scoreBoardLLM(board: BoardContext, pillar: PillarContext, threshold: number, approach?: string): Promise<ScoreResult | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const sys = 'You score how well a community board fits a marketing project for organic seeding. Output strict JSON {"fit": int 0-100, "reason": "one short sentence"}. fit = topic relevance + audience match; ignore account/posting mechanics. Be skeptical: generic/off-topic boards score low. IF an "approach" angle is provided, score fit ASSUMING the project uses exactly that angle to bridge to this board\'s audience authentically (e.g. using astrology to analyze celebrities on an entertainment board) — a strong bridge can raise an otherwise off-topic board; a weak/forced bridge should not. Explain in the reason whether the angle works.';
  const usr = JSON.stringify({
    board: { name: board.name, description: board.description.slice(0, 600), topics: board.dominantTopics.slice(0, 20), language: board.language, members: board.members },
    project: { sells_about: pillar.keyMessages.slice(0, 20), keywords: pillar.seoKeywords.slice(0, 30), languages: pillar.languages, avoid: pillar.forbiddenMsgs.slice(0, 15) },
    approach: approach && approach.trim() ? approach.trim().slice(0, 400) : undefined,
  });
  try {
    const c = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 220,
    });
    const txt = c.choices[0]?.message?.content || '{}';
    const j = JSON.parse(txt) as { fit?: number; reason?: string };
    const fit = Math.max(0, Math.min(100, Math.round(Number(j.fit ?? 0))));
    return {
      fit, topicTier: fit >= threshold ? 'TRACK' : 'LOW',
      reason: String(j.reason || '').slice(0, 200),
      model: DEFAULT_MODEL, tokens: c.usage?.total_tokens ?? 0,
    };
  } catch { return null; }
}

// Suggest a concrete bridging angle so the project can participate in a board it isn't obviously
// about (e.g. astrology project on an entertainment board → "analyze celebrities' natal charts").
export interface ApproachSuggestion { approach: string; fitLift: string; model: string; tokens: number }
// `samples` = live context scraped from the board page right now (recent topic titles / post +
// reply snippets). Grounding the suggestion in what people are ACTUALLY discussing yields a far
// more specific, authentic angle than the static catalog alone (request: "Đề xuất phải dựa vào
// context hiện tại của board đó như post title, reply").
export async function suggestApproach(board: BoardContext, pillar: PillarContext, samples?: string[]): Promise<ApproachSuggestion | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const clean = (samples || []).map((s) => String(s || '').replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 3).slice(0, 20);
  const sys = 'You propose ONE concrete, authentic angle for a marketing project to participate in a community board it is not obviously about — bridging the project topic to the board audience WITHOUT spam or forced selling. Be specific and actionable (a content angle, not a slogan). GROUND the angle in the board\'s recent_discussion samples when provided (reference what people are actually talking about). If no honest bridge exists, say so. Output strict JSON {"approach": "one actionable sentence", "fit_lift": "low|medium|high"}.';
  const usr = JSON.stringify({
    board: { name: board.name, description: board.description.slice(0, 600), topics: board.dominantTopics.slice(0, 20) },
    recent_discussion: clean.length ? clean : undefined,
    project: { sells_about: pillar.keyMessages.slice(0, 20), keywords: pillar.seoKeywords.slice(0, 20), avoid: pillar.forbiddenMsgs.slice(0, 12) },
  });
  try {
    const c = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: 160,
    });
    const j = JSON.parse(c.choices[0]?.message?.content || '{}') as { approach?: string; fit_lift?: string };
    const approach = String(j.approach || '').trim().slice(0, 400);
    if (!approach) return null;
    return { approach, fitLift: String(j.fit_lift || '').toLowerCase(), model: DEFAULT_MODEL, tokens: c.usage?.total_tokens ?? 0 };
  } catch { return null; }
}
