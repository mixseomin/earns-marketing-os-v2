// GÓC BÁN TỪ SPY (15/10/2026 — anh: "mỗi video QC dùng góc nào, chân dung… từ spy thì show ra, có link mở sang đúng góc đó bên spy").
// Mỗi phim QC mang danh sách góc spy.on.tc nó khai thác (cột xv_phim.goc_spy, migration 0259). Spy chạy cùng box (127.0.0.1:3850), studio
// đọc thẳng API của nó (actions.ts › dsSpSpy / dsGocSpy) — không chép dữ liệu, chỉ giữ id + tên + loại để hiện chip và dựng link.
// MỘT phim = MỘT nhóm sản phẩm spy (anh 15/10/2026: "phải dùng góc của sản phẩm này chứ không phải quần jean thông thường" — lần đầu
// trộn góc nhóm #311 jeans thường vào video của quần co giãn #325). luuGocSpy chặn trộn; panel gợi ý nhóm đã gắn cho cùng sản phẩm.
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/goc-spy.test.mts

export type GocSpy = { id: number; sp: number; loai: string; ten: string; mo_ta?: string };

/** Loại góc của spy (goc.loai) — thứ tự hiện: ai mua → vì sao đau → muốn gì → lúc nào → ngại gì. */
export const LOAI_GOC_SPY: { key: string; ten: string; ic: string }[] = [
  { key: 'ai_chan_dung', ten: 'Chân dung', ic: '👤' },
  { key: 'ai_noi_dau', ten: 'Nỗi đau', ic: '😣' },
  { key: 'ai_mong_muon', ten: 'Mong muốn', ic: '✨' },
  { key: 'ai_tinh_huong', ten: 'Tình huống', ic: '📍' },
  { key: 'ai_phan_doi', ten: 'Phản đối', ic: '🤔' },
];
export const loaiGocSpy = (k: string) => LOAI_GOC_SPY.find((x) => x.key === k) ?? { key: k, ten: k.replace(/^ai_/, ''), ic: '🎯' };

const GOC = 'https://spy.on.tc';
/** Link mở ĐÚNG góc trên spy: màn nhóm sản phẩm + ngăn bằng chứng của góc (spy web/app.js › nganGoc, khoá ngăn `goc:<id>`). */
export const linkGocSpy = (g: Pick<GocSpy, 'id' | 'sp'>): string => `${GOC}/#/goc?sp=${g.sp}&ngan=goc:${g.id}`;
export const linkSpSpy = (sp: number): string => `${GOC}/#/goc?sp=${sp}`;

/** Xếp theo loại (thứ tự LOAI_GOC_SPY, loại lạ cuối), giữ thứ tự khai trong cùng loại; bỏ trùng id. */
export function xepGocSpy(ds: GocSpy[]): GocSpy[] {
  const thu = (k: string) => { const i = LOAI_GOC_SPY.findIndex((x) => x.key === k); return i < 0 ? 99 : i; };
  const thay = new Set<number>();
  return ds.filter((g) => !thay.has(g.id) && thay.add(g.id)).map((g, i) => ({ g, i })).sort((a, b) => thu(a.g.loai) - thu(b.g.loai) || a.i - b.i).map((x) => x.g);
}
/** Đọc an toàn từ jsonb (bỏ phần tử hỏng). */
export function docGocSpy(v: unknown): GocSpy[] {
  if (!Array.isArray(v)) return [];
  return xepGocSpy(v.filter((x): x is GocSpy => !!x && typeof x === 'object' && Number.isFinite(Number((x as GocSpy).id)) && Number.isFinite(Number((x as GocSpy).sp)) && typeof (x as GocSpy).ten === 'string')
    .map((x) => ({ id: Number(x.id), sp: Number(x.sp), loai: String(x.loai ?? ''), ten: x.ten, ...(x.mo_ta ? { mo_ta: String(x.mo_ta) } : {}) })));
}

/** Các nhóm spy trong danh sách — hợp lệ khi ≤ 1 nhóm. */
export const nhomCuaGoc = (ds: Pick<GocSpy, 'sp'>[]): number[] => [...new Set(ds.map((g) => g.sp))];
