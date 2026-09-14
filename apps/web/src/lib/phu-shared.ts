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
export type PhuCamp = {
  id: number; nguonKey: string; ten: string; sidPrefix: string; lander: string | null; target: Record<string, unknown>;
  nganSachNgay: number | null; trangThai: string; batDau: string | null; ghiChu: string | null;
};
export type PhuPheu = {
  sidPrefix: string; click: number; out: number; signup: number; lead: number; spendCount: number; revenue: number; chi: number;
};
export type PhuAdapter = { key: string; name: string; loai: string; lich: string | null; lastRun: string | null; lastOk: boolean | null; lastNote: string | null };
export type PhuLander = { host: string; path: string; ten: string; moTa: string | null; dich: string | null; lastSinh: string | null; soMuc: number | null; trangThai: string };

export type PhuData = {
  platforms: PhuPlatform[]; nguon: PhuNguon[]; camp: PhuCamp[]; pheu: PhuPheu[]; adapters: PhuAdapter[]; landers: PhuLander[];
  days: number; tong: { click: number; out: number; signup: number; revenue: number; chi: number };
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
