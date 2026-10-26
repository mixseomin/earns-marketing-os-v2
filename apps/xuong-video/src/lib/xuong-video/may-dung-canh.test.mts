// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-canh.test.mts
import assert from 'node:assert';
import { amCanh, amTheoTruy, anhCanh, assCanh, dongMoc, kichBanCanh, lenhCanh, nhipCanh, DAI_MAX, DAI_MIN, type DeCanh } from './may-dung-canh';
import { giayDoc } from './may-dung-ass';

const de: DeCanh = { truy: 'rain on porch at night', moc: 'Long drive ahead? Hand this to whoever is riding shotgun', ket: ['Front Porch Puzzles', 'Save this for a rainy day'] };
// nhịp: cảnh 6–15s; dòng kết đứng đủ thời gian đọc
assert.strictEqual(nhipCanh({ truy: 'x', dai: 3 }).CANH, DAI_MIN); assert.strictEqual(nhipCanh({ truy: 'x', dai: 40 }).CANH, DAI_MAX); assert.strictEqual(nhipCanh({ truy: 'x' }).DAI, 10);
const N = nhipCanh(de); assert.ok(N.DAI - N.T_KET >= Math.min(2.5, giayDoc(...N.ket) - 1) - 1e-9, 'dòng kết đủ thời gian đọc');
// tiếng nền theo từ khoá
assert.strictEqual(amTheoTruy('rain on porch'), 'mua'); assert.strictEqual(amTheoTruy('santorini beach waves'), 'song'); assert.strictEqual(amTheoTruy('tokyo station morning'), 'pho'); assert.strictEqual(amTheoTruy('campfire'), 'lua');
for (const am of ['mua', 'gio', 'song', 'pho', 'lua', 'im'] as const) assert.ok(amCanh(am, 10).includes('afade=t=out'), am);
// ASS: câu móc ngắt ≤ 2 dòng, có dòng kết; không móc thì không vẽ dải
const ass = assCanh(de); assert.ok(ass.includes('Long drive ahead?') && ass.includes('Front Porch Puzzles') && ass.includes('Save this'));
// câu móc phải lên ĐỦ CHỮ (từ cuối có mặt), kể cả câu dài; ≤ 3 dòng; câu rất dài thu cỡ chữ
for (const m of [de.moc!, 'Landing in Greece for the islands? Get data sorted before Santorini', 'A very long hook sentence that keeps going and going well past one hundred characters so the template must shrink the font']) {
  const { dong, co } = dongMoc(m); assert.ok(dong.length <= 3 && dong.join(' ') === m.replace(/\s+/g, ' ').trim(), `câu móc bị cắt: ${m}`); assert.ok(co >= 24 && co <= 42);
  assert.ok(assCanh({ truy: 'x', moc: m }).includes(m.split(' ').pop()!), `từ cuối không lên khung: ${m}`);
}
assert.ok(dongMoc('A very long hook sentence that keeps going and going well past one hundred characters so the template must shrink the font').co < 42, 'câu dài phải thu chữ');
assert.ok(!assCanh({ truy: 'x' }).includes('\\p1}m 0 0'), 'không kết thì không phủ');
// lệnh: bắt buộc video nền; có loop + tiếng; khung = 1 ảnh
assert.throws(() => lenhCanh({ de, ass: 'a.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /VIDEO nền/);
const l = lenhCanh({ de, ass: 'a.ass', nen: '/t/nen.mp4', fontsDir: '/f', ra: 'r.mp4' });
assert.ok(l.includes('-stream_loop') && l.some((x) => x.includes('anoisesrc=color=white')) && l.includes('-shortest'));
assert.strictEqual(lenhCanh({ de, ass: 'a.ass', nen: '/t/nen.mp4', fontsDir: '/f', ra: 'k.jpg', khung: 3 }).filter((x) => x === '-frames:v').length, 1);
// ảnh tĩnh trong khung 1080×1920; kịch bản 2 shot khi có kết, 1 shot khi không
const [a] = anhCanh(de); assert.ok(a!.t < N.CANH && a!.cat[1] + a!.cat[3] <= 1920);
assert.strictEqual(kichBanCanh(de).shots.length, 2); assert.strictEqual(kichBanCanh({ truy: 'x' }).shots.length, 1);
console.log(`may-dung-canh: đạt (cảnh ${N.CANH}s, dài ${N.DAI.toFixed(1)}s)`);
