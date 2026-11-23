import assert from 'node:assert';
import { kepNgang, xepDocNoi } from './anchored-popover';

const nut = (y: number) => ({ top: y, bottom: y + 20 });
assert.deepStrictEqual(xepDocNoi(300, nut(100), 4, 800), {}, 'đủ chỗ dưới → mở xuống');
// màn thấp, nút gần đáy: lật lên, ĐÁY panel sát nút (hở đúng gap) — ca "bấm một đằng đi một nẻo" 02/11/2026
const l = xepDocNoi(430, nut(520), 4, 640); assert.deepStrictEqual(l, { top: 520 - 4 - 430 }); assert.strictEqual(520 - (l.top! + 430), 4);
// cả hai phía thiếu: không đè lên nút — chọn phía rộng hơn + cuộn
const d = xepDocNoi(900, nut(200), 4, 700); assert.deepStrictEqual(d, { maxHeight: 700 - 8 - 224 });
const t = xepDocNoi(900, nut(560), 4, 700); assert.deepStrictEqual(t, { top: 8, maxHeight: 560 - 4 - 8 }); assert.ok(t.top! + t.maxHeight! <= 560, 'không đè nút');
// #1796 KẸP NGANG: mô phỏng panel co theo chỗ trống (rộng = min(nội dung, chỗ còn lại, maxWidth)) — mọi ca phải yên trong ≤ 2 lần đo,
// không còn tràn màn (bản cũ dời left từng 8px: nội dung 900px, nút ở x=1300, màn 1442 → hơn 50 lần setPos → React #185).
const ve = (p: { left?: number; right?: number; maxWidth?: number }, noiDung: number, W: number) => {
  const cho = p.left != null ? W - p.left : W - (p.right ?? 0);
  const rong = Math.min(noiDung, cho, p.maxWidth ?? Infinity);
  return p.left != null ? { left: p.left, right: p.left + rong } : { left: W - (p.right ?? 0) - rong, right: W - (p.right ?? 0) };
};
let ca = 0;
for (const W of [360, 1366, 1442, 1920]) for (const noiDung of [120, 480, 900, 2400]) for (const x of [-40, 0, 200, W - 150, W - 10]) {
  for (const p0 of [{ left: x }, { right: W - x - 30 }] as { left?: number; right?: number; maxWidth?: number }[]) {
    let p = p0, nhip = 0;
    for (;;) { const k = kepNgang(ve(p, noiDung, W), W); if (!k) break; p = { ...p, ...k }; assert.ok(++nhip <= 1, `W${W} nd${noiDung} x${x}: kẹp lặp ${nhip} nhịp`); }
    const r = ve(p, noiDung, W);
    if (nhip) assert.ok(r.left >= 8 - 0.5 && r.right <= W - 8 + 0.5, `W${W} nd${noiDung} x${x}: vẫn tràn ${r.left}..${r.right}`);
    ca++;
  }
}
console.log(`anchored-popover: 4/4 ok · kẹp ngang ${ca} ca yên trong một nhịp`);
