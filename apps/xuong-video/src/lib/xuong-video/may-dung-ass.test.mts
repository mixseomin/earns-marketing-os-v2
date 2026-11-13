// Tự kiểm đồ nghề ASS chung — node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-ass.test.mts
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ketAss, ngat, vua, type DongAss } from './may-dung-ass';

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
// từ liền dài hơn bề ngang (link) phải THU CỠ theo dòng dài nhất (lam-tuong-40736 13/11/2026: link 33 ký tự giữ cỡ 64 → tràn hai mép)
const link = vua('ratesbyroom.com/hotel-scam-check/', 18, 3, 64); assert.ok(link.co * 33 * 0.64 * 1.25 <= 940, `link thu cỡ: ${link.co}`);

// MÁY GÁC cả lớp lỗi: không mẫu Máy Dựng nào được cắt dòng bằng ngat(…).slice(…) — phải đi qua vua()
const thu = dirname(fileURLToPath(import.meta.url));
const cat = readdirSync(thu).filter((f) => /^may-dung.*\.ts$/.test(f)).flatMap((f) =>
  readFileSync(join(thu, f), 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })).filter((x) => /\bngat\([^)]*\)\s*\.slice\(/.test(x.l) && !/^\s*(\/\/|\*)/.test(x.l)));
assert.deepStrictEqual(cat.map((x) => `${x.f}:${x.i}`), [], 'mẫu còn cắt chữ bằng ngat(…).slice — dùng vua(chữ, n, trần dòng, cỡ)');

// ketAss: màn kết ngắt dòng, không bỏ chữ, dòng 2 đẩy xuống theo dòng 1 (top-n astrolas 12/11/2026: "Explore your chart at astrolas.com" một dòng 80px tràn hai mép)
const dk: DongAss[] = [], fsT = (px: number) => `\\fs${Math.round(px * 1.25)}`;
ketAss(dk, 7, 10, 13, ['Explore your chart at astrolas.com', 'astrolas.com — free birth chart, no sign-up needed today'], { fs: fsT, trang: '#F4F6F8', co: 64, vien: false });
assert.strictEqual(dk.length, 2);
const go = (s: string) => s.replace(/\{[^}]*\}/g, '').split('\\N');
assert.ok(go(dk[0]![4]).length >= 2 && go(dk[0]![4]).every((l) => l.length <= 20), `dòng kết 1 phải ngắt ≤ 20 ký tự (được ${JSON.stringify(go(dk[0]![4]))})`);
assert.strictEqual(go(dk[0]![4]).join(' '), 'Explore your chart at astrolas.com', 'ketAss bỏ chữ dòng 1');
assert.ok(go(dk[1]![4]).length <= 2 && Number(/\\pos\(540,(\d+)\)/.exec(dk[1]![4])![1]) > 1010, 'dòng kết 2 phải ≤ 2 dòng và đẩy xuống dưới dòng 1');
const dn: DongAss[] = []; ketAss(dn, 7, 0, 1, ['ExamWeight', 'examweight.com'], { fs: fsT, trang: '#F4F6F8' });
assert.ok(dn[0]![4].includes('\\pos(540,900)') && dn[1]![4].includes('\\pos(540,1010)'), 'kết ngắn giữ đúng chỗ cũ');
const dr: DongAss[] = []; ketAss(dr, 7, 0, 1, [], { fs: fsT, trang: '#F4F6F8' }); assert.strictEqual(dr.length, 0);
// ketAss dọn màn: chữ / vạch của thân chạy qua mốc kết bị cắt ở mốc kết; lớp tối phủ cả khung giữ; dòng bắt đầu từ mốc kết giữ
const dd: DongAss[] = [[1, 0, 20, 'Ve', '{\\p1}m 0 0 l 1080 0 l 1080 8 l 0 8'], [3, 0, 20, 'Den', 'Proctored exam'], [1, 0, 20, 'Ve', '{\\p1}m 0 0 l 1080 0 l 1080 1920 l 0 1920'], [2, 3, 8, 'Chu', 'xong trước'], [10, 15, 20, 'Ve', '{\\p1}m 0 0 l 1080 0 l 1080 1920 l 0 1920']];
ketAss(dd, 11, 15, 20, ['Try a free practice test', 'examweight.com'], { fs: fsT, trang: '#F4F6F8' });
assert.deepStrictEqual(dd.slice(0, 5).map((x) => x[2]), [15, 15, 20, 8, 20], 'ketAss phải cắt chữ / vạch thân ở mốc kết, giữ lớp phủ khung');

// MÁY GÁC: không mẫu nào in thẳng chu(ket[…]) / chu(N.ket[…]) — màn kết đi qua ketAss
const ketTho = readdirSync(thu).filter((f) => /^may-dung.*\.ts$/.test(f) && f !== 'may-dung-ass.ts').flatMap((f) =>
  readFileSync(join(thu, f), 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })).filter((x) => /\bchu\(\s*(N\.)?ket\[/.test(x.l) && !/^\s*(\/\/|\*)/.test(x.l)));
assert.deepStrictEqual(ketTho.map((x) => `${x.f}:${x.i}`), [], 'mẫu còn in thẳng chu(ket[…]) — dùng ketAss(d, lớp, từ, tới, ket, { fs, trang })');
console.log('may-dung-ass: ok');
