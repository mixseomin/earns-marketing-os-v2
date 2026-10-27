// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-gia.test.mts
import assert from 'node:assert';
import { anhGia, assGia, kichBanGia, lenhGia, nhipGia, truyVanGia, DEM, type DeGia } from './may-dung-gia';
import { giayDoc } from './may-dung-ass';

const de: DeGia = { tieu_de: 'Two hotel confirmation emails. One is fake.', loai: 'Email', gia: 'b', truy: 'hotel lobby laptop', nhan: 'ratesbyroom.com',
  a: { gui: 'Harborview Suites <stay@harborviewsuites.example>', dong: [{ t: 'Booking HV-48213 confirmed for 12–14 Nov' }, { t: 'Pay at the property. No deposit taken.' }, { t: 'Questions? Call the front desk: see website' }] },
  b: { gui: 'Harborview Suites <desk-confirm@mail-secure-pay.example>', dong: [{ t: 'URGENT: confirm your card within 2 hours', co: 1 }, { t: 'Or the reservation will be cancelled', co: 1 }, { t: 'Verify here: http://hv-suites-verify.example/pay', co: 2 }, { t: 'Reply with the last 4 digits to speed it up', co: 3 }] },
  ly_do: ['A 2-hour deadline is pressure, not policy', 'Hotels never send a payment link by email', 'No real desk asks for card digits in a reply'], ket: ['Check the real rate first', 'ratesbyroom.com/hotel-scam-check'], am: 'pho' };
const N = nhipGia(de); assert.ok(N.T_DEM >= 3); assert.strictEqual(Number((N.T_LO - N.T_DEM).toFixed(2)), DEM); assert.ok(N.T_KET - N.T_LO >= giayDoc('FAKE', ...de.ly_do) - 1e-9); assert.ok(N.DAI > N.T_KET + 2);
// không lý do / không kết vẫn chạy; lý do quá 3 chỉ lấy 3
const M = nhipGia({ ...de, ly_do: [], ket: [] }); assert.ok(M.T_KET - M.T_LO >= 3 - 1e-9 && M.DAI > M.T_KET); assert.strictEqual(nhipGia({ ...de, ly_do: ['a', 'b', 'c', 'd'] }).lyDo.length, 3);
// ASS: tiêu đề, hai thẻ A/B đủ dòng, đếm 7 → 1, FAKE trên thẻ giả + REAL trên thẻ thật, số khoanh 1 2 3, lý do, "B is the fake", kết
const a = assGia(de); for (const s of ['One is fake', '}A', '}B', 'HV-48213', 'URGENT: confirm', '}7', '}1', 'FAKE', 'REAL', 'B is the fake', '1. A 2-hour deadline', '3. No real desk', 'Check the real rate first', 'Which one is fake?']) assert.ok(a.includes(s), s);
assert.strictEqual((a.match(/FAKE/g) ?? []).length, 1, 'chỉ một thẻ FAKE'); assert.ok(assGia({ ...de, gia: 'a' }).includes('A is the fake'));
assert.strictEqual(truyVanGia(de), 'hotel lobby laptop');
// lệnh: một ảnh làm mờ, tiếng [1:a]; khung; thiếu nen ném
const l = lenhGia({ de, ass: 'a.ass', nen: '/t/a.jpg', am: '/t/am.mp3', fontsDir: '/f', ra: 'r.mp4' });
assert.strictEqual(l.filter((x) => x === '-loop').length, 1); assert.ok(l.join(' ').includes('gblur') && l.join(' ').includes('[1:a]'));
assert.strictEqual(lenhGia({ de, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'k.jpg', khung: 2 }).filter((x) => x === '-frames:v').length, 1);
assert.throws(() => lenhGia({ de, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/);
const [q, dap] = anhGia(de); assert.ok(q!.t < N.T_LO && dap!.t > N.T_LO && dap!.t < N.T_KET);
assert.strictEqual(kichBanGia(de).shots.length, 4);
console.log(`may-dung-gia: đạt (dài ${N.DAI.toFixed(1)}s)`);
