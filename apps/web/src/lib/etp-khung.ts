// KHUNG MÁY TỰ ĐỔI CAMP (anh 04/11/2026) — đọc sổ luật chung etp-bang-luat.json.khung_doi, cùng chỗ worker apps/cty/worker/ethopex.mjs đọc.
// doi = mọi luật tự tăng / giảm / tắt · nap = chỉ tự tăng camp đã tiêu ≥ nap_chi × ngân sách hôm nay + ROI hôm nay ≥ nap_roi% · bang = đóng băng.
import BANG_LUAT from './etp-bang-luat.json';

export type KhungDoi = 'doi' | 'nap' | 'sang' | 'bang';
export type HuongLuat = 'tang' | 'giam' | 'tat';
export const KD = BANG_LUAT.khung_doi as unknown as { doi: [number, number]; nap: [number, number]; nap_chi: number; nap_roi: number; sang: [number, number]; sang_roi: number };
export const KHUNG_TEN: Record<KhungDoi, [string, string, string]> = {   // [biểu tượng, tên, màu]
  doi: ['🔧', 'Khung đổi', '#fb923c'], nap: ['⛽', 'Chỉ nạp camp thắng', '#4ade80'], sang: ['☀', 'Nạp sáng', '#22c55e'], bang: ['🔒', 'Đóng băng', '#64748b'] };

/** giờ VN hiện tại (số thực, 13.5 = 13:30) */
export const gioVnNay = (now = Date.now()) => { const d = new Date(now + 7 * 3600_000); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const trong = (h: number, [a, b]: [number, number]) => h >= a && h < b;
export const khungLuc = (h: number): KhungDoi => (trong(h, KD.doi) ? 'doi' : trong(h, KD.nap) ? 'nap' : KD.sang && trong(h, KD.sang) ? 'sang' : 'bang');   // cùng thứ tự với khungCua của worker (kiểm chéo ở etp-khung.test.mts)
/** khung đang chạy kéo tới mấy giờ (giờ nguyên, 0–23) */
export const hetKhung = (h: number) => { const k = khungLuc(h); for (let i = 1; i <= 24; i++) { const g = (Math.floor(h) + i) % 24; if (khungLuc(g) !== k) return g; } return Math.floor(h); };
/** SỔ HOÃN của máy (etp.cau_hinh 'khung_hoan', worker ethopex.mjs ghi mỗi nhịp): camp máy ĐÃ đủ luật + đủ công tắc nhưng hoãn vì khung giờ.
 *  Trang chỉ đọc sổ này — không tự đoán từ hướng luật (audit 05/11/2026: đoán ra ↓26 cho 26 camp G10 chỉ đang theo dõi). Sổ cũ hơn HAN_PHUT = máy không chạy → bỏ, không hứa. */
export const HAN_PHUT = 90;
export function docHoan(cauHinh: { khoa: string; gia_tri: unknown }[], now = Date.now()): { luc: string | null; cu: boolean; ds: Map<number, HuongLuat> } {
  const g = cauHinh.find((k) => k.khoa === 'khung_hoan')?.gia_tri as (Partial<Record<HuongLuat, number[]>> & { luc?: string }) | undefined;
  const luc = g?.luc ?? null, cu = !luc || now - Date.parse(luc) > HAN_PHUT * 60_000, ds = new Map<number, HuongLuat>();
  if (!cu) for (const h of ['tang', 'giam', 'tat'] as const) for (const id of g?.[h] ?? []) ds.set(Number(id), h);   // tắt ghi sau cùng = tắt thắng
  return { luc, cu, ds };
}
