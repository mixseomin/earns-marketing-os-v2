import assert from 'node:assert';
import { danhGiaCong, danhGiaMotCong, loiTaiKhoanCong, type CongDong, type SucKhoeCong } from './cong-luat';
const goc: SucKhoeCong = { luc: '', tai_khoan: { id: 'acct_x', ten: 'X', nuoc: 'US', tien_te: 'usd', nhan_tien: true, rut_tien: true, thieu: [], qua_han: [], ly_do_khoa: null, han: null, lich_rut: null },
  so_du: { kha_dung: 0, cho: 0, tien_te: 'usd' }, ky90: { thanh_cong: 1000, tien: 50000, that_bai: 0, chan_rui_ro: 0, hoan: 10, tien_hoan: 500, dispute: 2, dispute_mo: 0, efw: 0, doc_het: true },
  ky30: { thanh_cong: 300, that_bai: 10 }, rut: [], webhook: [{ url: 'https://a.com/w', trang_thai: 'enabled', so_su_kien: 3, cua_minh: true }], su_kien_treo: 0 };
assert.strictEqual(danhGiaCong(goc).muc, 'tot');                                                           // 0,2% dispute, 1% hoàn, 3,2% thất bại
assert.strictEqual(danhGiaCong({ ...goc, ky90: { ...goc.ky90, dispute: 6 } }).muc, 'vang');               // 0,6%
assert.strictEqual(danhGiaCong({ ...goc, ky90: { ...goc.ky90, dispute: 8 } }).muc, 'do');                 // 0,8%
assert.strictEqual(danhGiaCong({ ...goc, ky90: { ...goc.ky90, dispute: 6 } }, { dispute_vang: 1 }).muc, 'tot');   // ngưỡng sửa tay
assert.strictEqual(danhGiaCong({ ...goc, tai_khoan: { ...goc.tai_khoan, nhan_tien: false } }).muc, 'do');
assert.strictEqual(danhGiaCong({ ...goc, su_kien_treo: 4 }).muc, 'vang');
assert.strictEqual(danhGiaCong({ ...goc, ky90: { ...goc.ky90, thanh_cong: 0, dispute: 0, hoan: 0 }, ky30: { thanh_cong: 0, that_bai: 0 } }).ty_le.dispute, null);   // chưa có giao dịch: không chia cho 0
console.log('danhGiaCong: đúng');
const tay: CongDong = { id: 9, loai: 'payoneer', vai: 'nhan', ma: 'p', ten: 'Payoneer', ghiChu: null, taiKhoan: 'a@b.com', link: null, veCongId: null, phapNhanId: 1, trangThaiTay: 'on',
  kiemLuc: '2026-09-25T00:00:00Z', nguong: {}, sucKhoe: null, docLuc: null, loi: null, shops: [], lichSu: [] };
const bay = Date.parse('2026-10-02T00:00:00Z');
assert.strictEqual(danhGiaMotCong(tay, bay).muc, 'tot');                                         // kiểm 7 ngày trước, bình thường
assert.strictEqual(danhGiaMotCong({ ...tay, kiemLuc: '2026-08-01T00:00:00Z' }, bay).muc, 'vang');   // quá 30 ngày chưa kiểm
assert.strictEqual(danhGiaMotCong({ ...tay, kiemLuc: null }, bay).muc, 'vang');
assert.strictEqual(danhGiaMotCong({ ...tay, trangThaiTay: 'khoa' }, bay).muc, 'do');
assert.strictEqual(loiTaiKhoanCong('ht***82@gmail.com'), null);
assert.strictEqual(loiTaiKhoanCong('Payoneer ID 45123456'), null);                              // mã ngắn: được
assert.notStrictEqual(loiTaiKhoanCong('4111 1111 1111 1111'), null);                            // số thẻ: chặn
assert.notStrictEqual(loiTaiKhoanCong('STK 0123456789012'), null);                              // số tài khoản ngân hàng: chặn
assert.notStrictEqual(loiTaiKhoanCong('password: abc'), null);
console.log('danhGiaMotCong + loiTaiKhoanCong: đúng');
{
  const { danhGiaPhapNhan } = await import('./cong-luat');
  const pn = { id: 1, ten: 'Mellowstep LLC', loai: 'llc_us', nuoc: 'US', bang: 'Wyoming', maSoCuoi: '1234', nguoiDaiDien: null, daiLy: null, ngayLap: null,
    hanBaoCao: '2026-12-01', trangThai: 'hoat_dong', link: null, ghiChu: null, shops: ['mellowstep'] };
  const b = Date.parse('2026-10-02T00:00:00Z');
  const cg = { ...tay, id: 2, loai: 'stripe', phapNhanId: 1, sucKhoe: { ...goc, tai_khoan: { ...goc.tai_khoan, phap_ly: { loai: 'company', ten: 'Mellowstep, LLC' } } } };
  assert.strictEqual(danhGiaPhapNhan(pn, [cg], b).muc, 'tot');                                             // tên Stripe 'Mellowstep, LLC' = sổ 'Mellowstep LLC'
  assert.strictEqual(danhGiaPhapNhan({ ...pn, hanBaoCao: '2026-10-20' }, [cg], b).muc, 'vang');            // còn 18 ngày
  assert.strictEqual(danhGiaPhapNhan({ ...pn, hanBaoCao: '2026-09-01' }, [cg], b).muc, 'do');              // quá hạn
  assert.strictEqual(danhGiaPhapNhan({ ...pn, trangThai: 'ngung' }, [cg], b).muc, 'do');                   // ngừng mà còn cổng đứng tên
  const lech = { ...cg, sucKhoe: { ...cg.sucKhoe, tai_khoan: { ...cg.sucKhoe.tai_khoan, phap_ly: { loai: 'individual', ten: 'Nguyen Van A' } } } };
  assert.strictEqual(danhGiaPhapNhan(pn, [lech], b).muc, 'vang');                                          // Stripe đứng tên người khác
  assert.strictEqual(danhGiaMotCong({ ...tay, phapNhanId: null }, bay).muc, 'vang');                       // cổng chưa gán pháp nhân
  console.log('danhGiaPhapNhan: đúng');
}
