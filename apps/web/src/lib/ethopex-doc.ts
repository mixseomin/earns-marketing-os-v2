// ĐỌC CAMP ETHOPEX cho tab Ethopex trang chủ (anh 21/10/2026: "thêm 1 tab mới là Ethopex để quản lý các camp đang lên … kèm rules đang set cho từng camp
// giống bên adfond"). Kéo sống từ API Ethopex khi mở tab (khoá ở xv_khoa_ngoai, gói chung @mos2/db/ethopex) + nối studio (phim / creative).
// Nhớ 60 giây trong tiến trình để bấm qua lại tab không gọi lại 70+ lượt API. Chỉ đọc.
import 'server-only';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiEthopex } from '@mos2/db/ethopex';
import type { CampEtp, SoLieu } from './ethopex-luat';

type CtCamp = { campaign: { id: number; name: string; state: string; budget_daily: number; last_synced_at: string | null; created_at: string; error?: string; ad_account_id?: number };
  ad_groups?: { source_payload?: unknown; ads?: { content_id?: number; creative_id?: number; delivery_status?: string; error?: string; final_url?: string; external_ad_id?: string; name?: string;
    media_info?: { video_id?: string; thumbnail_url?: string } | string }[] }[] };
type DongBc = { campaign_id: number; cost: number; revenue: number };
export type PhimCho = { id: number; nguon: string; locale: string; ten: string; url: string; so_page: number; so_qc: number; trang_thai: 'cho' | 'can_xem' | 'trung' | 'de_xuat'; ghi: string };
export type NgayEtp = { ngay: string; chi: number; thu: number };
/** theoNgay: Report group_by date (theo ngày quảng cáo — vài ngày gần còn tăng) · tienMoi: tiền thật vào/ra mỗi ngày VN từ điểm chụp cộng dồn (so-ngay.py) */
export type DuLieuEthopex = { ngayUtc?: boolean; luc: string; camps: CampEtp[]; phimThang: number[]; hangCho: PhimCho[]; theoNgay: NgayEtp[]; tienMoi: (NgayEtp & { du: boolean })[]; ngayCamp: (NgayEtp & { camp: number })[]; loi: string | null };

let nho: { luc: number; data: DuLieuEthopex } | null = null;

const ngay = (d: Date) => d.toISOString().slice(0, 10);
async function baoCao(tu: string, den: string): Promise<Map<number, SoLieu>> {
  const r = await goiEthopex<{ rows: DongBc[] }>(getDb()!, '/api/v1/report', { method: 'POST', body: { columns: ['campaign_name', 'cost', 'revenue'], filters: {}, metric_conditions: [], limit: 1000, page: 1, page_size: 1000, date_from: tu, date_to: den } });
  const m = new Map<number, SoLieu>();
  if (!r.ok) return m;
  for (const x of r.data.rows) { const a = m.get(x.campaign_id) ?? { chi: 0, thu: 0 }; a.chi += +x.cost || 0; a.thu += +x.revenue || 0; m.set(x.campaign_id, a); }   // report tách dòng theo content → cộng theo camp
  return m;
}

export async function docEthopex(lamMoi = false): Promise<DuLieuEthopex> {
  if (!lamMoi && nho && Date.now() - nho.luc < 60_000) return nho.data;
  const db = getDb();
  if (!db) return { luc: new Date().toISOString(), camps: [], phimThang: [], hangCho: [], theoNgay: [], tienMoi: [], ngayCamp: [], loi: 'chưa nối DB' };
  // hien_chot duyệt trên Telegram (cty DATA/ethopex-luat-duyet.json): ngày theo UTC như Ethopex (07:00–07:00 VN) — hỏi theo ngày VN thì 0–7h sáng "hôm nay" = 0
  let ngayUtc = false; try { ngayUtc = !!JSON.parse(readFileSync(process.env.CTY_DATA_DIR ? `${process.env.CTY_DATA_DIR}/ethopex-luat-duyet.json` : '/var/lib/cty/ethopex-luat-duyet.json', 'utf8')).hien_chot; } catch { /* chưa duyệt */ }
  const vn = new Date(Date.now() + (ngayUtc ? 0 : 7) * 3600_000), nay = ngay(vn), lui = (n: number) => ngay(new Date(vn.getTime() - n * 86_400_000));
  const ds = await goiEthopex<{ data: { id: number }[] }>(db, '/api/v1/campaigns?page_size=500');
  if (!ds.ok) return { luc: new Date().toISOString(), camps: [], phimThang: [], hangCho: [], theoNgay: [], tienMoi: [], ngayCamp: [], loi: ds.loi };
  const ids = ds.data.data.map((c) => c.id);
  const ct: CtCamp[] = [];
  for (let i = 0; i < ids.length; i += 12) {   // 12 lượt song song mỗi đợt — đủ nhanh, không dồn API
    const lo = await Promise.all(ids.slice(i, i + 12).map((id) => goiEthopex<CtCamp>(db, `/api/v1/campaigns/${id}`)));
    for (const x of lo) if (x.ok) ct.push(x.data);
  }
  const [thang, hom, homQua, gan, truoc] = await Promise.all([baoCao(`${nay.slice(0, 8)}01`, nay), baoCao(nay, nay), baoCao(lui(1), lui(1)), baoCao(lui(2), nay), baoCao(lui(6), lui(3))]);
  // studio: phim + link phim trên site gốc (kinh_thanh.qc.link) + poster + video xuất mới nhất + ảnh khung đầu (cảnh #1)
  const sx = (await db.execute(sql`SELECT p.id, p.ten, (p.kinh_thanh->'ethopex'->>'creative_id')::int AS cr, p.kinh_thanh->>'ngon_ngu' AS nn,
      p.kinh_thanh->'qc'->>'link' AS link, p.poster_url AS poster, p.kinh_thanh->>'the_loai' AS loai,
      (SELECT x->>'url' FROM xv_tap t, jsonb_array_elements(coalesce(t.xuat, '[]'::jsonb)) x WHERE t.phim_id = p.id AND coalesce(x->>'url', '') <> '' ORDER BY x->>'luc' DESC LIMIT 1) AS video,
      (SELECT c.keyframe_url FROM xv_tap t JOIN xv_canh c ON c.tap_id = t.id WHERE t.phim_id = p.id ORDER BY t.so, c.thu_tu LIMIT 1) AS anh
    FROM xv_phim p WHERE p.project = 'ethopex' AND p.kinh_thanh->'ethopex' ? 'creative_id'`)) as unknown as
    { id: number; ten: string; cr: number; nn: string | null; link: string | null; poster: string | null; loai: string | null; video: string | null; anh: string | null }[];
  const theoCr = new Map(sx.map((r) => [r.cr, r]));
  // BỘ TÀI KHOẢN QC + PAGE (anh 23/10/2026: mỗi phim một bộ; city.on.tc chia khu theo bộ) — studio xv_khoa_ngoai['ethopex_bo_tk'] {bộ: {tk, ten}}
  const boRow = (await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_bo_tk'`)) as unknown as { gia_tri: Record<string, { tk: number; ten: string }> | null }[];
  const boCuaTk = new Map(Object.entries(boRow[0]?.gia_tri ?? {}).map(([k, b]) => [Number(b.tk), { bo: k, ten: b.ten }]));
  const thangRow = (await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_phim_thang'`)) as unknown as { gia_tri: { content?: number[] } }[];
  // hàng chờ test (anh 21/10/2026: phim spy chưa duyệt vào lô hôm nay "vẫn phải lưu để sang ngày hôm sau") — studio xv_khoa_ngoai['ethopex_hang_cho']
  const choRow = (await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_hang_cho'`)) as unknown as { gia_tri: { phim?: PhimCho[] } }[];
  const rong: SoLieu = { chi: 0, thu: 0 };
  const camps: CampEtp[] = ct.map((d) => {
    const a = d.ad_groups?.[0]?.ads?.[0] ?? {}, p = a.creative_id ? theoCr.get(a.creative_id) : undefined, c = d.campaign;
    const ten = c.name.replace(/^\d+:\s*/, '');
    // giờ bắt đầu của Ad Set (camp lên lịch ngày mai: start_time ở tương lai) — extension đếm camp Scheduled theo phim (anh 23/10/2026)
    const spg = d.ad_groups?.[0]?.source_payload, spj = (typeof spg === 'string' ? (() => { try { return JSON.parse(spg); } catch { return {}; } })() : spg ?? {}) as { start_time?: string };
    const bo = boCuaTk.get(Number(c.ad_account_id ?? 0));
    return { id: c.id, ten, bo: bo?.bo ?? null, bo_ten: bo?.ten ?? null, trang_thai: c.state, giao: a.delivery_status ?? '', ngan_sach: +c.budget_daily || 0, dong_bo: c.last_synced_at, tao: c.created_at, bat_dau: spj.start_time ?? null,
      content_id: a.content_id ?? null, creative_id: a.creative_id ?? null, phim: p?.ten.split(' · ')[1] ?? null,
      ngon_ngu: p?.nn ?? (/\bES\b/.test(ten) ? 'es' : /\bEN\b/.test(ten) ? 'en' : null), studio_phim_id: p?.id ?? null,
      link_phim: p?.link ?? null, video: p?.video ?? null, anh: p?.anh ?? p?.poster ?? null, dang_creative: p?.loai === 'qc_canh_that' ? 'cảnh thật' : p?.loai === 'qc_ke_chuyen' ? 'kể chuyện' : p?.loai ?? null,
      trang_dich: a.final_url ?? null, fb_ad: a.external_ad_id ?? null, fb_video: ((typeof a.media_info === 'string' ? (() => { try { return JSON.parse(a.media_info as string); } catch { return {}; } })() : a.media_info ?? {}) as { video_id?: string }).video_id ?? null,
      loi: a.error || c.error || null, thang: thang.get(c.id) ?? rong, hom_nay: hom.get(c.id) ?? rong, hom_qua: homQua.get(c.id) ?? rong, gan: gan.get(c.id) ?? rong, truoc: truoc.get(c.id) ?? rong };
  }).sort((x, y) => y.id - x.id);
  // TIỀN THẬT MỖI NGÀY (anh 22/10/2026) — cùng cách tính với scripts/ethopex/so-ngay.py (Telegram 9h dùng bản đó)
  const nd = await goiEthopex<{ rows: { report_date: string; cost: number; revenue: number }[] }>(db, '/api/v1/report', { method: 'POST', body: { columns: ['date', 'cost', 'revenue'], group_by: ['date'], filters: {}, metric_conditions: [], limit: 1000, page: 1, page_size: 1000, date_from: '2026-10-19', date_to: nay } });
  const theoNgay: NgayEtp[] = nd.ok ? nd.data.rows.map((r) => ({ ngay: String(r.report_date).slice(0, 10), chi: +r.cost || 0, thu: +r.revenue || 0 })).filter((r) => r.chi || r.thu).sort((a, b) => a.ngay.localeCompare(b.ngay)) : [];
  // ngày × camp (group_by campaign_name + date) — để biểu đồ "Theo ngày" lọc được theo camp / phim / dạng / ngôn ngữ (anh 22/10/2026)
  const nc = await goiEthopex<{ rows: { report_date: string; campaign_id: number; cost: number; revenue: number }[] }>(db, '/api/v1/report', { method: 'POST', body: { columns: ['campaign_name', 'date', 'cost', 'revenue'], group_by: ['campaign_name', 'date'], filters: {}, metric_conditions: [], limit: 10000, page: 1, page_size: 10000, date_from: '2026-10-19', date_to: nay } });
  const ngayCamp = nc.ok ? nc.data.rows.map((r) => ({ ngay: String(r.report_date).slice(0, 10), camp: r.campaign_id, chi: +r.cost || 0, thu: +r.revenue || 0 })).filter((r) => r.chi || r.thu) : [];
  const luy = ((await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_so_luy'`)) as unknown as { gia_tri: { luc: string; chi: number; thu: number }[] }[])[0]?.gia_tri ?? [];
  const cuoi = new Map<string, { dau: { chi: number; thu: number }; cuoi: { chi: number; thu: number } }>();
  for (const p of luy) { const d = ngay(new Date(Date.parse(p.luc) + 7 * 3600_000)); const o = cuoi.get(d); if (o) o.cuoi = p; else cuoi.set(d, { dau: p, cuoi: p }); }
  const tienMoi: (NgayEtp & { du: boolean })[] = []; let truocDiem: { chi: number; thu: number } | null = null;
  for (const [d, x] of [...cuoi.entries()].sort((a, b) => a[0].localeCompare(b[0]))) { const a = truocDiem ?? x.dau; tienMoi.push({ ngay: d, chi: x.cuoi.chi - a.chi, thu: x.cuoi.thu - a.thu, du: truocDiem != null && d < nay }); truocDiem = x.cuoi; }
  const data = { ngayUtc, luc: new Date().toISOString(), camps, phimThang: thangRow[0]?.gia_tri?.content ?? [], hangCho: choRow[0]?.gia_tri?.phim ?? [], theoNgay, tienMoi, ngayCamp, loi: null };
  nho = { luc: Date.now(), data };
  return data;
}
