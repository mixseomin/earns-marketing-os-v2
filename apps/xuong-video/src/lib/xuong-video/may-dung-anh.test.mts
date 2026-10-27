// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-anh.test.mts
import assert from 'node:assert';
import { anhAnh, assAnh, coChu, kichBanAnh, lenhAnh, veLua, type DeAnh } from './may-dung-anh';

const the: DeAnh = { kieu: 'the-chu-tren-anh', truy: 'airport terminal morning', chu: 'Cheap flight? Don\'t lose the savings to roaming', nhan: 'esimfares.com' };
const nho: DeAnh = { kieu: 'ai-con-nho', truy: 'rotary phone 1960s', chu: 'What was the first number you memorized?', phu: 'Rotary dial, 1962', nhan: 'Front Porch Puzzles' };
const doan: DeAnh = { kieu: 'doan-nam-gia', truy: 'gas station vintage', chu: 'How much was a gallon of gas in 1965?', dap_an: '31 cents', nhan: 'Front Porch Puzzles' };
const hai: DeAnh = { kieu: 'hai-lua-chon', truy: 'hotel reception desk', chu: 'A hotel texts a payment link before check-in. You…', lua: ['Pay it, it has my booking number', 'Call the number on the hotel website'], nhan: 'ratesbyroom.com' };

// câu chính luôn đủ chữ, ≤ 4 dòng, cỡ 30–68
for (const d of [the, nho, doan, hai]) { const { dong, co } = coChu(d.chu); assert.strictEqual(dong.join(' '), d.chu.replace(/\s+/g, ' ')); assert.ok(dong.length <= 4 && co >= 30 && co <= 68); assert.ok(assAnh(d).includes(d.chu.split(' ').pop()!), `${d.kieu}: từ cuối phải lên khung`); }
assert.ok(coChu('x'.repeat(5)).co === 68 && coChu('một câu rất dài '.repeat(8)).co < 50, 'câu dài thu chữ');
// từng kiểu
assert.ok(assAnh(nho).includes('DO YOU REMEMBER THIS?') && assAnh(nho).includes('Rotary dial'));
assert.ok(assAnh(doan).includes('31 cents') && anhAnh(doan).length === 2 && anhAnh(doan)[1]!.t > 1, 'đoán: ảnh 2 lộ đáp án sau mốc');
assert.strictEqual(anhAnh(the).length, 1); assert.ok(assAnh(hai).includes('A or B?'.toUpperCase()));
// hai lựa chọn: mỗi vế lên ĐỦ CHỮ (từ cuối có mặt), ≤ 2 dòng; vế rất dài thu chữ; chữ A và B có trong ASS
for (const v of hai.lua!) { const { dong, co } = veLua(v); assert.strictEqual(dong.join(' '), v); assert.ok(dong.length <= 2 && co >= 24); assert.ok(assAnh(hai).includes(v.split(' ').pop()!), `vế bị cắt: ${v}`); }
assert.ok(veLua('a very long option text that keeps going and going for more than ninety characters in total length').co < 34);
assert.ok(/}A$|}A\n/m.test(assAnh(hai)) && /}B$|}B\n/m.test(assAnh(hai)), 'chữ A/B có trong ASS');
assert.ok(!assAnh(the).includes('TAKE A GUESS'), 'thẻ chữ không có nhãn kiểu');
// lệnh: bắt buộc ảnh nền; ra đúng MỘT khung; khung 4:5
assert.throws(() => lenhAnh({ de: the, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.jpg' }), /ảnh nền thật/);
const l = lenhAnh({ de: doan, ass: 'a.ass', nen: '/t/nen.jpg', fontsDir: '/f', ra: 'r.jpg', khung: 1.5 });
assert.ok(l.includes('-frames:v') && l.includes('1.5') && l.some((x) => x.includes('crop=1080:1350')));
assert.strictEqual(kichBanAnh(doan).shots.length, 2); assert.strictEqual(kichBanAnh(hai).shots.length, 1);
console.log('may-dung-anh: 4 kiểu đạt');
