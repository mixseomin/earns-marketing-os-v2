// Phép đo THUẦN của máy soi clip (soi-clip.ts gọi ffmpeg / tesseract rồi đưa số vào đây). Tự kiểm: soi-clip-do.test.mts.
// Hai lỗi đã gặp (16/10/2026, #54 JettJeans): Grok tự in phụ đề giả ("Look at that fit!") dù prompt cấm; máy đẩy vào ngực, quần ra khỏi khung từ giây 4.

/** RGB 0–255 → [hue 0–360, sat 0–1, val 0–1]. */
export function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx === 0 ? 0 : d / mx, mx / 255];
}
const coMau = (s: number, v: number) => s >= 0.25 && v >= 0.15;
const DA = [10, 50];   // dải màu da người — ảnh sản phẩm có người mặc thì da hay chiếm nhiều nhất

/** Màu chủ đạo của sản phẩm từ ảnh gốc (rgb24 phẳng): hue giữa của ô 10° đông nhất trong các điểm có màu. null = sản phẩm không có màu nổi
 *  (đen / trắng / xám, < 5% điểm có màu) → không đo được bằng màu. Ô đông nhất là màu da mà có ô khác ≥ 40% nó thì lấy ô kia. */
export function mauSanPham(anh: Uint8Array[]): number | null {
  const o = new Array<number>(36).fill(0); let tong = 0, mau = 0;
  for (const px of anh) for (let i = 0; i + 2 < px.length; i += 3) {
    tong++; const [h, s, v] = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
    if (coMau(s, v)) { mau++; o[Math.floor(h / 10) % 36]!++; }
  }
  if (!tong || mau / tong < 0.05) return null;
  const xep = o.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n);
  const laDa = (i: number) => i * 10 + 5 >= DA[0]! && i * 10 + 5 <= DA[1]!;
  const chon = laDa(xep[0]!.i) ? (xep.find((x) => !laDa(x.i) && x.n >= xep[0]!.n * 0.4) ?? xep[0]!) : xep[0]!;
  return chon.i * 10 + 5;
}
/** Tỉ lệ điểm ảnh mang màu sản phẩm (±15°). */
export function tiLeMau(px: Uint8Array, hue: number): number {
  let n = 0, tong = 0;
  for (let i = 0; i + 2 < px.length; i += 3) {
    tong++; const [h, s, v] = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
    const lech = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
    if (coMau(s, v) && lech <= 15) n++;
  }
  return tong ? n / tong : 0;
}
/** Sản phẩm mất khỏi khung: khung k còn < 35% lượng màu của khung đầu. Trả giây đầu tiên mất, hoặc null. Khung đầu < 2% = không đo được. */
export function giayMatSanPham(tiLe: number[], giay: number[]): number | null | 'khong_do' {
  const dau = tiLe[0] ?? 0;
  if (dau < 0.02) return 'khong_do';
  const i = tiLe.findIndex((x, k) => k > 0 && x < dau * 0.35);
  return i < 0 ? null : giay[i]!;
}
/** Chữ đọc được trong khung (tesseract tsv): từ ≥3 chữ cái, độ tin ≥ 80. Một khung có ≥ 2 từ như thế = model tự in chữ. */
export function chuTrongKhung(tsv: string): string[] {
  return tsv.split('\n').slice(1).map((d) => d.split('\t')).filter((c) => c.length >= 12 && Number(c[10]) >= 80)
    .map((c) => c[11]!.trim()).filter((w) => /^[A-Za-z][A-Za-z']{2,}[!?.,]*$/.test(w));
}
