import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiEthopex } from '@mos2/db/ethopex';
import { docEthopex } from '@/lib/ethopex-doc';

// LÝ DO ĐÓNG CAMP cho extension trên trang Report của Ethopex (anh 22/10/2026: "làm extension trên page này để khi hover vào camp nào đóng thì show lý do").
// Chỉ đọc. Khoá bằng mã riêng (studio xv_khoa_ngoai['ethopex_ext'].token, gửi qua ?k=) vì trang app.ethopex.dev không mang phiên mos2; CORS chỉ mở cho app.ethopex.dev.
//   GET ?k=…           → { camp: { "<id>": { luc, luat, ai, chi, thu, roi } } } — lệnh tắt gần nhất (chưa bật lại) theo nhật ký luật + chi/thu tháng
//   GET ?k=…&id=<id>   → camp không có trong nhật ký luật: đọc lịch sử Ethopex (ai tắt, qua đường nào)
//   GET ?k=…&phim=<tên> → CREATIVE CỦA PHIM + CHỈ SỐ (anh 22/10/2026: "hover vào phim xem được creative tương ứng… và các chỉ số liên quan"):
//                         camp nối theo tên phim chuẩn hoá (Report Ethopex nhóm theo tên content, không trả content_id) → gom theo creative:
//                         ảnh · video · dạng · đạt luật CTA · camp dùng (trạng thái, ngân sách) · chi/thu/ROI tháng · hôm nay · hôm qua
type Nk = { luc: string; viec: string; id: number; ok: boolean; luat: string; ai: string };
const CORS = { 'access-control-allow-origin': 'https://app.ethopex.dev', 'access-control-allow-methods': 'GET', 'cache-control': 'no-store' };
let dem: { luc: number; so: Record<string, { chi: number; thu: number }> } | null = null;
// dữ liệu camp cho chế độ ?phim= giữ 3 phút (docEthopex đọc ~150 camp từ Ethopex, lượt đầu ~10s) — extension gọi làm nóng khi mở trang
let du: { luc: number; d: Awaited<ReturnType<typeof docEthopex>> } | null = null;
// TRẢ NGAY BẢN ĐANG GIỮ, làm mới ở nền khi quá 3 phút (anh 22/10/2026 "có cách nào tải nhanh hơn": lượt nguội chờ đọc lại cả Ethopex mất 11,7s)
let dangLam: Promise<void> | null = null;
const lamMoi = () => (dangLam ??= docEthopex(true).then((d) => { du = { luc: Date.now(), d }; }).catch(() => {}).finally(() => { dangLam = null; }));
const camps = async () => { if (!du) await lamMoi(); else if (Date.now() - du.luc > 180_000) void lamMoi(); return du!.d; };

const chuan = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(doblado\)|（dubbed）|\(dubbed\)/g, '').replace(/[^a-z0-9]/g, '');
// lõi tên camp: bỏ mã lô đầu ("2110ns ") + phần " EN - dạng …" → so hai chiều (camp cũ ghi tên tắt "The Rejected Luna")
const loi = (t: string) => chuan(t.replace(/^\S+\s+/, '').split(/ (?:EN|ES) - /)[0] ?? '');
type Du = Awaited<ReturnType<typeof docEthopex>>;
type ChoNb = Record<string, { luc: string; loi: string }>;
function motPhim(d: Du, dat: Set<string>, phim: string, choNb: ChoNb = {}) {
  const k = chuan(phim);
  if (k.length < 6) return { so_camp: 0, creative: [] };
  const khop = (a: string) => a.length >= 8 && (a.includes(k) || k.includes(a));
  const cua = d.camps.filter((c) => khop(loi(c.ten)) || (!!c.phim && khop(chuan(c.phim))));
  const nhom = new Map<number, typeof cua>();
  for (const c of cua) { const key = c.creative_id ?? -c.id; nhom.set(key, [...(nhom.get(key) ?? []), c]); }
  const cong = (ds: typeof cua, f: (c: (typeof cua)[number]) => { chi: number; thu: number }) => ds.reduce((a, c) => ({ chi: a.chi + f(c).chi, thu: a.thu + f(c).thu }), { chi: 0, thu: 0 });
  const so = (x: { chi: number; thu: number }) => ({ chi: +x.chi.toFixed(2), thu: +x.thu.toFixed(2), roi: x.chi >= 0.1 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null });
  const creative = [...nhom.entries()].map(([cr, ds]) => ({
    creative_id: cr > 0 ? cr : null, anh: ds.find((c) => c.anh)?.anh ?? null, video: ds.find((c) => c.video)?.video ?? null, dang: ds[0]!.dang_creative,
    doan: (ds[0]!.ten.match(/(\d+-\d+s)/) ?? [])[1] ?? null, cta_dat: cr > 0 && dat.has(String(cr)),
    camp: ds.map((c) => ({ id: c.id, trang_thai: c.trang_thai, ngan_sach: c.ngan_sach, moi: c.thang.chi === 0, cho_nb: choNb[String(c.id)] ?? null, ...so(c.thang) })).sort((a, b) => b.thu - a.thu),
    thang: so(cong(ds, (c) => c.thang)), hom_nay: so(cong(ds, (c) => c.hom_nay)), hom_qua: so(cong(ds, (c) => c.hom_qua)),
  })).sort((a, b) => b.thang.thu - a.thang.thu);
  return { so_camp: cua.length, creative };
}

export async function OPTIONS() { return new NextResponse(null, { headers: CORS }); }

export async function GET(req: Request) {
  const u = new URL(req.url); const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'thiếu DB' }, { status: 500, headers: CORS });
  const r = (await db.execute(sql`SELECT gia_tri->>'token' AS t FROM xv_khoa_ngoai WHERE ten = 'ethopex_ext'`)) as unknown as { t: string | null }[];
  if (!r[0]?.t || u.searchParams.get('k') !== r[0].t) return NextResponse.json({ ok: false, error: 'sai mã' }, { status: 403, headers: CORS });
  if (u.searchParams.get('bao')) console.log(`ethopex-nap BAO=${u.searchParams.get('bao')} ua=${(req.headers.get('user-agent') ?? '').slice(0, 90)}`);
  const phim = u.searchParams.get('phim'), phims = u.searchParams.get('phims');
  if (phim === '__lam_nong__') { await camps(); return NextResponse.json({ ok: true, creative: [] }, { headers: CORS }); }
  if (phim || phims) {
    const d = await camps();
    const dat = new Set(Object.keys((((await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_cta_dat'`)) as unknown as { gia_tri: Record<string, unknown> }[])[0]?.gia_tri) ?? {}));
    // CAMP CHỜ (anh 22/10/2026 "show thêm cả camp đang chờ vào đây"): lần nhân bản gần nhất của camp thắng bị cổng chặn (CTA cũ, chưa soát 18+…) → lý do
    const nb = ((await db.execute(sql`SELECT x FROM xv_khoa_ngoai, jsonb_array_elements(gia_tri) x WHERE ten = 'ethopex_nhat_ky' AND x->>'viec' = 'nhan_ban'`)) as unknown as { x: { goc?: number; id: number; ok: boolean; loi: string | null; luc: string } }[]).map((r) => r.x);
    const choNb: ChoNb = {}; for (const n of nb) { const g = String(n.goc ?? n.id); if (n.ok) delete choNb[g]; else choNb[g] = { luc: n.luc, loi: n.loi ?? '' }; }
    if (phim) return NextResponse.json({ ok: true, phim, ...motPhim(d, dat, phim, choNb) }, { headers: CORS });
    // NHIỀU PHIM MỘT LƯỢT (?phims=tên1\ntên2…): extension tải sẵn mọi phim đang hiện trên trang → rê vào là có ngay
    const ra: Record<string, ReturnType<typeof motPhim>> = {};
    for (const t of phims!.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 100)) ra[t] = motPhim(d, dat, t, choNb);
    return NextResponse.json({ ok: true, phim: ra }, { headers: CORS });
  }
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
