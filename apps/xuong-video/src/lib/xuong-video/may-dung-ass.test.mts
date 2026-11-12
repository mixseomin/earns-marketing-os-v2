// Tự kiểm đồ nghề ASS chung — node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-ass.test.mts
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ngat, vua } from './may-dung-ass';

// vua: không bao giờ bỏ chữ, vừa trần dòng, thu cỡ khi phải ngắt rộng
const dai = "Don't let one study gap stand between you and your nursing career.";
assert.ok(ngat(dai, 30).length > 2, 'câu mẫu phải dài hơn 2 dòng × 30 để thử');
const v = vua(dai, 30, 2, 52);
assert.strictEqual(v.dong.join(' '), dai, 'vua bỏ chữ');
assert.ok(v.dong.length <= 2, 'vua vượt trần dòng');
assert.ok(v.co < 52 && v.co > 20, `cỡ chữ phải thu theo tỉ lệ (được ${v.co})`);
const ngan = vua('Short title', 30, 2, 52);
assert.deepStrictEqual(ngan, { dong: ['Short title'], co: 52 }, 'câu ngắn giữ nguyên cỡ');
assert.deepStrictEqual(vua('', 30, 2, 52).dong, []);
const tuDai = vua('Supercalifragilisticexpialidocious', 10, 1, 40);
assert.strictEqual(tuDai.dong.join(' '), 'Supercalifragilisticexpialidocious');

// MÁY GÁC cả lớp lỗi: không mẫu Máy Dựng nào được cắt dòng bằng ngat(…).slice(…) — phải đi qua vua()
const thu = dirname(fileURLToPath(import.meta.url));
const cat = readdirSync(thu).filter((f) => /^may-dung.*\.ts$/.test(f)).flatMap((f) =>
  readFileSync(join(thu, f), 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })).filter((x) => /\bngat\([^)]*\)\s*\.slice\(/.test(x.l) && !/^\s*(\/\/|\*)/.test(x.l)));
assert.deepStrictEqual(cat.map((x) => `${x.f}:${x.i}`), [], 'mẫu còn cắt chữ bằng ngat(…).slice — dùng vua(chữ, n, trần dòng, cỡ)');
console.log('may-dung-ass: ok');
