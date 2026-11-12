// Tự kiểm luật "người nói thấy mặt" + "thoại không nằm trong toàn cảnh" + hướng máy chủ theo cận đối đáp (bo-set-3d.ts, anh 12/11/2026 phim #3071).
// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nguoi-noi.test.mts
import assert from 'node:assert';
import { nguoiNoiKhongThayMat, thoaiToanCanh, nhipDan } from './bo-set-3d';
const may = (huong: number, khung = ['Chú']) => ({ dat: [0, -300, 150], nhin: [0, 0, 150], ong_kinh: 50, khung, vi_tri: [{ ten: 'Chú', tam: [0, 0, 0], huong }, { ten: 'Nhóc', tam: [0, 200, 0], huong: 180 }] }) as never;
const noi = (ngoai_mat = false) => [{ nhan_vat: 'Chú', dien_xuat: '', loi: 'Nhóc, lại đây!', ...(ngoai_mat ? { ngoai_mat } : {}) }];
// đạt: chú quay mặt về máy
assert.deepEqual(nguoiNoiKhongThayMat({ may_3d: may(0), thoai: noi() }), []);
// đỏ: chú quay lưng máy lúc nói
assert.match(nguoiNoiKhongThayMat({ may_3d: may(180), thoai: noi() })[0] ?? '', /không thấy mặt Chú/);
// đỏ: chú nói mà khung là nhóc (cận người nghe)
assert.match(nguoiNoiKhongThayMat({ may_3d: may(0, ['Nhóc']), thoai: noi() })[0] ?? '', /Chú nói mà không có trong khung/);
// miễn: dòng khai ngoai_mat (vừa chạy vừa nói với lại)
assert.deepEqual(nguoiNoiKhongThayMat({ may_3d: may(180), thoai: noi(true) }), []);
// không thoại: không xét
assert.deepEqual(nguoiNoiKhongThayMat({ may_3d: may(180), thoai: [] }), []);
// thoại trong toàn cảnh
assert.equal(thoaiToanCanh({ thoai: noi() as never, ky_thuat: { co_canh: 'ws' } as never }).length, 1);
assert.equal(thoaiToanCanh({ thoai: noi() as never, ky_thuat: { co_canh: 'cu' } as never }).length, 0);
// hướng máy chủ: hai cận A cùng hướng + hai cận B ngược góc (shot / reverse shot) → không báo; một cận A lệch hẳn khỏi nhóm A → báo
const s = (id: number, ten: string, dx: number, dy: number) => ({ id, thu_tu: id, phan_doan: 'c', ky_thuat: { vai: 'hanh_dong' }, may_3d: { dat: [0, 0, 150], nhin: [dx, dy, 150], khung: [ten], vi_tri: [] } as never });
assert.deepEqual(nhipDan([s(1, 'A', 100, 0), s(2, 'B', -100, 10), s(3, 'A', 100, 10), s(4, 'B', -100, 0)]), {});
assert.equal(Object.keys(nhipDan([s(1, 'A', 100, 0), s(2, 'B', -100, 10), s(3, 'A', 0, 100), s(4, 'B', -100, 0), s(5, 'A', 100, 5)])).join(), '3');
// cùng chủ thể nhưng QUAY MẶT sang hướng khác (> 45°) = trục mới: máy theo mặt được phép đổi hậu cảnh
const s2 = (id: number, ten: string, dx: number, dy: number, huong: number) => ({ ...s(id, ten, dx, dy), may_3d: { dat: [0, 0, 150], nhin: [dx, dy, 150], khung: [ten], vi_tri: [{ ten, tam: [0, 0, 0], huong }] } as never });
assert.deepEqual(nhipDan([s2(1, 'A', 100, 0, 90), s2(2, 'A', 100, 10, 90), s2(3, 'A', 0, 100, 180), s2(4, 'A', 5, 100, 180)]), {});
console.log('nguoi-noi.test: ok');
