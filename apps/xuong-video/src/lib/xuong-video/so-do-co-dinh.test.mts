// Tự kiểm: cấu kiện cố định (so_do.phong) dịch ra phía màn theo MÁY — cùng cụm cửa, hai máy hai phía → trái/phải LẬT đúng hình học, nhưng SỐ LƯỢNG (2 cửa)
// không đổi (anh 31/10/2026: nền "2 cửa" mà cửa nhảy trái / phải mỗi khung vì `phong` chưa bao giờ vào prompt). Chạy:
//   NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx src/lib/xuong-video/so-do-co-dinh.test.mts   (cwd apps/xuong-video)
import assert from 'node:assert';
import { benMan, cauBoiCanhCoDinh, coDinhDuKien, type SoDo, type ManhSoDo, type MangPhong } from './so-do-canh';

const phong: MangPhong[] = [
  { loai: 'tuong', tu: [-3, 5], den: [3, 5], z1: 3 },        // tường sau (y=5) — không được nhắc thành "fixture"
  { loai: 'cua', tu: [0.6, 5], den: [1.4, 5], z1: 2.4 },      // cửa 1, giữa [1, 5]
  { loai: 'cua', tu: [1.4, 5], den: [2.2, 5], z1: 2.4 },      // cửa 2, giữa [1.8, 5] → cụm cửa lệch phải khi nhìn từ nam
  { loai: 'tranh', tu: [-2.8, 5], den: [-2.0, 5], z0: 1, z1: 2 },
];
const s: SoDo = { moc: { cua1: [1, 5] }, may: { nam: { dat: [0, 0], nhin: [0, 5] }, bac: { dat: [0, 10], nhin: [0, 0] } }, phong };
const nam: ManhSoDo = { may: 'nam', o: {} };
const bac: ManhSoDo = { may: 'bac', o: {} };

// 1. benMan một điểm: cửa 1 ([1,5]) từ nam → phải, từ bắc → trái (LẬT)
assert.strictEqual(benMan(s, nam, 'cua1'), 'phai', 'cửa từ nam ở phải màn');
assert.strictEqual(benMan(s, bac, 'cua1'), 'trai', 'cửa từ bắc LẬT sang trái màn');

// 2. Câu prompt: SỐ LƯỢNG "2 doors" + "only doors" bất biến; chỗ-màn đổi theo máy
const cNam = cauBoiCanhCoDinh(s, nam), cBac = cauBoiCanhCoDinh(s, bac);
for (const c of [cNam, cBac]) {
  assert.ok(c.includes('the 2 doors'), `luôn giữ "the 2 doors": ${c}`);
  assert.ok(/ONLY doors in this location/.test(c), 'luôn giữ "chỉ bấy nhiêu cửa"');
}
assert.ok(!coDinhDuKien(s, nam).some((x) => x.thanh_phan === 'Cấu kiện cố định · tường'), 'tường trơn KHÔNG thành lá riêng');
assert.ok(cNam.includes('the 2 doors: at screen-right'), `nam: cụm cửa phải màn: ${cNam}`);
assert.ok(cBac.includes('the 2 doors: at screen-left'), `bắc: cụm cửa trái màn: ${cBac}`);

// 3. Lá đối chiếu: một lá mỗi loại, số lượng giữ, chỗ-màn đổi
const cuaNam = coDinhDuKien(s, nam).find((x) => x.thanh_phan === 'Cấu kiện cố định · cửa');
assert.ok(cuaNam && /2 cửa/.test(cuaNam.du_kien) && /phải màn/.test(cuaNam.du_kien), `lá cửa nam sai: ${cuaNam?.du_kien}`);
const cuaBac = coDinhDuKien(s, bac).find((x) => x.thanh_phan === 'Cấu kiện cố định · cửa');
assert.ok(cuaBac && /trái màn/.test(cuaBac.du_kien), `lá cửa bắc phải "trái màn": ${cuaBac?.du_kien}`);
assert.ok(coDinhDuKien(s, nam).some((x) => x.thanh_phan === 'Cấu kiện cố định · tranh treo tường'), 'phải có lá tranh');

// 4. Sơ đồ không có phong → rỗng (phim cũ không vỡ)
const trong: SoDo = { moc: {}, may: { a: { dat: [0, 0], nhin: [0, 1] } } };
assert.strictEqual(cauBoiCanhCoDinh(trong, { may: 'a', o: {} }), '');
assert.deepStrictEqual(coDinhDuKien(trong, { may: 'a', o: {} }), []);

console.log('✓ so-do-co-dinh: cụm cửa lật theo máy, số lượng bất biến, tường trơn bỏ, phim cũ không vỡ');
