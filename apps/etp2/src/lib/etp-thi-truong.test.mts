import assert from 'node:assert';
import { heSo, mauCpm, nen, ngayThiTruong, type SoNgay } from './etp-thi-truong';

const so: Record<string, SoNgay> = {};
for (let i = 1; i <= 10; i++) so[`2026-11-${String(i).padStart(2, '0')}`] = { chi: 1000, cpm: 20, cpc: 0.6, roi: 20 };
so['2026-11-11'] = { chi: 400, cpm: 23, cpc: 0.8, roi: 27 };   // hôm nay, chưa khép

assert.deepStrictEqual(heSo('2026-11-27'), { h: 1.6, le: 'Black Friday' });
assert.deepStrictEqual(heSo('2026-11-29'), { h: 1.45, le: null });
assert.deepStrictEqual(heSo('2027-01-03'), { h: 0.8, le: null });   // tên lễ chỉ ở ngày đầu khoảng
assert.strictEqual(heSo('2026-10-25').h, 1);

const n = nen(so, '2026-11-11')!;
assert.strictEqual(n.n, 7); assert.ok(Math.abs(n.cpm - 20) < 1e-9, String(n.cpm));   // nền bỏ ngày hôm nay (chưa khép)
assert.strictEqual(nen({ '2026-11-01': so['2026-11-01']! }, '2026-11-11'), null);   // < 3 ngày: không đoán

const ds = ngayThiTruong(so, '2026-11-11', '2026-11-10', '2026-11-27');
assert.strictEqual(ds[0]!.du, false); assert.strictEqual(ds[1]!.cpm, 23);           // số thật (cả hôm nay)
assert.strictEqual(ds.at(-1)!.du, true); assert.ok(Math.abs(ds.at(-1)!.cpm! - 32) < 1e-9);   // 20 × 1,6
assert.strictEqual(ds.at(-1)!.roi, null);                                           // không đoán ROI
assert.strictEqual(ngayThiTruong(so, '2026-11-11', '2026-10-01', '2026-10-01')[0]!.cpm, null);   // ngày cũ không số: trống, không đoán

assert.strictEqual(mauCpm(16, 20), 'hsla(140, 75%, 45%, 0.42)');   // rẻ = xanh
assert.strictEqual(mauCpm(32, 20), 'hsla(0, 75%, 45%, 0.42)');     // đắt = đỏ
assert.strictEqual(mauCpm(null, 20), 'transparent');
console.log('✓ etp-thi-truong: hệ số mùa · nền bỏ hôm nay · thiếu số · số thật / dự đoán / trống · không đoán ROI · màu');
