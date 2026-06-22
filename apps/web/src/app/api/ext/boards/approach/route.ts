import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { suggestApproach, loadPillarContext, loadBoardContexts } from '@/lib/ai/board-scorer';

export const dynamic = 'force-dynamic';

// POST /api/ext/boards/approach
//   { projectId, boardId, suggest: true }    → LLM proposes a bridging angle (no save) → { suggested, fitLift }
//   { projectId, boardId, approach: "..." }  → save the angle + mark score stale → { ok, approach }
// Per-(board×project) angle, ACCOUNT-FREE. Low fit is often the wrong approach, not an unusable
// board; saving an angle marks board_project_score.stale so the next /boards/score re-scores WITH it.
export async function POST(req: Request) {
  const authErr = checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; boardId?: number; approach?: string; suggest?: boolean };
  const projectId = (body.projectId || '').trim();
  const boardId = Number(body.boardId);
  if (!projectId) return errorResponse('projectId required', 400);
  if (!Number.isFinite(boardId)) return errorResponse('boardId required', 400);

  // ── suggest mode (no save) ──
  if (body.suggest) {
    const pl = await loadPillarContext(db, projectId);
    if (!pl) return errorResponse('project has no content_pillars', 200, { reason: 'no_pillars' });
    const board = (await loadBoardContexts(db, [boardId])).get(boardId);
    if (!board) return errorResponse('board not found', 404);
    const s = await suggestApproach(board, pl.pillar);
    if (!s) return errorResponse('AI unavailable or no honest bridge', 200, { reason: 'no_suggestion' });
    return okResponse({ suggested: s.approach, fitLift: s.fitLift });
  }

  // ── save mode (mark stale → re-score uses the angle) ──
  const approach = String(body.approach ?? '').slice(0, 1000);
  await db.execute(sql`
    INSERT INTO board_project_score (tenant_id, board_id, project_id, fit, topic_tier, reason, project_inputs_hash, board_inputs_hash, approach, stale)
    VALUES ('self', ${boardId}, ${projectId}, 0, 'LOW', '', '', '', ${approach}, true)
    ON CONFLICT (tenant_id, board_id, project_id) DO UPDATE SET approach = ${approach}, stale = true, updated_at = now()`);
  return okResponse({ ok: true, approach });
}
