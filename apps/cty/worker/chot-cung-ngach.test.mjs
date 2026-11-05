// tự kiểm: kết luận CÙNG NGÁCH theo QC gốc nghiêng về chặt — node apps/cty/worker/chot-cung-ngach.test.mjs
import assert from 'node:assert';
import { chotCungNgach, khoaQc } from './cham-dang.mjs';
const so = {}, k = khoaQc({ ma: 'ynt', qc: '11' });
let o = { cung_ngach: true }; assert.equal(chotCungNgach(so, k, o), true); assert.equal(so[k], true, 'lần đầu ghi sổ');
o = { cung_ngach: false }; assert.equal(chotCungNgach(so, k, o), true); assert.equal(so[k], false, 'cùng → khác: hạ xuống');
o = { cung_ngach: true }; assert.equal(chotCungNgach(so, k, o), false); assert.equal(o.cung_ngach, false, 'đã khác ngách thì giữ');
o = {}; assert.equal(chotCungNgach({}, k, o), false); assert.equal(o.cung_ngach, undefined, 'Ngọc không trả cung_ngach: không ghi');
console.log('chot-cung-ngach: đạt');
