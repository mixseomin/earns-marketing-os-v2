// ĐỌC KHO ETP cho etp.on.tc (anh 24/10/2026: "hệ thống quản lý backend riêng tập trung… quản lý hiệu quả camp, creative và roi").
// Chỉ đọc schema `etp` (apps/etp/dong-bo.py đồng bộ 10 phút/lần) — không gọi API Ethopex. Ngày = ngày Ethopex (UTC, 07:00–07:00 VN).
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export type SoTien = { chi: number; thu: number };
export type DongNgayEtp = SoTien & { ngay: string; camp: number };
export type CampEtpKho = { camp_id: number; ten: string; bo: string | null; trang_thai: string; giao: string | null; ngan_sach: number; creative_id: number | null; content_id: number | null;
  goc: number | null; lich: string | null; tao: string | null; loi: string | null; phim: string | null; the_loai: string | null; dang: string | null; doan: string | null; cung_doan: number;
  thang: SoTien; qua: SoTien; nay: SoTien };
export type CreativeEtpKho = { creative_id: number; content_id: number | null; phim: string | null; the_loai: string | null; dang: string | null; doan: string | null; tu: number | null; den: number | null;
  lang: string | null; cta_dat: boolean; tu_choi: string | null; video: string | null; anh: string | null; camp: number; chay: number; cung_doan: number; thang: SoTien; qua: SoTien; nay: SoTien; ngay_dau: string | null };
export type PhimEtpKho = { content_id: number; ten: string | null; the_loai: string | null; bo: string | null; locale: string | null; nguon: string | null; creative: number; camp: number; chay: number;
  thang: SoTien; qua: SoTien; nay: SoTien };
export type DuLieuEtp = { luc: string; nay: string; ngay: DongNgayEtp[]; camps: CampEtpKho[]; creatives: CreativeEtpKho[]; phims: PhimEtpKho[];
  cauHinh: { khoa: string; gia_tri: unknown; ghi: string | null; ai: string | null; luc: string }[];
  nhatKy: { luc: string; viec: string; camp_id: number | null; truoc: string | null; sau: string | null; ok: boolean | null; loi: string | null; luat: string | null; ai: string | null }[];
  canhBao: { luc: string; muc: string; noi_dung: string; da_gui: string | null }[]; dongBo: { lan: number; bat_dau: string; xong: string | null; so_camp: number | null; loi: string | null } | null;
  theLoai: Record<string, string> };

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
    run<{ ngay: string; chi: string; thu: string; camp: string }>(sql`select ngay::text ngay, sum(chi) chi, sum(thu) thu, count(*) filter (where chi > 0) camp from etp.so_ngay group by ngay having sum(chi) > 0 or sum(thu) > 0 order by ngay`),
    run<Record<string, unknown>>(sql`with s as (${soCamp}),
        cd as (select cr.doan, count(*) filter (where c.trang_thai = 'ACTIVE') chay from etp.camp c join etp.creative cr on cr.creative_id = c.creative_id where cr.doan is not null group by cr.doan)
      select c.camp_id, c.ten, c.bo, c.trang_thai, c.giao, c.ngan_sach, c.creative_id, c.content_id, c.goc, c.lich::text lich, c.tao::text tao, c.loi,
        p.ten phim, p.the_loai, cr.dang, cr.doan, coalesce(cd.chay, 0) cung_doan, s.tc, s.tt, s.qc, s.qt, s.nc, s.nt
      from etp.camp c left join etp.creative cr on cr.creative_id = c.creative_id left join etp.phim p on p.content_id = c.content_id
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
    thang: st(r.tc, r.tt), qua: st(r.qc, r.qt), nay: st(r.nc, r.nt) }));
  // gộp creative / phim từ camp (cùng nguồn số)
  const cong = (a: SoTien, b: SoTien) => ({ chi: a.chi + b.chi, thu: a.thu + b.thu });
  const crMap = new Map<number, CreativeEtpKho>();
  const crInfo = new Map((await run<Record<string, unknown>>(sql`select creative_id, tu, den, lang, cta_dat, tu_choi, video, anh from etp.creative`)).map((r) => [n(r.creative_id), r]));
  for (const c of cs) {
    if (c.creative_id == null) continue;
    const i = crInfo.get(c.creative_id) ?? {};
    const x = crMap.get(c.creative_id) ?? { creative_id: c.creative_id, content_id: c.content_id, phim: c.phim, the_loai: c.the_loai, dang: c.dang, doan: c.doan, tu: i.tu == null ? null : n(i.tu), den: i.den == null ? null : n(i.den),
      lang: (i.lang as string) ?? null, cta_dat: !!i.cta_dat, tu_choi: (i.tu_choi as string) ?? null, video: (i.video as string) ?? null, anh: (i.anh as string) ?? null, camp: 0, chay: 0, cung_doan: c.cung_doan,
      thang: { chi: 0, thu: 0 }, qua: { chi: 0, thu: 0 }, nay: { chi: 0, thu: 0 }, ngay_dau: null };
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
  return { luc: new Date().toISOString(), nay, ngay: ngay.map((r) => ({ ngay: r.ngay, chi: n(r.chi), thu: n(r.thu), camp: n(r.camp) })), camps: cs, creatives: [...crMap.values()], phims,
    cauHinh, nhatKy, canhBao, dongBo: dongBo[0] ?? null, theLoai: tl[0]?.gia_tri?.the_loai ?? {} };
}
