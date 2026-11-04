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
  ke: { lichTap: 'x', gioDang: '21:00', tapKe: ['2026-11-04 09:30'], dangLam: [], lichDang: [{ ngay: '2026-11-04', gio: '20:00', nen: 'youtube', tieuDe: 'B' }] } });
  assert.deepStrictEqual(o.map((x) => `${x.ngay} ${x.loai} ${x.so}`), ['2026-11-02 lam 2', '2026-11-03 dang 1', '2026-11-04 sx 1', '2026-11-04 hen 1']); }
import { cayKeHoach } from './kenh-sp-tinh';
{ const v = (slug: string, trangThai: 'duyet' | 'cho_cham' | 'da_dang') => ({ slug, ten: slug.toUpperCase(), ngayLam: null, trangThai, ngayDang: null, url: null, xem: null, giay: null });
  const ke = { lichTap: 'Thứ Hai · 09:30', gioDang: '21:00', tapKe: ['2026-11-04 09:30'], lichDang: [], dangLam: [{ id: 'tap-x', luc: '2026-11-02T15:00:00Z', buoc: 'dựng (giọng + hình)', so: 5, tong: 8, buoc_luc: '2026-11-02T15:20:00Z' }] };
  const r = cayKeHoach({ videos: [v('a', 'duyet'), v('b', 'cho_cham'), v('c', 'da_dang')], ke }, Date.parse('2026-11-02T15:25:00Z'));
  assert.deepStrictEqual(r.map((x) => x.chu), ['▶ Đang sản xuất', 'tap-x', '🗓 Lịch', '📤 A', '⏳ B', '🛠 làm tập mới']);
  assert.strictEqual(r[1]!.phu, 'bước 5/8 · dựng (giọng + hình) · 5 phút · tap-x');   // phút tính từ lúc vào bước; mã tập cuối phần phụ
  assert.deepStrictEqual(r[1]!.dongHo, { so: 5, tong: 8, loi: false });   // đồng hồ nằm ở dòng của tập
  assert.strictEqual(r[5]!.phu, 'Thứ Tư 04/11 09:30');
  // không có gì trong lò, không lịch → cây kế hoạch rỗng (chỉ còn khối Đã làm)
  assert.deepStrictEqual(cayKeHoach({ videos: [v('c', 'da_dang')], ke: { ...ke, dangLam: [], tapKe: [] } }), []);
  // tập hỏng giữa chừng → dòng đỏ mang lỗi
  { const h = cayKeHoach({ videos: [], ke: { ...ke, dangLam: [{ ...ke.dangLam[0]!, loi: 'hỏng ở bước dựng (mã 1)' }] } })[1]!;
    assert.ok(h.phu!.startsWith('✗ hỏng ở bước dựng (mã 1)')); assert.strictEqual(h.mau, 'var(--bad)'); assert.strictEqual(h.dongHo!.loi, true); }
  // NHIỀU TẬP CÙNG LÚC (anh 05/11/2026 "nếu làm 10 video cùng 1 lúc"): mỗi tập một dòng + một đồng hồ, nhóm đếm số tập
  { const ds = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, ten: `Tập ${i}`, luc: '2026-11-02T15:00:00Z', buoc: 'viết kịch bản', so: (i % 8) + 1, tong: 8, buoc_luc: '2026-11-02T15:20:00Z' }));
    const m = cayKeHoach({ videos: [], ke: { ...ke, tapKe: [], dangLam: ds } }, Date.parse('2026-11-02T15:25:00Z'));
    assert.strictEqual(m[0]!.chu, '▶ Đang sản xuất (10)'); assert.strictEqual(m.filter((x) => x.dongHo).length, 10);
    assert.deepStrictEqual(m.slice(1).map((x) => x.dongHo!.so), [1, 2, 3, 4, 5, 6, 7, 8, 1, 2]); } }
// một bước đứng quá 30 phút → đỏ, ghi "đứng"
{ const ke = { lichTap: null, gioDang: null, tapKe: [], lichDang: [], dangLam: [{ id: 't', luc: '2026-11-02T15:00:00Z', buoc: 'viết kịch bản', so: 2, tong: 8, buoc_luc: '2026-11-02T15:00:00Z' }] };
  const r = cayKeHoach({ videos: [], ke }, Date.parse('2026-11-02T15:45:00Z'))[1]!; assert.strictEqual(r.phu, 'bước 2/8 · viết kịch bản · ⚠ đứng 45 phút · t'); assert.strictEqual(r.mau, 'var(--bad)'); assert.strictEqual(r.dongHo!.loi, true); }
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
// SỔ KÊNH (04/11/2026): 📘 Sổ · 🧩 Mẫu (link demo) · 💡 Hàng chờ (tập thật đè trạng thái trong sổ)
import { caySoKenh, cayMau, cayHangCho, trangThaiY } from './kenh-sp-tinh';
{ const so = { giai_doan: [], dinh_vi: { cho_ai: 'người tự xem lá số', dich: 'công cụ miễn phí', cau_ket: '…free at astrolas.com' }, luat: ['một mẫu một tập', 'số khớp site'],
    playlist: [{ ma: 'cc', ten: 'Chart Chapters', trang_thai: 'chot' as const }],
    mau: [{ ma: 'cc', ten: 'Chart Chapters', loai: 'short' as const, playlist: 'cc', nhip: 'Thứ 2', demo: 'https://img.on.tc/a.mp4' }, { ma: 'ts', ten: "Tonight's Sky", loai: 'dai' as const, tu_sinh: '^ts-' }],
    hang_cho: [{ ma: 'a', mau: 'cc', chu_de: 'A', trang_thai: 'demo' as const }, { ma: 'b', mau: 'cc', chu_de: 'B', trang_thai: 'chua' as const, ngay: '2027-02-10' },
      { ma: 'c', mau: 'ts', chu_de: 'C', trang_thai: 'san_sang' as const }, { ma: 'd', mau: 'cc', chu_de: 'D', trang_thai: 'chua' as const }] };
  const s = caySoKenh(so); assert.strictEqual(s[0]!.chu, '📘 Sổ kênh'); assert.strictEqual(s.length, 1 + 3 + 2); assert.ok(s[3]!.chu.includes('astrolas.com'));
  const m = cayMau(so); assert.strictEqual(m[0]!.chu, '🧩 Mẫu (2 đã duyệt)');
  // mẫu chờ duyệt: đếm riêng ở dòng nhóm, xếp CUỐI, ghi rõ ⏳ chờ anh duyệt (không lẫn với mẫu đã duyệt)
  { const m2 = cayMau({ ...so, mau: [{ ma: 'x', ten: 'Chart vs Chart', loai: 'short' as const, cho_duyet: true }, ...so.mau] });
    assert.strictEqual(m2[0]!.chu, '🧩 Mẫu (2 đã duyệt · 1 chờ duyệt)'); assert.ok(m2[3]!.chu.endsWith('⏳ chờ anh duyệt')); assert.strictEqual(m2[3]!.mau, 'var(--warn)'); } assert.deepStrictEqual(m[1]!.ngan, { loai: 'mau', id: 'cc' }); assert.strictEqual(m[1]!.nganChu, '▶ xem');
  assert.ok(m[1]!.phu!.includes('playlist Chart Chapters')); assert.strictEqual(m[2]!.nganChu, 'mở'); assert.ok(m[2]!.phu!.includes('máy tự sinh'));
  // tập thật có slug = mã ý tưởng → đè trạng thái sổ; đã đăng thắng đã làm
  assert.strictEqual(trangThaiY(so.hang_cho[3]!, [{ slug: 'd', trangThai: 'cho_cham' }]), 'da_lam');
  assert.strictEqual(trangThaiY(so.hang_cho[3]!, [{ slug: 'd', trangThai: 'cho_cham' }, { slug: 'd', trangThai: 'da_dang' }]), 'da_dang');
  const h = cayHangCho(so, [{ slug: 'd', trangThai: 'da_dang' }]);
  assert.deepStrictEqual(h.map((x) => x.chu), ['💡 Hàng chờ ý tưởng (4)', '⏳ C', '○ B', '🎬 A', '✅ D']);   // sẵn sàng → chưa làm → demo → đã đăng
  assert.ok(h[2]!.phu!.includes('10/02/2027'));
  // kênh chưa khai sổ → không khối nào
  assert.deepStrictEqual([...caySoKenh({ giai_doan: [] }), ...cayMau({ giai_doan: [] }), ...cayHangCho({ giai_doan: [] }, [])], []); }
console.log('kenh-sp-tinh: sổ kênh đạt');
// Ý TƯỞNG TỰ SINH (lịch trời): chỉ sự kiện trong 60 ngày tới, bỏ mã đã có trong hàng chờ tay; giờ hiện theo giờ VN
import { yTuongTuSinh } from './kenh-sp-tinh';
{ const so = { giai_doan: [], mau: [{ ma: 'tw', ten: 'This Week', loai: 'short' as const }], hang_cho: [{ ma: 'tw-a', mau: 'tw', chu_de: 'A', trang_thai: 'demo' as const }],
    nguon_y_tuong: [{ mau: 'tw', tep: 'lich-troi.json', ngay_toi: 60 }] };
  const ng = { 'lich-troi.json': [{ ma: 'tw-a', chu: 'A', utc: '2026-11-09T07:01Z' }, { ma: 'tw-b', chu: 'Mercury turns direct in Scorpio', utc: '2026-11-13T15:50Z' },
    { ma: 'tw-c', chu: 'xa', utc: '2027-03-01T00:00Z' }, { ma: 'tw-d', chu: 'đã qua', utc: '2026-10-01T00:00Z' }] };
  const y = yTuongTuSinh(so, ng, '2026-11-04'); assert.deepStrictEqual(y.map((x) => x.ma), ['tw-b']);
  const h = cayHangCho(so, [], y); assert.ok(h[0]!.phu!.includes('(1 tự sinh)')); const b = h.find((x) => x.id === 'hc/tw-b')!;
  assert.ok(b.phu!.includes('22:50 13/11/2026 giờ VN'), b.phu); assert.ok(b.phu!.includes('tự sinh · lịch trời')); }
console.log('kenh-sp-tinh: ý tưởng tự sinh đạt');
// 👤 SỔ NGƯỜI: AA dùng đủ lên trước; DD ghi "không dùng cung Mọc / nhà"; bị đánh dấu → đỏ + lý do
import { cayNguoi } from './kenh-sp-tinh';
{ const s = { ngay: 4, thang: 8, nam: 1961, gio: 19, phut: 24, noi: 'Honolulu' };
  const r = cayNguoi([{ slug: 't', ten: 'Taylor', sinh: s, rodden: 'DD' }, { slug: 'e', ten: 'Einstein', sinh: s, rodden: 'AA', khong_dung: 'múi giờ 1879' }, { slug: 'o', ten: 'Obama', sinh: s, rodden: 'AA', nguon: 'https://x' }], ['AA']);
  assert.deepStrictEqual(r.map((x) => x.chu), ['👤 Lá số người nổi tiếng (3)', '✅ AA · Obama', '⚠ DD · Taylor', '✗ AA · Einstein']);
  assert.ok(r[1]!.phu!.startsWith('04/08/1961 19:24 · Honolulu · dùng đủ')); assert.deepStrictEqual(r[1]!.ngan, { loai: 'nguoi', id: 'o' }); assert.ok(r[2]!.phu!.includes('không dùng cung Mọc / nhà')); assert.ok(r[3]!.phu!.includes('múi giờ 1879')); }
console.log('kenh-sp-tinh: sổ người đạt');
// SỐ THEO MẪU + bảng bài/video trong ngăn (mới nhất trên cùng)
import { thongKeMau, dongMau } from './kenh-sp-tinh';
{ const so = { giai_doan: [], mau: [{ ma: 'cc', ten: 'CC', loai: 'short' as const }, { ma: 'tw', ten: 'TW', loai: 'short' as const }],
    hang_cho: [{ ma: 'a', mau: 'cc', chu_de: 'A', trang_thai: 'demo' as const }, { ma: 'b', mau: 'cc', chu_de: 'B', trang_thai: 'chua' as const }, { ma: 'c', mau: 'cc', chu_de: 'C', trang_thai: 'chua' as const }] };
  const v = (slug: string, trangThai: 'da_dang' | 'cho_cham', o: object = {}) => ({ slug, ten: slug, ngayLam: '2026-11-01', trangThai, ngayDang: trangThai === 'da_dang' ? '2026-11-03' : null, url: null, xem: trangThai === 'da_dang' ? 100 : null, giay: 30, ...o });
  const vids = [v('b', 'da_dang'), v('x', 'cho_cham', { mau: 'cc', ngayLam: '2026-11-04' }), v('k', 'cho_cham')];   // b = ý tưởng b đã đăng · x khai mẫu · k không thuộc mẫu nào
  const t = thongKeMau(so, vids, [{ ma: 'tw-1', mau: 'tw', chu_de: 'Moon', trang_thai: 'chua', utc: '2026-11-09T07:01Z', ngay: '2026-11-09' }]);
  const cc = t.get('cc')!; assert.deepStrictEqual([cc.keHoach, cc.sanSang, cc.demo, cc.daLam, cc.daDang, cc.xem], [1, 0, 1, 1, 1, 100]);
  assert.strictEqual(t.get('tw')!.keHoach, 1);
  // bảng của mẫu: tập x (04/11) → tập b (đăng 03/11) → ý tưởng không ngày; ý tưởng b đã thành tập thì không lặp
  assert.deepStrictEqual(dongMau(cc).map((d) => (d.loai === 'video' ? `v:${d.v.slug}` : `y:${d.y.ma}`)), ['v:x', 'v:b', 'y:a', 'y:c']); }
console.log('kenh-sp-tinh: số theo mẫu đạt');
