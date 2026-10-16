// Tự kiểm sổ liền mạch: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-lien-mach.test.mts
import assert from 'node:assert';
import { soLienMach, chuDang } from './so-lien-mach';
const nv = [{ ten: 'Tango', khoi_3d: { hinh: 'trung', co: [1.7, 1.4, 2.6], mau: '#f80' } }, { ten: 'Lint', khoi_3d: { hinh: 'cau', co: [2, 2, 2], mau: '#555' } }] as never;
const may = (vi_tri: unknown[], nhay?: string) => ({ dat: [0, -10, 1], nhin: [0, 0, 1], ong_kinh: 35, vi_tri, ...(nhay ? { nhay } : {}) }) as never;
const pc = [{ ten: 'Kẹo', ngay: 'N1' }, { ten: 'Sáng', ngay: 'D2' }];
const ds = [
  { id: 1, thu_tu: 1, canh: 'Cảnh 1 · Kẹo', may_3d: may([{ ten: 'Tango', tam: [0, 0, 0], den: [3, 0, 0] }, { ten: 'Lint', tam: [5, 0, 0] }]) },
  { id: 2, thu_tu: 2, canh: 'Cảnh 1 · Kẹo', may_3d: may([{ ten: 'Tango', tam: [3, 0, 0], nam: true }]) },          // đứng → nằm qua cú cắt: lỗi
  { id: 3, thu_tu: 3, canh: 'Cảnh 2 · Sáng', may_3d: may([{ ten: 'Tango', tam: [40, 0, 0] }]) },                    // sang ngày D2: reset
];
const s = soLienMach(ds, pc, nv);
assert.equal(s.nhanVat.Tango!.length, 3); assert.equal(s.nhanVat.Lint!.length, 1);
assert.ok(s.nhanVat.Tango![1]!.loi.some((x) => x.includes('khai mở nằm')), 'dòng #2 báo khai lệch dáng');
assert.deepEqual([s.nhanVat.Tango![1]!.nam, s.nhanVat.Tango![1]!.noi, s.nhanVat.Tango![2]!.noi], [false, 1, null], 'sổ hiện dáng ĐÃ NỐI (đứng, ⛓#1); ngày mới không nối');
assert.equal(s.nhanVat.Tango![0]!.loi.length, 0); assert.equal(s.nhanVat.Tango![2]!.loi.length, 0, 'sang ngày mới không bắt');
assert.equal(s.nhanVat.Tango![2]!.luong_moi, 'ngay'); assert.equal(s.nhanVat.Tango![2]!.ngay, 'D2');
assert.deepEqual(s.canh.map((c) => [c.ten, c.ngay, c.shot]), [['Kẹo', 'N1', [1, 2]], ['Sáng', 'D2', [3]]]);
assert.equal(chuDang({ nam: false, nam_den: true }), 'đứng → ngã');
assert.ok(s.nhanVat.Tango![1]!.diem >= 90 && s.nhanVat.Tango![1]!.muc[0]!.muc === 'nhe', 'khai lệch đã nối = nhẹ (máy dựng đúng)');
assert.equal(s.nhanVat.Tango![0]!.diem, 100);
import('./so-lien-mach').then(({ chamLoi }) => { assert.equal(chamLoi(['Lint quay ngoắt 90°'], true, null).diem, 92, 'nặng ngoài khung: 20 × 0,4'); });
console.log('so-lien-mach: mọi bài tự kiểm qua');
