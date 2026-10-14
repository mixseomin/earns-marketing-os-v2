// TEMPLATE (14/10/2026 — anh: "template chính là các thành phần như đang làm trong studio, sau đó thay prompt, context, cuối cùng ghép lại";
// "template phải cho phép edit"). Template = một PHIM thường (kinh_thanh.template), sửa bằng toàn bộ studio; chỗ nào cần đổi theo sản phẩm /
// góc / chân dung thì gõ ô {{ten_o}}. Tạo phim từ template = chép phim + điền ô (template-db.ts). Thuần — tự kiểm:
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/template.test.mts
import { CAM_XUC_THEO_LOAI, LOAI_SHOT_MAU, type CauHinhTemplate, type OTemplate, type LoaiShotMau, type PhanCanh } from './kieu';
import type { Beat } from './dien-anh';

const RE_O = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Mọi ô {{x}} xuất hiện trong một giá trị bất kỳ (chuỗi / mảng / object lồng nhau), theo thứ tự gặp đầu tiên, không trùng. */
export function timO(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') { for (const m of x.matchAll(RE_O)) { const k = m[1]!.toLowerCase(); if (!out.includes(k)) out.push(k); } }
  else if (Array.isArray(x)) for (const v of x) timO(v, out);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) timO(v, out);
  return out;
}

const coGiaTri = (gt: Record<string, string>, k: string) => typeof gt[k] === 'string' && gt[k]!.trim() !== '';

/** Điền ô trong một chuỗi; ô chưa có giá trị giữ nguyên {{x}} (thấy ngay chỗ còn thiếu). */
export const dienChu = (s: string, gt: Record<string, string>): string => s.replace(RE_O, (all, k: string) => (coGiaTri(gt, k.toLowerCase()) ? gt[k.toLowerCase()]!.trim() : all));

/** Điền sâu. Trong MẢNG, phần tử đúng bằng một ô ("{{anh_san_pham}}") nở thành nhiều phần tử theo từng dòng của giá trị — dùng cho danh sách ảnh. */
export function dienSau<T>(x: T, gt: Record<string, string>): T {
  if (typeof x === 'string') return dienChu(x, gt) as T;
  if (Array.isArray(x)) {
    const out: unknown[] = [];
    for (const v of x) {
      const m = typeof v === 'string' ? /^\s*\{\{\s*([a-z0-9_]+)\s*\}\}\s*$/i.exec(v) : null;
      if (m && coGiaTri(gt, m[1]!.toLowerCase())) out.push(...gt[m[1]!.toLowerCase()]!.split('\n').map((d) => d.trim()).filter(Boolean));
      else out.push(dienSau(v, gt));
    }
    return out as T;
  }
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, dienSau(v, gt)])) as T;
  return x;
}

/** Nhóm ô trong form điền (anh 14/10/2026: "tổ chức template cho dễ dùng") — người điền đi từ trên xuống, nhóm Sản phẩm mở sẵn. */
export const NHOM_O = [
  { key: 'san_pham', ten: '🛍 Sản phẩm & ưu đãi' },
  { key: 'nhan_vat', ten: '👤 Nhân vật & đối tượng' },
  { key: 'boi_canh', ten: '🏠 Bối cảnh & tình huống' },
  { key: 'cau_chuyen', ten: '💬 Câu chuyện (chữ màn + hình)' },
  { key: 'anh', ten: '🖼 Ảnh dùng nguyên' },
] as const;
export type NhomO = (typeof NHOM_O)[number]['key'];
/** Nhóm của một ô: khai tay (o.nhom) trước, không thì đoán theo tên ô. */
export function nhomCuaO(k: string, o?: Pick<OTemplate, 'nhom'>): NhomO {
  if (o?.nhom && NHOM_O.some((n) => n.key === o.nhom)) return o.nhom as NhomO;
  if (/^anh_\d+$/.test(k)) return 'anh';
  if (/^(san_pham|anh_san_pham|link|diem_noi_bat|uu_dai|dam_bao|gia)/.test(k)) return 'san_pham';
  if (/^(nhan_vat|giong|doi_tuong)/.test(k)) return 'nhan_vat';
  if (/^(boi_canh|tinh_huong)/.test(k)) return 'boi_canh';
  return 'cau_chuyen';
}
/** Ô theo nhóm (giữ thứ tự trong nhóm), bỏ nhóm rỗng. */
export const theoNhom = <T extends { k: string; nhom?: string }>(ds: T[]) =>
  NHOM_O.map((n) => ({ ...n, o: ds.filter((o) => nhomCuaO(o.k, o) === n.key) })).filter((n) => n.o.length);

export type OTemplateDs = OTemplate & { k: string; /** ô có xuất hiện trong chữ của template không (khai mà không dùng = thừa) */ dung: boolean };

/** Danh sách ô để hiện form: ô đã khai (theo cfg.thu_tu, rồi khoá còn lại) trước, ô gõ trong chữ mà chưa khai sau (nhãn = tên ô). */
export function dsOTemplate(cfg: CauHinhTemplate | null | undefined, timThay: string[]): OTemplateDs[] {
  const khai = cfg?.o ?? {};
  const thuTu = [...(cfg?.thu_tu ?? []).filter((k) => khai[k]), ...Object.keys(khai).filter((k) => !(cfg?.thu_tu ?? []).includes(k))];
  const ds: OTemplateDs[] = thuTu.map((k) => ({ ...khai[k]!, k, ten: khai[k]!.ten || k, dung: timThay.includes(k) }));
  for (const k of timThay) if (!khai[k]) ds.push({ k, ten: k.replace(/_/g, ' '), dung: true });
  return ds;
}

/** Ô đang dùng mà chưa có giá trị → chặn tạo phim (phim mới không được còn {{x}}). */
export const oThieu = (ds: OTemplateDs[], gt: Record<string, string>): OTemplateDs[] => ds.filter((o) => o.dung && !coGiaTri(gt, o.k));

/** KHUNG TRUYỆN + PHÂN CẢNH của một QC suy từ loại shot (cổng tiền kỳ đòi ≥3 beat có âm có dương + mỗi shot thuộc một phân cảnh — 14/10/2026
 *  phim #34 tạo từ template bị chặn keyframe vì template chỉ có shot). Phân cảnh = mỗi loại shot một cảnh (tên = phan_doan của shot). */
const BEAT_THEO_LOAI: Record<LoaiShotMau, [string, string]> = {
  hook: ['Mở', 'giữ tay người xem trong 2–3 giây đầu'], uu_dai: ['Mở', 'ưu đãi đập vào mắt'], noi_dau: ['Vấn đề', 'nỗi khó chịu người xem nhận ra mình'],
  giai_phap: ['Giải quyết', 'sản phẩm xuất hiện và làm được việc'], demo: ['Giải quyết', 'sản phẩm xuất hiện và làm được việc'], tinh_nang: ['Giải quyết', 'sản phẩm xuất hiện và làm được việc'],
  so_sanh: ['Giải quyết', 'sản phẩm xuất hiện và làm được việc'], bang_chung: ['Chứng minh', 'người thật, review, trấn an'], tran_an: ['Chứng minh', 'người thật, review, trấn an'],
  cta: ['Chốt', 'ưu đãi + kêu gọi mua'], end_card: ['Chốt', 'ưu đãi + kêu gọi mua'], khac: ['Giải quyết', ''],
};
const CAM_BEAT: Record<string, number> = { 'Mở': 1, 'Vấn đề': -2, 'Giải quyết': 3, 'Chứng minh': 3, 'Chốt': 5 };
export function khungTuShot(shots: { loai: LoaiShotMau }[]): { beats: Beat[]; phan_canh: PhanCanh[] } {
  const beats: Beat[] = []; const phan_canh: PhanCanh[] = [];
  for (const [i, s] of shots.entries()) {
    // ưu đãi ở cuối phim là chốt, ở đầu là mở
    const [ten, mo] = s.loai === 'uu_dai' && i > shots.length / 2 ? BEAT_THEO_LOAI.cta : BEAT_THEO_LOAI[s.loai] ?? BEAT_THEO_LOAI.khac;
    if (!beats.some((b) => b.ten === ten)) beats.push({ ten, mo_ta: mo, cam_xuc: CAM_BEAT[ten] ?? 0 });
    if (!phan_canh.some((p) => p.ten === s.loai)) {
      const cx = CAM_XUC_THEO_LOAI[s.loai] ?? 0;
      phan_canh.push({ ten: s.loai, beat: ten, muc_tieu: LOAI_SHOT_MAU.find((l) => l.key === s.loai)?.mo ?? '', xung_dot: '', an_y: '', nhip: 'nhanh', cam_xuc_dau: cx, cam_xuc_cuoi: cx });
    }
  }
  return { beats, phan_canh };
}

/** Giá trị ban đầu của form = giá trị mẫu của từng ô (template tự điền được ngay để thử). */
export const giaTriMau = (ds: OTemplateDs[]): Record<string, string> => Object.fromEntries(ds.filter((o) => o.mau).map((o) => [o.k, o.mau!]));
