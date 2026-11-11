import assert from 'node:assert';
import { doiChieu, heSo, hieuChinh, mauCpm, mocMau, nen, ngayThiTruong, saiSo, type SoNgay } from './etp-thi-truong';

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

assert.strictEqual(hieuChinh(so, '2026-11-11'), null);   // chưa có ngày mùa đã khép → hệ số gốc
const mua: Record<string, SoNgay> = { '2026-11-15': { chi: 1, cpm: 20, cpc: 0.6, roi: 0 } };
for (let i = 16; i <= 22; i++) mua[`2026-11-${i}`] = { chi: 1, cpm: 20 * (1 + 0.05 * 0.5), cpc: 0.6, roi: 0 };   // thật chỉ tăng nửa hệ số giả định (×1,025 thay ×1,05)
const hc = hieuChinh(mua, '2026-11-23')!; assert.ok(hc.n >= 2 && Math.abs(hc.k - 0.5) < 0.6, JSON.stringify(hc));
const bf2 = ngayThiTruong(mua, '2026-11-23', '2026-11-27', '2026-11-27')[0]!; assert.ok(bf2.heSo < 1.8 && bf2.heSo > 1, String(bf2.heSo));   // BF hạ theo thực tế
const dc = doiChieu(so, { '2026-11-09': { '2026-11-10': { cpm: 20, h: 1 } }, '2026-11-07': { '2026-11-10': { cpm: 24.2, h: 1, dl: true } } }, '2026-11-11');
assert.strictEqual(dc.dong.length, 1); assert.ok(Math.abs(dc.dong[0]!.doan[1]!.lech - (20 - 22) / 22 * 100) < 1e-9);
assert.strictEqual(dc.dong[0]!.doan[3]!.dl, true); assert.strictEqual(dc.dong[0]!.doan[7], null); assert.ok(Math.abs(dc.tb[3]! - 10) < 1e-9);   // đoán trước 1 / 3 ngày, dựng lại đánh dấu
assert.strictEqual(mauCpm(16, 20), 'hsla(140, 75%, 45%, 0.42)');
assert.strictEqual(mauCpm(32, 20), 'hsla(0, 75%, 45%, 0.42)');
assert.strictEqual(mauCpm(null, 20), 'transparent');
console.log('✓ etp-thi-truong: hệ số mùa + nguồn · nền hôm qua · mốc màu 30 ngày · sai số đo trên số thật · biên sai theo khoảng cách · không đoán ROI · màu');
