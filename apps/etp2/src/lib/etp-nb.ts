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
export const chuGio = (g: string | null) => g ? `hẹn ${g.slice(11)} ${g.slice(8, 10)}/${g.slice(5, 7)} giờ VN` : 'chạy ngay';
