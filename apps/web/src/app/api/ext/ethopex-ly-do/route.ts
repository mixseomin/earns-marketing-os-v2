import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiEthopex } from '@mos2/db/ethopex';

// LÝ DO ĐÓNG CAMP cho extension trên trang Report của Ethopex (anh 22/10/2026: "làm extension trên page này để khi hover vào camp nào đóng thì show lý do").
// Chỉ đọc. Khoá bằng mã riêng (studio xv_khoa_ngoai['ethopex_ext'].token, gửi qua ?k=) vì trang app.ethopex.dev không mang phiên mos2; CORS chỉ mở cho app.ethopex.dev.
//   GET ?k=…           → { camp: { "<id>": { luc, luat, ai, chi, thu, roi } } } — lệnh tắt gần nhất (chưa bật lại) theo nhật ký luật + chi/thu tháng
//   GET ?k=…&id=<id>   → camp không có trong nhật ký luật: đọc lịch sử Ethopex (ai tắt, qua đường nào)
type Nk = { luc: string; viec: string; id: number; ok: boolean; luat: string; ai: string };
const CORS = { 'access-control-allow-origin': 'https://app.ethopex.dev', 'access-control-allow-methods': 'GET', 'cache-control': 'no-store' };
let dem: { luc: number; so: Record<string, { chi: number; thu: number }> } | null = null;

export async function OPTIONS() { return new NextResponse(null, { headers: CORS }); }

export async function GET(req: Request) {
  const u = new URL(req.url); const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'thiếu DB' }, { status: 500, headers: CORS });
  const r = (await db.execute(sql`SELECT gia_tri->>'token' AS t FROM xv_khoa_ngoai WHERE ten = 'ethopex_ext'`)) as unknown as { t: string | null }[];
  if (!r[0]?.t || u.searchParams.get('k') !== r[0].t) return NextResponse.json({ ok: false, error: 'sai mã' }, { status: 403, headers: CORS });
  const id = Number(u.searchParams.get('id') || 0);
  if (id) {
    const h = await goiEthopex<{ data: { created_at: string; actor_name?: string; actor_type?: string; actor_type_label?: string; source_label?: string; changes?: { field: string; new: unknown }[] }[] }>(db, `/api/v1/campaigns/${id}/history`);
    const x = h.ok ? h.data.data.find((d) => (d.changes ?? []).some((c) => c.field === 'state' && c.new === 'PAUSED')) : null;
    return NextResponse.json({ ok: true, lich_su: x ? { luc: x.created_at, ai: x.actor_name ?? x.actor_type_label ?? x.actor_type ?? '?', qua: x.source_label ?? null } : null }, { headers: CORS });
  }
  const nk = ((await db.execute(sql`SELECT x FROM xv_khoa_ngoai, jsonb_array_elements(gia_tri) x WHERE ten = 'ethopex_nhat_ky' AND x->>'viec' IN ('tat', 'bat') AND (x->>'ok')::boolean`)) as unknown as { x: Nk }[]).map((d) => d.x);
  const cuoi = new Map<number, Nk>();
  for (const n of nk) cuoi.set(Number(n.id), n);   // nhật ký ghi theo thứ tự thời gian → dòng sau đè dòng trước
  if (!dem || Date.now() - dem.luc > 120_000) {
    const hn = new Date(Date.now() + 7 * 3600_000); const tu = `${hn.toISOString().slice(0, 8)}01`; const den = new Date(hn.getTime() + 86400_000).toISOString().slice(0, 10);
    const b = await goiEthopex<{ rows: { campaign_id: number; cost?: string | number; revenue?: string | number }[] }>(db, '/api/v1/report', { method: 'POST',
      body: { columns: ['campaign_name', 'cost', 'revenue'], filters: {}, metric_conditions: [], limit: 2000, page: 1, page_size: 2000, date_from: tu, date_to: den } });
    const so: Record<string, { chi: number; thu: number }> = {};
    if (b.ok) for (const x of b.data.rows) so[String(x.campaign_id)] = { chi: Number(x.cost ?? 0), thu: Number(x.revenue ?? 0) };
    dem = { luc: Date.now(), so };
  }
  const camp: Record<string, { luc: string; luat: string; ai: string; chi: number | null; thu: number | null; roi: number | null }> = {};
  for (const [k, n] of cuoi) {
    if (n.viec !== 'tat') continue;
    const s = dem.so[String(k)];
    camp[String(k)] = { luc: n.luc, luat: n.luat, ai: n.ai, chi: s ? +s.chi.toFixed(2) : null, thu: s ? +s.thu.toFixed(2) : null, roi: s && s.chi ? Math.round(((s.thu - s.chi) / s.chi) * 100) : null };
  }
  return NextResponse.json({ ok: true, camp }, { headers: CORS });
}
