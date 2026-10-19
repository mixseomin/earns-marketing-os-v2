// ĐIỂM CẮT CUỐI clip có ảnh thứ 2 dạng "ảnh kết + dải nhịp" (sinh-video.ts › anhCuoiChuoi, anh 19/10/2026). Thuần — sinh-video.ts › catCuoiClip đọc
// khung bằng ffmpeg rồi gọi; tự kiểm: cat-cuoi.test.mts.
// Cách đo: A = ảnh thứ 2 (có dải), B = ảnh kết (không dải) → vùng A khác B chính là DẢI NHỊP. Mỗi khung clip f ước lượng dải hiện bao nhiêu:
// α = Σ(f−B)(A−B) / Σ(A−B)² trên vùng đó (0 = không dải, 1 = dải đủ). Dải hiện = α TĂNG NHANH (> 0,1 trong 0,25 s); máy trôi dần về cảnh kết chỉ làm α
// nhích chậm — bản đo cũ (độ giống khung cuối) lẫn hai thứ, cắt muộn #11 / #23 (dải đã mờ hiện từ 4,8 s / 6,0 s).
/** α theo từng khung (F, A, B cùng cỡ W×H, xám). Rỗng nếu A và B gần như trùng (không có dải). */
export function doDaiNhip(F: Uint8Array[], A: Uint8Array, B: Uint8Array): number[] {
  const M: number[] = []; for (let i = 0; i < A.length; i++) if (Math.abs(A[i]! - B[i]!) > 25) M.push(i);
  if (M.length < A.length * 0.01) return [];
  return F.map((f) => { let num = 0, den = 0; for (const i of M) { const ab = A[i]! - B[i]!; num += (f[i]! - B[i]!) * ab; den += ab * ab; } return den ? num / den : 0; });
}
/** Giây cắt (0,15 s trước lúc dải bắt đầu tăng nhanh, chỉ xét nửa sau clip; không thấy thì 0,8 s trước cuối). null = A, B không có dải. */
export function tinhCatCuoi(F: Uint8Array[], A: Uint8Array, B: Uint8Array, fps: number): number | null {
  const a = doDaiNhip(F, A, B); if (!a.length) return null;
  const buoc = Math.max(1, Math.round(fps * 0.25));
  // dải đã hiện thì Ở tới cuối clip: α không tụt lại về mức trước (cú máy lia qua làm α nhảy rồi tụt — #9 rời cổ tay sang Hạ, bắt nhầm 3,5 s)
  const oLai = (i: number) => { for (let k = i + buoc; k < a.length; k++) if (a[k]! < a[i]! + 0.05) return false; return true; };
  for (let i = Math.floor(a.length * 0.4); i + buoc < a.length; i++) if (a[i + buoc]! - a[i]! > 0.1 && oLai(i)) return Math.max(0, Math.round((i / fps - 0.15) * 100) / 100);
  // không thấy dải tăng nhanh (hoà tan rất mờ / rất muộn, #25) → lùi an toàn 0,8 s trước cuối clip
  return Math.max(0, Math.round((a.length / fps - 0.8) * 100) / 100);
}
