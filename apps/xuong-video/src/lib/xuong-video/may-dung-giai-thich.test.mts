// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-giai-thich.test.mts
import assert from 'node:assert';
import { assGiaiThich, cumPhuDe, dongHook, lenhGiaiThich, nhipGiaiThich, loiDoc, T_DAU, type DeGiaiThich } from './may-dung-giai-thich';

const de: DeGiaiThich = { truy: 'ambulance highway night', moc: 'Tanker on the interstate. What first?', loi: ['A clear liquid is pooling across two lanes.', 'Not another ambulance. Not air medical.', 'You call the hazmat team first, because scene safety comes before patient care.'], ket: 'Practice daily, one question at a time' };

// 1. chưa có tệp giọng: ước theo ký tự; có tệp: theo giây thật
const uoc = nhipGiaiThich(de), that = nhipGiaiThich({ ...de, giong_giay: 20 });
assert.ok(uoc.G > 4 && Math.abs(uoc.G - loiDoc(de).length / 15) < 1, 'ước 15 ký tự/giây');
assert.equal(that.G, 20);
// 2. phụ đề nối liền, phủ đúng quãng giọng, câu dài chiếm nhiều thời gian hơn
assert.equal(that.cau[0]!.tu, T_DAU);
for (let i = 1; i < that.cau.length; i++) assert.ok(Math.abs(that.cau[i]!.tu - that.cau[i - 1]!.den) < 1e-9, 'câu nối liền');
assert.ok(Math.abs(that.cau.at(-1)!.den - (T_DAU + 20)) < 1e-9, 'câu cuối hết đúng lúc hết giọng');
assert.ok(that.cau[2]!.den - that.cau[2]!.tu > that.cau[1]!.den - that.cau[1]!.tu + 1, 'câu dài hơn đứng lâu hơn (chênh ≥ 1 giây — so trần thì lọt sai số làm tròn)');
// 3. dòng kết đủ thời gian đọc sau giọng; không có kết thì đệm ngắn
assert.ok(that.DAI >= that.HET_GIONG + 2.5);
assert.ok(nhipGiaiThich({ ...de, ket: undefined, giong_giay: 20 }).DAI - (T_DAU + 20) < 1.5);
// 4. ASS: hook chữ to đủ chữ (ngắt dòng); phụ đề cụm ≤ 4 từ cho các câu SAU câu hook (câu hook đã nằm giữa màn)
const ass = assGiaiThich({ ...de, giong_giay: 20 });
for (const w of de.moc.split(' ')) assert.ok(ass.includes(w.replace(/[?.]/g, '')), `hook có chữ "${w}"`);
for (const c of de.loi.slice(1)) assert.ok(ass.includes(c.split(' ').slice(0, 3).join(' ')), `phụ đề có câu "${c.slice(0, 20)}"`);
const dongKet = ass.split('\n').find((l) => l.includes('one question'))!;
assert.ok(dongKet && Number(dongKet.match(/\\fs(\d+)/)![1]) >= 50 && /bord5/.test(dongKet), 'dòng kết = lời gọi hành động to, có viền như hook (không còn chữ trắng 56 trơn)');
const cum = cumPhuDe([{ chu: 'one two three four five six seven', tu: 1, den: 4 }]);
assert.equal(cum.length, 2); assert.ok(cum.every((x) => x.chu.split(' ').length <= 4), 'cụm ≤ 4 từ');
assert.equal(cum[0]!.tu, 1); assert.ok(Math.abs(cum[1]!.den - 4) < 1e-9 && Math.abs(cum[1]!.tu - cum[0]!.den) < 1e-9, 'cụm nối liền, phủ đúng quãng câu');
// 5. lệnh: thiếu video nền / thiếu giọng thì DỪNG; đủ thì có hai đầu vào + trễ giọng T_DAU
assert.throws(() => lenhGiaiThich({ de, ass, nen: null, am: '/a.mp3', fontsDir: '/f', ra: '/o.mp4' }), /VIDEO nền/);
assert.throws(() => lenhGiaiThich({ de, ass, nen: '/v.mp4', am: null, fontsDir: '/f', ra: '/o.mp4' }), /TỆP GIỌNG/);
const l = lenhGiaiThich({ de: { ...de, giong_giay: 20 }, ass, nen: '/v.mp4', am: '/a.mp3', fontsDir: '/f', ra: '/o.mp4' });
assert.ok(l.includes('/a.mp3') && l.join(' ').includes(`adelay=${T_DAU * 1000}`));
// khung tĩnh không cần giọng
assert.ok(lenhGiaiThich({ de, ass, nen: '/v.mp4', am: null, fontsDir: '/f', ra: '/k.jpg', khung: 2 }).includes('/k.jpg'));
// 6. hook dài vẫn đủ chữ (bài #842 mất chữ "apps")
const dai = 'This powerful blueprint holds your chart beyond apps';
assert.equal(dongHook(dai).dong.join(' '), dai, 'hook không bị cắt chữ');
assert.ok(dongHook(dai).dong.length <= 3 && dongHook(dai).co < 84, 'dài thì ngắt rộng + thu cỡ');
assert.equal(dongHook('Check his moon').co, 84, 'hook ngắn giữ chữ to nhất');
console.log('may-dung-giai-thich: 6 nhóm ok');
