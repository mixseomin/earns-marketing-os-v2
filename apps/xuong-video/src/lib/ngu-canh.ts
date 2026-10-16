// NGỮ CẢNH MÀN ĐANG MỞ (phim / tập) cho các công cụ toàn trang — thanh 🔎 Tìm nhanh (tim-nhanh.tsx) mở sổ liền mạch / bộ set / nối khung của
// ĐÚNG tập đang xem. Tập đang hiện (tap.tsx) tự khai lúc gắn, gỡ lúc rời. Phim lồng nhau (lớp chồng) thì tập mở sau cùng thắng.
export type NguCanh = { phimId: number; tenPhim: string; tapId: number; soTap: number; tenTap: string };
const SU_KIEN = 'xv-ngu-canh';
let ds: NguCanh[] = [];
export const nguCanh = (): NguCanh | null => ds[ds.length - 1] ?? null;
export function khaiNguCanh(n: NguCanh): () => void {
  ds = [...ds.filter((x) => x.tapId !== n.tapId), n]; window.dispatchEvent(new Event(SU_KIEN));
  return () => { ds = ds.filter((x) => x.tapId !== n.tapId); window.dispatchEvent(new Event(SU_KIEN)); };
}
export const ngheNguCanh = (f: () => void): (() => void) => { window.addEventListener(SU_KIEN, f); return () => window.removeEventListener(SU_KIEN, f); };
