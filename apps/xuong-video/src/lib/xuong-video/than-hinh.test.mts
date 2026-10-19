import assert from 'node:assert';
import { chuNguoi } from './prompt-khoi';
import { thanMacDinh, THAN_EN } from './kieu';
import { readFileSync } from 'node:fs';

const tay = (t: string) => t;
const nv = (khoi_3d: object, mo_ta = 'Asian woman, 24, long black hair') => ({ ten: 'Lâm Hạ', mo_ta, loai: 'nhan_vat', khoi_3d: { hinh: 'nguoi' as const, ...khoi_3d } });
// mặc định theo giới + tuổi
assert.equal(thanMacDinh('nu', 24), 'thon'); assert.equal(thanMacDinh('nam', 30), 'gon'); assert.equal(thanMacDinh('nam', 55), 'vua'); assert.equal(thanMacDinh(), 'vua');
assert.ok(chuNguoi(nv({ gioi: 'nu', tuoi: 24 }), { ao: [], chen: false, moTa: tay }).includes(THAN_EN.thon));
// khai riêng thắng mặc định; người béo nói rõ trong chữ
assert.ok(chuNguoi(nv({ gioi: 'nam', tuoi: 30, than: 'beo' }), { ao: [], chen: false, moTa: tay }).includes('heavyset'));
// mô tả đã tự ghi dáng → không chèn (khỏi mâu thuẫn); cận chèn chỉ tay → không chèn; đồ vật → không chèn
assert.ok(!chuNguoi(nv({ gioi: 'nu', tuoi: 24 }, 'Asian woman, petite'), { ao: [], chen: false, moTa: tay }).includes('build'));
assert.ok(!chuNguoi(nv({ gioi: 'nu', tuoi: 24 }), { ao: [], chen: true, moTa: tay }).includes('build'));
assert.ok(!chuNguoi({ ten: 'Ly', mo_ta: 'a cup', loai: 'do_vat' }, { ao: [], chen: false, moTa: tay }).includes('build'));
// MỘT bộ khoá với Blender (nguoi.py › THAN_HINH) + cùng luật mặc định (than_mac_dinh)
const py = readFileSync(new URL('../../../scripts/bo-set/mesh/nguoi.py', import.meta.url), 'utf8');
const khoaPy = [...(py.match(/THAN_HINH = \{([\s\S]*?)\}\n/)?.[1] ?? '').matchAll(/'(\w+)': \{/g)].map((m) => m[1]).sort();
assert.deepEqual(khoaPy, Object.keys(THAN_EN).sort(), 'khoá dáng Python ≠ TS');
assert.ok(/'thon' if gioi == 'nu' and t < 45 else 'gon' if gioi == 'nam' and t < 40 else 'vua'/.test(py), 'than_mac_dinh lệch thanMacDinh');
console.log('than-hinh.test: ok');
