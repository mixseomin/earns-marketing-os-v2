// KHUNG MÁY TỰ ĐỔI CAMP (anh 04/11/2026) — đọc sổ luật chung etp-bang-luat.json.khung_doi, cùng chỗ worker apps/cty/worker/ethopex.mjs đọc.
// tang = mọi luật tự tăng (21–07h, qua nửa đêm) · giam = mọi luật tự giảm / tắt, không tăng (15–21h) · sang = chỉ nạp camp đã tiêu ≥ nap_chi × ngân sách + ROI hôm nay ≥ sang_roi% (07–15h)
// (anh 05/11/2026 đảo khung theo số toàn đội — xem _ghi trong sổ luật). bang = đóng băng (không còn giờ nào, giữ cho an toàn).
import BANG_LUAT from './etp-bang-luat.json';

export type KhungDoi = 'tang' | 'giam' | 'sang' | 'bang';
export type HuongLuat = 'tang' | 'giam' | 'tat';
export const KD = BANG_LUAT.khung_doi as unknown as { tang: [number, number]; giam: [number, number]; sang: [number, number]; sang_roi: number; nap_chi: number; len: [number, number]; nghi_gio: number; nghi_don_gio: number; hoc_gio: number; don_13h: number; don_gio: number };
export const KHUNG_TEN: Record<KhungDoi, [string, string, string]> = {   // [biểu tượng, tên, màu]
  tang: ['⬆', 'Khung tăng', '#4ade80'], giam: ['🔧', 'Khung giảm · tắt', '#fb923c'], sang: ['☀', 'Nạp sáng', '#22c55e'], bang: ['🔒', 'Đóng băng', '#64748b'] };
/** giờ VN máy sẽ làm việc đang hoãn theo hướng luật */
export const gioLam = (huong: HuongLuat) => (huong === 'tang' ? KD.tang[0] : KD.giam[0]);

/** giờ VN hiện tại (số thực, 13.5 = 13:30) */
export const gioVnNay = (now = Date.now()) => { const d = new Date(now + 7 * 3600_000); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const trong = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h < b : h >= a || h < b);   // [21, 7] = qua nửa đêm
export const khungLuc = (h: number): KhungDoi => (trong(h, KD.giam) ? 'giam' : trong(h, KD.tang) ? 'tang' : KD.sang && trong(h, KD.sang) ? 'sang' : 'bang');   // cùng thứ tự với khungCua của worker (kiểm chéo ở etp-khung.test.mts)
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
/** KHI NÀO MÁY THỰC SỰ LÀM luật tăng đã đạt (anh 06/11/2026 "camp có thể tăng bậc thì ghi thêm bao lâu nữa sẽ thực sự tăng"): máy luật chạy NHIP_PHUT phút / lần
 *  (apps/cty/worker/nhip.mjs kiem-ethopex), lần gần nhất = sổ hoãn `luc`. Trong khung tăng → nhịp kế; ngoài khung → nhịp đầu tiên sau giờ mở khung tăng. → mốc ms, null khi sổ cũ (máy không chạy) */
export const NHIP_PHUT = 30;
export function lucTang(luc: string | null, cu: boolean, now = Date.now()): number | null {
  if (!luc || cu) return null;
  const buoc = NHIP_PHUT * 60_000; let t = Date.parse(luc) + buoc; while (t < now) t += buoc;
  if (khungLuc(gioVnNay(now)) === 'tang') return t;
  const vn = new Date(now + 7 * 3600_000); let mo = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), KD.tang[0]) - 7 * 3600_000; if (mo <= now) mo += 86_400_000;
  while (t < mo) t += buoc; return t;
}
/** GIỜ CHẠY của camp TẠO lúc `now` — cùng luật nhan-ban.lich_len (khung_doi.len, 07–12h VN): trong khung chạy ngay, ngoài khung hẹn 07:00 hôm sau / sáng nay.
 *  Chữ cho nút / ô "bấm rồi ra sao" (anh 05/11/2026: "Nếu bấm có lên ngay hay vẫn theo lịch?") */
export function chuLich(now = Date.now()): string {
  const [a, b] = KD.len, h = gioVnNay(now), g = `${String(a).padStart(2, '0')}:00`;
  return h >= a && h < b ? 'chạy ngay' : h < a ? `chạy ${g} sáng nay` : `chạy ${g} sáng mai`;
}
