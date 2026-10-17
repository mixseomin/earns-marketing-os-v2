// Tự kiểm bảng trang phục: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/bang-trang-phuc.test.mts
import assert from 'node:assert';
import { kiemBangTrangPhuc } from './bang-trang-phuc';
const pc = [{ ten: 'Sáng', ngay: 'D1', noi: 'Văn phòng', luc: '09:00' }, { ten: 'Chiều', ngay: 'D1', noi: 'Phòng họp', luc: '15:00' }, { ten: 'Đêm', ngay: 'D2', noi: 'Căn hộ', luc: '23:00 đêm' }];
const ha = { ten: 'Hạ', loai: 'nhan_vat', khoi_3d: { hinh: 'nguoi', co: [40, 24, 165], mau: '#e8c4a8' }, bien_the: [
  { id: 1, nhan_vat_id: 1, nhom: 'trang_phuc', ten: 'Sơ mi', mo_ta: '', anh_url: 'u', dung_cho: ['văn phòng', 'phòng họp'] },
  { id: 2, nhan_vat_id: 1, nhom: 'trang_phuc', ten: 'Vest', mo_ta: '', anh_url: 'u', dung_cho: ['phòng họp'] }] } as never;
const bang = [{ nv: 'Hạ', ngay: 'D1', tu_canh: 'Sáng', bien_the: 'Sơ mi' }, { nv: 'Hạ', ngay: 'D1', tu_canh: 'Chiều', bien_the: 'Vest' }];
const may = (tp: string, den?: string) => ({ dat: [0, -300, 150], nhin: [0, 0, 100], ong_kinh: 35, vi_tri: [{ ten: 'Hạ', tam: [0, 0, 0], trang_phuc: tp, ...(den ? { trang_phuc_den: den } : {}) }] }) as never;
assert.deepEqual(kiemBangTrangPhuc({ phan_doan: 'Sáng' }, may('Sơ mi'), pc, bang, [ha]), []);
assert.equal(kiemBangTrangPhuc({ phan_doan: 'Sáng' }, may('Vest'), pc, bang, [ha]).length, 2);            // sai bảng + sai hoàn cảnh (vest chỉ dùng cho phòng họp)
assert.deepEqual(kiemBangTrangPhuc({ phan_doan: 'Chiều' }, may('Sơ mi', 'Vest'), pc, bang, [ha]), []);     // đổi đồ ở cảnh bảng có dòng đổi
assert.equal(kiemBangTrangPhuc({ phan_doan: 'Đêm' }, may('Sơ mi'), pc, bang, [ha]).length, 1);            // ngày D2 chưa có dòng
assert.equal(kiemBangTrangPhuc({ phan_doan: 'Sáng' }, may('Sơ mi'), pc, [], [ha]).length, 1);             // phim người thật chưa có bảng
console.log('bang-trang-phuc: ok');
