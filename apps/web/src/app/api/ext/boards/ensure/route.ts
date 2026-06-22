import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { resolveOrCreateBoard, boardKeyFromUrl } from '@/lib/board-radar';

export const dynamic = 'force-dynamic';

// POST /api/ext/boards/ensure
// Body: { url?, name?, platformKey?, technologyKey?, externalId?, description?, members?, privacy? }
// Resolve-or-create the SHARED platform_board (Layer 1). url alone is enough — the engine
// discriminator derives platformKey/externalId/name (mirrors /habitats/resolve). Idempotent;
// converges with the migration-0107 name-keyed backfill (fills external_id on first real hit).
export async function POST(req: Request) {
  const authErr = checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json().catch(() => ({}))) as {
    url?: string; name?: string; platformKey?: string | null; technologyKey?: string | null;
    externalId?: string | null; description?: string; members?: number; privacy?: string;
  };

  // derive identity from url when not explicitly given
  const key = body.url ? boardKeyFromUrl(body.url) : null;
  const name = (body.name && body.name.trim()) || key?.name || '';
  if (!name) return errorResponse('name or resolvable url required', 400);

  try {
    const boardId = await resolveOrCreateBoard(db, {
      platformKey: body.platformKey !== undefined ? body.platformKey : (key?.platformKey ?? null),
      technologyKey: body.technologyKey ?? null,
      externalId: body.externalId !== undefined ? body.externalId : (key?.externalId ?? null),
      url: body.url ?? key?.url ?? null,
      name,
      description: body.description,
      members: body.members,
      privacy: body.privacy,
    });
    return okResponse({ boardId });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'ensure failed', 500);
  }
}
