// Tự kiểm khan-gia.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/khan-gia.test.mts
import assert from 'node:assert';
import { HIEU_UNG_KHAN_GIA, soatKhanGia, xepHangYDo, lamSachKhanGia, type YDoKhanGia } from './khan-gia';

// Thư viện: đủ các loại anh nêu, mỗi loại có mô tả ngành đủ trường + nguồn
for (const k of ['vui', 'buon', 'to_mo', 'bat_ngo', 'danh_lua', 'phan_van', 'so_hai']) assert.ok(HIEU_UNG_KHAN_GIA.some((x) => x.key === k), k);
for (const x of HIEU_UNG_KHAN_GIA) assert.ok(Object.values(x.nganh).every((v) => String(v).trim()), `${x.key} thiếu trường ngành`);

const sh = (id: number, luat: string[] = []) => ({ id, thu_tu: id, ky_thuat: { luat } });
const ds = [sh(1), sh(2), sh(3, ['chenh_thong_tin']), sh(4), sh(5), sh(6)];
const loi = (yd: YDoKhanGia[], s = ds) => soatKhanGia(yd, s).map((k) => k.loi);

// đánh lừa: thiếu A/B + thiếu lật → 2 lỗi; đủ A/B, lật sau đoạn → sạch; lật trước khi đoạn kết → lỗi
assert.strictEqual(loi([{ y: 'danh_lua', tu: 1, den: 3 }])[0]!.length, 2);
assert.deepStrictEqual(loi([{ y: 'danh_lua', tu: 1, den: 3, a: 'Hạ là nhân viên quèn', b: 'Hạ là cổ đông lớn', lat: 5 }])[0], []);
assert.ok(loi([{ y: 'danh_lua', tu: 1, den: 4, a: 'x', b: 'y', lat: 2 }])[0]!.some((x) => x.includes('TRƯỚC')));
// bất ngờ: không gieo → lỗi; có đoạn tò mò trước → sạch; có shot gắn luật gài–trả trước → sạch
assert.ok(loi([{ y: 'bat_ngo', tu: 5, den: 5 }])[0]!.some((x) => x.includes('gieo')));
assert.deepStrictEqual(loi([{ y: 'to_mo', tu: 1, den: 2 }, { y: 'bat_ngo', tu: 5, den: 5 }])[1], []);
assert.deepStrictEqual(loi([{ y: 'bat_ngo', tu: 5, den: 5 }], [sh(1, ['tu_ke_du']), ...ds.slice(1)])[0], []);
// hồi hộp: có shot chênh lệch thông tin trong / trước đoạn → sạch; không có → lỗi
assert.deepStrictEqual(loi([{ y: 'hoi_hop', tu: 3, den: 4 }])[0], []);
assert.ok(loi([{ y: 'hoi_hop', tu: 1, den: 2 }])[0]!.some((x) => x.includes('biết trước')));
// hả hê / nhẹ nhõm phải sau đoạn dồn căng
assert.ok(loi([{ y: 'ha_he', tu: 5, den: 6 }])[0]!.length === 1);
assert.deepStrictEqual(loi([{ y: 'uc_che', tu: 1, den: 3 }, { y: 'ha_he', tu: 5, den: 6 }])[1], []);
// shot không còn trong tập → lỗi, không vẽ
const mat = soatKhanGia([{ y: 'vui', tu: 99, den: 2 }], ds)[0]!; assert.strictEqual(mat.tu, -1); assert.ok(mat.loi[0]!.includes('không còn'));
// xếp hàng: hai đoạn chồng nhau → 2 hàng; không chồng → 1 hàng
assert.strictEqual(xepHangYDo(soatKhanGia([{ y: 'vui', tu: 1, den: 3 }, { y: 'to_mo', tu: 2, den: 4 }], ds)).length, 2);
assert.strictEqual(xepHangYDo(soatKhanGia([{ y: 'vui', tu: 1, den: 2 }, { y: 'to_mo', tu: 3, den: 4 }], ds)).length, 1);
// làm sạch: bỏ hiệu ứng lạ, shot 0, giữ A/B/lật
assert.deepStrictEqual(lamSachKhanGia([{ y: 'la', tu: 1, den: 2 }, { y: 'vui', tu: 0, den: 2 }, { y: 'danh_lua', tu: '1', den: 3, a: ' A ', b: 'B', lat: 5, rac: 1 }]),
  [{ y: 'danh_lua', tu: 1, den: 3, a: 'A', b: 'B', lat: 5 }]);
assert.deepStrictEqual(lamSachKhanGia('x'), []);
console.log(`✓ khan-gia (${HIEU_UNG_KHAN_GIA.length} hiệu ứng)`);
