// Tự kiểm: đồ-vật-cố-định dịch ra phía màn theo MÁY — cùng một cửa, hai máy hai phía → trái/phải LẬT đúng hình học, nhưng số lượng + tường + tính duy nhất
// KHÔNG đổi (anh 31/10/2026: nền "2 cửa" mà cửa nhảy trái / phải mỗi khung). Chạy:
//   NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx src/lib/xuong-video/so-do-co-dinh.test.mts   (cwd apps/xuong-video)
import assert from 'node:assert';
import { benMan, cauBoiCanhCoDinh, coDinhDuKien, type SoDo, type ManhSoDo } from './so-do-canh';

const s: SoDo = {
  moc: { cua: [1, 5], tranh: [-5, 5], ghe: [5, 5], sau_lung: [0, -3] },
  may: { nam: { dat: [0, 0], nhin: [0, 5] }, bac: { dat: [0, 10], nhin: [0, 0] } },
  ten: { cua: 'the elevator doors', tranh: 'the gold-leaf painting', ghe: 'the leather bench', sau_lung: 'the exit' },
  co_dinh: {
    cua: { tuong: 'bac', so: 2, duy_nhat: true },   // cửa ở tường BẮC (la bàn) — bất biến dù máy quay
    tranh: { tuong: 'tay' },
    ghe: { tuong: 'dong' },
    sau_lung: { tuong: 'nam' },
  },
};
const nam: ManhSoDo = { may: 'nam', o: {} };   // máy phía NAM nhìn lên cửa
const bac: ManhSoDo = { may: 'bac', o: {} };   // máy phía BẮC nhìn ngược lại

// 1. LẬT theo máy: cùng cửa, nam → phải màn, bắc → trái màn
assert.strictEqual(benMan(s, nam, 'cua'), 'phai', 'từ nam cửa phải ở phải màn');
assert.strictEqual(benMan(s, bac, 'cua'), 'trai', 'từ bắc cửa phải LẬT sang trái màn');
assert.notStrictEqual(benMan(s, nam, 'cua'), benMan(s, bac, 'cua'), 'đổi góc máy thì phía màn PHẢI đổi');

// 2. Sau lưng máy = không thấy (null)
assert.strictEqual(benMan(s, nam, 'sau_lung'), null, 'mốc sau lưng máy nam không thấy');

// 3. Câu prompt: số lượng + tường + "duy nhất" BẤT BIẾN giữa hai máy; chỉ chỗ-màn đổi
const cNam = cauBoiCanhCoDinh(s, nam), cBac = cauBoiCanhCoDinh(s, bac);
for (const c of [cNam, cBac]) {
  assert.ok(c.includes('exactly 2'), 'luôn giữ "exactly 2"');
  assert.ok(c.includes('north wall'), 'luôn giữ tường bắc (la bàn, bất biến)');
  assert.ok(/only elevator doors in this whole location/.test(c), 'luôn giữ "duy nhất"');
  assert.ok(/never swaps to another wall/.test(c), 'luôn có câu không đổi tường');
}
assert.ok(cNam.includes('at screen-right'), 'nam: cửa ở phải màn');
assert.ok(cBac.includes('at screen-left'), 'bắc: cửa ở trái màn');

// 4. Lá đối chiếu: một lá mỗi món, số + tường giữ, chỗ màn đổi theo máy
const laNam = coDinhDuKien(s, nam);
const cuaNam = laNam.find((x) => x.thanh_phan === 'Đồ cố định the elevator doors');
assert.ok(cuaNam && /2 cái/.test(cuaNam.du_kien) && /tường bắc/.test(cuaNam.du_kien) && /phải màn/.test(cuaNam.du_kien), `lá cửa nam sai: ${cuaNam?.du_kien}`);
const cuaBac = coDinhDuKien(s, bac).find((x) => x.thanh_phan === 'Đồ cố định the elevator doors');
assert.ok(cuaBac && /trái màn/.test(cuaBac.du_kien), `lá cửa bắc phải "trái màn": ${cuaBac?.du_kien}`);

// 5. Sơ đồ không có co_dinh → rỗng (phim cũ không vỡ)
assert.strictEqual(cauBoiCanhCoDinh({ moc: {}, may: { a: { dat: [0, 0], nhin: [0, 1] } } }, { may: 'a', o: {} }), '');
assert.deepStrictEqual(coDinhDuKien({ moc: {}, may: { a: { dat: [0, 0], nhin: [0, 1] } } }, { may: 'a', o: {} }), []);

console.log('✓ so-do-co-dinh: lật theo máy đúng, số lượng + tường bất biến, phim cũ không vỡ');
