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
