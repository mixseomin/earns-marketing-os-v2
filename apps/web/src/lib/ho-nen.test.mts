// node_modules/.bin/tsx apps/web/src/lib/ho-nen.test.mts
import assert from 'node:assert';
import { hoCua, pkCua } from './ho-nen';
import { dangHop, DANG_BAI } from './dang-bai';

for (const [nen, ho, pk] of [['facebook', 'facebook', 'facebook'], ['fb_anh', 'facebook', 'facebook'], ['fb_link', 'facebook', 'facebook'], ['facebook:580', 'facebook', 'facebook'],
  ['x', 'x', 'twitter'], ['x_anh', 'x', 'twitter'], ['x_link', 'x', 'twitter'], ['x_poll', 'x', 'twitter'], ['tiktok_anh', 'tiktok', 'tiktok'], ['youtube', 'youtube', 'youtube'], ['dailymotion', 'dailymotion', 'dailymotion']] as const) {
  assert.strictEqual(hoCua(nen), ho, `hoCua(${nen})`); assert.strictEqual(pkCua(nen), pk, `pkCua(${nen})`);
}
// dạng hợp sản phẩm: ngách 'moi' luôn hợp; ngách riêng phải khớp; máy đang có còn phải có họ nền máy đang đăng
const ds = DANG_BAI;
const scam = dangHop(ds, { ho: new Set(['facebook', 'x']), ngach: ['scam'], laMay: true });
assert.ok(scam.every((d) => (d.ngach.includes('moi') || d.ngach.includes('scam')) && d.nen.some((h) => h === 'facebook' || h === 'x')), 'dạng hợp máy scam');
assert.ok(!scam.some((d) => d.ngach.length === 1 && d.ngach[0] === 'cao-tuoi'), 'dạng chỉ cho người lớn tuổi không vào máy scam');
const uv = dangHop(ds, { ho: new Set(), ngach: ['hoc'], laMay: false });
assert.ok(uv.length > scam.length / 2 && uv.some((d) => d.ngach.includes('hoc')), 'ứng viên chưa có kênh: không lọc theo nền');
assert.strictEqual(dangHop(ds, { ho: new Set(), ngach: ['hoc'], laMay: true }).length, 0, 'máy không có nền nào thì không dạng nào hợp');
console.log(`ho-nen: 11 nơi đăng · dangHop: scam ${scam.length}/${ds.length}, ứng viên học ${uv.length}`);
