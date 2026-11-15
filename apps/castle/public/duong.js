// ĐƯỜNG ĐI + CẦU THANG từ OSM (du-lieu/<lâu>-duong.json, scripts/tai-duong.mjs) — dùng chung mọi lâu đài:
//   đường (đường ô tô, lối đi bộ, đường mòn): dải rộng theo loại, bám mặt đất thật cao(x, z), nhô 6 cm; mép có bó vỉa với đường lát;
//   cầu thang (highway=steps): bậc đá 0,16–0,2 m chia đều giữa độ cao hai đầu, mỗi bậc một khối có va chạm hộp, hai bên thành đá thấp.
// Bỏ đường là cầu (bridge, đã dựng riêng) và hầm. Va chạm đường: trimesh dải (người đi trên mặt đường thay vì lưới đất thô).
// datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds, cao, vl: { nhua, da, bac } }) → { ra: [Mesh], dem }
// tra-repo-ok: dựng dải theo polyline + bậc thang (mã nhỏ riêng cảnh).
export function datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds, cao, vl }) {
  const LAT = new Set(['footway', 'pedestrian', 'steps', 'service', 'residential', 'unclassified']); // đường lát / nhựa; còn lại (track, path) là đất
  const nhom = { nhua: [], dat: [], bac: [] }, dem = { duong: 0, bac: 0, m: 0 };
  const dai = (v, w, y = (x, z) => cao(x, z) + 0.06) => { // dải theo polyline, chia đoạn ≤ 2 m để bám đất
    const p = []; const pts = [];
    for (let i = 0; i + 1 < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[i + 1], L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 2)); for (let k = 0; k < n; k++) pts.push([x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n]); }
    pts.push(v[v.length - 1]);
    const ben = pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l * w / 2, dx / l * w / 2]; });
    let s = 0, uv = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], [a1, b1] = ben[i], [a2, b2] = ben[i + 1], d = Math.hypot(x2 - x1, z2 - z1);
      const A = [x1 + a1, y(x1 + a1, z1 + b1), z1 + b1], B = [x1 - a1, y(x1 - a1, z1 - b1), z1 - b1], C = [x2 + a2, y(x2 + a2, z2 + b2), z2 + b2], E = [x2 - a2, y(x2 - a2, z2 - b2), z2 - b2];
      p.push(...A, ...B, ...C, ...B, ...E, ...C); uv.push(0, s / 3, w / 3, s / 3, 0, (s + d) / 3, w / 3, s / 3, w / 3, (s + d) / 3, 0, (s + d) / 3); s += d;
    }
    dem.m += s;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  };
  const va = [];
  for (const d of ds) {
    if (d.cau || d.ham || d.v.length < 2) continue;
    if (d.loai === 'steps') { // CẦU THANG: bậc đều giữa độ cao hai đầu (theo hướng đường OSM)
      let L = 0; for (let i = 0; i + 1 < d.v.length; i++) L += Math.hypot(d.v[i + 1][0] - d.v[i][0], d.v[i + 1][1] - d.v[i][1]);
      const [xa, za] = d.v[0], [xb, zb] = d.v[d.v.length - 1], ya = cao(xa, za), yb = cao(xb, zb), H = yb - ya, n = d.bac || Math.max(2, Math.round(Math.abs(H) / 0.17)), w = Math.max(1.2, d.rong);
      if (L < 0.8) continue;
      const diem = (t) => { let r = t * L; for (let i = 0; i + 1 < d.v.length; i++) { const [x1, z1] = d.v[i], [x2, z2] = d.v[i + 1], l = Math.hypot(x2 - x1, z2 - z1); if (r <= l || i + 2 === d.v.length) { const k = l ? Math.min(1, r / l) : 0; return [x1 + (x2 - x1) * k, z1 + (z2 - z1) * k, Math.atan2(x2 - x1, z2 - z1)]; } r -= l; } };
      for (let k = 0; k < n; k++) {
        const [x, z, goc] = diem((k + 0.5) / n), yTren = ya + H * (k + (H > 0 ? 1 : 0)) / n, sau = L / n + 0.02, day = Math.min(yTren, cao(x, z)) - 0.4, h = Math.max(0.1, yTren - day);
        const g = new THREE.BoxGeometry(w, h, sau); g.rotateY(goc); g.translate(x, day + h / 2, z); nhom.bac.push(g.toNonIndexed());
        va.push([w / 2, h / 2, sau / 2, x, day + h / 2, z, goc]); dem.bac++;
      }
      dem.duong++; continue;
    }
    const g = dai(d.v, d.rong); (LAT.has(d.loai) ? nhom.nhua : nhom.dat).push(g); dem.duong++;
    const p = g.attributes.position; world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p.array), Uint32Array.from({ length: p.count }, (_, i) => i)), tinh);
  }
  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  for (const [hx, hy, hz, x, y, z, a] of va) { q.setFromAxisAngle(Y, a); world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q), tinh); }
  const ra = [];
  for (const [k, m] of [['nhua', vl.nhua], ['dat', vl.dat], ['bac', vl.bac]]) {
    if (!nhom[k].length) continue;
    const gs = nhom[k].map((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) { const n = g.attributes.position.count; g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); } return g; });
    const mesh = new THREE.Mesh(mergeGeometries(gs), m); mesh.receiveShadow = true; mesh.castShadow = k === 'bac'; ra.push(mesh);
  }
  return { ra, dem };
}
