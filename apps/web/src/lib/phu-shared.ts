// PHỦ — kiểu + hằng số + hàm thuần dùng CHUNG server/client. KHÔNG import @mos2/db ở đây:
// component client (phu-view) kéo tệp này, mà @mos2/db kéo postgres → webpack đòi `fs` (deploy đỏ 14/09/2026).

export type PhuPlatform = {
  id: number; slug: string; name: string; nhom: string; chuongTrinh: string | null; trangThai: string;
  hoaHong: string | null; linkMau: string | null; cuaRa: string | null; accountId: number | null;
  cardId: number | null; cardStatus: string | null; buocKe: string | null; ghiChu: string | null; updatedAt: string;
};
export type PhuNguon = {
  id: number; key: string; name: string; loai: string; trangThai: string; macroClick: string | null;
  macroChi: string | null; postbackToken: string | null; accountId: number | null; napUsd: number; soDu: number | null; soDuLuc: string | null; ghiChu: string | null;
};
export type PhuTieuChi = { chi_toi_da?: number; click_toi_thieu?: number; signup_1k?: number; gia_click_toi_da?: number; thu_chi?: number; hit_tren_click?: number };
export type PhuCamp = {
  id: number; nguonKey: string; ten: string; sidPrefix: string; lander: string | null; target: Record<string, unknown>;
  nganSachNgay: number | null; trangThai: string; batDau: string | null; ghiChu: string | null;
  ketThuc: string | null; nhipNgay: number; tieuChi: PhuTieuChi; keHoach: string | null;
  /** cộng dồn kể từ bat_dau (không theo cửa sổ N ngày) — phán xét dùng số này */
  tong: { view: number; gate: number; click: number; out: number; signup: number; revenue: number; chi: number; clickMang: number };
  /** kết quả BỘ LUẬT (be.adfond chấm, lib/phu.ts cấp số) — null = chưa chấm được (adfond không trả lời) → 'cho', không dừng gì */
  luat: PhuLuat | null;
};
export type PhuLuat = { ma: 'cho' | 'mo_rong' | 'dung' | 'di_tiep'; lyDo: string; khop: { ma: string; ten: string }[]; cham: { ma: string; ten: string; lam: string; ten_lam: string; muc?: number; gac: string; doc: string[] }[] };
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
 *  mo_rong  = đạt signup/1k click mục tiêu → mở bậc kế; HOẶC thu/chi ≥ thu_chi khi đã chi ≥ nửa $ thử
 *             (18/09/2026: camp PPS/revshare qua postback CR chỉ về `sale` = revenue, không có signup → phán bằng tiền)
 *  dung     = hết ngân sách thử hoặc quá hạn mà chưa đạt, HOẶC giá click ra offer vượt trần sau ≥100 click,
 *             HOẶC (P2 cấp camp, chỉ khi khai hit_tren_click) ≥300 click mạng mà hit /x/ của mình ÷ click mạng < ngưỡng — traffic mua không tới máy mình
 *             (16/09/2026: 363 click/$37 trên revshare = $0,10/click, trần kinh tế ~$0,03 — signup có về cũng không cứu
 *             được giá click, nên phán ngay bằng giá, không đợi đủ click)
 *  di_tiep  = trong ngưỡng, chưa tới hạn
 *  nghi     = camp không chạy */
export function phanXet(c: PhuCamp, today = new Date()): { ma: 'cho' | 'mo_rong' | 'dung' | 'di_tiep' | 'nghi'; lyDo: string; xemLai: string | null } {
  // Phán xét = kết quả BỘ LUẬT (tab Luật, be.adfond chấm) — không còn tiêu chí riêng ở đây (gộp 19/09/2026).
  // Máy chấm ở lib/phu.ts (cấp số + tham số camp) → adfond /api/ext/luat/cham → phanXu. Ở đây chỉ đọc + nhịp xem lại.
  let xemLai: string | null = null;
  if (c.batDau) {
    const bd = new Date(c.batDau); bd.setUTCHours(0, 0, 0, 0);
    const n = Math.max(1, c.nhipNgay || 1);
    const k = Math.floor((today.getTime() - bd.getTime()) / 86400_000 / n) + 1;
    xemLai = new Date(bd.getTime() + k * n * 86400_000).toISOString().slice(0, 10);
  }
  if (c.trangThai !== 'chay') return { ma: 'nghi', lyDo: c.trangThai, xemLai };
  if (!c.luat) return { ma: 'cho', lyDo: 'bộ luật chưa chấm được (be.adfond không trả lời) — không dừng gì', xemLai };
  return { ma: c.luat.ma, lyDo: c.luat.lyDo, xemLai };
}
export const PHU_PHAN_XET: Record<string, { label: string; color: string }> = {
  cho:     { label: 'chờ đủ số',  color: 'var(--fg-3)' },
  mo_rong: { label: 'MỞ RỘNG',    color: 'var(--ok)' },
  dung:    { label: 'DỪNG',       color: 'var(--danger)' },
  di_tiep: { label: 'đi tiếp',    color: 'var(--neon-cyan, #67e8f9)' },
  nghi:    { label: 'nghỉ',       color: 'var(--fg-3)' },
};
export type PhuNguonCamp = { nguon: string; view: number; gate: number; click: number; out: number; signup: number; revenue: number };

const cuHon = (iso: string | null, phut: number) => !iso || Date.now() - new Date(iso).getTime() > phut * 60_000;
/** Adapter/lander "đỏ": adapter lỗi hoặc cron >24h không chạy; lander chết hoặc lander ĐỘNG (có soMuc) >20 phút chưa sinh lại.
 *  Một luật cho cả thẻ số trang chủ lẫn dòng Cần chú ý — hai chỗ từng đếm hai kiểu (16/09/2026). */
export function phuDo(d: Pick<PhuData, 'adapters' | 'landers'>) {
  return d.adapters.filter((a) => a.lastOk === false || (a.loai === 'cron' && cuHon(a.lastRun, 24 * 60))).length
    + d.landers.filter((l) => l.trangThai !== 'song' || (l.soMuc != null && cuHon(l.lastSinh, 20))).length;
}

/** Số một zone gộp mọi ngày: click/imp/chi từ mạng + hit/bot ở cửa /x/ của mình. */
export type PhuZone = { sidPrefix: string; zoneId: string; site: string | null; impressions: number; clicks: number; chi: number; hits: number; bots: number; chan: { luat: string; lyDo: string; trangThai: string } | null };
/** Ngưỡng chấm zone — cùng tên mã với bộ luật camp (kệ pop, đơn vị nhóm = zone). Sửa số ở đây, một chỗ. */
export const NGUONG_ZONE = { K1_chi: 1, K1_click: 20, P2_click: 300, P2_ti_le: 0.7, P3_hit: 500, P3_bot: 0.3 };
/** Chấm một zone. Hàm thuần: trang, ingest và cron cùng gọi.
 *  K1 = chi ≥ $1 và ≥20 click mạng mà 0 hit tới máy mình (click giả hoặc đích chết) · P2 = ≥300 click mà hit/click < 70% (skill
 *  traffic-network-review, bộ đếm 2/1) · P3 = ≥500 hit+bot mà bot > 30% (UA/IP máy, nginx $ra_may_quet). Chưa đủ số = null. */
export function chamZone(z: Pick<PhuZone, 'impressions' | 'clicks' | 'chi' | 'hits' | 'bots'>, ng = NGUONG_ZONE): { luat: string; lyDo: string } | null {
  const tong = z.hits + z.bots;
  if (z.chi >= ng.K1_chi && z.clicks >= ng.K1_click && tong === 0) return { luat: 'K1', lyDo: `$${z.chi.toFixed(2)} · ${z.clicks} click mạng · 0 hit /x/` };
  if (z.clicks >= ng.P2_click && tong / z.clicks < ng.P2_ti_le) return { luat: 'P2', lyDo: `hit/click ${(tong / z.clicks * 100).toFixed(0)}% < ${ng.P2_ti_le * 100}% (${tong}/${z.clicks})` };
  if (tong >= ng.P3_hit && z.bots / tong > ng.P3_bot) return { luat: 'P3', lyDo: `bot ${(z.bots / tong * 100).toFixed(0)}% > ${ng.P3_bot * 100}% (${z.bots}/${tong})` };
  return null;
}
