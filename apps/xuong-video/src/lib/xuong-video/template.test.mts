import assert from 'node:assert';
import { timO, dienChu, dienSau, dsOTemplate, oThieu, giaTriMau, nhomCuaO, theoNhom, khungTuShot } from './template';

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
// nhóm: đoán theo tên, khai tay thắng
assert.deepStrictEqual(['san_pham_hinh', 'anh_san_pham', 'anh_3', 'nhan_vat_ten', 'giong', 'tinh_huong', 'loi_ich_1', 'review'].map((k) => nhomCuaO(k)), ['san_pham', 'san_pham', 'anh', 'nhan_vat', 'nhan_vat', 'boi_canh', 'cau_chuyen', 'cau_chuyen']);
assert.strictEqual(nhomCuaO('review', { nhom: 'san_pham' }), 'san_pham');
assert.deepStrictEqual(theoNhom([{ k: 'review' }, { k: 'san_pham' }]).map((n) => [n.key, n.o.length]), [['san_pham', 1], ['cau_chuyen', 1]]);
// thứ tự: theo thu_tu, không theo thứ tự khoá object (jsonb xáo khoá)
assert.deepStrictEqual(dsOTemplate({ o: { link: { ten: 'L' }, san_pham: { ten: 'S' }, uu_dai: { ten: 'U' } }, thu_tu: ['san_pham', 'link'] }, ['link', 'san_pham', 'uu_dai']).map((o) => o.k), ['san_pham', 'link', 'uu_dai']);
// khung QC từ loại shot: ≥3 beat, có âm + dương, mỗi loại shot một phân cảnh; ưu đãi cuối phim = chốt
const k = khungTuShot([{ loai: 'hook' }, { loai: 'noi_dau' }, { loai: 'noi_dau' }, { loai: 'demo' }, { loai: 'bang_chung' }, { loai: 'uu_dai' }]);
assert.deepStrictEqual(k.beats.map((b) => [b.ten, b.cam_xuc]), [['Mở', 1], ['Vấn đề', -2], ['Giải quyết', 3], ['Chứng minh', 3], ['Chốt', 5]]);
assert.deepStrictEqual(k.phan_canh.map((p) => [p.ten, p.beat]), [['hook', 'Mở'], ['noi_dau', 'Vấn đề'], ['demo', 'Giải quyết'], ['bang_chung', 'Chứng minh'], ['uu_dai', 'Chốt']]);
console.log('template.ts: ok');
