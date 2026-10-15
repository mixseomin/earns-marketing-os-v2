// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cta.test.mts
import assert from 'node:assert';
import { THU_VIEN_CTA, chonCta, kieuShotSauCta, CTA_MAC_DINH } from './cta';

assert.ok(THU_VIEN_CTA.length >= 4, 'thư viện có nhiều kiểu');
for (const c of THU_VIEN_CTA) {
  assert.ok(c.nguon.length && c.nguon.every((n) => n.loai === 'qc_thang' && n.ma), `${c.key}: mỗi kiểu phải có nguồn QC thắng`);
  assert.ok(c.kieu.mau, `${c.key}: có màu chữ`);
}
assert.strictEqual(new Set(THU_VIEN_CTA.map((c) => c.key)).size, THU_VIEN_CTA.length, 'key không trùng');
// chưa phim nào → kiểu đầu; kiểu đầu đã dùng → kiểu kế
assert.strictEqual(chonCta({}).key, CTA_MAC_DINH.key);
assert.strictEqual(chonCta({ [THU_VIEN_CTA[0]!.key]: 1 }).key, THU_VIEN_CTA[1]!.key);
// mọi kiểu đã dùng 1 lần trừ kiểu cuối → kiểu cuối
assert.strictEqual(chonCta(Object.fromEntries(THU_VIEN_CTA.slice(0, -1).map((c) => [c.key, 1]))).key, THU_VIEN_CTA.at(-1)!.key);
// chỉ shot CTA đổi kiểu
const k = THU_VIEN_CTA[1]!;
assert.deepStrictEqual(kieuShotSauCta('end_card', { co: 0.05 }, k), k.kieu);
assert.deepStrictEqual(kieuShotSauCta('hook', { co: 0.05 }, k), { co: 0.05 });
console.log('cta.test: ok');
