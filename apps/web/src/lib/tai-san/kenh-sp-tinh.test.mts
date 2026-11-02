import assert from 'node:assert';
import { tinhSoKenh } from './kenh-sp-tinh';

const r = tinhSoKenh([
  { ngay: '2026-11-10', xem: 900, daDang: 5, nguoiDk: 40 },
  { ngay: '2026-11-03', xem: 300, daDang: 2, nguoiDk: 10 },
  { ngay: '2026-11-01', xem: 100, daDang: 1, nguoiDk: 3 },
], '2026-11-10');
assert.deepStrictEqual(r, { xem: 900, xem7: 600, nguoiDk: 40, nguoiDk7: 30, ngaySo: '2026-11-10' });
// máy mới đo: chưa có mốc 7 ngày trước → null, không phải 0
assert.deepStrictEqual(tinhSoKenh([{ ngay: '2026-11-02', xem: 0, daDang: 0, nguoiDk: 0 }], '2026-11-02'), { xem: 0, xem7: null, nguoiDk: 0, nguoiDk7: null, ngaySo: '2026-11-02' });
assert.deepStrictEqual(tinhSoKenh([], '2026-11-02'), { xem: null, xem7: null, nguoiDk: null, nguoiDk7: null, ngaySo: null });
// không đọc được người đăng ký ở một mốc → chênh null
assert.strictEqual(tinhSoKenh([{ ngay: '2026-11-10', xem: 5, daDang: 1, nguoiDk: 9 }, { ngay: '2026-11-03', xem: 1, daDang: 1, nguoiDk: null }], '2026-11-10').nguoiDk7, null);
import { lichSanXuat } from './kenh-sp-tinh';
// 02/11/2026 là Thứ Hai: 08:00 còn kịp lượt 09:30 hôm nay; 12:00 thì lượt kế là Thứ Tư
assert.deepStrictEqual(lichSanXuat([1, 3, 5], '09:30', '2026-11-02', '08:00', 2), { chu: 'Thứ Hai · Thứ Tư · Thứ Sáu · 09:30', ke: ['2026-11-02 09:30', '2026-11-04 09:30'] });
assert.deepStrictEqual(lichSanXuat([1, 3, 5], '09:30', '2026-11-02', '12:00', 2).ke, ['2026-11-04 09:30', '2026-11-06 09:30']);
assert.deepStrictEqual(lichSanXuat([], '09:30', '2026-11-02', '12:00'), { chu: null, ke: [] });
console.log('kenh-sp-tinh: 7/7 ok');
