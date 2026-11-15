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

// MẶT PALAS HƯỚNG SÂN TRÊN: hai bức tranh tường (thánh George trái, Đức Mẹ Bavaria phải — cắt từ ảnh Commons CC BY-SA 4.0, Naturliebhaberin) ở tầng trên
// sát chân đầu hồi, ban công đá giữa mặt (sàn + lan can + con-xon đỡ). Bố cục theo ảnh "Oberer Schlosshof Neuschwanstein". tuong = { x1, z1, x2, z2, y1 }
export function datMatPalas({ THREE, tuong, tranh = {} }) {
  const { x1, z1, x2, z2, y1 } = tuong, L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux;
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, quay = Math.atan2(nx, nz), ra = [];
  const DA = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.8 });
  const dat = (m, s, y, ra_) => { m.position.set(mx + ux * s + nx * ra_, y, mz + uz * s + nz * ra_); m.rotation.y = quay; m.castShadow = false; m.receiveShadow = true; ra.push(m); return m; };
  const TOI = new THREE.MeshStandardMaterial({ color: '#1b1f27', roughness: 0.6 });
  const oVom = (w, h, s, y, ra_) => { // ô cửa vòm tối phẳng sát tường + khung đá nhô
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
    dat(new THREE.Mesh(new THREE.ShapeGeometry(sh, 8), TOI), s, y, ra_ + 0.02);
    for (const k of [-1, 1]) dat(new THREE.Mesh(new THREE.BoxGeometry(0.14, h - w / 2, 0.2), DA), s + k * (w / 2 + 0.07), y + (h - w / 2) / 2, ra_ + 0.1);
  };
  // dải trên (đã chừa trống cửa sổ): hai tranh hai bên, cửa vòm đôi giữa — như ảnh thật
  const yT = y1 - 4.4;
  for (const [ten, lech] of [['palas-thanh-george', 0.3], ['palas-duc-me', -0.3]]) { // trục dọc tường của khung (x cục bộ) chạy ngược ux → tranh trái dùng lệch dương
    const t = tranh[ten]; if (!t) continue; const cao = 4.4, rong = Math.min(L * 0.3, cao * t.image.width / t.image.height);
    dat(new THREE.Mesh(new THREE.PlaneGeometry(rong, cao), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })), L * lech, yT, 0.03);
  }
  for (const k of [-0.62, 0.62]) oVom(0.95, 2.2, k, yT - 0.9, 0);
  // ban công giữa mặt, dưới dải tranh: cửa vòm ra ban công, sàn 4,2 × 1,1 m, lan can, con-xon
  const yB = y1 - 8.6;
  oVom(1.3, 2.5, 0, yB + 0.14, 0);
  dat(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.26, 1.1), DA), 0, yB, 0.55);
  dat(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.14), DA), 0, yB + 0.58, 1.04);
  dat(new THREE.Mesh(new THREE.BoxGeometry(4.36, 0.09, 0.24), DA), 0, yB + 1.07, 1.04);
  for (const k of [-1, 1]) dat(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1.1), DA), k * 2.03, yB + 0.58, 0.55);
  for (const k of [-1.6, -0.55, 0.55, 1.6]) dat(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.9), DA), k, yB - 0.48, 0.45);
  return ra;
}
