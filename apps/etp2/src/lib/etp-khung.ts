// KHUNG MÁY TỰ ĐỔI CAMP (anh 04/11/2026) — đọc sổ luật chung etp-bang-luat.json.khung_doi, cùng chỗ worker apps/cty/worker/ethopex.mjs đọc.
// tang = mọi luật tự tăng (21–07h, qua nửa đêm) · giam = mọi luật tự giảm / tắt, không tăng (15–21h) · sang = chỉ nạp camp đã tiêu ≥ nap_chi × ngân sách + ROI hôm nay ≥ sang_roi% (07–15h)
// (anh 05/11/2026 đảo khung theo số toàn đội — xem _ghi trong sổ luật). bang = đóng băng (không còn giờ nào, giữ cho an toàn).
import BANG_LUAT from './etp-bang-luat.json';

export type KhungDoi = 'tang' | 'giam' | 'sang' | 'bang';
export type HuongLuat = 'tang' | 'giam' | 'tat';
export const KD = BANG_LUAT.khung_doi as unknown as { tang: [number, number]; giam: [number, number]; sang: [number, number]; sang_roi: number; nap_chi: number; len: [number, number]; nghi_gio: number; nghi_don_gio: number; khoa_sau_giam_gio: number; hoc_gio: number; don_13h: number; don_gio: number };
export const KHUNG_TEN: Record<KhungDoi, [string, string, string]> = {   // [biểu tượng, tên, màu]
  tang: ['⬆', 'Khung tăng', '#4ade80'], giam: ['🔧', 'Khung giảm · tắt', '#fb923c'], sang: ['☀', 'Nạp sáng', '#22c55e'], bang: ['🔒', 'Đóng băng', '#64748b'] };
/** giờ VN máy sẽ làm việc đang hoãn theo hướng luật */
export const gioLam = (huong: HuongLuat) => (huong === 'tang' ? KD.tang[0] : KD.giam[0]);

/** giờ VN hiện tại (số thực, 13.5 = 13:30) */
export const gioVnNay = (now = Date.now()) => { const d = new Date(now + 7 * 3600_000); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const trong = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h < b : h >= a || h < b);   // [21, 7] = qua nửa đêm
export const khungLuc = (h: number): KhungDoi => (trong(h, KD.giam) ? 'giam' : trong(h, KD.tang) ? 'tang' : KD.sang && trong(h, KD.sang) ? 'sang' : 'bang');   // cùng thứ tự với khungCua của worker (kiểm chéo ở etp-khung.test.mts)
// KHUNG TĂNG NHANH (anh 10/11/2026 — sổ luật chung khung_doi.nhanh, máy: nhip_tang.trong_nhanh): camp ROI hôm nay ≥ sang_roi% + tiêu ≥ nap_chi × ngân sách lên bậc ngay mỗi nhịp
export const NHANH = ((BANG_LUAT.khung_doi as unknown as { nhanh?: [number, number][] }).nhanh ?? []);
export const trongNhanh = (h: number) => NHANH.some((k) => trong(h, k));
// CỔNG TĂNG THEO GIỜ (anh 12/11/2026 — sổ luật khung_doi.sang_nap, máy: nhip_tang.cong): khung sáng 07–15h tăng khi đã tiêu 50–75% ngân sách + ROI hôm nay ≥ 0
// (tiêu ≥ 75% buổi sáng = tiêu dồn → không tăng); ngoài khung sáng: tiêu ≥ nap_chi + ROI ≥ sang_roi%. Kiểm chéo với worker congNap ở etp-khung.test.mts.
const SANG_NAP = (BANG_LUAT.khung_doi as unknown as { sang_nap: { chi: [number, number]; roi: number } }).sang_nap;
export const congTang = (h = gioVnNay()): { tu: number; den: number | null; roi: number } => (trong(h, KD.sang) ? { tu: SANG_NAP.chi[0], den: SANG_NAP.chi[1], roi: SANG_NAP.roi } : { tu: KD.nap_chi, den: null, roi: KD.sang_roi });
export const quaCong = (chi: number, thu: number, ns: number, h?: number) => { const c = congTang(h); return ns > 0 && chi > 0 && chi >= c.tu * ns && (c.den == null || chi < c.den * ns) && thu >= (1 + c.roi / 100) * chi; };
export const chuCong = (h?: number) => { const c = congTang(h), p = (x: number) => `${Math.round(x * 100)}%`; return `${c.den == null ? `đã tiêu ≥ ${p(c.tu)}` : `đã tiêu ${p(c.tu)}–${p(c.den)}`} ngân sách + ROI hôm nay ≥ ${c.roi}%`; };
export const NHANH_TEN: [string, string, string] = ['⚡', `Tăng nhanh ${NHANH.map(([a, b]) => `${a}–${b}h`).join(' · ')}: đạt cổng thì lên bậc kế ngay mỗi nhịp, không chờ 24 giờ — đêm ${chuCong(KD.tang[0] + 1)} · sáng ${chuCong(KD.sang[0] + 2)}`, '#facc15'];
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
// KHI NÀO MÁY THỰC SỰ TĂNG luật tăng đã đạt (anh 06/11/2026 "camp có thể tăng bậc thì ghi thêm bao lâu nữa sẽ thực sự tăng"): cổng nhịp tăng do máy luật tính (thẻ Tăng bậc · cho_toi) + lucTang (khung + nhịp máy)
/** máy luật chạy NHIP_PHUT phút / lần (apps/cty/worker/nhip.mjs kiem-ethopex) */
export const NHIP_PHUT = 30;
/** mốc máy thực sự tăng: nhịp máy luật (NHIP_PHUT phút, lần gần nhất = sổ hoãn `luc`) đầu tiên ≥ `som` (cổng nhịp tăng — cho_toi của thẻ máy) rơi vào khung tăng — hoặc khung sáng khi tiêu dồn (nạp sáng).
 *  null khi sổ cũ (máy không chạy) */
/** 'tao' = nhân bản: worker tạo bản ngay nhịp kế mọi khung, giờ chạy của bản mới theo chuLich (khung lên). MỌI HƯỚNG LUẬT (anh 10/11/2026 "các luật khác thấy chạm đéo hiện à"): nhịp máy luật đầu tiên ≥ som rơi vào khung cho hướng đó — tăng: khung tăng (khung sáng khi tiêu dồn) · giảm / tắt: khung giảm */
export function lucLam(huong: HuongLuat | 'tao', luc: string | null, cu: boolean, now = Date.now(), som = 0, don = false): number | null {
  if (!luc || cu) return null;
  const buoc = NHIP_PHUT * 60_000; let t = Date.parse(luc) + buoc; while (t < now) t += buoc;
  for (let i = 0; i < 4 * 48; i++, t += buoc) { const k = khungLuc(gioVnNay(t)); if (t >= som && (huong === 'tao' || (huong === 'tang' ? k === 'tang' || (k === 'sang' && don) : k === 'giam'))) return t; }
  return null;
}
/** GIỜ CHẠY của camp TẠO lúc `now` — cùng luật nhan-ban.lich_len (khung_doi.len, 07–12h VN): trong khung chạy ngay, ngoài khung hẹn 07:00 hôm sau / sáng nay.
 *  Chữ cho nút / ô "bấm rồi ra sao" (anh 05/11/2026: "Nếu bấm có lên ngay hay vẫn theo lịch?") */
export function chuLich(now = Date.now()): string {
  const [a, b] = KD.len, h = gioVnNay(now), g = `${String(a).padStart(2, '0')}:00`;
  return h >= a && h < b ? 'chạy ngay' : h < a ? `chạy ${g} sáng nay` : `chạy ${g} sáng mai`;
}
