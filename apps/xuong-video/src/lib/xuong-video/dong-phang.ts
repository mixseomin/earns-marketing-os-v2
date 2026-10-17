// Phép biến đổi PHỐI CẢNH (homography) 4 điểm — ghép đè ảnh chuẩn lên mặt vật trong keyframe (ghep-vung.ts). Thuần — tự kiểm: dong-phang.test.mts
/** Ma trận đồng phẳng đưa điểm khung (x, y) → điểm ảnh (u, v) từ 4 cặp — giải hệ 8 ẩn (khử Gauss). null = 4 điểm suy biến. */
export function dongPhang(cap: { x: number; y: number; u: number; v: number }[]): number[] | null {
  if (cap.length < 4) return null;
  const A: number[][] = [];
  for (const { x, y, u, v } of cap.slice(0, 4)) { A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]); A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]); }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    if (Math.abs(A[p]![c]!) < 1e-12) return null; [A[c], A[p]] = [A[p]!, A[c]!];
    for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r]![c]! / A[c]![c]!; for (let k = c; k < 9; k++) A[r]![k]! -= f * A[c]![k]!; }
  }
  return [...A.map((r, i) => r[8]! / r[i]!), 1];
}
/** Áp ma trận lên một điểm. */
export const apDongPhang = (H: number[], x: number, y: number) => { const z = H[6]! * x + H[7]! * y + 1; return [(H[0]! * x + H[1]! * y + H[2]!) / z, (H[3]! * x + H[4]! * y + H[5]!) / z] as const; };
