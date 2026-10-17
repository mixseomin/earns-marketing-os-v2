// Tự kiểm câu hỏi kiểm khung kiểu DSG: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cau-hoi-khung.test.mts
import assert from 'node:assert';
import { cauHoiKhung, loiTuDapAn } from './cau-hoi-khung';

const nv = [
  { ten: 'Lâm Hạ', loai: 'nhan_vat', mo_ta: 'East Asian woman, 24', bien_the: [{ ten: 'Vest trắng', mo_ta: 'Tailored white power suit' }] },
  { ten: 'Phòng họp', loai: 'boi_canh', mo_ta: 'Boardroom in afternoon light: walnut walls' },
] as never;
const canh = { ky_thuat: { co_canh: 'ws' }, dan_dung: { mo: 'Hạ in the doorway' }, khung_xam: { kiem: [{ nhan_vat: 'Lâm Hạ', bat_buoc: true, trong_khung: true, cao_khung_pt: 44, bi_che_boi: [] }], thay: [] },
  may_3d: { dat: [0, -300, 60], nhin: [0, 0, 120], ong_kinh: 28, vi_tri: [{ ten: 'Lâm Hạ', tam: [0, 0, 0], huong: 0, trang_phuc: 'Vest trắng' }] } } as never;
const ds = cauHoiKhung({ canh, nhanVat: nv });
const ma = ds.map((c) => c.ma);
// có câu bối cảnh, khoảnh khắc mở, có mặt, bộ đồ (phụ thuộc có mặt), hướng mặt, số người, góc máy thấp, cỡ khung, chữ lạ
for (const k of ['boi_canh', 'mo', 'co:Lâm Hạ', 'ao:Lâm Hạ', 'mat:Lâm Hạ', 'so_nguoi', 'goc', 'co_canh', 'chu']) assert.ok(ma.includes(k), k);
assert.match(ds.find((c) => c.ma === 'ao:Lâm Hạ')!.hoi, /white power suit/); assert.match(ds.find((c) => c.ma === 'goc')!.hoi, /THẤP/);
// phụ thuộc: thiếu Hạ → chỉ một lỗi "thiếu", không thêm lỗi bộ đồ / hướng mặt
assert.deepEqual(loiTuDapAn(ds, { 'co:Lâm Hạ': false, 'ao:Lâm Hạ': false, 'mat:Lâm Hạ': false }).map((l) => l.loai), ['thieu']);
// có Hạ mà vest đen → lỗi tạo hình
assert.deepEqual(loiTuDapAn(ds, { 'co:Lâm Hạ': true, 'ao:Lâm Hạ': false }).map((l) => l.loai), ['nhan_dang']);
console.log('cau-hoi-khung: ok');
