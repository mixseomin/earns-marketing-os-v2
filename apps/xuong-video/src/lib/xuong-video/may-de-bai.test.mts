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
// tệp militarycalc thêm trang theo thời gian (b47a51087: +6 trang VA / BAS / COLA…) — kiểm các trang gốc còn đó + mọi dòng là URL trần, không khoá cứng cả danh sách
for (const u of ['https://militarycalc.com/retirement', 'https://militarycalc.com/pay', 'https://militarycalc.com/bah', 'https://militarycalc.com/tsp', 'https://militarycalc.com/disability']) assert.ok(trangSuThat(st).includes(u), u);
assert.ok(trangSuThat(st).every((u) => /^https:\/\/militarycalc\.com\/[a-z-]+$/.test(u)));
assert.deepStrictEqual(trangSuThat(null), []); assert.deepStrictEqual(trangSuThat('# x\nno pages'), []);
assert.strictEqual(ganUtm('https://a.com/b', 'utm_source=quora'), 'https://a.com/b?utm_source=quora'); assert.strictEqual(ganUtm('https://a.com/b?x=1', 'u=2'), 'https://a.com/b?x=1&u=2');
console.log('trangSuThat / ganUtm: 5/5');
// 19/11/2026: tệp sự thật ratesbyroom khai đủ trang chủ đề; câu tìm Quora nhận dòng trang KÈM mô tả (dongTrangSuThat), trang chọn vẫn chỉ URL (trangSuThat)
import { dongTrangSuThat } from './may-de';
const rb = readFileSync(new URL('../../../su-that/ratesbyroom-scam-or-real.md', import.meta.url), 'utf8');
assert.ok(trangSuThat(rb).length >= 10 && trangSuThat(rb).every((u) => /^https:\/\/ratesbyroom\.com\/[a-z-]+\/$/.test(u)), 'mọi trang ratesbyroom là URL trần');
assert.ok(trangSuThat(rb).includes('https://ratesbyroom.com/hotel-fake-fee-scam/'));
assert.ok(dongTrangSuThat(rb).every((d) => /^https:\/\/\S+ — \S/.test(d)), 'dòng trang có mô tả sau URL');
assert.strictEqual(dongTrangSuThat(rb).length, trangSuThat(rb).length); assert.deepStrictEqual(dongTrangSuThat(null), []);
console.log('dongTrangSuThat: 5/5');
