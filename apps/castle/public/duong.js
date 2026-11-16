// ĐƯỜNG ĐI + CẦU THANG từ OSM (du-lieu/<lâu>-duong.json, scripts/tai-duong.mjs) — dùng chung mọi lâu đài:
//   đường (đường ô tô, lối đi bộ, đường mòn): dải rộng theo loại, bám mặt đất thật cao(x, z), nhô 6 cm; mép có bó vỉa với đường lát;
//   cầu thang (highway=steps): bậc đá 0,16–0,2 m chia đều giữa độ cao hai đầu, mỗi bậc một khối có va chạm hộp, hai bên thành đá thấp.
// Bỏ đường là cầu (bridge, đã dựng riêng) và hầm. Va chạm đường: trimesh dải (người đi trên mặt đường thay vì lưới đất thô).
// datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds, cao, vl: { nhua, da, bac } }) → { ra: [Mesh], dem }
// tra-repo-ok: dựng dải theo polyline + bậc thang (mã nhỏ riêng cảnh).
export function datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds, cao, vl, trongNha = null }) { // eslint-disable-line no-param-reassign
  const LAT = new Set(['footway', 'pedestrian', 'steps', 'service', 'residential', 'unclassified']); // đường lát / nhựa; còn lại (track, path) là đất
  const OTO = new Set(['service', 'residential', 'unclassified']); // đường ô tô: mặt nhựa (vl.oto) — đường lên cổng ngoài đời là nhựa xám sáng, không lát đá
  const nhom = { nhua: [], oto: [], dat: [], bac: [], tuong: [] }, dem = { duong: 0, bac: 0, m: 0 };
  const dai = (v, w) => { // eslint-disable-line prefer-const // nhô 0,22 m: lưới đất mịn chia ô 1,5 m chéo khác nội suy → đường 6 cm bị đất trùm mất trên dốc (đường lên cổng không thấy) // dải theo polyline, chia đoạn ≤ 2 m để bám đất
    const p = []; const pts = [];
    for (let i = 0; i + 1 < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[i + 1], L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 2)); for (let k = 0; k < n; k++) pts.push([x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n]); }
    pts.push(v[v.length - 1]);
    // ĐOẠN TRONG NHÀ (đường xuyên cổng): trong nhà không có số đo đất (đất lấp nội suy → dốc 9 m trong 7 m) → độ cao nội suy đều giữa hai điểm ngoài nhà kề đó
    const yT = pts.map(([x, z]) => cao(x, z)), trong = pts.map(([x, z]) => !!trongNha?.(x, z));
    for (let i = 0; i < pts.length; i++) { if (!trong[i]) continue; let a = i; while (a >= 0 && trong[a]) a--; let b = i; while (b < pts.length && trong[b]) b++;
      if (a >= 0 && b < pts.length) { const t = (i - a) / (b - a); yT[i] = yT[a] + (yT[b] - yT[a]) * t; } else if (a >= 0) yT[i] = yT[a]; else if (b < pts.length) yT[i] = yT[b]; }
    const ben = pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l * w / 2, dx / l * w / 2]; });
    let s = 0, uv = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], [a1, b1] = ben[i], [a2, b2] = ben[i + 1], d = Math.hypot(x2 - x1, z2 - z1);
      const h1 = () => yT[i] + 0.22, h2 = () => yT[i + 1] + 0.22; // cả bề ngang theo cao độ TIM đường (đất dưới đường đã san ngang theo tim — ns.js NEN_LUOI); trong nhà: tim đã nội suy
      const A = [x1 + a1, h1(x1 + a1, z1 + b1), z1 + b1], B = [x1 - a1, h1(x1 - a1, z1 - b1), z1 - b1], C = [x2 + a2, h2(x2 + a2, z2 + b2), z2 + b2], E = [x2 - a2, h2(x2 - a2, z2 - b2), z2 - b2];
      p.push(...A, ...B, ...C, ...B, ...E, ...C); uv.push(0, s / 3, w / 3, s / 3, 0, (s + d) / 3, w / 3, s / 3, w / 3, (s + d) / 3, 0, (s + d) / 3); s += d;
    }
    dem.m += s;
    // mặt đường luôn NGỬA LÊN: thứ tự đỉnh theo chiều đi của đường OSM → đường đi một chiều thì tam giác úp xuống, vật liệu một mặt ẩn hẳn (đường lên cổng Torbau mất, chỉ còn cỏ)
    for (let t = 0; t < p.length; t += 9) { const ny = (p[t + 5] - p[t + 2]) * (p[t + 6] - p[t]) - (p[t + 3] - p[t]) * (p[t + 8] - p[t + 2]); if (ny >= 0) continue;
      for (let k = 0; k < 3; k++) [p[t + 3 + k], p[t + 6 + k]] = [p[t + 6 + k], p[t + 3 + k]]; const u = t / 9 * 6; for (let k = 0; k < 2; k++) [uv[u + 2 + k], uv[u + 4 + k]] = [uv[u + 4 + k], uv[u + 2 + k]]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  };
  const va = [];
  // NỐI CÁC ĐOẠN CẦU THANG LIỀN NHAU thành một chuỗi (OSM chia một cầu thang gãy khúc thành nhiều đoạn): tính độ cao chân → đỉnh một lần cho cả chuỗi;
  // trước mỗi đoạn tự tính hai đầu → chỗ nối lệch 1–2 m, kẹt (anh 16/11/2026)
  const thang = ds.filter((d) => d.loai === 'steps' && !d.cau && !d.ham && d.v.length >= 2).map((d) => ({ ...d, v: d.v.slice() })), trung = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.4;
  for (let gop = true; gop;) { gop = false;
    for (const a of thang) for (const b of thang) { if (a === b || a.bo || b.bo) continue;
      let v = null; const [a0, a1, b0, b1] = [a.v[0], a.v.at(-1), b.v[0], b.v.at(-1)];
      if (trung(a1, b0)) v = [...a.v, ...b.v.slice(1)]; else if (trung(a1, b1)) v = [...a.v, ...b.v.slice(0, -1).reverse()]; else if (trung(a0, b1)) v = [...b.v, ...a.v.slice(1)]; else if (trung(a0, b0)) v = [...b.v.slice().reverse(), ...a.v.slice(1)];
      if (v) { a.v = v; a.bac = a.bac && b.bac ? a.bac + b.bac : null; a.rong = Math.max(a.rong, b.rong); b.bo = true; gop = true; } } }
  ds = [...ds.filter((d) => d.loai !== 'steps' || d.cau || d.ham || d.v.length < 2), ...thang.filter((d) => !d.bo)];
  const LO_TUONG = [], vlTuong = [];
  for (const d of ds) {
    if (d.cau || d.ham || d.v.length < 2) continue;
    const kin = d.v.length > 3 && Math.hypot(d.v[0][0] - d.v.at(-1)[0], d.v[0][1] - d.v.at(-1)[1]) < 0.3;
    if (kin && (d.loai === 'pedestrian' || d.loai === 'footway')) { // VÙNG khép kín (sân dưới "Unterer Hof"): lát kín cả vùng bám đất — trước dựng thành dải chạy quanh mép
      const sh = new THREE.Shape(d.v.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh).toNonIndexed(); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { p.setY(i, cao(p.getX(i), p.getZ(i)) + 0.07); uv[i * 2] = p.getX(i) / 3; uv[i * 2 + 1] = p.getZ(i) / 3; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); nhom.nhua.push(g); dem.duong++; continue;
    }
    // TƯỜNG CHẮN mép đường ô tô / lối dốc: bên nào đất tụt > 1,5 m trong 3 m thì xây lan can đá 0,9 m (đường dốc lên cổng: tường chắn vòng như ảnh, anh 16/11/2026)
    if (['unclassified', 'service', 'residential'].includes(d.loai)) for (let i = 0; i + 1 < d.v.length; i++) { // chỉ đường ô tô — lối bộ / chiếu nghỉ cầu thang không xây (chắn lối)
      const [x1, z1] = d.v[i], [x2, z2] = d.v[i + 1], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) continue; const ux = (x2 - x1) / L, uz = (z2 - z1) / L;
      for (let s = 0; s < L; s += 2) { const l = Math.min(2, L - s), x = x1 + ux * (s + l / 2), z = z1 + uz * (s + l / 2), y = cao(x, z);
        if (trongNha?.(x, z)) continue; // trong nhà (đường xuyên cổng) không xây
        for (const k of [-1, 1]) { const ox = -uz * k, oz = ux * k, b = d.rong / 2 + 0.25; if (cao(x + ox * (b + 3), z + oz * (b + 3)) > y - 1.5 || trongNha?.(x + ox * b, z + oz * b)) continue;
          const g = new THREE.BoxGeometry(l + 0.05, 1.3, 0.45); g.rotateY(-Math.atan2(uz, ux)); g.translate(x + ox * b, y + 0.65 - 0.4, z + oz * b); vlTuong.push(g.toNonIndexed());
          va.push([(l + 0.05) / 2, 0.65, 0.225, x + ox * b, y + 0.25, z + oz * b, -Math.atan2(uz, ux)]); } } }
    if (d.loai === 'steps') { // CẦU THANG: bậc đều giữa độ cao hai đầu (theo hướng đường OSM)
      let L = 0; for (let i = 0; i + 1 < d.v.length; i++) L += Math.hypot(d.v[i + 1][0] - d.v[i][0], d.v[i + 1][1] - d.v[i][1]);
      // hai đầu thang nối đúng mặt bằng nó lên / xuống: đầu cao lấy mặt CAO nhất trong 2,5 m quanh nó, đầu thấp lấy mặt THẤP nhất (đầu thang đặt sát mép sân
      // phẳng thì cao độ ngay tại điểm hụt sân cả mét → kẹt, anh 16/11/2026)
      const quanh = (x, z, f) => { let v = cao(x, z); for (let a = 0; a < 6.28; a += 0.785) for (const r of [1.25, 2.5]) v = f(v, cao(x + Math.cos(a) * r, z + Math.sin(a) * r)); return v; };
      // đầu dãy nằm sát đầu dãy bậc khác (chiếu nghỉ giữa hai dãy, nối bằng đoạn lối đi ngắn): hai dãy dùng CHUNG độ cao chiếu nghỉ (trung bình mặt đất hai đầu),
      // không lấy max / min quanh — trước đó lệch gần 5 m ở chiếu nghỉ cầu thang hai sân, kẹt
      const dauKhac = (x, z) => thang.filter((t) => !t.bo && t !== d).flatMap((t) => [t.v[0], t.v.at(-1)]).find((p) => Math.hypot(p[0] - x, p[1] - z) < 2.5);
      const dau = (x, z, f) => { const k = dauKhac(x, z); return k ? (cao(x, z) + cao(k[0], k[1])) / 2 : quanh(x, z, f); };
      const [xa, za] = d.v[0], [xb, zb] = d.v[d.v.length - 1], aCao = cao(xa, za) > cao(xb, zb), ya = dau(xa, za, aCao ? Math.max : Math.min), yb = dau(xb, zb, aCao ? Math.min : Math.max), H = yb - ya, n = d.bac || Math.max(2, Math.round(Math.abs(H) / 0.17)), w = Math.max(1.2, d.rong);
      if (L < 0.8) continue;
      const diem = (t) => { let r = t * L; for (let i = 0; i + 1 < d.v.length; i++) { const [x1, z1] = d.v[i], [x2, z2] = d.v[i + 1], l = Math.hypot(x2 - x1, z2 - z1); if (r <= l || i + 2 === d.v.length) { const k = l ? Math.min(1, r / l) : 0; return [x1 + (x2 - x1) * k, z1 + (z2 - z1) * k, Math.atan2(x2 - x1, z2 - z1)]; } r -= l; } };
      for (let k = 0; k < n; k++) {
        const [x, z, goc] = diem((k + 0.5) / n), yTren = ya + H * (k + (H > 0 ? 1 : 0)) / n, sau = L / n + 0.02, day = Math.min(yTren, cao(x, z)) - 0.4, h = Math.max(0.1, yTren - day);
        const g = new THREE.BoxGeometry(w, h, sau); g.rotateY(goc); g.translate(x, day + h / 2, z); nhom.bac.push(g.toNonIndexed());
        va.push([w / 2, h / 2, sau / 2, x, day + h / 2, z, goc]); dem.bac++;
      }
      dem.duong++; continue;
    }
    const g = dai(d.v, d.rong); (OTO.has(d.loai) && vl.oto ? nhom.oto : LAT.has(d.loai) ? nhom.nhua : nhom.dat).push(g); dem.duong++;
    const p = g.attributes.position; world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p.array), Uint32Array.from({ length: p.count }, (_, i) => i)), tinh);
  }
  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  for (const [hx, hy, hz, x, y, z, a] of va) { q.setFromAxisAngle(Y, a); world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q), tinh); }
  const ra = [];
  if (vlTuong.length) nhom.tuong = vlTuong;
  for (const [k, m] of [['nhua', vl.nhua], ['oto', vl.oto], ['dat', vl.dat], ['bac', vl.bac], ['tuong', vl.tuong || vl.bac]]) {
    if (!nhom[k].length) continue;
    const gs = nhom[k].map((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) { const n = g.attributes.position.count; g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); } return g; });
    const mesh = new THREE.Mesh(mergeGeometries(gs), m); mesh.receiveShadow = true; mesh.castShadow = k === 'bac' || k === 'tuong'; ra.push(mesh);
  }
  return { ra, dem };
}
