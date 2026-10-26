// ĐỌC KHO ETP cho etp.on.tc (anh 24/10/2026: "hệ thống quản lý backend riêng tập trung… quản lý hiệu quả camp, creative và roi").
// Chỉ đọc schema `etp` (apps/etp/dong-bo.py đồng bộ 10 phút/lần) — không gọi API Ethopex. Ngày = ngày Ethopex (UTC, 07:00–07:00 VN).
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export type SoTien = { chi: number; thu: number };
/** ns = tổng ngân sách ngày của camp đang chạy (anh 26/10/2026): ngày cũ = ảnh chụp cuối ngày trong etp.so_ngay (camp ACTIVE); hôm nay = view camp_dang_chay (gồm camp tạm dừng vì lịch); null = chưa ghi */
export type DongNgayEtp = SoTien & { ngay: string; camp: number; ns: number | null };
export type CampEtpKho = { camp_id: number; ten: string; bo: string | null; trang_thai: string; giao: string | null; ngan_sach: number; creative_id: number | null; content_id: number | null;
  goc: number | null; lich: string | null; tao: string | null; loi: string | null; phim: string | null; the_loai: string | null; dang: string | null; doan: string | null; cung_doan: number;
  thang: SoTien; qua: SoTien; nay: SoTien;
  /** đang tạm dừng vì LỊCH GIỜ (etp.lich_tat — apps/etp/lich-gio.py tự bật lại khi tới khung BẬT) */
  lich_tat: boolean;
  /** ROAS goal thật đang đặt trên Ethopex (Ad Set) + bid strategy cấp campaign — camp ROAS ★ (migration 0339) */
  roas: number | null; chien_luoc: string | null };
export type CreativeEtpKho = { creative_id: number; content_id: number | null; phim: string | null; the_loai: string | null; dang: string | null; doan: string | null; tu: number | null; den: number | null;
  lang: string | null; cta_dat: boolean; tu_choi: string | null; video: string | null; anh: string | null; camp: number; chay: number; cung_doan: number; thang: SoTien; qua: SoTien; nay: SoTien; ngay_dau: string | null;
  /** tab Creative › Soát (anh 25/10/2026: "chỉ số review từng creative về mọi tiêu chí"): soát 18+ cả phim · soát từng đoạn (máy / người, chờ soát) · trạng thái phát của Meta ở các camp */
  s18: { ok: boolean; ghi: string; luc: string } | null; sd: { ok: boolean; ghi: string; luc: string } | null; sd_cho: boolean; giao: string[] };
export type PhimEtpKho = { content_id: number; ten: string | null; the_loai: string | null; bo: string | null; locale: string | null; nguon: string | null; creative: number; camp: number; chay: number;
  thang: SoTien; qua: SoTien; nay: SoTien };
export type ChamCr = { luc: string; may: string | null; ket: string | null; meta: number | null; afs: number | null; loi: string | null;
  lop: { chu?: { luc: string; noi_dung: string; loi: string[]; cta: string[] }; giong?: { luc: string; noi_dung: string; ngon_ngu: string | null; loi: string[] };
    anh?: { luc: string; url?: string; giay?: number; khung_url?: string[] /* các khung Worker cắt (Cloudflare); url = tờ khung bản cũ */ }; noi_dung?: { luc: string; tom_tat: string } };
  diem: Record<string, number>; ly_do: Record<string, string>; khung: Record<string, number[]>; duoc_len: boolean | null; chan_boi: string | null };
export type DuLieuEtp = { luc: string; nay: string; ngay: DongNgayEtp[]; camps: CampEtpKho[]; creatives: CreativeEtpKho[]; phims: PhimEtpKho[];
  cauHinh: { khoa: string; gia_tri: unknown; ghi: string | null; ai: string | null; luc: string }[];
  nhatKy: { luc: string; viec: string; camp_id: number | null; truoc: string | null; sau: string | null; ok: boolean | null; loi: string | null; luat: string | null; ai: string | null }[];
  canhBao: { luc: string; muc: string; noi_dung: string; da_gui: string | null }[]; dongBo: { lan: number; bat_dau: string; xong: string | null; so_camp: number | null; loi: string | null } | null;
  theLoai: Record<string, string>;
  /** số camp × ngày (lọc khoảng thời gian ở client) · đếm theo ngày: camp mới lên, creative mới, camp tắt · thông tin bộ tài khoản (khối lục giác) */
  soNgay: { c: number; d: string; chi: number; thu: number }[]; demNgay: Record<string, { camp_moi: number; cr_moi: number; tat: number }>;
  boTk: Record<string, { ten: string; tk: string; page: string; tk_id: number; page_id: number; chi_phim_moi?: boolean }>;
  /** tab Tài nguyên: tài khoản QC · Page · pixel · tên miền (Ethopex) + máy thợ (hàng đợi etp.viec) */
  taiNguyen: { loai: string; id: number; external_id: string | null; ten: string | null; trang_thai: string | null; them: Record<string, unknown> }[];
  mayTho: { may: string; xong: number; loi: number; dang: number; cuoi: string | null; giay_tb: number | null }[];
  hangDoi: { cho: number; dang: number; xong: number; loi: number };
  /** máy luật đang báo (etp.bao — cty ethopex.mjs ghi mỗi nhịp, cùng nhóm với Telegram) · bid ROAS: camp ROI ≥ 50% mọi ngày trọn (3 ngày, ≥ 2 ngày có chi) — đủ khi chi ≥ $100 */
  bao: { nhom: string; camp_id: number; chu: string; luc: string }[];
  roas: { camp_id: number; ten: string | null; ngan_sach: number; chi: number; thu: number; ngay: { d: string; chi: number; thu: number }[] }[];
  /** camp ROAS ★ đang theo dõi (nhan-ban.py --roas, tên "★ … roas X duplicate by <gốc>" — anh 26/10/2026 "lưu vào etp để theo dõi cùng"): số từ lúc lên */
  roasChay: { camp_id: number; ten: string | null; trang_thai: string | null; ngan_sach: number; chi: number; thu: number; ngay: { d: string; chi: number; thu: number }[] }[];
  /** phim bão hoà / dừng nhân bản (etp.phim_bao_hoa — canh-bao.py, anh 25/10/2026) */
  baoHoa: { content_id: number; ten: string | null; so_camp: number; roi: { d: string; roi: number | null }[]; chan_nb: string | null; bao_hoa: string | null }[];
  /** nhân bản lỗi 24 giờ theo camp gốc (cây camp, anh 25/10/2026): số lần, lần cuối, lý do cuối */
  nbLoi: { camp_id: number; lan: number; luc: string; loi: string | null }[];
  /** phốt Meta (etp.phot — anh 25/10/2026: cảnh báo từ Meta = phốt gắn bộ tài khoản / Page) */
  /** tiến độ lượt quét nội dung theo máy (soat_doan.py quet ghi từng đoạn — xv_khoa_ngoai ethopex_quet) */
  quet: Record<string, { tong: number; xong: number; ok: number; cam: number; xem: number; bat_dau: string; cap_nhat: string; dang: boolean; cuoi: string }>;
  /** bộ chấm creative (anh 25/10/2026): tiêu chí Meta + AFS (etp.tieu_chi — một nguồn với máy chấm) · bản chấm từng creative (etp.cham, Worker Cloudflare etp-cham) */
  tieuChi: { nhom: string; ma: string; ten: string }[];
  cham: Record<number, ChamCr>;
  /** hàng chờ chấm (etp.cham_hang): đang chờ / đang chấm / lỗi gần đây — nút "Chấm" trên trang */
  chamHang: Record<number, { trang_thai: string; luc: string; loi: string | null; nguon: string; buoc: string | null; nhat_ky: { b: string; luc: string }[]; bat_dau: string | null; xong: string | null }>;
  /** LỊCH GIỜ (anh 25/10/2026): ô thể loại × khung bật/tắt (etp.lich_gio) · số chi/thu 7 ngày trọn theo thể loại × khung (etp.so_gio, giờ VN) · camp đang tạm dừng vì lịch */
  lichGio: { the_loai: string; khung: string; bat: boolean; ai: string | null; luc: string }[];
  khungSo: { the_loai: string; khung: string; chi: number; thu: number }[];
  lichTat: { camp_id: number; the_loai: string | null; khung: string | null; luc: string }[];
  /** sổ khung giờ (etp.khung_gio, migration 0333 — cùng nguồn với máy lịch apps/etp/lich-gio.py) + khung đang chạy (etp.khung_vn lúc đọc) */
  khungGio: { khung: string; gio_tu: number; so_gio: number; ten: string; ghi: string | null }[]; khungNay: string;
  phot: { id: number; luc: string; camp_id: number; creative_id: number | null; content_id: number | null; bo: string | null; ad_account_id: number | null; page_id: number | null; nhom: string; ly_do: string | null }[] };

const n = (v: unknown) => Number(v ?? 0) || 0;
const st = (c: unknown, t: unknown): SoTien => ({ chi: n(c), thu: n(t) });

export async function docEtp(): Promise<DuLieuEtp> {
  const db = getDb()!;
  const nay = new Date().toISOString().slice(0, 10), qua = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), dauThang = `${nay.slice(0, 8)}01`;
  const run = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
  // số mỗi camp: tháng / hôm qua / hôm nay
  const soCamp = sql`select camp_id,
      sum(chi) filter (where ngay >= ${dauThang}::date) tc, sum(thu) filter (where ngay >= ${dauThang}::date) tt,
      sum(chi) filter (where ngay = ${qua}::date) qc, sum(thu) filter (where ngay = ${qua}::date) qt,
      sum(chi) filter (where ngay = ${nay}::date) nc, sum(thu) filter (where ngay = ${nay}::date) nt, min(ngay) filter (where chi > 0) ngay_dau
    from etp.so_ngay group by camp_id`;
  const [ngay, camps, cauHinh, nhatKy, canhBao, dongBo, tl] = await Promise.all([
    run<{ ngay: string; chi: string; thu: string; camp: string; ns: string | null }>(sql`select ngay::text ngay, sum(chi) chi, sum(thu) thu, count(*) filter (where chi > 0) camp, sum(coalesce(ns_max, ngan_sach)) filter (where bat or chi > 0) ns from etp.so_ngay group by ngay having sum(chi) > 0 or sum(thu) > 0 order by ngay`),
    run<Record<string, unknown>>(sql`with s as (${soCamp}),
        cd as (select cr.doan, count(*) filter (where c.trang_thai = 'ACTIVE') chay from etp.camp c join etp.creative cr on cr.creative_id = c.creative_id where cr.doan is not null group by cr.doan)
      select c.camp_id, c.ten, c.bo, c.trang_thai, c.giao, c.ngan_sach, c.creative_id, c.content_id, c.goc, c.lich::text lich, c.tao::text tao, c.loi, c.roas, c.chien_luoc,
        p.ten phim, p.the_loai, cr.dang, cr.doan, coalesce(cd.chay, 0) cung_doan, s.tc, s.tt, s.qc, s.qt, s.nc, s.nt, (lt.camp_id is not null) lich_tat
      from etp.camp c left join etp.creative cr on cr.creative_id = c.creative_id left join etp.phim p on p.content_id = c.content_id left join etp.lich_tat lt on lt.camp_id = c.camp_id
        left join cd on cd.doan = cr.doan left join s on s.camp_id = c.camp_id
      where c.trang_thai <> 'ARCHIVED' order by c.camp_id desc`),
    run<{ khoa: string; gia_tri: unknown; ghi: string | null; ai: string | null; luc: string }>(sql`select khoa, gia_tri, ghi, ai, luc::text luc from etp.cau_hinh order by khoa`),
    run<DuLieuEtp['nhatKy'][number]>(sql`select luc::text luc, viec, camp_id, truoc, sau, ok, loi, luat, ai from etp.nhat_ky order by luc desc limit 300`),
    run<DuLieuEtp['canhBao'][number]>(sql`select luc::text luc, muc, noi_dung, da_gui::text da_gui from etp.canh_bao order by id desc limit 60`),
    run<NonNullable<DuLieuEtp['dongBo']>>(sql`select lan, bat_dau::text bat_dau, xong::text xong, so_camp, loi from etp.dong_bo where xong is not null order by lan desc limit 1`),
    run<{ gia_tri: { the_loai?: Record<string, string> } | null }>(sql`select gia_tri from xv_khoa_ngoai where ten = 'ethopex_the_loai_thu'`),
  ]);
  const cs: CampEtpKho[] = camps.map((r) => ({ camp_id: n(r.camp_id), ten: String(r.ten ?? ''), bo: (r.bo as string) ?? null, trang_thai: String(r.trang_thai ?? ''), giao: (r.giao as string) ?? null, ngan_sach: n(r.ngan_sach),
    creative_id: r.creative_id == null ? null : n(r.creative_id), content_id: r.content_id == null ? null : n(r.content_id), goc: r.goc == null ? null : n(r.goc), lich: (r.lich as string) ?? null, tao: (r.tao as string) ?? null,
    loi: (r.loi as string) ?? null, phim: (r.phim as string) ?? null, the_loai: (r.the_loai as string) ?? null, dang: (r.dang as string) ?? null, doan: (r.doan as string) ?? null, cung_doan: n(r.cung_doan),
    thang: st(r.tc, r.tt), qua: st(r.qc, r.qt), nay: st(r.nc, r.nt), lich_tat: !!r.lich_tat, roas: r.roas == null ? null : n(r.roas), chien_luoc: (r.chien_luoc as string) ?? null }));
  // gộp creative / phim từ camp (cùng nguồn số)
  const cong = (a: SoTien, b: SoTien) => ({ chi: a.chi + b.chi, thu: a.thu + b.thu });
  const crMap = new Map<number, CreativeEtpKho>();
  const [sKhoa] = await Promise.all([run<{ ten: string; gia_tri: Record<string, { ok?: boolean; ghi?: string; luc?: string }> | null }>(sql`select ten, gia_tri from xv_khoa_ngoai where ten in ('ethopex_soat_18', 'ethopex_soat_doan', 'ethopex_cho_soat', 'ethopex_quet')`)]);
  const khoaS = (t: string) => sKhoa.find((r) => r.ten === t)?.gia_tri ?? {};
  const s18 = khoaS('ethopex_soat_18'), sDoan = khoaS('ethopex_soat_doan'), choSoat = khoaS('ethopex_cho_soat');
  const dongS = (v?: { ok?: boolean; ghi?: string; luc?: string }) => (v && typeof v.ok === 'boolean' ? { ok: v.ok, ghi: String(v.ghi ?? ''), luc: String(v.luc ?? '') } : null);
  const crInfo = new Map((await run<Record<string, unknown>>(sql`select creative_id, tu, den, lang, cta_dat, tu_choi, video, anh from etp.creative`)).map((r) => [n(r.creative_id), r]));
  for (const c of cs) {
    if (c.creative_id == null) continue;
    const i = crInfo.get(c.creative_id) ?? {};
    const x = crMap.get(c.creative_id) ?? { creative_id: c.creative_id, content_id: c.content_id, phim: c.phim, the_loai: c.the_loai, dang: c.dang, doan: c.doan, tu: i.tu == null ? null : n(i.tu), den: i.den == null ? null : n(i.den),
      lang: (i.lang as string) ?? null, cta_dat: !!i.cta_dat, tu_choi: (i.tu_choi as string) ?? null, video: (i.video as string) ?? null, anh: (i.anh as string) ?? null, camp: 0, chay: 0, cung_doan: c.cung_doan,
      thang: { chi: 0, thu: 0 }, qua: { chi: 0, thu: 0 }, nay: { chi: 0, thu: 0 }, ngay_dau: null,
      s18: c.content_id ? dongS(s18[String(c.content_id)]) : null, sd: c.doan ? dongS(sDoan[c.doan]) : null, sd_cho: !!(c.doan && choSoat[c.doan]), giao: [] as string[] };
    if (c.giao) x.giao.push(c.giao);
    x.camp++; if (c.trang_thai === 'ACTIVE') x.chay++; x.thang = cong(x.thang, c.thang); x.qua = cong(x.qua, c.qua); x.nay = cong(x.nay, c.nay);
    if (c.tao && (!x.ngay_dau || c.tao < x.ngay_dau)) x.ngay_dau = c.tao;
    crMap.set(c.creative_id, x);
  }
  const phMap = new Map<number, PhimEtpKho & { _cr: Set<number> }>();
  const phInfo = new Map((await run<Record<string, unknown>>(sql`select content_id, ten, the_loai, bo, locale, nguon from etp.phim`)).map((r) => [n(r.content_id), r]));
  for (const c of cs) {
    if (c.content_id == null) continue;
    const i = phInfo.get(c.content_id) ?? {};
    const x = phMap.get(c.content_id) ?? { content_id: c.content_id, ten: (i.ten as string) ?? c.phim, the_loai: (i.the_loai as string) ?? null, bo: (i.bo as string) ?? c.bo, locale: (i.locale as string) ?? null, nguon: (i.nguon as string) ?? null,
      creative: 0, camp: 0, chay: 0, thang: { chi: 0, thu: 0 }, qua: { chi: 0, thu: 0 }, nay: { chi: 0, thu: 0 }, _cr: new Set<number>() };
    x.camp++; if (c.trang_thai === 'ACTIVE') x.chay++; if (c.creative_id) x._cr.add(c.creative_id); x.thang = cong(x.thang, c.thang); x.qua = cong(x.qua, c.qua); x.nay = cong(x.nay, c.nay);
    phMap.set(c.content_id, x);
  }
  const phims = [...phMap.values()].map(({ _cr, ...p }) => ({ ...p, creative: _cr.size }));
  const [soNgay, tatNgay, boRow] = await Promise.all([
    run<{ c: number; d: string; chi: string; thu: string }>(sql`select camp_id c, ngay::text d, chi, thu from etp.so_ngay where chi > 0 or thu > 0`),
    run<{ d: string; n: string }>(sql`select (luc at time zone 'UTC')::date::text d, count(distinct camp_id) n from etp.nhat_ky where viec = 'tat' and ok group by 1`),
    run<{ gia_tri: Record<string, { ten: string; tk: number; ext: string; page: number; chi_phim_moi?: boolean }> | null }>(sql`select gia_tri from xv_khoa_ngoai where ten = 'ethopex_bo_tk'`),
  ]);
  const demNgay: DuLieuEtp['demNgay'] = {};
  const dn = (d: string) => (demNgay[d] ??= { camp_moi: 0, cr_moi: 0, tat: 0 });
  for (const c of cs) if (c.tao) dn(c.tao.slice(0, 10)).camp_moi++;   // tao là timestamptz UTC → ngày Ethopex
  for (const x of crMap.values()) if (x.ngay_dau) dn(x.ngay_dau.slice(0, 10)).cr_moi++;
  for (const r of tatNgay) dn(r.d).tat = n(r.n);
  const boTk = Object.fromEntries(Object.entries(boRow[0]?.gia_tri ?? {}).map(([k, b]) => [k, { ten: b.ten, tk: b.ext, page: String(b.page), tk_id: Number(b.tk), page_id: Number(b.page), chi_phim_moi: b.chi_phim_moi }]));
  // LỊCH GIỜ — không .catch: đọc lỗi mà trả rỗng thì bảng hiện toàn BẬT trong khi máy đang tạm dừng camp (audit 25/10/2026)
  const [lichGio, khungSo, lichTat, khungGio, khungNay] = await Promise.all([
    run<DuLieuEtp['lichGio'][number]>(sql`select the_loai, khung, bat, ai, luc::text luc from etp.lich_gio order by the_loai, khung`),
    run<{ the_loai: string; khung: string; chi: string; thu: string }>(sql`select coalesce(p.the_loai, '_khac') the_loai, etp.khung_vn((s.gio + 7) % 24) khung, sum(s.chi) chi, sum(s.thu) thu
      from etp.so_gio s left join etp.phim p using (content_id) where s.ngay between ${nay}::date - 7 and ${nay}::date - 1 group by 1, 2`),
    run<DuLieuEtp['lichTat'][number]>(sql`select camp_id, the_loai, khung, luc::text luc from etp.lich_tat order by luc desc`),
    run<{ khung: string; gio_tu: number; so_gio: number; ten: string; ghi: string | null }>(sql`select khung, gio_tu, so_gio, ten, ghi from etp.khung_gio order by (gio_tu + 17) % 24`),
    run<{ k: string }>(sql`select etp.khung_vn(extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')::int) k`),
  ]);
  const [taiNguyen, mayTho, hd, bao, roas, baoHoa, nbLoi, phot, tieuChi, cham, chamHang, roasChay] = await Promise.all([
    run<DuLieuEtp['taiNguyen'][number]>(sql`select loai, id, external_id, ten, trang_thai, them from etp.tai_nguyen order by loai, ten`),
    run<Record<string, unknown>>(sql`select may, count(*) filter (where trang_thai = 'xong') xong, count(*) filter (where trang_thai = 'loi') loi, count(*) filter (where trang_thai = 'dang') dang,
        max(coalesce(xong, bat_dau))::text cuoi, avg(extract(epoch from xong - bat_dau)) filter (where trang_thai = 'xong') giay_tb from etp.viec where may is not null group by may order by may`),
    run<Record<string, unknown>>(sql`select count(*) filter (where trang_thai = 'cho') cho, count(*) filter (where trang_thai = 'dang') dang, count(*) filter (where trang_thai = 'xong') xong, count(*) filter (where trang_thai = 'loi') loi from etp.viec`),
    run<DuLieuEtp['bao'][number]>(sql`select nhom, camp_id, chu, luc::text luc from etp.bao order by nhom, camp_id`).catch(() => [] as DuLieuEtp['bao']),
    run<Record<string, unknown>>(sql`with t as (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay where ngay >= ${nay}::date - 29 group by 1 having sum(chi) >= 30 and sum(thu) >= 1.5 * sum(chi)),
        d as (select camp_id, json_agg(json_build_object('d', ngay::text, 'chi', chi, 'thu', thu) order by ngay) ngay, bool_and(thu >= 1.5 * chi) on_dinh, count(*) so
              from etp.so_ngay where ngay between ${nay}::date - 3 and ${nay}::date - 1 and chi >= 1 group by 1)
      select c.camp_id, c.ten, c.ngan_sach, t.chi, t.thu, d.ngay from t join d using (camp_id) join etp.camp c using (camp_id)
      where d.on_dinh and d.so >= 2 and c.trang_thai = 'ACTIVE' order by t.chi desc`),
    run<DuLieuEtp['baoHoa'][number]>(sql`select content_id, ten, so_camp, roi, chan_nb, bao_hoa from etp.phim_bao_hoa where chan_nb is not null or bao_hoa is not null order by so_camp desc`).catch(() => [] as DuLieuEtp['baoHoa']),
    run<Record<string, unknown>>(sql`select distinct on (camp_id) camp_id, count(*) over (partition by camp_id) lan, luc::text luc, loi from etp.nhat_ky
      where viec = 'nhan_ban' and not coalesce(ok, true) and luc > now() - interval '24 hours' and camp_id is not null order by camp_id, luc desc`),
    run<Record<string, unknown>>(sql`select id, luc::text luc, camp_id, creative_id, content_id, bo, ad_account_id, page_id, nhom, ly_do from etp.phot order by luc desc limit 500`).catch(() => [] as Record<string, unknown>[]),
    run<{ nhom: string; ma: string; ten: string }>(sql`select nhom, ma, ten from etp.tieu_chi order by nhom desc, thu_tu`).catch(() => [] as { nhom: string; ma: string; ten: string }[]),
    run<Record<string, unknown>>(sql`select c.creative_id, c.luc::text luc, c.may, c.ket, c.meta, c.afs, c.loi, c.lop, c.diem, c.ly_do, c.khung, g.duoc_len, g.chan_boi from etp.cham c left join etp.cham_cong g using (creative_id)`).catch(() => [] as Record<string, unknown>[]),
    run<Record<string, unknown>>(sql`select creative_id, trang_thai, luc::text luc, loi, nguon, buoc, nhat_ky, bat_dau::text bat_dau, xong::text xong from etp.cham_hang
      where trang_thai in ('cho', 'dang') or (trang_thai = 'loi' and luc > now() - interval '1 day') or xong > now() - interval '30 minutes'`).catch(() => [] as Record<string, unknown>[]),
    run<Record<string, unknown>>(sql`select c.camp_id, c.ten, c.trang_thai, c.ngan_sach, coalesce(sum(s.chi), 0) chi, coalesce(sum(s.thu), 0) thu,
        coalesce(json_agg(json_build_object('d', s.ngay::text, 'chi', s.chi, 'thu', s.thu) order by s.ngay) filter (where s.chi > 0), '[]') ngay
      from etp.camp c left join etp.so_ngay s using (camp_id) where (c.ten like '% duplicate by %' or c.ten like '★%') and coalesce(c.trang_thai, '') <> 'ARCHIVED'
      group by 1, 2, 3, 4 order by c.camp_id desc`).catch(() => [] as Record<string, unknown>[]),
  ]);
  // creative đã chấm / có phốt mà không còn ở camp nào (camp đã thay creative khác) vẫn phải hiện ở Quét nội dung — lấy thẳng từ etp.creative
  const thieu = [...new Set([...cham.map((r) => n(r.creative_id)), ...phot.map((r) => n(r.creative_id))])].filter((id) => id && !crMap.has(id));
  if (thieu.length) {
    const ds = await run<Record<string, unknown>>(sql`select c.creative_id, c.content_id, p.ten phim, p.the_loai, c.dang, c.doan, c.tu, c.den, c.lang, c.cta_dat, c.tu_choi, c.video, c.anh
      from etp.creative c left join etp.phim p on p.content_id = c.content_id where c.creative_id = any(${`{${thieu.join(',')}}`}::int[])`);
    for (const i of ds) crMap.set(n(i.creative_id), { creative_id: n(i.creative_id), content_id: i.content_id == null ? null : n(i.content_id), phim: (i.phim as string) ?? null, the_loai: (i.the_loai as string) ?? null,
      dang: (i.dang as string) ?? null, doan: (i.doan as string) ?? null, tu: i.tu == null ? null : n(i.tu), den: i.den == null ? null : n(i.den), lang: (i.lang as string) ?? null, cta_dat: !!i.cta_dat,
      tu_choi: (i.tu_choi as string) ?? null, video: (i.video as string) ?? null, anh: (i.anh as string) ?? null, camp: 0, chay: 0, cung_doan: 0, thang: { chi: 0, thu: 0 }, qua: { chi: 0, thu: 0 }, nay: { chi: 0, thu: 0 },
      ngay_dau: null, s18: null, sd: null, sd_cho: false, giao: [] });
  }
  return { luc: new Date().toISOString(), nay, ngay: ngay.map((r) => ({ ngay: r.ngay, chi: n(r.chi), thu: n(r.thu), camp: n(r.camp), ns: r.ns == null ? null : n(r.ns) })), camps: cs, creatives: [...crMap.values()], phims,
    cauHinh, nhatKy, canhBao, dongBo: dongBo[0] ?? null, theLoai: tl[0]?.gia_tri?.the_loai ?? {}, soNgay: soNgay.map((r) => ({ c: n(r.c), d: r.d, chi: n(r.chi), thu: n(r.thu) })), demNgay, boTk,
    taiNguyen, mayTho: mayTho.map((r) => ({ may: String(r.may), xong: n(r.xong), loi: n(r.loi), dang: n(r.dang), cuoi: (r.cuoi as string) ?? null, giay_tb: r.giay_tb == null ? null : n(r.giay_tb) })),
    hangDoi: { cho: n(hd[0]?.cho), dang: n(hd[0]?.dang), xong: n(hd[0]?.xong), loi: n(hd[0]?.loi) },
    quet: (sKhoa.find((r) => r.ten === 'ethopex_quet')?.gia_tri ?? {}) as unknown as DuLieuEtp['quet'],
    tieuChi, lichGio, lichTat, khungGio: khungGio.map((r) => ({ ...r, gio_tu: n(r.gio_tu), so_gio: n(r.so_gio) })), khungNay: khungNay[0]?.k ?? '', khungSo: khungSo.map((r) => ({ the_loai: r.the_loai, khung: r.khung, chi: n(r.chi), thu: n(r.thu) })),
    chamHang: Object.fromEntries(chamHang.map((r) => [n(r.creative_id), { trang_thai: String(r.trang_thai), luc: String(r.luc), loi: (r.loi as string) ?? null, nguon: String(r.nguon ?? ''),
      buoc: (r.buoc as string) ?? null, nhat_ky: (r.nhat_ky ?? []) as { b: string; luc: string }[], bat_dau: (r.bat_dau as string) ?? null, xong: (r.xong as string) ?? null }])),
    cham: Object.fromEntries(cham.map((r) => [n(r.creative_id), { luc: String(r.luc), may: (r.may as string) ?? null, ket: (r.ket as string) ?? null, meta: r.meta == null ? null : n(r.meta), afs: r.afs == null ? null : n(r.afs),
      loi: (r.loi as string) ?? null, lop: (r.lop ?? {}) as ChamCr['lop'], diem: (r.diem ?? {}) as ChamCr['diem'], ly_do: (r.ly_do ?? {}) as ChamCr['ly_do'], khung: (r.khung ?? {}) as ChamCr['khung'], duoc_len: r.duoc_len == null ? null : !!r.duoc_len, chan_boi: (r.chan_boi as string) ?? null }])),
    phot: phot.map((r) => ({ id: n(r.id), luc: String(r.luc), camp_id: n(r.camp_id), creative_id: r.creative_id == null ? null : n(r.creative_id), content_id: r.content_id == null ? null : n(r.content_id),
      bo: (r.bo as string) ?? null, ad_account_id: r.ad_account_id == null ? null : n(r.ad_account_id), page_id: r.page_id == null ? null : n(r.page_id), nhom: String(r.nhom ?? 'khac'), ly_do: (r.ly_do as string) ?? null })),
    bao, baoHoa, nbLoi: nbLoi.map((r) => ({ camp_id: n(r.camp_id), lan: n(r.lan), luc: String(r.luc), loi: (r.loi as string) ?? null })), roas: roas.map((r) => ({ camp_id: n(r.camp_id), ten: (r.ten as string) ?? null, ngan_sach: n(r.ngan_sach), chi: n(r.chi), thu: n(r.thu),
      ngay: ((r.ngay as { d: string; chi: unknown; thu: unknown }[]) ?? []).map((x) => ({ d: x.d, chi: n(x.chi), thu: n(x.thu) })) })),
    roasChay: roasChay.map((r) => ({ camp_id: n(r.camp_id), ten: (r.ten as string) ?? null, trang_thai: (r.trang_thai as string) ?? null, ngan_sach: n(r.ngan_sach), chi: n(r.chi), thu: n(r.thu),
      ngay: ((r.ngay as { d: string; chi: unknown; thu: unknown }[]) ?? []).map((x) => ({ d: x.d, chi: n(x.chi), thu: n(x.thu) })) })) };
}
