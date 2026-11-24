import assert from 'node:assert';
import { ghepThuTu, thuTuNhom, xepCot, doiCho } from './thu-tu-cot';

const k = (cs: { key: string }[]) => cs.map((c) => c.key).join(',');
// giống bảng Thiết lập etp2: 2 cột ghim không nhóm, nhóm "nay" trước, "cr" sau, "qua", rồi b1; một cột không nhóm sau b1
const cols = [
  { key: 'id' }, { key: 'vd' },
  { key: 'n1', group: 'nay' }, { key: 'n2', group: 'nay' },
  { key: 'p', group: 'cr' },
  { key: 'q1', group: 'qua' }, { key: 'q2', group: 'qua' },
  { key: 't', group: 'b1' }, { key: 'x' },
];
// mặc định: không đổi gì
assert.equal(k(xepCot(cols)), 'id,vd,n1,n2,p,q1,q2,t,x');
// menu: thứ tự nhóm = thứ tự trên bảng, không phải thứ tự mảng groups; nhóm không cột ở cuối
assert.deepEqual(thuTuNhom(cols, ['cr', 'nay', 'qua', 'b1', 'rong']), ['nay', 'cr', 'qua', 'b1', 'rong']);
// đổi thứ tự nhóm: cột ghim giữ nguyên, cột không nhóm "x" đi theo b1
assert.equal(k(xepCot(cols, ['b1', 'cr', 'nay', 'qua'])), 'id,vd,t,x,p,n1,n2,q1,q2');
// đổi thứ tự cột trong nhóm
assert.equal(k(xepCot(cols, null, ['q2', 'q1'])), 'id,vd,n1,n2,p,q2,q1,t,x');
// nhóm mới (không có trong lưu) chèn sau nhóm đứng trước nó
assert.deepEqual(ghepThuTu(['a', 'b', 'c', 'd'], ['c', 'a']), ['c', 'd', 'a', 'b']);   // b mặc định sau a, d sau c
assert.deepEqual(ghepThuTu(['a', 'b'], ['zz', 'b']), ['a', 'b']);
// nhóm bị cắt nhiều khúc gom về khúc đầu
assert.equal(k(xepCot([{ key: 'a', group: 'A' }, { key: 'b', group: 'B' }, { key: 'c', group: 'A' }], ['B', 'A'])), 'b,a,c');
// dời chỗ
assert.deepEqual(doiCho(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
assert.deepEqual(doiCho(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c']);
assert.deepEqual(doiCho(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
console.log('thu-tu-cot ✓');
