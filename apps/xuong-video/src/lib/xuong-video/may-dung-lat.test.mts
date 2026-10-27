// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-lat.test.mts
import assert from 'node:assert';
import { anhLat, assLat, demCua, dongKhangDinh, kichBanLat, lenhLat, nhanLat, nhipLat, truyVanLat, truyVanThemLat, type DeLat } from './may-dung-lat';
import { anhTheoMuc, chuoiAnh } from './may-dung-chuoi';
import { giayDoc } from './may-dung-ass';

const ds: DeLat = { kieu: 'dung-sai', tieu_de: '3 hotel booking facts. True or false?', nhan: 'ratesbyroom.com',
  cau: [{ khang_dinh: 'The hotel always has the same price as the booking site', dung: false, ly_do: 'Many hotels match or beat it if you call and ask', truy: 'hotel reception desk' },
    { khang_dinh: 'A non-refundable rate can still be changed by the hotel', dung: true, ly_do: 'The rule is the site\'s, the hotel can waive it', truy: 'hotel room key card' },
    { khang_dinh: 'Resort fees are always included in the price you see', dung: false, ly_do: 'Most sites add them at checkout or at the desk', truy: 'resort pool palm trees' }],
  ket: ['Check before you book', 'ratesbyroom.com'] };
const lt: DeLat = { kieu: 'lam-tuong', cau: [{ khang_dinh: 'Seniors should avoid puzzles that feel too easy', dung: false, ly_do: 'Finishing a page is the point. Confidence first, difficulty later', truy: 'elderly hands pencil puzzle' }], ket: ['Front Porch Puzzles'], am: 'gio' };
// nhịp đúng/sai: mở đủ đọc, mỗi câu: đọc ≥ giayDoc-0,5, đếm 3s, lật đủ đọc lý do; có điểm 3s; kết
const N = nhipLat(ds); assert.strictEqual(N.n, 3); assert.ok(N.T_MO >= 2.2 && N.T_MO >= giayDoc(ds.tieu_de!) - 1e-9); assert.ok(N.diem);
for (const [i, m] of N.moc.entries()) { assert.ok(m.dem - m.doc >= 2 - 1e-9); assert.strictEqual(Number((m.lat - m.dem).toFixed(2)), 3); assert.ok(m.het - m.lat >= giayDoc(ds.cau[i]!.ly_do) - 1e-9, `lật ${i} đủ đọc`); }
assert.strictEqual(Number((N.T_DIEM - N.T_KET).toFixed(2)), 3); assert.ok(N.DAI > N.T_DIEM + 2);
// lầm tưởng: 1 câu, không mở, không điểm; đề nhiều câu vẫn chỉ lấy 1
const M = nhipLat({ ...lt, cau: [...lt.cau, ...ds.cau] }); assert.strictEqual(M.n, 1); assert.strictEqual(M.T_MO, 0); assert.ok(!M.diem); assert.strictEqual(M.T_DIEM, M.T_KET);
// nhãn
assert.deepStrictEqual([nhanLat('lam-tuong', false), nhanLat('lam-tuong', true), nhanLat('dung-sai', true), nhanLat('dung-sai', false)], ['MYTH', 'FACT', 'TRUE', 'FALSE']);
// ASS: 3 câu đánh số, đếm 3·2·1, FALSE/TRUE, điểm, kết; lầm tưởng có MYTH + "Myth or fact?"
const a = assLat(ds); for (const s of ['1/3', '3/3', '}3', '}2', '}1', 'FALSE', 'TRUE', 'How many did you get?', 'Check before you book', 'True or false?', 'same price as the']) assert.ok(a.includes(s), s);
assert.ok(!/comment/i.test(a), 'màn điểm không mời bình luận'); const b = assLat(lt); assert.ok(b.includes('MYTH') && b.includes('Myth or fact?') && !b.includes('How many') && !b.includes('1/1'));
// ảnh: câu đầu = nen, câu sau = nen_them; thiếu thì dùng lại
assert.strictEqual(truyVanLat(ds), 'hotel reception desk'); assert.deepStrictEqual(truyVanThemLat(ds), ['hotel room key card', 'resort pool palm trees']); assert.deepStrictEqual(truyVanThemLat(lt), []);
assert.deepStrictEqual(anhTheoMuc(3, 'a', ['b']), ['a', 'b', 'b']); assert.deepStrictEqual(anhTheoMuc(2, 'a'), ['a', 'a']);
// lệnh: đúng/sai = mở + 3 câu + kết = 5 ảnh vào; lầm tưởng = 1 câu + kết = 2; khung = 1 ảnh; thiếu nen thì ném
const l = lenhLat({ de: ds, ass: 'a.ass', nen: '/t/a.jpg', nenThem: ['/t/b.jpg', '/t/c.jpg'], am: '/t/am.mp3', fontsDir: '/f', ra: 'r.mp4' });
assert.strictEqual(l.filter((x) => x === '-loop').length, 5); assert.ok(l.includes('/t/c.jpg') && l.includes('-stream_loop') && l.join(' ').includes('xfade') && l.join(' ').includes('[5:a]'));
assert.strictEqual(lenhLat({ de: lt, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'r.mp4' }).filter((x) => x === '-loop').length, 2);
assert.strictEqual(lenhLat({ de: lt, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'k.jpg', khung: 2 }).filter((x) => x === '-frames:v').length, 1);
assert.throws(() => lenhLat({ de: lt, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/);
// chuỗi ảnh chung: 1 đoạn vẫn ra [vx]; rỗng thì ném
assert.ok(chuoiAnh([{ anh: 'x', tu: 0, den: 5 }], { W: 1080, H: 1920, dai: 5 }).loc.join(';').includes('[vx]')); assert.throws(() => chuoiAnh([], { W: 1, H: 1, dai: 1 }), /rỗng/);
const [k] = anhLat(ds); assert.ok(k!.t > N.moc[0]!.doc && k!.t < N.moc[0]!.dem);
assert.strictEqual(kichBanLat(ds).shots.length, 1 + 9 + 2); assert.strictEqual(kichBanLat(lt).shots.length, 3 + 1);
// câu đố mẹo: 1 câu, đếm 10s, nhãn ANSWER, đáp án ở chỗ lý do; nhiều câu vẫn 1
const cd: DeLat = { kieu: 'cau-do', cau: [{ khang_dinh: 'What has keys but opens no door?', dung: true, ly_do: 'A piano', truy: 'old piano keys' }, ...ds.cau], ket: ['Front Porch Puzzles'] };
const C = nhipLat(cd); assert.strictEqual(C.n, 1); assert.strictEqual(demCua('cau-do'), 10); assert.strictEqual(Number((C.moc[0]!.lat - C.moc[0]!.dem).toFixed(2)), 10);
const c = assLat(cd); assert.ok(c.includes('ANSWER') && c.includes('A piano') && c.includes('}10') && c.includes('Think before it flips') && !c.includes('TRUE'));
assert.strictEqual(nhanLat('cau-do', true), 'ANSWER');
// khẳng định dài (đề AI 86 ký tự) phải lên khung đủ chữ: thu cỡ, không cắt
const dai = 'Most hotel booking apps have terrible customer service because OTA companies cut corners';
const L = dongKhangDinh(dai); assert.strictEqual(L.dong.join(' '), dai, 'không mất chữ'); assert.ok(L.co < 60);
assert.ok(assLat({ ...lt, cau: [{ ...lt.cau[0]!, khang_dinh: dai }] }).includes('corners'), 'đuôi câu còn trên khung');
console.log(`may-dung-lat: đạt (đúng/sai ${N.DAI.toFixed(1)}s, lầm tưởng ${M.DAI.toFixed(1)}s)`);
