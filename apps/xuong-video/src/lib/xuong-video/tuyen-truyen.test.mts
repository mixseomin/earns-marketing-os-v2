// Tự kiểm tuyen-truyen.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/tuyen-truyen.test.mts
import assert from 'node:assert';
import { chamTuyenTruyen, trangThaiGaiTra, tuyenVang, tapCuoiMua, tronAi, themTapAi, apSapKhung } from './tuyen-truyen';
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
// viết tiếp: AI đánh số lệch (2, 3) vẫn nối sau tập cuối (6 → 7, 8); trả chi tiết treo theo nguyên văn; mã tuyến lạ bị bỏ
const w = themTapAi(s, { tap: [{ so: 2, ten: 'X', logline: 'x', loai: 'phieu_luu', nhan_vat: [], boi_canh: [], gai_tra: '' }, { so: 3, ten: 'Y', logline: 'y', loai: 'ket_mua', nhan_vat: [], boi_canh: [], gai_tra: '' }],
  su_kien: [{ so: 2, ma: 'A', viec: 'đi tiếp' }, { so: 2, ma: 'Q', viec: 'lạ' }], gai_tra_moi: [{ chi_tiet: 'mặt dây', gieo: 2, tra: 3 }], tra_cu: [{ chi_tiet: 'Vết sẹo', tra: 3 }, { chi_tiet: 'bản đồ', tra: 2 }] }, () => 'n1');
assert.deepEqual(w.them, [7, 8]);
assert.equal(w.s.tap.find((t) => t.so === 7)!.su_kien!.A, 'đi tiếp'); assert.equal(w.s.tap.find((t) => t.so === 7)!.su_kien!.Q, undefined);
assert.equal(w.s.tap.find((t) => t.so === 7)!.mua, 2);
assert.equal(w.s.so_gai_tra!.find((g) => g.id === '2')!.tra, 8);
assert.equal(w.s.so_gai_tra!.find((g) => g.id === '4')!.tra, 7);   // bản đồ gieo tập 6 → trả tập 7 (≥ gieo) hợp lệ
assert.deepEqual(w.s.so_gai_tra!.find((g) => g.id === 'n1'), { id: 'n1', chi_tiet: 'mặt dây', gieo: 7, tra: 8 });
// cố ý để mở sang mùa sau → không treo, không chặn tập cuối mùa
const s3: Series = { ...s, so_gai_tra: s.so_gai_tra!.map((g) => (g.id === '2' ? { ...g, mo: 'mua_sau' as const } : g)) };
assert.equal(trangThaiGaiTra(s3, s3.so_gai_tra![1]!).muc, 'mo');
assert.equal(chamTuyenTruyen(s3, 5).find((x) => x.key === 'treo_cuoi_mua')!.dat, true);
// để mở sang TẬP sau vẫn tính treo ở cuối mùa (tập sau phải trả)
const s4: Series = { ...s, so_gai_tra: s.so_gai_tra!.map((g) => (g.id === '2' ? { ...g, mo: 'tap_sau' as const } : g)) };
assert.equal(chamTuyenTruyen(s4, 5).find((x) => x.key === 'treo_cuoi_mua')!.dat, false);
// sắp khung: thay làn + sự kiện, đánh dấu chi tiết treo để mở, thêm chi tiết mở mới, bỏ mã lạ / tập lạ
const k = apSapKhung(s, { tuyen: [{ ma: 'A', ten: 'Quan hệ', vai: 'quan_he' }, { ma: 'D', ten: 'Quá khứ', vai: 'qua_khu' }],
  su_kien: [{ so: 1, ma: 'D', viec: 'hé di vật' }, { so: 1, ma: 'Z', viec: 'lạ' }, { so: 2, ma: 'A', viec: 'đảo vai' }],
  mo: [{ chi_tiet: 'vết sẹo', gieo: 2, mo: 'mua_sau' }, { chi_tiet: 'mẹ còn sống?', gieo: 5, mo: 'mua_sau' }, { chi_tiet: 'x', gieo: 99, mo: 'tap_sau' }] }, () => 'm1');
assert.deepEqual(k.tuyen!.map((t) => `${t.ma}:${t.vai}`), ['A:quan_he', 'D:qua_khu']);
assert.deepEqual(k.tap.find((t) => t.so === 1)!.su_kien, { D: 'hé di vật' });
assert.equal(k.tap.find((t) => t.so === 3)!.su_kien, undefined);
assert.equal(k.so_gai_tra!.find((g) => g.id === '2')!.mo, 'mua_sau');
assert.deepEqual(k.so_gai_tra!.find((g) => g.id === 'm1'), { id: 'm1', chi_tiet: 'mẹ còn sống?', gieo: 5, tra: null, mo: 'mua_sau' });
assert.equal(k.so_gai_tra!.length, 5);
console.log('tuyen-truyen tu-kiem ok');
