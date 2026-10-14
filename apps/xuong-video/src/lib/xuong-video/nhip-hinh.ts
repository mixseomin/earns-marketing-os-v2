// NHỊP HÌNH (13/10/2026 — "làm sao để chuyển động đa dạng hơn"): Fox tập 2 có 7/14 shot máy đứng yên, ba cặp shot liền nhau trùng hệt
// cỡ cảnh + chuyển động máy → xem như một ảnh tĩnh kéo dài. Máy đo trên kỹ thuật đã chọn của từng shot (ky_thuat), chặn keyframe như
// các cổng tiền kỳ khác (quy-trinh.ts › chanTienKy), và có cách sửa 0đ: đaDangMay đổi chuyển động máy đúng các shot phạm luật.
// Hành động TRONG khung (nhân vật làm gì) thì luật kể chuyện của Claude lo (claude.ts › LUAT_KE_CHUYEN số 9) + câu "khung hình sống"
// trong prompt video (sinh-video.ts). Thuần — tự kiểm: nhip-hinh.test.mts
import type { KyThuatShot } from './dien-anh';
import { O_DAN_DUNG, type DanDung } from './kieu';

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
export const TIEN_TO_DAN_KHONG_GIAN = 'dẫn không gian: ';
export const TIEN_TO_VAI_KE = 'vai kể: ';
export const TIEN_TO_THE_SHOT = 'thẻ shot: ';
/** THẺ SHOT (kieu.ts › DanDung): phim truyện, mỗi shot phải có đủ bố cục 3 lớp, trạng thái mở/kết, hướng, mục đích cảm xúc trước khi sinh
 *  keyframe (motif không bắt buộc). Quảng cáo không xét. */
export function kiemTheShot(ds: { thu_tu: number; dan_dung?: DanDung }[], p: { laQc?: boolean }): string[] {
  if (p.laQc) return [];
  const can = O_DAN_DUNG.filter((o) => o.key !== 'motif');
  const thieu = ds.map((c) => ({ c, t: can.filter((o) => !(c.dan_dung?.[o.key] ?? '').trim()) })).filter((x) => x.t.length);
  if (!thieu.length) return [];
  return [`${TIEN_TO_THE_SHOT}${thieu.length} shot thiếu ô thẻ (${thieu.slice(0, 5).map((x) => `#${x.c.thu_tu}: ${x.t.map((o) => o.ten.toLowerCase()).join(', ')}`).join(' · ')}${thieu.length > 5 ? '…' : ''})`];
}
/** VAI KỂ (14/10/2026 — "thiếu dẫn thời gian, góc người thứ 3, góc tổng thể, góc tâm trạng…"): một tập phim truyện phải kể bằng nhiều
 *  điểm nhìn, không chỉ chuỗi shot hành động. Đo trên ky_thuat.vai (dien-anh.ts › nhóm 'vai'). Quảng cáo và tập < 6 shot không xét. */
export function kiemVaiKe(ds: { thu_tu: number; phan_doan?: string; ky_thuat?: KyThuatShot | null }[], p: { laQc?: boolean }): string[] {
  if (p.laQc || ds.length < 6) return [];
  const out: string[] = []; const v = (i: number) => ds[i]?.ky_thuat?.vai ?? '';
  const chua = ds.filter((_, i) => !v(i));
  if (chua.length) out.push(`${TIEN_TO_VAI_KE}${chua.length} shot chưa chọn vai kể (${chua.slice(0, 6).map((c) => `#${c.thu_tu}`).join(', ')}${chua.length > 6 ? '…' : ''})`);
  if (![0, 1, 2].some((i) => ['thiet_lap', 'thoi_gian'].includes(v(i)))) out.push(`${TIEN_TO_VAI_KE}mở tập chưa đặt NƠI + THỜI ĐIỂM — 3 shot đầu cần một shot thiết lập hoặc dấu thời gian`);
  const pc = new Map<string, number[]>(); ds.forEach((c, i) => { const k = c.phan_doan ?? ''; if (k) pc.set(k, [...(pc.get(k) ?? []), i]); });
  const thieuTt = [...pc].filter(([, is]) => is.length >= 3 && !is.some((i) => ['tong_the', 'thiet_lap'].includes(v(i)))).map(([k]) => `"${k}"`);
  if (thieuTt.length) out.push(`${TIEN_TO_VAI_KE}phân cảnh chưa có shot tổng thể (ai ở đâu): ${thieuTt.join(', ')}`);
  const co = new Set(ds.map((_, i) => v(i)));
  const thieu = [!co.has('phan_ung') && 'phản ứng', !co.has('tam_trang') && 'tâm trạng', !co.has('nguoi_thu_ba') && !co.has('chu_quan') && 'góc người thứ ba / chủ quan'].filter(Boolean);
  if (thieu.length) out.push(`${TIEN_TO_VAI_KE}cả tập thiếu shot ${thieu.join(', ')}`);
  for (let i = 0; i + 3 < ds.length; i++) if ([0, 1, 2, 3].every((j) => v(i + j) === 'hanh_dong')) { out.push(`${TIEN_TO_VAI_KE}#${ds[i]!.thu_tu}–#${ds[i + 3]!.thu_tu} bốn shot hành động liền — chen phản ứng / chi tiết / người thứ ba để người xem kịp cảm`); break; }
  return out;
}
const RONG = new Set(['ews', 'ws']);
/** DẪN KHÔNG GIAN (14/10/2026 — kiểu Larva): người xem phải biết MÌNH ĐANG Ở ĐÂU trong thế giới trước khi chuyện xảy ra.
 *  1. Mở tập: một trong 2 shot đầu là toàn cảnh (ews/ws) — dẫn từ cả thế giới vào.
 *  2. Lần ĐẦU tới một nơi mới (anchor Bối cảnh khác hẳn shot trước, chưa từng xuất hiện trong tập): shot đó hoặc shot liền trước (hành
 *     trình) phải là toàn cảnh. Quay lại nơi đã thấy thì không cần. Quảng cáo không xét. boiCanh = id các anchor loại Bối cảnh của phim. */
export function kiemDanKhongGian(ds: { thu_tu: number; nhan_vat?: number[]; ky_thuat?: KyThuatShot | null }[], boiCanh: Iterable<number>, p: { laQc?: boolean }): string[] {
  if (p.laQc || ds.length < 3) return [];
  const bc = new Set(boiCanh); const out: string[] = [];
  const rong = (i: number) => RONG.has(ds[i]?.ky_thuat?.co_canh ?? '');
  if (!rong(0) && !rong(1)) out.push(`${TIEN_TO_DAN_KHONG_GIAN}mở tập chưa có shot toàn cảnh (2 shot đầu đều gần) — người xem không biết đang ở đâu trong thế giới`);
  const noi = (i: number) => (ds[i]?.nhan_vat ?? []).filter((x) => bc.has(x)).sort((a, b) => a - b).join(',');
  const daThay = new Set<string>(); let truoc = '';
  const lo: number[] = [];
  ds.forEach((_, i) => {
    const k = noi(i); if (!k) return;
    if (truoc && k !== truoc && !daThay.has(k) && !rong(i) && !rong(i - 1)) lo.push(ds[i]!.thu_tu);
    daThay.add(k); truoc = k;
  });
  if (lo.length) out.push(`${TIEN_TO_DAN_KHONG_GIAN}tới nơi mới mà không có shot toàn cảnh / hành trình dẫn vào: ${lo.map((x) => `#${x}`).join(', ')}`);
  return out;
}
/** Shot phát ngắn hơn giây đọc tối thiểu — chặn keyframe (quy-trinh.ts › chanTienKy). Quảng cáo không xét (luật QC riêng ở kiem-qc.ts). */
export function kiemGiayDoc(ds: { thu_tu: number; phat_s: number | null; thoi_luong_s: number }[], p: { laQc?: boolean; khong_loi?: boolean }): string[] {
  if (p.laQc) return [];
  const toi = giayDoc(p);
  const ngan = ds.filter((c) => (c.phat_s && c.phat_s > 0 ? c.phat_s : c.thoi_luong_s || 4) < toi - 0.05);
  return ngan.length ? [`${TIEN_TO_NHIP_DOC}${ngan.length} shot phát dưới ${toi}s (${ngan.slice(0, 8).map((c) => `#${c.thu_tu} ${c.phat_s ?? c.thoi_luong_s}s`).join(', ')}${ngan.length > 8 ? '…' : ''}) — người xem chưa kịp hiểu đã cắt; gộp/bớt shot hoặc kéo dài`] : [];
}
