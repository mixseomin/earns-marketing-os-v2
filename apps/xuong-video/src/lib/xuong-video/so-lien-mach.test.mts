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
assert.ok(s.nhanVat.Tango![1]!.diem === 100 && s.nhanVat.Tango![1]!.muc[0]!.muc === 'ghi', 'khai lệch đã nối = ghi chú, không trừ điểm');
assert.equal(s.nhanVat.Tango![0]!.diem, 100);
import('./so-lien-mach').then(({ chamLoi }) => { assert.equal(chamLoi(['Lint quay ngoắt 90°'], true, null).diem, 92, 'nặng ngoài khung: 20 × 0,4'); });
console.log('so-lien-mach: mọi bài tự kiểm qua');

// SỔ BỀ NGOÀI (phim người thật): khai một lần, các shot sau tự nối; khai lệch = ghi chú; tháo đồ bằng _den; vết thương mang qua ngày;
// ngày mới phải khai lại trang phục (thiếu khai); prompt có 'wearing: …'; bảng theo ngày gom đúng.
import('./bo-set-3d').then(({ noiHookup, thieuKhaiNguoi, trangThaiVat, lienMachTap }) => import('./so-lien-mach').then(({ soLienMach: so, bangNgoai, mucLoi }) => {
  const pcN = [{ ten: 'Văn phòng', ngay: 'N1' }, { ten: 'Biệt thự', ngay: 'D2' }];
  const m1 = (vi_tri: unknown[]) => may(vi_tri);
  const dsN = [
    { id: 1, thu_tu: 1, canh: 'Văn phòng', may_3d: m1([{ ten: 'Bố', tam: [0, 0, 0], trang_phuc: 'navy three-piece suit', do_deo: 'gold watch' }]) },
    { id: 2, thu_tu: 2, canh: 'Văn phòng', may_3d: m1([{ ten: 'Bố', tam: [0, 0, 0], vet_den: 'small cut on left cheek' }]) },
    { id: 3, thu_tu: 3, canh: 'Văn phòng', may_3d: m1([{ ten: 'Bố', tam: [0, 0, 0], trang_phuc: 'grey suit', do_deo_den: '' }]) },
    { id: 4, thu_tu: 4, canh: 'Văn phòng', may_3d: m1([{ ten: 'Bố', tam: [0, 0, 0] }]) },
    { id: 5, thu_tu: 5, canh: 'Biệt thự', may_3d: m1([{ ten: 'Bố', tam: [9, 0, 0] }]) },
  ];
  const hk = noiHookup(dsN as never, pcN);
  const v = (id: number) => hk.may.get(id)!.vi_tri[0]!;
  assert.deepEqual([v(2).trang_phuc, v(2).do_deo], ['navy three-piece suit', 'gold watch'], 'shot sau tự nối trang phục + đồ trên người');
  assert.equal(v(3).trang_phuc, 'navy three-piece suit', 'khai lệch trong ngày: máy nối theo shot trước');
  assert.ok(hk.lech[3]?.some((x) => x.includes('trang phục "grey suit"')) && mucLoi(hk.lech[3]![0]!) === 'ghi', 'khai lệch = ghi chú');
  assert.equal(v(4).do_deo, '', 'tháo đồng hồ trong #3 (do_deo_den "") → #4 không còn');
  assert.deepEqual([v(5).trang_phuc, v(5).vet], [undefined, 'small cut on left cheek'], 'ngày mới: trang phục quên, vết thương mang theo');
  const tk = thieuKhaiNguoi(dsN as never, pcN);
  assert.ok(tk[5]?.some((x) => x.startsWith('thiếu khai trang phục')) && !tk[2] && !tk[4], 'ngày D2 chưa khai trang phục → thiếu khai (một lần)');
  assert.equal(mucLoi(tk[5]![0]!), 'thieu');
  assert.deepEqual(thieuKhaiNguoi([{ id: 1, thu_tu: 1, may_3d: m1([{ ten: 'Tango', tam: [0, 0, 0] }]) }] as never), {}, 'phim không khai bề ngoài: không đòi');
  assert.ok(trangThaiVat(v(2), true)!.includes('wearing: navy three-piece suit') && trangThaiVat(v(2), true)!.includes('visible marks: small cut on left cheek'), 'prompt có bề ngoài');
  assert.deepEqual(lienMachTap(dsN as never, () => null, pcN), {}, 'bản đã nối: cổng sạch');
  // phá thử: cổng vẫn bắt khi bỏ qua hookup (món đang được cầm không nối) — vết thương không tự hết
  assert.ok(lienMachTap([{ id: 1, thu_tu: 1, may_3d: m1([{ ten: 'Mèo', tam: [0, 0, 0], vet: 'bandaged paw' }]) }, { id: 2, thu_tu: 2, may_3d: m1([{ ten: 'Mèo', tam: [0, 0, 0], vet: '', cam: 'Bố' }]) }] as never, () => null)[2]?.some((x) => x.includes('đứt mạch vết thương')), 'cổng bắt vết thương tự hết');
  const s5 = so(dsN as never, pcN, nv);
  const b = bangNgoai(s5.nhanVat['Bố']!);
  assert.deepEqual(b.map((x) => x.ngay), ['N1', 'D2']);
  assert.deepEqual(b[0]!.muc.find((m) => m.ten === 'trang phục')!.gia_tri, [{ t: 'navy three-piece suit', shot: [1, 2, 3, 4] }], 'bảng theo ngày: một bộ cả ngày N1');
  assert.ok(s5.nhanVat['Bố']![4]!.muc.some((m) => m.muc === 'thieu'), 'sổ hiện thiếu khai ở #5');
  console.log('so-lien-mach: sổ bề ngoài qua');
}));
