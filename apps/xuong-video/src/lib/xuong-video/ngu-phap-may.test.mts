// Tự kiểm ngữ pháp máy theo nhịp kịch: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ngu-phap-may.test.mts
import assert from 'node:assert';
import { nhipKich, kiemNguPhapMay, apNguPhapMay } from './ngu-phap-may';

const bc = (nv: string, dau: string, cuoi: string) => ({ nv, dau, cuoi }) as never;
const S = [
  { id: 1, thu_tu: 1, ky_thuat: { co_canh: 'two', goc: 'ngang', chuyen_dong: 'tinh' }, bieu_cam: [bc('Vivian', 'khinh_bi', 'khinh_bi'), bc('Hạ', 'binh_thuong', 'soc')] },
  { id: 2, thu_tu: 2, ky_thuat: { co_canh: 'insert', chuyen_dong: 'tinh' }, bieu_cam: [bc('Hạ', 'nhuc_nha', 'nhan_nhin')] },
  { id: 3, thu_tu: 3, ky_thuat: { co_canh: 'ws', goc: 'thap', chuyen_dong: 'tinh' }, bieu_cam: [bc('Thần', 'lanh_lung', 'lanh_lung')], di_cm: 300 },
  { id: 4, thu_tu: 4, ky_thuat: { co_canh: 'cu', chuyen_dong: 'tinh' }, bieu_cam: [bc('Thần', 'lanh_lung', 'lanh_lung')] },
  { id: 5, thu_tu: 5, ky_thuat: { co_canh: 'two', chuyen_dong: 'tinh' }, bieu_cam: [bc('Trần', 'tu_tin', 'tu_tin')], dan_dung: { muc_dich: 'thân phận lộ ra' } },
  { id: 6, thu_tu: 6, ky_thuat: { co_canh: 'ms', chuyen_dong: 'tinh' }, bieu_cam: [bc('Hạ', 'binh_thuong', 'binh_thuong')] },
  { id: 7, thu_tu: 7, ky_thuat: { co_canh: 'two', chuyen_dong: 'day_vao' }, bieu_cam: [bc('Hạ', 'lanh_lung', 'nhech_moi')], cuoi: true },
];
assert.deepEqual(S.map((c) => nhipKich(c as never)), ['soc', 'nhuc', 'quyen_luc', 'phan_quyet', 'he_lo', null, 'moc'], 'đọc đúng nhịp kịch từng shot (sốc thắng nhục; người đi + uy = quyền lực)');
assert.equal(kiemNguPhapMay(S as never, 'hoat_hinh').length, 0, 'chỉ áp phim ngắn dọc');
const loi = kiemNguPhapMay(S as never, 'phim_doc');
assert.equal(loi.length, 5, 'năm shot có nhịp mà máy đứng yên; shot thường + móc đã đẩy vào không báo');
const sua = apNguPhapMay(S as never, 'phim_doc');
const m = new Map(sua.map((x) => [x.id, x.ky_thuat]));
assert.equal(m.get(1)!.chuyen_dong, 'zoom_gat', 'cú sốc → zoom gắt');
assert.equal(m.get(2)!.chuyen_dong, 'cam_tay', 'sỉ nhục → cầm tay'); assert.equal(m.get(2)!.goc, 'cao', 'sỉ nhục chưa khai góc → nhìn xuống');
assert.equal(m.get(3)!.chuyen_dong, 'dan_truoc', 'quyền lực bước vào → dẫn trước'); assert.equal(m.get(3)!.goc, 'thap', 'giữ góc đã khai');
assert.equal(m.get(4)!.chuyen_dong, 'day_vao', 'phán quyết → đẩy vào');
assert.equal(m.get(5)!.chuyen_dong, 'dolly_zoom', 'hé lộ → dolly zoom');
assert.ok(!m.has(6) && !m.has(7), 'shot thường + shot đã đúng nhịp không đụng');
assert.equal(kiemNguPhapMay(S.map((c) => ({ ...c, ky_thuat: m.get(c.id) ?? c.ky_thuat })) as never, 'phim_doc').length, 0, 'sửa xong thì hết lỗi');
// không trùng shot liền kề (nhịp hình): hai shot phán quyết cùng cỡ liền nhau → shot sau lấy lựa chọn thứ hai
const H = [{ id: 1, thu_tu: 1, ky_thuat: { co_canh: 'cu', chuyen_dong: 'day_vao' }, bieu_cam: [bc('A', 'x', 'lanh_lung')] }, { id: 2, thu_tu: 2, ky_thuat: { co_canh: 'cu', chuyen_dong: 'tinh' }, bieu_cam: [bc('A', 'x', 'lanh_lung')] }];
assert.equal(apNguPhapMay(H as never, 'phim_doc')[0]!.ky_thuat.chuyen_dong, 'zoom_cham', 'tránh trùng shot trước cùng cỡ + cùng chuyển động');
// đi ngắn (lùi một bước) → không dẫn trước; OTS đối đầu → đẩy vào; cận chi tiết hé lộ bằng lia dọc là hợp
const N = [{ id: 1, thu_tu: 1, ky_thuat: { co_canh: 'ms', chuyen_dong: 'tinh' }, bieu_cam: [bc('Hạ', 'x', 'quyet_tam')], di_cm: 90 },
  { id: 2, thu_tu: 2, ky_thuat: { co_canh: 'ots', chuyen_dong: 'tinh' }, bieu_cam: [bc('Hạ', 'x', 'nhan_nhin'), bc('Vivian', 'x', 'gian')] },
  { id: 3, thu_tu: 3, ky_thuat: { co_canh: 'insert', chuyen_dong: 'nghieng_len' }, bieu_cam: [bc('Hạ', 'x', 'nhech_moi')], dan_dung: { muc_dich: 'khán giả biết thân phận trước nhân vật' } }];
const mn = new Map(apNguPhapMay(N as never, 'phim_doc').map((x) => [x.id, x.ky_thuat.chuyen_dong]));
assert.equal(mn.get(1), 'day_vao', 'quyền lực đi ngắn → đẩy vào, không dẫn trước');
assert.equal(mn.get(2), 'day_vao', 'đối đầu qua vai → đẩy vào');
assert.ok(!mn.has(3), 'hé lộ bằng lia dọc ở cận chi tiết là hợp — giữ');
console.log('ngu-phap-may: ok');
