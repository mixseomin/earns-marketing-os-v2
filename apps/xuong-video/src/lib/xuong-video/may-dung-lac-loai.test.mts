// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-lac-loai.test.mts
import assert from 'node:assert';
import { anhLacLoai, assLacLoai, kichBanLacLoai, lenhLacLoai, luoiLacLoai, nhipLacLoai, truyVanLacLoai, DEM, type DeLacLoai } from './may-dung-lac-loai';

const de: DeLacLoai = { giong: 'CALM', khac: 'CLAM', hang: 4, cot: 4, vi_tri: 10, moc: 'Eyes still sharp after seventy?', truy: 'porch rocking chair morning', ket: ['Front Porch Puzzles', 'pickjot.com'], am: 'gio', nhan: 'Front Porch Puzzles' };
const L = luoiLacLoai(de); assert.strictEqual(L.hang * L.cot, 16); assert.strictEqual(L.vi, 10); assert.ok(L.rong <= 960 && L.x0 >= 60); assert.ok(L.y0 > 450 && L.y0 + L.cao < 1600, 'lưới nằm giữa, không đè tiêu đề / đếm');
// kẹp: 2×7 → 3×5; vị trí ngoài lưới → ô cuối
const K = luoiLacLoai({ ...de, hang: 2, cot: 7, vi_tri: 99 }); assert.strictEqual(K.hang, 3); assert.strictEqual(K.cot, 5); assert.strictEqual(K.vi, 14);
// chữ ngắn thì ô chữ to hơn chữ dài
assert.ok(luoiLacLoai({ ...de, giong: 'O', khac: 'Q' }).coChu > L.coChu);
const N = nhipLacLoai(de); assert.strictEqual(Number((N.T_LO - N.T_DEM).toFixed(2)), DEM); assert.ok(N.DAI > N.T_KET + 2);
// ASS: 15 ô CALM + 1 ô CLAM, đếm, khoanh, hàng/cột đúng (ô 10 trong 4 cột = hàng 3 cột 3), móc, kết
const a = assLacLoai(de); assert.strictEqual((a.match(/}CALM\n/g) ?? []).length, 15, '15 ô CALM (dòng lộ "CALM → CLAM" không tính)'); assert.strictEqual((a.match(/}CLAM\n/g) ?? []).length, 1);
for (const s of ['Find the odd one out', '}7', '}1', 'Row 3, column 3', 'Eyes still sharp', 'CALM → CLAM', 'Front Porch Puzzles']) assert.ok(a.includes(s), s);
assert.strictEqual(truyVanLacLoai(de), 'porch rocking chair morning');
const l = lenhLacLoai({ de, ass: 'a.ass', nen: '/t/a.jpg', am: '/t/am.mp3', fontsDir: '/f', ra: 'r.mp4' }); assert.ok(l.join(' ').includes('gblur') && l.join(' ').includes('[1:a]'));
assert.strictEqual(lenhLacLoai({ de, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'k.jpg', khung: 2 }).filter((x) => x === '-frames:v').length, 1);
assert.throws(() => lenhLacLoai({ de, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/);
const [q, dap] = anhLacLoai(de); assert.ok(q!.t < N.T_LO && dap!.t > N.T_LO); assert.strictEqual(kichBanLacLoai(de).shots.length, 4);
console.log(`may-dung-lac-loai: đạt (dài ${N.DAI.toFixed(1)}s)`);
