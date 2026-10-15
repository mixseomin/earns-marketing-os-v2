// Tự kiểm xếp ảnh tham chiếu (#1256): sản phẩm đứng đầu, bản đồ ảnh đúng số, trần 10 ảnh.
import assert from 'node:assert';
import { xepThamChieu, ghepPromptAnh, KHONG_CHU } from './sinh-anh';
const nv = [
  { id: 1, loai: 'nhan_vat', ten: 'Ông Tom', mo_ta: 'đàn ông 62', anh_ref: ['t1', 't2', 't3'] },
  { id: 2, loai: 'san_pham', ten: 'JettJeans3', mo_ta: 'quần', anh_ref: ['p1', 'p2', 'p3', 'p4'] },
  { id: 3, loai: 'boi_canh', ten: 'Phòng khách', mo_ta: '', anh_ref: ['b1'] },
] as never;
const r = xepThamChieu(nv);
assert.deepEqual(r.urlRef, ['p1', 'p2', 'p3', 't1', 't2', 'b1']);
assert.ok(r.banDoRef.startsWith('Reference images: images 1–3 = THE PRODUCT') && !r.banDoRef.includes('JettJeans3'), r.banDoRef);   // tên sản phẩm KHÔNG vào prompt
assert.ok(r.banDoRef.includes('images 4–5 = the person Ông Tom') && r.banDoRef.includes('image 6 = the location Phòng khách'), r.banDoRef);
// biến thể của người đứng trước ảnh gốc
const r2 = xepThamChieu(nv, (v) => (v.ten === 'Ông Tom' ? { anh_url: 'bt1' } : undefined));
assert.deepEqual(r2.urlRef.slice(3, 5), ['bt1', 't1']);
// nhãn từng ảnh cho sơ đồ nguồn: khớp đúng thứ tự urlRef, sản phẩm ảnh đầu = màu chính, ảnh biến thể ghi là biến thể
assert.deepEqual(r.vai.map((v) => v.url), r.urlRef);
assert.ok(r.vai[0]!.nhan.includes('màu chính') && !r.vai[1]!.nhan.includes('màu chính') && r2.vai[3]!.nhan.includes('biến thể'), JSON.stringify(r2.vai));
// trần 10 ảnh
const nhieu = Array.from({ length: 6 }, (_, i) => ({ id: i, loai: 'nhan_vat', ten: `N${i}`, mo_ta: '', anh_ref: ['a', 'b'] })) as never;
assert.equal(xepThamChieu(nhieu).urlRef.length, 10);
assert.deepEqual(xepThamChieu([] as never), { urlRef: [], banDoRef: '', vai: [] });
const g = ghepPromptAnh('x', '', nv);
assert.ok(g.startsWith(KHONG_CHU) && g.endsWith(KHONG_CHU), g);
assert.ok(!g.includes('JettJeans3') && g.includes('THE PRODUCT in this shot must be copied EXACTLY') && g.includes('Product facts (must all hold): quần'), g);   // sản phẩm có ảnh: không tên, có mô tả chính xác
assert.ok(g.includes('Phòng khách'), g);
console.log('sinh-anh.test: ok');
// Phong cách cho model: bỏ vế về chữ/phụ đề, giữ phần hình (phá thử: bỏ lọc thì câu "white text…" còn → đỏ).
{
  const { phongCachHinh } = await import('./kieu');
  const pc = "UGC-style ad shot vertically on a phone, natural indoor light in an American home, true-to-life color, no cinematic filter; fast cuts at 2 seconds per shot; white text with black outline overlaid in the lower part of the frame";
  const r = phongCachHinh(pc);
  assert.ok(!/text|outline/i.test(r) && r.includes('natural indoor light') && r.includes('fast cuts'), r);
  assert.equal(phongCachHinh('Pixar 3D, warm light. Chữ trắng viền đen ở dưới.'), 'Pixar 3D, warm light.');
  assert.equal(phongCachHinh(''), '');
  console.log('sinh-anh.test: phong cách ok');
}
// Một màu → chỉ ảnh chính; shot nhắc màu khác / nhiều đôi → tới 3 ảnh.
{
  const { xepThamChieu, shotNhieuMau } = await import('./sinh-anh');
  assert.deepEqual(xepThamChieu(nv, undefined, false).urlRef.slice(0, 2), ['p1', 't1']);
  assert.ok(xepThamChieu(nv, undefined, false).banDoRef.includes('image 1 = THE PRODUCT') && xepThamChieu(nv, undefined, false).banDoRef.includes('Use exactly its color'));
  assert.equal(shotNhieuMau('He holds up the product from the reference images in front of his chest'), false);
  assert.equal(shotNhieuMau('two hangers side by side, the right pair the same product in black'), true);
  assert.equal(shotNhieuMau('lined up in all colors'), true);
  console.log('sinh-anh.test: màu ok');
}

// FRAMING: cỡ + vùng nhân vật đo trên khung 3D (kiểm khung 15/10/2026: cận mặt 3D mà keyframe vẽ cỡ trung).
{
  const { khungChu } = await import('./sinh-anh');
  const kx = { kiem: [{ nhan_vat: 'Tango', trong_khung: true, cao_khung_pt: 118, bi_che_boi: [] }, { nhan_vat: 'Lint', trong_khung: true, cao_khung_pt: 22, bi_che_boi: [] }],
    thay: [{ ten: 'Tango', pt: 60, hop: [0.2, 0.05, 0.8, 0.95] }, { ten: 'Lint', pt: 4, hop: [0.7, 0.5, 0.9, 0.7] }] } as never;
  const c = khungChu(kx, ['Tango', 'Lint']);
  assert.ok(/Tango spans about 60% of the frame width and 90% of its height, middle centre — a close-up/.test(c), c);
  assert.ok(/Lint spans about 20% of the frame width and 20% of its height, middle right;?/.test(c) && !/Lint[^;]*close-up/.test(c), c);
  assert.equal(khungChu(kx, ['Tango'], true), '', 'khung KẾT: số đo là của khung mở → không nói');
  assert.equal(khungChu(null, ['Tango']), '');
}

// Dải vật bị mép cắt tràn ngang khung KHÔNG phải cận cảnh (#35: đế cắm ló 10% ở đáy bị gọi "fills the frame").
{
  const { khungChu } = await import('./sinh-anh');
  const c = khungChu({ thay: [{ ten: 'USB Hub', pt: 9, hop: [0, 0.9, 1, 1] }] } as never, ['USB Hub']);
  assert.ok(!/close-up/.test(c) && /cut off by the bottom edge — only a 10% strip/.test(c), c);
}

// Câu CAMERA từ máy 3D (#35: máy 1,2 cm ngước lên Mr. Wipe mà keyframe vẽ ngang tầm).
{
  const { gocMayChu } = await import('./sinh-anh');
  const c = gocMayChu({ dat: [65.5, 49, 1.2], nhin: [59, 59.6, 6.0], ong_kinh: 40 }, { ten: 'Mr. Wipe', giuaZ: 5.5 });
  assert.ok(/tilted UP 2\d° — a LOW-ANGLE shot/.test(c) && /1\.2 cm above the desk, below the middle of Mr\. Wipe/.test(c) && /seeing its underside/.test(c), c);
  assert.match(gocMayChu({ dat: [0, 0, 10], nhin: [0, 10, 0], ong_kinh: 35 }, null), /tilted DOWN 45° — a HIGH-ANGLE/);
  assert.match(gocMayChu({ dat: [0, 0, 1.3], nhin: [0, 10, 1.3], ong_kinh: 35 }, { ten: 'Tango', giuaZ: 1.3 }), /EYE-LEVEL/);
}
