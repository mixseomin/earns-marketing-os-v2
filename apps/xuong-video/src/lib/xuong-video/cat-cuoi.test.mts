// Tự kiểm dò điểm cắt cuối (cat-cuoi.ts): vùng dải nhịp đứng yên rồi chuyển hẳn sang khung cuối → cắt 0,1 s trước lúc tụt; không có dải → null.
import assert from 'node:assert';
import { tinhCatCuoi } from './cat-cuoi';
const W = 90, H = 160, fps = 24, n = 192;
const khung = (v: number) => new Uint8Array(W * H).fill(v);
// 0..7,45 s vùng trên = 100 (cảnh), từ 7,45 s hoà tan tới 220 (dải trắng) trong 0,3 s
const F = Array.from({ length: n }, (_, i) => { const t = i / fps; const k = t < 7.45 ? 0 : Math.min(1, (t - 7.45) / 0.3); return khung(Math.round(100 + 120 * k)); });
const c = tinhCatCuoi(F, W, H, fps); assert.ok(c !== null && c >= 7.3 && c <= 7.5, `cắt ${c}`);
assert.equal(tinhCatCuoi(Array.from({ length: n }, () => khung(120)), W, H, fps), null);   // không có dải
console.log('cat-cuoi.test: ok', c);
