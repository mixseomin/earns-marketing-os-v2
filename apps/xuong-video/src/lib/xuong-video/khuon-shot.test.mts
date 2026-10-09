// Tự kiểm phần thuần của thư viện khuôn shot: gỡ tên riêng + đoạn prompt. (Phần ghi DB kiểm bằng script dựng phim trên box.)
import assert from 'node:assert';
import { tongQuat, taKhuon } from './khuon-shot';
const nv = [{ ten: 'Ông Tom', loai: 'nhan_vat' }, { ten: 'Phòng khách Mỹ', loai: 'boi_canh' }, { ten: 'Chậu nước', loai: 'dao_cu' }] as never;
assert.equal(tongQuat('Ông Tom đứng trong Phòng khách Mỹ cầm JettJeans3 jeans, cạnh chậu nước', nv, 'JettJeans3 jeans'), '{nhân vật} đứng trong {bối cảnh} cầm {sản phẩm}, cạnh {đạo cụ}');
assert.equal(tongQuat('ông tom cười', nv), '{nhân vật} cười');
assert.equal(tongQuat('Không có tên riêng', nv, ''), 'Không có tên riêng');
const ds = [{ id: 1, loai: 'demo', ten: 'Vò vải rồi thả', hinh: 'Hai tay vò mạnh vải {sản phẩm} rồi thả ra, cận', chu_man: '100% không nhăn', giay: 2, ky_thuat: {}, nguon: '', phim_id: null, dung: 3 }] as never;
const p = taKhuon(ds);
assert.ok(p.includes('[Demo]') && p.includes('Vò vải rồi thả') && p.includes('(×3)') && p.includes('chữ: "100% không nhăn"'), p);
assert.equal(taKhuon([]), '');
console.log('khuon-shot.test: ok');
