// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-cau-noi.test.mts
import assert from 'node:assert';
import { anhCauNoi, assCauNoi, kichBanCauNoi, lenhCauNoi, nhipCauNoi, truyVanCauNoi, type DeCauNoi } from './may-dung-cau-noi';
import { giayDoc } from './may-dung-ass';

const de: DeCauNoi = { tinh_huong: 'At hotel check-in', ngon_ngu: 'Japanese', truy: 'tokyo hotel reception', nhan: 'esimfares.com',
  cau: [{ ban_ngu: 'チェックインをお願いします', doc: 'chekku-in o onegai shimasu', nghia: 'I would like to check in, please' },
    { ban_ngu: '予約しています', doc: 'yoyaku shite imasu', nghia: 'I have a reservation' },
    { ban_ngu: 'Wi-Fiのパスワードは何ですか', doc: 'waifai no pasuwādo wa nan desu ka', nghia: 'What is the Wi-Fi password?' }],
  ket: ['Land connected in Japan', 'esimfares.com'], am: 'pho' };
const N = nhipCauNoi(de); assert.strictEqual(N.n, 3); assert.ok(N.T_MO >= 2.2);
for (let i = 0; i < 3; i++) { const den = i + 1 < 3 ? N.tu[i + 1]! : N.T_KET; const c = de.cau[i]!; assert.ok(den - N.tu[i]! >= giayDoc(c.ban_ngu, c.doc, c.nghia) + 1 - 1e-9, `câu ${i} đủ đọc + 1s nhìn chữ lạ`); }
assert.ok(N.DAI > N.T_KET + 2); assert.strictEqual(nhipCauNoi({ ...de, cau: [...de.cau, ...de.cau] }).n, 5);
// ASS: chữ bản ngữ giữ nguyên (không bị lọc), cách đọc, nghĩa, số thứ tự, mở, kết
const a = assCauNoi(de); for (const s of ['チェックインをお願いします', 'yoyaku shite imasu', 'What is the Wi-Fi password?', '1/3', '3/3', 'Say this in Japanese', 'At hotel check-in', 'Land connected in Japan']) assert.ok(a.includes(s), s);
assert.strictEqual(truyVanCauNoi(de), 'tokyo hotel reception');
// lệnh: một ảnh, tiếng luồng [1:a]; khung; thiếu nen ném
const l = lenhCauNoi({ de, ass: 'a.ass', nen: '/t/a.jpg', am: '/t/am.mp3', fontsDir: '/f', ra: 'r.mp4' });
assert.strictEqual(l.filter((x) => x === '-loop').length, 1); assert.ok(l.join(' ').includes('[1:a]') && l.includes('-stream_loop'));
assert.ok(lenhCauNoi({ de, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'r.mp4' }).some((x) => x.startsWith('anullsrc')));
assert.strictEqual(lenhCauNoi({ de, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'k.jpg', khung: 2 }).filter((x) => x === '-frames:v').length, 1);
assert.throws(() => lenhCauNoi({ de, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/);
assert.ok(anhCauNoi(de)[0]!.t > N.tu[0]!); assert.strictEqual(kichBanCauNoi(de).shots.length, 5);
console.log(`may-dung-cau-noi: đạt (dài ${N.DAI.toFixed(1)}s)`);
