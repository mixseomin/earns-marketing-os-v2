// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhip-hanh-dong.test.mts
import assert from 'node:assert';
import { lopImpact, nhipHanhDong, themTieng } from './nhip-hanh-dong';

const imp = lopImpact(2);
assert.deepStrictEqual(imp.map((l) => l.hu), ['chop', 'rung', 'zoom']);
assert.ok(imp.every((l) => l.nhom && l.nhom === imp[0]!.nhom), 'ba lớp một nhóm');
assert.deepStrictEqual(themTieng({ am_thanh: ['a', 'b', 'c'] }, 'dap').am_thanh, ['a', 'b', 'c'], 'đủ 3 tiếng thì thôi');
assert.deepStrictEqual(themTieng(undefined, 'dap').am_thanh, ['dap']);

const canh = [
  { id: 1, ky_thuat: { chuyen_canh: 'cat_soc' } },
  { id: 2, ky_thuat: { chuyen_canh: 'quat_chuyen' } },
  { id: 3, ky_thuat: {} },
  { id: 4, ky_thuat: { am_thanh: ['vo_kinh'] } },
  { id: 5, ky_thuat: { chuyen_canh: 'loe_trang' } },
  { id: 6, ky_thuat: {} },
];
const bd = [0, 2, 4, 6, 8, 10];
const r = nhipHanhDong(canh, bd, []);
// cắt sốc 1→2: impact ở 2s + đập ở shot 2 · quất 2→3: vút ở shot 3 · 3→4 cắt thường nhưng shot 4 có vỡ kính: impact, không thêm đập · loé 5→6: sting
assert.deepStrictEqual([...new Set(r.lop.map((l) => Math.round(l.tu)))], [2, 6]);
assert.deepStrictEqual(Object.fromEntries(r.kt.map((x) => [x.id, x.ky_thuat.am_thanh])), { 2: ['dap'], 3: ['vut'], 6: ['dap_doa'] });
// chạy lại trên kết quả: không nhân đôi
const lan2 = nhipHanhDong(canh.map((c) => ({ ...c, ky_thuat: r.kt.find((x) => x.id === c.id)?.ky_thuat ?? c.ky_thuat })), bd, r.lop);
assert.strictEqual(lan2.lop.length, 0); assert.strictEqual(lan2.kt.length, 0);
console.log('nhip-hanh-dong.test: ok');
