// KHO CREATIVE THEO CONCEPT (anh 16–17/10/2026: "1.000 creative — quản lý trong studio trước khi sản xuất"). Bốn tầng, mỗi tầng một tab ngăn sản phẩm:
//   Concept   = một sub-avatar của spy (path × mức nhận biết) — người mua cụ thể ở một mức nhận biết (migration 0269 xv_concept)
//   Template  = cách tiếp cận (Kể chuyện, Trước/Sau…) — cặp concept × template = MỘT BỘ HÌNH (xv_cap); thêm biến thể diễn viên / bối cảnh (xv_bien_the_hinh)
//   Phương án = nhiều giá trị chữ cho các ô câu chuyện của template ({{noi_dau}}…) (xv_phuong_an). DÙNG LẠI CLIP: creative đầu của bộ hình tạo
//     PHIM GỐC (xv_bien_the_hinh.phim_id), creative khác xuất từ clip của nó, chỉ thay chữ màn + giọng (xuat-creative.ts); tạo phim riêng từ template thì
//     shot có chữ đổi bị sinh lại hình (template-db.ts) → tienDungRiengCents là giá so sánh.
//   Creative  = cặp × biến thể × một phương án mỗi ô; tổ hợp chỉ TÍNH ra, duyệt mới lưu (xv_creative, số cố định trong sản phẩm)
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/concept.test.mts
import { nhomCuaO } from './template';

export type MucNb = 'UA' | 'PA' | 'SA' | 'PrA' | 'MA';
/** Mức nhận biết (Schwartz, tài liệu Creative Avatar) — QC mở bằng gì · traffic · độ dài creative. Cùng nghĩa với spy web/app.js › MUC_NB. */
export const MUC_NB: { key: MucNb; ten: string; mau: string; dung: string }[] = [
  { key: 'UA', ten: 'Chưa biết vấn đề', mau: '#8b8d98', dung: 'kể chuyện / giáo dục, chưa nhắc sản phẩm · traffic lạnh · creative dài' },
  { key: 'PA', ten: 'Biết vấn đề', mau: '#e5484d', dung: 'mở bằng chính vấn đề · traffic lạnh · creative dài' },
  { key: 'SA', ten: 'Biết giải pháp', mau: '#f5a524', dung: 'vì sao giải pháp này tốt nhất · traffic lạnh · creative vừa' },
  { key: 'PrA', ten: 'Biết sản phẩm', mau: '#3aa0f0', dung: 'gỡ phản đối bằng bằng chứng · traffic ấm · creative ngắn' },
  { key: 'MA', ten: 'Sắp mua', mau: '#30a46c', dung: 'chỉ cần deal · bám đuổi · creative ngắn' },
];
export const mucNb = (k: string) => MUC_NB.find((m) => m.key === k) ?? { key: k as MucNb, ten: k, mau: 'var(--fg-3)', dung: '' };

/** Template (khuôn) HỢP với mức nhận biết nào — gợi ý bật sẵn khi nhập concept; anh bật / tắt từng ô ở tab Template. */
export const HOP_KHUON: Record<string, MucNb[]> = {
  ke_chuyen: ['UA', 'PA'], review: ['PA', 'PrA'], demo: ['SA', 'PrA'], so_sanh: ['PA', 'SA'], uu_dai: ['MA'], pov: ['PrA'], haul: ['PrA', 'MA'],
  phan_hoi: ['PrA'], ngan: ['MA', 'PrA'], doi_nen: ['SA', 'PrA'], studio: ['SA', 'PrA'], lookbook: ['PrA', 'MA'], chu_dong: ['SA', 'MA'], chia_doi: ['PA', 'SA'],
  mo_hop: ['PrA', 'MA'], slideshow: ['MA'],
};
export const hopKhuon = (khuon: string, nb: string): boolean => (HOP_KHUON[khuon] ?? []).includes(nb as MucNb);

/** Sub-avatar của spy (spy server/phan-tich.mjs › SCHEMA_AV.avatar) — giữ nguyên trong xv_concept.du_lieu. */
export type SubAvatar = { ma: string; path: string; ten: string; nb: string; nguoi: string; trai_nghiem: string; cam_xuc: string; keo_dai: string; phan_doi: string;
  so_sanh: string; ngon_ngu: string[]; hook: string; creative: string; do_dai: string; traffic: string; goc?: number[] };
export type Concept = { id: number; ma: string; path: string; path_ten: string; nb: string; ten: string; du_lieu: SubAvatar };
/** Ô chữ của template có phương án: ô xuất hiện trong chữ màn của shot (thứ tự theo shot đầu tiên dùng nó), trừ ô sản phẩm / ảnh (sự thật cố định). */
export type OChu = { k: string; ten: string; loai: string; giay: number; goi_y: string; /** shot đầu tiên dùng ô (0-based, theo thứ tự shot tập 1 của template) */ shot: number };
export type TplConcept = { id: number; ten: string; dong: string; khuon: string; so_shot: number; giay: number;
  /** shot có anchor nhân vật / bối cảnh / một trong hai — đổi diễn viên / bối cảnh = sinh lại ĐÚNG các shot này (đếm thật từ xv_canh.nhan_vat) */
  shot_nguoi: number; shot_boi: number; shot_ca: number; o_chu: OChu[]; o_hinh: string[];
  /** shot của template (xem trước phim gốc): loại · giây · chữ màn (còn {{ô}}) · hình (hành động template tả) */ shot: { loai: string; giay: number; chu: string; hinh: string }[];
  /** QC mẫu thắng template học theo (kinh_thanh.template.mau_qc — video / ảnh trên R2) */ mau: { video: string | null; anh: string | null; mo_ta: string; link: string }[] };
export type Cap = { id: number; concept_id: number; template_id: number; bat: boolean };
export type BienTheHinh = { id: number; cap_id: number; so: number; nguoi_chinh: string; nguoi_phu: string; boi_canh: string; goc: boolean; /** phim gốc của bộ hình (xuat-creative.ts) */ phim_id?: number | null };
export type PhuongAn = { id: number; cap_id: number; o: string; so: number; chu: string; nguon: string };
export type CreativeDuyet = { id: number; so: number; cap_id: number; bien_the_id: number | null; chon: Record<string, number>; ma: string; trang_thai: 'duyet' | 'da_tao' | 'bo'; phim_id: number | null; /** bản xuất từ phim gốc (dùng lại clip) */ xuat?: { url: string; luc: string; giay?: number; canh_bao?: string[] } | null };
/** Đơn giá thật (trung bình sổ xv_job 30 ngày): một shot (keyframe ×2 lần thử + video ×1,3) · một bộ kịch bản (kịch bản + tách cảnh + kiểm người xem). */
export type GiaConcept = { shot_cents: number; kb_cents: number; chu_cents: number };

export function oChuTuKhung(o: { k: string; ten: string; goi_y?: string; nhom?: string; dung?: boolean }[], khung: { loai: string; giay: number; chu: string }[]): OChu[] {
  const ra: (OChu & { i: number })[] = [];
  for (const x of o) {
    const nh = nhomCuaO(x.k, x);
    if (nh === 'san_pham' || nh === 'anh' || /_hinh$/.test(x.k)) continue;
    const i = khung.findIndex((s) => s.chu.toLowerCase().includes(`{{${x.k}}}`));
    if (i < 0) continue;
    ra.push({ k: x.k, ten: x.ten || x.k, loai: khung[i]!.loai, giay: khung[i]!.giay, goi_y: x.goi_y ?? '', shot: i, i });
  }
  return ra.sort((a, b) => a.i - b.i).map(({ i: _i, ...x }) => x);
}
/** Ô hình của template (đổi = sinh hình mới): ô `_hinh` + ô nhóm nhân vật / bối cảnh không nằm trong chữ màn. */
export const oHinhCua = (o: { k: string; nhom?: string }[], oChu: OChu[]): string[] =>
  o.filter((x) => !oChu.some((c) => c.k === x.k) && (/_hinh$/.test(x.k) || ['nhan_vat', 'boi_canh'].includes(nhomCuaO(x.k, x)))).map((x) => x.k);

/** Biến thể hình → giá trị ô của template (tạo phim, nhịp 4): người chính → ô hình nhân vật chính, người phụ → ô hình người thứ hai, bối cảnh → ô bối cảnh đầu. */
export function gtBienThe(v: Pick<BienTheHinh, 'nguoi_chinh' | 'nguoi_phu' | 'boi_canh'>, oKeys: string[]): Record<string, string> {
  const gt: Record<string, string> = {};
  const dat = (re: RegExp, val: string) => { const k = oKeys.find((x) => re.test(x)); if (k && val.trim() && val.trim() !== '—') gt[k] = val.trim(); };
  dat(/^nhan_vat_hinh$/, v.nguoi_chinh); dat(/^nguoi_2_hinh$/, v.nguoi_phu); dat(/^boi_canh$/, v.boi_canh);
  return gt;
}

/** Số phương án DỰ KIẾN mỗi ô (AI viết đúng số này): chỉ ô ĐÒN BẨY mới nhiều phương án — ô đầu (hook) 3; ô ĐẦU TIÊN của mỗi loại nỗi đau / so sánh /
 *  bằng chứng / trấn an / ưu đãi 2; ô còn lại (giải pháp, demo, tính năng — đi theo hình) 1. 17/10/2026: cho mọi ô 2–3 phương án → template 10 ô ra
 *  1.536 tổ hợp mỗi cặp, 136.200 cho 44 cặp — tích của những ô không đáng test. */
const LOAI_DON_BAY = ['noi_dau', 'so_sanh', 'bang_chung', 'tran_an', 'uu_dai'];
export const PA_DU_KIEN = (oChu: Pick<OChu, 'loai'>[], i: number): number => {
  if (i === 0) return 3;
  const o = oChu[i]; if (!o) return 1;
  return LOAI_DON_BAY.includes(o.loai) && oChu.findIndex((x) => x.loai === o.loai) === i ? 2 : 1;
};
/** Tiền một bộ hình: kịch bản + mọi shot + mỗi biến thể thêm sinh lại các shot có người / bối cảnh (cents). */
export const tienCapCents = (t: Pick<TplConcept, 'so_shot' | 'shot_ca'>, soBienThe: number, g: GiaConcept): number =>
  g.kb_cents + t.so_shot * g.shot_cents + Math.max(0, soBienThe - 1) * t.shot_ca * g.shot_cents;
/** Tiền MỘT creative khi dựng thành phim riêng như cách Tạo phim hiện nay (chưa dùng lại clip): kịch bản + mọi shot có ô chữ (shot khác giữ hình). */
export const tienDungRiengCents = (t: Pick<TplConcept, 'o_chu'>, g: GiaConcept): number => g.kb_cents + new Set(t.o_chu.map((o) => `${o.loai}|${o.k}`)).size * g.shot_cents;
/** Tiền thêm của MỘT biến thể (cents) — chỉ shot có người / bối cảnh. */
export const tienBienTheCents = (t: Pick<TplConcept, 'shot_ca'>, g: GiaConcept): number => t.shot_ca * g.shot_cents;

export type ToHop = { cap_id: number; bien_the: BienTheHinh; chon: Record<string, number>; ma: string };
/** Mã QC của một tổ hợp — máy đọc, đặt làm tên quảng cáo: <concept>.T<template>.V<biến thể>.<số phương án từng ô theo thứ tự ô>. */
export const maToHop = (concept: string, tpl: number, v: number, oChu: OChu[], chon: Record<string, number>) => `${concept}.T${tpl}.V${v}.${oChu.map((o) => chon[o.k] ?? 0).join('')}`;
/** Mọi tổ hợp của một cặp. Ô chưa có phương án → cặp chưa ghép được (trả rỗng + ô thiếu). */
export function toHopCap(c: Concept, t: TplConcept, cap: Cap, bt: BienTheHinh[], pa: PhuongAn[]): { ds: ToHop[]; thieu: OChu[] } {
  const theoO = new Map(t.o_chu.map((o) => [o.k, pa.filter((p) => p.cap_id === cap.id && p.o === o.k).sort((a, b) => a.so - b.so)]));
  const thieu = t.o_chu.filter((o) => !theoO.get(o.k)!.length);
  if (thieu.length || !bt.length) return { ds: [], thieu };
  let chon: Record<string, number>[] = [{}];
  for (const o of t.o_chu) chon = chon.flatMap((x) => theoO.get(o.k)!.map((p) => ({ ...x, [o.k]: p.so })));
  return { ds: bt.flatMap((v) => chon.map((ch) => ({ cap_id: cap.id, bien_the: v, chon: ch, ma: maToHop(c.ma, t.id, v.so, t.o_chu, ch) }))), thieu };
}
/** Số tổ hợp dự kiến của một cặp khi chưa có phương án (để lên kế hoạch trước khi tiêu tiền). */
export const duKienCap = (t: Pick<TplConcept, 'o_chu'>, soBienThe: number): number => soBienThe * t.o_chu.reduce((n, _o, i) => n * PA_DU_KIEN(t.o_chu, i), 1);

/** Vòng test: 1 đổi ô đầu (hook) · 2 đổi diễn viên / bối cảnh · 3 đổi các ô thân · 0 cả ma trận. Các phần không đổi giữ phương án / biến thể 1. */
export type Vong = 0 | 1 | 2 | 3;
export function trongVong(x: ToHop, oChu: OChu[], v: Vong): boolean {
  if (v === 0) return true;
  const dau = oChu[0]?.k;
  const motO = (k: string) => (x.chon[k] ?? 1) === 1;
  if (v === 1) return x.bien_the.so === 1 && oChu.every((o) => o.k === dau || motO(o.k));
  if (v === 2) return oChu.every((o) => motO(o.k));
  return x.bien_the.so === 1 && motO(dau ?? '');
}
/** Phần KHÁC bản gốc của một tổ hợp (để hiện cho người đọc thay mã): ô có phương án ≠ 1 + biến thể ≠ V1. */
export function khacGoc(x: ToHop, oChu: OChu[], pa: PhuongAn[]): { ten: string; chu: string }[] {
  const ra: { ten: string; chu: string }[] = [];
  if (x.bien_the.so !== 1) ra.push({ ten: `V${x.bien_the.so}`, chu: [x.bien_the.nguoi_chinh, x.bien_the.nguoi_phu, x.bien_the.boi_canh].filter((s) => s && s !== '—').join(' · ') });
  for (const o of oChu.slice(1)) { const so = x.chon[o.k] ?? 1; if (so !== 1) ra.push({ ten: o.ten, chu: pa.find((p) => p.cap_id === x.cap_id && p.o === o.k && p.so === so)?.chu ?? '' }); }
  return ra;
}
