// TEMPLATE (14/10/2026 — anh: "template chính là các thành phần như đang làm trong studio, sau đó thay prompt, context, cuối cùng ghép lại";
// "template phải cho phép edit"). Template = một PHIM thường (kinh_thanh.template), sửa bằng toàn bộ studio; chỗ nào cần đổi theo sản phẩm /
// góc / chân dung thì gõ ô {{ten_o}}. Tạo phim từ template = chép phim + điền ô (template-db.ts). Thuần — tự kiểm:
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/template.test.mts
import type { CauHinhTemplate, OTemplate } from './kieu';

const RE_O = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Mọi ô {{x}} xuất hiện trong một giá trị bất kỳ (chuỗi / mảng / object lồng nhau), theo thứ tự gặp đầu tiên, không trùng. */
export function timO(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') { for (const m of x.matchAll(RE_O)) { const k = m[1]!.toLowerCase(); if (!out.includes(k)) out.push(k); } }
  else if (Array.isArray(x)) for (const v of x) timO(v, out);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) timO(v, out);
  return out;
}

const coGiaTri = (gt: Record<string, string>, k: string) => typeof gt[k] === 'string' && gt[k]!.trim() !== '';

/** Điền ô trong một chuỗi; ô chưa có giá trị giữ nguyên {{x}} (thấy ngay chỗ còn thiếu). */
export const dienChu = (s: string, gt: Record<string, string>): string => s.replace(RE_O, (all, k: string) => (coGiaTri(gt, k.toLowerCase()) ? gt[k.toLowerCase()]!.trim() : all));

/** Điền sâu. Trong MẢNG, phần tử đúng bằng một ô ("{{anh_san_pham}}") nở thành nhiều phần tử theo từng dòng của giá trị — dùng cho danh sách ảnh. */
export function dienSau<T>(x: T, gt: Record<string, string>): T {
  if (typeof x === 'string') return dienChu(x, gt) as T;
  if (Array.isArray(x)) {
    const out: unknown[] = [];
    for (const v of x) {
      const m = typeof v === 'string' ? /^\s*\{\{\s*([a-z0-9_]+)\s*\}\}\s*$/i.exec(v) : null;
      if (m && coGiaTri(gt, m[1]!.toLowerCase())) out.push(...gt[m[1]!.toLowerCase()]!.split('\n').map((d) => d.trim()).filter(Boolean));
      else out.push(dienSau(v, gt));
    }
    return out as T;
  }
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, dienSau(v, gt)])) as T;
  return x;
}

export type OTemplateDs = OTemplate & { k: string; /** ô có xuất hiện trong chữ của template không (khai mà không dùng = thừa) */ dung: boolean };

/** Danh sách ô để hiện form: ô đã khai (theo thứ tự khai) trước, ô gõ trong chữ mà chưa khai sau (nhãn = tên ô). */
export function dsOTemplate(cfg: CauHinhTemplate | null | undefined, timThay: string[]): OTemplateDs[] {
  const khai = cfg?.o ?? {};
  const ds: OTemplateDs[] = Object.entries(khai).map(([k, o]) => ({ ...o, k, ten: o.ten || k, dung: timThay.includes(k) }));
  for (const k of timThay) if (!khai[k]) ds.push({ k, ten: k.replace(/_/g, ' '), dung: true });
  return ds;
}

/** Ô đang dùng mà chưa có giá trị → chặn tạo phim (phim mới không được còn {{x}}). */
export const oThieu = (ds: OTemplateDs[], gt: Record<string, string>): OTemplateDs[] => ds.filter((o) => o.dung && !coGiaTri(gt, o.k));

/** Giá trị ban đầu của form = giá trị mẫu của từng ô (template tự điền được ngay để thử). */
export const giaTriMau = (ds: OTemplateDs[]): Record<string, string> => Object.fromEntries(ds.filter((o) => o.mau).map((o) => [o.k, o.mau!]));
