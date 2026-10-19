// ĐIỂM CẮT CUỐI clip có ảnh thứ 2 dạng "ảnh kết + dải nhịp" (sinh-video.ts › anhCuoiChuoi, anh 19/10/2026). Thuần — sinh-video.ts › catCuoiClip đọc
// khung bằng ffmpeg rồi gọi; tự kiểm: cat-cuoi.test.mts.
/** Giây cắt từ chuỗi khung xám nhỏ (W×H, fps): vùng dải nhịp (2–23 % cao, 18–82 % ngang) so với khung CUỐI — đứng ở mức nền tới lúc dải hiện rồi
 *  tụt hẳn; cắt 0,1 s trước khung cuối cùng còn ở mức nền. Thuần (có test). null = không thấy dải (clip không hoà tan). */
export function tinhCatCuoi(F: Uint8Array[], W: number, H: number, fps: number): number | null {
  if (F.length < fps * 2) return null;
  const y0 = Math.round(H * 0.02), y1 = Math.round(H * 0.23), x0 = Math.round(W * 0.18), x1 = Math.round(W * 0.82);
  const L = F[F.length - 1]!;
  const d = F.map((f) => { let t = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { t += Math.abs(f[y * W + x]! - L[y * W + x]!); n++; } return t / n; });
  const a = Math.floor(F.length * 0.5), b = Math.floor(F.length - fps * 1.2); const ref = [...d.slice(a, Math.max(a + 1, b))].sort((p, q) => p - q)[Math.floor((Math.max(a + 1, b) - a) / 2)] ?? 0;
  if (ref < 8) return null;   // vùng trên đã giống khung cuối suốt clip — không có dải
  // máy có thể trôi dần về khung cuối trước khi dải hiện (thử #1: lùi máy từ giây 4) → không bắt chỗ giảm từ từ: tìm lúc vùng trên GẦN TRÙNG khung cuối
  // (dải đã hiện, < 40 % mức nền), rồi lần ngược tới khung cuối cùng còn khác rõ (≥ 85 %) — dải bắt đầu ngay sau đó.
  const j = d.findIndex((x, i) => i >= a && x < ref * 0.4);
  if (j < 0) return null;
  let k = j; while (k > a && d[k]! < ref * 0.85) k--;
  return Math.max(0, Math.round(((k / fps) - 0.1) * 100) / 100);
}
