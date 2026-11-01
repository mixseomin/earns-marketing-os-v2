// LƯỚI WIDGET tab Tổng quan 2 etp — đọc SỔ WIDGET etp-widget.json; kiểm bố cục (client khi kéo thả + máy chủ khi lưu) và xếp lại ô khi kéo.
import SO from './etp-widget.json';

export type O = { ma: string; x: number; y: number; w: number; h: number };
export type WidgetSo = { ten: string; mo_ta: string; min: [number, number]; mac: [number, number] };
export const COT = SO.cot, HANG = SO.hang;
export const WIDGET = SO.widget as unknown as Record<string, WidgetSo>;
export const TEMPLATE = SO.template as Record<string, { ten: string; muc: string; o: O[] }>;
export const TEN_DANG = '__dang', TEN_TEAM = '__team';

export const chongNhau = (a: O, b: O) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** ô thò ra ngoài màn (y + h > HANG) — vẽ đỏ, không lưu */
export const traMan = (o: O) => o.y + o.h > HANG;

/** bố cục hợp lệ: widget có trong sổ, không trùng, số nguyên trong lưới, không nhỏ hơn min, không chồng nhau, không vượt màn */
export function hopLe(v: unknown): O[] | null {
  if (!Array.isArray(v) || v.length > 40) return null;
  const ra: O[] = [];
  for (const x of v) {
    const o = x as O, w = WIDGET[o?.ma];
    if (!w || ra.some((r) => r.ma === o.ma)) return null;
    if (![o.x, o.y, o.w, o.h].every((n) => Number.isInteger(n) && n >= 0)) return null;
    if (o.w < w.min[0] || o.h < w.min[1] || o.x + o.w > COT || traMan(o)) return null;
    if (ra.some((r) => chongNhau(r, o))) return null;
    ra.push({ ma: o.ma, x: o.x, y: o.y, w: o.w, h: o.h });
  }
  return ra;
}

/** đặt ô `dong` đúng chỗ mới, mọi ô khác dồn lên trên hết mức có thể mà không chồng (trọng lực lên trên, giữ thứ tự trên → dưới) */
export function xep(ds: O[], dong: O): O[] {
  const da: O[] = [{ ...dong, x: Math.max(0, Math.min(COT - dong.w, dong.x)), y: Math.max(0, dong.y) }];
  for (const o of ds.filter((o) => o.ma !== dong.ma).sort((a, b) => a.y - b.y || a.x - b.x)) {
    let y = 0; while (da.some((d) => chongNhau(d, { ...o, y }))) y++;
    da.push({ ...o, y });
  }
  return ds.map((o) => da.find((d) => d.ma === o.ma)!).concat(ds.some((o) => o.ma === dong.ma) ? [] : [da[0]!]);
}

/** thêm widget vào chỗ trống đầu tiên: thử cỡ mặc định rồi cỡ nhỏ nhất; không còn chỗ trong màn → null */
export function them(ds: O[], ma: string): O[] | null {
  const w = WIDGET[ma]; if (!w || ds.some((o) => o.ma === ma)) return null;
  for (const [cw, ch] of [w.mac, w.min]) for (let y = 0; y + ch <= HANG; y++) for (let x = 0; x + cw <= COT; x++) {
    const o = { ma, x, y, w: cw, h: ch };
    if (!ds.some((d) => chongNhau(d, o))) return [...ds, o];
  }
  return null;
}
