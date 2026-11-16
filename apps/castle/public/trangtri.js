// TRANG TRÍ MẶT TIỀN dựng khối 3D (dùng chung mọi lâu đài) — bật theo thẻ của từng khối trong du-lieu/<lâu>-sua.json:
//   rang_cua=yes     tường răng cưa trên đỉnh tường các mặt NGOÀI (mặt không áp vào khối khác)
//   vom_nho=yes      dải vòm nhỏ (cung đá trên các con sơn) ngay dưới tường răng cưa
//   da_goc=yes       đá góc so le dài / ngắn ở các góc lồi của khối (tường gạch đỏ viền đá kem)
//   thap_canh=yes    hai tháp canh treo (thân tròn trên chân côn, đỉnh răng cưa) ở hai đầu mặt ngoài dài nhất
//   vong_rang=yes    đỉnh tháp tròn: vành con sơn nhô ra + vòng răng cưa (thay mái nhọn — tháp góc Torbau)
// Mẫu: ảnh Mapillary 360° cổng Torbau (990990575063069, 493003245182754 — 2019). Toạ độ: đa giác ngược chiều kim nhìn từ trên → pháp tuyến ngoài (uz, −ux).
// tra-repo-ok: hình khối thủ tục nhỏ của cảnh (hộp / trụ / côn ghép), không có thư viện tương ứng.

export function datTrangTri({ THREE, mergeGeometries, dsKhoi, vl, ngoai, coSoDo = null }) { // coSoDo("khối#cạnh") → hàng cửa đo được (neo sắt chỉ đặt giữa hai hàng đo)
  const gs = [], sat = [], dem = { rang: 0, vom: 0, goc: 0, canh: 0, vong: 0 };
  const uvTG = (g) => { const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2); // vân đá theo toạ độ thật
    for (let i = 0; i < p.count; i++) { const ngang = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? p.getZ(i) : p.getX(i), dung = Math.abs(n.getY(i)) > 0.7; uv[i * 2] = (dung ? p.getX(i) : ngang) / 2; uv[i * 2 + 1] = (dung ? p.getZ(i) : p.getY(i)) / 2; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; };
  const them = (g) => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a); g.computeVertexNormals(); gs.push(uvTG(g)); };
  // hộp đặt theo cạnh: tâm (x, y, z), dài a dọc cạnh (ux, uz), cao h, sâu d theo pháp tuyến
  const hop = (x, y, z, ux, uz, a, h, d) => { const g = new THREE.BoxGeometry(a, h, d); g.rotateY(-Math.atan2(uz, ux)); g.translate(x, y, z); them(g); };
  const tru = (x, y0, z, r0, r1, h, n = 10) => { const g = new THREE.CylinderGeometry(r1, r0, h, n, 1, false); g.translate(x, y0 + h / 2, z); them(g); };
  // vòng răng cưa quanh tâm: tường vành dày 0,4 + răng 0,8 m
  const vongRang = (cx, y, cz, r, cao = 1.3) => { const n = Math.max(6, Math.round(2 * Math.PI * r / 1.3));
    const vanh = new THREE.CylinderGeometry(r, r, cao * 0.45, Math.max(12, n * 2), 1, true); vanh.translate(cx, y + cao * 0.225, cz); them(vanh);
    const trong = new THREE.CylinderGeometry(r - 0.4, r - 0.4, cao * 0.45, Math.max(12, n * 2), 1, true); trong.scale(-1, 1, 1); trong.translate(cx, y + cao * 0.225, cz); them(trong);
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2, x = cx + Math.cos(a) * (r - 0.2), z = cz + Math.sin(a) * (r - 0.2); hop(x, y + cao * 0.45 + cao * 0.275, z, -Math.sin(a), Math.cos(a), Math.min(0.9, 2 * Math.PI * r / n * 0.55), cao * 0.55, 0.4); } };
  for (const k of dsKhoi) {
    const t = k.tags, v = k.v, y1 = k._y1 ?? k.yTren; if (!Number.isFinite(y1)) continue;
    const yMong = k._yMong ?? y1 - 10, coThe = (a) => t[a] === 'yes';
    if (!['rang_cua', 'vom_nho', 'da_goc', 'thap_canh', 'vong_rang'].some(coThe) && !t.neo_y) continue;
    const canh = v.map((p, i) => { const q = v[(i + 1) % v.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / (L || 1), uz = (q[1] - p[1]) / (L || 1);
      const nx = uz, nz = -ux, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; return { p, q, L, ux, uz, nx, nz, ngoai: L > 0.8 && ngoai(k, mx + nx * 0.8, mz + nz * 0.8, y1 - 0.5) }; });
    if (coThe('vong_rang')) { // tháp tròn: tâm + bán kính trung bình
      const cx = v.reduce((s, p) => s + p[0], 0) / v.length, cz = v.reduce((s, p) => s + p[1], 0) / v.length, r = v.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / v.length;
      tru(cx, y1 - 1.1, cz, r, r + 0.4, 1.1, 24); // vành con sơn (côn ra ngoài)
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; hop(cx + Math.cos(a) * (r + 0.1), y1 - 1.6, cz + Math.sin(a) * (r + 0.1), -Math.sin(a), Math.cos(a), 0.35, 1.0, 0.45); } // con sơn
      tru(cx, y1, cz, r + 0.4, r + 0.4, 0.25, 24); vongRang(cx, y1 + 0.25, cz, r + 0.4); dem.vong++;
    }
    for (const c of canh) { if (!c.ngoai) continue;
      const { p, ux, uz, nx, nz, L } = c;
      if (coThe('rang_cua')) { // tường thấp + răng: răng 0,9 m, khe 0,6 m, cao 0,9 m trên tường 0,5 m
        hop(p[0] + ux * L / 2 + nx * 0.05, y1 + 0.25, p[1] + uz * L / 2 + nz * 0.05, ux, uz, L + 0.4, 0.5, 0.5);
        const n = Math.max(1, Math.round((L + 0.6) / 1.5)), b = L / n; for (let i = 0; i < n; i++) { const s = (i + 0.5) * b; hop(p[0] + ux * s + nx * 0.05, y1 + 0.95, p[1] + uz * s + nz * 0.05, ux, uz, Math.min(0.9, b * 0.6), 0.9, 0.5); } dem.rang++; }
      if (coThe('vom_nho')) { // dải đá + cung nhỏ trên con sơn, nhô 0,18 m, ngay dưới đỉnh tường
        hop(p[0] + ux * L / 2 + nx * 0.1, y1 - 0.12, p[1] + uz * L / 2 + nz * 0.1, ux, uz, L, 0.24, 0.2);
        const n = Math.max(1, Math.round(L / 0.85)), b = L / n;
        for (let i = 0; i < n; i++) { const s = (i + 0.5) * b, x = p[0] + ux * s + nx * 0.09, z = p[1] + uz * s + nz * 0.09, g = new THREE.TorusGeometry(b / 2 - 0.08, 0.06, 3, 6, Math.PI); g.translate(0, y1 - 0.62, 0); g.rotateY(-Math.atan2(uz, ux)); g.translate(x, 0, z); them(g);
          hop(p[0] + ux * i * b + nx * 0.09, y1 - 0.75, p[1] + uz * i * b + nz * 0.09, ux, uz, 0.14, 0.3, 0.18); } dem.vom++; }
    }
    if (coThe('da_goc')) canh.forEach((c, i) => { const tr = canh[(i + v.length - 1) % v.length]; if (!c.ngoai && !tr.ngoai) return; // góc giữa cạnh trước (tr) và cạnh này (c), tại đỉnh c.p
      const lo = tr.ux * c.uz - tr.uz * c.ux; if (lo <= 0.2) return; // chỉ góc LỒI rõ (đa giác ngược chiều kim: rẽ trái là lồi)
      for (let y = yMong + 0.2, j = 0; y < y1 - 0.4; y += 0.7, j++) { const dai = j % 2 ? 0.5 : 0.9;
        if (c.ngoai) hop(c.p[0] + c.ux * dai / 2 + c.nx * 0.04, y, c.p[1] + c.uz * dai / 2 + c.nz * 0.04, c.ux, c.uz, dai, 0.32, 0.1);
        if (tr.ngoai) { const d2 = j % 2 ? 0.9 : 0.5; hop(c.p[0] - tr.ux * d2 / 2 + tr.nx * 0.04, y, c.p[1] - tr.uz * d2 / 2 + tr.nz * 0.04, tr.ux, tr.uz, d2, 0.32, 0.1); } }
      dem.goc++; });
    // NEO SẮT hoa huệ giữa hai tầng cửa (ảnh: 4 neo trên cánh gạch đỏ): chỉ trên mặt có SỐ ĐO cửa với hàng dưới < neo_y < hàng trên (mặt dựng cửa thủ tục
    // không biết hàng cửa nằm đâu → neo đè lên cửa). Hình: thanh đứng + thanh ngang ngắn + đầu hoa (khối xoay 45°) + hai cánh cong (khối nghiêng)
    if (Number.isFinite(+t.neo_y) && t.neo_y !== '') canh.forEach((c, ci) => { const y = +t.neo_y, h = coSoDo?.(k.id + '#' + ci); if (!c.ngoai || c.L < 3 || !h?.length) return;
      if (!(h.some((r) => r.y1 < y) && h.some((r) => r.y0 > y))) return;
      const n = Math.max(2, Math.floor(c.L / 2)), b = c.L / n; // cánh 8,9 m → 4 neo như ảnh
      for (let i = 0; i < n; i++) { const s = (i + 0.5) * b, x = c.p[0] + c.ux * s + c.nx * 0.06, z = c.p[1] + c.uz * s + c.nz * 0.06;
        sat.push([x, y, z, c.ux, c.uz, 0.12, 1.0, 0.08, 0], [x, y - 0.15, z, c.ux, c.uz, 0.55, 0.1, 0.08, 0], [x, y + 0.58, z, c.ux, c.uz, 0.24, 0.24, 0.08, Math.PI / 4],
          [x - c.ux * 0.16, y + 0.36, z - c.uz * 0.16, c.ux, c.uz, 0.1, 0.38, 0.08, 0.65], [x + c.ux * 0.16, y + 0.36, z + c.uz * 0.16, c.ux, c.uz, 0.1, 0.38, 0.08, -0.65]); } });
    if (coThe('thap_canh')) { const c = canh.filter((c) => c.ngoai).sort((a, b) => b.L - a.L)[0]; if (c) for (const [x, z] of [c.p, c.q]) { // tháp canh treo ở hai đầu mặt chính
      const r = 1.05, ra = x === c.p[0] && z === c.p[1] ? -1 : 1, cx = x + c.nx * 0.75 + c.ux * ra * 0.45, cz = z + c.nz * 0.75 + c.uz * ra * 0.45, yc = y1 - 2.4; // tâm nhô ra ngoài góc (trước lún nửa thân vào tường)
      tru(cx, yc - 1.5, cz, 0.15, r, 1.5, 10); tru(cx, yc, cz, r, r, 2.4, 12); tru(cx, yc + 2.4, cz, r, r + 0.12, 0.2, 12); vongRang(cx, yc + 2.6, cz, r + 0.12, 1.0); dem.canh++; } }
  }
  const ra = [];
  if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), vl); m.castShadow = m.receiveShadow = true; ra.push(m); }
  if (sat.length) { const g = mergeGeometries(sat.map(([x, y, z, ux, uz, a, h, d, xoay = 0]) => { const b = new THREE.BoxGeometry(a, h, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateZ(xoay); b.rotateY(-Math.atan2(uz, ux)); b.translate(x, y, z); return b; }));
    ra.push(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#23201d', roughness: 0.6, metalness: 0.5 }))); dem.neo = sat.length / 5; }
  return { ra, dem };
}

// CỔNG VÒM: cánh cửa gỗ ô vuông mở vào trong (hai cánh áp vào lòng cổng) + phù điêu huy hiệu trên vòm (ảnh 360° cổng Torbau)
// c: { x, z, y, w, ux, uz } — điểm tim đường cắt mặt tường ngoài; cao: chiều cao lỗ cổng; trong hệ cục bộ trục +z hướng VÀO trong nhà
export function datCuaCong({ THREE, mergeGeometries, c, cao, vlGo, vlDa }) { // c.x, c.z: đặt ở MẶT NGOÀI CÙNG của tường (ns.js dời ra khỏi mọi khối)
  const go = [], da = [], dat = (g) => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a); g.rotateY(-Math.atan2(c.uz, c.ux)); g.translate(c.x, c.y, c.z); return g; };
  const hop = (arr, a, h, d, x, y, z) => { const g = new THREE.BoxGeometry(a, h, d); g.translate(x, y, z); arr.push(dat(g)); };
  const w = c.w, nua = w / 2, hc = cao - nua; // cánh thẳng tới chân vòm
  for (const s of [-1, 1]) { const x = s * (nua - 0.1), sau = nua - 0.1; // cánh mở 90°: áp vào má cổng, sâu bằng nửa bề rộng
    hop(go, 0.12, hc - 0.05, sau, x, hc / 2, 0.35 + sau / 2);
    for (let i = 1; i < 4; i++) hop(go, 0.16, 0.08, sau, x - s * 0.02, hc * i / 4, 0.35 + sau / 2); // nẹp ngang ô vuông
    for (let i = 1; i < 3; i++) hop(go, 0.16, hc - 0.1, 0.08, x - s * 0.02, hc / 2, 0.35 + sau * i / 3); }
  // huy hiệu: tấm khiên + khung, giữa mặt tường trên đỉnh vòm 1,2 m (ngoài: −z)
  const yH = cao + 1.6, sh = new THREE.Shape(); sh.moveTo(-0.6, 0.7); sh.lineTo(0.6, 0.7); sh.lineTo(0.6, 0); sh.quadraticCurveTo(0.55, -0.6, 0, -0.85); sh.quadraticCurveTo(-0.55, -0.6, -0.6, 0); sh.lineTo(-0.6, 0.7);
  const k = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false, curveSegments: 4 }); k.translate(0, yH, -0.2); da.push(dat(k));
  hop(da, 2.6, 1.9, 0.08, 0, yH, -0.06); for (const s of [-1, 1]) hop(da, 0.55, 1.2, 0.22, s * 0.95, yH - 0.1, -0.15); // nền phù điêu + hai thú đỡ khiên (khối)
  const ra = []; if (go.length) ra.push(new THREE.Mesh(mergeGeometries(go), vlGo)); if (da.length) ra.push(new THREE.Mesh(mergeGeometries(da), vlDa));
  for (const m of ra) m.castShadow = m.receiveShadow = true; return ra;
}
