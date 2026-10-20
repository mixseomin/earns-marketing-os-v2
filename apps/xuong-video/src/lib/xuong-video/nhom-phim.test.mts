import assert from 'node:assert';
import { nhomPhim, tenNhomPhim, demKieu, sanPhamPhim, tongSanPham, duNac } from './nhom-phim';
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

// tongSanPham: bảng quản lý trang Sản phẩm — đếm creative đủ nấc / kẹt, camp (kể cả nhân bản), cộng số liệu QC, ROI
{
  const qc = { ten: 'Phim A', link: 'https://www.reelshort.com/episodes/a' };
  const a = { ...p(1, 'Ethopex · A · cảnh thật', 'quang_cao', { qc, ngon_ngu: 'en', the_loai: 'qc_canh_that', ethopex: { creative_id: 1, camp_id: 10, camp_nhan_ban: [11, 12], so_lieu: { chi: 2, thu: 5, lai: 3, camp: [{ id: 10, lai: 3 }] } } } as never), tap_tom: [{ id: 1, so: 1, ten: '', so_canh: 2, so_hinh: 2, so_clip: 2 }] };
  const b = { ...p(2, 'Ethopex · A · kể chuyện', 'quang_cao', { qc, ngon_ngu: 'en', the_loai: 'qc_ke_chuyen', ethopex: { creative_id: 2, camp_id: 20, so_lieu: { chi: 1, thu: 0.5, lai: -0.5, camp: [{ id: 20, lai: -0.5 }] } } } as never), tap_tom: [{ id: 2, so: 1, ten: '', so_canh: 7, so_hinh: 7, so_clip: 5 }] };
  assert.equal(duNac(a), true); assert.equal(duNac(b), false);
  const t = tongSanPham({ key: 'sp:x', ten: 'A', phim: [a, b] });
  assert.equal(t.so_creative, 2); assert.equal(t.du, 1); assert.equal(t.ket, 1);
  assert.equal(t.so_camp, 4, 'camp 10, 11, 12 (nhân bản), 20');
  assert.equal(t.camp_lai, 1); assert.equal(t.chi, 3); assert.equal(t.thu, 5.5); assert.equal(t.roi, 83.3);
  assert.equal(t.nguon, 'reelshort'); assert.deepEqual(t.ngon_ngu, ['EN']); assert.equal(t.loai.qc_canh_that, 1);
  // số liệu sống ghi đè bản chụp: creative 1 có số mới, creative 2 không có dòng → 0
  const s = tongSanPham({ key: 'sp:x', ten: 'A', phim: [a, b] }, { 1: { chi: 4, thu: 10, lai: 6, camp: [{ id: 10, lai: 6 }, { id: 11, lai: 1 }] } });
  assert.equal(s.chi, 4); assert.equal(s.thu, 10); assert.equal(s.camp_lai, 2); assert.equal(s.roi, 150);
}
console.log('nhom-phim tongSanPham: ok');
