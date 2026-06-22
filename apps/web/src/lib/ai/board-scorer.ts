// board-scorer.ts — Seeding Radar Phase 3 fit scoring. ACCOUNT-FREE (board topics vs project
// pillars only). Pipeline: keyword prefilter (B) → forbidden hard-exclude (B-HARD) → LLM (C).
// NOT brief-suggest (that is account-coupled). See decision 2026-06-22-seeding-radar.
import { getOpenAI, DEFAULT_MODEL } from './openai';

export interface PillarContext { keyMessages: string[]; seoKeywords: string[]; forbiddenMsgs: string[]; languages: string[] }
export interface BoardContext { name: string; description: string; dominantTopics: string[]; forbiddenTopics: string[]; language: string; members: number }
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

// C) LLM topic-fit. Returns null on AI-disabled / parse fail (caller falls back to keyword tier).
export async function scoreBoardLLM(board: BoardContext, pillar: PillarContext, threshold: number): Promise<ScoreResult | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const sys = 'You score how well a community board fits a marketing project for organic seeding. Output strict JSON {"fit": int 0-100, "reason": "one short sentence"}. fit = topic relevance + audience match only; ignore account/posting mechanics. Be skeptical: generic/off-topic boards score low.';
  const usr = JSON.stringify({
    board: { name: board.name, description: board.description.slice(0, 600), topics: board.dominantTopics.slice(0, 20), language: board.language, members: board.members },
    project: { sells_about: pillar.keyMessages.slice(0, 20), keywords: pillar.seoKeywords.slice(0, 30), languages: pillar.languages, avoid: pillar.forbiddenMsgs.slice(0, 15) },
  });
  try {
    const c = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 200,
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
