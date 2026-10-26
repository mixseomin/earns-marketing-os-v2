// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/am-nen.test.mts
import assert from 'node:assert';
import { amTheoTruy, chonAm, LOAI_AM, urlAm } from './am-nen';

assert.strictEqual(amTheoTruy('rain on wooden porch night'), 'mua', 'mưa thắng đêm'); assert.strictEqual(amTheoTruy('santorini sea waves cliff'), 'song', 'sóng thắng vách đá');
assert.strictEqual(amTheoTruy('tokyo station morning'), 'pho'); assert.strictEqual(amTheoTruy('campfire in the mountains'), 'lua'); assert.strictEqual(amTheoTruy('old kitchen table'), 'rung');
for (const l of LOAI_AM) { const a = chonAm(l, 'slug-a')!; assert.ok(a && /^https:\/\/assets\.mixkit\.co\/.*-preview\.mp3$/.test(a.url), l); }
assert.strictEqual(chonAm('im', 'x'), null);
assert.deepStrictEqual(chonAm('mua', 'canh-37192-rain-porch'), chonAm('mua', 'canh-37192-rain-porch'), 'cùng slug cùng bản');
assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => chonAm('mua', s)!.id)).size > 1, 'slug khác thì xoay bản');
assert.strictEqual(urlAm(2390), 'https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3');
console.log(`am-nen: ${LOAI_AM.length} loại tiếng, đạt`);
