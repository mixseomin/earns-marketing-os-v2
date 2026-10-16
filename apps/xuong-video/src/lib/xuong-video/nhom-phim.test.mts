import assert from 'node:assert';
import { nhomPhim, tenNhomPhim, demKieu, sanPhamPhim } from './nhom-phim';
import type { Phim } from './kieu';
const sr = (ten: string) => ({ dong_co: 'x', khan_gia: '', dinh_dang: '', tap: [], ten });
const p = (id: number, ten: string, loai: Phim['loai'], kt: Partial<Phim['kinh_thanh']> = {}, tap: string[] = []): Phim => ({ id, project: 's', ten, loai, mo_ta: '', kinh_thanh: kt as Phim['kinh_thanh'], trang_thai: '', so_tap: tap.length, so_nhan_vat: 0, so_canh: 0, chi_phi_cents: 10, updated_at: '', tap_tom: tap.map((t, i) => ({ id: i, so: i + 1, ten: t, so_canh: 0, so_hinh: 0, so_clip: 0 })) });
const ds = [
  p(14, 'Series · Fox Tales — Aesop (sáp màu)', 'short', { series: sr('Fox Tales') }, ['The Crow\'s Cheese']),
  p(12, 'Series · Zeus at Work (bút chì)', 'short', { series: sr('Zeus at Work') }, ['Day One', 'Reply All']),
  p(11, 'Series · Fox Tales — Aesop (3D)', 'short', { series: sr('Fox Tales'), luu_tru: true }),
  p(13, 'Series · Fox Tales — Aesop (vẽ đơn)', 'short', { series: sr('Fox Tales') }),
  p(9, 'Astrolas · Double Retrograde — Maya', 'quang_cao'), p(8, 'Astrolas · Transit story', 'quang_cao'),
  p(5, 'Thỏ và Rùa', 'phim'),
  p(18, 'Template · UGC kể chuyện', 'quang_cao', { template: { o: {} } }),
];
let g = nhomPhim(ds, {});
assert.deepStrictEqual(g.map((x) => [x.ten, x.phim.length]), [['Fox Tales', 2], ['Zeus at Work', 1], ['Astrolas', 2], ['Thỏ và Rùa', 1]]);
assert.strictEqual(nhomPhim(ds, { luuTru: true })[0]!.phim.length, 3, 'hiện cả bản lưu trữ');
assert.deepStrictEqual(nhomPhim(ds, { kieu: 'series' }).map((x) => x.ten), ['Fox Tales', 'Zeus at Work']);
assert.deepStrictEqual(nhomPhim(ds, { tim: 'reply' }).map((x) => x.ten), ['Zeus at Work'], 'tìm theo tên tập');
assert.deepStrictEqual(demKieu(ds), { template: 1, series: 3, quang_cao: 2, phim: 1, may_dung: 0 });
assert.strictEqual(tenNhomPhim({ ten: 'Series · Fox Tales — Aesop (x)', kinh_thanh: { series: { dong_co: 'x', khan_gia: '', dinh_dang: '', tap: [] } } as Phim['kinh_thanh'] }), 'Fox Tales');
assert.deepStrictEqual(nhomPhim(ds, { kieu: 'template' }).map((x) => x.phim[0]!.id), [18], 'template tách nhóm riêng, không lẫn quảng cáo');
// Phim QC gom theo SẢN PHẨM (link trang bán, rồi tên sản phẩm), không theo tiền tố tên phim
const qc = (ten: string, link: string) => ({ qc: { ten, link, diem_noi_bat: '', doi_tuong: '', uu_dai: '', thi_truong: '', anh: [] } });
const ds2 = [
  p(5, 'Mẫu QC · Jett Jeans theo khuôn Husband', 'quang_cao', qc('JettJeans3 - Men\'s Jeans', 'https://orabra.com/jettjeans3-men-s-jeans/?utm=x')),
  p(60, 'Jett · Trước / Sau', 'quang_cao', qc('Jett jeans', 'https://www.orabra.com/jettjeans3-men-s-jeans')),
  p(61, 'Mẫu QC · Tank', 'quang_cao', qc('Sculpt Tank', '')), p(62, 'Tank · UGC', 'quang_cao', qc('sculpt tank', '')),
  p(63, 'Mẫu QC · chưa khai sản phẩm', 'quang_cao'),
];
g = nhomPhim(ds2, {});
assert.deepStrictEqual(g.map((x) => [x.ten, x.phim.map((y) => y.id)]), [['JettJeans3 - Men\'s Jeans', [5, 60]], ['Sculpt Tank', [61, 62]], ['Mẫu QC', [63]]]);
assert.strictEqual(sanPhamPhim({ loai: 'short', kinh_thanh: qc('x', 'https://a.com/b') as Phim['kinh_thanh'] }), null, 'chỉ phim QC');
assert.deepStrictEqual(nhomPhim(ds2, { tim: 'jettjeans3' }).map((x) => x.phim.length), [2], 'tìm theo tên sản phẩm');
console.log('nhom-phim.test: ok');
