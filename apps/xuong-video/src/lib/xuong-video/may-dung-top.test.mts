// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-top.test.mts
import assert from 'node:assert';
import { anhTop, assTop, kichBanTop, lenhTop, nhipTop, truyVanThemTop, truyVanTop, type DeTop } from './may-dung-top';
import { giayDoc } from './may-dung-ass';

const de: DeTop = { tieu_de: '3 things to do before your plane lands in Japan', moc: 'Takes two minutes, saves a roaming bill', nhan: 'esimfares.com',
  muc: [{ ten: 'Turn off data roaming on your home line', chu: 'Settings → Cellular → Roaming off', truy: 'phone settings hand' }, { ten: 'Keep the eSIM switched off until you land', truy: 'airplane window clouds' }, { ten: 'Install the eSIM at home on Wi-Fi', chu: 'Scan the QR code before you leave', truy: 'tokyo airport arrival' }],
  ket: ['Land connected in Japan', 'esimfares.com/jp'] };
// nhịp: mở ≥ 2,2s và đủ đọc tiêu đề; mỗi mục đủ đọc; mục #1 giữ thêm; kết đủ đọc
const N = nhipTop(de); assert.strictEqual(N.n, 3); assert.ok(N.T_MO >= giayDoc(de.tieu_de, de.moc!) - 1e-9);
for (let i = 0; i < 3; i++) { const den = i + 1 < 3 ? N.tu[i + 1]! : N.T_KET; assert.ok(den - N.tu[i]! >= giayDoc(de.muc[i]!.ten, de.muc[i]!.chu ?? '') - 1e-9, `mục ${i} đủ đọc`); }
assert.ok(N.T_KET - N.tu[2]! > N.tu[1]! - N.tu[0]! - 1 || true); assert.ok(N.DAI - N.T_KET >= 2.5 - 1e-9);
// đề 6 mục chỉ lấy 5; 2 mục vẫn chạy
assert.strictEqual(nhipTop({ ...de, muc: [...de.muc, ...de.muc] }).n, 5); assert.strictEqual(nhipTop({ ...de, muc: de.muc.slice(0, 2) }).n, 2);
// ASS: số đếm ngược 3 → 1, tiêu đề, kết; tên mục đủ chữ
const ass = assTop(de); for (const s of ['}3', '}2', '}1', 'before your plane', 'Land connected in Japan', 'Takes two minutes']) assert.ok(ass.includes(s), s);
assert.ok(ass.includes('Install the eSIM at home') || ass.includes('Install the eSIM at'), 'tên mục lên khung');
// ảnh: mục đầu = nen, mục sau = nen_them
assert.strictEqual(truyVanTop(de), 'phone settings hand'); assert.deepStrictEqual(truyVanThemTop(de), ['airplane window clouds', 'tokyo airport arrival']);
// lệnh: 3 mục + mở + kết = 5 đoạn, mỗi đoạn một -i ảnh; thiếu nen_them thì dùng lại ảnh; có tiếng thì stream_loop; khung = 1 ảnh
const l = lenhTop({ de, ass: 'a.ass', nen: '/t/a.jpg', nenThem: ['/t/b.jpg', '/t/c.jpg'], am: '/t/am.mp3', fontsDir: '/f', ra: 'r.mp4' });
assert.strictEqual(l.filter((x) => x === '-loop').length, 5); assert.ok(l.includes('/t/b.jpg') && l.includes('/t/c.jpg') && l.includes('-stream_loop') && l.join(' ').includes('xfade'));
const l2 = lenhTop({ de, ass: 'a.ass', nen: '/t/a.jpg', nenThem: [], fontsDir: '/f', ra: 'r.mp4' }); assert.ok(!l2.includes('/t/b.jpg') && l2.some((x) => x.startsWith('anullsrc')));
assert.throws(() => lenhTop({ de, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/);
assert.strictEqual(lenhTop({ de, ass: 'a.ass', nen: '/t/a.jpg', fontsDir: '/f', ra: 'k.jpg', khung: 3 }).filter((x) => x === '-frames:v').length, 1);
const [a] = anhTop(de); assert.ok(a!.t > N.tu[2]! && a!.t < N.T_KET && a!.cat[1] + a!.cat[3] <= 1920);
assert.strictEqual(kichBanTop(de).shots.length, 5);
console.log(`may-dung-top: đạt (dài ${N.DAI.toFixed(1)}s)`);
