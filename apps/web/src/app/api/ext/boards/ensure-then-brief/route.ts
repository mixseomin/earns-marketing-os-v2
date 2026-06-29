import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { resolveOrCreateBoard, boardKeyFromUrl } from '@/lib/board-radar';
import { defaultKindForPlatformKey } from '@/lib/habitat-platform-map';

export const dynamic = 'force-dynamic';

const VALID_JOIN = new Set(['not_joined', 'pending', 'joined', 'rejected', 'kicked', 'left']);
// platform_key → default habitat kind = 1 nguồn duy nhất (PLATFORM_TO_KIND). Trước đây re-derive
// chỉ reddit/discord/facebook, gộp twitter/telegram/linkedin/slack/youtube → 'forum' SAI →
// adopt board X/telegram/linkedin qua "Track" bị đóng dấu 'forum', vỡ platformKeysForHabitatKind (bug P0).
const kindFor = (platformKey: string | null): string => defaultKindForPlatformKey(platformKey) ?? 'forum';

// POST /api/ext/boards/ensure-then-brief
// Body: { projectId, accountId, boardId?, url?, name?, platformKey?, technologyKey?, joinStatus? }
// The inline ADD→GO action: ensure catalog board → adopt as project habitat (board_id set) →
// upsert a BARE community_brief (account×habitat). Does NOT run the LLM suggestBrief (deferred
// to dashboard). Idempotent: respects habitats dedup (mig-0104) + community_briefs UNIQUE.
export async function POST(req: Request) {
  const authErr = await checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string; accountId?: number; boardId?: number; url?: string; name?: string;
    platformKey?: string | null; technologyKey?: string | null; joinStatus?: string;
  };
  const projectId = (body.projectId || '').trim();
  const accountId = body.accountId != null && Number.isFinite(Number(body.accountId)) ? Number(body.accountId) : null;
  if (!projectId) return errorResponse('projectId required', 400);
  // accountId optional: absent = ADOPT-ONLY (board → project habitat, no brief). The inline
  // "Track" badge action uses this when no seeding account is bound yet (TRACK → ADD).
  const joinStatus = body.joinStatus && VALID_JOIN.has(body.joinStatus) ? body.joinStatus : 'not_joined';

  // 1. resolve catalog board
  const key = body.url ? boardKeyFromUrl(body.url) : null;
  let boardId = Number(body.boardId);
  let platformKey: string | null = body.platformKey !== undefined ? body.platformKey : (key?.platformKey ?? null);
  let name = (body.name && body.name.trim()) || key?.name || '';
  let url = body.url ?? key?.url ?? null;
  if (!Number.isFinite(boardId)) {
    if (!name) return errorResponse('boardId or resolvable url/name required', 400);
    boardId = await resolveOrCreateBoard(db, {
      platformKey, technologyKey: body.technologyKey ?? null, externalId: key?.externalId ?? null,
      url, name, privacy: '',
    });
  }
  // backfill identity fields from the board row when caller only gave boardId
  const br = (await db.execute(sql`SELECT platform_key, technology_key, name, url, description, members, privacy FROM platform_boards WHERE id = ${boardId} LIMIT 1`)) as Array<Record<string, unknown>>;
  const board = br[0];
  if (!board) return errorResponse('board not found', 404);
  platformKey = board.platform_key != null ? String(board.platform_key) : platformKey;
  name = name || String(board.name ?? '');
  url = url || (board.url != null ? String(board.url) : null);
  const technologyKey = body.technologyKey ?? (board.technology_key != null ? String(board.technology_key) : null);

  // 2. adopt board as a project habitat (dedup mig-0104: project_id, platform_key, lower(name))
  let habitatId: number;
  const existing = (await db.execute(sql`SELECT id, board_id FROM habitats WHERE project_id = ${projectId} AND platform_key IS NOT DISTINCT FROM ${platformKey} AND lower(name) = lower(${name}) LIMIT 1`)) as Array<Record<string, unknown>>;
  if (existing[0]) {
    habitatId = Number(existing[0].id);
    if (existing[0].board_id == null) await db.execute(sql`UPDATE habitats SET board_id = ${boardId}, updated_at = now() WHERE id = ${habitatId}`);
  } else {
    const ins = (await db.execute(sql`
      INSERT INTO habitats (tenant_id, project_id, kind, name, url, platform_key, technology_key, board_id,
        description, members, privacy)
      VALUES ('self', ${projectId}, ${kindFor(platformKey)}, ${name}, ${url}, ${platformKey}, ${technologyKey}, ${boardId},
        ${String(board.description ?? '')}, ${Number(board.members ?? 0)}, ${String(board.privacy ?? '')})
      ON CONFLICT (project_id, platform_key, lower(name)) DO UPDATE SET board_id = COALESCE(habitats.board_id, ${boardId}), updated_at = now()
      RETURNING id`)) as Array<Record<string, unknown>>;
    if (ins[0]) habitatId = Number(ins[0].id);
    else {
      const re = (await db.execute(sql`SELECT id FROM habitats WHERE project_id = ${projectId} AND platform_key IS NOT DISTINCT FROM ${platformKey} AND lower(name) = lower(${name}) LIMIT 1`)) as Array<Record<string, unknown>>;
      habitatId = Number(re[0]?.id);
    }
  }
  if (!Number.isFinite(habitatId)) return errorResponse('could not adopt habitat', 500);

  // 3. upsert a bare brief (account × habitat) — no LLM. Skipped when adopt-only (no account).
  // Pipeline: the account-free DISCOVERY angle (board_project_score.approach, possibly from the
  // shared library) FLOWS INTO the brief's execution approach_md on FIRST create. ON CONFLICT only
  // touches join_status → an existing brief keeps its own (richer) approach. One concept, two stages.
  let briefId: number | null = null;
  let seededApproach = false;
  if (accountId != null) {
    const sa = (await db.execute(sql`SELECT approach FROM board_project_score WHERE board_id = ${boardId} AND project_id = ${projectId} AND tenant_id = 'self' LIMIT 1`)) as Array<Record<string, unknown>>;
    const seedApproach = sa[0]?.approach ? String(sa[0].approach).trim() : '';
    const bins = (await db.execute(sql`
      INSERT INTO community_briefs (tenant_id, project_id, account_id, habitat_id, join_status, approach_md)
      VALUES ('self', ${projectId}, ${accountId}, ${habitatId}, ${joinStatus}, ${seedApproach})
      ON CONFLICT (account_id, habitat_id) DO UPDATE SET join_status = ${joinStatus}, updated_at = now()
      RETURNING id, (xmax = 0) AS inserted`)) as Array<Record<string, unknown>>;
    briefId = bins[0] ? Number(bins[0].id) : null;
    seededApproach = !!(seedApproach && bins[0]?.inserted);
  }

  return okResponse({ boardId, habitatId, briefId, joinStatus: accountId != null ? joinStatus : null, seededApproach });
}
