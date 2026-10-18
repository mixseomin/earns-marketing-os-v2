// Thanh lọc TỰ ĐỘNG trên mọi DataTable (anh 18/10/2026, góp ý #1416: "mọi table hãy thêm bộ lọc ở phía trên — bộ lọc, search và group by,
// multiple nếu được, tự động và là dạng refactor cho mọi thành phần"). Không bảng nào phải khai gì: đọc `sortValue` của cột.
//   - cột DANH MỤC (lọc chọn nhiều + gom nhóm được): có sortValue, giá trị là chữ, 2–40 giá trị khác nhau và có lặp lại
//     (cột tên / ngày giờ / mã — mỗi dòng một giá trị — không phải danh mục; cột số đo không phải danh mục).
//   - ô tìm: bảng không khai `searchText` thì tìm trên sortValue của mọi cột.
// Thuần, có test (loc-tu-dong.test.mts).

export type CotLoc = { key: string; header?: unknown; title?: string; sortValue?: (row: never) => string | number | null | undefined };
export type GiaTriDanhMuc = { v: string; n: number };
export type CotDanhMuc = { key: string; nhan: string; giaTri: GiaTriDanhMuc[] };

export const TRAN_DANH_MUC = 40;
const RONG = '(trống)';

/** Tên cột dạng chữ cho thanh lọc — tiêu đề là ReactNode thì lấy title, không có thì key. */
export function nhanCot(c: CotLoc): string {
  return typeof c.header === 'string' || typeof c.header === 'number' ? String(c.header) : c.title || c.key;
}

const giaTri = (x: string | number | null | undefined) => (x == null || x === '' ? RONG : String(x));

export function cotDanhMuc<T>(rows: T[], columns: CotLoc[]): CotDanhMuc[] {
  if (rows.length < 3) return [];
  const out: CotDanhMuc[] = [];
  for (const c of columns) {
    const sv = c.sortValue as ((r: T) => string | number | null | undefined) | undefined;
    if (!sv) continue;
    const dem = new Map<string, number>();
    let so = 0, co = 0;
    for (const r of rows) {
      const x = sv(r);
      if (x != null && x !== '') co++;
      if (typeof x === 'number') so++;
      const k = giaTri(x);
      dem.set(k, (dem.get(k) ?? 0) + 1);
      if (dem.size > TRAN_DANH_MUC) break;
    }
    if (so > co / 2) continue;                                // cột số đo (đếm trên ô CÓ giá trị — cột số nhiều ô trống vẫn là số đo)
    if (dem.size < 2 || dem.size > TRAN_DANH_MUC) continue;
    if (dem.size > rows.length * 0.6) continue;               // gần như mỗi dòng một giá trị
    out.push({ key: c.key, nhan: nhanCot(c), giaTri: [...dem].map(([v, n]) => ({ v, n })).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v)) });
  }
  return out;
}

/** Chuỗi tìm của một dòng khi bảng không khai searchText. */
export function chuoiTim<T>(row: T, columns: CotLoc[]): string {
  return columns.map((c) => (c.sortValue as ((r: T) => unknown) | undefined)?.(row)).filter((x) => x != null && x !== '').join(' ');
}

/** Gom dòng (đã lọc + sắp) theo giá trị của một cột — giữ thứ tự xuất hiện đầu tiên. */
export function gomNhom<T>(rows: T[], col: CotLoc | undefined): { v: string; rows: T[] }[] {
  const sv = col?.sortValue as ((r: T) => string | number | null | undefined) | undefined;
  if (!sv) return [{ v: '', rows }];
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = giaTri(sv(r)); const a = m.get(k); if (a) a.push(r); else m.set(k, [r]); }
  return [...m].map(([v, rs]) => ({ v, rows: rs }));
}

/** Lọc chọn nhiều → bộ lọc cột chuẩn (đi chung đường lưu cookie / URL / server với 🔍 trên tiêu đề). '(trống)' = IS NULL. */
export function locChon(ds: string[]): { op: string; val: string } | null {
  if (!ds.length) return null;
  if (ds.length === 1 && ds[0] === RONG) return { op: 'IS NULL', val: '' };
  return { op: 'IN LIST', val: JSON.stringify(ds) };
}
export function docChon(f: { op: string; val: string } | undefined): string[] {
  if (!f) return [];
  if (f.op === 'IS NULL') return [RONG];
  if (f.op !== 'IN LIST') return [];
  try { const a = JSON.parse(f.val) as unknown[]; return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
