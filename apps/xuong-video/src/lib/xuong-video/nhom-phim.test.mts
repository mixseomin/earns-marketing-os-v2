import assert from 'node:assert';
import { nhomPhim, tenNhomPhim, demKieu } from './nhom-phim';
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
assert.deepStrictEqual(demKieu(ds), { template: 1, series: 3, quang_cao: 2, phim: 1 });
assert.strictEqual(tenNhomPhim({ ten: 'Series · Fox Tales — Aesop (x)', kinh_thanh: { series: { dong_co: 'x', khan_gia: '', dinh_dang: '', tap: [] } } as Phim['kinh_thanh'] }), 'Fox Tales');
assert.deepStrictEqual(nhomPhim(ds, { kieu: 'template' }).map((x) => x.phim[0]!.id), [18], 'template tách nhóm riêng, không lẫn quảng cáo');
console.log('nhom-phim.test: ok');
