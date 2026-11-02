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
  assert.deepStrictEqual(r.map((x) => x.chu), ['▶ Đang sản xuất: tap-x', 'bước 5/8 · dựng (giọng + hình) · 5 phút', '🗓 Lịch', '📤 A', '⏳ B', '🛠 làm tập mới']);
  assert.strictEqual(r[1]!.phu, 'tap-x');   // phút tính từ lúc vào bước; mã tập ở phần phụ
  assert.strictEqual(r[5]!.phu, 'Thứ Tư 04/11 09:30');
  // không có gì trong lò, không lịch → cây kế hoạch rỗng (chỉ còn khối Đã làm)
  assert.deepStrictEqual(cayKeHoach({ videos: [v('c', 'da_dang')], ke: { ...ke, dangLam: null, tapKe: [] } }), []);
  // tập hỏng giữa chừng → dòng đỏ mang lỗi
  assert.strictEqual(cayKeHoach({ videos: [], ke: { ...ke, dangLam: { ...ke.dangLam, loi: 'hỏng ở bước dựng (mã 1)' } } })[1]!.chu, '✗ hỏng ở bước dựng (mã 1)'); }
// một bước đứng quá 30 phút → đỏ, ghi "đứng"
{ const ke = { lichTap: null, gioDang: null, tapKe: [], lichDang: [], dangLam: { id: 't', luc: '2026-11-02T15:00:00Z', buoc: 'viết kịch bản', so: 2, tong: 8, buoc_luc: '2026-11-02T15:00:00Z' } };
  const r = cayKeHoach({ videos: [], ke }, Date.parse('2026-11-02T15:45:00Z'))[1]!; assert.strictEqual(r.chu, 'bước 2/8 · viết kịch bản · ⚠ đứng 45 phút'); assert.strictEqual(r.mau, 'var(--bad)'); }
import { tomLoTrinh, cayLoTrinh } from './kenh-sp-tinh';
{ const lt = { cap_nhat: '2026-11-02', giai_doan: [
    { ma: 'G0', ten: 'Chốt', viec: 'chốt mảng', anh: 'chốt', trang_thai: 'xong' as const },
    { ma: 'G1', ten: 'Playlist', viec: 'tầng playlist', anh: 'không', trang_thai: 'cho_anh' as const },
    { ma: 'G2', ten: 'Nhận diện', viec: 'logo', anh: 'duyệt ảnh', trang_thai: 'chua' as const }] };
  const t = tomLoTrinh(lt);
  assert.deepStrictEqual([t.xong, t.tong, t.hienTai?.ma, t.chu], [1, 3, 'G1', '🧭 G1 Playlist · chờ anh']);
  const c = cayLoTrinh(lt);
  assert.deepStrictEqual(c.map((x) => x.chu), ['🧭 Lộ trình (1/3 xong)', '✅ G0 Chốt · xong', '⏸ G1 Playlist · chờ anh', '○ G2 Nhận diện · chưa tới']);
  assert.strictEqual(c[2]!.phu, 'tầng playlist');                 // anh "không" → không thêm đuôi
  assert.strictEqual(c[3]!.phu, 'logo · anh: duyệt ảnh');
  assert.strictEqual(tomLoTrinh({ giai_doan: [{ ma: 'G0', ten: 'x', viec: '', anh: '', trang_thai: 'xong' }] }).chu, '🧭 xong lộ trình'); }
import { cayPlaylist, locGap } from './kenh-sp-tinh';
{ const c = cayPlaylist({ giai_doan: [], playlist: [
    { ma: 'b', ten: 'Sau', trang_thai: 'sau', khi: 'G10' },
    { ma: 'a', ten: 'Đầu', trang_thai: 'de_xuat', mo_dau: true, ho_hinh: 'engraving', ngay: 'Thứ 2', trang_dich: 'ZR' }] });
  assert.deepStrictEqual(c.map((x) => x.chu), ['📂 Playlist (2)', '📝 Đầu · đề xuất · mở đầu', '○ Sau · mở sau · G10']);
  assert.strictEqual(c[1]!.phu, 'hình engraving · ngày Thứ 2 · → ZR');
  assert.deepStrictEqual(cayPlaylist({ giai_doan: [] }), []);
  const r = ['A', 'a1', 'a2', 'B', 'b1', 'C', 'c1'];
  assert.deepStrictEqual(locGap(r, (x) => (x === x.toUpperCase() ? x : null), new Set(['A', 'C'])), ['A', 'B', 'b1', 'C']); }
import { lichKenhHs, soTheoPlaylist, cayPlaylistThat } from './kenh-sp-tinh';
{ // 02/11/2026 Thứ Hai 12:00 — kênh một playlist giữ đúng chữ lịch cũ; hai playlist ghi tên + gộp lượt kế
  const h1 = { gio_tap: '09:30', playlist: [{ ma: 'full-stories', ten: 'Full Stories', lich_tap: [1, 3, 5] }] };
  const l1 = lichKenhHs(h1, '2026-11-02', '12:00', 2);
  assert.deepStrictEqual([l1.chu, l1.ke], ['Thứ Hai · Thứ Tư · Thứ Sáu · 09:30', ['2026-11-04 09:30', '2026-11-06 09:30']]);
  assert.deepStrictEqual(lichKenhHs({ lich_tap: [3], gio_tap: '09:30' }, '2026-11-02', '12:00', 1), { chu: 'Thứ Tư · 09:30', ke: ['2026-11-04 09:30'], theo: {} });
  const h2 = { gio_tap: '09:30', playlist: [{ ma: 'a', ten: 'A', lich_tap: [1, 5] }, { ma: 'b', ten: 'B', lich_tap: [3], gio_tap: '14:00' }] };
  const l2 = lichKenhHs(h2, '2026-11-02', '12:00', 3);
  assert.deepStrictEqual([l2.chu, l2.ke], ['A: Thứ Hai · Thứ Sáu · 09:30 | B: Thứ Tư · 14:00', ['2026-11-04 14:00', '2026-11-06 09:30', '2026-11-09 09:30']]);
  const v = (playlist: string | null, trangThai: 'da_dang' | 'cho_cham', xem: number | null) => ({ playlist, trangThai, xem });
  const s = soTheoPlaylist(h2.playlist, l2.theo, [v('a', 'da_dang', 100), v('a', 'cho_cham', null), v(null, 'da_dang', 7), v('xoa', 'da_dang', 3)]);
  assert.deepStrictEqual(s.map((p) => [p.ma, p.tap, p.daDang, p.xem]), [['a', 2, 1, 100], ['b', 0, 0, null], ['', 2, 2, 10]]);
  assert.deepStrictEqual(soTheoPlaylist([], {}, [v(null, 'da_dang', 1)]), []);
  const c = cayPlaylistThat(s);
  assert.deepStrictEqual(c.map((x) => x.chu), ['📂 Playlist (2)', '▶ A', '▶ B', '· chưa gắn playlist']);
  assert.strictEqual(c[1]!.phu, 'làm tập Thứ Hai · Thứ Sáu · 09:30 · 2 tập · 1 đã đăng · 100 xem · chưa có playlist YouTube (G7)'); }
console.log('kenh-sp-tinh: 17/17 ok');
