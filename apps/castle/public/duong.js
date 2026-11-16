// ĐƯỜNG ĐI + CẦU THANG từ OSM (du-lieu/<lâu>-duong.json, scripts/tai-duong.mjs) — dùng chung mọi lâu đài:
//   đường (đường ô tô, lối đi bộ, đường mòn): dải rộng theo loại, bám mặt đất thật cao(x, z), nhô 6 cm; mép có bó vỉa với đường lát;
//   cầu thang (highway=steps): bậc đá 0,16–0,2 m chia đều giữa độ cao hai đầu, mỗi bậc một khối có va chạm hộp, hai bên thành đá thấp.
// Bỏ đường là cầu (bridge, đã dựng riêng) và hầm. Va chạm đường: trimesh dải (người đi trên mặt đường thay vì lưới đất thô).
// datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds, cao, vl: { nhua, da, bac } }) → { ra: [Mesh], dem }
// tra-repo-ok: dựng dải theo polyline + bậc thang (mã nhỏ riêng cảnh).
export function datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds, cao, vl, trongNha = null, vungLat = [] }) { // vungLat: vùng lát nhựa thêm (sân trước cổng ngoài, ns.js NEN_LUOI.sanCong) // eslint-disable-line no-param-reassign
  const LAT = new Set(['footway', 'pedestrian', 'steps', 'service', 'residential', 'unclassified']); // đường lát / nhựa; còn lại (track, path) là đất
  const OTO = new Set(['service', 'residential', 'unclassified']); // đường ô tô: mặt nhựa (vl.oto) — đường lên cổng ngoài đời là nhựa xám sáng, không lát đá
  const nhom = { nhua: [], oto: [], dat: [], bac: [], tuong: [], nap: [] }, dem = { duong: 0, bac: 0, m: 0 };
  const uvTheGioi = (g) => { const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2); // vân đá theo toạ độ thật (tường chắn cao vài mét không bị kéo dãn)
    for (let i = 0; i < p.count; i++) { const ngang = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? p.getZ(i) : p.getX(i); uv[i * 2] = ngang / 2.5; uv[i * 2 + 1] = p.getY(i) / 2.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; };
  const dai = (v, w) => { // eslint-disable-line prefer-const // nhô 0,22 m: lưới đất mịn chia ô 1,5 m chéo khác nội suy → đường 6 cm bị đất trùm mất trên dốc (đường lên cổng không thấy) // dải theo polyline, chia đoạn ≤ 2 m để bám đất
    const p = []; const pts = [];
    for (let i = 0; i + 1 < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[i + 1], L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 2)); for (let k = 0; k < n; k++) pts.push([x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n]); }
    pts.push(v[v.length - 1]);
    // ĐOẠN TRONG NHÀ (đường xuyên cổng): trong nhà không có số đo đất (đất lấp nội suy → dốc 9 m trong 7 m) → độ cao nội suy đều giữa hai điểm ngoài nhà kề đó
    // trong = trong nhà hoặc sát nhà ≤ 0,75 m (đất đo ngay mép tường lẫn tường / mái → ngưỡng cổng vọt cao)
    const yT = pts.map(([x, z]) => cao(x, z)), trong = pts.map(([x, z]) => !!trongNha && [[0, 0], [0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([a, b]) => trongNha(x + a, z + b)));
    for (let i = 0; i < pts.length; i++) { if (!trong[i]) continue; let a = i; while (a >= 0 && trong[a]) a--; let b = i; while (b < pts.length && trong[b]) b++;
      // đầu đoạn cũng trong nhà (đường xuyên cổng nằm trọn trong nhà): neo = điểm ngoài nhà đầu tiên khi đi tiếp ra theo hướng đường (≤ 4 m)
      const ya = a >= 0 ? yT[a] : neoNgoai(pts[0], pts[1]), yb = b < pts.length ? yT[b] : neoNgoai(pts[pts.length - 1], pts[pts.length - 2]), ia = a >= 0 ? a : 0, ib = b < pts.length ? b : pts.length - 1;
      if (ya != null && yb != null) yT[i] = ya + (yb - ya) * (i - ia) / (ib - ia); else if (ya != null) yT[i] = ya; else if (yb != null) yT[i] = yb; }
    function neoNgoai(p, q) { const dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1; for (let s = 0.5; s <= 4; s += 0.5) { const x = p[0] + dx / l * s, z = p[1] + dz / l * s; if (![[0, 0], [0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([u, w]) => trongNha(x + u, z + w))) return cao(x, z); } return null; }
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
  const keMep = (x, z, v) => { let m = 1e9; for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const trongDaV = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const trongVung = (x, z) => vungLat.some(({ v }) => trongDaV(x, z, v) || keMep(x, z, v) < 0.6);
  const OTO_DS = ds.filter((d) => ['unclassified', 'service', 'residential'].includes(d.loai) && !d.cau && !d.ham), cat = (a, b, c, e) => { const f = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return f(a, b, c) * f(a, b, e) < 0 && f(c, e, a) * f(c, e, b) < 0; },
    // tim đường xe CẮT QUA mép (không phải chỉ nằm gần: đường chạy dọc mép sân trong sân → cả mép mất lan can); nới mỗi phía nửa bề rộng đường
    quaDuong = (x, z, ux, uz) => OTO_DS.some((d) => { const r = (d.rong || 5) / 2 + 0.5, a = [x - ux * r, z - uz * r], b = [x + ux * r, z + uz * r]; return d.v.some((p, i) => i + 1 < d.v.length && cat(a, b, p, d.v[i + 1])); });
  // LAN CAN dọc một đường gấp khúc pl, cách tim b m, hai bên: mẫu 1 m nối liền; bên nào đất ngoài tụt > 1,7 m trong 3 m thì xây; khe ≤ 3 m giữa hai đoạn xây
  // được lấp, đầu đoạn nới 1 m (ảnh thật: lan can liền một dải). Mặt trên nghiêng theo dốc đường (trước: bậc thang từng mét). Thân xuống tới đất ngoài.
  // mat: cao độ mặt đi bên trong (đường: đất tim; sân: hàm mặt sân) · nguong: đất ngoài thấp hơn mặt đi bao nhiêu thì xây · moLoi: chừa lối chỗ đường xe cắt qua mép
  function lanCan(pl, b, boVung, { mat = cao, nguong = 1.7, moLoi = false } = {}) {
    const M = []; for (let i = 0; i + 1 < pl.length; i++) { const [x1, z1] = pl[i], [x2, z2] = pl[i + 1], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.3) continue; const ux = (x2 - x1) / L, uz = (z2 - z1) / L, n = Math.max(1, Math.round(L)), l = L / n;
      for (let m = 0; m < n; m++) M.push({ x: x1 + ux * (m + 0.5) * l, z: z1 + uz * (m + 0.5) * l, ux, uz, l }); }
    for (const k of [-1, 1]) {
      const co = M.map(({ x, z, ux, uz }) => { const ox = -uz * k, oz = ux * k, y = cao(x, z) + 0.22, ex = x + ox * b, ez = z + oz * b;
        if (trongNha?.(x, z) || trongNha?.(ex, ez) || (boVung && trongVung(ex, ez)) || (moLoi && quaDuong(ex, ez, ux, uz))) return null; const ym = mat(x - ox * (b > 0 ? 0 : 0.8), z - oz * (b > 0 ? 0 : 0.8)) + 0.22; return cao(x + ox * (b + 3), z + oz * (b + 3)) <= ym - nguong; });
      const xay = co.map((c) => c === true);
      for (let i = 0; i < xay.length; i++) if (!xay[i] && co[i] !== null) { let a = i - 1; while (a >= 0 && !xay[a] && i - a <= 3) a--; let c = i + 1; while (c < xay.length && !xay[c] && c - i <= 3) c++; if (a >= 0 && c < xay.length && xay[a] && xay[c] && c - a <= 4) xay[i] = 'lap'; }
      for (let i = 0; i < xay.length; i++) if (xay[i] === true && ((i > 0 && !xay[i - 1] && co[i - 1] !== null) || (i + 1 < xay.length && !xay[i + 1] && co[i + 1] !== null))) { if (i > 0 && !xay[i - 1] && co[i - 1] !== null) xay[i - 1] = 'noi'; if (i + 1 < xay.length && !xay[i + 1] && co[i + 1] !== null) xay[i + 1] = 'noi'; }
      // gộp mẫu liền nhau trên CÙNG một đoạn thẳng thành một khối (≤ 6 m): mỗi mét một khối + đá nắp ăn tam giác gấp năm (máy điện thoại)
      for (let i = 0; i < M.length;) { if (!xay[i]) { i++; continue; } let j = i + 1; while (j < M.length && xay[j] && M[j].ux === M[i].ux && M[j].uz === M[i].uz && j - i < 6) j++;
        const { ux, uz, l } = M[i], ox = -uz * k, oz = ux * k, goc = -Math.atan2(uz, ux), Lr = (j - i) * l, vo = b > 0 ? 0 : 0.8; // mép sân (b = 0): cao độ lấy mặt sân lùi vào 0,8 m — ngay mép đất đã tụt → nắp răng cưa
        const sx = M[i].x - ux * l / 2, sz = M[i].z - uz * l / 2, x = sx + ux * Lr / 2, z = sz + uz * Lr / 2, ex = x + ox * b, ez = z + oz * b;
        const yA = mat(sx - ox * vo, sz - oz * vo) + 1.22, yB = mat(sx + ux * Lr - ox * vo, sz + uz * Lr - oz * vo) + 1.22;
        let day = Infinity; for (let q = i; q < j; q++) { const { x: qx, z: qz } = M[q]; day = Math.min(day, mat(qx, qz) - 0.4, ...[1, 2.5, 4].map((r) => cao(qx + ox * (b + r), qz + oz * (b + r)))); } day -= 0.4;
        const lam = (g, tren, duoi) => { const p = g.attributes.position; for (let q = 0; q < p.count; q++) { const t = p.getX(q) / (Lr + 0.06) + 0.5, yt = yA + (yB - yA) * t; p.setY(q, p.getY(q) > 0 ? yt + tren : (duoi == null ? yt + tren - 0.14 : duoi)); } g.rotateY(goc); g.translate(ex, 0, ez); g.computeVertexNormals(); return g; };
        vlTuong.push(uvTheGioi(lam(new THREE.BoxGeometry(Lr + 0.06, 1, 0.5).toNonIndexed(), 0, day)));
        nhom.nap.push(lam(new THREE.BoxGeometry(Lr + 0.06, 1, 0.64).toNonIndexed(), 0.14, null));
        for (let q = i; q < j; q++) { const t = (q - i + 0.5) / (j - i), ym = yA + (yB - yA) * t; va.push([l / 2 + 0.03, 0.65, 0.25, M[q].x + ox * b, ym - 0.65, M[q].z + oz * b, goc]); }
        i = j; }
    }
  }
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
    // LAN CAN + TƯỜNG CHẮN mép đường ô tô (ảnh Mapillary 360° đường lên cổng Torbau: tường đá xám sáng liền mạch cao ~1 m, đá nắp phẳng nhô hai bên; dưới là bệ
    // tường chắn đá khối chạy xuống tới sườn) — chỉ đường ô tô (lối bộ / chiếu nghỉ cầu thang không xây, chắn lối); mép sân trước cổng xây ở vungLat
    if (['unclassified', 'service', 'residential'].includes(d.loai)) lanCan(d.v, d.rong / 2 + 0.25, true);
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
  for (const { v, cao: m } of vungLat) lanCan([...v, v[0]], 0, false, { mat: m || cao, nguong: 0.8, moLoi: true }); // mép sân trước cổng: lan can chỗ đất ngoài tụt (phía vực), dọc chân nhà thì không
  for (const { v } of vungLat) { // SÂN NHỰA (sân trước cổng ngoài): bám mặt đất đã san, thấp hơn mặt đường 6 cm (không giành mặt với dải đường)
    const sh = new THREE.Shape(v.map(([x, z]) => new THREE.Vector2(x, -z))), g0 = new THREE.ShapeGeometry(sh).toNonIndexed(); g0.rotateX(-Math.PI / 2);
    // chia tam giác tới cạnh ≤ 1 m: tam giác của đa giác bao dài hàng chục mét, đặt cao độ ở đỉnh thì mặt sân phẳng giữa chừng — đất lồi lên trùm, chỗ lõm thì sân lơ lửng
    const tg = [], a0 = g0.attributes.position.array; for (let i = 0; i < a0.length; i += 9) tg.push([[a0[i], a0[i + 2]], [a0[i + 3], a0[i + 5]], [a0[i + 6], a0[i + 8]]]);
    const nho = []; while (tg.length) { const [A, Bq, C] = tg.pop(), d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (Math.max(d2(A, Bq), d2(Bq, C), d2(C, A)) <= 1) { nho.push(A, Bq, C); continue; } const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ab = m(A, Bq), bc = m(Bq, C), ca = m(C, A); tg.push([A, ab, ca], [ab, Bq, bc], [ca, bc, C], [ab, bc, ca]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(nho.flatMap(([x, z]) => [x, 0, z]), 3));
    const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { p.setY(i, cao(p.getX(i), p.getZ(i)) + 0.16); uv[i * 2] = p.getX(i) / 3; uv[i * 2 + 1] = p.getZ(i) / 3; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); (vl.oto ? nhom.oto : nhom.nhua).push(g); }
  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  for (const [hx, hy, hz, x, y, z, a] of va) { q.setFromAxisAngle(Y, a); world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q), tinh); }
  const ra = [];
  if (vlTuong.length) nhom.tuong = vlTuong;
  for (const [k, m] of [['nhua', vl.nhua], ['oto', vl.oto], ['dat', vl.dat], ['bac', vl.bac], ['tuong', vl.tuong || vl.bac], ['nap', vl.nap || vl.tuong || vl.bac]]) {
    if (!nhom[k].length) continue;
    const gs = nhom[k].map((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) { const n = g.attributes.position.count; g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); } return g; });
    const mesh = new THREE.Mesh(mergeGeometries(gs), m); mesh.receiveShadow = true; mesh.castShadow = k === 'bac' || k === 'tuong'; ra.push(mesh);
  }
  return { ra, dem };
}
