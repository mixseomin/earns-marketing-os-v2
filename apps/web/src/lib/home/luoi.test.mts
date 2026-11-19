// node_modules/.bin/tsx apps/web/src/lib/home/luoi.test.mts
import assert from 'node:assert';
import { CX, CY, apKhung, batDinh, boTab, choTrong, day, gop, hopLe, keo, khoa, maTrenMan, moTab, tabsCua, tha, them, type O } from './luoi';

const co = (ma: string) => /^[A-Z]\d+$/.test(ma);
const A: O = { ma: 'A1', x: 0, y: 0, w: 48, h: 12 }, B: O = { ma: 'B1', x: 0, y: 12, w: 24, h: 20 }, C: O = { ma: 'C1', x: 24, y: 12, w: 24, h: 20 };

// hopLe
assert.deepEqual(hopLe([A, B, C], co), [A, B, C]);
assert.equal(hopLe([A, { ...B, ma: 'A1' }], co), null, 'mã lặp');
assert.equal(hopLe([{ ...A, w: 49 }], co), null, 'vượt màn ngang');
assert.equal(hopLe([{ ...A, y: 70 }], co), null, 'vượt màn dọc');
assert.equal(hopLe([{ ...A, w: 2 }], co), null, 'nhỏ hơn tối thiểu');
assert.equal(hopLe([{ ...A, ma: 'la' }], co), null, 'mã lạ');
assert.equal(hopLe([{ ...A, x: Number.NaN }], co), null, 'NaN');
assert.equal(hopLe([{ ...A, tabs: ['B1', 'C1'] }], co), null, 'tab không chứa mã đang mở');
assert.equal(hopLe([{ ...A, tabs: ['A1', 'B1'] }, B], co), null, 'mã lặp giữa tab và ô khác');
assert.deepEqual(hopLe([{ ...A, tabs: ['A1', 'B1'], k: 1, la: 9 }], co), [{ ...A, tabs: ['A1', 'B1'], k: 1 }], 'giữ tab + khoá, bỏ trường lạ');
assert.equal(hopLe('x', co), null);
assert.deepEqual(hopLe([{ ...A, x: 0.004999 }], co)![0]!.x, 0, 'làm tròn 2 số lẻ');

// bắt dính + kéo
assert.equal(batDinh(5.4, 4), 4); assert.equal(batDinh(6.1, 4), 8); assert.equal(batDinh(5.43, 0), 5.45);
assert.deepEqual(keo(B, '', 100, 100, 4), { ...B, x: 24, y: 52 }, 'dời: kẹp trong màn');
assert.deepEqual(keo(B, '', -100, -100, 4), { ...B, x: 0, y: 0 });
assert.deepEqual(keo(B, 'e', 8, 0, 4), { ...B, w: 32 });
assert.deepEqual(keo(B, 'w', 8, 0, 4), { ...B, x: 8, w: 16 });
assert.deepEqual(keo(B, 'w', 100, 0, 4), { ...B, x: 20, w: 4 }, 'đổi cỡ: không nhỏ hơn tối thiểu');
assert.deepEqual(keo(B, 'nw', -100, -100, 4), { ...B, x: 0, y: 0, w: 24, h: 32 });
assert.deepEqual(keo(B, 'se', 100, 100, 4), { ...B, w: 48, h: 60 }, 'đổi cỡ: không vượt màn');
assert.deepEqual(keo(B, 's', 0, -100, 1), { ...B, h: 3 });
for (const t of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', ''] as const) for (const [dx, dy] of [[-200, -200], [200, 200], [3.3, -7.7]]) {
  const c = keo(B, t, dx!, dy!, 0); assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= CX + 1e-9 && c.y + c.h <= CY + 1e-9 && c.w >= 4 && c.h >= 3, `trong màn ${t} ${dx}`);
}

// thả: đè / chặn / đẩy
const len = { ...B, y: 4 };   // B kéo lên đè A
assert.deepEqual(tha([A, B, C], 1, len, 'de'), [A, C, len], 'đè: cho phép, ô vừa đụng lên trên cùng');
assert.ok('loi' in (tha([A, B, C], 1, len, 'chan') as object), 'chặn');
const dayA = tha([A, B, C], 0, { ...A, y: 4 }, 'day') as O[];   // A tụt 4 → B, C bị đẩy xuống 16
assert.deepEqual(dayA.find((o) => o.ma === 'B1')!.y, 16); assert.deepEqual(dayA.find((o) => o.ma === 'C1')!.y, 16);
assert.ok('loi' in (tha([A, { ...B, h: 58 }], 0, { ...A, y: 4 }, 'day') as object), 'đẩy: hết màn');
assert.equal(day([{ ...A, y: 4 }, { ...B, k: 1 }], 0), null, 'đẩy: gặp ô khoá');
assert.deepEqual(day([A, B], 0), [A, B], 'đẩy: không chạm thì nguyên');

// thêm / chỗ trống
assert.deepEqual(choTrong([A], 24, 20), { x: 0, y: 12 });
assert.equal(choTrong([{ ma: 'A1', x: 0, y: 0, w: 48, h: 72 }], 4, 4), null);
assert.deepEqual(them([A], 'B1', [24, 20]), { ds: [A, { ma: 'B1', x: 0, y: 12, w: 24, h: 20 }], kin: false });
assert.equal(them([A], 'A1', [24, 20]).ds.length, 1, 'đã có thì không thêm');
const kin = them([{ ma: 'A1', x: 0, y: 0, w: 48, h: 72 }], 'B1', [24, 20]); assert.equal(kin.kin, true); assert.ok(hopLe(kin.ds, co));
assert.equal(them([{ ...A, tabs: ['A1', 'B1'] }], 'B1', [24, 20]).ds.length, 1, 'đã nằm trong tab thì không thêm');

// tab
const g = gop([A, B, C], 1, 2);
assert.deepEqual(g, [A, { ...C, ma: 'B1', tabs: ['C1', 'B1'] }]); assert.deepEqual(maTrenMan(g), ['A1', 'C1', 'B1']);
assert.deepEqual(gop([A, B, C], 2, 0), [B, { ...A, ma: 'C1', tabs: ['A1', 'C1'] }], 'ô nhận tab nổi lên trên cùng');
assert.deepEqual(moTab(g, 1, 'C1')[1]!.ma, 'C1'); assert.deepEqual(moTab(g, 1, 'Z9')[1]!.ma, 'B1', 'tab lạ thì giữ');
const mac = (): [number, number] => [24, 20];
assert.deepEqual(boTab(g, 1, false, mac), [A, C], 'bỏ tab đang mở, còn một thì hết tabs');
const t = boTab(g, 1, true, mac); assert.equal(t.length, 3); assert.deepEqual(maTrenMan(t).sort(), ['A1', 'B1', 'C1']); assert.ok(hopLe(t, co));
assert.deepEqual(boTab([A, B], 1, false, mac), [A], 'ô một widget: bỏ cả ô');
assert.deepEqual(tabsCua({ ...A, tabs: ['A1'] }), ['A1']);
assert.equal(khoa([A], 0)[0]!.k, 1); assert.equal(khoa(khoa([A], 0), 0)[0]!.k, undefined);

// khung
assert.deepEqual(apKhung([A, B, C], [[0, 0, 12, 3], [0, 3, 12, 15]]), [{ ...A, x: 0, y: 0, w: 48, h: 12 }, { ...B, x: 0, y: 12, w: 48, h: 60 }]);
console.log('✓ luoi: mọi bài đạt');
