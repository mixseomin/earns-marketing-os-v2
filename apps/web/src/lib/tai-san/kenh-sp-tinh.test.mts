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
import { lichKenh } from './kenh-sp-tinh';
{ const o = lichKenh({ videos: [{ slug: 'a', ten: 'A', ngayLam: '2026-11-02', trangThai: 'da_dang', ngayDang: '2026-11-03', url: null, xem: 5, giay: 170 },
    { slug: 'b', ten: 'B', ngayLam: '2026-11-02', trangThai: 'cho_cham', ngayDang: null, url: null, xem: null, giay: 170 }],
  ke: { lichTap: 'x', gioDang: '21:00', tapKe: ['2026-11-04 09:30'], dangLam: null, lichDang: [{ ngay: '2026-11-04', gio: '20:00', nen: 'youtube', tieuDe: 'B' }] } });
  assert.deepStrictEqual(o.map((x) => `${x.ngay} ${x.loai} ${x.so}`), ['2026-11-02 lam 2', '2026-11-03 dang 1', '2026-11-04 sx 1', '2026-11-04 hen 1']); }
import { cayKeHoach } from './kenh-sp-tinh';
{ const v = (slug: string, trangThai: 'duyet' | 'cho_cham' | 'da_dang') => ({ slug, ten: slug.toUpperCase(), ngayLam: null, trangThai, ngayDang: null, url: null, xem: null, giay: null });
  const ke = { lichTap: 'Thứ Hai · 09:30', gioDang: '21:00', tapKe: ['2026-11-04 09:30'], lichDang: [], dangLam: { id: 'tap-x', luc: '2026-11-02T15:00:00Z', buoc: 'dựng (giọng + hình)', so: 5, tong: 8, buoc_luc: '2026-11-02T15:20:00Z' } };
  const r = cayKeHoach({ videos: [v('a', 'duyet'), v('b', 'cho_cham'), v('c', 'da_dang')], ke }, Date.parse('2026-11-02T15:25:00Z'));
  assert.deepStrictEqual(r.map((x) => x.chu), ['▶ Đang sản xuất', 'bước 5/8 · dựng (giọng + hình) · 5 phút', '🗓 Lịch', '📤 A', '⏳ B', '🛠 làm tập mới']);
  assert.strictEqual(r[1]!.phu, 'tap-x');   // phút tính từ lúc vào bước; mã tập ở phần phụ
  assert.strictEqual(r[5]!.phu, 'Thứ Tư 04/11 09:30');
  // không có gì trong lò, không lịch → cây kế hoạch rỗng (chỉ còn khối Đã làm)
  assert.deepStrictEqual(cayKeHoach({ videos: [v('c', 'da_dang')], ke: { ...ke, dangLam: null, tapKe: [] } }), []);
  // tập hỏng giữa chừng → dòng đỏ mang lỗi
  assert.strictEqual(cayKeHoach({ videos: [], ke: { ...ke, dangLam: { ...ke.dangLam, loi: 'hỏng ở bước dựng (mã 1)' } } })[1]!.chu, '✗ hỏng ở bước dựng (mã 1)'); }
// một bước đứng quá 30 phút → đỏ, ghi "đứng"
{ const ke = { lichTap: null, gioDang: null, tapKe: [], lichDang: [], dangLam: { id: 't', luc: '2026-11-02T15:00:00Z', buoc: 'viết kịch bản', so: 2, tong: 8, buoc_luc: '2026-11-02T15:00:00Z' } };
  const r = cayKeHoach({ videos: [], ke }, Date.parse('2026-11-02T15:45:00Z'))[1]!; assert.strictEqual(r.chu, 'bước 2/8 · viết kịch bản · ⚠ đứng 45 phút'); assert.strictEqual(r.mau, 'var(--bad)'); }
console.log('kenh-sp-tinh: 14/14 ok');
