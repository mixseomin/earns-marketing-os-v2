// CHỒNG NGĂN KÉO của cty.on.tc theo chuẩn skill ngan-keo (8 luật). Phần thuần, dùng cả máy chủ lẫn trình duyệt:
// khoá ngăn `loại:mã`, đọc khoá từ một link nội bộ, đọc/ghi chồng trong URL (`?ngan=nhan-su:tam&ngan=phong:sach`, đúng thứ tự).
// Tự kiểm: `node scripts/thu-ngan.mjs`.
export const LOAI_NGAN = ['nhan-su', 'phong', 'nhat-ky', 'luat', 'muc-tieu', 'quy-trinh'] as const;
export type LoaiNgan = (typeof LOAI_NGAN)[number];

export function tachKhoa(k: string): { loai: string; ma: string } {
  const i = k.indexOf(':');
  return i < 0 ? { loai: k, ma: '' } : { loai: k.slice(0, i), ma: k.slice(i + 1) };
}
const hopLe = (k: string) => (LOAI_NGAN as readonly string[]).includes(tachKhoa(k).loai);

/** Link nội bộ → khoá ngăn; null = không phải thực thể (để điều hướng bình thường). Nhật ký giữ cả bộ lọc trong mã. */
export function khoaTuHref(href: string | null | undefined): string | null {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null;
  let u: URL; try { u = new URL(href, 'http://cty'); } catch { return null; }
  const m = u.pathname.match(/^\/(nhan-su|phong)\/([^/]+)\/?$/);
  if (m) return `${m[1]}:${decodeURIComponent(m[2]!)}`;
  if (u.pathname === '/nhat-ky') return `nhat-ky:${u.search.slice(1)}`;
  if (u.pathname === '/luat' || u.pathname === '/muc-tieu' || u.pathname === '/quy-trinh') return `${u.pathname.slice(1)}:`;
  const q = u.pathname.match(/^\/quy-trinh\/([^/]+\/[^/]+)\/?$/);
  if (q) return `quy-trinh:${decodeURIComponent(q[1]!)}`;
  return null;
}

/** Giá trị `ngan` trong URL → chồng (bỏ khoá lạ, bỏ trùng giữ lần xuất hiện đầu). */
export function docChong(v: string | string[] | null | undefined): string[] {
  const ds = (Array.isArray(v) ? v : v ? [v] : []).filter(hopLe);
  return ds.filter((k, i) => ds.indexOf(k) === i);
}

/** Mở khoá: đã có trong chồng → kéo lên trên cùng (luật 3), chưa có → chồng thêm. `thay` = vị trí tầng bị thay (lọc trong ngăn). */
export function moKhoa(chong: string[], khoa: string, thay?: number): string[] {
  const bo = chong.filter((k) => k !== khoa);
  if (thay != null && thay >= 0 && thay < chong.length) { const c = [...chong]; c[thay] = khoa; return docChong(c); }
  return [...bo, khoa];
}

/** URL hiện tại với chồng mới; giữ nguyên đường dẫn + tham số khác của màn. */
export function urlVoiChong(pathname: string, search: string, chong: string[]): string {
  const p = new URLSearchParams(search); p.delete('ngan');
  for (const k of chong) p.append('ngan', k);
  const s = p.toString();
  return `${pathname}${s ? `?${s}` : ''}`;
}
