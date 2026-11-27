// KẾ CAMP CỦA MỘT CREATIVE (anh 25/11/2026 "Ở phần xem duyệt, khi bấm vào phải mở drawer của camp đó để xem chi tiết… nhất là các thông tin về ngôn ngữ, targeting,... form text"):
// creative chờ duyệt / đã duyệt chưa camp chưa có camp thật → dựng camp DỰ KIẾN cho docThietLap (etp-thiet-lap.ts KeTl) đúng như lệnh ▶ Lên sẽ gửi
// (lenhNb trong actions/etp-cho-duyet.ts → nhan-ban.py <khuôn theo tiếng> --roas --ns --bo --creative --content --ten): MỘT chỗ khai khuôn + tên + ô bị đè,
// nên ô vàng chờ duyệt, ngăn camp và lệnh lên camp không lệch nhau. Tệp thường (không 'use server') để cả máy chủ lẫn trình duyệt gọi được.
import type { KeTl } from '@/lib/actions/etp-thiet-lap';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { gioLen } from '@/lib/etp-khung';

/** camp khuôn theo tiếng creative — cùng sổ apps/etp/lenh_cho.py KHUON_CR / nhan-ban.py KHUON_ES */
export const KHUON_CR: Record<string, number> = { en: 65110, es: 65734 };
export const tiengCr = (lang: string | null | undefined) => (lang === 'es' ? 'es' : 'en');
/** tên camp ▶ Lên đặt (spawn không qua shell — chỉ chữ ASCII) */
export const tenCampCr = (phim: string | null | undefined, lang: string | null | undefined, cr: number) =>
  `duyet ${(phim ?? '').replace(/[^A-Za-z0-9 .,:!?#-]/g, '')} ${tiengCr(lang).toUpperCase()} - cr moi #${cr}`;
/** DÀN MỨC ★ ROAS (anh 26/11/2026 "Sửa từ gốc để đa dạng level ROAS"): mức = etp.muc_roas(phim, MUC_DAN, DAN_NGAY) (migration 0481) — mức sổ hoi_cho.muc có ít camp
 *  ★ ROAS nhất của phim trong DAN_NGAY ngày; cùng hàm cong.muc_roas bên Python. Truy vấn nhúng: etp.muc_roas(<content_id>, ${MUC_DAN_SQL}::numeric[], ${DAN_NGAY}) */
export const MUC_DAN: number[] = BANG_LUAT.hoi_cho.muc;
export const MUC_DAN_SQL = `{${MUC_DAN.join(',')}}`;
export const DAN_NGAY: number = BANG_LUAT.hoi_cho.dan_ngay;
export const CHU_DAN = `dàn ${MUC_DAN.join('/')}`;
/** mức ★ ROAS sẽ lên: view etp.ke_cr ('roas|ns' — khối / sổ len_cr_roas) hoặc null = dàn mức theo phim (nhan-ban chọn lúc tạo) */
export function mucCr(roas: string | null | undefined): { roas: number | null; ns: number } {
  const [r, n] = (roas ?? '').split('|');
  return r && n ? { roas: Number(r), ns: Math.trunc(Number(n)) } : { roas: null, ns: Math.trunc(Number(BANG_LUAT.hoi_cho.ns)) };
}
const p2 = (n: number) => String(n).padStart(2, '0');
/** khung lên gần nhất (gioLen — hai khung cố định), chữ giờ VN + còn bao lâu (anh #1843 25/11/2026 "Bỏ (khung giờ gần nhất), thay bằng : còn bao lâu") */
export function chuKhungLen(now = Date.now()): string {
  const t = gioLen(now), d = new Date(t + 7 * 3_600_000), p = Math.max(0, Math.round((t - now) / 60_000));
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} VN · còn ${Math.floor(p / 60)} giờ ${p2(p % 60)} phút`;
}

/** camp dự kiến của creative: id = -cr (dòng docThietLap ra camp_id -cr-1, ke_cha -cr) */
/** x.khuon = khuôn của khối (etp.ke_cr — Kiên 109046 / 109047) · x.mien = etp.cau_hinh mien_len (nhan-ban gắn miền này vào ad, anh 25/11/2026 marcusbeilby.com) */
export function keCr(x: { cr: number; cid: number; lang: string | null; phim: string | null; roas?: string | null; bo: string | null; khuon?: number | null; mien?: string | null }): KeTl {
  const m = mucCr(x.roas);
  return { id: -Math.trunc(x.cr), khuon: x.khuon ? Math.trunc(Number(x.khuon)) : KHUON_CR[tiengCr(x.lang)]!, so: 1, cid: Math.trunc(x.cid), bo: x.bo, de: {
    ...(x.mien ? { a_mien: x.mien } : {}),
    c_ten: tenCampCr(x.phim, x.lang, x.cr),
    // nhan-ban --roas: bid_strategy campaign LOWEST_COST_WITH_MIN_ROAS + daily_budget campaign, Ad Set tối ưu VALUE + roas_average_floor
    c_gia: 'LOWEST_COST_WITH_MIN_ROAS', c_ns: String(m.ns), c_che_do: 'Campaign budget', g_roas: m.roas == null ? `${CHU_DAN} (mức ít camp nhất của phim)` : String(m.roas), g_toi_uu: 'VALUE',
    // nhan-ban bo_ngon_ngu bỏ targeting.locales của MỌI camp (luật cố định anh 24/11/2026) — khuôn EN mang [6], ES [1002] nhưng camp tạo ra không nhắm ngôn ngữ
    g_ngon_ngu: null,
    g_lich: chuKhungLen(), f_cr: String(Math.trunc(x.cr)),
  } };
}
