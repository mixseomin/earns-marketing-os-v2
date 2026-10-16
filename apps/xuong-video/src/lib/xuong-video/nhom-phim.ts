// Bố cục danh sách phim (13/10/2026 — anh: "bố cục lại theo series, theo film, các tập… có bộ lọc"): NHÓM (series / SẢN PHẨM / tên) → PHIM
// (từng bản: bút chì, sáp màu, 3D…) → TẬP. Phim QC gom theo SẢN PHẨM (15/10/2026 — anh: "gom các creative cho cùng 1 sp"): mọi video + ảnh QC
// của một sản phẩm về một nhóm, dù tên phim đặt kiểu gì ("Mẫu QC · Jett…", "Jett · Trước/Sau…"). Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhom-phim.test.mts
import type { Phim } from './kieu';

export type KieuNhom = 'template' | 'series' | 'quang_cao' | 'phim' | 'may_dung';
export const TEN_KIEU: Record<KieuNhom, string> = { template: 'Template', series: 'Series', quang_cao: 'Quảng cáo', phim: 'Phim ngắn', may_dung: 'Máy Dựng' };
export type NhomPhim = { key: string; ten: string; kieu: KieuNhom; phim: Phim[]; chi_phi_cents: number };

/** Ảnh đại diện của phim trên danh sách (anh 15/10/2026: "chưa sinh poster thì dùng ảnh gần nhất"): poster → keyframe mới nhất → ảnh QC đầu. */
export const anhDaiDien = (p: Pick<Phim, 'poster_url' | 'anh_dai_dien' | 'anh_qc_tom'>): string | null => p.poster_url || p.anh_dai_dien || p.anh_qc_tom?.[0]?.url || null;
/** Bản lưu trữ: đánh dấu ở kinh thánh (luu_tru) — ẩn mặc định, không xoá. */
export const laLuuTru = (p: Pick<Phim, 'kinh_thanh'>): boolean => !!p.kinh_thanh?.luu_tru;
/** Tên nhóm: series → tên series; còn lại → phần trước " · " của tên phim (thương hiệu: "Astrolas", "Mẫu QC"), không có thì cả tên. */
export function tenNhomPhim(p: Pick<Phim, 'ten' | 'kinh_thanh'>): string {
  const s = p.kinh_thanh?.series;
  if (s?.dong_co?.trim()) return s.ten?.trim() || p.ten.replace(/^series\s*·\s*/i, '').replace(/\s*[(—].*$/, '').trim() || p.ten;
  const i = p.ten.indexOf(' · ');
  return (i > 0 ? p.ten.slice(0, i) : p.ten).trim();
}
/** Sản phẩm của phim QC (kinh_thanh.qc): khoá = link trang bán (host + đường dẫn, bỏ www / query / dấu / cuối), không có link thì tên sản phẩm. */
export function sanPhamPhim(p: Pick<Phim, 'loai' | 'kinh_thanh'>): { key: string; ten: string } | null {
  if (p.loai !== 'quang_cao' || p.kinh_thanh?.template) return null;
  const ten = (p.kinh_thanh?.qc?.ten ?? '').trim(); const link = (p.kinh_thanh?.qc?.link ?? '').trim();
  let key = '';
  if (link) { try { const u = new URL(link); key = `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase(); } catch { key = link.toLowerCase(); } }
  if (!key && ten) key = ten.toLowerCase();
  return key ? { key, ten: ten || key } : null;
}
export const kieuPhim = (p: Pick<Phim, 'loai' | 'kinh_thanh'>): KieuNhom => (p.kinh_thanh?.template ? 'template' : p.kinh_thanh?.series?.dong_co?.trim() ? 'series' : p.loai === 'quang_cao' ? 'quang_cao' : p.loai === 'may_dung' ? 'may_dung' : 'phim');

/** Lọc + gom: `ds` theo thứ tự mới sửa trước; nhóm xếp theo phim mới nhất của nó. */
export function nhomPhim(ds: Phim[], loc: { kieu?: KieuNhom | ''; tim?: string; luuTru?: boolean }): NhomPhim[] {
  const tim = (loc.tim ?? '').trim().toLowerCase();
  const out = new Map<string, NhomPhim>();
  for (const p of ds) {
    if (!loc.luuTru && laLuuTru(p)) continue;
    const kieu = kieuPhim(p); if (loc.kieu ? kieu !== loc.kieu : kieu === 'template') continue;   // template có kho riêng ở đầu trang — "Tất cả" không lẫn template
    const sp = kieu === 'quang_cao' ? sanPhamPhim(p) : null;
    const ten = sp?.ten ?? tenNhomPhim(p);
    if (tim && ![p.ten, ten, sp?.key ?? '', ...(p.tap_tom ?? []).map((t) => t.ten)].some((x) => x.toLowerCase().includes(tim))) continue;
    const key = sp ? `sp:${sp.key}` : `${kieu}:${ten.toLowerCase()}`;
    const g = out.get(key) ?? { key, ten, kieu, phim: [], chi_phi_cents: 0 };
    g.phim.push(p); g.chi_phi_cents += p.chi_phi_cents; out.set(key, g);
  }
  return [...out.values()];
}
/** Đếm theo kiểu (cho nhãn bộ lọc) — tính trên bản không lưu trữ trừ khi luuTru. */
export const demKieu = (ds: Phim[], luuTru = false): Record<KieuNhom, number> => {
  const d: Record<KieuNhom, number> = { template: 0, series: 0, quang_cao: 0, phim: 0, may_dung: 0 };
  for (const p of ds) if (luuTru || !laLuuTru(p)) d[kieuPhim(p)]++;
  return d;
};
