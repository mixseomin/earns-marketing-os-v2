// TIẾNG NỀN THU THẬT cho mẫu cảnh động (26/10/2026 — anh: "có mỗi cái ảnh kèm tiếng ồn", bản đầu sinh nhiễu bằng anoisesrc nghe như rè): kho mau/am-nen.json
// (Mixkit, giấy phép dùng thương mại, không cần ghi nguồn). THUẦN: chọn bản theo băm slug để dựng lại ra cùng tiếng; tải tệp do bên dựng (may-dung.ts) lo.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/am-nen.test.mts
import kho from '../../../mau/am-nen.json';

export type LoaiAm = 'mua' | 'song' | 'gio' | 'rung' | 'dem' | 'pho' | 'lua' | 'im';
const KHO = kho.am as Record<Exclude<LoaiAm, 'im'>, { id: number; ten: string }[]>;
export const LOAI_AM = Object.keys(KHO) as Exclude<LoaiAm, 'im'>[];
export const urlAm = (id: number) => kho.url.replace(/\{id\}/g, String(id));
const bam = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Loại tiếng theo từ khoá cảnh (đề không khai `am`). */
export function amTheoTruy(truy: string): LoaiAm {
  const t = truy.toLowerCase();
  if (/rain|storm|drizzle|monsoon|wet/.test(t)) return 'mua';
  if (/wave|sea|ocean|beach|shore|island|coast|harbo/.test(t)) return 'song';
  if (/fire|campfire|fireplace|candle|bonfire/.test(t)) return 'lua';
  if (/night|evening|dusk|stars/.test(t)) return 'dem';
  if (/street|city|market|station|airport|cafe|traffic|train|downtown|urban/.test(t)) return 'pho';
  if (/forest|bird|garden|park|jungle|tree|meadow|river|lake/.test(t)) return 'rung';
  if (/wind|mountain|field|desert|snow|cliff|hill/.test(t)) return 'gio';
  return 'rung';
}
/** Bản thu cho một video: cùng loại, băm slug chọn bản → dựng lại không đổi tiếng; 'im' = không tiếng (null). */
export function chonAm(loai: LoaiAm, slug: string): { id: number; ten: string; url: string } | null {
  if (loai === 'im') return null;
  const ds = KHO[loai] ?? KHO.rung; const b = ds[bam(slug) % ds.length]!;
  return { ...b, url: urlAm(b.id) };
}
