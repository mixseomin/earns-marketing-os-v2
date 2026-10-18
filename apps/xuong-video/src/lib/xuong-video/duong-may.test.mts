// Tự kiểm đường máy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/duong-may.test.mts
import assert from 'node:assert';
import { duongMay, hopVat } from './duong-may';
const m = { dat: [0, -20, 5], nhin: [0, 0, 2], ong_kinh: 40, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [6, 0, 0] }] };
const kc = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
assert.equal(duongMay(m, null), null);
assert.equal(duongMay(m, 'tinh'), null);   // máy tĩnh
assert.equal(duongMay(m, 'fpv'), null);    // bay tự do chưa dựng
assert.ok(duongMay(m, 'cam_tay')?.rung);   // cầm tay: đứng chỗ, rung
const d = duongMay(m, 'day_vao')!; assert.ok(Math.abs(kc(d.dat, d.nhin) - kc(m.dat, m.nhin) / 1.6) < 0.05, 'đẩy vào: khoảng cách ÷1,6');
const l = duongMay(m, 'lui_ra')!; assert.ok(Math.abs(kc(l.dat, l.nhin) - kc(m.dat, m.nhin) * 2) < 0.05, 'lùi ra: khoảng cách ×2');
const z = duongMay(m, 'zoom_gat')!; assert.equal(z.ong_kinh, 100); assert.deepEqual(z.dat, m.dat);
const c = duongMay(m, 'cau')!; assert.ok(c.dat[2]! > m.dat[2]!, 'cẩu lên: máy cao hơn'); assert.deepEqual(c.nhin, m.nhin);
const t = duongMay(m, 'theo')!; assert.deepEqual(t.dat, [6, -20, 5]);   // bám theo: dời đúng quãng chủ thể đi
const tr = duongMay(m, 'truot_ngang')!; assert.deepEqual(tr.dat, [6, -20, 5], 'tracking: máy song song cả quãng chủ thể đi');
const m3 = { ...m, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [6, -15, 0] }] }; const tc = duongMay(m3, 'truot_ngang')!; assert.deepEqual(tc.nhin, [6, -15, 2], 'đi chéo về phía máy: điểm nhìn theo đúng chủ thể');
const tn = duongMay({ ...m, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0] }] }, 'truot_ngang')!; assert.ok(Math.abs(tn.dat[0]!) > 3, 'đứng yên: trượt ngang 20 %');
const li = duongMay(m, 'lia')!; assert.ok(li.nhin[0]! > 0, 'lia theo chủ thể sang phải'); assert.deepEqual(li.dat, m.dat);
const vo = duongMay(m, 'vong')!; assert.ok(Math.abs(kc(vo.dat, m.nhin) - kc(m.dat, m.nhin)) < 0.05, 'quay vòng giữ khoảng cách');
const ng = duongMay(m, 'nghieng_len')!; assert.ok(ng.nhin[2]! > m.nhin[2]!, 'nghiêng lên');
const m2 = { ...m, vi_tri: [...m.vi_tri, { ten: 'Lint', tam: [5, 3, 0] }], nham: 'Lint' };
const zl = duongMay(m2, 'zoom_gat')!; assert.deepEqual(zl.nhin.slice(0, 2), [5, 3], 'zoom nhắm đích danh Lint');
const doc = duongMay({ ...m, dat: [0, -20, 0.5], vi_tri: [{ ten: 'Tango', tam: [0, 0, 2.3], den: [6, 0, 0.3] }] }, 'truot_ngang')!; assert.ok(doc.dat[2]! >= 0.3, 'không chui dưới mặt bàn');
const xa = duongMay({ ...m, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [48, -18, 0] }] }, 'truot_ngang')!; assert.ok(Math.abs(xa.dat[0]! - 48 * 0.35) < 0.05 && xa.nhin[0] === 48 && xa.nhin[1] === -18, 'đi xa: dolly 35 %, đầu máy lia tới đúng chỗ kết');
// vật cản giữa đường dolly: máy thu ngắn quãng, không chui vào vật; không có vật cản thì đi đủ
const can = hopVat([{ ten: 'iMac', hinh: 'hop', tam: [10, -18, 0], co: [6, 4, 20], mau: '#ff0' }]);
const tc2 = duongMay({ ...m, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [20, 0, 0] }] }, 'truot_ngang', can)!;
assert.ok(tc2.dat[0]! < 7, 'dừng trước vật cản'); assert.equal(tc2.nhin[0], 20, 'đầu máy vẫn bám chủ thể');
assert.equal(duongMay({ ...m, vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [20, 0, 0] }] }, 'truot_ngang')!.dat[0], 20);
assert.equal(hopVat([{ ten: 'Bàn', hinh: 'hop', tam: [0, 0, -3], co: [100, 100, 3], mau: '#000', nen: true }]).length, 0, 'mặt nền không tính');
// vật che đường nhìn lúc kết: cẩu máy lên tới khi thấy chủ thể
const che = hopVat([{ ten: 'iMac', hinh: 'hop', tam: [10, -9, 0], co: [30, 2, 3], mau: '#ff0' }]);
const ln = duongMay({ ...m, dat: [0, -20, 1], vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [20, 0, 0] }] }, 'truot_ngang', che)!;
assert.ok(ln.dat[2]! > 1, 'bị che → máy cao lên');
const tuong = hopVat([{ ten: 'Tường', hinh: 'hop', tam: [10, -9, 0], co: [60, 2, 80], mau: '#fff' }]);
assert.equal(duongMay({ ...m, dat: [0, -20, 1], vi_tri: [{ ten: 'Tango', tam: [0, 0, 0], den: [20, 0, 0] }] }, 'truot_ngang', tuong)!.che, 'Tường', 'che hẳn → gắn cờ');
const ph3 = duongMay({ ...m2, vi_tri: [m2.vi_tri[0]!, { ten: 'Lint', tam: [5, 3, 0], dien: ['phong3@0.05-0.3'] }] }, 'zoom_gat', [], () => 2)!;
assert.ok(ph3.nhin[2]! >= 3 && ph3.ong_kinh < 100, 'phồng ×3: nhắm giữa thân phồng, zoom chừa chỗ');
// CHUYỂN CHỦ THỂ: máy đứng, đầu máy rời A dừng trên B (khai chuyen_toi, không thì người thứ hai của khung) ở 85 % chiều cao B; cờ ket cho bản 3D
const ho = { dat: [0, -300, 150], nhin: [0, 0, 140], ong_kinh: 35, khung: ['Thần', 'Hạ'], vi_tri: [{ ten: 'Thần', tam: [0, 0, 0], den: [-100, 50, 0] }, { ten: 'Hạ', tam: [200, 100, 0] }] };
const cc = duongMay(ho, 'chuyen_chu_the', [], () => 165)!;
assert.deepEqual(cc.dat, ho.dat, 'máy đứng'); assert.deepEqual(cc.nhin, [200, 100, 140.25], 'dừng trên Hạ ở tầm mặt'); assert.equal(cc.ket, true);
assert.deepEqual(duongMay({ ...ho, chuyen_toi: 'Thần' }, 'chuyen_chu_the', [], () => 165)!.nhin, [-100, 50, 140.25], 'chuyen_toi khai tay thắng');
assert.ok(!duongMay(ho, 'day_vao')!.ket, 'cú thường không cần khung kết');
assert.equal(duongMay(ho, 'cung')!.ket, true);
// VƯỢT TIỀN CẢNH: trượt ngang 30 % khoảng cách, vuông góc hướng nhìn, không bám quãng người đi (người đi THẲNG về máy thì máy không lùi)
const vq = duongMay({ dat: [-90, 175, 120], nhin: [-470, 175, 135], ong_kinh: 24, vi_tri: [{ ten: 'Hạ', tam: [-470, 160, 0], den: [-200, 200, 0] }] }, 'vuot_tien_canh')!;
assert.equal(vq.dat[0], -90, 'không lùi theo người'); assert.ok(vq.dat[1]! > 175 + 100, 'trượt ngang về phía người trôi'); assert.equal(vq.ket, true);
console.log('duong-may: mọi bài tự kiểm qua');
