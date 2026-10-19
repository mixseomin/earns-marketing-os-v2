import assert from 'node:assert';
import { theTenTap, lopTheTen, TIEN_TO_THE_TEN } from './the-ten';

const nv = [{ id: 1, ten: 'Lâm Hạ', loai: 'nhan_vat' }, { id: 2, ten: 'Vivian', loai: 'nhan_vat' }, { id: 9, ten: 'Văn phòng', loai: 'boi_canh' }];
const sh = (id: number, nhan_vat: number[], co_canh: string, vai = 'hanh_dong', khung?: string[]) => ({ id, nhan_vat, phat_s: 3, ky_thuat: { co_canh, vai }, ...(khung ? { may_3d: { khung } } : {}) });
// toàn cảnh có cả hai → chưa đặt; cận Vivian một mình → thẻ Vivian; hai người, khung đầu là Hạ → thẻ Hạ.
const canh = [sh(1, [1, 2, 9], 'ws'), sh(2, [2, 9], 'mcu'), sh(3, [1, 2], 'two', 'hanh_dong', ['Lâm Hạ', 'Vivian'])];
const r = theTenTap(canh, [0, 3, 6], nv, []);
const ten = r.lop.filter((l) => !l.ten!.endsWith(' · vai')).map((l) => [l.chu, l.tu]);
assert.deepEqual(ten, [['Lâm Hạ', 6.3], ['Vivian', 3.3]]);
assert.ok(r.lop.every((l) => l.tu >= 0 && l.den > l.tu && l.y > 0.4 && l.y < 0.7), 'giữa khung: không đè chữ màn (trên) / phụ đề (dưới)');
assert.deepEqual(theTenTap(canh, [0, 3, 6], nv, r.lop).lop, [], 'bấm lại không nhân đôi');
assert.deepEqual(theTenTap([sh(1, [1], 'insert', 'chi_tiet'), sh(2, [1], 'ews')], [0, 3], nv, []).khongCho, ['Lâm Hạ'], 'chỉ có đặc tả / toàn cảnh: báo không có chỗ');
// vai chỉ khi truyền chucDanh (tiểu sử có bí mật — không tự rút)
assert.equal(lopTheTen('Vivian', 0, 3).length, 1); assert.equal(lopTheTen('Vivian', 0, 3, 'Trưởng phòng hành chính').length, 2);
assert.ok(lopTheTen('A', 10, 1.2).every((l) => l.den <= 11.2 && l.den - l.tu >= 1), 'shot ngắn: vẫn đứng ≥ 1 s, không tràn quá shot nhiều');
assert.ok(lopTheTen('A', 0, 3).every((l) => l.ten!.startsWith(TIEN_TO_THE_TEN) && l.nhom));
console.log('the-ten.test: ok');
