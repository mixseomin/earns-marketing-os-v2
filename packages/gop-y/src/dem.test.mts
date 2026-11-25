// Tự kiểm phần đếm của nút 💬 (CHUAN.md): node_modules/.bin/tsx packages/gop-y/src/dem.test.mts
import assert from 'node:assert';
import { choToi, luotDangChay, viecTuNhatKy, demTuDs, chuDaiKySu, TRAN_DANG_LAM_MS } from './dem';

const bay = Date.parse('2026-11-17T08:00:00Z');
const truoc = (ms: number) => new Date(bay - ms).toISOString();
const laToi = (n: string) => n === 'anh@x' || n === 'Tuấn';

assert.equal(choToi('claimed', { nguoi: 'claude', noiDung: '❓ Anh muốn nút ở trái hay phải?', xuLy: null }, laToi), true, 'kỹ sư hỏi (❓), chưa ai đáp → chờ tôi');
assert.equal(choToi('claimed', { nguoi: 'claude', noiDung: 'Đã sửa X, deploy xanh.', xuLy: null }, laToi), false, 'kỹ sư báo, không hỏi → không');
assert.equal(choToi('broken', { nguoi: 'claude', noiDung: '[Khôi · máy] deploy đỏ vì người khác, chờ', xuLy: null }, laToi), false, 'kẹt + tin máy → không (ca #1657)');
assert.equal(choToi('broken', { nguoi: 'claude', noiDung: '❓ Cần anh chọn A hay B', xuLy: null }, laToi), true, 'kẹt mà hỏi thật → chờ tôi');
assert.equal(choToi('pending', { nguoi: 'claude', noiDung: '[máy] ❓ lạ', xuLy: null }, laToi), false, 'tin máy tự ghi → không');
assert.equal(choToi('pending', { nguoi: 'Tuấn', noiDung: '❓', xuLy: 'rework' }, laToi), false, 'tin cuối là tôi bấm làm lại → không chờ tôi');
assert.equal(choToi('review', { nguoi: 'claude', noiDung: '❓ x', xuLy: null }, laToi), false, 'đã nộp Review → là "chờ duyệt", không đếm số đỏ');
assert.equal(choToi('broken', null, laToi), false, 'kẹt một mình → không chờ tôi');
assert.equal(choToi('completed', { nguoi: 'claude', noiDung: '❓ x', xuLy: null }, laToi), false, 'đã xong → không');
assert.equal(choToi('pending', null, laToi), false, 'chưa ai nói gì → không');

assert.equal(luotDangChay({ luc: truoc(60_000), ket: '▶ bắt đầu: cty - Khôi xử hòm góp ý (Claude)' }, bay), 'cty - Khôi xử hòm góp ý (Claude)', 'lượt đang chạy 1 phút');
assert.equal(luotDangChay({ luc: truoc(5_000), ket: '▶ bắt đầu: X' }, bay), null, 'lượt quét rỗng vài giây → chưa tính');
assert.equal(luotDangChay({ luc: truoc(TRAN_DANG_LAM_MS + 1), ket: '▶ bắt đầu: X' }, bay), null, 'quá trần phiên → phiên chết, không rung mãi');
assert.equal(luotDangChay({ luc: truoc(60_000), ket: '■ xong sau 5 phút' }, bay), null, 'dòng cuối là xong → không chạy');
assert.equal(luotDangChay(null, bay), null);
const bd = { luc: truoc(60_000), ket: '▶ bắt đầu: cty - Khôi xử hòm góp ý (Claude)' };
assert.equal(viecTuNhatKy([bd, { luc: truoc(30_000), ket: '◆ nhận việc giao: Dải AI · opus low' }], bay), 'việc giao: Dải AI', '◆ sau ▶ → đúng việc');
assert.equal(viecTuNhatKy([{ ket: '◆ nhận card #9: cũ' }, bd], bay), 'cty - Khôi xử hòm góp ý (Claude)', '◆ trước ▶ là lượt cũ → tên job');
assert.equal(viecTuNhatKy([bd, { ket: '◆ nhận card #9: X' }, { luc: truoc(1000), ket: '■ xong' }], bay), null, 'đã xong → rảnh');

const d = demTuDs([
  { id: 1, noiDung: 'Nút lệch\nchi tiết', trangThai: 'claimed', capNhat: truoc(60_000) },
  { id: 2, noiDung: 'cũ', trangThai: 'claimed', capNhat: truoc(TRAN_DANG_LAM_MS + 1) },
  { id: 3, noiDung: 'hỏi', trangThai: 'claimed', capNhat: truoc(60_000), choYKien: true },
  { id: 4, noiDung: 'kẹt', trangThai: 'broken', capNhat: truoc(60_000) },
], bay);
assert.deepEqual([d.working, d.can_y_kien, d.choYKien], [2, 1, [3]], 'dự phòng: claimed trong trần + chờ ý kiến');
assert.equal(d.dangLam[0], '#1 Nút lệch');
assert.deepEqual(d.treo, ['#2 cũ (45 phút)'], 'claimed quá trần → treo, kèm tuổi');
assert.deepEqual([d.ket, d.ketDs], [2, ['#4 kẹt', '#2 cũ (45 phút)']], 'kẹt = broken + treo → chấm đỏ (anh 25/11/2026)');
assert.equal(demTuDs([{ id: 5, noiDung: 'x', trangThai: 'claimed', capNhat: truoc(60_000) }], bay).ket, 0, 'đang làm trong trần → không chấm đỏ');
// #1746: card claimed 2 giờ, không phiên nào chạy → dải KHÔNG được nói "rảnh"
const t = demTuDs([{ id: 1746, noiDung: 'Xử lý rủi ro anglebrief', trangThai: 'claimed', capNhat: truoc(2 * 3600_000) }], bay);
assert.equal(t.working, 0);
assert.deepEqual(t.treo, ['#1746 Xử lý rủi ro anglebrief (2 giờ)']);
const nhan = chuDaiKySu({ ...t, kySu: { ten: 'Đạt', tat: false } }).nhan;
assert.ok(!/rảnh/.test(nhan) && /Đang làm/.test(nhan), `có card treo → không "rảnh": ${nhan}`);
assert.equal(chuDaiKySu({ ...demTuDs([], bay), kySu: { ten: 'Đạt', tat: false } }).nhan, '🤖 Đạt đang rảnh', 'không card nào → rảnh');
console.log('✓ gop-y dem: chờ ý kiến · lượt kỹ sư đang chạy · dự phòng đếm từ danh sách');
