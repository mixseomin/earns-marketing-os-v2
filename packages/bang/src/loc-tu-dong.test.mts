import assert from 'node:assert';
import { cotDanhMuc, chuoiTim, gomNhom, locChon, docChon } from './loc-tu-dong';
import { matchColFilter } from './col-filter';

type R = { ten: string; loai: string; gia: number; ngay: string };
const rows: R[] = Array.from({ length: 12 }, (_, i) => ({ ten: `Dòng ${i}`, loai: ['video', 'ảnh', 'chữ, dài'][i % 3]!, gia: i * 10, ngay: `2026-10-${10 + i}` }));
const cols = [
  { key: 'ten', header: 'Tên', sortValue: (r: R) => r.ten },
  { key: 'loai', header: 'Loại', sortValue: (r: R) => r.loai },
  { key: 'gia', header: 'Giá', sortValue: (r: R) => r.gia },
  { key: 'ngay', header: 'Ngày', sortValue: (r: R) => r.ngay },
  { key: 'nut', header: 'x' },
];
const dm = cotDanhMuc(rows, cols as never);
assert.deepStrictEqual(dm.map((c) => c.key), ['loai'], 'chỉ cột loại là danh mục (tên/ngày mỗi dòng một giá trị, giá là số)');
assert.strictEqual(dm[0]!.giaTri.length, 3);
assert.deepStrictEqual(cotDanhMuc(rows.slice(0, 2), cols as never), [], 'bảng < 3 dòng không có lọc');
assert.ok(chuoiTim(rows[1]!, cols as never).includes('ảnh'));
assert.deepStrictEqual(gomNhom(rows, cols[1] as never).map((g) => [g.v, g.rows.length]), [['video', 4], ['ảnh', 4], ['chữ, dài', 4]]);
// giá trị có dấu phẩy vẫn lọc đúng (IN thường tách theo phẩy sẽ hỏng)
const f = locChon(['chữ, dài'])!;
assert.strictEqual(rows.filter((r) => matchColFilter(r.loai, f.op, f.val)).length, 4);
assert.deepStrictEqual(docChon(f), ['chữ, dài']);
assert.strictEqual(locChon([]), null);
assert.deepStrictEqual(docChon(locChon(['(trống)'])!), ['(trống)']);
// cột số mà đa số ô trống ("chưa đo") không bị nhận nhầm là danh mục
const thua = rows.map((r, i) => ({ ...r, od: i < 9 ? null : [60, 47, 100][i - 9]! }));
assert.deepStrictEqual(cotDanhMuc(thua, [...cols, { key: 'od', header: 'Ổn định', sortValue: (r: { od: number | null }) => r.od }] as never).map((c) => c.key), ['loai']);
console.log('✓ loc-tu-dong');
