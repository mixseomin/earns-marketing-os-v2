import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/habitats/match?platformKey=twitter&projectId=X&names=@a,@b,@c
// Trong danh sách handle (participants của 1 thread), trả các habitat ĐÃ TỒN TẠI
// trong project — ưu tiên cái CÓ brief. Dùng để: reply comment-của-comment map vào
// habitat/brief SẴN CÓ thay vì đoán root sai / tạo habitat thừa.
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb();
  if (!db) return errorResponse('DB not configured', 503);
  const p = new URL(req.url).searchParams;
  const platformKey = (p.get('platformKey') || '').trim();
  const projectId = (p.get('projectId') || '').trim();
  const names = (p.get('names') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return NextResponse.json({ ok: true, matches: [] });

  const lowered = names.map((n) => n.toLowerCase());
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.project_id, h.platform_key, h.status, h.mod_strictness, h.members, h.icon_url,
           (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
    FROM habitats h
    WHERE LOWER(h.name) IN (${sql.join(lowered.map((n) => sql`${n}`), sql`, `)})
      ${platformKey ? sql`AND h.platform_key = ${platformKey}` : sql``}
      ${projectId ? sql`AND h.project_id = ${projectId}` : sql``}
  `);
  const matches = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), name: String(r.name), projectId: String(r.project_id),
    platformKey: r.platform_key ? String(r.platform_key) : null,
    status: r.status ? String(r.status) : null,
    modStrictness: r.mod_strictness ? String(r.mod_strictness) : null,
    members: r.members != null ? Number(r.members) : null,
    iconUrl: r.icon_url ? String(r.icon_url) : null,
    briefId: r.brief_id ? Number(r.brief_id) : null,
    hasBrief: !!r.brief_id,
  }));
  // ưu tiên: có brief trước, rồi theo thứ tự names truyền vào (direct → root)
  matches.sort((a, b) => (Number(b.hasBrief) - Number(a.hasBrief)) || (lowered.indexOf(a.name.toLowerCase()) - lowered.indexOf(b.name.toLowerCase())));
  return NextResponse.json({ ok: true, matches });
}
