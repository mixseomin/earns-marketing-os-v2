import assert from 'node:assert';
import { trangThaiKhung, chanKhung, khoiCanKiem } from './khung';

const k = (url: string, dat: boolean, duyet_tay?: string) => ({ url, dat, loi: dat ? [] : [{ loai: 'vi_tri', mo_ta: 'Tango sau bàn phím', sua: '' }], luc: '', model: '', ...(duyet_tay ? { duyet_tay } : {}) });
assert.equal(trangThaiKhung({ keyframe_url: null, kiem_khung: null }), 'khong');
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: null }), 'chua');
assert.equal(trangThaiKhung({ keyframe_url: 'b', kiem_khung: k('a', true) }), 'chua');   // sinh lại keyframe → kết quả cũ hết hiệu lực
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: k('a', true) }), 'dat');
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: k('a', false) }), 'lech');
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: k('a', false, 'anh') }), 'tay');
assert.equal(chanKhung({ keyframe_url: 'a', kiem_khung: k('a', true) }), null);
assert.ok(chanKhung({ keyframe_url: 'a', kiem_khung: k('a', false) })!.includes('Tango sau bàn phím'));
assert.ok(chanKhung({ keyframe_url: 'b', kiem_khung: k('a', true) })!.includes('chưa qua'));
const ds = [
  { id: 1, phan_doan: 'A', keyframe_url: 'x1', kiem_khung: k('x1', true) }, { id: 2, phan_doan: 'A', keyframe_url: 'x2', kiem_khung: null },
  { id: 3, phan_doan: 'B', keyframe_url: 'x3', kiem_khung: k('x3', true) }, { id: 4, phan_doan: 'C', keyframe_url: null, kiem_khung: null },
];
assert.deepEqual(khoiCanKiem(ds).map((x) => x.map((c) => c.id)), [[1, 2]]);   // khối A có shot chưa kiểm → kiểm cả khối; B đã đạt; C chưa có hình
assert.deepEqual(khoiCanKiem(ds, true).map((x) => x.map((c) => c.id)), [[1, 2], [3]]);
console.log('khung.test: ok');
