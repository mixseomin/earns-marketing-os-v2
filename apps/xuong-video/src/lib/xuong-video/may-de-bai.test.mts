// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-de-bai.test.mts
import assert from 'node:assert';
import { kiemBaiViet } from './may-de';
const L = 'https://militarycalc.com/bah?utm_source=quora';
const tot = 'Short answer first. '.repeat(70) + ' See ' + L;
assert.deepStrictEqual(kiemBaiViet(tot, L), []);
assert.ok(kiemBaiViet('short ' + L, L).some((x) => x.includes('độ dài')));
assert.ok(kiemBaiViet(tot.replace(L, 'https://x.com'), L).some((x) => x.includes('link')));
assert.ok(kiemBaiViet(tot + ' — dash', L).some((x) => x.includes('gạch')));
assert.ok(kiemBaiViet(tot + ' we leverage it', L).some((x) => x.includes('từ máy')));
assert.deepStrictEqual(kiemBaiViet(tot + ' Vitaly said', L), [], 'Vitaly không phải vital');
console.log('kiemBaiViet: 6/6');
import { trangSuThat, ganUtm } from './may-de';
import { readFileSync } from 'node:fs';
const st = readFileSync(new URL('../../../su-that/militarycalc.md', import.meta.url), 'utf8');
assert.deepStrictEqual(trangSuThat(st), ['https://militarycalc.com/retirement', 'https://militarycalc.com/pay', 'https://militarycalc.com/bah', 'https://militarycalc.com/tsp']);
assert.deepStrictEqual(trangSuThat(null), []); assert.deepStrictEqual(trangSuThat('# x\nno pages'), []);
assert.strictEqual(ganUtm('https://a.com/b', 'utm_source=quora'), 'https://a.com/b?utm_source=quora'); assert.strictEqual(ganUtm('https://a.com/b?x=1', 'u=2'), 'https://a.com/b?x=1&u=2');
console.log('trangSuThat / ganUtm: 5/5');
