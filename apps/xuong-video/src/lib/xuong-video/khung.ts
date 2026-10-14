// KIỂM KHUNG — phần thuần (14/10/2026, anh: "cần giải pháp kỹ thuật để không xảy ra cho mọi shot về sau, check bằng mắt mới thấy thì còn sai nhiều").
// Mỗi keyframe phải được MÁY NHÌN so với thẻ shot + các khung cùng cảnh (kiem-khung.ts); kết quả gắn với ĐÚNG url keyframe đã kiểm, nên sinh lại
// keyframe là tự hết hiệu lực. Cổng video + duyệt animatic đọc chanKhung — không có đường nào đi tiếp bằng một khung chưa kiểm hoặc kiểm trượt.
import { giaChuCents, type Canh, type KiemKhung } from './kieu';

export const LOAI_LOI_KHUNG = [
  { key: 'chuyen_canh', ten: 'Chuyển cảnh không nối', mo_ta: 'từ khung trước sang khung này: trạng thái (ai cầm gì, ở đâu), hướng di chuyển, liền máy không phải khoảnh khắc kế' },
  { key: 'bo_tri', ten: 'Bố trí set lệch', mo_ta: 'đồ vật đổi chỗ / đổi trước–sau so với các khung khác trong cảnh' },
  { key: 'vi_tri', ten: 'Nhân vật sai chỗ', mo_ta: 'nhân vật ở sai phía / sai chỗ trong bộ set so với hành động' },
  { key: 'vuot_truc', ten: 'Vượt trục 180°', mo_ta: 'máy sang phía bên kia hành động, hướng màn hình đảo' },
  { key: 'thieu', ten: 'Thiếu', mo_ta: 'nhân vật / đạo cụ thẻ shot cần mà không có' },
  { key: 'thua', ten: 'Thừa', mo_ta: 'nhân vật nhân đôi, tay người lạc, mặt trên vật phải trơn, chữ, thứ thẻ không có' },
  { key: 'trang_thai', ten: 'Sai trạng thái mở', mo_ta: 'khung không đúng trạng thái MỞ của thẻ shot' },
  { key: 'anh_sang', ten: 'Ánh sáng lệch', mo_ta: 'ánh sáng / giờ trong ngày không nối với cảnh' },
  { key: 'nhan_dang', ten: 'Sai tạo hình', mo_ta: 'nhân vật / đạo cụ khác ảnh mẫu (màu, dáng, chi tiết)' },
] as const;
export type LoaiLoiKhung = (typeof LOAI_LOI_KHUNG)[number]['key'];
export const tenLoiKhung = (k: string) => LOAI_LOI_KHUNG.find((x) => x.key === k)?.ten ?? k;
export const TEN_NUT_KHUNG = '🔍 Kiểm khung';

/** Trạng thái kiểm khung của một shot: 'khong' = chưa có keyframe, 'chua' = chưa kiểm / keyframe đổi sau lần kiểm, 'dat', 'tay' = người duyệt tay, 'lech'. */
export function trangThaiKhung(c: Pick<Canh, 'keyframe_url' | 'kiem_khung'>): 'khong' | 'chua' | 'dat' | 'tay' | 'lech' {
  if (!c.keyframe_url) return 'khong';
  const k = c.kiem_khung;
  if (!k || k.url !== c.keyframe_url) return 'chua';
  if (k.dat) return 'dat';
  return k.duyet_tay ? 'tay' : 'lech';
}

/** Lý do chặn (rỗng = qua) — MỘT luật cho cổng video, duyệt animatic, lưới. */
export function chanKhung(c: Pick<Canh, 'keyframe_url' | 'kiem_khung'>): string | null {
  const t = trangThaiKhung(c);
  if (t === 'chua') return `keyframe chưa qua ${TEN_NUT_KHUNG} (bố trí set, trục máy, nhân vật) — hoặc đã sinh lại sau lần kiểm`;
  if (t === 'lech') return `keyframe lệch: ${(c.kiem_khung as KiemKhung).loi.map((l) => `${tenLoiKhung(l.loai)} — ${l.mo_ta}`).join('; ')} — sinh lại keyframe rồi kiểm lại`;
  return null;
}

/** Các khối cảnh cần kiểm: khối = shot liền nhau cùng phan_doan; khối có ít nhất một shot 'chua' thì kiểm CẢ khối (so cả cảnh mới thấy lệch bố trí). */
export function khoiCanKiem<T extends Pick<Canh, 'id' | 'phan_doan' | 'keyframe_url' | 'kiem_khung'>>(ds: T[], tatCa = false): T[][] {
  const khoi: T[][] = [];
  for (const c of ds) { const l = khoi[khoi.length - 1]; if (l && l[0]!.phan_doan === c.phan_doan) l.push(c); else khoi.push([c]); }
  return khoi.map((k) => k.filter((c) => c.keyframe_url)).filter((k) => k.length && (tatCa || k.some((c) => trangThaiKhung(c) === 'chua')));
}

/** Token ước cho một khối n khung (+1 khung cảnh trước; ảnh 640×1138 ≈ 1k token + thẻ ≈ 300) — nút hiện giá trước khi bấm. */
export const tokenKhoi = (n: number) => ({ in: 3500 + n * 2500, out: 300 + n * 180 });   // mỗi khung + khung xám 3D của nó
export const giaKiemKhung = (model: string, khoi: number[]): number => khoi.reduce((a, n) => { const t = tokenKhoi(n); return a + giaChuCents(model, t.in, t.out); }, 0);
