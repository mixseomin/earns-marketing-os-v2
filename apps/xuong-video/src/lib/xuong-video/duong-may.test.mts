// Tự kiểm đường máy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/duong-may.test.mts
import assert from 'node:assert';
import { duongMay } from './duong-may';
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
console.log('duong-may: mọi bài tự kiểm qua');
