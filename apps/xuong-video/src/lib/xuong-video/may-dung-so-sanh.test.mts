// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-so-sanh.test.mts
import assert from 'node:assert';
import { anhSoSanh, assSoSanh, kichBanSoSanh, lenhSoSanh, nhipSoSanh, truyVanSoSanh, truyVanThemSoSanh, type DeSoSanh } from './may-dung-so-sanh';
import { giayDoc } from './may-dung-ass';

const de: DeSoSanh = { tieu_de: 'Booking site vs calling the hotel desk', nhan: 'ratesbyroom.com',
  trai: { ten: 'Booking site', dong: ['Price shown first, fees added at checkout', 'Change the dates: new booking, new price', 'Questions go to a chat bot'], truy: 'laptop hotel booking website' },
  phai: { ten: 'Calling the desk', dong: ['Ask for the all-in price up front', 'Many desks move a date for free', 'A person who knows the rooms picks up'], truy: 'hotel receptionist phone' },
  ket_luan: 'Check the site, then call before you pay', ket: ['Compare before you book', 'ratesbyroom.com'], am: 'pho' };
const N = nhipSoSanh(de); assert.strictEqual(N.n, 3); assert.ok(N.T_MO >= giayDoc(de.tieu_de, de.trai.ten, de.phai.ten) - 1e-9);
for (let i = 0; i < 3; i++) { const den = i + 1 < 3 ? N.tu[i + 1]! : N.T_KL; assert.ok(den - N.tu[i]! >= giayDoc(de.trai.dong[i]!, de.phai.dong[i]!) - 1e-9, `cặp ${i} đủ đọc hai vế`); }
assert.ok(N.T_KET - N.T_KL >= 2.5 - 1e-9 && N.DAI > N.T_KET + 2);
// lệch số dòng: lấy số dòng ít hơn; trên 4 chỉ lấy 4; không kết luận thì T_KET = T_KL
assert.strictEqual(nhipSoSanh({ ...de, phai: { ...de.phai, dong: de.phai.dong.slice(0, 2) } }).n, 2);
assert.strictEqual(nhipSoSanh({ ...de, trai: { ...de.trai, dong: [...de.trai.dong, 'a', 'b', 'c'] }, phai: { ...de.phai, dong: [...de.phai.dong, 'a', 'b', 'c'] } }).n, 4);
const K = nhipSoSanh({ ...de, ket_luan: undefined }); assert.strictEqual(K.T_KET, K.T_KL);
// ASS: tên hai bên, cả 6 dòng, kết luận, kết; nhãn
const a = assSoSanh(de); for (const s of ['Booking site', 'Calling the desk', 'fees added at', 'knows the rooms', 'Check the site, then call', 'Compare before you book', 'ratesbyroom.com']) assert.ok(a.replace(/\\N/g, ' ').includes(s), s);
// ảnh: X = nen, Y = nen_them[0]
assert.strictEqual(truyVanSoSanh(de), 'laptop hotel booking website'); assert.deepStrictEqual(truyVanThemSoSanh(de), ['hotel receptionist phone']);
// lệnh: 2 ảnh vào + vstack; thiếu ảnh Y thì lặp X; tiếng luồng [2:a]; khung = 1 ảnh; thiếu nen ném
const l = lenhSoSanh({ de, ass: 'a.ass', nen: '/t/x.jpg', nenThem: ['/t/y.jpg'], am: '/t/am.mp3', fontsDir: '/f', ra: 'r.mp4' });
assert.strictEqual(l.filter((x) => x === '-loop').length, 2); assert.ok(l.includes('/t/y.jpg') && l.join(' ').includes('vstack=inputs=2') && l.join(' ').includes('[2:a]') && l.includes('-stream_loop'));
const l2 = lenhSoSanh({ de, ass: 'a.ass', nen: '/t/x.jpg', fontsDir: '/f', ra: 'r.mp4' }); assert.strictEqual(l2.filter((x) => x === '/t/x.jpg').length, 2); assert.ok(l2.some((x) => x.startsWith('anullsrc')));
assert.strictEqual(lenhSoSanh({ de, ass: 'a.ass', nen: '/t/x.jpg', fontsDir: '/f', ra: 'k.jpg', khung: 3 }).filter((x) => x === '-frames:v').length, 1);
assert.throws(() => lenhSoSanh({ de, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/);
const [k] = anhSoSanh(de); assert.ok(k!.t > N.tu[2]! && k!.t < N.DAI);
assert.strictEqual(kichBanSoSanh(de).shots.length, 1 + 3 + 1 + 1);
// MÀN KẾT DỌN SẠCH (examweight so-sanh-60893, 13/11/2026: "examweight.com" đè nhãn "Proctored exam" vì nhãn + dòng thân chạy tới hết video):
// ở giữa màn kết chỉ còn lớp tối phủ khung, hai dòng kết và nhãn thương hiệu góc trên
const ew: DeSoSanh = { tieu_de: 'Practice at Home vs Proctored Exam', nhan: 'ExamWeight', ket_luan: 'Practice the questions before exam day.', ket: ['Try a free practice test', 'examweight.com'],
  trai: { ten: 'Practice at home', dong: ['You can pause between questions', 'Your notes can stay nearby', 'Try sample questions at your pace'], truy: 'x' },
  phai: { ten: 'Proctored exam', dong: ['You answer under exam rules', 'Your screen may be monitored', 'Read each prompt carefully'], truy: 'y' } };
const NE = nhipSoSanh(ew), giua = (NE.T_KET + NE.DAI) / 2, giay = (s: string) => { const [h, m, x] = s.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(x); };
const conLai = assSoSanh(ew).split('\n').filter((l) => l.startsWith('Dialogue:')).map((l) => l.split(',')).filter((p) => giay(p[1]!) <= giua && giay(p[2]!) > giua).map((p) => p.slice(9).join(','));
assert.ok(!conLai.some((t) => /Proctored exam|Practice at home|exam rules|before exam day/.test(t)), `màn kết còn chữ thân video: ${JSON.stringify(conLai)}`);
assert.ok(conLai.some((t) => t.includes('examweight.com')) && conLai.some((t) => t.includes('Try a free practice test')) && conLai.length === 4, `màn kết phải còn đúng phủ + 2 dòng kết + nhãn (được ${conLai.length})`);
console.log(`may-dung-so-sanh: đạt (dài ${N.DAI.toFixed(1)}s)`);
