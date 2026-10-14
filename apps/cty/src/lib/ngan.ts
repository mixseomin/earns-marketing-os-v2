// CHỒNG NGĂN KÉO của cty.on.tc theo chuẩn skill ngan-keo (8 luật). Phần thuần, dùng cả máy chủ lẫn trình duyệt:
// khoá ngăn `loại:mã`, đọc khoá từ một link nội bộ, đọc/ghi chồng trong URL (`?ngan=nhan-su:tam&ngan=phong:sach`, đúng thứ tự).
// Tự kiểm: `node scripts/thu-ngan.mjs`.
export const LOAI_NGAN = ['nhan-su', 'phong', 'nhat-ky', 'luat', 'muc-tieu', 'quy-trinh', 'sach', 'the', 'video', 'day-chuyen', 'nhip'] as const;
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
  const sp = u.pathname.match(/^\/(sach|video)\/([^/]+)\/([^/]+)\/?$/);
  if (sp) return `${sp[1]}:${decodeURIComponent(sp[2]!)}/${decodeURIComponent(sp[3]!)}`;
  const dch = u.pathname.match(/^\/day-chuyen\/([^/]+)\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (dch) return `day-chuyen:${[dch[1], dch[2], dch[3]].filter(Boolean).map((x) => decodeURIComponent(x!)).join('/')}`;
  const nh = u.pathname.match(/^\/nhip\/([^/]+)\/([^/]+)\/?$/);
  if (nh) return `nhip:${decodeURIComponent(nh[1]!)}/${decodeURIComponent(nh[2]!)}`;
  const t = u.pathname.match(/^\/the\/(\d+)\/?$/);
  if (t) return `the:${t[1]}`;
  return null;
}
// Sản phẩm / card MOS2 mở NGĂN trong cty (anh 12/10/2026: "sao bấm lại mở sang mos2 — tập trung link out vào drawer"):
// màn chỉ trỏ vào hai link này; link ra MOS2 / sàn chỉ nằm trong ngăn.
/** Ngăn một tựa sách: mã = phòng/id dòng sổ (id nào của tựa cũng được — ngăn tô đậm đúng dòng đó). */
export const hrefSach = (phong: string, id: string | number) => `/sach/${phong}/${id}`;
/** Ngăn một video ngắn: mã = phòng/slug (worker/video.mjs). */
export const hrefVideo = (phong: string, slug: string) => `/video/${phong}/${encodeURIComponent(slug)}`;
/** Ngăn một dây chuyền của phòng (cả bảng), hoặc một phần đã lọc (`loc`: lich · tram-1…6 · len-san · ban · kho · hom · do) — ô sơ đồ trỏ vào đây. */
export const hrefDayChuyen = (phong: string, dc: string, loc?: string) => `/day-chuyen/${phong}/${dc}${loc ? `/${loc}` : ''}`;
/** Ngăn một đầu việc tự làm của nhân sự (worker/nhip.mjs VIEC_NHIP): mô tả + nhật ký từng lần chạy. */
export const hrefNhip = (nguoi: string, ma: string) => `/nhip/${nguoi}/${ma}`;
/** Ngăn một card plays (human_tasks.id). */
export const hrefThe = (id: string | number) => `/the/${id}`;

/** Giá trị `ngan` trong URL → chồng (bỏ khoá lạ, bỏ trùng giữ lần xuất hiện đầu). */
export function docChong(v: string | string[] | null | undefined): string[] {
  const ds = (Array.isArray(v) ? v : v ? [v] : []).filter(hopLe);
  return ds.filter((k, i) => ds.indexOf(k) === i);
}

// BỀ RỘNG NGĂN anh tự kéo (anh 12/10/2026: "drawer phải cho resize"): MỘT bề rộng gốc (tầng 0) cho mọi ngăn, nhớ theo trình duyệt;
// tầng i vẫn hẹp hơn tầng dưới NK_HUT px → kéo xong chồng ngăn vẫn lộ mép để bấm quay về.
export const NK_HUT = 64, NK_MIN = 360, NK_KHOA = 'cty.ngan.rong';
/** Bề rộng gốc mới khi kéo mép trái của tầng `tang` tới x (màn rộng `man`; `lech` = khoảng con trỏ cách mép lúc bấm, để ngăn không giật).
 *  Kẹp: tầng đang kéo không hẹp hơn NK_MIN, gốc không quá 98% màn (màn hẹp hơn cả sàn thì theo màn). */
export function rongKeo(man: number, x: number, lech: number, tang: number): number {
  const goc = man - x - lech + tang * NK_HUT;
  return Math.round(Math.min(man * 0.98, Math.max(NK_MIN + tang * NK_HUT, goc)));
}
/** Bề rộng đã nhớ hợp lệ? (chữ hỏng / số lạ → bỏ, về mặc định) */
export const rongHopLe = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= NK_MIN && n <= 10_000 ? n : null; };

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
