// Tự kiểm bộ kiểm 3D cho phim AI: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kiem-ai-3d.test.mts
import assert from 'node:assert';
import { thieuVat3d, matNguoiNoi, vatDeoThieuNguoi, doNhanDangChuaAnh, vatDuocNhacAi } from './kiem-ai-3d';

const set = { du_lieu: { vat: [{ ten: 'Bàn', hinh: 'hop', mau: '#333', en: 'walnut desk' }, { ten: 'Máy photo', hinh: 'hop', mau: '#eee', en: 'large white office copier printer' },
  { ten: 'Tranh', hinh: 'hop', mau: '#888', en: 'large ink-wash painting of mountains' }] } } as never;
const nv = [{ ten: 'Hạ', loai: 'nhan_vat', mo_ta: '' }, { ten: 'Điện thoại', loai: 'dao_cu', mo_ta: 'black smartphone' }] as never;
const may = (vi: object[], dat = [0, -200, 150], nhin = [0, 0, 150]) => ({ dat, nhin, ong_kinh: 50, vi_tri: vi, khung: ['Hạ'] });
// ĐỦ: nhắc bút mà 3D không có → chặn; nhắc điện thoại có món ở chỗ đứng → qua
assert.equal(thieuVat3d({ hanh_dong: 'Hạ cầm bút ký', prompt_anh: '', may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }]) } as never, nv, set).length, 1);
assert.equal(thieuVat3d({ hanh_dong: 'Hạ nhìn điện thoại', prompt_anh: '', may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }, { ten: 'Điện thoại', tam: [0, -10, 110], huong: 0, cam: 'Hạ' }]) } as never, nv, set).length, 0);
// Báo nhầm cũ: động từ "plants herself", "screen-left", tên Việt "Máy photo" không phải vật / không phải ảnh
assert.deepEqual(vatDuocNhacAi({ hanh_dong: '', prompt_anh: '', dan_dung: { dien: 'Vivian plants herself in the path, screen-left, watching' } } as never), []);
assert.equal(doNhanDangChuaAnh({ hanh_dong: '', prompt_anh: '' } as never, set).length, 1);   // chỉ Tranh, không tính Máy photo
assert.equal(doNhanDangChuaAnh({ hanh_dong: '', prompt_anh: '', khung_xam: { thay: [{ ten: 'Bàn', pt: 40, hop: [0, 0, 1, 1], tien: false }] } } as never, set).length, 0);   // tranh không lọt khung
// NGƯỜI NÓI: máy sau lưng người đang nói (khung mở) → chặn; trước mặt → qua; toàn cảnh nghiêng mặt → qua
const noi = { nhan_vat: 'Hạ', dien_xuat: '', loi: 'Chào.' };
assert.equal(matNguoiNoi({ hanh_dong: '', prompt_anh: '', thoai: [noi], ky_thuat: { co_canh: 'mcu' }, may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 180 }]) } as never).length, 1);
assert.equal(matNguoiNoi({ hanh_dong: '', prompt_anh: '', thoai: [noi], ky_thuat: { co_canh: 'mcu' }, may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }]) } as never).length, 0);
assert.equal(matNguoiNoi({ hanh_dong: '', prompt_anh: '', thoai: [noi], ky_thuat: { co_canh: 'ws' }, may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 90 }]) } as never).length, 0);
// VẬT ĐEO: cận chỉ khai món đồ đang trên người → chặn; khai cả người → qua
const deo = (khung: string[]) => ({ hanh_dong: '', prompt_anh: '', ky_thuat: { co_canh: 'insert' }, may_3d: { ...may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }, { ten: 'Vòng', tam: [10, 0, 80], huong: 0, cam: 'Hạ' }]), khung } }) as never;
assert.equal(vatDeoThieuNguoi(deo(['Vòng'])).length, 1); assert.equal(vatDeoThieuNguoi(deo(['Vòng', 'Hạ'])).length, 0);
console.log('kiem-ai-3d: ok');
