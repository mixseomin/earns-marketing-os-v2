// Tự kiểm phần đếm của nút 💬 (CHUAN.md): node_modules/.bin/tsx packages/gop-y/src/dem.test.mts
import assert from 'node:assert';
import { choToi, luotDangChay, demTuDs, TRAN_DANG_LAM_MS } from './dem';

const bay = Date.parse('2026-11-17T08:00:00Z');
const truoc = (ms: number) => new Date(bay - ms).toISOString();
const laToi = (n: string) => n === 'anh@x' || n === 'Tuấn';

assert.equal(choToi('claimed', { nguoi: 'claude', xuLy: null }, laToi), true, 'kỹ sư hỏi, chưa ai đáp → chờ tôi');
assert.equal(choToi('pending', { nguoi: 'Tuấn', xuLy: 'rework' }, laToi), false, 'tin cuối là tôi bấm làm lại → không chờ tôi');
assert.equal(choToi('review', { nguoi: 'claude', xuLy: null }, laToi), false, 'đã nộp Review → là "chờ duyệt", không đếm số đỏ');
assert.equal(choToi('broken', null, laToi), true, 'card kẹt → chờ tôi');
assert.equal(choToi('completed', { nguoi: 'claude', xuLy: null }, laToi), false, 'đã xong → không');
assert.equal(choToi('pending', null, laToi), false, 'chưa ai nói gì → không');

assert.equal(luotDangChay({ luc: truoc(60_000), ket: '▶ bắt đầu: cty - Khôi xử hòm góp ý (Claude)' }, bay), 'cty - Khôi xử hòm góp ý (Claude)', 'lượt đang chạy 1 phút');
assert.equal(luotDangChay({ luc: truoc(5_000), ket: '▶ bắt đầu: X' }, bay), null, 'lượt quét rỗng vài giây → chưa tính');
assert.equal(luotDangChay({ luc: truoc(TRAN_DANG_LAM_MS + 1), ket: '▶ bắt đầu: X' }, bay), null, 'quá trần phiên → phiên chết, không rung mãi');
assert.equal(luotDangChay({ luc: truoc(60_000), ket: '■ xong sau 5 phút' }, bay), null, 'dòng cuối là xong → không chạy');
assert.equal(luotDangChay(null, bay), null);

const d = demTuDs([
  { id: 1, noiDung: 'Nút lệch\nchi tiết', trangThai: 'claimed', capNhat: truoc(60_000) },
  { id: 2, noiDung: 'cũ', trangThai: 'claimed', capNhat: truoc(TRAN_DANG_LAM_MS + 1) },
  { id: 3, noiDung: 'hỏi', trangThai: 'claimed', capNhat: truoc(60_000), choYKien: true },
  { id: 4, noiDung: 'kẹt', trangThai: 'broken', capNhat: truoc(60_000) },
], bay);
assert.deepEqual([d.working, d.can_y_kien, d.choYKien], [2, 2, [3, 4]], 'dự phòng: claimed trong trần + chờ ý kiến');
assert.equal(d.dangLam[0], '#1 Nút lệch');
console.log('✓ gop-y dem: chờ ý kiến · lượt kỹ sư đang chạy · dự phòng đếm từ danh sách');
