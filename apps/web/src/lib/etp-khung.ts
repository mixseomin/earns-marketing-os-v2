// KHUNG MÁY TỰ ĐỔI CAMP (anh 04/11/2026) — đọc sổ luật chung etp-bang-luat.json.khung_doi, cùng chỗ worker apps/cty/worker/ethopex.mjs đọc.
// doi = mọi luật tự tăng / giảm / tắt · nap = chỉ tự tăng camp đã tiêu ≥ nap_chi × ngân sách hôm nay + ROI hôm nay ≥ nap_roi% · bang = đóng băng.
import BANG_LUAT from './etp-bang-luat.json';

export type KhungDoi = 'doi' | 'nap' | 'bang';
export type HuongLuat = 'tang' | 'giam' | 'tat';
export const KD = BANG_LUAT.khung_doi as unknown as { doi: [number, number]; nap: [number, number]; nap_chi: number; nap_roi: number };
export const KHUNG_TEN: Record<KhungDoi, [string, string, string]> = {   // [biểu tượng, tên, màu]
  doi: ['🔧', 'Khung đổi', '#fb923c'], nap: ['⛽', 'Chỉ nạp camp thắng', '#4ade80'], bang: ['🔒', 'Đóng băng', '#64748b'] };

/** giờ VN hiện tại (số thực, 13.5 = 13:30) */
export const gioVnNay = (now = Date.now()) => { const d = new Date(now + 7 * 3600_000); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const trong = (h: number, [a, b]: [number, number]) => h >= a && h < b;
export const khungLuc = (h: number): KhungDoi => (trong(h, KD.doi) ? 'doi' : trong(h, KD.nap) ? 'nap' : 'bang');
/** khung đang chạy kéo tới mấy giờ (giờ nguyên, 0–23) */
export const hetKhung = (h: number) => { const k = khungLuc(h); for (let i = 1; i <= 24; i++) { const g = (Math.floor(h) + i) % 24; if (khungLuc(g) !== k) return g; } return Math.floor(h); };
/** camp đạt điều kiện nạp đêm (21–23h) theo số hôm nay */
export const datNap = (nay: { chi: number; thu: number }, nganSach: number) => nganSach > 0 && nay.chi >= KD.nap_chi * nganSach && nay.thu >= (1 + KD.nap_roi / 100) * nay.chi;

/** luật hướng `huong` đã đạt nhưng khung giờ đang chặn → giờ máy sẽ làm (vd "15h"); null = máy làm ngay nhịp này */
export function choKhung(huong: HuongLuat, h: number, nap?: boolean): string | null {
  const k = khungLuc(h);
  if (k === 'doi' || (k === 'nap' && huong === 'tang' && nap)) return null;
  return `${KD.doi[0]}h`;
}
