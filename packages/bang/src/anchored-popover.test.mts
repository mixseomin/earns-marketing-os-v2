import assert from 'node:assert';
import { xepDocNoi } from './anchored-popover';

const nut = (y: number) => ({ top: y, bottom: y + 20 });
assert.deepStrictEqual(xepDocNoi(300, nut(100), 4, 800), {}, 'đủ chỗ dưới → mở xuống');
// màn thấp, nút gần đáy: lật lên, ĐÁY panel sát nút (hở đúng gap) — ca "bấm một đằng đi một nẻo" 02/11/2026
const l = xepDocNoi(430, nut(520), 4, 640); assert.deepStrictEqual(l, { top: 520 - 4 - 430 }); assert.strictEqual(520 - (l.top! + 430), 4);
// cả hai phía thiếu: không đè lên nút — chọn phía rộng hơn + cuộn
const d = xepDocNoi(900, nut(200), 4, 700); assert.deepStrictEqual(d, { maxHeight: 700 - 8 - 224 });
const t = xepDocNoi(900, nut(560), 4, 700); assert.deepStrictEqual(t, { top: 8, maxHeight: 560 - 4 - 8 }); assert.ok(t.top! + t.maxHeight! <= 560, 'không đè nút');
console.log('anchored-popover: 4/4 ok');
