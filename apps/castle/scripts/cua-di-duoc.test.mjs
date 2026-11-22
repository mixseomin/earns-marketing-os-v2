// tự kiểm cuaDiDuoc (mattien.js): cửa vào chỉ thành lỗ đi qua khi đủ rộng + đủ cao (ngưỡng doc_mat.NGUONG) và đất trước cửa ngang chân cửa — node scripts/cua-di-duoc.test.mjs
import assert from 'node:assert';
const { cuaDiDuoc, loTrung, nhuongSo, khopCum, deKhung, oCuaLo, KHE_LO } = await import(new URL('../public/mattien.js', import.meta.url));
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
{ const k1 = khopCum([cumT], [{ s0: 0.2, s1: 0.72, y0: 10.2, y1: 12 }])[0]; // một lỗ: giữ 4 ô + bước tay, ô gần nhất (0,5) dời về tâm lỗ 0,46, bậu / cao theo lỗ
  assert.ok(k1.neo && k1.n === 4 && Math.abs(k1.s + 0.04) < 0.01 && Math.abs(k1.y - 10.2) < 1e-9 && Math.abs(k1.h - 1.8) < 1e-9, 'một lỗ cho cụm 4 ô → neo theo lỗ: ' + JSON.stringify([k1.n, k1.s, k1.y, k1.h])); }
{ const ban = { s: -1, y: 48.6, h: 2.9, n: 3, w: 0.8, buoc: 1 }; // cửa ban công: thấy phần trên hai ô biên (lan can che), lỗ lạc hàng thấp hơn
  const k3 = khopCum([ban], [{ s0: -2.7, s1: -1.9, y0: 50.4, y1: 51.3 }, { s0: -0.2, s1: 0.62, y0: 50.45, y1: 51.3 }, { s0: 1.3, s1: 1.68, y0: 48.5, y1: 49.6 }])[0];
  assert.ok(k3.n === 3 && k3.khop === 2 && Math.abs(k3.s + 1.04) < 0.02, 'bù ô giữa khuất, bỏ lỗ lạc hàng: ' + JSON.stringify([k3.n, k3.khop, k3.s]));
  assert.ok(Math.abs(k3.y - 48.6) < 1e-6 && Math.abs(k3.y + k3.h - 51.5) < 1e-6, 'thấy một phần ô → không co ô: ' + JSON.stringify([k3.y, k3.h]));
  const k4 = khopCum([ban], [{ s0: -2.7, s1: -1.9, y0: 50, y1: 51.3 }, { s0: 0.6, s1: 1.4, y0: 50, y1: 51.3 }])[0]; // hai ô lệch lưới (tâm −2,3 · 1,0, bước 1,65 > 1,6×) → không bù
  assert.equal(k4.n, 2, 'lệch lưới → không bù ô'); }
{ const k1 = khopCum([{ ...cumT, s: 4 }], [{ s0: 0.2, s1: 0.72, y0: 10, y1: 12 }])[0]; // cụm tay lệch 3,5 m (ngoài tầm nửa cụm + bước) → không neo
  assert.equal(k1.khop, 0, 'lỗ một ô xa ngoài tầm → giữ cụm tay'); }
assert.equal(khopCum([cumT], [{ s0: 0.2, s1: 0.72, y0: 14, y1: 16 }, { s0: 1, s1: 1.7, y0: 14, y1: 16 }])[0].khop, 0, 'lỗ tầng khác → giữ cụm tay');
assert.equal(khopCum([cumT], [{ s0: 5, s1: 5.5, y0: 10, y1: 12 }, { s0: 6, s1: 6.5, y0: 10, y1: 12 }])[0].khop, 0, 'lỗ xa ngoài tầm cụm → giữ cụm tay');
// nửa trên + nửa dưới cùng một ô (ảnh khác nhau) → MỘT ô cao đủ; lỗ nuốt hai ô liền → tách hai; hai ô thật cách cột không bị gộp (bài phá)
const cumG = { s: 0, y: 38, h: 2.1, n: 3, w: 0.6, buoc: 0.8 };
const kG = khopCum([cumG], [{ s0: -0.9, s1: -0.3, y0: 39.1, y1: 40.1 }, { s0: -0.85, s1: -0.32, y0: 38, y1: 39.1 }, { s0: -0.1, s1: 0.5, y0: 38, y1: 40.1 }])[0];
assert.equal(kG.n, 2, 'nửa trên + nửa dưới gộp → 2 ô, không 3'); assert.ok(kG.h > 2, 'cao ô đủ: ' + kG.h);
const kT = khopCum([cumG], [{ s0: -0.9, s1: -0.3, y0: 38, y1: 40.1 }, { s0: -0.1, s1: 1.3, y0: 38, y1: 40.1 }])[0];
assert.equal(kT.n, 3, 'lỗ rộng 1,4 m tách hai ô → 3 ô'); assert.ok(Math.abs(kT.w - 0.6) < 0.05, 'bề rộng ô theo lỗ hẹp: ' + kT.w);
assert.equal(khopCum([cumG], [{ s0: -0.9, s1: -0.3, y0: 38, y1: 40.1 }, { s0: -0.2, s1: 0.4, y0: 38, y1: 40.1 }])[0].n, 2, 'hai ô cách cột 0,1 m → giữ hai');
console.log('25/25 ✓');
// vật dán sát tường (kính / lòng tối / lõm / bóng) phải có polygonOffset — thiếu là tường đè kính thành sọc trắng ở bộ đệm 16 bit (21/11/2026, ô cụm Palas THIẾU mãi)
{ const { danTuong, vlBong } = await import(new URL('../public/hoavan.js', import.meta.url)); const m = danTuong({});
  assert.ok(m.polygonOffset && m.polygonOffsetFactor < 0 && m.polygonOffsetUnits < 0, 'danTuong kéo mặt dán lên trước');
  const THREE = { MeshBasicMaterial: function (o) { Object.assign(this, o); } }; assert.ok(vlBong(THREE).polygonOffset, 'bóng vẽ sẵn cũng dán');
  const src = (await import('node:fs')).readFileSync(new URL('../public/mattien.js', import.meta.url), 'utf8');
  const tran = src.match(/(?:kinh|lom|KINH|TOI)\s*[:=]\s*new THREE\.Mesh\w*Material/g) || []; assert.deepEqual(tran, [], 'vật liệu kính / lõm / tối mặt tiền chưa qua danTuong: ' + tran.join(' · ')); }

// lỗ sổ đo SÁT ô cửa đã có (anh 22/11/2026: ô kính phẳng vẽ thừa cạnh cửa vòm): lòng kính không đè ≥ 25 % nhưng khung cách < KHE_LO → cùng một cửa; cách 2 m → cửa khác (bài phá)
const oLo = oCuaLo({ ...lo, khoi: 'k' }, dl), canh = { ...o, x: 6.4, y: 10 }; // ô vòm bên phải: lòng kính cách 0,4 m
assert.equal(loTrung(lo, dl, [canh]), false, 'lòng kính không đè → luật cũ để lọt');
assert.equal(deKhung(oLo, canh, KHE_LO), true, 'khung sát nhau → trùng');
assert.equal(deKhung(oLo, { ...canh, x: 8 }, KHE_LO), false, 'cách 2 m → cửa khác');
assert.equal(deKhung(oLo, { ...canh, y: 14 }, KHE_LO), false, 'tầng trên → cửa khác');
assert.equal(deKhung(oLo, { ...canh, nx: 1, nz: 0 }, KHE_LO), false, 'mặt vuông góc → cửa khác');
console.log('deKhung ✓');
