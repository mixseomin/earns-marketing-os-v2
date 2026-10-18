// Tự kiểm goi-the-loai.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/goi-the-loai.test.mts
import assert from 'node:assert';
import { GOI_THE_LOAI, kiemGoi, vanGoi, goiTheoKey } from './goi-the-loai';

// mọi gói trỏ vào hiệu ứng / luật / thể loại CÓ THẬT (lỗi trỏ ma ≠ "thiếu khung" — thiếu khung là việc cần làm, trỏ ma là lỗi gõ)
for (const g of GOI_THE_LOAI) {
  const k = kiemGoi(g);
  const ma = k.thieu.filter((t) => /không có$|chưa có trong danh sách/.test(t));
  assert.deepStrictEqual(ma, [], `${g.key}: ${ma.join('; ')}`);
}
assert.strictEqual(new Set(GOI_THE_LOAI.map((g) => g.key)).size, GOI_THE_LOAI.length, 'khoá trùng');
// gói đang sản xuất thật: tổng tài + QC UGC đủ; series hoạt hình thiếu khung beat riêng (đang dùng ba hồi chung) — máy phải nói ra
assert.ok(kiemGoi(goiTheoKey('phim_doc_tong_tai')!).sanSang);
assert.ok(kiemGoi(goiTheoKey('qc_ugc')!).sanSang);
// mọi gói hiện có đều đủ; gói giả trỏ khung / thể loại không có → máy phải báo (kiểm có thể đỏ)
for (const g of GOI_THE_LOAI) assert.ok(kiemGoi(g).sanSang, `${g.key}: ${kiemGoi(g).thieu.join('; ')}`);
const gia = { ...goiTheoKey('trailer')!, key: 'gia', khung: 'khong_co', the_loai: 'tai_lieu' as const, khan_gia: ['la' as never], luat: ['khong_co'] };
const kg = kiemGoi(gia);
assert.ok(kg.thieu.some((t) => t.includes('chưa có khung beat "khong_co"')) && kg.thieu.some((t) => t.includes('"la" không có')) && kg.thieu.some((t) => t.includes('"khong_co" không có')));
// gói thắng thể loại khi chọn khung beat
import { khoaKhung } from './dien-anh';
assert.strictEqual(khoaKhung('phim', 'hoat_hinh', 'series_hoat_hinh'), 'series_hoat_hinh');
assert.strictEqual(khoaKhung('phim', 'hoat_hinh', 'khong_co'), 'phim');
// khối dặn Claude
assert.ok(vanGoi('phim_doc_tong_tai').includes('Ức chế') && vanGoi('phim_doc_tong_tai').includes('60–120 giây'));
assert.strictEqual(vanGoi(''), '');
const sanSang = GOI_THE_LOAI.filter((g) => kiemGoi(g).sanSang).map((g) => g.key);
console.log(`✓ goi-the-loai (${GOI_THE_LOAI.length} gói · sẵn sàng: ${sanSang.join(', ')})`);
