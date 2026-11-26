import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { gioLen } from '@/lib/etp-khung';
// SỔ MỨC NHÂN BẢN ★ ROAS dùng chung cho bảng điều khiển camp (client) và server action (etp-tay.ts / etp-cho-duyet.ts) — một chỗ khai, hai đầu đọc.
// Mức cùng nhan-ban.py ROAS_MIN / ROAS_MAX (0.9–1.4) · ngân sách bài cũ $5–20 (Dol 22/11/2026: camp mới $5, lãi thì nuôi dần lên).
export const ROAS_KHOANG = [0.9, 1.4] as const, NS_ROAS_KHOANG = [5, 20] as const;
/** chip bid trên bảng (anh 22/11/2026 "thêm các option khác của roas") */
export const ROAS_MUC = [0.9, 1, 1.1, 1.2, 1.3, 1.4] as const;
/** nhiều mức một lần bấm, bài cũ: cặp 0.9 + 1.1 (Dol 22/11/2026 "2 camp lên mà lãi luôn → duplicate thêm 2 camp, bid 0.9, 1.1") · bộ ba thêm mức 1 */
export const ROAS_CAP = [0.9, 1.1] as const, ROAS_BA = [0.9, 1, 1.1] as const;
export const NS_ROAS_CHIP = [5, 10, 15, 20] as const;
/** ngân sách bản KHÔNG BID / SANG BỘ KHÁC anh chỉnh (anh 22/11/2026 "Ngân sách cho điều chỉnh") — cùng nhan-ban.py --ns $1–20 */
export const NS_TAY_KHOANG = [1, 20] as const, NS_TAY_CHIP = [1, 2, 3, 5, 10] as const;

/** "YYYY-MM-DD HH:MM" giờ VN (nhận cả dạng datetime-local "…T…") hoặc null */
export const gioVn = (g: string | null | undefined) => { const t = (g ?? '').trim().replace('T', ' ').slice(0, 16); return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t) ? t : null; };
/** "YYYY-MM-DDTHH:MM" giờ VN lúc này, làm tròn lên phút kế — giá trị sẵn của mọi ô đặt giờ, không để trống (anh 22/11/2026 #1762) */
export const bayGioVn = () => new Date(Math.ceil((Date.now() + 7 * 3600_000) / 60_000) * 60_000).toISOString().slice(0, 16);
export const daQua =(g: string) => Date.parse(`${g.replace(' ', 'T')}:00+07:00`) < Date.now() - 60_000;
export const chuGio = (g: string | null, tuDo = false) => g ? `hẹn ${g.slice(11)} ${g.slice(8, 10)}/${g.slice(5, 7)} giờ VN (${tuDo ? 'đúng giờ anh đặt — ngoài 2 khung chính 07:00 / 22:00' : 'dời lên khung 22h / 07h gần nhất từ giờ đó'})` : chayLuc();   // không còn 'chạy ngay' (anh 24/11/2026)
/** giá trị `gio` của nút "⏱ Lên theo lịch" (anh 23/11/2026 #1772 "Cần option lên theo lịch"): KHÔNG vé trực tiếp, KHÔNG --gio → nhan-ban lich_len / gio_roas quyết giờ */
export const THEO_LICH = 'lich';
/** LÚC CAMP NHÂN BẢN THỰC SỰ CHẠY — cùng luật nhan-ban.gio_len: khung cố định 22h / 07h VN gần nhất, cả camp thường lẫn ★ ROAS (anh 24/11/2026 "Cấm tự lên ngay !!") */
const p2 = (n: number) => String(n).padStart(2, '0');
/** "hẹn chạy 22:00 26/11 giờ VN" — phần GỌN hiện thẳng cạnh nút "theo lịch" (anh 26/11/2026 #1880 "show giờ thực sự chạy ở đây") */
export function chayLucGon(now = Date.now()): string {
  const vn = new Date(gioLen(now) + 7 * 36e5);
  return `hẹn chạy ${p2(vn.getUTCHours())}:00 ${p2(vn.getUTCDate())}/${p2(vn.getUTCMonth() + 1)} giờ VN`;
}
/** "khung lên 07h / 22h" — chữ phụ, gập vào chữ rê */
export const khungLen = () => `khung lên ${(BANG_LUAT.khung_doi as unknown as { len_gio: number[] }).len_gio.map((h) => `${p2(h)}h`).join(' / ')}`;
export function chayLuc(now = Date.now(), _roas = false): string {
  return `${chayLucGon(now)} (${khungLen()})`;
}
