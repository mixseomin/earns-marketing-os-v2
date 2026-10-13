// ẢNH NHỎ (13/10/2026 — "sao ảnh load chậm thế"): keyframe/ảnh gốc trên R2 là JPEG ~1 MB (1080×1920), mà timeline, thẻ shot, thẻ nhân vật
// hiện chúng ở 22–300px — mở một phim là tải hàng chục MB. Mọi chỗ hiện ảnh nhỏ gọi anhNho(url, bề rộng) → /api/xv/nho thu nhỏ một lần
// (ffmpeg), lưu R2, rồi chuyển hướng tới bản nhỏ (trình duyệt nhớ 1 năm). Ảnh không thuộc kho studio thì trả nguyên url.
// Thuần (client + server). Tự kiểm: anh-nho.test.mts
export const CO_NHO = [160, 320, 640] as const;
export type CoNho = (typeof CO_NHO)[number];
const KHO = /^https:\/\/img\.on\.tc\/xuong-video\/(?!nho\/).+\.(jpe?g|png|webp)$/i;
const DUONG = '/api/xv/nho';

/** Ảnh của kho studio thu nhỏ còn `rong` px bề ngang (chọn nấc ≥ cỡ hiện × 2 cho màn retina). url khác → giữ nguyên. */
export function anhNho<T extends string | null | undefined>(url: T, rong: CoNho = 320): T {
  if (!url || !KHO.test(url)) return url;
  return `${DUONG}?w=${rong}&u=${encodeURIComponent(url)}` as T;
}
/** url ảnh gốc của một ảnh nhỏ (ngược anhNho); url thường thì giữ nguyên. */
export function anhGoc(src: string): string {
  const i = src.indexOf(`${DUONG}?`);
  if (i < 0) return src;
  return new URLSearchParams(src.slice(i + DUONG.length + 1)).get('u') || src;
}
/** Nấc gần nhất cho bề rộng hiển thị (×2 cho retina). */
export const nacNho = (pxHien: number): CoNho => CO_NHO.find((w) => w >= pxHien * 2) ?? 640;
