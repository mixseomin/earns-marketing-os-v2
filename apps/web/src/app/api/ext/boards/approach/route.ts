import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { suggestApproach, loadPillarContext, loadBoardContexts } from '@/lib/ai/board-scorer';

export const dynamic = 'force-dynamic';

// POST /api/ext/boards/approach — one editor for everything that drives a board's badge.
//   { suggest:true, samples?: string[] }         → LLM proposes a bridging angle (grounded in the
//                                                   board's live recent_discussion) — no save.
//   { approach: "..." }                          → save the angle (board×project) + mark score stale.
//   { manualTier: "SKIP"|"GO"|null }             → user override: dismiss / pin / clear (read-time only).
//   { signals: { dominantTopics, forbiddenTopics, description, language } }
//                                                → edit the catalog relevance factors the LLM scores
//                                                  against (board-level). Changes board_inputs_hash →
//                                                  next /boards/score auto re-scores (no stale needed).
// All ACCOUNT-FREE. approach/manualTier are per-(board×project); signals are per-board (shared).
export async function POST(req: Request) {
  const authErr = checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string; boardId?: number; approach?: string; suggest?: boolean; samples?: string[];
    manualTier?: string | null; playbookId?: number;
    signals?: { dominantTopics?: string[]; forbiddenTopics?: string[]; description?: string; language?: string };
  };
  const projectId = (body.projectId || '').trim();
  const boardId = Number(body.boardId);
  if (!projectId) return errorResponse('projectId required', 400);
  if (!Number.isFinite(boardId)) return errorResponse('boardId required', 400);

  // ── suggest mode (no save) — grounded in live page samples ──
  if (body.suggest) {
    const pl = await loadPillarContext(db, projectId);
    if (!pl) return errorResponse('project has no content_pillars', 200, { reason: 'no_pillars' });
    const board = (await loadBoardContexts(db, [boardId])).get(boardId);
    if (!board) return errorResponse('board not found', 404);
    const samples = Array.isArray(body.samples) ? body.samples.map((s) => String(s || '')).slice(0, 25) : [];
    const s = await suggestApproach(board, pl.pillar, samples);
    if (!s) return errorResponse('AI unavailable or no honest bridge', 200, { reason: 'no_suggestion' });
    return okResponse({ suggested: s.approach, fitLift: s.fitLift, usedSamples: samples.length });
  }

  // ── manual tier override (dismiss / pin / clear) — read-time, no re-score ──
  if ('manualTier' in body) {
    const mtRaw = body.manualTier == null ? null : String(body.manualTier).toUpperCase();
    const mt = mtRaw === 'SKIP' || mtRaw === 'GO' ? mtRaw : null;
    await db.execute(sql`
      INSERT INTO board_project_score (tenant_id, board_id, project_id, fit, topic_tier, reason, project_inputs_hash, board_inputs_hash, manual_tier)
      VALUES ('self', ${boardId}, ${projectId}, 0, 'LOW', '', '', '', ${mt})
      ON CONFLICT (tenant_id, board_id, project_id) DO UPDATE SET manual_tier = ${mt}, updated_at = now()`);
    return okResponse({ ok: true, manualTier: mt });
  }

  // ── edit catalog relevance factors (board-level) — board_inputs_hash changes → auto re-score ──
  if (body.signals) {
    const s = body.signals;
    const cleanArr = (v: unknown) => Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 40) : [];
    const dom = cleanArr(s.dominantTopics), forb = cleanArr(s.forbiddenTopics);
    const desc = String(s.description ?? '').slice(0, 1200);
    const lang = String(s.language ?? '').slice(0, 40);
    await db.execute(sql`
      UPDATE platform_boards SET dominant_topics = ${JSON.stringify(dom)}::jsonb,
        forbidden_topics = ${JSON.stringify(forb)}::jsonb, description = ${desc}, language = ${lang}, updated_at = now()
      WHERE id = ${boardId} AND tenant_id = 'self'`);
    return okResponse({ ok: true, signals: { dominantTopics: dom, forbiddenTopics: forb, description: desc, language: lang } });
  }

  // ── save the angle (mark stale → re-score uses the angle) ──
  const approach = String(body.approach ?? '').slice(0, 1000);
  // optional: angle applied from the shared library → link + bump its popularity counter.
  const playbookId = Number.isFinite(Number(body.playbookId)) && Number(body.playbookId) > 0 ? Number(body.playbookId) : null;
  await db.execute(sql`
    INSERT INTO board_project_score (tenant_id, board_id, project_id, fit, topic_tier, reason, project_inputs_hash, board_inputs_hash, approach, approach_playbook_id, stale)
    VALUES ('self', ${boardId}, ${projectId}, 0, 'LOW', '', '', '', ${approach}, ${playbookId}, true)
    ON CONFLICT (tenant_id, board_id, project_id) DO UPDATE SET approach = ${approach}, approach_playbook_id = ${playbookId}, stale = true, updated_at = now()`);
  if (playbookId) await db.execute(sql`UPDATE approach_playbooks SET uses = uses + 1, last_used_at = now(), updated_at = now() WHERE id = ${playbookId} AND tenant_id = 'self'`);
  return okResponse({ ok: true, approach, playbookId });
}
