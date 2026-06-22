import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { projectInputsHash, boardInputsHash, membersBucket, type PillarSig } from '@/lib/board-radar';
import { keywordFit, forbiddenConflict, scoreBoardLLM, loadPillarContext, loadBoardContexts } from '@/lib/ai/board-scorer';

export const dynamic = 'force-dynamic';

const SCHEMA_VERSION = 1;
const THRESHOLD = 60;          // fit >= THRESHOLD → topic_tier=TRACK
const MAX_LLM_PER_REQ = 15;    // cost cap per request (cache skip handles the rest)

// POST /api/ext/boards/score  Body: { projectId, boardIds: number[] }
// Pipeline A handled by /badge overlay; here B (keyword prefilter) → B-HARD (forbidden) →
// C (LLM top-N) → write board_project_score. ACCOUNT-FREE. Cache-skip on matching dual hash.
export async function POST(req: Request) {
  const authErr = checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; boardIds?: number[] };
  const projectId = (body.projectId || '').trim();
  const boardIds = (body.boardIds || []).map(Number).filter(Number.isFinite).slice(0, 80);
  if (!projectId) return errorResponse('projectId required', 400);
  if (!boardIds.length) return okResponse({ scored: [] });

  // pillar + board context (shared loaders — DRY with /boards/approach). ACCOUNT-FREE.
  const pl = await loadPillarContext(db, projectId);
  if (!pl) return errorResponse('project has no content_pillars to score against', 200, { reason: 'no_pillars' });
  const pillar = pl.pillar;
  const sig: PillarSig = {
    ids: pl.ids, keyMessages: pillar.keyMessages, seoKeywords: pillar.seoKeywords, forbiddenMsgs: pillar.forbiddenMsgs,
    languages: pillar.languages, status: pl.status, tribeIds: [], threshold: THRESHOLD,
  };
  const projHash = projectInputsHash(sig);
  const boards = await loadBoardContexts(db, boardIds);

  // existing scores (for cache-skip)
  const existing = new Map<number, Record<string, unknown>>();
  const erows = (await db.execute(sql`
    SELECT board_id, project_inputs_hash, board_inputs_hash, schema_version, stale, fit, topic_tier, reason, approach
    FROM board_project_score WHERE project_id = ${projectId} AND tenant_id = 'self'
      AND board_id IN (${sql.join(boardIds.map((b) => sql`${b}`), sql`, `)})`)) as Array<Record<string, unknown>>;
  for (const e of erows) existing.set(Number(e.board_id), e);

  let llmUsed = 0;
  const scored: Array<{ boardId: number; fit: number; topicTier: string; reason: string; cached: boolean; via: string }> = [];

  for (const [boardId, board] of boards) {
    const boardHash = boardInputsHash({
      dominantTopics: board.dominantTopics, forbiddenTopics: board.forbiddenTopics,
      description: board.description, membersBucket: membersBucket(board.members), language: board.language,
    });
    const ex = existing.get(boardId);
    if (ex && !ex.stale && String(ex.project_inputs_hash) === projHash && String(ex.board_inputs_hash) === boardHash && Number(ex.schema_version) === SCHEMA_VERSION) {
      scored.push({ boardId, fit: Number(ex.fit), topicTier: String(ex.topic_tier), reason: String(ex.reason ?? ''), cached: true, via: 'cache' });
      continue;
    }
    // B-HARD forbidden. approach = per-board angle (re-scores higher if the bridge works).
    const approach = ex ? String(ex.approach ?? '') : '';
    let fit: number, tier: 'TRACK' | 'LOW', reason: string, model: string;
    if (forbiddenConflict(board, pillar)) {
      fit = 0; tier = 'LOW'; reason = 'forbidden-topic overlap'; model = 'rule';
    } else if (llmUsed < MAX_LLM_PER_REQ) {
      const res = await scoreBoardLLM(board, pillar, THRESHOLD, approach);
      if (res) { llmUsed++; fit = res.fit; tier = res.topicTier; reason = res.reason; model = res.model; }
      else { const kf = Math.round(keywordFit(board, pillar) * 100); fit = kf; tier = kf >= THRESHOLD ? 'TRACK' : 'LOW'; reason = 'keyword fallback (LLM off)'; model = 'keyword'; }
    } else {
      const kf = Math.round(keywordFit(board, pillar) * 100); fit = kf; tier = kf >= THRESHOLD ? 'TRACK' : 'LOW'; reason = 'keyword (LLM cap)'; model = 'keyword';
    }
    await db.execute(sql`
      INSERT INTO board_project_score (tenant_id, board_id, project_id, fit, topic_tier, reason, project_inputs_hash, board_inputs_hash, schema_version, model, stale, scored_at)
      VALUES ('self', ${boardId}, ${projectId}, ${fit}, ${tier}, ${reason}, ${projHash}, ${boardHash}, ${SCHEMA_VERSION}, ${model}, false, now())
      ON CONFLICT (tenant_id, board_id, project_id) DO UPDATE SET
        fit = ${fit}, topic_tier = ${tier}, reason = ${reason}, project_inputs_hash = ${projHash},
        board_inputs_hash = ${boardHash}, schema_version = ${SCHEMA_VERSION}, model = ${model}, stale = false,
        scored_at = now(), updated_at = now()`);
    scored.push({ boardId, fit, topicTier: tier, reason, cached: false, via: model });
  }

  return okResponse({ scored, llmUsed, projectInputsHash: projHash });
}
