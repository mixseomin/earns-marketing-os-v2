// Tự kiểm bộ kiểm 3D cho phim AI: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kiem-ai-3d.test.mts
import assert from 'node:assert';
import { xuyenVat, monDoiTayNho, thieuVat3d, matNguoiNoi, vatDeoThieuNguoi, doNhanDangChuaAnh, vatDuocNhacAi, chongNguoi, tuaHong, vungTrong, datLat, theSai, boCucNguoiNgoai } from './kiem-ai-3d';

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
// CHỒNG HÌNH: hai người hộp trùng gần hết (Trần ngay sau lưng Hạ dọc trục máy, #15) → chặn; đứng hai bên → qua; người bị khai là đồ (loai khác) không tính
const kh = (k1: number[], k2: number[]) => ({ hanh_dong: '', prompt_anh: '', khung_xam: { kiem: [{ nhan_vat: 'Hạ', bat_buoc: true, trong_khung: true, cao_khung_pt: 13, bi_che_boi: [], khung: k1 }, { nhan_vat: 'Trần', bat_buoc: true, trong_khung: true, cao_khung_pt: 13, bi_che_boi: [], khung: k2 }] } }) as never;
const nv2 = [{ ten: 'Hạ', loai: 'nhan_vat' }, { ten: 'Trần', loai: 'nhan_vat' }] as never;
assert.equal(chongNguoi(kh([0.46, 0.42, 0.54, 0.6], [0.47, 0.42, 0.55, 0.59]), nv2).length, 1);
assert.equal(chongNguoi(kh([0.2, 0.3, 0.4, 0.9], [0.55, 0.3, 0.75, 0.88]), nv2).length, 0);
const khCo = (c1: number, c2: number) => ({ hanh_dong: '', prompt_anh: '', khung_xam: { kiem: [{ nhan_vat: 'Hạ', bat_buoc: true, trong_khung: true, cao_khung_pt: c1, bi_che_boi: [], khung: [0, 0.25, 0.66, 1] }, { nhan_vat: 'Trần', bat_buoc: true, trong_khung: true, cao_khung_pt: c2, bi_che_boi: [], khung: [0.06, 0, 1, 1] }] } }) as never;
assert.equal(chongNguoi(khCo(60, 81), nv2).length, 0);   // tiền – hậu cảnh (#13): người trước to hẳn → qua
assert.equal(chongNguoi(khCo(78, 81), nv2).length, 1);   // cùng cỡ, trùng → chặn
assert.equal(chongNguoi(kh([0.46, 0.42, 0.54, 0.6], [0.47, 0.42, 0.55, 0.59]), [{ ten: 'Hạ', loai: 'nhan_vat' }, { ten: 'Trần', loai: 'dao_cu' }] as never).length, 0);
// DÁNG TỰA: chống bàn mà tay cách mặt đỡ 45 cm → chặn; chạm (không có tua_hong) → qua
const tua = (h?: number) => ({ hanh_dong: '', prompt_anh: '', khung_xam: { kiem: [{ nhan_vat: 'Thần', bat_buoc: true, trong_khung: true, cao_khung_pt: 60, bi_che_boi: [], tua_hong: h }] } }) as never;
assert.equal(tuaHong(tua(45)).length, 1); assert.equal(tuaHong(tua()).length, 0);
// KHOẢNH KHẮC MỞ nhắc vật mà 3D không thấy → chặn cả ở cú qua vai (không phải cỡ cận)
const moVat = (thay: string[]) => ({ hanh_dong: '', prompt_anh: '', ky_thuat: { co_canh: 'ots' }, dan_dung: { mo: 'Hạ looks at her phone' }, khung_xam: { thay: thay.map((t) => ({ ten: t, pt: 20, hop: [0, 0, 1, 1], tien: false })) },
  may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }, { ten: 'Điện thoại', tam: [0, -10, 110], huong: 0, cam: 'Hạ' }]) }) as never;
assert.equal(thieuVat3d(moVat(['Hạ']), nv, set).length, 1); assert.equal(thieuVat3d(moVat(['Hạ', 'Điện thoại']), nv, set).length, 0);
// VÙNG TRỐNG: 70% khung có vật (máy trên trần, #14) → chặn; 97% → qua
const tr = (pt: number) => ({ hanh_dong: '', prompt_anh: '', khung_xam: { thay: [{ ten: 'Tường', pt, hop: [0, 0, 1, 1], tien: false }] } }) as never;
assert.equal(vungTrong(tr(70)).length, 1); assert.equal(vungTrong(tr(97)).length, 0);
// ĐỒ LẬT mà 3D đứng thẳng (#17) → chặn; khai nghieng → qua
const lat = (ng?: number) => ({ hanh_dong: '', prompt_anh: '', dan_dung: { mo: 'cup tumbling just above the carpet, coffee spilling out' }, may_3d: may([{ ten: 'Ly', tam: [0, 0, 20], huong: 0, ...(ng ? { nghieng: ng } : {}) }]) }) as never;
assert.equal(datLat(lat()).length, 1); assert.equal(datLat(lat(70)).length, 0);
// MÓN MỞ SHOT QUÁ NHỎ (#11): điện thoại trải 3% khung ở cú qua vai → chặn; 12% → qua
const nho = (w: number) => ({ hanh_dong: '', prompt_anh: '', ky_thuat: { co_canh: 'ots' }, dan_dung: { mo: 'Hạ looks at her phone' }, khung_xam: { thay: [{ ten: 'Hạ', pt: 30, hop: [0, 0, 0.5, 1], tien: false }, { ten: 'Điện thoại', pt: 1, hop: [0.5, 0.5, 0.5 + w, 0.52], tien: false }] },
  may_3d: may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }, { ten: 'Điện thoại', tam: [0, -10, 110], huong: 0, cam: 'Hạ' }]) }) as never;
assert.equal(thieuVat3d(nho(0.03), nv, set).length, 1); assert.equal(thieuVat3d(nho(0.12), nv, set).length, 0);
// THẺ LIÊN KẾT: tên sai → chặn; đạo cụ không có trong 3D → chặn; đúng + có chỗ đứng → qua; nhân vật ngoài khung được nhắc → qua
const the = (mo: string, vi: object[]) => ({ hanh_dong: '', prompt_anh: '', dan_dung: { mo }, may_3d: may(vi) }) as never;
assert.equal(theSai(the('Hạ looks at {Điện thoai}', [{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }]), nv, set).length, 1);
assert.equal(theSai(the('Hạ looks at {Điện thoại}', [{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }]), nv, set).length, 1);
assert.deepEqual(theSai(the('{Hạ} looks at {Điện thoại} on the {Bàn}', [{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }, { ten: 'Điện thoại', tam: [0, -10, 110], huong: 0, cam: 'Hạ' }]), nv, set), []);
// ĐỒ CỐ ĐỊNH CỦA SET có đối tượng cùng tên (đối tượng xuyên suốt, #132 "Thang máy 1"): chỗ đứng do set đặt → không đòi vi_tri; vẫn bắt nếu set không bật nó
assert.deepEqual(theSai(the('Hạ waits at the {Bàn}', [{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }]), [...nv, { id: 99, ten: 'Bàn', loai: 'dao_cu', mo_ta: 'desk' } as never], set), []);
// BỐ CỤC GỌI TÊN người không có trong khung 3D (#12 qua vai Vivian mà 3D không có Vivian) → chặn; có trong khung → qua
const bcn = (trong: boolean) => ({ hanh_dong: '', prompt_anh: '', dan_dung: { bo_cuc: 'Reverse close-up on Hạ over Vivian’s shoulder' }, khung_xam: { kiem: [{ nhan_vat: 'Hạ', trong_khung: true, cao_khung_pt: 60, bi_che_boi: [] }, { nhan_vat: 'Vivian', trong_khung: trong, cao_khung_pt: 40, bi_che_boi: [] }] } }) as never;
const nvB = [{ ten: 'Hạ', loai: 'nhan_vat', mo_ta: '' }, { ten: 'Vivian', loai: 'nhan_vat', mo_ta: '' }] as never;
assert.equal(boCucNguoiNgoai(bcn(false), nvB).length, 1); assert.equal(boCucNguoiNgoai(bcn(true), nvB).length, 0);
assert.equal(boCucNguoiNgoai({ ...(bcn(false) as object), dan_dung: { bo_cuc: 'Low close-up on Hạ looking down at Vivian; MCU from Vivian’s side' } } as never, nvB).length, 0);   // hướng nhìn / chỗ máy
console.log('kiem-ai-3d: ok');

// ĐI XUYÊN ĐỒ RẮN (#132 #19): đi qua tấm cửa đóng → chặn; bật cửa mở (thay_cho) → qua; đứng trong bàn → chặn; mặt nền không tính
{
  const st = { du_lieu: { vat: [{ ten: 'Cửa', hinh: 'hop', mau: '#999', tam: [0, 100, 0], co: [100, 4, 220], en: 'steel door' }, { ten: 'Cửa mở', hinh: 'hop', mau: '#999', tam: [60, 100, 0], co: [6, 4, 220], tuy_chon: true, thay_cho: 'Cửa' },
    { ten: 'Sàn', hinh: 'hop', mau: '#222', tam: [0, 100, -2], co: [400, 400, 2], nen: true }, { ten: 'Bàn', hinh: 'hop', mau: '#444', tam: [200, 0, 0], co: [100, 60, 75], en: 'desk' }] } } as never;
  const di = (them?: string[]) => ({ hanh_dong: '', prompt_anh: '', may_3d: { ...may([{ ten: 'Hạ', tam: [0, 0, 0], den: [0, 180, 0], huong: 0 }]), ...(them ? { them } : {}) } }) as never;
  assert.equal(xuyenVat(di(), st).length, 1); assert.equal(xuyenVat(di(['Cửa mở']), st).length, 0);
  // thẻ {Cửa} khi shot bật 'Cửa mở' (thay_cho) = cùng cái cửa ở trạng thái khác → không báo 'đồ set không bật'
  assert.deepEqual(theSai({ hanh_dong: '', prompt_anh: '', dan_dung: { mo: 'Hạ steps into the {Cửa}' }, may_3d: { ...may([{ ten: 'Hạ', tam: [0, 0, 0], huong: 0 }]), them: ['Cửa mở'] } } as never, nv, st), []);
  assert.equal(xuyenVat({ hanh_dong: '', prompt_anh: '', may_3d: may([{ ten: 'Hạ', tam: [200, 0, 0], huong: 0 }]) } as never, st).length, 1);
}
// MÓN ĐỔI TAY QUÁ NHỎ (#132 #15): thẻ 8,6 cm có den, máy 24 mm cách 5,8 m → ~0,9% → chặn; máy 28 mm cách 1,7 m → ~4% → qua; người di chuyển không tính
{
  const the = [{ ten: 'Thẻ', loai: 'dao_cu', mo_ta: 'badge', khoi_3d: { hinh: 'hop', co: [5.5, 0.4, 8.6], mau: '#fff' } }] as never[];
  const sh = (dat: number[], ong: number) => ({ hanh_dong: '', prompt_anh: '', may_3d: { ...may([{ ten: 'Hạ', tam: [0, 0, 0], den: [50, 0, 0], huong: 0 }, { ten: 'Thẻ', tam: [0, 0, 120], den: [80, 0, 110], huong: 0 }]), dat, nhin: [0, 0, 100], ong_kinh: ong } }) as never;
  assert.equal(monDoiTayNho(sh([0, -577, 160], 24), the).length, 1); assert.equal(monDoiTayNho(sh([0, -170, 150], 28), the).length, 0);
}
