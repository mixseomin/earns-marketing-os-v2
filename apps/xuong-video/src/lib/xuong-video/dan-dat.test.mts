import assert from 'node:assert';
import { chamCat, chamDanDat, type ShotDanDat } from './dan-dat';

const sh = (id: number, pd: string, vai: string, co: string, nv: number[] = [1], extra: Partial<ShotDanDat> = {}, kt: Record<string, unknown> = {}): ShotDanDat =>
  ({ id, thu_tu: id, phan_doan: pd, nhan_vat: nv, ky_thuat: { vai, co_canh: co, goc: 'ngang', ...kt }, ...extra });
const pc = new Map([['A', { ten: 'A', noi: 'Văn phòng', luc: '09:00', ngay: 'D1' }], ['B', { ten: 'B', noi: 'Thang máy', luc: 'liền sau', ngay: 'D1' }], ['C', { ten: 'C', noi: 'Phòng họp', luc: '15:00', ngay: 'D1' }], ['D', { ten: 'D', noi: 'Thang máy', luc: 'liền sau', ngay: 'D1' }]]);

// cắt nhảy hình: cùng cỡ, cùng góc, cùng người
assert.ok(chamCat(sh(1, 'A', 'hanh_dong', 'ms'), sh(2, 'A', 'phan_ung', 'ms'), pc).tru.some((t) => t.ma === 'nhay_hinh'));
assert.ok(!chamCat(sh(1, 'A', 'hanh_dong', 'ms'), sh(2, 'A', 'phan_ung', 'cu'), pc).tru.length, 'đổi cỡ thì không trừ');
assert.ok(!chamCat(sh(1, 'A', 'hanh_dong', 'ms', [1]), sh(2, 'A', 'phan_ung', 'ms', [2]), pc).tru.length, 'khác người thì không trừ');
assert.ok(!chamCat(sh(1, 'A', 'nguoi_thu_ba', 'ots', [1, 2]), sh(2, 'A', 'phan_ung', 'ots', [1, 2]), pc).tru.length, 'qua vai ↔ qua vai (shot / ngược shot) không phải nhảy hình');
// nhìn mà không đáp
assert.ok(chamCat(sh(1, 'A', 'phan_ung', 'cu', [1], { hanh_dong: 'Thần nhìn Hạ từ trên xuống' }), sh(2, 'A', 'phan_ung', 'mcu'), pc).tru.some((t) => t.ma === 'nhin_khong_dap'));
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu', [1], { hanh_dong: 'Thần nhìn Hạ' }), sh(2, 'A', 'chi_tiet', 'insert', [2]), pc).tru.length, 'cho thấy thứ được nhìn');
// sang cảnh: nơi mới mà vào bằng cận, không cầu nối → trừ; vào bằng toàn cảnh → không
assert.ok(chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'B', 'hanh_dong', 'mcu'), pc).tru.some((t) => t.ma === 'vao_khong_dinh_vi'));
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'B', 'thiet_lap', 'ws'), pc).tru.some((t) => t.ma === 'vao_khong_dinh_vi'));
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu', [1], {}, { chuyen_canh: 'hoa_tan' }), sh(2, 'B', 'hanh_dong', 'mcu'), pc).tru.length, 'chuyển cảnh nối thì không trừ');
assert.ok(!chamCat(sh(1, 'B', 'phan_ung', 'cu'), sh(2, 'D', 'hanh_dong', 'mcu'), pc).tru.some((t) => t.ma === 'vao_khong_dinh_vi'), 'cùng nơi thì không cần định vị lại');
// khép giữa hành động
assert.ok(chamCat(sh(1, 'A', 'hanh_dong', 'ms'), sh(2, 'B', 'thiet_lap', 'ws'), pc).tru.some((t) => t.ma === 'ra_giua_chung'));
// nhảy thời gian không dấu
assert.ok(chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'C', 'thiet_lap', 'ws'), pc).tru.some((t) => t.ma === 'nhay_thoi_gian'));
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'C', 'thoi_gian', 'ws'), pc).tru.some((t) => t.ma === 'nhay_thoi_gian'));

// shot dồn nhịp
assert.ok(chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'A', 'tong_the', 'ws', [1], { hanh_dong: 'Vivian ném giấy; Hạ quỳ nhặt; đồng nghiệp xì xào' }), pc).tru.some((t) => t.ma === 'don_nhip' && t.tru === 8));
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'A', 'hanh_dong', 'ws', [1], { hanh_dong: 'Cửa đôi mở, Hạ bước vào; luật sư Trần theo sau' }), pc).tru.length, '2 nhịp liền một khoảnh khắc');
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'A', 'chi_tiet', 'insert', [1], { hanh_dong: 'Cận cổ tay; lộ chuỗi hạt; cắt đen' }), pc).tru.length, 'ghi chú dựng không tính nhịp');
assert.ok(!chamCat(sh(1, 'A', 'phan_ung', 'cu'), sh(2, 'A', 'tong_the', 'ws', [1], { hanh_dong: 'Hạ quỳ nhặt, đồng nghiệp xì xào' }), pc).tru.length);
// cả tập: khuôn + shot ngoài khuôn
const ds = [sh(1, 'A', 'thiet_lap', 'ws'), sh(2, 'A', 'chi_tiet', 'insert'), sh(3, 'A', 'phan_ung', 'cu'), sh(4, 'B', 'thiet_lap', 'ws')];
const k = chamDanDat(ds, [...pc.values()], [{ khuon: 'phat_hien', shots: { 1: 0, 2: 1, 3: 2 } }], 'phim_doc');
assert.deepStrictEqual(k.ngoaiKhuon, [4]);
assert.ok(k.diemKhuon != null && k.diemKhuon < 100, 'thiếu phủ khuôn thì điểm khuôn < 100');
assert.strictEqual(chamDanDat(ds, [...pc.values()]).diemKhuon, null, 'chưa áp khuôn thì không chấm khuôn');
assert.strictEqual(chamDanDat([], []).diem, 100);
const khongPu = chamDanDat([sh(1, 'A', 'thiet_lap', 'ws'), sh(2, 'A', 'hanh_dong', 'ms', [2]), sh(3, 'A', 'chi_tiet', 'insert', [3])], [...pc.values()]);
assert.ok(khongPu.canh[0]!.tru.some((t) => t.ma === 'khong_phan_ung') && khongPu.diemCat < 100);
console.log('✓ dan-dat');
