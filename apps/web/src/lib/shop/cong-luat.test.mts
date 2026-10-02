import assert from 'node:assert';
import { danhGiaCong, type SucKhoeCong } from './cong-luat';
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
