// Tự kiểm: SỔ TRANG PHỤC CARRY (lookMang) cho shot 2D — khai vết MỘT LẦN tại shot mốc → tự mang sang mọi shot sau; đổi đồ thì vết (bám đồ) hết;
// sang ngày truyện mới reset hết. Chạy:
//   NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx src/lib/xuong-video/look-mang.test.mts   (cwd apps/xuong-video)
import assert from 'node:assert';
import { lookMang, hopTap } from './bo-set-3d';
import type { BienThe, NhanVat } from './kieu';

const bt = (id: number, nhan_vat_id: number, nhom: string, ten: string): BienThe => ({ id, nhan_vat_id, nhom, ten, mo_ta: ten, anh_url: `u${id}` });
// Lâm Hạ (1): áo sơ mi sạch (10), vết cà phê (11, nhóm vet), đầm công sở ngày 2 (12). Vivian (2): đầm đỏ (20).
const nhanVat: (Pick<NhanVat, 'id' | 'ten' | 'loai'> & { bien_the?: BienThe[] })[] = [
  { id: 1, ten: 'Lâm Hạ', loai: 'nhan_vat', bien_the: [bt(10, 1, 'trang_phuc', 'Sơ mi trắng'), bt(11, 1, 'vet', 'Vết cà phê ngực trái'), bt(12, 1, 'trang_phuc', 'Đầm xanh ngày 2')] },
  { id: 2, ten: 'Vivian', loai: 'nhan_vat', bien_the: [bt(20, 2, 'trang_phuc', 'Đầm đỏ')] },
];
// Ngày 1: shot 1 áo sạch; shot 2 ĐỔ cà phê (khai vết); shot 3+4 KHÔNG khai lại. Ngày 2: shot 5 đổi đầm.
const phanCanh = [
  { ten: 'Sảnh', ngay: 'Ngày 1', lien_truoc: true },
  { ten: 'Thang máy', ngay: 'Ngày 1', lien_truoc: true },
  { ten: 'Văn phòng', ngay: 'Ngày 2', lien_truoc: true },
];
const ds = [
  { id: 101, canh: 'Sảnh', nhan_vat: [1, 2], bien_the: [10, 20] },
  { id: 102, canh: 'Sảnh', nhan_vat: [1], bien_the: [10, 11] },        // đổ cà phê: khai vết
  { id: 103, canh: 'Thang máy', nhan_vat: [1, 2], bien_the: [10, 20] }, // KHÔNG khai vết → phải carry
  { id: 104, canh: 'Thang máy', nhan_vat: [1], bien_the: [] },          // không khai gì → vẫn carry áo + vết
  { id: 105, canh: 'Văn phòng', nhan_vat: [1], bien_the: [12] },        // ngày 2, đổi đầm → vết hết
];
const r = lookMang(ds, nhanVat, phanCanh);
const look = (cid: number, ten: string) => r.get(cid)!.get(ten)!;

// shot 1: áo sạch, chưa vết
assert.strictEqual(look(101, 'Lâm Hạ').trang_phuc?.id, 10, 'shot1 áo sạch');
assert.strictEqual(look(101, 'Lâm Hạ').vet, undefined, 'shot1 chưa vết');
assert.strictEqual(look(101, 'Vivian').trang_phuc?.id, 20, 'shot1 Vivian đầm đỏ');
// shot 2: khai vết
assert.strictEqual(look(102, 'Lâm Hạ').vet?.id, 11, 'shot2 bật vết');
assert.strictEqual(look(102, 'Lâm Hạ').trang_phuc?.id, 10, 'shot2 vẫn áo sạch');
// shot 3: KHÔNG khai lại vết → carry (đây là cái chính: khai một lần)
assert.strictEqual(look(103, 'Lâm Hạ').vet?.id, 11, 'shot3 carry vết dù không khai lại');
assert.strictEqual(look(103, 'Lâm Hạ').trang_phuc?.id, 10, 'shot3 carry áo');
// shot 4: không khai gì → vẫn carry cả áo lẫn vết
assert.strictEqual(look(104, 'Lâm Hạ').vet?.id, 11, 'shot4 vẫn carry vết');
assert.strictEqual(look(104, 'Lâm Hạ').trang_phuc?.id, 10, 'shot4 vẫn carry áo');
// shot 5: sang ngày 2 + đổi đầm → reset, vết hết
assert.strictEqual(look(105, 'Lâm Hạ').trang_phuc?.id, 12, 'shot5 đầm ngày 2');
assert.strictEqual(look(105, 'Lâm Hạ').vet, undefined, 'shot5 sang ngày + đổi đồ → vết hết');

// ĐỔI ĐỒ trong CÙNG ngày cũng làm vết (bám đồ) hết — kiểm riêng: shot khai trang_phuc khác sau khi có vết
const ds2 = [
  { id: 201, canh: 'Sảnh', nhan_vat: [1], bien_the: [10, 11] },  // áo sạch + vết
  { id: 202, canh: 'Sảnh', nhan_vat: [1], bien_the: [12] },      // đổi sang đầm (cùng ngày) → vết hết
];
const r2 = lookMang(ds2, nhanVat, [{ ten: 'Sảnh', ngay: 'Ngày 1', lien_truoc: true }]);
assert.strictEqual(r2.get(201)!.get('Lâm Hạ')!.vet?.id, 11, 'ds2 shot1 có vết');
assert.strictEqual(r2.get(202)!.get('Lâm Hạ')!.trang_phuc?.id, 12, 'ds2 shot2 đổi đầm');
assert.strictEqual(r2.get(202)!.get('Lâm Hạ')!.vet, undefined, 'ds2 đổi đồ cùng ngày → vết bám đồ cũng hết');

// TRANG PHỤC THEO TẬP: nhân vật có bộ riêng mỗi tập; tapSo → bộ hợp tập làm MẶC ĐỊNH, shot KHÔNG cần khai vẫn mặc đúng; bộ khác tập không rò sang.
const bt2 = (id: number, nvid: number, nhom: string, ten: string, dung_tap?: number[]): BienThe => ({ id, nhan_vat_id: nvid, nhom, ten, mo_ta: ten, anh_url: `u${id}`, dung_tap });
const nvTap: (Pick<NhanVat, 'id' | 'ten' | 'loai'> & { bien_the?: BienThe[] })[] = [
  { id: 1, ten: 'An', loai: 'nhan_vat', bien_the: [bt2(30, 1, 'trang_phuc', 'Vest xám', [1]), bt2(31, 1, 'trang_phuc', 'Áo thun', [2]), bt2(32, 1, 'toc', 'Tóc ngắn')] },  // tóc không gắn tập = mọi tập
];
// hopTap: không khai = mọi tập; khai thì chỉ tập đó
assert.ok(hopTap({ dung_tap: null }, 5) && hopTap({ dung_tap: [] }, 5), 'không khai dung_tap = mọi tập');
assert.ok(hopTap({ dung_tap: [1, 3] }, 3) && !hopTap({ dung_tap: [1, 3] }, 2), 'khai dung_tap = chỉ tập trong danh sách');
const dsT = [{ id: 301, canh: 'C', nhan_vat: [1], bien_the: [] }];   // shot KHÔNG khai trang phục
const pcT = [{ ten: 'C', ngay: 'Ngày 1', lien_truoc: true }];
assert.strictEqual(lookMang(dsT, nvTap, pcT, 1).get(301)!.get('An')!.trang_phuc?.id, 30, 'tập 1: mặc định Vest xám (không khai vẫn đúng)');
assert.strictEqual(lookMang(dsT, nvTap, pcT, 2).get(301)!.get('An')!.trang_phuc?.id, 31, 'tập 2: mặc định Áo thun');
assert.strictEqual(lookMang(dsT, nvTap, pcT, 2).get(301)!.get('An')!.toc?.id, 32, 'tóc không gắn tập vẫn là mặc định mọi tập');
assert.strictEqual(lookMang(dsT, nvTap, pcT).get(301)!.get('An')!.trang_phuc, undefined, 'không truyền tập → không seed mặc định (giữ hành vi cũ)');

console.log('✓ look-mang: khai vết một lần tự mang sang shot sau; không khai lại vẫn carry; đổi đồ / sang ngày thì vết hết; mỗi nhân vật look riêng; trang phục theo tập (bộ mặc định + hopTap)');
