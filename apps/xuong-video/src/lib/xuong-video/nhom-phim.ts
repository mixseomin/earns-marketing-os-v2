// Bố cục danh sách phim (13/10/2026 — anh: "bố cục lại theo series, theo film, các tập… có bộ lọc"): NHÓM (series / thương hiệu) → PHIM
// (từng bản: bút chì, sáp màu, 3D…) → TẬP. Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhom-phim.test.mts
import type { Phim } from './kieu';

export type KieuNhom = 'template' | 'series' | 'quang_cao' | 'phim';
export const TEN_KIEU: Record<KieuNhom, string> = { template: 'Template', series: 'Series', quang_cao: 'Quảng cáo', phim: 'Phim ngắn' };
export type NhomPhim = { key: string; ten: string; kieu: KieuNhom; phim: Phim[]; chi_phi_cents: number };

/** Bản lưu trữ: đánh dấu ở kinh thánh (luu_tru) — ẩn mặc định, không xoá. */
export const laLuuTru = (p: Pick<Phim, 'kinh_thanh'>): boolean => !!p.kinh_thanh?.luu_tru;
/** Tên nhóm: series → tên series; còn lại → phần trước " · " của tên phim (thương hiệu: "Astrolas", "Mẫu QC"), không có thì cả tên. */
export function tenNhomPhim(p: Pick<Phim, 'ten' | 'kinh_thanh'>): string {
  const s = p.kinh_thanh?.series;
  if (s?.dong_co?.trim()) return s.ten?.trim() || p.ten.replace(/^series\s*·\s*/i, '').replace(/\s*[(—].*$/, '').trim() || p.ten;
  const i = p.ten.indexOf(' · ');
  return (i > 0 ? p.ten.slice(0, i) : p.ten).trim();
}
export const kieuPhim = (p: Pick<Phim, 'loai' | 'kinh_thanh'>): KieuNhom => (p.kinh_thanh?.template ? 'template' : p.kinh_thanh?.series?.dong_co?.trim() ? 'series' : p.loai === 'quang_cao' ? 'quang_cao' : 'phim');

/** Lọc + gom: `ds` theo thứ tự mới sửa trước; nhóm xếp theo phim mới nhất của nó. */
export function nhomPhim(ds: Phim[], loc: { kieu?: KieuNhom | ''; tim?: string; luuTru?: boolean }): NhomPhim[] {
  const tim = (loc.tim ?? '').trim().toLowerCase();
  const out = new Map<string, NhomPhim>();
  for (const p of ds) {
    if (!loc.luuTru && laLuuTru(p)) continue;
    const kieu = kieuPhim(p); if (loc.kieu && kieu !== loc.kieu) continue;
    const ten = tenNhomPhim(p);
    if (tim && ![p.ten, ten, ...(p.tap_tom ?? []).map((t) => t.ten)].some((x) => x.toLowerCase().includes(tim))) continue;
    const key = `${kieu}:${ten.toLowerCase()}`;
    const g = out.get(key) ?? { key, ten, kieu, phim: [], chi_phi_cents: 0 };
    g.phim.push(p); g.chi_phi_cents += p.chi_phi_cents; out.set(key, g);
  }
  return [...out.values()];
}
/** Đếm theo kiểu (cho nhãn bộ lọc) — tính trên bản không lưu trữ trừ khi luuTru. */
export const demKieu = (ds: Phim[], luuTru = false): Record<KieuNhom, number> => {
  const d: Record<KieuNhom, number> = { template: 0, series: 0, quang_cao: 0, phim: 0 };
  for (const p of ds) if (luuTru || !laLuuTru(p)) d[kieuPhim(p)]++;
  return d;
};
