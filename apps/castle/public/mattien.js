// MẶT TIỀN CHI TIẾT (bước 2 "lâu đài chi tiết"): cửa sổ 3D thật thay cửa sổ vẽ trên vân — khung đá nhô ra, đầu vòm bán nguyệt, bậu, lòng cửa tối;
// Palas dùng cửa vòm BA Ô có hai cột nhỏ (như mặt sân trên, ảnh anh gửi 15/11/2026); gờ đá ngang chạy theo từng tầng. Vẽ hàng loạt (InstancedMesh + một lưới gờ).
// tra-repo-ok: anh chọn "cách 2 — tự dựng mặt tiền" sau bảng tra Google tiles / Sketchfab / CGTrader (15/11/2026); đây là mã dán keo riêng của cảnh, không có thư viện tương ứng.
// datMatTien({ THREE, mergeGeometries, tuong: [{ ten, v, yMong, y1, lo(i, x1, z1, x2, z2) → [{ s0, s1, y0, y1 }] }], biChe(x, y, z) → bool }) → [Mesh…]
export function datMatTien({ THREE, mergeGeometries, tuong, biChe, nhe = false, matNgoai = () => ({ san: false }) }) { // matNgoai(x, z, nx, nz) → { san: mặt tường nhìn ra sân trong?, yDat: độ cao mặt sân trước tường } // nhe: điện thoại — vòm ít cạnh hơn
  const DA = new THREE.Color('#ece6da'), TOI = new THREE.Color('#1b1f27'), LONG = new THREE.Color('#8f8a80'), _c = new THREE.Color();
  const hop = (w, h, d, x, y, z, mau) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); return mau_(g, mau); };
  const mau_ = (g, mau) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = mau.r; c[i * 3 + 1] = mau.g; c[i * 3 + 2] = mau.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; };
  const vom = (r, cx, y, z, mau, day = 0.03) => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(-r, 0); const g = new THREE.ExtrudeGeometry(s, { depth: day, bevelEnabled: false, curveSegments: nhe ? 5 : 10 }).toNonIndexed(); g.translate(cx, y, z); return mau_(g, mau); };
  // khung vòm: các khối đá nhỏ xếp theo nửa vòng tròn, cạnh dài mỗi khối nằm theo tiếp tuyến (xoay am + 90°)
  const khungVom = (r, cx, y, z, rong, sau, mau, n0 = 9) => { const n = nhe ? Math.ceil(n0 / 2) : n0; const ds = []; for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, am = (a0 + a1) / 2, dai = 2 * (r + rong / 2) * Math.sin((a1 - a0) / 2) + 0.02;
    const g = new THREE.BoxGeometry(dai, rong, sau).toNonIndexed(); g.rotateZ(am + Math.PI / 2); g.translate(cx + Math.cos(am) * (r + rong / 2), y + Math.sin(am) * (r + rong / 2), z); ds.push(mau_(g, mau)); } return ds; };
  // một ô cửa vòm: lòng tối phẳng sát tường, má cửa nhô 0,2 m, khung đá nhô 0,24 m, bậu
  function oCua(w, h, cx, khung = true) {
    const r = w / 2, ds = [hop(w, h, 0.02, cx, h / 2, 0.012, TOI), vom(r, cx, h, 0.002, TOI), hop(0.06, h, 0.2, cx - r - 0.03, h / 2, 0.1, LONG), hop(0.06, h, 0.2, cx + r + 0.03, h / 2, 0.1, LONG)];
    if (khung) ds.push(hop(0.16, h, 0.24, cx - r - 0.14, h / 2, 0.12, DA), hop(0.16, h, 0.24, cx + r + 0.14, h / 2, 0.12, DA), ...khungVom(r + 0.06, cx, h, 0.12, 0.16, 0.24, DA));
    return ds;
  }
  const mot = mergeGeometries([...oCua(1.15, 2.1, 0), hop(1.75, 0.14, 0.3, 0, -0.07, 0.15, DA)]);
  const ba = mergeGeometries([...[-0.92, 0, 0.92].flatMap((cx) => oCua(0.78, 2.3, cx, false)),
    ...[-0.46, 0.46].map((cx) => { const g = new THREE.CylinderGeometry(0.07, 0.07, 2.3, nhe ? 5 : 8).toNonIndexed(); g.translate(cx, 1.15, 0.1); return mau_(g, DA); }), // hai cột nhỏ giữa ba ô
    hop(0.2, 2.3, 0.26, -1.42, 1.15, 0.13, DA), hop(0.2, 2.3, 0.26, 1.42, 1.15, 0.13, DA), ...khungVom(1.36, 0, 2.3, 0.13, 0.2, 0.26, DA, 13), hop(3.2, 0.16, 0.32, 0, -0.08, 0.16, DA)]);
  // dãy vòm tầng trệt (Toà Hiệp sĩ, theo ảnh Josef Albert ~1885): ô vòm cao lòng tối, hai cột tròn hai bên, khung vòm đá
  const dayVom = mergeGeometries([...oCua(1.9, 2.5, 0), ...[-1.12, 1.12].map((cx) => { const g = new THREE.CylinderGeometry(0.16, 0.18, 2.5, nhe ? 6 : 10).toNonIndexed(); g.translate(cx, 1.25, 0.2); return mau_(g, DA); }), hop(2.6, 0.18, 0.36, 0, 0.09, 0.18, DA)]);
  const viTri = { mot: [], ba: [], vom: [] }, go = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), mot1 = new THREE.Vector3(1, 1, 1);
  for (const t of tuong) {
    const palas = t.ten === 'Palas', tang = palas ? 5.2 : 4.4;
    for (let i = 0; i < t.v.length; i++) {
      const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 2.5) continue;
      const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, goc = Math.atan2(nx, nz); // pháp tuyến RA NGOÀI (đa giác ngược chiều kim nhìn từ trên)
      const lo = t.lo(i, x1, z1, x2, z2), mn = palas ? { san: false } : matNgoai((x1 + x2) / 2, (z1 + z2) / 2, nx, nz), coVom = mn.san && Number.isFinite(mn.yDat);
      q.setFromAxisAngle(Y, goc);
      // tầng trệt mọi toà (trừ Palas) NHÌN RA SÂN TRONG là dãy vòm (như dãy hiên Toà Hiệp sĩ trong ảnh Josef Albert), chân vòm đứng trên mặt sân trước tường;
      // mặt sân OSM của Toà Hiệp sĩ là khối không tên đứng trước khối mang tên, nên không lọc theo tên
      for (let y = coVom ? mn.yDat + 0.05 : t.yMong + 1.1, hang = 0; y + 3.6 <= t.y1; y += tang, hang++) {
        const kieu = palas ? 'ba' : coVom && hang === 0 ? 'vom' : 'mot', buoc = kieu === 'ba' ? 4.6 : kieu === 'vom' ? 3.0 : 3.4, nua = kieu === 'ba' ? 1.65 : kieu === 'vom' ? 1.35 : 0.95, cao = kieu === 'vom' ? 2.6 : kieu === 'ba' ? 2.6 : 2.4;
        if (y + cao + 1.2 > t.y1) break;
        const n = Math.floor((L - 0.6) / buoc), du = (L - n * buoc) / 2 + buoc / 2;
        const yM = y + cao / 2;
        if (biChe(x1 + ux * L / 2 + nx * 0.6, yM, z1 + uz * L / 2 + nz * 0.6)) continue; // mặt tường bị khối khác áp vào ở tầng này
        if (lo.some((o) => o.s0 <= 0 && o.s1 >= L && y - 0.6 >= o.y0 && y + cao <= o.y1)) continue; // cả mặt dành cho dựng riêng (mặt Palas hướng sân) → không cửa, không gờ
        go.push([x1, z1, ux, uz, nx, nz, L, y - 0.55]); // gờ đá dưới mỗi hàng cửa
        for (let k = 0; k < n; k++) {
          const s = du + k * buoc; if (s - nua < 0.3 || s + nua > L - 0.3) continue;
          if (lo.some((o) => s + nua > o.s0 && s - nua < o.s1 && y + cao > o.y0 && y < o.y1)) continue; // chỗ khoét cửa / dải nội thất
          viTri[kieu].push(m4.compose(new THREE.Vector3(x1 + ux * s, y, z1 + uz * s), q, mot1).clone());
        }
      }
    }
  }
  const vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), ra = [];
  for (const [ten, g] of [['mot', mot], ['ba', ba], ['vom', dayVom]]) { const ds = viTri[ten]; if (!ds.length) continue; const im = new THREE.InstancedMesh(g, vl, ds.length); ds.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; ra.push(im); } // chi tiết nhỏ không đổ bóng: lượt vẽ bóng tốn gấp đôi mà bóng khung cửa gần như không thấy
  if (go.length) { const gs = go.map(([x1, z1, ux, uz, nx, nz, L, y]) => { const g = hop(L, 0.22, 0.2, 0, 0, 0, _c.copy(DA)); g.rotateY(Math.atan2(nx, nz)); g.translate(x1 + ux * L / 2 + nx * 0.1, y, z1 + uz * L / 2 + nz * 0.1); return g; });
    const m = new THREE.Mesh(mergeGeometries(gs), vl); m.receiveShadow = true; ra.push(m); }
  return { ra, dem: { cua: viTri.mot.length, cuaBa: viTri.ba.length, vom: viTri.vom.length, go: go.length } };
}

// CỤM CỬA kiểu Roman như ảnh sân trên: n ô vòm nhỏ đứng sát nhau, giữa các ô là cột nhỏ có đầu cột, mỗi ô một vòm đá mảnh;
// vom = true thì cả cụm nằm dưới một VÒM LỚN (vòm mù) có má tường hai bên. Toạ độ cục bộ: x dọc tường (tâm cụm x = 0), y lên (bậu y = 0), z ra ngoài.
// → { da: [hình], toi: [hình] } (không chỉ số, không uv — gộp được ngay)
export function nhomCua(THREE, { n = 3, w = 0.5, h = 2, vom = true, nhe = false }) {
  const da = [], toi = [], k = 0.14, W = n * w + (n - 1) * k, yV = h - w / 2, cb = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, yV); sh.absarc(0, yV, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
  for (let i = 0; i < n; i++) {
    const cx = (i - (n - 1) / 2) * (w + k);
    const o = cb(new THREE.ShapeGeometry(sh, nhe ? 4 : 8)); o.translate(cx, 0, 0.015); toi.push(o);
    const v = cb(new THREE.TorusGeometry(w / 2 + 0.035, 0.045, 4, nhe ? 5 : 9, Math.PI)); v.translate(cx, yV, 0.08); da.push(v);
  }
  for (let i = 0; i <= n; i++) { // cột nhỏ giữa / hai bên các ô + đầu cột
    const x = i === 0 ? -W / 2 - 0.06 : i === n ? W / 2 + 0.06 : -W / 2 + i * (w + k) - k / 2;
    const c = cb(new THREE.CylinderGeometry(0.055, 0.065, yV, nhe ? 5 : 7)); c.translate(x, yV / 2, 0.12); da.push(c);
    const d = cb(new THREE.BoxGeometry(0.2, 0.12, 0.2)); d.translate(x, yV + 0.02, 0.12); da.push(d);
  }
  const bau = cb(new THREE.BoxGeometry(W + 0.5, 0.14, 0.3)); bau.translate(0, -0.07, 0.15); da.push(bau);
  if (vom) { // vòm lớn: chân vòm ngang đầu các ô nhỏ, hai má tường từ bậu lên chân vòm
    const R = W / 2 + 0.22, yC = h - 0.05;
    const r1 = cb(new THREE.TorusGeometry(R + 0.08, 0.1, 4, nhe ? 8 : 16, Math.PI)); r1.translate(0, yC, 0.1); da.push(r1);
    const r2 = cb(new THREE.TorusGeometry(R - 0.06, 0.05, 4, nhe ? 8 : 16, Math.PI)); r2.translate(0, yC, 0.06); da.push(r2);
    for (const s of [-1, 1]) { const m = cb(new THREE.BoxGeometry(0.2, yC, 0.2)); m.translate(s * (R + 0.08), yC / 2, 0.1); da.push(m); }
  }
  return { da, toi, rong: vom ? W + 0.9 : W + 0.3 };
}

// MẶT PALAS HƯỚNG SÂN TRÊN: hai bức tranh tường (thánh George trái, Đức Mẹ Bavaria phải — cắt từ ảnh Commons CC BY-SA 4.0, Naturliebhaberin) ở tầng trên
// sát chân đầu hồi, ban công đá giữa mặt (sàn + lan can + con-xon đỡ). Bố cục theo ảnh "Oberer Schlosshof Neuschwanstein". tuong = { x1, z1, x2, z2, y1 }
export function datMatPalas({ THREE, mergeGeometries, tuong, tranh = {} }) {
  const { x1, z1, x2, z2, y1 } = tuong, L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux;
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, quay = Math.atan2(nx, nz), ra = [];
  const DA = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.8 });
  // khối cùng vật liệu gộp thành MỘT lưới lúc cuối (diềm răng cưa đầu hồi có vài chục khối nhỏ — để riêng thì mỗi khối một lệnh vẽ); tranh giữ lưới riêng
  const gom = new Map();
  const dat = (m, s, y, ra_) => { m.position.set(mx + ux * s + nx * ra_, y, mz + uz * s + nz * ra_); m.rotation.y = quay; m.castShadow = false; m.receiveShadow = true;
    if (m.material.map) { ra.push(m); return m; } m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry).applyMatrix4(m.matrix); if (g.attributes.uv) g.deleteAttribute('uv');
    if (!gom.has(m.material)) gom.set(m.material, []); gom.get(m.material).push(g); return m; };
  const TOI = new THREE.MeshStandardMaterial({ color: '#1b1f27', roughness: 0.6 });
  const cum = (o, s, y) => { const c = nhomCua(THREE, o); for (const g of c.da) dat(new THREE.Mesh(g, DA), s, y, 0); for (const g of c.toi) dat(new THREE.Mesh(g, TOI), s, y, 0); };
  const go = (y) => dat(new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, 0.22), DA), 0, y, 0.11); // gờ đá ngang cả mặt
  // dải trên (đã chừa trống cửa sổ): hai tranh hai bên, cửa vòm đôi giữa — như ảnh thật
  const yT = y1 - 4.4;
  for (const [ten, lech] of [['palas-thanh-george', 0.3], ['palas-duc-me', -0.3]]) { // trục dọc tường của khung (x cục bộ) chạy ngược ux → tranh trái dùng lệch dương
    const t = tranh[ten]; if (!t) continue; const cao = 4.4, rong = Math.min(L * 0.26, cao * t.image.width / t.image.height);
    dat(new THREE.Mesh(new THREE.PlaneGeometry(rong, cao), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })), L * lech, yT, 0.03);
  }
  for (const k of [-0.86, 0.86]) cum({ n: 2, w: 0.34, h: 2.0 }, k, yT - 0.6); // giữa hai tranh: hai cụm cửa đôi có cột, mỗi cụm dưới một vòm
  // ban công giữa mặt, dưới dải tranh: cửa vòm ra ban công, sàn 4,2 × 1,1 m, lan can, con-xon
  const yB = y1 - 8.6;
  cum({ n: 3, w: 0.42, h: 2.4 }, 0, yB + 0.14); // cửa ra ban công: cụm ba ô có cột dưới vòm lớn
  go(yB - 0.95);
  // các tầng dưới ban công: mỗi tầng ba cụm (4 · 3 · 4 ô) dưới vòm mù, gờ đá dưới mỗi tầng — tới sát mặt sân
  const yDat = Number.isFinite(tuong.yDat) ? tuong.yDat : y1 - 30;
  for (let y = yB - 6.2; y > yDat + 0.7; y -= 6.2) { go(y - 0.35); for (const [n, s] of [[4, -2.3], [3, 0], [4, 2.3]]) cum({ n, w: 0.36, h: 2.0 }, s, y); }
  dat(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.26, 1.1), DA), 0, yB, 0.55);
  dat(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.14), DA), 0, yB + 0.58, 1.04);
  dat(new THREE.Mesh(new THREE.BoxGeometry(4.36, 0.09, 0.24), DA), 0, yB + 1.07, 1.04);
  for (const k of [-1, 1]) dat(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1.1), DA), k * 2.03, yB + 0.58, 0.55);
  for (const k of [-1.6, -0.55, 0.55, 1.6]) dat(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.9), DA), k, yB - 0.48, 0.45);
  // ĐẦU HỒI — tam giác thật lấy từ hình khối đã dựng (tuong.hoi = { sD, yD: đỉnh · sA, sB: hai chân · yC: chân }, s đo dọc tường từ giữa theo ux;
  // đỉnh không nhất thiết ở giữa bức tường): gờ đá viền hai mép, diềm răng cưa bậc song song hai mép, cửa sổ tròn, lỗ tròn nhỏ, bệ + tượng sư tử trên đỉnh — như ảnh
  const hoi = tuong.hoi || (tuong.y2 > y1 + 4 ? { sD: 0, yD: tuong.y2, sA: -L / 2, sB: L / 2, yC: y1 } : null);
  if (hoi && hoi.yD > hoi.yC + 4) {
    const { sD, yD, sA, sB, yC } = hoi, H = yD - yC, BAC = 1.45, VT = 0.2, SAU = 0.12;
    const be = (y, k) => (k < 0 ? sD - sA : sB - sD) * (1 - (y - yC) / H) - 1.1; // bề ngang từ trục đỉnh tới mép (thụt 1,1 m) ở độ cao y, phía k
    let y = yC + 0.5;
    for (; Math.min(be(y + BAC, -1), be(y + BAC, 1)) > 0.9; y += BAC) for (const k of [-1, 1]) {
      const w0 = be(y, k), w1 = be(y + BAC, k);
      dat(new THREE.Mesh(new THREE.BoxGeometry(w0 - w1 + VT, VT, SAU), DA), sD + k * (w0 + w1) / 2, y, SAU / 2); // bậc ngang
      dat(new THREE.Mesh(new THREE.BoxGeometry(VT, BAC, SAU), DA), sD + k * w1, y + BAC / 2, SAU / 2); // bậc đứng
      for (let q = w1 + 0.35; q < w0 - 0.2; q += 0.6) dat(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, SAU), DA), sD + k * q, y + VT / 2 + 0.15, SAU / 2); // răng nhỏ trên bậc
    }
    const wl = be(y, -1), wr = be(y, 1);
    dat(new THREE.Mesh(new THREE.BoxGeometry(wl + wr + VT, VT, SAU), DA), sD + (wr - wl) / 2, y, SAU / 2); // bậc trên cùng nối hai bên
    // gờ viền hai mép đầu hồi: trục x cục bộ của khung chạy NGƯỢC ux → góc nghiêng tính theo −Δs
    for (const sE of [sA, sB]) { const ds = sD - sE, g = new THREE.BoxGeometry(Math.hypot(ds, H) + 0.3, 0.36, 0.3); g.rotateZ(Math.atan2(H, -ds)); dat(new THREE.Mesh(g, DA), (sD + sE) / 2, yC + H / 2 + 0.12, 0.15); }
    const DONG = new THREE.MeshStandardMaterial({ color: '#6d6a58', roughness: 0.5, metalness: 0.35 });
    dat(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), DA), sD, yD + 0.15, 0.1);
    dat(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.1), DA), sD, yD + 0.65, 0.1);
    const su = [[new THREE.CylinderGeometry(0.26, 0.36, 0.95, 8), 0, 1.15, -0.05], [new THREE.SphereGeometry(0.36, 10, 8), 0, 1.72, 0.08], [new THREE.SphereGeometry(0.22, 10, 8), 0, 1.75, 0.34],
      [new THREE.BoxGeometry(0.16, 0.12, 0.16), 0, 1.66, 0.52], [new THREE.CylinderGeometry(0.07, 0.08, 0.6, 6), -0.15, 0.97, 0.26], [new THREE.CylinderGeometry(0.07, 0.08, 0.6, 6), 0.15, 0.97, 0.26],
      [new THREE.BoxGeometry(0.7, 0.3, 0.75), 0, 0.82, -0.12]]; // thân ngồi, bờm, đầu, mõm, hai chân trước, đùi sau — mặt quay ra sân
    for (const [g, x, yy, z] of su) { g.translate(x, yy - 0.1, z + 0.1); dat(new THREE.Mesh(g, DONG), sD, yD, 0); }
    const yTron = yC + H * 0.45;
    dat(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.11, 6, 20), DA), sD, yTron, 0.06);
    dat(new THREE.Mesh(new THREE.CircleGeometry(0.56, 18), TOI), sD, yTron, 0.02);
    for (const [k, h] of [[1, 0.2], [-1, 0.2], [0.55, 0.62], [-0.55, 0.62], [0, 0.8]]) { // lỗ tròn nhỏ (k: phần bề ngang phía đó ở độ cao đó)
      const yy = yC + H * h, w = be(yy, k < 0 ? -1 : 1); if (w < 0.5) continue;
      dat(new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), TOI), sD + k * Math.max(0, w - 0.9), yy, 0.02);
    }
  }
  for (const [vl, ds] of gom) { const m = new THREE.Mesh(mergeGeometries(ds), vl); m.castShadow = false; m.receiveShadow = true; ra.push(m); }
  return ra;
}

// THÁP GÓC treo trên con-xon (hai tháp sa thạch vàng hai bên mặt Palas hướng sân, ảnh Naturliebhaberin), dựng theo ảnh:
// thân BÁT GIÁC bọc ngoài thân tròn OSM (y0 → y1), con-xon xếp bậc bát giác thu nhỏ dần thành mũi nhọn, gờ tầng, cửa sổ ĐÔI có cột nhỏ (nhomCua) chỉ trên mặt
// quay ra ngoài (ngoai(x, z) = điểm trước mặt đó không nằm trong khối khác), diềm vòm nhỏ dưới gờ đỉnh, vành răng cưa, mái chóp bát giác đồng xanh + chóp.
// Gộp: đá (màu tháp) · lòng cửa tối · mái. → [Mesh…]
export function datThapGoc({ THREE, mergeGeometries, v, y0, y1, y2 = null, mau, mauMai = '#7f9e8c', ngoai = () => true, nhe = false }) {
  const cx = v.reduce((s, p) => s + p[0], 0) / v.length, cz = v.reduce((s, p) => s + p[1], 0) / v.length;
  const R = Math.max(...v.map((p) => Math.hypot(p[0] - cx, p[1] - cz))) * 1.12 + 0.04, AP = R * Math.cos(Math.PI / 8), CANH = 2 * R * Math.sin(Math.PI / 8); // bán kính đỉnh / trung đoạn / cạnh bát giác
  const da = [], toi = [], cb = (g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
  const bat = (rt, rd, h, y, kin = false) => { const g = cb(new THREE.CylinderGeometry(rt, rd, h, 8, 1, !kin)); g.translate(cx, y, cz); return g; }; // lăng trụ bát giác, y = tâm; mặt i hướng góc (i + ½)·45°
  da.push(bat(R, R, y1 - y0, (y0 + y1) / 2));
  // con-xon xếp bậc: mỗi bậc một vành gờ nhô rồi thu vào, tổng ~3,6 m
  let y = y0, r = R;
  for (const [h, co] of [[0.35, 1.0], [0.7, 0.86], [0.8, 0.68], [0.9, 0.46], [0.85, 0.08]]) { const r2 = R * co; da.push(bat(r + 0.12, r + 0.12, 0.16, y - 0.08, true), bat(r, r2, h, y - h / 2, true)); y -= h; r = r2; }
  for (let yy = y0 + 4.2; yy < y1 - 2; yy += 4.2) da.push(bat(R + 0.1, R + 0.1, 0.2, yy, true)); // gờ tầng
  // gờ đỉnh + diềm vòm nhỏ (mỗi mặt 3 vòm) + vành răng cưa (mỗi mặt 2 răng)
  da.push(bat(R + 0.32, R + 0.06, 0.5, y1 - 0.15, true), bat(R + 0.32, R + 0.32, 0.25, y1 + 0.22, true));
  const matI = (i) => { const a = (i + 0.5) * Math.PI / 4; return { a, ox: Math.sin(a), oz: Math.cos(a), quay: a }; }; // CylinderGeometry: đỉnh ở góc θ là (r·sinθ, r·cosθ)
  const dat = (g, i, x, yy, d) => { const { ox, oz, quay } = matI(i); g.translate(x, 0, 0); g.rotateY(quay); g.translate(cx + ox * (AP + d), yy, cz + oz * (AP + d)); return g; };
  for (let i = 0; i < 8; i++) {
    for (const x of [-CANH / 3, 0, CANH / 3]) { const g = cb(new THREE.TorusGeometry(CANH / 7, 0.045, 3, nhe ? 4 : 6, Math.PI)); da.push(dat(g, i, x, y1 - 0.85, 0.04)); }
    for (const x of [-CANH / 4, CANH / 4]) da.push(dat(cb(new THREE.BoxGeometry(CANH / 3.2, 0.75, 0.3)), i, x, y1 + 0.72, 0.18));
  }
  // cửa sổ đôi có cột: mỗi gờ tầng một hàng, chỉ mặt quay ra ngoài
  for (let yy = y0 + 1.0; yy + 1.7 < y1 - 1.2; yy += 4.2) for (let i = 0; i < 8; i++) {
    const { ox, oz } = matI(i); if (!ngoai(cx + ox * (AP + 1.2), cz + oz * (AP + 1.2))) continue;
    const c = nhomCua(THREE, { n: 2, w: Math.min(0.36, CANH / 3.4), h: 1.6, vom: false, nhe });
    for (const g of c.da) da.push(dat(g, i, 0, yy, 0)); for (const g of c.toi) toi.push(dat(g, i, 0, yy, 0));
  }
  const ra = [], gop = (ds, vl, bong = false) => { if (!ds.length) return; const m = new THREE.Mesh(mergeGeometries(ds), vl); m.castShadow = bong; m.receiveShadow = true; ra.push(m); };
  if (y2 > y1) { // mái chóp bát giác đồng xanh (trùm nón OSM tối bên trong) + chóp
    const hM = y2 - y1 + 0.6, g = cb(new THREE.ConeGeometry(R + 0.12, hM, 8, 1, true)); g.translate(cx, y1 + 0.1 + hM / 2, cz);
    const q = cb(new THREE.SphereGeometry(0.15, 8, 6)); q.translate(cx, y1 + 0.1 + hM + 0.1, cz); const k = cb(new THREE.CylinderGeometry(0.02, 0.05, 1.1, 5)); k.translate(cx, y1 + 0.1 + hM + 0.7, cz);
    gop([g, q, k], new THREE.MeshStandardMaterial({ color: mauMai, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }), !nhe);
  }
  gop(da, new THREE.MeshStandardMaterial({ color: mau, roughness: 0.8 })); gop(toi, new THREE.MeshStandardMaterial({ color: '#1b1f27', roughness: 0.6 }));
  return ra;
}
