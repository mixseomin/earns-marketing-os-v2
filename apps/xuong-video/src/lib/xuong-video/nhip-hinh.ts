// NHỊP HÌNH (13/10/2026 — "làm sao để chuyển động đa dạng hơn"): Fox tập 2 có 7/14 shot máy đứng yên, ba cặp shot liền nhau trùng hệt
// cỡ cảnh + chuyển động máy → xem như một ảnh tĩnh kéo dài. Máy đo trên kỹ thuật đã chọn của từng shot (ky_thuat), chặn keyframe như
// các cổng tiền kỳ khác (quy-trinh.ts › chanTienKy), và có cách sửa 0đ: đaDangMay đổi chuyển động máy đúng các shot phạm luật.
// Hành động TRONG khung (nhân vật làm gì) thì luật kể chuyện của Claude lo (claude.ts › LUAT_KE_CHUYEN số 9) + câu "khung hình sống"
// trong prompt video (sinh-video.ts). Thuần — tự kiểm: nhip-hinh.test.mts
import type { KyThuatShot } from './dien-anh';

export const TIEN_TO_NHIP_HINH = 'nhịp hình: ';
/** Tối đa bao nhiêu phần shot được để máy đứng yên (hài cần vài shot đứng yên để đúng nhịp, nhưng không quá nửa phim). */
export const TI_LE_TINH_TOI_DA = 0.4;
const TINH = (k?: KyThuatShot) => !k?.chuyen_dong || k.chuyen_dong === 'tinh';

type ShotNhip = { id?: number; thu_tu: number; ky_thuat?: KyThuatShot | null };

/** Lỗi nhịp hình của một chuỗi shot (đã xếp theo thứ tự phát). */
export function kiemNhipHinh(ds: ShotNhip[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < ds.length; i++) {
    const a = ds[i - 1]!.ky_thuat ?? {}; const b = ds[i]!.ky_thuat ?? {};
    if (a.co_canh && a.co_canh === b.co_canh && (a.chuyen_dong ?? 'tinh') === (b.chuyen_dong ?? 'tinh'))
      out.push(`${TIEN_TO_NHIP_HINH}#${ds[i - 1]!.thu_tu}–#${ds[i]!.thu_tu} cùng cỡ cảnh + cùng chuyển động máy (nhìn như một shot kéo dài)`);
  }
  const tinh = ds.filter((c) => TINH(c.ky_thuat ?? undefined)).length;
  if (ds.length >= 5 && tinh > Math.floor(ds.length * TI_LE_TINH_TOI_DA))
    out.push(`${TIEN_TO_NHIP_HINH}${tinh}/${ds.length} shot máy đứng yên (tối đa ${Math.floor(ds.length * TI_LE_TINH_TOI_DA)})`);
  return out;
}

/** Chuyển động máy hợp từng cỡ cảnh, theo thứ tự ưu tiên (đều là key của thư viện điện ảnh dien-anh.ts). */
const HOP_CO_CANH: Record<string, string[]> = {
  ecu: ['day_vao', 'lia', 'cam_tay'], cu: ['day_vao', 'lia', 'nghieng_len'], mcu: ['day_vao', 'truot_ngang', 'lia'],
  ms: ['truot_ngang', 'day_vao', 'lia'], two: ['vong', 'truot_ngang', 'lia'], ws: ['lui_ra', 'truot_ngang', 'cau'], ews: ['cau', 'lui_ra', 'lia'],
};
const HOP_MAC_DINH = ['day_vao', 'truot_ngang', 'lia', 'lui_ra'];

/** Sửa 0đ: đổi chuyển động máy của các shot phạm luật, ít đổi nhất có thể — trả danh sách { id, ky_thuat mới } cần ghi.
 *  Đổi: shot trùng y hệt shot trước; rồi tới khi số shot đứng yên ≤ trần (đổi các shot đứng yên nằm cạnh shot đứng yên khác trước). */
export function daDangMay<T extends ShotNhip & { id: number }>(ds: T[]): { id: number; ky_thuat: KyThuatShot }[] {
  const kt = ds.map((c) => ({ ...(c.ky_thuat ?? {}) }));
  const doi = new Set<number>();
  const chon = (i: number) => {
    const truoc = kt[i - 1]?.chuyen_dong; const sau = kt[i + 1]?.chuyen_dong;
    const ds2 = HOP_CO_CANH[kt[i]!.co_canh ?? ''] ?? HOP_MAC_DINH;
    const m = ds2.find((x) => x !== truoc && x !== sau && x !== kt[i]!.chuyen_dong) ?? ds2[0]!;
    kt[i]!.chuyen_dong = m; doi.add(i);
  };
  for (let i = 1; i < kt.length; i++) {
    const a = kt[i - 1]!, b = kt[i]!;
    if (a.co_canh && a.co_canh === b.co_canh && (a.chuyen_dong ?? 'tinh') === (b.chuyen_dong ?? 'tinh')) chon(i);
  }
  const tran = Math.floor(kt.length * TI_LE_TINH_TOI_DA);
  const tinh = () => kt.map((k, i) => (TINH(k) ? i : -1)).filter((i) => i >= 0);
  while (kt.length >= 5 && tinh().length > tran) {
    const t = tinh();
    // đứng yên cạnh đứng yên trước (phá chuỗi tĩnh), không có thì shot đứng yên đầu tiên
    const i = t.find((x) => TINH(kt[x - 1]) || TINH(kt[x + 1])) ?? t[0]!;
    chon(i);
  }
  return [...doi].map((i) => ({ id: ds[i]!.id, ky_thuat: kt[i]! }));
}

/** NHỊP ĐỌC (14/10/2026 — Tango & Lint tập 1: "chuyển cảnh nhanh chưa kịp hiểu gì"): 20 shot trong 48s, mỗi clip 4s bị cắt còn 2–2,5s
 *  đúng lúc hành động chưa xong. Số giây tối thiểu một shot phải PHÁT để người xem đọc xong hành động: quảng cáo cắt nhanh được (có chữ
 *  + lời dẫn đỡ), phim truyện cần trọn đầu–giữa–cuối của hành động, phim không lời còn lâu hơn vì không có lời giải thích.
 *  MỘT luật cho: tách cảnh (claude.ts kẹp phat_s + giới hạn số shot), khớp giây theo giọng (hau-ky.ts không co dưới mức này),
 *  cổng tiền kỳ (chanTienKy). */
export const giayDoc = (p: { laQc?: boolean; khong_loi?: boolean }): number => (p.laQc ? 1.5 : p.khong_loi ? 3.5 : 3);
/** Số shot tối đa cho một thời lượng mà mỗi shot vẫn đủ giây đọc (chừa ~0,5s/shot cho phản ứng). */
export const soShotToiDa = (giay: number, p: { laQc?: boolean; khong_loi?: boolean }): number => Math.max(1, Math.floor(giay / (giayDoc(p) + (p.laQc ? 0 : 0.5))));
export const TIEN_TO_NHIP_DOC = 'nhịp đọc: ';
/** Shot phát ngắn hơn giây đọc tối thiểu — chặn keyframe (quy-trinh.ts › chanTienKy). Quảng cáo không xét (luật QC riêng ở kiem-qc.ts). */
export function kiemGiayDoc(ds: { thu_tu: number; phat_s: number | null; thoi_luong_s: number }[], p: { laQc?: boolean; khong_loi?: boolean }): string[] {
  if (p.laQc) return [];
  const toi = giayDoc(p);
  const ngan = ds.filter((c) => (c.phat_s && c.phat_s > 0 ? c.phat_s : c.thoi_luong_s || 4) < toi - 0.05);
  return ngan.length ? [`${TIEN_TO_NHIP_DOC}${ngan.length} shot phát dưới ${toi}s (${ngan.slice(0, 8).map((c) => `#${c.thu_tu} ${c.phat_s ?? c.thoi_luong_s}s`).join(', ')}${ngan.length > 8 ? '…' : ''}) — người xem chưa kịp hiểu đã cắt; gộp/bớt shot hoặc kéo dài`] : [];
}
