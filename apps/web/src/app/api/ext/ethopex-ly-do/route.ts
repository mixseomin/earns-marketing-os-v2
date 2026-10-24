import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiEthopex } from '@mos2/db/ethopex';
import { docEthopex } from '@/lib/ethopex-doc';
import { chamLuat, LUAT_THEO_MA } from '@/lib/ethopex-luat';

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
// DẠNG CREATIVE theo tên camp (badge ở danh sách Report — anh 23/10/2026): kể chuyện · cảnh thật · cảnh cuối · phim dài · làm mới
const LOAI = ['ke chuyen', 'canh that', 'canh cuoi', 'phim dai', 'lam moi'] as const;
const loaiCua = (ten: string) => LOAI.find((l) => ten.toLowerCase().includes(l)) ?? 'khac';
const laLich = (c: { bat_dau?: string | null }) => !!c.bat_dau && Date.parse(c.bat_dau.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) > Date.now();   // Scheduled: Ad Set chưa tới giờ chạy
// ĐOẠN VIDEO của creative (studio kinh_thanh.ethopex: content + tu + den, làm tròn giây) — hai creative cùng mốc = cùng đoạn (bản CTA cũ ↔ bản sửa).
// Tên camp KHÔNG dùng được: camp nhân bản / bản lô khác mang tên khác mà vẫn dùng cùng creative (24/10/2026: #54182 có 9 camp, đếm theo tên ra 7).
let doanNho: { luc: number; m: Map<number, string> } | null = null;
async function napDoan(): Promise<Map<number, string>> {
  if (doanNho && Date.now() - doanNho.luc < 300_000) return doanNho.m;
  const db = getDb(); const m = new Map<number, string>();
  if (db) for (const r of (await db.execute(sql`SELECT (kinh_thanh->'ethopex'->>'creative_id')::int AS cr, kinh_thanh->'ethopex'->>'content_id' AS ct, round((kinh_thanh->'ethopex'->>'tu')::numeric) AS tu, round((kinh_thanh->'ethopex'->>'den')::numeric) AS den
      FROM xv_phim WHERE project = 'ethopex' AND kinh_thanh->'ethopex' ? 'creative_id' AND coalesce(kinh_thanh->'ethopex'->>'tu', '') <> ''`)) as unknown as { cr: number; ct: string; tu: string; den: string }[]) m.set(Number(r.cr), `${r.ct}:${r.tu}-${r.den}`);
  // bản sửa CTA cắt lại cùng CẢNH từ tập sạch → mốc giây khác bản cũ (video QC spy): nối theo sổ ethopex_cta_thay {cũ: mới} — cũ mang đoạn của mới
  if (db) { const t = ((await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_cta_thay'`)) as unknown as { gia_tri: Record<string, number> | null }[])[0]?.gia_tri ?? {};
    for (const [cu, moi] of Object.entries(t)) m.set(Number(cu), m.get(Number(moi)) ?? `cr:${moi}`); }
  doanNho = { luc: Date.now(), m }; return m;
}
let DOAN = new Map<number, string>();
// PHIM BÃO HOÀ (anh 25/10/2026 "cảnh báo trên cả ext app.ethopex"): etp.phim_bao_hoa do canh-bao.py tính mỗi lượt đồng bộ — một nguồn với Telegram / etp / luật NB
let BH = new Map<number, { bao_hoa: string | null; chan_nb: string | null }>();
const doanCua = (cr: number | null | undefined) => (cr ? DOAN.get(cr) ?? `cr:${cr}` : null);
function motPhim(d: Du, dat: Set<string>, phim: string, choNb: ChoNb = {}) {
  const k = chuan(phim);
  if (k.length < 6) return { so_camp: 0, dem: { bo: null as string | null, chay: 0, lich: 0, tat: 0, loai: {} as Record<string, number>, cho: 0 }, creative: [], ngay7: [] as { ngay: string; chi: number; thu: number; roi: number | null }[] };
  const khop = (a: string) => a.length >= 8 && (a.includes(k) || k.includes(a));
  const cua = d.camps.filter((c) => khop(loi(c.ten)) || (!!c.phim && khop(chuan(c.phim))));
  const nhom = new Map<number, typeof cua>();
  for (const c of cua) { const key = c.creative_id ?? -c.id; nhom.set(key, [...(nhom.get(key) ?? []), c]); }
  const cong = (ds: typeof cua, f: (c: (typeof cua)[number]) => { chi: number; thu: number }) => ds.reduce((a, c) => ({ chi: a.chi + f(c).chi, thu: a.thu + f(c).thu }), { chi: 0, thu: 0 });
  const so = (x: { chi: number; thu: number }) => ({ chi: +x.chi.toFixed(2), thu: +x.thu.toFixed(2), roi: x.chi >= 0.1 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null });
  // ROI 7 NGÀY (anh 23/10/2026 duyệt biểu đồ cột nhỏ mỗi creative + cả phim) — từ ngayCamp (Report ngày × camp, ngày Ethopex) docEthopex đã kéo sẵn
  const NGAY = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + (d.ngayUtc ? 0 : 7) * 3600_000 - (6 - i) * 86_400_000).toISOString().slice(0, 10));
  const theoNgay = new Map<string, { chi: number; thu: number }>();
  for (const x of d.ngayCamp) { const key = x.camp + '|' + x.ngay; const a = theoNgay.get(key) ?? { chi: 0, thu: 0 }; a.chi += x.chi; a.thu += x.thu; theoNgay.set(key, a); }
  const ngay7 = (ds: { id: number }[]) => NGAY.map((n) => ({ ngay: n, ...so(ds.reduce((a, c) => { const x = theoNgay.get(c.id + '|' + n); return x ? { chi: a.chi + x.chi, thu: a.thu + x.thu } : a; }, { chi: 0, thu: 0 })) }));
  const creative = [...nhom.entries()].map(([cr, ds]) => ({
    creative_id: cr > 0 ? cr : null, loai: loaiCua(ds[0]!.ten), anh: ds.find((c) => c.anh)?.anh ?? null, video: ds.find((c) => c.video)?.video ?? null, dang: ds[0]!.dang_creative,
    doan: (ds[0]!.ten.match(/(\d+-\d+s)/) ?? [])[1] ?? null, cta_dat: cr > 0 && dat.has(String(cr)),
    // từng camp: thêm số hôm nay / hôm qua / 7 ngày + tên, ngày tạo, camp gốc nhân bản — khung chi tiết + biểu đồ khi rê vào chip camp (anh 24/10/2026)
    camp: ds.map((c) => ({ id: c.id, bo: c.bo ?? '1', trang_thai: c.trang_thai, ngan_sach: c.ngan_sach, moi: c.thang.chi === 0, lich: laLich(c) ? c.bat_dau : null, cho_nb: choNb[String(c.id)] ?? null, ...so(c.thang),
      ten: c.ten, tao: c.tao, goc: Number((c.ten.match(/\(nhan ban \d+ cua (\d+)\)/) ?? [])[1]) || null, hom_nay: so(c.hom_nay), hom_qua: so(c.hom_qua), ngay7: ngay7([c]),
      // LUẬT ĐANG CHẤM cho camp (cùng bộ chấm tab Ethopex mos2 — anh 24/10/2026 "show rule đó lên đây"): chỉ luật chạm / gần chạm
      luat: c.trang_thai === 'ACTIVE' ? chamLuat(c, { soCampPhim: cua.filter((x) => x.trang_thai === 'ACTIVE').length, phimThang: d.phimThang.includes(Number(c.content_id)) })
        .filter((l) => l.trang_thai !== 'ap').map((l) => ({ ma: l.ma, ten: LUAT_THEO_MA[l.ma]?.ten ?? l.ma, icon: LUAT_THEO_MA[l.ma]?.icon ?? '', trang_thai: l.trang_thai, cau: l.cau })) : [] })).sort((a, b) => b.thu - a.thu),
    // số camp ĐANG CHẠY cùng ĐOẠN video (cùng phim + cùng mốc "tu-den s" trong tên, gộp bản CTA cũ và bản sửa) — > 3 = tự cạnh tranh (luật 1 đoạn ≤ 3 camp, 23/10/2026)
    chay: cua.filter((x) => x.trang_thai === 'ACTIVE' && doanCua(x.creative_id) === doanCua(cr > 0 ? cr : null)).length || ds.filter((x) => x.trang_thai === 'ACTIVE').length,
    chay_day: ds.filter((x) => x.trang_thai === 'ACTIVE').length,   // camp chạy của CHÍNH creative này
    // creative khác cùng đoạn (bản CTA cũ ↔ bản sửa) và số camp chạy của từng cái — nhãn "7 camp · 1 ở đây · 6 ở #54182" (anh 24/10/2026)
    cung_doan: (() => { if (cr <= 0) return []; const m = new Map<number, number>();
      for (const x of cua) if (x.trang_thai === 'ACTIVE' && x.creative_id && x.creative_id !== cr && doanCua(x.creative_id) === doanCua(cr)) m.set(x.creative_id, (m.get(x.creative_id) ?? 0) + 1);
      return [...m].map(([id, n]) => ({ id, n })); })(),
    thang: so(cong(ds, (c) => c.thang)), hom_nay: so(cong(ds, (c) => c.hom_nay)), hom_qua: so(cong(ds, (c) => c.hom_qua)), ngay7: ngay7(ds),
  })).sort((a, b) => (b.thang.roi ?? -1e9) - (a.thang.roi ?? -1e9) || b.thang.thu - a.thang.thu);   // ROI tháng cao nhất lên đầu, creative chưa tiêu xuống cuối (anh duyệt 23/10/2026)
  // ĐẾM THEO PHIM cho nhãn ở danh sách Report (anh 23/10/2026 "show số lượng camp đang active, scheduled ở danh sách")
  const loai: Record<string, number> = {}; for (const c of cua) if (c.trang_thai === 'ACTIVE') loai[loaiCua(c.ten)] = (loai[loaiCua(c.ten)] ?? 0) + 1;
  const boDem = new Map<string, number>(); for (const c of cua) boDem.set(c.bo ?? '1', (boDem.get(c.bo ?? '1') ?? 0) + 1);
  const dem = { bo: [...boDem].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, chay: cua.filter((c) => c.trang_thai === 'ACTIVE' && !laLich(c)).length, lich: cua.filter((c) => c.trang_thai === 'ACTIVE' && laLich(c)).length, tat: cua.filter((c) => c.trang_thai !== 'ACTIVE').length, loai,
    cho: cua.filter((c) => !!choNb[String(c.id)]).length };   // camp thắng có lần nhân bản đang chờ (anh 23/10/2026: phải hiện ở số vàng)
  const bh = [...new Set(cua.map((c) => Number(c.content_id)).filter(Boolean))].map((id) => BH.get(id)).find((x) => x && (x.bao_hoa || x.chan_nb)) ?? null;
  return { so_camp: cua.length, dem, creative, ngay7: ngay7(cua), bh };
}

export async function OPTIONS() { return new NextResponse(null, { headers: CORS }); }

export async function GET(req: Request) {
  const u = new URL(req.url); const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'thiếu DB' }, { status: 500, headers: CORS });
  const r = (await db.execute(sql`SELECT gia_tri->>'token' AS t FROM xv_khoa_ngoai WHERE ten = 'ethopex_ext'`)) as unknown as { t: string | null }[];
  if (!r[0]?.t || u.searchParams.get('k') !== r[0].t) return NextResponse.json({ ok: false, error: 'sai mã' }, { status: 403, headers: CORS });
  if (u.searchParams.get('bao')) console.log(`ethopex-nap BAO=${u.searchParams.get('bao')} ua=${(req.headers.get('user-agent') ?? '').slice(0, 90)}`);
  const phim = u.searchParams.get('phim'), phims = u.searchParams.get('phims');
  try { DOAN = await napDoan(); } catch { /* thiếu sổ đoạn → đếm theo creative */ }
  try { BH = new Map(((await db.execute(sql`SELECT content_id, bao_hoa, chan_nb FROM etp.phim_bao_hoa WHERE bao_hoa IS NOT NULL OR chan_nb IS NOT NULL`)) as unknown as { content_id: number; bao_hoa: string | null; chan_nb: string | null }[]).map((r) => [Number(r.content_id), { bao_hoa: r.bao_hoa, chan_nb: r.chan_nb }])); } catch { BH = new Map(); }
  // BỘ TÀI KHOẢN QC + PAGE (anh 23/10/2026 "các camp, phim phải ghi thêm thuộc bộ tk thứ mấy, hover vào ra thông tin bộ tk đó"):
  // ?bo=1 → { bo_tk: {bộ: thông tin + số}, camp: {id: bộ} } — extension gắn nhãn B1/B2 ở ô tên camp / phim, rê vào hiện thông tin bộ
  if (u.searchParams.get('bo')) {
    const d = await camps();
    const raw = (((await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_bo_tk'`)) as unknown as { gia_tri: Record<string, { tk: number; ext: string; page: number; ten: string; chi_phim_moi?: boolean }> | null }[])[0]?.gia_tri) ?? {};
    const bo_tk: Record<string, unknown> = {};
    for (const [k, b] of Object.entries(raw)) {
      const cs = d.camps.filter((c) => (c.bo ?? '1') === k), sum = (f: 'thang' | 'hom_nay') => cs.reduce((a, c) => ({ chi: a.chi + c[f].chi, thu: a.thu + c[f].thu }), { chi: 0, thu: 0 });
      const t = sum('thang'), h = sum('hom_nay'), roiOf = (x: { chi: number; thu: number }) => (x.chi >= 0.1 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null);
      bo_tk[k] = { ten: b.ten, tk_ext: b.ext, page: b.page, chi_phim_moi: !!b.chi_phim_moi, camp: cs.length, chay: cs.filter((c) => c.trang_thai === 'ACTIVE').length,
        phim: new Set(cs.map((c) => c.content_id).filter(Boolean)).size, thang: { ...t, roi: roiOf(t) }, hom_nay: { ...h, roi: roiOf(h) } };
    }
    return NextResponse.json({ ok: true, bo_tk, camp: Object.fromEntries(d.camps.map((c) => [c.id, c.bo ?? '1'])) }, { headers: CORS });
  }
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
