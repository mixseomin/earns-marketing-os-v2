// Tự kiểm tuyen-truyen.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/tuyen-truyen.test.mts
import assert from 'node:assert';
import { chamTuyenTruyen, trangThaiGaiTra, tuyenVang, tapCuoiMua, tronAi } from './tuyen-truyen';
import type { Series } from './kieu';

const tap = (so: number, mua = 1, su_kien?: Record<string, string>) => ({ so, ten: `T${so}`, logline: '', mua, su_kien });
const s: Series = {
  dong_co: 'x', khan_gia: '', dinh_dang: '',
  tap: [tap(1, 1, { A: 'mở' }), tap(2, 1, { A: 'tiếp' }), tap(3, 1), tap(4, 1), tap(5, 1, { A: 'kết mùa', B: 'hé' }), tap(6, 2)],
  tuyen: [{ ma: 'A', ten: 'Chính' }, { ma: 'B', ten: 'Phụ' }],
  so_gai_tra: [
    { id: '1', chi_tiet: 'chìa khoá', gieo: 1, tra: 5 },
    { id: '2', chi_tiet: 'vết sẹo', gieo: 2, tra: null },
    { id: '3', chi_tiet: 'lá thư', gieo: 4, tra: 3 },
    { id: '4', chi_tiet: 'bản đồ', gieo: 6, tra: null },
  ],
};

// trạng thái
assert.equal(trangThaiGaiTra(s, s.so_gai_tra![0]!).muc, 'da_tra');
assert.equal(trangThaiGaiTra(s, s.so_gai_tra![1]!).muc, 'treo');
assert.equal(trangThaiGaiTra(s, s.so_gai_tra![2]!).muc, 'loi');
assert.equal(trangThaiGaiTra(s, { id: 'x', chi_tiet: 'a', gieo: 9, tra: null }).muc, 'loi');
assert.equal(trangThaiGaiTra(s, { id: 'x', chi_tiet: '', gieo: 1, tra: 2 }).muc, 'loi');
assert.equal(tapCuoiMua(s, 2), 5); assert.equal(tapCuoiMua(s, 6), 6);

// tuyến A vắng tập 3–4 (2 tập < ngưỡng 3) → không báo; ngưỡng 2 → báo; B chỉ xuất hiện ở tập cuối → không có đoạn vắng sau
assert.deepEqual(tuyenVang(s), []);
assert.deepEqual(tuyenVang(s, 2), [{ ma: 'A', tu: 3, den: 4, n: 2 }]);
// đoạn vắng ở CUỐI bản đồ cũng tính (A, B dừng ở tập 5, tập 6 trống → 1 tập mỗi tuyến)
assert.deepEqual(tuyenVang(s, 1).filter((v) => v.tu === 6), [{ ma: 'A', tu: 6, den: 6, n: 1 }, { ma: 'B', tu: 6, den: 6, n: 1 }]);
assert.deepEqual(tuyenVang(null), []);

// chấm: tập cuối mùa 1 (tập 5) còn "vết sẹo" treo → chặn; "bản đồ" ở mùa 2 không tính vào mùa 1
const c5 = chamTuyenTruyen(s, 5);
const treo = c5.find((x) => x.key === 'treo_cuoi_mua')!;
assert.equal(treo.dat, false); assert.equal(treo.cung, true); assert.match(treo.ghi, /vết sẹo/); assert.doesNotMatch(treo.ghi, /bản đồ/);
assert.match(c5.find((x) => x.key === 'gai_tra_tap')!.ghi, /phải trả: chìa khoá/);
// trả xong thì hết chặn
const s2: Series = { ...s, so_gai_tra: s.so_gai_tra!.map((g) => (g.id === '2' ? { ...g, tra: 5 } : g)) };
assert.equal(chamTuyenTruyen(s2, 5).find((x) => x.key === 'treo_cuoi_mua')!.dat, true);
// tập giữa mùa không có mục chặn
assert.equal(chamTuyenTruyen(s, 2).some((x) => x.key === 'treo_cuoi_mua'), false);
// tập dính chi tiết ghi sai → báo (không chặn)
const c4 = chamTuyenTruyen(s, 4).find((x) => x.key === 'gai_tra_sai')!;
assert.equal(c4.dat, false); assert.equal(c4.cung, false); assert.match(c4.ghi, /lá thư/);
// sổ rỗng / không series → không mục nào
assert.deepEqual(chamTuyenTruyen({ ...s, so_gai_tra: [] }, 5), []);
assert.deepEqual(chamTuyenTruyen(null, 5), []);
// trộn AI: chỉ điền chỗ trống, không đè chữ người gõ
let n = 0;
const t = tronAi(s, { tuyen: [{ ma: 'A', ten: 'đè' }, { ma: 'C', ten: 'Bí ẩn' }], su_kien: [{ so: 1, ma: 'A', viec: 'đè' }, { so: 3, ma: 'A', viec: 'mới' }, { so: 3, ma: 'Z', viec: 'mã lạ' }],
  gai_tra: [{ chi_tiet: 'Chìa khoá', gieo: 1, tra: 2 }, { chi_tiet: 'chiếc nhẫn', gieo: 2, tra: null }] }, () => `ai${++n}`);
assert.deepEqual(t.tuyen!.map((x) => `${x.ma}:${x.ten}`), ['A:Chính', 'B:Phụ', 'C:Bí ẩn']);
assert.equal(t.tap.find((x) => x.so === 1)!.su_kien!.A, 'mở');
assert.equal(t.tap.find((x) => x.so === 3)!.su_kien!.A, 'mới');
assert.equal(t.tap.find((x) => x.so === 3)!.su_kien!.Z, undefined);
assert.deepEqual(t.so_gai_tra!.slice(4), [{ id: 'ai1', chi_tiet: 'chiếc nhẫn', gieo: 2, tra: null }]);
console.log('tuyen-truyen tu-kiem ok');
