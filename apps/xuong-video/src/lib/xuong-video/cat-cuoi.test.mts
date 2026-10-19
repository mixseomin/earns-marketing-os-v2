// Tự kiểm dò điểm cắt cuối (cat-cuoi.ts): dải nhịp hoà tan vào ở 7,45 s → cắt ~7,3 s; máy trôi chậm về cảnh kết không bị bắt nhầm; không dải → null.
import assert from 'node:assert';
import { tinhCatCuoi } from './cat-cuoi';
const N = 90 * 160, fps = 24, n = 192;
const B = new Uint8Array(N).fill(100); const A = new Uint8Array(N).fill(100); for (let i = 0; i < N * 0.2; i++) A[i] = 230;   // dải ở 20 % đầu ảnh
const tron = (alpha: number, troi = 0) => { const f = new Uint8Array(N); for (let i = 0; i < N; i++) f[i] = Math.round(B[i]! + troi + alpha * (A[i]! - B[i]!)); return f; };
// máy trôi chậm (độ sáng đổi dần 0 → 20 suốt clip) + dải vào từ 7,45 s trong 0,3 s
const F = Array.from({ length: n }, (_, i) => { const t = i / fps; return tron(t < 7.45 ? 0 : Math.min(1, (t - 7.45) / 0.3), Math.round(20 * t / 8)); });
const c = tinhCatCuoi(F, A, B, fps); assert.ok(c !== null && c >= 7.0 && c <= 7.4, `cắt ${c}`);
assert.equal(tinhCatCuoi(Array.from({ length: n }, () => tron(0)), A, B, fps), 7.2);   // dải không hiện → lùi 0,8 s trước cuối
assert.equal(tinhCatCuoi(F, B, B, fps), null);   // ảnh thứ 2 không có dải
// cú máy lia qua: α nhảy 3–4 s rồi tụt về 0, dải thật vào 7,45 s → không bắt nhầm 3 s
{ const G = Array.from({ length: n }, (_, i) => { const t = i / fps; const lia = t > 3 && t < 4 ? 0.5 : 0; return tron(t < 7.45 ? lia : Math.min(1, (t - 7.45) / 0.3)); });
  const c2 = tinhCatCuoi(G, A, B, fps); assert.ok(c2 !== null && c2 >= 7.0, `lia máy: cắt ${c2}`); }
assert.equal(tinhCatCuoi(Array.from({ length: n }, (_, i) => tron(i / fps > 1.5 ? 0.9 : 0)), A, B, fps), 0);   // dải suốt từ giây 1,5 → hỏng
console.log('cat-cuoi.test: ok', c);
