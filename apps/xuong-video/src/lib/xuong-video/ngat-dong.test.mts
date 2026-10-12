// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ngat-dong.test.mts
import assert from 'node:assert';
import { ngatDong, cumChu, dongChuMan, doDong, boChamCuoi } from './ngat-dong';

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
// bề rộng theo font thật: ca 12/10/2026 — Playfair Black chữ hoa cỡ 0,1W. Đo 0,4×cỡ/ký tự thì "SIGNED. HER TERMS." (18 ký tự) lọt 1 dòng
// nhưng thật rộng ~0,77W + viền → giờ mọi dòng phải nằm trong khung, và bản xuất 1080 / ô xem 270 xuống dòng y hệt.
const PF = { font: 'Playfair Display Black', co: 0.1, ngang: 100, vien_day: 0.06 };
for (const cau of ['SIGNED. HER TERMS', 'SHE CHECKED HER CHART', 'EVERYTHING FALLING APART', 'check YOUR chart free']) {
  const d = doDong(1080, PF); const r = dongChuMan(cau, 1080, PF);
  assert.ok(r.dong.every((x) => d.rong(x) <= d.toiDa), `${cau} tràn: ${r.dong.map((x) => Math.round(d.rong(x))).join('|')} > ${Math.round(d.toiDa)}`);
  assert.deepStrictEqual(dongChuMan(cau, 270, PF).dong, r.dong);
}
// Montserrat Black hẹp hơn nhiều → cùng câu vẫn một dòng (không ngắt thừa)
assert.strictEqual(dongChuMan('SIGNED. HER TERMS', 1080, { ...PF, font: 'Montserrat Black', co: 0.08 }).dong.length, 1);
// một từ rộng hơn khung → thu nhỏ cả câu
assert.ok(dongChuMan('ASTROLOGICALLYUNBELIEVABLE', 1080, { ...PF, co: 0.14 }).co < 1);
// dấu chấm cuối câu (anh 12/10/2026): bỏ chấm cuối, giữ chấm giữa / tên miền / … / ? / !
assert.strictEqual(boChamCuoi('SIGNED. HER TERMS.'), 'SIGNED. HER TERMS');
assert.strictEqual(boChamCuoi('astrolas.com'), 'astrolas.com');
assert.strictEqual(boChamCuoi('INSTEAD…'), 'INSTEAD…');
assert.strictEqual(boChamCuoi('INSTEAD...'), 'INSTEAD...');
assert.strictEqual(boChamCuoi('SIGN ANYWAY?'), 'SIGN ANYWAY?');
assert.strictEqual(boChamCuoi('NOV 14. '), 'NOV 14');
console.log('ngat-dong.test: ok');
