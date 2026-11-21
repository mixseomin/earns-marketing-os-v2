// TRANG TRÍ MẶT TIỀN dựng khối 3D (dùng chung mọi lâu đài) — bật theo thẻ của từng khối trong du-lieu/<lâu>-sua.json:
//   rang_cua=yes     tường răng cưa trên đỉnh tường các mặt NGOÀI (mặt không áp vào khối khác)
//   vom_nho=yes      dải vòm nhỏ (cung đá trên các con sơn) ngay dưới tường răng cưa
//   da_goc=yes       đá góc so le dài / ngắn ở các góc lồi của khối (tường gạch đỏ viền đá kem)
//   (17/11/2026: mọi mục dưới CHỈ dựng khi cua-so.json có số đếm / đo trên ảnh — thiếu thì không dựng, ghi dem.thieuAnh)
//   thap_canh=yes    tháp canh treo (thân tròn trên chân côn, đỉnh răng cưa) — CHỈ dựng ở vị trí đo trên ảnh: cua-so.json "khối#cạnh".thap_canh = [[s, y mũi, y đỉnh, r], …]
//   vong_rang=yes    đỉnh tháp tròn: vành con sơn nhô ra + vòng răng cưa (thay mái nhọn — tháp góc Torbau)
//   cua_thap=N       tháp tròn: N ô cửa đứng nhỏ mỗi phía (4 phía, so le độ cao)
//   go_y=a,b         gờ đá ngang ở các độ cao tuyệt đối a, b… trên mọi mặt ngoài
//   neo_y=y          neo sắt hoa huệ ở độ cao y (chỉ mặt có số đo cửa, giữa hai hàng)
// + số răng cưa / số cung vòm nhỏ đếm trên ảnh: cua-so.json "khối#cạnh".rang_cua / .vom_nho (không có thì chia theo chiều dài)
// + ô cửa vuông nhỏ theo số đo: <lâu>-cua-so.json "khối#cạnh".o_vuong = [[s, y0, rộng, cao], …] (lòng tối + khung đá)
// Mỗi chi tiết ghi vào sổ kk { mat: "khối#cạnh" | "khối#*", loai, y, hop? } — ns.js gộp theo VÙNG mặt tường để scripts/kiem-ke.mjs so với ảnh;
// hop = khối bao thật { cx, cz, r, y0, y1 } của chi tiết khối 3D nhô ra trước tường → kiểm kê báo CHI TIẾT ĐÈ CỬA khi nó che khung một ô cửa (anh 17/11/2026: tháp canh treo đè cửa vẫn "khớp").
// Mẫu: ảnh Mapillary 360° cổng Torbau (990990575063069, 493003245182754 — 2019). Toạ độ: đa giác ngược chiều kim nhìn từ trên → pháp tuyến ngoài (uz, −ux).
// tra-repo-ok: hình khối thủ tục nhỏ của cảnh (hộp / trụ / côn ghép), không có thư viện tương ứng.

export function datTrangTri({ THREE, mergeGeometries, dsKhoi, vl, ngoai, coSoDo = null, oVuong = null, soDo = null }) { // soDo("khối#cạnh") → mục cua-so.json (rang_cua / vom_nho: số đếm trên ảnh) // coSoDo("khối#cạnh") → hàng cửa đo được (neo sắt chỉ đặt giữa hai hàng đo)
  const gs = [], sat = [], toi = [], toiTron = [], kk = [], ghi = (mat, loai, y, n = 1, x = null, z = null, hop = null) => { for (let i = 0; i < n; i++) kk.push({ mat, loai, y, x, z, hop }); }, dem = { rang: 0, vom: 0, goc: 0, canh: 0, vong: 0 };
  const uvTG = (g) => { const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2); // vân đá theo toạ độ thật
    for (let i = 0; i < p.count; i++) { const ngang = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? p.getZ(i) : p.getX(i), dung = Math.abs(n.getY(i)) > 0.7; uv[i * 2] = (dung ? p.getX(i) : ngang) / 2; uv[i * 2 + 1] = (dung ? p.getZ(i) : p.getY(i)) / 2; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; };
  const them = (g) => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a); g.computeVertexNormals(); gs.push(uvTG(g)); };
  // hộp đặt theo cạnh: tâm (x, y, z), dài a dọc cạnh (ux, uz), cao h, sâu d theo pháp tuyến
  const hop = (x, y, z, ux, uz, a, h, d) => { const g = new THREE.BoxGeometry(a, h, d); g.rotateY(-Math.atan2(uz, ux)); g.translate(x, y, z); them(g); };
  const tru = (x, y0, z, r0, r1, h, n = 10) => { const g = new THREE.CylinderGeometry(r1, r0, h, n, 1, false); g.translate(x, y0 + h / 2, z); them(g); };
  // vòng răng cưa quanh tâm: tường vành dày 0,4 + răng 0,8 m
  const vongRang = (cx, y, cz, r, cao = 1.3, nDem = null) => { const n = nDem > 0 ? nDem : Math.max(6, Math.round(2 * Math.PI * r / 1.3)); // nDem: số răng đếm trên ảnh
    const vanh = new THREE.CylinderGeometry(r, r, cao * 0.45, Math.max(12, n * 2), 1, true); vanh.translate(cx, y + cao * 0.225, cz); them(vanh);
    const trong = new THREE.CylinderGeometry(r - 0.4, r - 0.4, cao * 0.45, Math.max(12, n * 2), 1, true); trong.scale(-1, 1, 1); trong.translate(cx, y + cao * 0.225, cz); them(trong);
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2, x = cx + Math.cos(a) * (r - 0.2), z = cz + Math.sin(a) * (r - 0.2); hop(x, y + cao * 0.45 + cao * 0.275, z, -Math.sin(a), Math.cos(a), Math.min(0.9, 2 * Math.PI * r / n * 0.55), cao * 0.55, 0.4); } };
  for (const k of dsKhoi) {
    const t = k.tags, v = k.v, y1 = k._y1 ?? k.yTren; if (!Number.isFinite(y1)) continue;
    const yMong = k._yMong ?? y1 - 10, coThe = (a) => t[a] === 'yes';
    if (!['rang_cua', 'vom_nho', 'da_goc', 'thap_canh', 'vong_rang'].some(coThe) && !t.neo_y && !t.go_y && !t.cua_thap && !v.some((_, i) => { const e = soDo?.(k.id + '#' + i); return e?.o_vuong?.length || e?.o_tron?.length || e?.ban_cong?.length || e?.dong_ho?.length || e?.neo_y != null; })) continue;
    const canh = v.map((p, i) => { const q = v[(i + 1) % v.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / (L || 1), uz = (q[1] - p[1]) / (L || 1);
      const nx = uz, nz = -ux, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; return { p, q, L, ux, uz, nx, nz, ngoai: L > 0.8 && ngoai(k, mx + nx * 0.8, mz + nz * 0.8, y1 - 0.5) }; });
    // TẤT CẢ chi tiết dưới đây CHỈ dựng theo số đếm / số đo trên ẢNH trong cua-so.json (anh 17/11/2026: "Làm chứ sao không làm" — bỏ hết luật đoán):
    // thẻ trong sua.json chỉ BẬT loại chi tiết; mặt / tháp chưa có số trên ảnh → không dựng + ghi dem.thieuAnh (kiểm kê báo THIẾU nếu ảnh đếm có)
    const sdT = soDo?.(k.id + '#*') || {};
    if (coThe('vong_rang') && !(+sdT.vong_rang > 0)) (dem.thieuAnh ??= []).push(k.id + '#* vong_rang (số răng trên ảnh)');
    if (coThe('vong_rang') && +sdT.vong_rang > 0) { // tháp tròn: tâm + bán kính trung bình; số răng = số đếm trên ảnh (cua-so.json "khối#*".vong_rang)
      const cx = v.reduce((s, p) => s + p[0], 0) / v.length, cz = v.reduce((s, p) => s + p[1], 0) / v.length, r = v.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / v.length;
      tru(cx, y1 - 1.1, cz, r, r + 0.4, 1.1, 24); // vành con sơn (côn ra ngoài)
      for (let i = 0, nCs = +sdT.vong_rang; i < nCs; i++) { const a = i / nCs * Math.PI * 2; hop(cx + Math.cos(a) * (r + 0.1), y1 - 1.6, cz + Math.sin(a) * (r + 0.1), -Math.sin(a), Math.cos(a), 0.35, 1.0, 0.45); } // con sơn
      tru(cx, y1, cz, r + 0.4, r + 0.4, 0.25, 24); vongRang(cx, y1 + 0.25, cz, r + 0.4, 1.3, +sdT.vong_rang); dem.vong++; ghi(k.id + '#*', 'vong_rang', y1 + 0.5);
    }
    if (+t.cua_thap > 0 && !sdT.cua_thap?.length) (dem.thieuAnh ??= []).push(k.id + '#* cua_thap (vị trí ô cửa tháp trên ảnh)');
    for (const [huong, y, cao = 0.9, rong = 0.45] of sdT.cua_thap || []) { // CỬA THÁP TRÒN theo ảnh: cua-so.json "khối#*".cua_thap = [[hướng la bàn °, y đáy, cao, rộng], …]
      const cx = v.reduce((s2, p) => s2 + p[0], 0) / v.length, cz = v.reduce((s2, p) => s2 + p[1], 0) / v.length, r = v.reduce((s2, p) => s2 + Math.hypot(p[0] - cx, p[1] - cz), 0) / v.length;
      const a = Math.atan2(-Math.cos(huong * Math.PI / 180), Math.sin(huong * Math.PI / 180)), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, yc = y + cao / 2;
      toi.push([x + Math.cos(a) * 0.02, yc, z + Math.sin(a) * 0.02, -Math.sin(a), Math.cos(a), rong, cao, 0.08]); hop(x, yc + cao / 2 + 0.1, z, -Math.sin(a), Math.cos(a), rong + 0.3, 0.14, 0.2); hop(x, yc - cao / 2 - 0.07, z, -Math.sin(a), Math.cos(a), rong + 0.3, 0.14, 0.24);
      ghi(k.id + '#*', 'o_vuong', yc, 1, x, z); }
    canh.forEach((c, i) => { c.mat = k.id + '#' + i; });
    for (const c of canh) { if (!c.ngoai) continue;
      const { p, ux, uz, nx, nz, L } = c;
      if (coThe('rang_cua') && soDo?.(c.mat)?.rang_cua == null) (dem.thieuAnh ??= []).push(c.mat + ' rang_cua (số răng trên ảnh)');
      if (coThe('rang_cua') && soDo?.(c.mat)?.rang_cua != null) { // tường thấp + răng: răng 0,9 m, khe 0,6 m, cao 0,9 m trên tường 0,5 m; SỐ RĂNG = số đếm trên ảnh
        if (soDo?.(c.mat)?.rang_cua !== 0) hop(p[0] + ux * L / 2 + nx * 0.05, y1 + 0.25, p[1] + uz * L / 2 + nz * 0.05, ux, uz, L + 0.4, 0.5, 0.5); // rang_cua = 0: mặt này không răng cưa (mái lộ, ảnh)
        const n = +soDo(c.mat).rang_cua, b = L / Math.max(1, n); if (n > 0) for (let i = 0; i < n; i++) { const s = (i + 0.5) * b; hop(p[0] + ux * s + nx * 0.05, y1 + 0.95, p[1] + uz * s + nz * 0.05, ux, uz, Math.min(0.9, b * 0.6), 0.9, 0.5); ghi(c.mat, 'rang_cua', y1 + 0.95, 1, p[0] + ux * s, p[1] + uz * s); } dem.rang++; }
      // vom_nho = 0 trên mặt (cua-so.json, hoặc mặt dựng riêng theo ảnh tắt đi): mặt này không có dải vòm chạy liền dưới đỉnh tường
      if (coThe('vom_nho') && soDo?.(c.mat)?.vom_nho == null) (dem.thieuAnh ??= []).push(c.mat + ' vom_nho (số vòm trên ảnh)');
      if (coThe('vom_nho') && +soDo?.(c.mat)?.vom_nho > 0) { // dải đá + cung nhỏ trên con sơn, nhô 0,18 m, ngay dưới đỉnh tường
        hop(p[0] + ux * L / 2 + nx * 0.1, y1 - 0.12, p[1] + uz * L / 2 + nz * 0.1, ux, uz, L, 0.24, 0.2);
        const n = +soDo(c.mat).vom_nho, b = L / n;
        for (let i = 0; i < n; i++) { const s = (i + 0.5) * b, x = p[0] + ux * s + nx * 0.09, z = p[1] + uz * s + nz * 0.09, g = new THREE.TorusGeometry(b / 2 - 0.08, 0.06, 3, 6, Math.PI); g.translate(0, y1 - 0.62, 0); g.rotateY(-Math.atan2(uz, ux)); g.translate(x, 0, z); them(g);
          hop(p[0] + ux * i * b + nx * 0.09, y1 - 0.75, p[1] + uz * i * b + nz * 0.09, ux, uz, 0.14, 0.3, 0.18); ghi(c.mat, 'vom_nho', y1 - 0.6, 1, x, z); } dem.vom++; }
      if (t.go_y && !soDo?.(c.mat)?.go_y?.length) (dem.thieuAnh ??= []).push(c.mat + ' go_y (độ cao gờ trên ảnh)');
      for (const yg of (soDo?.(c.mat)?.go_y || []).map(Number).filter(Number.isFinite)) { // gờ ngang: độ cao đo trên ảnh (cua-so.json go_y) // gờ đá ngang: thân 0,22 m nhô 0,16 + mũ vát
        hop(p[0] + ux * L / 2 + nx * 0.08, yg, p[1] + uz * L / 2 + nz * 0.08, ux, uz, L + 0.1, 0.22, 0.16); hop(p[0] + ux * L / 2 + nx * 0.12, yg + 0.15, p[1] + uz * L / 2 + nz * 0.12, ux, uz, L + 0.2, 0.08, 0.24); ghi(c.mat, 'go_ngang', yg, 1, p[0] + ux * L / 2, p[1] + uz * L / 2); }
    }
    if (coThe('da_goc')) canh.forEach((c, i) => { const tr = canh[(i + v.length - 1) % v.length]; if (!c.ngoai && !tr.ngoai) return;
      const goc = soDo?.(c.ngoai ? c.mat : tr.mat)?.da_goc, nDa = +goc; if (goc === 0) return; // da_goc = 0: ảnh thật thấy góc này KHÔNG có đá góc (không phải thiếu số đo) // số hàng đá góc đếm trên ảnh ở góc đầu cạnh này (cua-so.json da_goc) // góc giữa cạnh trước (tr) và cạnh này (c), tại đỉnh c.p
      const lo = tr.ux * c.uz - tr.uz * c.ux; if (lo <= 0.2) return;
      if (!(nDa > 0)) { (dem.thieuAnh ??= []).push((c.ngoai ? c.mat : tr.mat) + ' da_goc (số hàng đá góc trên ảnh)'); return; } // chỉ góc LỒI rõ (đa giác ngược chiều kim: rẽ trái là lồi)
      for (let j = 0, buoc = (y1 - 0.4 - yMong - 0.2) / nDa, y = yMong + 0.2; j < nDa; y += buoc, j++) { const dai = j % 2 ? 0.5 : 0.9;
        if (c.ngoai) hop(c.p[0] + c.ux * dai / 2 + c.nx * 0.04, y, c.p[1] + c.uz * dai / 2 + c.nz * 0.04, c.ux, c.uz, dai, 0.32, 0.1);
        if (tr.ngoai) { const d2 = j % 2 ? 0.9 : 0.5; hop(c.p[0] - tr.ux * d2 / 2 + tr.nx * 0.04, y, c.p[1] - tr.uz * d2 / 2 + tr.nz * 0.04, tr.ux, tr.uz, d2, 0.32, 0.1); } }
      dem.goc++; ghi(c.ngoai ? c.mat : tr.mat, 'da_goc', (yMong + y1) / 2, 1, c.p[0], c.p[1]); });
    // NEO SẮT hoa huệ giữa hai tầng cửa (ảnh: 4 neo trên cánh gạch đỏ): chỉ trên mặt có SỐ ĐO cửa với hàng dưới < neo_y < hàng trên (mặt dựng cửa thủ tục
    // không biết hàng cửa nằm đâu → neo đè lên cửa). Hình: thanh đứng + thanh ngang ngắn + đầu hoa (khối xoay 45°) + hai cánh cong (khối nghiêng)
    canh.forEach((c, ci) => { const nm = soDo?.(c.mat)?.neo_y ?? null, y = +nm, h = coSoDo?.(k.id + '#' + ci); if (nm == null || !Number.isFinite(y) || !c.ngoai || c.L < 3 || !h?.length) return; // neo theo MẶT (cua-so.json neo_y) — thẻ khối chỉ là mặc định
      if (!(h.some((r) => r.y1 < y) && h.some((r) => r.y0 > y))) return;
      const n = Math.max(2, Math.floor(c.L / 2)), b = c.L / n; // cánh 8,9 m → 4 neo như ảnh
      for (let i = 0; i < n; i++) { const s = (i + 0.5) * b, x = c.p[0] + c.ux * s + c.nx * 0.06, z = c.p[1] + c.uz * s + c.nz * 0.06;
        sat.push([x, y, z, c.ux, c.uz, 0.12, 1.0, 0.08, 0], [x, y - 0.15, z, c.ux, c.uz, 0.55, 0.1, 0.08, 0], [x, y + 0.58, z, c.ux, c.uz, 0.24, 0.24, 0.08, Math.PI / 4],
          [x - c.ux * 0.16, y + 0.36, z - c.uz * 0.16, c.ux, c.uz, 0.1, 0.38, 0.08, 0.65], [x + c.ux * 0.16, y + 0.36, z + c.uz * 0.16, c.ux, c.uz, 0.1, 0.38, 0.08, -0.65]); ghi(c.mat, 'neo', y, 1, x, z); } });
    // BAN CÔNG LỒI (ảnh mặt tây Torbau: trên vòm cổng): sàn đá + 3 con sơn + lan can đặc có gờ — cua-so.json "khối#cạnh".ban_cong = [[s, y sàn, rộng, nhô], …]
    canh.forEach((c) => { for (const [s, y, w, nh = 1] of soDo?.(c.mat)?.ban_cong || []) { const x = c.p[0] + c.ux * s, z = c.p[1] + c.uz * s;
      hop(x + c.nx * nh / 2, y - 0.12, z + c.nz * nh / 2, c.ux, c.uz, w, 0.25, nh); hop(x + c.nx * (nh - 0.1), y + 0.5, z + c.nz * (nh - 0.1), c.ux, c.uz, w, 0.95, 0.2); hop(x + c.nx * (nh - 0.1), y + 1.02, z + c.nz * (nh - 0.1), c.ux, c.uz, w + 0.1, 0.1, 0.3);
      for (const sg of [-1, 1]) hop(x + c.ux * sg * (w / 2 - 0.1) + c.nx * nh / 2, y + 0.5, z + c.uz * sg * (w / 2 - 0.1) + c.nz * nh / 2, c.nx, c.nz, nh, 0.95, 0.2);
      for (let j = 0; j < 3; j++) { const o = (j - 1) * (w / 2 - 0.4), g = new THREE.CylinderGeometry(0.22, 0.06, 1.2, 6); g.translate(x + c.ux * o + c.nx * 0.35, y - 0.85, z + c.uz * o + c.nz * 0.35); them(g); }
      ghi(c.mat, 'ban_cong', y, 1, x, z); } });
    // ĐỒNG HỒ trên đầu hồi (ảnh mặt tây Torbau): đĩa đá + mặt số sáng + hai kim — cua-so.json "khối#cạnh".dong_ho = [[s, y tâm, bán kính], …]
    canh.forEach((c) => { for (const [s, y, r] of soDo?.(c.mat)?.dong_ho || []) { const x = c.p[0] + c.ux * s, z = c.p[1] + c.uz * s, d = new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.15, 20); d.rotateX(Math.PI / 2); d.rotateY(-Math.atan2(c.uz, c.ux)); d.translate(x + c.nx * 0.07, y, z + c.nz * 0.07); them(d);
      toi.push([x + c.nx * 0.17, y + r * 0.3, z + c.nz * 0.17, c.ux, c.uz, 0.07, r * 0.6, 0.03], [x + c.nx * 0.17 + c.ux * r * 0.22, y, z + c.nz * 0.17 + c.uz * r * 0.22, c.ux, c.uz, r * 0.45, 0.07, 0.03]); ghi(c.mat, 'dong_ho', y, 1, x, z); } });
    // Ô TRÒN (oculus) theo số đo: vành đá + lòng tối — cua-so.json "khối#cạnh".o_tron = [[s, y tâm, bán kính], …] (ảnh mặt tây Torbau: 3 ô tròn trên cửa đôi)
    canh.forEach((c) => { for (const [s, y, r] of soDo?.(c.mat)?.o_tron || []) { const x = c.p[0] + c.ux * s, z = c.p[1] + c.uz * s, g = new THREE.TorusGeometry(r, 0.07, 4, 14); g.rotateY(-Math.atan2(c.uz, c.ux)); g.translate(x + c.nx * 0.06, y, z + c.nz * 0.06); them(g);
      const dd = new THREE.CircleGeometry(r - 0.02, 14); dd.rotateY(-Math.atan2(c.uz, c.ux)); dd.translate(x + c.nx * 0.03, y, z + c.nz * 0.03); toiTron.push(dd); ghi(c.mat, 'o_tron', y, 1, x, z); } });
    // Ô CỬA VUÔNG nhỏ theo số đo (lòng tối lùi + khung đá bốn cạnh + bậu)
    canh.forEach((c) => { for (const [s, y0, w, h] of oVuong?.(c.mat) || []) { const x = c.p[0] + c.ux * s, z = c.p[1] + c.uz * s, yc = y0 + h / 2;
      toi.push([x + c.nx * 0.03, yc, z + c.nz * 0.03, c.ux, c.uz, w, h, 0.06]);
      hop(x + c.nx * 0.08, y0 + h + 0.09, z + c.nz * 0.08, c.ux, c.uz, w + 0.36, 0.18, 0.16); hop(x + c.nx * 0.1, y0 - 0.09, z + c.nz * 0.1, c.ux, c.uz, w + 0.44, 0.18, 0.22);
      for (const sg of [-1, 1]) hop(x + c.ux * sg * (w / 2 + 0.09) + c.nx * 0.08, yc, z + c.uz * sg * (w / 2 + 0.09) + c.nz * 0.08, c.ux, c.uz, 0.18, h, 0.16);
      ghi(c.mat, 'o_vuong', yc, 1, x, z); } });
    // THÁP CANH TREO — CHỈ THEO SỐ ĐO TRÊN ẢNH (anh 17/11/2026: "sao lại có luật nào tham gia vào đây? Ảnh đâu?"): trước đây thẻ thap_canh=yes tự đặt hai tháp ở hai
    // đầu cạnh dài nhất của khối OSM (đoán) → cổng Torbau mặt ngoài một tháp che cửa, một tháp vắt sang tường gạch. Nay vị trí lấy từ cua-so.json "khối#cạnh".thap_canh
    // = [[s (m từ đầu cạnh), y mũi chân côn, y đỉnh vành răng cưa, bán kính thân], …] đo trên ảnh thật; thẻ có mà chưa đo → KHÔNG dựng, ghi vào dem.thieuAnh.
    if (coThe('thap_canh')) for (const c of canh.filter((c) => c.ngoai)) {
      const ds = soDo?.(c.mat)?.thap_canh; if (!Array.isArray(ds) || !ds.length) continue;
      for (const [s, yMui, yDinh, rDo] of ds) {
        const r = +rDo || +k.tags.thap_canh_r || 0.75, x = c.p[0] + c.ux * s, z = c.p[1] + c.uz * s, cx = x + c.nx * (r + 0.05), cz = z + c.nz * (r + 0.05);
        const yc = yDinh - 1.2 - 2.4 > yMui + 1.5 ? yDinh - 1.2 - 2.4 : yMui + 1.5, than = Math.max(1, yDinh - 1.2 - yc); // chân côn 1,5 m từ mũi · thân · gờ + vành răng cưa 1,2 m
        tru(cx, yc - 1.5, cz, 0.15, r, 1.5, 10); tru(cx, yc, cz, r, r, than, 12); tru(cx, yc + than, cz, r, r + 0.12, 0.2, 12); vongRang(cx, yc + than + 0.2, cz, r + 0.12, 1.0); dem.canh++;
        tru(cx, yc - 0.25, cz, r + 0.08, r + 0.08, 0.25, 12); // vành gờ giữa chân côn và thân (ảnh: gờ tròn)
        for (let g = 0; g < 6; g++) { const a = g / 6 * Math.PI * 2, nghieng = Math.atan2(r - 0.15, 1.5), b = new THREE.BoxGeometry(0.14, 1.6, 0.12); b.rotateX(nghieng); b.rotateY(-a + Math.PI / 2); b.translate(cx + Math.cos(a) * ((r + 0.15) / 2 + 0.05), yc - 0.75, cz + Math.sin(a) * ((r + 0.15) / 2 + 0.05)); them(b); } // gân đỡ áp sát chân côn
        ghi(c.mat, 'thap_canh', yc + than / 2, 1, x, z, { cx, cz, r: r + 0.12, y0: yMui, y1: yDinh }); }
    }
    if (coThe('thap_canh') && !canh.some((c) => c.ngoai && soDo?.(c.mat)?.thap_canh?.length)) (dem.thieuAnh ??= []).push(k.id + ' thap_canh (chưa đo trên ảnh — không dựng)');
  }
  const ra = [];
  if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), vl); m.castShadow = m.receiveShadow = true; ra.push(m); }
  if (toiTron.length) { const g = mergeGeometries(toiTron.map((g) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; })); ra.push(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.5, side: THREE.DoubleSide }))); }
  if (toi.length) { const g = mergeGeometries(toi.map(([x, y, z, ux, uz, a, h, d]) => { const b = new THREE.BoxGeometry(a, h, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateY(-Math.atan2(uz, ux)); b.translate(x, y, z); return b; }));
    ra.push(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.5 }))); }
  if (sat.length) { const g = mergeGeometries(sat.map(([x, y, z, ux, uz, a, h, d, xoay = 0]) => { const b = new THREE.BoxGeometry(a, h, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateZ(xoay); b.rotateY(-Math.atan2(uz, ux)); b.translate(x, y, z); return b; }));
    ra.push(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#23201d', roughness: 0.6, metalness: 0.5 }))); dem.neo = sat.length / 5; }
  return { ra, dem, kk };
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
  // HUY HIỆU (ảnh 360° cổng Torbau): khung chữ nhật có gờ trên (nhô, như mái che) + bậu dưới, khiên lớn có vương miện, hai sư tử đứng đỡ hai bên — ngoài: −z
  // tâm huy hiệu trên đỉnh vòm 2,2 m: giữa có gờ ngang (ảnh) — 1,7 m thì bậu chồng lên khung vòm
  const yH = cao + 2.2, sh = new THREE.Shape(); sh.moveTo(-0.7, 0.8); sh.lineTo(0.7, 0.8); sh.lineTo(0.7, 0.05); sh.quadraticCurveTo(0.65, -0.7, 0, -0.95); sh.quadraticCurveTo(-0.65, -0.7, -0.7, 0.05); sh.lineTo(-0.7, 0.8);
  const k = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 5 }); k.translate(0, yH - 0.1, -0.32); da.push(dat(k));
  hop(da, 3.4, 2.5, 0.1, 0, yH, -0.06); // nền phù điêu
  hop(da, 3.9, 0.22, 0.45, 0, yH + 1.35, -0.2); hop(da, 3.7, 0.12, 0.3, 0, yH + 1.2, -0.12); hop(da, 3.8, 0.2, 0.35, 0, yH - 1.32, -0.17); // gờ mũ trên + bậu dưới
  hop(da, 0.9, 0.22, 0.25, 0, yH + 0.88, -0.32); for (const s of [-1, 0, 1]) { const q = new THREE.SphereGeometry(0.11, 6, 4); q.translate(s * 0.32, yH + 1.06, -0.32); da.push(dat(q)); } // vương miện
  for (const s of [-1, 1]) { // sư tử đứng: thân nghiêng, đầu, hai chân trước vịn khiên, đuôi
    const than = new THREE.CylinderGeometry(0.22, 0.28, 1.2, 6); than.rotateZ(s * 0.35); than.translate(s * 1.15, yH - 0.2, -0.28); da.push(dat(than));
    const dau = new THREE.SphereGeometry(0.24, 7, 5); dau.translate(s * 0.98, yH + 0.5, -0.3); da.push(dat(dau));
    const bom = new THREE.SphereGeometry(0.3, 7, 5); bom.scale(1, 0.8, 0.6); bom.translate(s * 1.02, yH + 0.4, -0.22); da.push(dat(bom)); // bờm
    for (const dy of [0.15, -0.2]) { const ch = new THREE.BoxGeometry(0.45, 0.1, 0.12); ch.rotateZ(-s * 0.4); ch.translate(s * 0.82, yH + dy, -0.36); da.push(dat(ch)); }
    const sau = new THREE.BoxGeometry(0.14, 0.7, 0.14); sau.rotateZ(s * 0.2); sau.translate(s * 1.3, yH - 0.85, -0.25); da.push(dat(sau)); }
  const ra = []; if (go.length) ra.push(new THREE.Mesh(mergeGeometries(go), vlGo)); if (da.length) ra.push(new THREE.Mesh(mergeGeometries(da), vlDa));
  for (const m of ra) m.castShadow = m.receiveShadow = true; return ra;
}
