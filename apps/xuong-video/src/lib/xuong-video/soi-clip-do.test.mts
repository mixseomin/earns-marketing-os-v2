// Tự kiểm soi-clip-do.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/soi-clip-do.test.mts
import assert from 'node:assert';
import { hsv, mauSanPham, tiLeMau, giayMatSanPham, chuTrongKhung, loiTuBienDang, loiDanBienDang, N_KHUNG_BD } from './soi-clip-do';

const anh = (mau: [number, number, number][], n: number[]) => { const a: number[] = []; mau.forEach((m, k) => { for (let i = 0; i < n[k]!; i++) a.push(...m); }); return new Uint8Array(a); };
const XANH: [number, number, number] = [40, 80, 200], DA: [number, number, number] = [220, 170, 130], TRANG: [number, number, number] = [245, 245, 245], XAM: [number, number, number] = [90, 90, 95];
assert.ok(Math.abs(hsv(...XANH)[0] - 225) < 2);
// Ảnh quần xanh trên nền trắng → màu sản phẩm là xanh.
const h = mauSanPham([anh([XANH, TRANG], [300, 700])])!;
assert.ok(Math.abs(h.h - 225) <= 10, `hue ${h.h}`);
// Ảnh người mặc: da nhiều hơn quần nhưng quần ≥ 40% → vẫn lấy xanh.
assert.ok(Math.abs(mauSanPham([anh([DA, XANH, TRANG], [300, 200, 500])])!.h - 225) <= 10);
// Sản phẩm đen / xám → không đo được bằng màu.
assert.strictEqual(mauSanPham([anh([XAM, TRANG], [500, 500])]), null);
// Ca #54 shot 9: khung đầu quần chiếm 30%, máy đẩy vào ngực → 4%.
const tl = [anh([XANH, XAM], [30, 70]), anh([XANH, XAM], [28, 72]), anh([XANH, XAM], [4, 96])].map((x) => tiLeMau(x, h));
assert.strictEqual(giayMatSanPham(tl, [0.1, 2, 4]), 4);
assert.strictEqual(giayMatSanPham([0.3, 0.29, 0.25], [0.1, 2, 4]), null, 'quần còn nguyên → đạt');
assert.strictEqual(giayMatSanPham([0.02, 0, 0], [0.1, 2, 4]), 'khong_do', 'sp nhỏ trong khung (toàn cảnh) → không kết luận mất');
// Đúng ca #54 shot 4: gắn quần cobalt mà khung mặc jeans xanh đậm (0,6%) → vắng / sai màu.
assert.strictEqual(giayMatSanPham([0.006, 0, 0.001], [0.1, 2, 4]), 'vang');
// Đúng ca #54 shot 9: áo polo navy cùng sắc độ với quần cobalt — máy đẩy vào ngực, khung đầy áo navy, quần còn ít → vẫn phải thấy mất quần.
const NAVY: [number, number, number] = [20, 30, 70];
const tl9 = [anh([XANH, NAVY, XAM], [30, 20, 50]), anh([XANH, NAVY, XAM], [3, 60, 37])].map((x) => tiLeMau(x, h));
assert.strictEqual(giayMatSanPham(tl9, [0.1, 4]), 4, `áo navy bị tính là quần: ${tl9}`);
// OCR: phụ đề giả đọc được ≥2 từ; nhiễu ký tự lẻ / độ tin thấp bị bỏ.
const dong = (w: string, conf: number) => ['5', '1', '1', '1', '1', '1', '10', '10', '50', '20', String(conf), w].join('\t');
const tsv = ['level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext', dong('Look', 93), dong('at', 95), dong('that', 91), dong('fit!', 90), dong('~%', 96), dong('Hmm', 40)].join('\n');
assert.deepStrictEqual(chuTrongKhung(tsv), ['Look', 'that', 'fit!']);
console.log('soi-clip-do: đạt');

// MẶT TRÔI: một khung lẻ thấp không tính; ≥ 2 khung và ≥ 40% → trôi; quá ít khung chấm được → không kết luận
{
  const { matTroiClip } = await import('./soi-clip-do');
  const d = (xs: number[]) => xs.map((g, i) => ({ giay: i, giong: g }));
  assert.equal(matTroiClip(d([0.6, 0.55, 0.2, 0.58, 0.61])), null, 'một khung lẻ (chớp mắt) không tính');
  assert.deepEqual(matTroiClip(d([0.6, 0.5, 0.3, 0.25, 0.2])), [2, 3, 4], 'nửa sau clip mặt trôi');
  assert.equal(matTroiClip(d([0.2])), null, 'một khung chấm được: không kết luận');
  assert.deepEqual(matTroiClip(d([0.2, 0.3])), [0, 1]);
  console.log('soi-clip-do.test: mặt trôi ok');
}

// Biến dạng: khung → giây giữa khung (clip 6s, 12 khung → khung 8 = 3.75s); mỗi loại một câu, khung sớm nhất; khung / loại lạ bỏ
const bd = loiTuBienDang([{ khung: 9, loai: 'trang_phuc_bien_dang', mo_ta: 'pants balloon' }, { khung: 8, loai: 'trang_phuc_bien_dang', mo_ta: 'crotch drops' },
  { khung: 13, loai: 'co_the_meo', mo_ta: 'x' }, { khung: 2, loai: 'khac' as never, mo_ta: 'x' }, { khung: 3, loai: 'chu_tren_vat', mo_ta: 'Jett on waistband' }], 6);
assert.deepStrictEqual(bd, ['chữ tự in trên đồ vật từ giây 1.3: Jett on waistband', 'trang phục biến dạng từ giây 3.8: crotch drops']);
assert.deepStrictEqual(loiTuBienDang([], 6), []);
assert.ok(loiDanBienDang('blue jeans').includes('blue jeans') && loiDanBienDang('').includes(String(N_KHUNG_BD)));
