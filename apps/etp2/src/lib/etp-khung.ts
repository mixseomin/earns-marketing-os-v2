// KHUNG MÁY TỰ ĐỔI CAMP (anh 04/11/2026) — đọc sổ luật chung etp-bang-luat.json.khung_doi, cùng chỗ worker apps/cty/worker/ethopex.mjs đọc.
// tang = mọi luật tự tăng (21–07h, qua nửa đêm) · giam = mọi luật tự giảm / tắt, không tăng (15–21h) · sang = chỉ nạp camp đã tiêu 50–75% ngân sách + ROI hôm nay ≥ 0 (07–15h, sang_nap)
// (anh 05/11/2026 đảo khung theo số toàn đội — xem _ghi trong sổ luật). bang = đóng băng (không còn giờ nào, giữ cho an toàn).
import BANG_LUAT from './etp-bang-luat.json';

export type KhungDoi = 'tang' | 'giam' | 'sang' | 'bang';
export type HuongLuat = 'tang' | 'giam' | 'tat';
export const KD = BANG_LUAT.khung_doi as unknown as { tang: [number, number]; giam: [number, number]; sang: [number, number]; len: [number, number]; nghi_gio: number; nghi_don_gio: number; khoa_sau_giam_gio: number; hoc_gio: number; don_13h: number; don_gio: number };
/** THANG PHIÊN (anh 22/11/2026): tăng trong phiên khung (21–15h VN), nghỉ nghi_phut giữa hai lần tăng, tín hiệu mạnh thêm một bậc sau manh.nghi_phut — cùng số nhip_tang.py */
export const TP = BANG_LUAT.thang_phien as unknown as { khung: [number, number]; nghi_phut: number; moi: { chi: number; roi: number }; manh: { chi: number; roi: number; lai: number; nghi_phut: number }; lui: { chi: number; roi: number; khoa_gio: number } };
export const trongPhien = (h: number) => (TP.khung[0] <= TP.khung[1] ? h >= TP.khung[0] && h < TP.khung[1] : h >= TP.khung[0] || h < TP.khung[1]);
export const CHU_NHIP = `thang phiên ${TP.khung[0]}–${TP.khung[1]}h: mỗi lần lên bậc kế (≤ ×1,5), nghỉ ${TP.nghi_phut} phút, lần tăng trước phải chi ≥ ${TP.moi.chi * 100}% ngân sách mới + ROI ≥ ${TP.moi.roi}% · tín hiệu mạnh (chi ≥ ${TP.manh.chi * 100}%, ROI ≥ ${TP.manh.roi}%, lãi ≥ $${TP.manh.lai}) thêm một bậc sau ${TP.manh.nghi_phut} phút · tăng xong mà chi ≥ ${TP.lui.chi * 100}% ngân sách mới với ROI < ${TP.lui.roi}% → lùi một bậc, khoá ${TP.lui.khoa_gio} giờ`;
export const KHUNG_TEN: Record<KhungDoi, [string, string, string]> = {   // [biểu tượng, tên, màu]
  tang: ['⬆', 'Khung tăng', '#4ade80'], giam: ['🔧', 'Khung giảm · tắt', '#fb923c'], sang: ['☀', 'Nạp sáng', '#22c55e'], bang: ['🔒', 'Đóng băng', '#64748b'] };
/** giờ VN máy sẽ làm việc đang hoãn theo hướng luật */
export const gioLam = (huong: HuongLuat) => (huong === 'tang' ? KD.tang[0] : KD.giam[0]);

/** giờ VN hiện tại (số thực, 13.5 = 13:30) */
export const gioVnNay = (now = Date.now()) => { const d = new Date(now + 7 * 3600_000); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const trong = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h < b : h >= a || h < b);   // [21, 7] = qua nửa đêm
export const khungLuc = (h: number): KhungDoi => (trong(h, KD.giam) ? 'giam' : trong(h, KD.tang) ? 'tang' : KD.sang && trong(h, KD.sang) ? 'sang' : 'bang');   // cùng thứ tự với khungCua của worker (kiểm chéo ở etp-khung.test.mts)
// KHUNG TĂNG NHANH (anh 10/11/2026 — sổ luật chung khung_doi.nhanh, máy: nhip_tang.trong_nhanh): camp đạt cổng tăng theo giờ (congTang) lên bậc ngay mỗi nhịp
export const NHANH = ((BANG_LUAT.khung_doi as unknown as { nhanh?: [number, number][] }).nhanh ?? []);
export const trongNhanh = (h: number) => NHANH.some((k) => trong(h, k));
// CỔNG TĂNG THEO GIỜ (anh 12/11/2026 — sổ luật khung_doi.sang_nap, máy: nhip_tang.cong): khung sáng 07–15h tăng khi đã tiêu 50–75% ngân sách + ROI hôm nay ≥ 0
// (tiêu ≥ 75% buổi sáng = tiêu dồn → không tăng); ngoài khung sáng: luật 12/11 tang_ngay — tiêu ≥ 50% + ROI ≥ 50%, tiêu 30–50% + ROI ≥ 100%
// (anh 19/11/2026 chọn 50% luật 12/11, bỏ cổng ROI ≥ 100% sau 15:00). Kiểm chéo với worker congNap ở etp-khung.test.mts.
const SANG_NAP = (BANG_LUAT.khung_doi as unknown as { sang_nap: { chi: [number, number]; roi: number } }).sang_nap;
const TN = BANG_LUAT.tang_ngay as { chi: number; roi: number; duoi: number; roi_duoi: number };
const tnRoi = (chi: number, ns: number) => (ns > 0 && chi < TN.duoi * ns ? TN.roi_duoi : TN.roi);
export const congTang = (h = gioVnNay(), chi?: number, ns?: number): { tu: number; den: number | null; roi: number } => (trong(h, KD.sang) ? { tu: SANG_NAP.chi[0], den: SANG_NAP.chi[1], roi: SANG_NAP.roi } : { tu: TN.chi, den: null, roi: chi != null && ns ? tnRoi(chi, ns) : TN.roi });
export const quaCong = (chi: number, thu: number, ns: number, h?: number) => { const c = congTang(h, chi, ns); return ns > 0 && chi > 0 && chi >= c.tu * ns && (c.den == null || chi < c.den * ns) && thu >= (1 + c.roi / 100) * chi; };
export const chuCong = (h?: number) => { const c = congTang(h), p = (x: number) => `${Math.round(x * 100)}%`; return `${c.den == null ? `đã tiêu ≥ ${p(c.tu)}` : `đã tiêu ${p(c.tu)}–${p(c.den)}`} ngân sách + ROI hôm nay ≥ ${c.roi}%${c.den == null ? ` (tiêu < ${p(TN.duoi)} thì ≥ ${TN.roi_duoi}%)` : ''}`; };
export const NHANH_TEN: [string, string, string] = ['⚡', `Tăng nhanh ${NHANH.map(([a, b]) => `${a}–${b}h`).join(' · ')}: đạt cổng thì lên bậc kế ngay mỗi nhịp, không chờ 24 giờ — ${chuCong(KD.tang[0] + 1)} (luật 12/11 tang_ngay; khung sáng không còn tăng nhanh — anh 19/11/2026)`, '#facc15'];
// tiêu kịch trần (bộ lọc trang) = qua ngưỡng chi của cổng tăng ngoài khung sáng — cùng số tang_ngay máy dùng, không giữ số riêng (nap_chi đã bỏ 19/11/2026)
export const TRAN_CHI = TN.duoi, TANG_CHI = TN.chi;
// THỨ TỰ ƯU TIÊN luật tăng (sổ uu_tien, anh 19/11/2026 xung đột 1): luật đứng trước thắng — luatThang trả luật đang chặn đầu tiên của một camp
export const UU_TIEN = (BANG_LUAT as unknown as { uu_tien: string[] }).uu_tien;
export const UU_TIEN_TEN: Record<string, string> = { phim_cam: 'Phim cấm', dung_khan_bao_tri: 'Dừng khẩn / bảo trì', phanh_cho: 'Phanh chợ', khung_gio: 'Khung giờ', nap_roi3: 'Nắp ROI 3 ngày', cong_tang_ngay: 'Cổng tăng trong ngày', nhan_ban_tran_test: 'Nhân bản / trần test' };
export const luatThang = (chan: Partial<Record<string, boolean>>): string | null => { const k = UU_TIEN.find((x) => chan[x]); return k ? UU_TIEN_TEN[k] ?? k : null; };
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
/** GIỜ LÊN CAMP = HAI KHUNG CỐ ĐỊNH (anh 24/11/2026 "Tất cả đều phải lên theo 1 trong 2 khung giờ cố định như vậy. Cái nào gần nhất thì lên vào khung đó. Cấm tự lên ngay !!"):
 *  cùng luật nhan-ban.gio_len (sổ khung_doi.len_gio 07h + 22h VN, len_gio_cach_phut) — trả mốc ms của khung gần nhất, không sớm hơn now + cách phút và không sớm hơn `tu` (ms). */
export function gioLen(now = Date.now(), tu?: number | null): number {
  const k = BANG_LUAT.khung_doi as unknown as { len_gio: number[]; len_gio_cach_phut?: number };
  const som = Math.max(now + (k.len_gio_cach_phut ?? 10) * 60_000, tu ?? 0), ds = [...k.len_gio].sort((a, b) => a - b);
  const ngay0 = Math.floor((som + 7 * 3600_000) / 864e5) * 864e5 - 7 * 3600_000;   // 00:00 VN của ngày `som`
  for (let n = 0; n < 3; n++) for (const h of ds) { const t = ngay0 + n * 864e5 + h * 3600_000; if (t >= som) return t; }
  throw new Error('khung_doi.len_gio rỗng');
}
/** chữ giờ chạy của camp TẠO lúc `now` — khung gần nhất (gioLen), không bao giờ "chạy ngay". Chữ cho nút / ô "bấm rồi ra sao" (anh 05/11/2026) */
export function chuLich(now = Date.now()): string {
  const t = gioLen(now), vn = new Date(t + 7 * 3600_000), nay = new Date(now + 7 * 3600_000), p = (n: number) => String(n).padStart(2, '0');
  const ngay = vn.getUTCDate() === nay.getUTCDate() ? (vn.getUTCHours() < 12 ? 'sáng nay' : 'tối nay') : vn.getUTCHours() < 12 ? 'sáng mai' : 'tối mai';
  return `chạy ${p(vn.getUTCHours())}:00 ${ngay}`;
}
