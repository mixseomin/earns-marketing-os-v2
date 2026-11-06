// tự kiểm gom mốc (etp-moc.ts): node_modules/.bin/tsx apps/web/src/lib/etp-moc.test.mts
import assert from 'node:assert';
import { gom, dongBang, moTuHang, roiKhoi, type MocSo } from './etp-moc';

const m = (x: Partial<MocSo>): MocSo => ({ loai: 'tang', camp: 1, h: 22, ty: 1.5, du: 3, c0: 1, t0: 2, c1: 2, t1: 3, c2: 2, t2: 2, c3: 2, t3: 1, ...x });

// khối chỉ cộng mốc đã đủ số khối đó: mốc mới (du 1) không kéo khối 48–72 giờ về 0
const d = gom('x', 'n', 't', [m({}), m({ camp: 2, du: 1, c2: 0, t2: 0, c3: 0, t3: 0 })]);
assert.equal(d.k1.n, 2); assert.equal(d.k2.n, 1); assert.equal(d.k3.n, 1); assert.equal(d.k72.n, 1);
assert.equal(roiKhoi(d.k1), 50, 'khối 1: chi 4 thu 6');
assert.equal(roiKhoi(d.k3), -50, 'khối 3 chỉ mốc đủ 72 giờ: chi 2 thu 1');
assert.equal(d.lai72, 0, 'lãi 72 giờ / mốc: thu 6 − chi 6');
assert.equal(d.am1, 0); assert.equal(d.toc, 2, 'chi 24 giờ sau / trước = 4 / 2');
// ROI dưới $0,3 chi không đọc
assert.equal(roiKhoi({ n: 1, chi: 0.2, thu: 5 }), null);

// dòng theo giờ: thứ tự bắt đầu 07h, giờ không có mốc thì không có dòng; lát cắt bước / ROI trước
const ds = dongBang([m({ h: 7 }), m({ h: 6, ty: 3 }), m({ loai: 'len', h: 9, ty: null, c0: 0, t0: 0 }), m({ loai: 'giam', h: 16, ty: 0.67 })]);
const k = ds.map((x) => x.k);
assert.ok(k.indexOf('tang-7') < k.indexOf('tang-6'), 'giờ xếp từ 07h');
assert.ok(!k.includes('tang-8'), 'giờ trống không có dòng');
assert.ok(k.includes('ty-b1') && k.includes('ty-b3') && !k.includes('ty-b2'));
assert.ok(k.includes('rt-r3'), 'ROI trước 100% → nhóm ≥ 100%');
assert.equal(ds.find((x) => x.k === 'len-all')!.truoc.n, 0, 'lên camp không có số trước mốc');
assert.ok(ds.every((x) => /^\d\|/.test(x.nhom)), 'nhóm có tiền tố thứ tự');
console.log('etp-moc: ok');
// hàng máy chủ → mốc: numeric về dạng chuỗi vẫn ra số, ty null giữ null
const h = moTuHang(['tang', 5, 22, '1.5', 3, '1.00', '2.00', '2', '3', '2', '2', '2', '1']);
assert.equal(h.ty, 1.5); assert.equal(h.c0 + h.t3, 2); assert.equal(moTuHang(['len', 5, 9, null, 1, 0, 0, 1, 1, 0, 0, 0, 0]).ty, null);
console.log('etp-moc hàng: ok');
