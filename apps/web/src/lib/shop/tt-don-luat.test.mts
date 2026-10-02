import assert from 'node:assert';
import { tomTtDon, type TtDon } from './tt-don-luat';

const goc: TtDon = { cong: 'Stripe', pi: 'pi_1', charge: 'ch_1', tien: 49.99, phi: 1.75, thuc_nhan: 48.24, tien_te: 'USD',
  tien_ve: { trang_thai: 'pending', kha_dung_tu: '2026-10-04' }, rut: null, hoan: [], dispute: null, efw: false, luc: '2026-10-02T00:00:00Z' };
assert.strictEqual(tomTtDon(goc, 'Stripe').nhan, 'chờ về · 04/10');
assert.strictEqual(tomTtDon({ ...goc, tien_ve: { trang_thai: 'available', kha_dung_tu: '2026-10-04' } }, 'Stripe').nhan, 'khả dụng ở Stripe');
assert.strictEqual(tomTtDon({ ...goc, tien_ve: { trang_thai: 'available', kha_dung_tu: '2026-10-04' }, rut: { id: 'po_1', trang_thai: 'paid', ngay_ve: '2026-10-06' } }, 'Stripe').nhan, 'đã về · 06/10');
// đòi lại tiền đứng trên trạng thái tiền
assert.strictEqual(tomTtDon(goc, 'Stripe', true).muc, 'vang');                                                                   // khách xin hoàn qua form
assert.strictEqual(tomTtDon({ ...goc, hoan: [{ id: 're_1', so: 10, trang_thai: 'succeeded', ly_do: null, luc: '2026-10-03T00:00:00Z' }] }, 'Stripe').nhan, 'hoàn một phần $10.00');
assert.strictEqual(tomTtDon({ ...goc, hoan: [{ id: 're_1', so: 49.99, trang_thai: 'succeeded', ly_do: 'requested_by_customer', luc: '2026-10-03T00:00:00Z' }] }, 'Stripe').nhan, 'đã hoàn toàn bộ');
assert.strictEqual(tomTtDon({ ...goc, efw: true }, 'Stripe').muc, 'do');
assert.strictEqual(tomTtDon({ ...goc, dispute: { id: 'dp_1', so: 49.99, trang_thai: 'needs_response', ly_do: 'fraudulent', han: null } }, 'Stripe').nhan, 'dispute · fraudulent');
// chưa đọc / không có mã giao dịch
assert.strictEqual(tomTtDon(null, 'Stripe').nhan, 'Stripe · chưa đọc');
assert.strictEqual(tomTtDon(null, null).nhan, '—');
console.log('tomTtDon: đúng');
{
  const { ruiRoDon } = await import('./tt-don-luat');
  assert.strictEqual(ruiRoDon(null, null, 'US').muc, null);                                                       // chưa có gì để chấm
  assert.strictEqual(ruiRoDon({ ...goc, rui_ro: { muc: 'normal', diem: 12, ghi: null } }, 'US', 'US').muc, 'thap');
  assert.strictEqual(ruiRoDon({ ...goc, rui_ro: { muc: 'normal', diem: 12, ghi: null } }, 'VN', 'US').muc, 'vua'); // IP khác nước giao
  assert.strictEqual(ruiRoDon({ ...goc, rui_ro: { muc: 'highest', diem: 88, ghi: null } }, 'US', 'US').muc, 'cao');
  assert.strictEqual(ruiRoDon({ ...goc, efw: true }, 'US', 'US').muc, 'cao');
  console.log('ruiRoDon: đúng');
}
