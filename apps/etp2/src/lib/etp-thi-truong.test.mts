import assert from 'node:assert';
import { heSo, mauCpm, mocMau, nen, ngayThiTruong, saiSo, type SoNgay } from './etp-thi-truong';

const so: Record<string, SoNgay> = {};
for (let i = 1; i <= 10; i++) so[`2026-11-${String(i).padStart(2, '0')}`] = { chi: 1000, cpm: 20, cpc: 0.6, roi: 20 };
so['2026-11-10'] = { chi: 1000, cpm: 22, cpc: 0.66, roi: 25 };   // hôm qua
so['2026-11-11'] = { chi: 400, cpm: 23, cpc: 0.8, roi: 27 };     // hôm nay, chưa khép

assert.deepStrictEqual(heSo('2026-11-27'), { h: 1.8, le: 'Black Friday', nguon: true });
assert.deepStrictEqual(heSo('2026-11-29'), { h: 1.5, le: null, nguon: false });
assert.strictEqual(heSo('2027-01-03').le, null);   // tên lễ chỉ ở ngày đầu khoảng
assert.deepStrictEqual(heSo('2026-10-25'), { h: 1, le: null, nguon: true });

const n = nen(so, '2026-11-11')!;
assert.strictEqual(n.d, '2026-11-10'); assert.strictEqual(n.cpm, 22);   // nền = hôm qua (bỏ hôm nay chưa khép)
assert.strictEqual(nen({}, '2026-11-11'), null);
assert.ok(Math.abs(mocMau(so, '2026-11-11')! - 20.2) < 1e-9);          // mốc màu = TB 30 ngày đã khép

const s = saiSo(so, '2026-11-11');
assert.ok(s[1] != null && s[1] < 2, String(s[1]));                     // số phẳng → sai nhỏ (chỉ bước 20 → 22)
assert.strictEqual(saiSo({ '2026-11-01': so['2026-11-01']! }, '2026-11-11')[1], null);   // < 5 lần đo: không bịa biên sai

const ds = ngayThiTruong(so, '2026-11-11', '2026-11-10', '2026-11-27');
assert.strictEqual(ds[0]!.du, false); assert.strictEqual(ds[1]!.cpm, 23); // số thật (cả hôm nay)
const bf = ds.at(-1)!;
assert.strictEqual(bf.du, true); assert.ok(Math.abs(bf.cpm! - 22 * 1.8) < 1e-9);   // hôm qua × hệ số BF
assert.strictEqual(bf.roi, null); assert.strictEqual(bf.sai, s[7]);                // xa ≥ 4 ngày → biên sai 7 ngày
assert.strictEqual(ds[2]!.sai, s[3]);                                                // 12/11: cách nền 2 ngày → biên 3 ngày
assert.strictEqual(ngayThiTruong(so, '2026-11-11', '2026-10-01', '2026-10-01')[0]!.cpm, null);

assert.strictEqual(mauCpm(16, 20), 'hsla(140, 75%, 45%, 0.42)');
assert.strictEqual(mauCpm(32, 20), 'hsla(0, 75%, 45%, 0.42)');
assert.strictEqual(mauCpm(null, 20), 'transparent');
console.log('✓ etp-thi-truong: hệ số mùa + nguồn · nền hôm qua · mốc màu 30 ngày · sai số đo trên số thật · biên sai theo khoảng cách · không đoán ROI · màu');
