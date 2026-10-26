// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phieu-shot.test.mts
import assert from 'node:assert';
import { cauKhung, phieuShot } from './phieu-shot';

assert.ok(cauKhung('cu', 'Hạ').includes("Hạ's eyes sit on the upper-third line (31% from the top)"), 'cận: có điểm neo mắt');
assert.ok(cauKhung('cu').includes('never widen'), 'cận: cấm mở rộng khung');
assert.ok(!cauKhung('insert').includes('eyes sit'), 'cận đồ: không điểm neo mắt');
assert.ok(cauKhung('ots').length > 0 && cauKhung('two').length > 0 && cauKhung('pov').length > 0, 'đủ ots / two / pov (bang-gom cũ thiếu)');
assert.equal(cauKhung('la_hoac'), '', 'mã lạ: không câu');
// sổ đồ vật: thẻ sang tay Vivian ở mảnh 7 (có sự kiện) → shot 8: Hạ "không còn" thẻ; shot 7: nói cả đầu lẫn cuối
const so = { 'Thẻ': [{ tu: 1, ai: 'Hạ', cach: "on Hạ's neck", vi: '' }, { tu: 7, ai: 'Vivian', cach: "in Vivian's right hand", vi: '', su_kien: 'giật' }] };
const n = { canh_en: 'Lobby.', so_vat: so, ten_en: { 'Thẻ': 'the badge' } };
const p8 = phieuShot({ co: 'cu', so_cu: 8, nguoi: [{ ten: 'Hạ', x: 0.5, mat: ['soc', 'nhuc_nha'], quay: 30, nhin_vao: 'Thẻ', nhin_huong: 'phai' }], khai: ['Thẻ'] }, n);
assert.ok(p8.includes('Hạ no longer has the badge'), 'đồ đã mất phải nói ra');
assert.ok(p8.includes('ONLY these people') && p8.includes('three-quarter view, head turned toward screen right'), p8);
assert.ok(p8.includes('Never:'), 'nét âm → cấm cười');
const p7 = phieuShot({ co: 'ms', so_cu: 7, nguoi: [{ ten: 'Hạ', x: 0.3 }, { ten: 'Vivian', x: 0.75, nhin_vao: 'Hạ' }] }, n);
assert.ok(p7.includes('At the start —') && p7.includes('By the end —'), 'mảnh có sự kiện: nói đầu + cuối');
assert.ok(p7.includes('eyes on Hạ, who is in frame at screen left'));
// mô tả chuẩn đạo cụ: món người trong khung đang giữ / món cận chèn → chép nguyên câu; món không có trong khung → không
const nVt = { ...n, vat_ta: { 'Thẻ': 'white badge, gold logo, no readable name' } };
assert.ok(phieuShot({ co: 'cu', so_cu: 3, nguoi: [{ ten: 'Hạ', x: 0.5 }] }, nVt).includes('Thẻ looks exactly like this'), 'Hạ đang đeo thẻ → tả thẻ chuẩn');
assert.ok(!phieuShot({ co: 'cu', so_cu: 8, nguoi: [{ ten: 'Hạ', x: 0.5 }] }, nVt).includes('looks exactly like this'), 'thẻ đã sang Vivian ngoài khung → không tả');
console.log('phieu-shot.test: ok');
