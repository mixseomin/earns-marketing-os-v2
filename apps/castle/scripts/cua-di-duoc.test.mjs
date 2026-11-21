// tự kiểm cuaDiDuoc (mattien.js): cửa vào chỉ thành lỗ đi qua khi đủ rộng + đủ cao (ngưỡng doc_mat.NGUONG) và đất trước cửa ngang chân cửa — node scripts/cua-di-duoc.test.mjs
import assert from 'node:assert';
const { cuaDiDuoc, loTrung, nhuongSo, khopCum } = await import(new URL('../public/mattien.js', import.meta.url));
const d = { t0: 0, t1: 1.2, ra: 0, a0: [0, 0], u: [1, 0], n: [0, 1] }, dat = () => 10;
const c = { loai: 'lo', cua: 'cua_vao', y0: 10, y1: 12.4, w: 1.2, h: 2.4 };
assert.equal(cuaDiDuoc(c, d, dat), 10, 'cửa đủ cỡ, đất ngang → đi được');
assert.equal(cuaDiDuoc({ ...c, w: 0.52 }, d, dat), null, 'hẹp 0,52 → không');
assert.equal(cuaDiDuoc({ ...c, h: 1.2 }, d, dat), null, 'thấp → không');
assert.equal(cuaDiDuoc(c, d, () => 13), null, 'đất trước cửa cao hơn 3 m → không');
assert.equal(cuaDiDuoc({ ...c, w: 0.8 }, d, dat, { cua_w: 0.9 }), null, 'ngưỡng sổ thắng mặc định');
// sổ ô cửa đã có: lỗ sổ đo đè lên ô cửa bộ dựng khác → bỏ; lệch hẳn sang bên / khác mặt → giữ (bài phá); trên mặt dựng riêng → bỏ
const lo = { loai: 'lo', y0: 10, y1: 11.6, w: 1, h: 1.6 }, dl = { t0: 4.5, t1: 5.5, ra: 0, a0: [0, 0], u: [1, 0], n: [0, 1] };
const o = { x: 5.2, y: 10.1, z: 0.1, nx: 0, nz: 1, nua: 0.5, cao: 1.5 };
assert.equal(loTrung(lo, dl, [o]), true, 'đè ô cửa đã có (lệch 0,2 m) → trùng');
assert.equal(loTrung(lo, dl, [{ ...o, x: 7 }]), false, 'ô cửa cách 2 m → không trùng');
assert.equal(loTrung(lo, dl, [{ ...o, nx: 1, nz: 0 }]), false, 'mặt vuông góc → không trùng');
assert.equal(loTrung(lo, dl, [{ ...o, y: 14 }]), false, 'tầng trên → không trùng');
assert.equal(loTrung(lo, dl, [], [{ x1: 0, z1: 0, x2: 10, z2: 0 }]), true, 'nằm trên mặt dựng riêng → trùng');
assert.equal(loTrung(lo, dl, [], [{ x1: 0, z1: 5, x2: 10, z2: 5 }]), false, 'mặt dựng riêng song song cách 5 m → không');
// ô ĐOÁN nhường lỗ ĐO: ô đoán đè lỗ đo đủ cỡ → nhường; lệch sang bên / lỗ quá nhỏ / không phải lỗ → không (bài phá)
const doSo = [{ ...lo, doan: [dl] }];
assert.equal(nhuongSo(o, doSo), true, 'ô đoán đè lỗ đo → nhường');
assert.equal(nhuongSo({ ...o, x: 7 }, doSo), false, 'ô đoán cách 2 m → giữ');
assert.equal(nhuongSo(o, [{ ...lo, h: 0.1, doan: [dl] }]), false, 'lỗ đo dưới ngưỡng cao → không dựng được → giữ ô đoán');
assert.equal(nhuongSo(o, [{ ...lo, loai: 'go', doan: [dl] }]), false, 'gờ không phải lỗ → giữ');
assert.equal(nhuongSo(o, doSo, { lo_h: 2 }), false, 'ngưỡng sổ thắng mặc định');
// cụm tay khớp sổ đo: cụm 4 ô rộng lấn ra ngoài, sổ thấy 2 ô ở mép phải → cụm thành 2 ô đúng chỗ; một lỗ cho cụm nhiều ô → giữ (bài phá); lỗ khác tầng → giữ
const cumT = { s: 0, y: 10, h: 2, n: 4, w: 0.8, buoc: 1 }; // ô tâm −1,5 · −0,5 · 0,5 · 1,5
const k2 = khopCum([cumT], [{ s0: 0.2, s1: 0.72, y0: 10.1, y1: 12 }, { s0: 1.04, s1: 1.76, y0: 10, y1: 12.1 }, { s0: 1.1, s1: 1.7, y0: 10, y1: 12 }])[0];
assert.equal(k2.n, 2, 'hai lỗ (một lỗ trùng gộp) → cụm 2 ô'); assert.ok(Math.abs(k2.s - 0.93) < 0.02, 'tâm cụm theo lỗ: ' + k2.s);
assert.equal(khopCum([cumT], [{ s0: 0.2, s1: 0.72, y0: 10, y1: 12 }])[0].khop, 0, 'một lỗ cho cụm 4 ô → giữ cụm tay');
assert.equal(khopCum([cumT], [{ s0: 0.2, s1: 0.72, y0: 14, y1: 16 }, { s0: 1, s1: 1.7, y0: 14, y1: 16 }])[0].khop, 0, 'lỗ tầng khác → giữ cụm tay');
assert.equal(khopCum([cumT], [{ s0: 5, s1: 5.5, y0: 10, y1: 12 }, { s0: 6, s1: 6.5, y0: 10, y1: 12 }])[0].khop, 0, 'lỗ xa ngoài tầm cụm → giữ cụm tay');
console.log('20/20 ✓');
