// ÂM HIỆU cho phim KHÔNG LỜI (Tango & Lint, 14/10/2026) — thuần: khớp dòng thoại với bộ âm hiệu của nhân vật, câu mô tả cho máy hiệu ứng
// âm thanh, độ dài âm. Máy chủ (sinh-giong.ts › amHieuShots) dùng. Tự kiểm: am-hieu.test.mts
import type { NhanVat } from './kieu';

/** Độ dài âm hiệu theo số chữ âm ("Hup!" ngắn, "Pff-pff-pff!" dài hơn): 0,8–3 giây. */
export const giayAmHieu = (loi: string) => Math.min(3, Math.max(0.8, Math.round((0.5 + loi.length * 0.06) * 10) / 10));
/** Câu mô tả cho máy hiệu ứng: giọng cố định của nhân vật (ô "Giọng") + diễn xuất + chính âm phải kêu — không có chữ thật. */
export const moTaAmHieu = (v: Pick<NhanVat, 'ten' | 'giong'> | null, d: { loi: string; dien_xuat?: string }): string =>
  `${v?.giong?.trim() || `a tiny cartoon creature (${v?.ten ?? 'character'})`} makes a short non-verbal vocal sound "${d.loi.replace(/\[[^\]]*\]\s*/g, '').trim()}"${d.dien_xuat?.trim() ? ` while ${d.dien_xuat.trim()}` : ''}. Cartoon vocalization only — no real words, no music.`;
/** Âm hiệu của bộ có sẵn khớp dòng: tên âm chứa đúng chuỗi âm của dòng (vd dòng "Hup!" ↔ "Đặc trưng · Hup!"). */
export const amHieuKhop = (v: Pick<NhanVat, 'am_hieu'> | null, loi: string) => {
  const t = loi.replace(/\[[^\]]*\]\s*/g, '').trim().toLowerCase();
  return t ? (v?.am_hieu ?? []).find((a) => a.ten.toLowerCase().endsWith(t) || a.ten.toLowerCase().includes(`· ${t}`)) ?? null : null;
};
