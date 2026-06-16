import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/habitats/list?projectId=X&platformKey=twitter[&status=target][&accountId=29]
// List habitats "đề xuất" của 1 project trên 1 platform → MOS2 Crew ext show panel
// "🗺 Gợi ý" (option, ẩn mặc định). Join brief lấy phase + joinStatus + approach (chiến lược)
// + tribe (audience). accountId → brief CỦA ĐÚNG account đó (per account×habitat); thiếu = brief mới nhất.
// Trả thêm accounts[] của project×platform cho ext account-picker.
// Sort: status='target' (chưa engage = đề xuất nên seed tiếp) lên đầu → rồi members desc.
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return errorResponse('DB not configured', 503);

  const p = new URL(req.url).searchParams;
  const projectId = (p.get('projectId') || '').trim();
  const platformKey = (p.get('platformKey') || '').trim();
  const status = (p.get('status') || '').trim();   // optional filter
  const accountIdRaw = (p.get('accountId') || '').trim();
  const accountId = accountIdRaw && /^\d+$/.test(accountIdRaw) ? Number(accountIdRaw) : null;  // brief theo account này
  if (!projectId || !platformKey) {
    return errorResponse('projectId + platformKey required', 400);
  }

  const rows = await db.execute(sql`
    SELECT
      h.id, h.name, h.kind, h.url, h.status, h.members, h.language,
      h.icon_url, h.last_sync_at, h.description,
      t.name AS tribe_name, t.slug AS tribe_slug,
      b.id AS brief_id, b.current_phase, b.join_status, b.approach_md, b.cadence, b.tone
    FROM habitats h
    LEFT JOIN tribes t ON t.id = h.tribe_id
    LEFT JOIN LATERAL (
      SELECT cb.id, cb.current_phase, cb.join_status, cb.approach_md, cb.cadence, cb.tone
      FROM community_briefs cb
      WHERE cb.habitat_id = h.id
        ${accountId ? sql`AND cb.account_id = ${accountId}` : sql``}
      ORDER BY cb.updated_at DESC LIMIT 1
    ) b ON TRUE
    WHERE h.project_id = ${projectId}
      AND h.platform_key = ${platformKey}
      ${status ? sql`AND h.status = ${status}` : sql``}
    ORDER BY (h.status = 'target') DESC, h.members DESC NULLS LAST, h.updated_at DESC
    LIMIT 300
  `);

  // Accounts của project×platform → ext account-picker (xem chiến lược per account)
  const accRows = await db.execute(sql`
    SELECT id, handle, status FROM platform_accounts
    WHERE project_id = ${projectId} AND platform_key = ${platformKey}
    ORDER BY (status = 'active') DESC, handle ASC
  `);
  const accounts = (accRows as unknown as Array<Record<string, unknown>>).map((a) => ({
    id: Number(a.id), handle: String(a.handle ?? ''), status: String(a.status ?? ''),
  }));

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
    // Chiến lược (cascade): approach = delta riêng target, tribe = audience
    tribe: r.tribe_name ? String(r.tribe_name) : '',
    tribeSlug: r.tribe_slug ? String(r.tribe_slug) : '',
    approachMd: r.approach_md ? String(r.approach_md) : '',
    cadence: r.cadence ? String(r.cadence) : '',
    tone: r.tone ? String(r.tone) : '',
  }));

  return NextResponse.json({ ok: true, projectId, platformKey, accountId, count: habitats.length, habitats, accounts });
}
