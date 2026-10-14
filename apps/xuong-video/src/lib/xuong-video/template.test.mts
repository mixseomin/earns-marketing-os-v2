import assert from 'node:assert';
import { timO, dienChu, dienSau, dsOTemplate, oThieu, giaTriMau } from './template';

// dò ô: sâu, không trùng, theo thứ tự gặp, không phân biệt hoa thường
assert.deepStrictEqual(timO({ a: 'Hi {{nhan_vat}} {{ San_Pham }}', b: ['{{nhan_vat}}', { c: '{{goc}}' }], d: 3 }), ['nhan_vat', 'san_pham', 'goc']);
// điền: ô thiếu giá trị giữ nguyên
assert.strictEqual(dienChu('{{a}} và {{b}}', { a: 'Carol', b: ' ' }), 'Carol và {{b}}');
// mảng: phần tử là đúng một ô → nở theo dòng; chuỗi chứa ô giữa câu → điền thường
assert.deepStrictEqual(dienSau({ anh: ['{{anh}}', 'x.jpg'], mo: 'tank {{mau}}' }, { anh: 'a.jpg\n\nb.jpg', mau: 'nude' }), { anh: ['a.jpg', 'b.jpg', 'x.jpg'], mo: 'tank nude' });
// giữ số / null / boolean
assert.deepStrictEqual(dienSau({ n: 1, z: null, t: true }, { n: 'x' }), { n: 1, z: null, t: true });
// form: ô khai trước (theo thứ tự khai), ô chưa khai sau; khai mà không dùng → dung=false, không bắt điền
const ds = dsOTemplate({ o: { san_pham: { ten: 'Sản phẩm', mau: 'Sculpt Tank' }, thua: { ten: 'Thừa' } } }, ['nhan_vat', 'san_pham']);
assert.deepStrictEqual(ds.map((o) => [o.k, o.dung]), [['san_pham', true], ['thua', false], ['nhan_vat', true]]);
assert.deepStrictEqual(oThieu(ds, { san_pham: 'x' }).map((o) => o.k), ['nhan_vat']);
assert.deepStrictEqual(giaTriMau(ds), { san_pham: 'Sculpt Tank' });
console.log('template.ts: ok');
