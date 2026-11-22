// Hình học đa giác mặt bằng dùng chung (ns.js, duong.js): điểm trong đa giác + khoảng cách tới mép.
// Trước: bốn bản chép tay, không khung bao → mỗi lần hỏi duyệt hết mọi đỉnh; dựng đường đi gọi hàng triệu lần → F5 chậm ~4 s (đo 22/11/2026).
// Khung bao nhớ theo mảng đỉnh (WeakMap): đa giác đổi hình thì mã luôn tạo mảng MỚI (k.v = k.v.map…), không sửa đỉnh tại chỗ.
const HOP = new WeakMap();
export const hop = (v) => {
  let h = HOP.get(v); if (h) return h;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of v) { if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; }
  HOP.set(v, (h = [a, b, c, d])); return h;
};
export const trongDa = (x, z, v) => {
  const h = hop(v); if (x < h[0] || x > h[2] || z < h[1] || z > h[3]) return false;
  let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c;
};
// khoảng cách từ (x, z) tới mép đa giác khép kín
export const keMep = (x, z, v) => {
  let m = 1e9; for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m;
};
