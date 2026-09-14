// PHỦ — kiểu + hằng số + hàm thuần dùng CHUNG server/client. KHÔNG import @mos2/db ở đây:
// component client (phu-view) kéo tệp này, mà @mos2/db kéo postgres → webpack đòi `fs` (deploy đỏ 14/09/2026).

export type PhuPlatform = {
  id: number; slug: string; name: string; nhom: string; chuongTrinh: string | null; trangThai: string;
  hoaHong: string | null; linkMau: string | null; cuaRa: string | null; accountId: number | null;
  cardId: number | null; cardStatus: string | null; buocKe: string | null; ghiChu: string | null; updatedAt: string;
};
export type PhuNguon = {
  id: number; key: string; name: string; loai: string; trangThai: string; macroClick: string | null;
  macroChi: string | null; postbackToken: string | null; accountId: number | null; napUsd: number; ghiChu: string | null;
};
export type PhuTieuChi = { chi_toi_da?: number; click_toi_thieu?: number; signup_1k?: number };
export type PhuCamp = {
  id: number; nguonKey: string; ten: string; sidPrefix: string; lander: string | null; target: Record<string, unknown>;
  nganSachNgay: number | null; trangThai: string; batDau: string | null; ghiChu: string | null;
  ketThuc: string | null; nhipNgay: number; tieuChi: PhuTieuChi; keHoach: string | null;
  /** cộng dồn kể từ bat_dau (không theo cửa sổ N ngày) — phán xét dùng số này */
  tong: { view: number; gate: number; click: number; out: number; signup: number; revenue: number; chi: number };
};
export type PhuPheu = {
  sidPrefix: string; soPrefix: number; view: number; gate: number; click: number; out: number; signup: number; lead: number; spendCount: number; revenue: number; chi: number;
};
export type PhuAdapter = { key: string; name: string; loai: string; lich: string | null; lastRun: string | null; lastOk: boolean | null; lastNote: string | null; postbackToken: string | null };
export type PhuLander = { host: string; path: string; ten: string; moTa: string | null; dich: string | null; lastSinh: string | null; soMuc: number | null; trangThai: string };

export type PhuData = {
  platforms: PhuPlatform[]; nguon: PhuNguon[]; camp: PhuCamp[]; pheu: PhuPheu[]; adapters: PhuAdapter[]; landers: PhuLander[];
  days: number; tong: { view: number; gate: number; click: number; out: number; signup: number; revenue: number; chi: number };
  loi: string | null;
};

export const PHU_TRANG_THAI: Record<string, { label: string; color: string }> = {
  khong_co:   { label: 'không có aff', color: 'var(--fg-3)' },
  chua:       { label: 'chưa đăng ký', color: 'var(--warn)' },
  da_dang_ky: { label: 'đã đăng ký',   color: 'var(--neon-cyan, #67e8f9)' },
  cho_duyet:  { label: 'chờ duyệt',    color: 'var(--neon-violet, #a78bfa)' },
  duyet:      { label: 'đã duyệt',     color: 'var(--neon-lime, #a3e635)' },
  da_cam:     { label: 'đã cắm',       color: 'var(--ok)' },
  bo:         { label: 'bỏ',           color: 'var(--fg-3)' },
};
export const PHU_NGUON_TRANG_THAI: Record<string, { label: string; color: string }> = {
  du_kien:  { label: 'dự kiến',    color: 'var(--fg-3)' },
  dang_mo:  { label: 'đang mở tk', color: 'var(--warn)' },
  hoat_dong:{ label: 'hoạt động',  color: 'var(--ok)' },
  tam_dung: { label: 'tạm dừng',   color: 'var(--warn)' },
  bo:       { label: 'bỏ',         color: 'var(--fg-3)' },
};

/** sid_prefix = hai mẩu đầu của sid (`exo_c1_zone77_abc` → `exo_c1`). Một chỗ tính, adapter và postback cùng gọi. */
export function sidPrefix(sid: string | null | undefined): string {
  const x = String(sid ?? '').trim();
  if (!x) return '';
  return x.split('_').slice(0, 2).join('_');
}

/** Phán xét một camp từ tiêu chí + số cộng dồn. Một chỗ tính, trang và cron cùng gọi.
 *  cho      = chưa đủ click để kết luận, còn tiền + còn hạn
 *  mo_rong  = đạt signup/1k click mục tiêu → mở bậc kế
 *  dung     = hết ngân sách thử hoặc quá hạn mà chưa đạt
 *  di_tiep  = trong ngưỡng, chưa tới hạn
 *  nghi     = camp không chạy */
export function phanXet(c: PhuCamp, today = new Date()): { ma: 'cho' | 'mo_rong' | 'dung' | 'di_tiep' | 'nghi'; lyDo: string; xemLai: string | null } {
  const t = c.tieuChi || {};
  const chiMax = Number(t.chi_toi_da) || 0, clickMin = Number(t.click_toi_thieu) || 0, muc = Number(t.signup_1k) || 0;
  const { click, signup, chi } = c.tong;
  const per1k = click ? (signup / click) * 1000 : 0;
  const hom = today.toISOString().slice(0, 10);
  const quaHan = !!c.ketThuc && hom > c.ketThuc.slice(0, 10);
  const hetTien = chiMax > 0 && chi >= chiMax;
  // nhịp xem lại: mốc kế tiếp tính từ bat_dau, mỗi nhip_ngay
  let xemLai: string | null = null;
  if (c.batDau) {
    const bd = new Date(c.batDau); bd.setUTCHours(0, 0, 0, 0);
    const n = Math.max(1, c.nhipNgay || 1);
    const k = Math.floor((today.getTime() - bd.getTime()) / 86400_000 / n) + 1;
    xemLai = new Date(bd.getTime() + k * n * 86400_000).toISOString().slice(0, 10);
  }
  if (c.trangThai !== 'chay') return { ma: 'nghi', lyDo: c.trangThai, xemLai };
  if (muc > 0 && per1k >= muc && click >= Math.max(200, clickMin / 4)) return { ma: 'mo_rong', lyDo: `${per1k.toFixed(1)} signup/1k ≥ mục tiêu ${muc} (${signup}/${click} click)`, xemLai };
  if (hetTien || quaHan) return { ma: 'dung', lyDo: `${hetTien ? `hết $${chiMax} thử` : `quá hạn ${c.ketThuc?.slice(0, 10)}`} · ${signup} signup / ${click} click` + (muc ? ` (< ${muc}/1k)` : ''), xemLai };
  if (clickMin > 0 && click < clickMin) return { ma: 'cho', lyDo: `${click}/${clickMin} click · $${chi.toFixed(2)}${chiMax ? `/$${chiMax}` : ''}`, xemLai };
  return { ma: 'di_tiep', lyDo: `${per1k.toFixed(1)} signup/1k · $${chi.toFixed(2)}${chiMax ? `/$${chiMax}` : ''}` + (c.ketThuc ? ` · tới ${c.ketThuc.slice(0, 10)}` : ''), xemLai };
}
export const PHU_PHAN_XET: Record<string, { label: string; color: string }> = {
  cho:     { label: 'chờ đủ số',  color: 'var(--fg-3)' },
  mo_rong: { label: 'MỞ RỘNG',    color: 'var(--ok)' },
  dung:    { label: 'DỪNG',       color: 'var(--danger)' },
  di_tiep: { label: 'đi tiếp',    color: 'var(--neon-cyan, #67e8f9)' },
  nghi:    { label: 'nghỉ',       color: 'var(--fg-3)' },
};
export type PhuNguonCamp = { nguon: string; view: number; gate: number; click: number; out: number; signup: number; revenue: number };
