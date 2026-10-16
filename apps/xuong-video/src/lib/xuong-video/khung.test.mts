import assert from 'node:assert';
import { trangThaiKhung, chanKhung, khoiCanKiem } from './khung';

const k = (url: string, dat: boolean, duyet_tay?: string) => ({ url, dat, loi: dat ? [] : [{ loai: 'vi_tri', mo_ta: 'Tango sau bàn phím', sua: '' }], luc: '', model: '', ...(duyet_tay ? { duyet_tay } : {}) });
assert.equal(trangThaiKhung({ keyframe_url: null, kiem_khung: null }), 'khong');
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: null }), 'chua');
assert.equal(trangThaiKhung({ keyframe_url: 'b', kiem_khung: k('a', true) }), 'chua');   // sinh lại keyframe → kết quả cũ hết hiệu lực
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: k('a', true) }), 'dat');
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: k('a', false) }), 'lech');
assert.equal(trangThaiKhung({ keyframe_url: 'a', kiem_khung: k('a', false, 'anh') }), 'tay');
assert.equal(chanKhung({ keyframe_url: 'a', kiem_khung: k('a', true) }), null);
assert.ok(chanKhung({ keyframe_url: 'a', kiem_khung: k('a', false) })!.includes('Tango sau bàn phím'));
assert.ok(chanKhung({ keyframe_url: 'b', kiem_khung: k('a', true) })!.includes('chưa qua'));
const ds = [
  { id: 1, phan_doan: 'A', keyframe_url: 'x1', kiem_khung: k('x1', true) }, { id: 2, phan_doan: 'A', keyframe_url: 'x2', kiem_khung: null },
  { id: 3, phan_doan: 'B', keyframe_url: 'x3', kiem_khung: k('x3', true) }, { id: 4, phan_doan: 'C', keyframe_url: null, kiem_khung: null },
];
assert.deepEqual(khoiCanKiem(ds).map((x) => x.map((c) => c.id)), [[1, 2]]);   // khối A có shot chưa kiểm → kiểm cả khối; B đã đạt; C chưa có hình
assert.deepEqual(khoiCanKiem(ds, true).map((x) => x.map((c) => c.id)), [[1, 2], [3]]);
console.log('khung.test: ok');
// QC miễn cổng kiểm khung (15/10/2026); phim truyện vẫn bị chặn khi keyframe chưa kiểm
import { chanVideo } from './quy-trinh';
const shot = { keyframe_url: 'a', kiem_khung: null, trang_thai: 'duyet', thoai: [], loi_thoai: '', nhan_vat: [] } as unknown as Parameters<typeof chanVideo>[0];
assert.deepEqual(chanVideo(shot, [], true, { ds: [] }), []);
assert.ok(chanVideo(shot, [], false, { ds: [] }).some((x) => /Kiểm khung|chưa qua/.test(x)));
console.log('khung.test (QC miễn kiểm khung): ok');
// laQc bắt buộc: gọi KHÔNG kèm o (thẻ shot, script kiểm) vẫn phải miễn kiểm khung cho quảng cáo (16/10/2026)
assert.deepEqual(chanVideo(shot, [], true), [], 'QC, không truyền o → không chặn kiểm khung');
assert.ok(chanVideo(shot, [], false).some((x) => /Kiểm khung|chưa qua/.test(x)), 'phim truyện, không truyền o → vẫn chặn');
console.log('khung.test: laQc bắt buộc ok');

// SOI MẶT: lệch → chặn; keyframe đổi → chưa soi; quay lưng (giong null) không chặn; nhận tay → qua; phim không theo dõi mặt → không chặn
{
  const { trangThaiMat, chanKhung: chan } = await import('./khung');
  const kk = { url: 'k1', dat: true, loi: [], luc: '', model: '' };
  const sm = (dat: boolean, ket: { ten: string; giong: number | null; dat: boolean }[], o: Record<string, unknown> = {}) => ({ url: 'k1', luc: '', mat: 1, ket, dat, ...o });
  const lech = sm(false, [{ ten: 'Bố', giong: 0.12, dat: false }]);
  assert.equal(trangThaiMat({ keyframe_url: 'k1', soi_mat: lech }), 'lech');
  assert.ok(chan({ keyframe_url: 'k1', kiem_khung: kk, soi_mat: lech })?.includes('Bố (giống 12%)'), 'mặt lệch chặn dù kiểm khung đạt');
  assert.ok(chan({ keyframe_url: 'k2', kiem_khung: { ...kk, url: 'k2' }, soi_mat: lech })?.includes('soi lại'), 'keyframe đổi → soi lại');
  assert.equal(chan({ keyframe_url: 'k1', kiem_khung: kk, soi_mat: sm(true, [{ ten: 'Bố', giong: null, dat: true }]) }), null, 'quay lưng: không chặn');
  assert.equal(chan({ keyframe_url: 'k1', kiem_khung: kk, soi_mat: { ...lech, duyet_tay: 'a@b' } }), null, 'nhận tay: qua');
  assert.equal(chan({ keyframe_url: 'k1', kiem_khung: kk, soi_mat: sm(true, []) }), null, 'không nhân vật mặt người: không theo dõi');
  assert.equal(chan({ keyframe_url: 'k1', kiem_khung: kk }), null, 'shot cũ chưa có soi_mat: không chặn');
  console.log('khung.test: soi mặt ok');
}

// CHẤT LIỆU HÌNH: khai tay thắng; không khai thì đọc phong cách — UGC / live-action = người thật, Pixar / stop-motion = hoạt hình, không rõ = hoạt hình
{
  const { chatLieuPhim } = await import('./kieu');
  assert.equal(chatLieuPhim({ phong_cach: 'Live-action UGC ad, photorealistic real people, shot on iPhone vertical' }), 'nguoi_that');
  assert.equal(chatLieuPhim({ phong_cach: 'Creator reply video, phone camera, talking to camera at home' }), 'nguoi_that');
  assert.equal(chatLieuPhim({ phong_cach: 'Stop-motion felt puppets on a desk, macro lens' }), 'hoat_hinh');
  assert.equal(chatLieuPhim({ phong_cach: '3D hoạt hình kiểu Pixar' }), 'hoat_hinh');
  assert.equal(chatLieuPhim({ phong_cach: 'warm light, cozy' }), 'hoat_hinh', 'không rõ: không bật soi mặt');
  assert.equal(chatLieuPhim({ phong_cach: 'warm light, cozy', chat_lieu: 'nguoi_that' }), 'nguoi_that', 'khai tay thắng');
  console.log('khung.test: chất liệu ok');
}
