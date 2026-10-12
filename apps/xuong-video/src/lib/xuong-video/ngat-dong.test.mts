// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ngat-dong.test.mts
import assert from 'node:assert';
import { ngatDong, cumChu, kyTuMoiDong } from './ngat-dong';

// ca anh báo 12/10/2026: không còn "R" một mình
assert.deepStrictEqual(ngatDong('Mercury R · Venus R', 17), ['Mercury R ·', 'Venus R']);
assert.deepStrictEqual(cumChu('Mercury R · Venus R'), ['Mercury R ·', 'Venus R']);
// từ chức năng đi với chữ sau; cân dòng thay vì dồn dòng trên
assert.deepStrictEqual(ngatDong('check YOUR chart free', 14), ['check YOUR', 'chart free']);
assert.deepStrictEqual(ngatDong("both in house 8: other people's money", 20), ['both in house 8:', "other people's money"]);
assert.ok(!ngatDong('the clause that would have cost her everything', 18).some((d) => /^(the|of|a)$/i.test(d.split(' ').at(-1)!)), 'không để "the" cuối dòng');
// không dòng nào mở đầu bằng dấu
assert.ok(ngatDong('OCT 24 → NOV 13 · double retrograde', 12).every((d) => !/^[·→—]/.test(d)));
// vừa một dòng thì để một dòng; cụm dài hơn bề rộng đứng riêng
assert.deepStrictEqual(ngatDong('IT BEGINS.', 20), ['IT BEGINS.']);
assert.deepStrictEqual(ngatDong('Supercalifragilistic word', 10), ['Supercalifragilistic', 'word']);
assert.deepStrictEqual(ngatDong('  a  ', 5), ['a']);
assert.deepStrictEqual(ngatDong('', 5), []);
// tiếng Việt: chia cân
const v = ngatDong('Giảm 70% cho 100 đơn đầu tiên hôm nay', 12);
assert.strictEqual(v.length, 3); assert.ok(Math.max(...v.map((d) => d.length)) - Math.min(...v.map((d) => d.length)) <= 3, v.join('|'));
// bề rộng: tỉ lệ khung → bản xuất 1080 và ô xem 270 cùng số ký tự
assert.strictEqual(kyTuMoiDong(1080, 0.1, 100), kyTuMoiDong(270, 0.1, 100));
console.log('ngat-dong.test: ok');
