import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';
import { ensureIdentity, ensureRelationship } from '@/lib/scene-people';

// POST /api/ext/scene/observe
// Passive participant logging — khi xem 1 thread/community, log MỌI participant
// (author) vào people (status 'observed', familiarity GIỮ NGUYÊN nếu đã có →
// observe KHÔNG inflate; familiarity chỉ lên từ tương tác thật qua /seeding/insights).
// Skip owned habitat (sân nhà). platform_key lấy từ habitat (khớp forward-fill →
// tránh duplicate row x/twitter). Idempotent. Body: { projectId, habitatId?, platformKey?, handles[] }
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as { projectId?: string; habitatId?: number; platformKey?: string; handles?: string[] };
  const projectId = (body.projectId || '').trim();
  const habitatId = Number(body.habitatId || 0) || null;
  const handles = Array.isArray(body.handles)
    ? [...new Set(body.handles.map((h) => String(h || '').replace(/^@/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 60)
    : [];
  if (!projectId || !handles.length) return errorResponse('projectId + handles required', 400);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  let pk = (body.platformKey || '').trim();
  if (habitatId) {
    const h = firstRow(await db.execute(sql`SELECT is_own, platform_key FROM habitats WHERE id = ${habitatId} LIMIT 1`));
    if (h && h.is_own === true) return NextResponse.json({ ok: true, skipped: 'owned', count: 0 });
    if (h && h.platform_key) pk = String(h.platform_key);
  }

  // 2-tier: identity GLOBAL (platform+handle) + relationship per project (account 0 = observed-level).
  let added = 0;
  for (const handle of handles) {
    const identityId = await ensureIdentity(db, pk, handle);
    if (!identityId) continue;
    const before = firstRow(await db.execute(sql`SELECT id FROM people WHERE project_id = ${projectId} AND identity_id = ${identityId} AND account_id = 0 LIMIT 1`));
    await ensureRelationship(db, { projectId, identityId, accountId: 0, platformKey: pk, handle });
    if (!before) added++;
  }
  return NextResponse.json({ ok: true, count: added, total: handles.length });
}
