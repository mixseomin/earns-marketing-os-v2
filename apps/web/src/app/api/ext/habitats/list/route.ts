import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/habitats/list?projectId=X&platformKey=twitter[&status=target]
// List habitats "đề xuất" của 1 project trên 1 platform → MOS2 Crew ext show panel
// "🗺 Gợi ý" (option, ẩn mặc định). Join brief mới nhất/habitat lấy phase + joinStatus.
// Sort: status='target' (chưa engage = đề xuất nên seed tiếp) lên đầu → rồi members desc.
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB not configured' }, { status: 503 });

  const p = new URL(req.url).searchParams;
  const projectId = (p.get('projectId') || '').trim();
  const platformKey = (p.get('platformKey') || '').trim();
  const status = (p.get('status') || '').trim();   // optional filter
  if (!projectId || !platformKey) {
    return NextResponse.json({ ok: false, error: 'projectId + platformKey required' }, { status: 400 });
  }

  const rows = await db.execute(sql`
    SELECT
      h.id, h.name, h.kind, h.url, h.status, h.members, h.language,
      h.icon_url, h.last_sync_at, h.description,
      b.id AS brief_id, b.current_phase, b.join_status
    FROM habitats h
    LEFT JOIN LATERAL (
      SELECT cb.id, cb.current_phase, cb.join_status
      FROM community_briefs cb
      WHERE cb.habitat_id = h.id
      ORDER BY cb.updated_at DESC LIMIT 1
    ) b ON TRUE
    WHERE h.project_id = ${projectId}
      AND h.platform_key = ${platformKey}
      ${status ? sql`AND h.status = ${status}` : sql``}
    ORDER BY (h.status = 'target') DESC, h.members DESC NULLS LAST, h.updated_at DESC
    LIMIT 300
  `);

  const habitats = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    kind: String(r.kind ?? ''),
    url: r.url ? String(r.url) : '',
    status: String(r.status ?? 'target'),
    members: Number(r.members ?? 0),
    language: String(r.language ?? ''),
    iconUrl: r.icon_url ? String(r.icon_url) : '',
    description: r.description ? String(r.description).slice(0, 200) : '',
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at as string).toISOString() : null,
    briefId: r.brief_id ? Number(r.brief_id) : null,
    hasBrief: !!r.brief_id,
    currentPhase: r.current_phase ? String(r.current_phase) : '',
    joinStatus: r.join_status ? String(r.join_status) : '',
  }));

  return NextResponse.json({ ok: true, projectId, platformKey, count: habitats.length, habitats });
}
