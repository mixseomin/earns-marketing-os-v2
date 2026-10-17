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

/** Màu sản phẩm: sắc độ + độ đậm + độ sáng trung bình của ô sắc độ 10° đông nhất. So cả độ sáng vì cùng sắc độ vẫn khác món: #54 quần xanh
 *  cobalt (sáng) với áo polo xanh navy (tối) cùng hue ~225° — đo hue trần thì áo bị tính là quần, máy không thấy quần ra khỏi khung. */
export type MauSp = { h: number; s: number; v: number };
/** Màu chủ đạo của sản phẩm từ ảnh gốc (rgb24 phẳng). null = sản phẩm không có màu nổi (đen / trắng / xám, < 5% điểm có màu) → không đo
 *  được bằng màu. Ô đông nhất là màu da (ảnh có người mặc) mà có ô khác ≥ 40% nó thì lấy ô kia. */
export function mauSanPham(anh: Uint8Array[]): MauSp | null {
  const o = Array.from({ length: 36 }, () => ({ n: 0, s: 0, v: 0 })); let tong = 0, mau = 0;
  for (const px of anh) for (let i = 0; i + 2 < px.length; i += 3) {
    tong++; const [h, s, v] = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
    if (coMau(s, v)) { mau++; const b = o[Math.floor(h / 10) % 36]!; b.n++; b.s += s; b.v += v; }
  }
  if (!tong || mau / tong < 0.05) return null;
  const xep = o.map((b, i) => ({ ...b, i })).sort((a, b) => b.n - a.n);
  const laDa = (i: number) => i * 10 + 5 >= DA[0]! && i * 10 + 5 <= DA[1]!;
  const c = laDa(xep[0]!.i) ? (xep.find((x) => !laDa(x.i) && x.n >= xep[0]!.n * 0.4) ?? xep[0]!) : xep[0]!;
  return { h: c.i * 10 + 5, s: c.s / c.n, v: c.v / c.n };
}
/** Tỉ lệ điểm ảnh mang màu sản phẩm: sắc độ ±15°, độ đậm và độ sáng lệch ≤ 0,22. */
export function tiLeMau(px: Uint8Array, m: MauSp): number {
  let n = 0, tong = 0;
  for (let i = 0; i + 2 < px.length; i += 3) {
    tong++; const [h, s, v] = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
    const lech = Math.min(Math.abs(h - m.h), 360 - Math.abs(h - m.h));
    if (coMau(s, v) && lech <= 15 && Math.abs(s - m.s) <= 0.22 && Math.abs(v - m.v) <= 0.22) n++;
  }
  return tong ? n / tong : 0;
}
/** Khung (ảnh) gắn sản phẩm mà gần như không có màu sản phẩm (< 1%) = sản phẩm vắng hoặc sai màu (#54 shot 4: mặc quần jeans xanh đậm thay
 *  quần xanh cobalt, đo ra 0,6%). Ngưỡng thấp để shot toàn cảnh (quần nhỏ trong gương, #7 ≈ 2%) không bị báo nhầm. */
export const VANG_SP = 0.01;
/** Sản phẩm mất khỏi khung: khung k còn < 35% lượng màu của khung đầu. Trả giây đầu tiên mất, null = còn, 'vang' = khung đầu đã không có
 *  sản phẩm (< VANG_SP), 'khong_do' = khung đầu quá ít màu sản phẩm (< 3%) để kết luận mất. */
export function giayMatSanPham(tiLe: number[], giay: number[]): number | null | 'khong_do' | 'vang' {
  const dau = tiLe[0] ?? 0;
  if (dau < VANG_SP) return 'vang';
  if (dau < 0.03) return 'khong_do';
  const i = tiLe.findIndex((x, k) => k > 0 && x < dau * 0.35);
  return i < 0 ? null : giay[i]!;
}
/** Chữ đọc được trong khung (tesseract tsv): từ ≥3 chữ cái, độ tin ≥ 80. Một khung có ≥ 2 từ như thế = model tự in chữ. */
export function chuTrongKhung(tsv: string): string[] {
  return tsv.split('\n').slice(1).map((d) => d.split('\t')).filter((c) => c.length >= 12 && Number(c[10]) >= 80)
    .map((c) => c[11]!.trim()).filter((w) => /^[A-Za-z][A-Za-z']{2,}[!?.,]*$/.test(w));
}

/** MẶT TRÔI TRONG CLIP (bước 2b nhịp C, phim người thật): điểm giống ảnh mẫu của MỘT nhân vật qua các khung đã chấm được (mặt đủ to, gần chính diện —
 *  soi-mat.py). Trôi = từ 2 khung trở lên dưới ngưỡng VÀ chiếm ≥ 40% số khung chấm được — một khung lẻ (chớp mắt, nhoè chuyển động) không tính.
 *  Trả giây các khung lệch, hoặc null = đạt / không đủ khung để kết luận. */
export function matTroiClip(diem: { giay: number; giong: number }[], nguong = 0.363): number[] | null {
  const duoi = diem.filter((d) => d.giong < nguong);
  return duoi.length >= 2 && duoi.length / diem.length >= 0.4 ? duoi.map((d) => d.giay) : null;
}

/** BIẾN DẠNG trong clip (anh 17/10/2026: "giây 11 thì quần lòi ra ngoài. Rất hay bị lỗi này" — #120 shot 4 đứng dậy từ ngồi xổm, quần phồng như
 *  quần thụng, đũng tụt, cạp tự in chữ "Jett"). Đo hình học theo màu không tách được nếp gấp / bóng khỏi khe hai ống (thử 8 clip #120: lẫn lộn),
 *  nên soi bằng mô hình nhìn ảnh rẻ trên MỘT ảnh ghép N_KHUNG_BD khung. Phần thuần: lời dặn + đọc kết quả → câu lỗi kèm giây. */
export const N_KHUNG_BD = 12;
export const LOAI_BD = ['trang_phuc_bien_dang', 'co_the_meo', 'chu_tren_vat', 'san_pham_doi_kieu', 'vat_the_la'] as const;
export type LoiBienDang = { khung: number; loai: (typeof LOAI_BD)[number]; mo_ta: string };
const TEN_BD: Record<(typeof LOAI_BD)[number], string> = { trang_phuc_bien_dang: 'trang phục biến dạng', co_the_meo: 'cơ thể méo', chu_tren_vat: 'chữ tự in trên đồ vật',
  san_pham_doi_kieu: 'sản phẩm đổi kiểu', vat_the_la: 'vật thể lạ' };
export function loiDanBienDang(sp: string, yDo = ''): string {
  return `This image is a grid of ${N_KHUNG_BD} frames from ONE AI-generated video clip, in time order (left to right, top row then bottom row; frame 1 is top-left).
${yDo ? `What this shot is MEANT to show (anything described here is intentional, e.g. a different old garment, a rip, a split-screen comparison — not a defect): ${yDo}\n` : ''}The product (when it appears) should look like this: ${sp || '(no product description)'}
Find AI-generation defects that an ordinary viewer would clearly notice at normal playback speed. Do NOT report style, lighting, motion blur, small expression changes, or anything the shot intent above describes. When unsure, do not report.
Write mo_ta in short plain English.
Defect types:
- trang_phuc_bien_dang: clothing changes shape unnaturally between frames — pants ballooning or turning baggy, crotch dropping toward the knees, waistband or fabric bulging out, garment merging with the body or another object.
- co_the_meo: distorted anatomy — extra/missing/melted limbs or fingers, legs bending the wrong way, body proportions changing.
- chu_tren_vat: letters, logos or words printed or appearing on the product, clothing or objects (any readable text at all).
- san_pham_doi_kieu: the product changes design or color compared with the description or with earlier frames.
- vat_the_la: objects appearing, vanishing or morphing.
Give the frame number (1-${N_KHUNG_BD}) where each defect is clearest. If the clip is clean, return an empty list.`;
}
/** Kết quả mô hình → câu lỗi cho soi_clip.loi (giây = giữa khung). Khung ngoài 1..N hoặc loại lạ thì bỏ. Mỗi loại một câu (khung sớm nhất). */
export function loiTuBienDang(ds: LoiBienDang[], dai: number): string[] {
  const ra = new Map<string, string>();
  for (const x of [...ds].sort((a, b) => a.khung - b.khung)) {
    if (!LOAI_BD.includes(x.loai) || x.khung < 1 || x.khung > N_KHUNG_BD || ra.has(x.loai)) continue;
    const giay = Math.round(((x.khung - 0.5) * dai / N_KHUNG_BD) * 10) / 10;
    ra.set(x.loai, `${TEN_BD[x.loai]} từ giây ${giay}: ${x.mo_ta.trim().slice(0, 160)}`);
  }
  return [...ra.values()];
}
