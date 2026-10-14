import assert from 'node:assert';
import { diemNhan } from './diem-nhan';
import type { Lop } from './kieu';

const ds = [{ loai: 'hook', phat: 2.5 }, { loai: 'noi_dau', phat: 2.5 }, { loai: 'noi_dau', phat: 2.5, am: ['mua'] }, { loai: 'giai_phap', phat: 3 }, { loai: 'end_card', phat: 2 }];
const tay: Lop = { id: 'x', loai: 'chu', tu: 0, den: 1, x: 0.5, y: 0.3, w: 0.8, h: 0.1, xoay: 0, mo: 1, vao: 'khong', ra: 'khong', chu: 'Sale' } as Lop;
const kq = diemNhan(ds, [tay]);
// lớp tay giữ nguyên; mỗi điểm cắt (trừ shot lặp loại) một hiệu ứng, đặt đúng giây
assert.ok(kq.lop.includes(tay));
assert.deepStrictEqual(kq.lop.filter((l) => l.loai === 'hieu_ung').map((l) => [l.hu, l.tu, l.den]), [['zoom', 0, 0.5], ['rung', 2.5, 3], ['chop', 7.5, 7.85], ['zoom', 10.5, 11.3]]);
// tiếng: theo loại; shot lặp loại giữ tiếng tay, không thêm 'dap' lần hai
assert.deepStrictEqual(kq.am, [['pop'], ['dap'], ['mua'], ['ding'], ['ka_ching']]);
// chạy lại = thay đúng phần điểm nhấn (không nhân đôi lớp/tiếng)
const lai = diemNhan(ds.map((s, i) => ({ ...s, am: kq.am[i] })), kq.lop);
assert.strictEqual(lai.lop.filter((l) => l.loai === 'hieu_ung').length, 4);
assert.deepStrictEqual(lai.am, kq.am);
console.log('diem-nhan.test: ok');
