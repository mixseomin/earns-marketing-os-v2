// Tự kiểm xếp ảnh tham chiếu (#1256): sản phẩm đứng đầu, bản đồ ảnh đúng số, trần 10 ảnh.
import assert from 'node:assert';
import { xepThamChieu, ghepPromptAnh, KHONG_CHU } from './sinh-anh';
const nv = [
  { id: 1, loai: 'nhan_vat', ten: 'Ông Tom', mo_ta: 'đàn ông 62', anh_ref: ['t1', 't2', 't3'] },
  { id: 2, loai: 'san_pham', ten: 'JettJeans3', mo_ta: 'quần', anh_ref: ['p1', 'p2', 'p3', 'p4'] },
  { id: 3, loai: 'boi_canh', ten: 'Phòng khách', mo_ta: '', anh_ref: ['b1'] },
] as never;
const r = xepThamChieu(nv);
assert.deepEqual(r.urlRef, ['p1', 'p2', 'p3', 't1', 't2', 'b1']);
assert.ok(r.banDoRef.startsWith('Reference images: images 1–3 = the PRODUCT "JettJeans3"'), r.banDoRef);
assert.ok(r.banDoRef.includes('images 4–5 = Ông Tom') && r.banDoRef.includes('image 6 = Phòng khách (the location)'), r.banDoRef);
// biến thể của người đứng trước ảnh gốc
const r2 = xepThamChieu(nv, (v) => (v.ten === 'Ông Tom' ? { anh_url: 'bt1' } : undefined));
assert.deepEqual(r2.urlRef.slice(3, 5), ['bt1', 't1']);
// trần 10 ảnh
const nhieu = Array.from({ length: 6 }, (_, i) => ({ id: i, loai: 'nhan_vat', ten: `N${i}`, mo_ta: '', anh_ref: ['a', 'b'] })) as never;
assert.equal(xepThamChieu(nhieu).urlRef.length, 10);
assert.deepEqual(xepThamChieu([] as never), { urlRef: [], banDoRef: '' });
assert.ok(ghepPromptAnh('x', '', []).includes(KHONG_CHU));
console.log('sinh-anh.test: ok');
