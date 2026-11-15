// MẶT TIỀN CHI TIẾT (bước 2 "lâu đài chi tiết"): cửa sổ 3D thật thay cửa sổ vẽ trên vân — khung đá nhô ra, đầu vòm bán nguyệt, bậu, lòng cửa tối;
// Palas dùng cửa vòm BA Ô có hai cột nhỏ (như mặt sân trên, ảnh anh gửi 15/11/2026); gờ đá ngang chạy theo từng tầng. Vẽ hàng loạt (InstancedMesh + một lưới gờ).
// tra-repo-ok: anh chọn "cách 2 — tự dựng mặt tiền" sau bảng tra Google tiles / Sketchfab / CGTrader (15/11/2026); đây là mã dán keo riêng của cảnh, không có thư viện tương ứng.
// datMatTien({ THREE, mergeGeometries, tuong: [{ ten, v, yMong, y1, lo(i, x1, z1, x2, z2) → [{ s0, s1, y0, y1 }] }], biChe(x, y, z) → bool }) → [Mesh…]
// BỐ CỤC CỬA SỔ một cạnh tường (dùng chung: mattien.js đặt khung cửa 3D · ns.js khoét lỗ thật trên tường Palas ở dải có phòng — hai bên phải trùng nhau)
// → [{ y: bậu, hang, kieu: 'ba' | 'vom' | 'mot', nua, cao, ds: [s dọc cạnh] }]. O_MO: nửa bề ngang + cao phần thẳng của Ô MỞ được (ô giữa của cửa ba ô)
export const O_MO = { ba: [0.39, 1.91], mot: [0.575, 1.52], vom: [0.95, 1.55] };
export function bocCuc({ L, yMong, y1, palas = false, coVom = false, yDat = 0, neo = null }) { // neo: bậu một hàng phải nằm đúng ở đây (Palas: sàn tầng ba có phòng) — các hàng khác cách đều theo tầng
  const ra = [], tang = palas ? 5.2 : 4.4, dau = neo != null ? neo - Math.floor((neo - (yMong + 1.1)) / tang) * tang : yMong + 1.1;
  for (let y = coVom ? yDat + 0.05 : dau, hang = 0; y + 3.6 <= y1; y += tang, hang++) {
    const kieu = palas ? 'ba' : coVom && hang === 0 ? 'vom' : 'mot', buoc = kieu === 'ba' ? 4.6 : kieu === 'vom' ? 3.0 : 3.4, nua = kieu === 'ba' ? 1.65 : kieu === 'vom' ? 1.35 : 0.95, cao = kieu === 'vom' ? 2.6 : kieu === 'ba' ? 2.6 : 2.4;
    if (y + cao + 1.2 > y1) break;
    const n = Math.floor((L - 0.6) / buoc), du = (L - n * buoc) / 2 + buoc / 2, ds = [];
    for (let k = 0; k < n; k++) { const s = du + k * buoc; if (s - nua >= 0.3 && s + nua <= L - 0.3) ds.push(s); }
    ra.push({ y, hang, kieu, nua, cao, ds });
  }
  return ra;
}
// CỤM CỬA ĐO TỪ ẢNH (du-lieu/<lâu>-cua-so.json, scripts/do-cua-so.py): một cụm [s0, s1, n] của hàng { y0, y1 } (vùng kính tối dò được) → kích thước dựng
// + các ô mở (dùng chung: mattien.js dựng khung · ns.js khoét lỗ thật cho ô trong dải phòng có nội thất — hai bên phải trùng nhau)
export function oCum([s0, s1, n], hang) {
  // ảnh 3D nhoè: phần kính dò được hẹp hơn ô thật (~0,25 m so với 0,6–0,8 m) → ô tối thiểu 0,55 × 1,7 m theo cửa thật Palas, giữ tâm cụm + số ô đo được
  const k = 0.2, w = Math.max(0.55, Math.min(0.9, (s1 - s0 + 0.2 - (n - 1) * k) / n)), h = Math.max(1.7, Math.min(3, hang.y1 - hang.y0 + 0.4)), s = (s0 + s1) / 2, y = (hang.y0 + hang.y1) / 2 - h / 2;
  const o = []; for (let i = 0; i < n; i++) { const c = s + (i - (n - 1) / 2) * (w + k); o.push({ s0: c - w / 2, s1: c + w / 2, y0: y, y1: y + h - w / 2 }); }
  return { n, w, h, k, s, y, o };
}
export function datMatTien({ THREE, mergeGeometries, tuong, biChe, nhe = false, matNgoai = () => ({ san: false }), cuaSo = {}, matAnh = {} }) { // matAnh: mặt có ảnh dán → không dựng cửa 3D đè lên (chỉ ghi ô mở được) // cuaSo: cửa đo từ ảnh theo "<khối>#<cạnh>" — mặt có số đo dựng theo số đo // matNgoai(x, z, nx, nz) → { san: mặt tường nhìn ra sân trong?, yDat: độ cao mặt sân trước tường } // nhe: điện thoại — vòm ít cạnh hơn
  const DA = new THREE.Color('#ece6da'), TOI = new THREE.Color('#1b1f27'), LONG = new THREE.Color('#8f8a80'), _c = new THREE.Color();
  const hop = (w, h, d, x, y, z, mau) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); return mau_(g, mau); };
  const mau_ = (g, mau) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = mau.r; c[i * 3 + 1] = mau.g; c[i * 3 + 2] = mau.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; };
  const vom = (r, cx, y, z, mau, day = 0.03) => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(-r, 0); const g = new THREE.ExtrudeGeometry(s, { depth: day, bevelEnabled: false, curveSegments: nhe ? 5 : 10 }).toNonIndexed(); g.translate(cx, y, z); return mau_(g, mau); };
  // khung vòm: các khối đá nhỏ xếp theo nửa vòng tròn, cạnh dài mỗi khối nằm theo tiếp tuyến (xoay am + 90°)
  const khungVom = (r, cx, y, z, rong, sau, mau, n0 = 9) => { const n = nhe ? Math.ceil(n0 / 2) : n0; const ds = []; for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, am = (a0 + a1) / 2, dai = 2 * (r + rong / 2) * Math.sin((a1 - a0) / 2) + 0.02;
    const g = new THREE.BoxGeometry(dai, rong, sau).toNonIndexed(); g.rotateZ(am + Math.PI / 2); g.translate(cx + Math.cos(am) * (r + rong / 2), y + Math.sin(am) * (r + rong / 2), z); ds.push(mau_(g, mau)); } return ds; };
  // một ô cửa vòm: lòng tối phẳng sát tường, má cửa nhô 0,2 m, khung đá nhô 0,24 m, bậu
  function oCua(w, h, cx, khung = true, trong = false) { // trong: ô có lỗ thật trên tường (mở được) → bỏ tấm kính tối, nhìn xuyên vào phòng
    const r = w / 2, ds = [...(trong ? [] : [hop(w, h, 0.02, cx, h / 2, 0.012, TOI)]), vom(r, cx, h, 0.002, TOI), hop(0.06, h, 0.2, cx - r - 0.03, h / 2, 0.1, LONG), hop(0.06, h, 0.2, cx + r + 0.03, h / 2, 0.1, LONG)];
    if (khung) ds.push(hop(0.16, h, 0.24, cx - r - 0.14, h / 2, 0.12, DA), hop(0.16, h, 0.24, cx + r + 0.14, h / 2, 0.12, DA), ...khungVom(r + 0.06, cx, h, 0.12, 0.16, 0.24, DA));
    return ds;
  }
  const mot = mergeGeometries([...oCua(1.15, 2.1, 0), hop(1.75, 0.14, 0.3, 0, -0.07, 0.15, DA)]);
  const taoBa = (moGiua) => mergeGeometries([...[-0.92, 0, 0.92].flatMap((cx) => oCua(0.78, 2.3, cx, false, moGiua && cx === 0)),
    ...[-0.46, 0.46].map((cx) => { const g = new THREE.CylinderGeometry(0.07, 0.07, 2.3, nhe ? 5 : 8).toNonIndexed(); g.translate(cx, 1.15, 0.1); return mau_(g, DA); }), // hai cột nhỏ giữa ba ô
    hop(0.2, 2.3, 0.26, -1.42, 1.15, 0.13, DA), hop(0.2, 2.3, 0.26, 1.42, 1.15, 0.13, DA), ...khungVom(1.36, 0, 2.3, 0.13, 0.2, 0.26, DA, 13), hop(3.2, 0.16, 0.32, 0, -0.08, 0.16, DA)]);
  const ba = taoBa(false), baMo = taoBa(true);
  // dãy vòm tầng trệt (Toà Hiệp sĩ, theo ảnh Josef Albert ~1885): ô vòm cao lòng tối, hai cột tròn hai bên, khung vòm đá
  const dayVom = mergeGeometries([...oCua(1.9, 2.5, 0), ...[-1.12, 1.12].map((cx) => { const g = new THREE.CylinderGeometry(0.16, 0.18, 2.5, nhe ? 6 : 10).toNonIndexed(); g.translate(cx, 1.25, 0.2); return mau_(g, DA); }), hop(2.6, 0.18, 0.36, 0, 0.09, 0.18, DA)]);
  const viTri = { mot: [], ba: [], baMo: [], vom: [] }, go = [], cua = [], doDa = [], doToi = [], dem = { do: 0 };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), mot1 = new THREE.Vector3(1, 1, 1);
  for (const t of tuong) {
    const palas = t.ten === 'Palas';
    for (let i = 0; i < t.v.length; i++) {
      const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 2.5) continue;
      const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, goc = Math.atan2(nx, nz); // pháp tuyến RA NGOÀI (đa giác ngược chiều kim nhìn từ trên)
      const lo = t.lo(i, x1, z1, x2, z2), mn = palas ? { san: false } : matNgoai((x1 + x2) / 2, (z1 + z2) / 2, nx, nz), coVom = mn.san && Number.isFinite(mn.yDat);
      q.setFromAxisAngle(Y, goc);
      const doTu = cuaSo[`${t.k?.id}#${i}`], coAnh = !!matAnh[`${t.k?.id}#${i}`];
      if (coAnh && !doTu?.hang?.length) continue; // mặt có ảnh dán thật (đã có cửa, gờ thật trong ảnh) → không dựng cửa 3D đoán đè lên
      if (doTu?.hang?.length) { // MẶT CÓ SỐ ĐO TỪ ẢNH: hàng / cụm / số ô đúng ảnh, ô trong dải phòng có lỗ thật thì không kính (mở được)
        for (const h of doTu.hang) {
          if (!coAnh) go.push([x1, z1, ux, uz, nx, nz, L, h.y0 - 0.35]); // mặt có ảnh dán: gờ đã có trong ảnh
          for (const c of h.cum) {
            const d = oCum(c, h), coLo = d.o.map((o) => lo.some((l) => l.cuaSo && Math.abs(l.s0 - o.s0) < 0.05 && Math.abs(l.y0 - o.y0) < 0.05));
            const g = nhomCua(THREE, { n: d.n, w: d.w, h: d.h, k: d.k, cot: 0.06, vom: false, nhe });
            const dat = (gg) => { gg.rotateY(goc); gg.translate(x1 + ux * d.s, d.y, z1 + uz * d.s); return gg; };
            if (!coAnh || coLo.some(Boolean)) { for (const gg of g.da) doDa.push(dat(gg)); g.toi.forEach((gg, j) => { if (!coLo[j]) doToi.push(dat(gg)); }); } // mặt có ảnh dán: ảnh đã có cửa thật — chỉ dựng khung cho cụm có ô mở được
            d.o.forEach((o, j) => cua.push({ x: x1 + ux * (o.s0 + o.s1) / 2, y: o.y0, z: z1 + uz * (o.s0 + o.s1) / 2, nx, nz, nua: d.w / 2, cao: o.y1 - o.y0, coLo: coLo[j], ten: t.ten }));
            dem.do += d.n;
          }
        }
        continue;
      }
      // tầng trệt mọi toà (trừ Palas) NHÌN RA SÂN TRONG là dãy vòm (như dãy hiên Toà Hiệp sĩ trong ảnh Josef Albert), chân vòm đứng trên mặt sân trước tường;
      // mặt sân OSM của Toà Hiệp sĩ là khối không tên đứng trước khối mang tên, nên không lọc theo tên
      for (const { y, kieu, nua, cao, ds } of bocCuc({ L, yMong: t.yMong, y1: t.y1, palas, coVom, yDat: mn.yDat, neo: palas ? t.neoHang : null })) {
        if (biChe(x1 + ux * L / 2 + nx * 0.6, y + cao / 2, z1 + uz * L / 2 + nz * 0.6)) continue; // mặt tường bị khối khác áp vào ở tầng này
        if (lo.some((o) => o.s0 <= 0 && o.s1 >= L && y - 0.6 >= o.y0 && y + cao <= o.y1)) continue; // cả mặt dành cho dựng riêng (mặt Palas hướng sân) → không cửa, không gờ
        go.push([x1, z1, ux, uz, nx, nz, L, y - 0.55]); // gờ đá dưới mỗi hàng cửa
        for (const s of ds) {
          // TỪNG CỬA: tâm cửa (0,35 m ra ngoài mặt) nằm trong khối khác ở độ cao đó → cửa của khối bị khối to hơn bọc ngoài, khung sẽ đâm xuyên tường khối kia (thanh lơ lửng dọc mép tháp, anh 16/11/2026) → bỏ
          if (biChe(x1 + ux * s + nx * 0.35, y + cao / 2, z1 + uz * s + nz * 0.35) || biChe(x1 + ux * (s - nua) + nx * 0.35, y + cao / 2, z1 + uz * (s - nua) + nz * 0.35) || biChe(x1 + ux * (s + nua) + nx * 0.35, y + cao / 2, z1 + uz * (s + nua) + nz * 0.35)) continue;
          if (lo.some((o) => !o.cuaSo && s + nua > o.s0 && s - nua < o.s1 && y + cao > o.y0 && y < o.y1)) continue; // chỗ khoét cửa / dải nội thất (lỗ của chính ô cửa sổ thì không tính)
          const [mNua, mCao] = O_MO[kieu], coLo = lo.some((o) => o.cuaSo && Math.abs((o.s0 + o.s1) / 2 - s) < 0.05 && Math.abs(o.y0 - y) < 0.05);
          viTri[coLo && kieu === 'ba' ? 'baMo' : kieu].push(m4.compose(new THREE.Vector3(x1 + ux * s, y, z1 + uz * s), q, mot1).clone());
          cua.push({ x: x1 + ux * s, y, z: z1 + uz * s, nx, nz, nua: mNua, cao: mCao, coLo, ten: t.ten }); // cho ns.js: đang leo sát cửa sổ có phòng phía sau thì mở cửa trèo vào
        }
      }
    }
  }
  const vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), ra = [];
  for (const [ten, g] of [['mot', mot], ['ba', ba], ['baMo', baMo], ['vom', dayVom]]) { const ds = viTri[ten]; if (!ds.length) continue; const im = new THREE.InstancedMesh(g, vl, ds.length); ds.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; ra.push(im); } // chi tiết nhỏ không đổ bóng: lượt vẽ bóng tốn gấp đôi mà bóng khung cửa gần như không thấy
  if (go.length) { const gs = go.map(([x1, z1, ux, uz, nx, nz, L, y]) => { const g = hop(L, 0.22, 0.2, 0, 0, 0, _c.copy(DA)); g.rotateY(Math.atan2(nx, nz)); g.translate(x1 + ux * L / 2 + nx * 0.1, y, z1 + uz * L / 2 + nz * 0.1); return g; });
    const m = new THREE.Mesh(mergeGeometries(gs), vl); m.receiveShadow = true; ra.push(m); }
  if (doDa.length) { const m = new THREE.Mesh(mergeGeometries(doDa), new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.8 })); m.receiveShadow = true; ra.push(m); }
  if (doToi.length) { const m = new THREE.Mesh(mergeGeometries(doToi), new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.35, metalness: 0.2 })); ra.push(m); }
  return { ra, cua, dem: { oDo: dem.do, cua: viTri.mot.length, cuaBa: viTri.ba.length, cuaMo: viTri.baMo.length, vom: viTri.vom.length, go: go.length } };
}

// CỤM CỬA kiểu Roman như ảnh sân trên: n ô vòm nhỏ đứng sát nhau, giữa các ô là cột nhỏ có đầu cột, mỗi ô một vòm đá mảnh;
// vom = true thì cả cụm nằm dưới một VÒM LỚN (vòm mù) có má tường hai bên. Toạ độ cục bộ: x dọc tường (tâm cụm x = 0), y lên (bậu y = 0), z ra ngoài.
// → { da: [hình], toi: [hình] } (không chỉ số, không uv — gộp được ngay)
export function nhomCua(THREE, { n = 3, w = 0.5, h = 2, vom = true, nhe = false, k = 0.14, cot = 0.06, vomR = null, vomDinh = null }) { // k: bề ngang trụ giữa hai ô · cot: bán kính cột nhỏ · vomR / vomDinh: mép ngoài vòm lớn + đỉnh vòm trên bậu (đo từ ảnh)
  const da = [], toi = [], W = n * w + (n - 1) * k, yV = h - w / 2, cb = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, yV); sh.absarc(0, yV, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
  for (let i = 0; i < n; i++) {
    const cx = (i - (n - 1) / 2) * (w + k);
    const o = cb(new THREE.ShapeGeometry(sh, nhe ? 4 : 8)); o.translate(cx, 0, 0.015); toi.push(o);
    const v = cb(new THREE.TorusGeometry(w / 2 + cot * 0.6, cot * 0.75, 4, nhe ? 5 : 9, Math.PI)); v.translate(cx, yV, 0.1); da.push(v);
  }
  for (let i = 0; i <= n; i++) { // cột nhỏ giữa / hai bên các ô: chân cột + thân + đầu cột
    const x = i === 0 ? -W / 2 - cot : i === n ? W / 2 + cot : -W / 2 + i * (w + k) - k / 2;
    const c = cb(new THREE.CylinderGeometry(cot, cot * 1.12, yV - 0.24, nhe ? 6 : 9)); c.translate(x, yV / 2, 0.14); da.push(c);
    const d = cb(new THREE.BoxGeometry(cot * 3.2, 0.16, cot * 3.2)); d.translate(x, yV - 0.06, 0.14); da.push(d);
    const e = cb(new THREE.BoxGeometry(cot * 2.8, 0.1, cot * 2.8)); e.translate(x, 0.05, 0.14); da.push(e);
  }
  const bau = cb(new THREE.BoxGeometry(W + 0.6, 0.16, 0.34)); bau.translate(0, -0.08, 0.17); da.push(bau);
  if (vom) { // vòm lớn bè: chân vòm ngang đầu cột, bán kính ~ nửa cụm, hai vành gờ; má tường hai bên từ bậu lên chân vòm
    const R = vomR ? vomR - 0.27 : W / 2 + 0.28, yC = vomDinh ? Math.max(yV, vomDinh - vomR) : yV + 0.02;
    const r1 = cb(new THREE.TorusGeometry(R + 0.12, 0.15, 4, nhe ? 9 : 18, Math.PI)); r1.translate(0, yC, 0.12); da.push(r1);
    const r2 = cb(new THREE.TorusGeometry(R - 0.1, 0.07, 4, nhe ? 9 : 18, Math.PI)); r2.translate(0, yC, 0.07); da.push(r2);
    for (const s of [-1, 1]) { const m = cb(new THREE.BoxGeometry(0.26, yC, 0.26)); m.translate(s * (R + 0.12), yC / 2, 0.12); da.push(m); }
  }
  return { da, toi, rong: vom ? (vomR ? 2 * vomR : W + 1.1) : W + 0.4 };
}

// QUY ĐỔI tệp bố cục (điểm ảnh thô đo trên ảnh, du-lieu/<lau>-mat-*.json) → mét: x = mét sang PHẢI của ảnh tính từ trục mặt, duoi = mét DƯỚI mái (chân đầu hồi).
// Ảnh phụ (phần ảnh chính bị cắt) neo vào ảnh chính bằng một mốc chung (mocY ↔ mocYChinh, mocX ↔ mocXChinh). Không có số đo nào viết tay trong mã.
export function tiLeDung(bo, dinhKhoi, matSan) { // px/m theo chiều đứng từ hai mốc tuyệt đối: đỉnh đầu hồi ↔ dinhKhoi, mặt sân (ảnh phụ) ↔ matSan
  const P = bo.anhPhu, N = bo.neo; if (!P || !N || !(dinhKhoi > matSan)) return null;
  return ((P.mocYChinh - N.dinhY) + (P.matSan - P.mocY) / P.tiDung) / (dinhKhoi - matSan);
}
export function quyDoiMat(bo, pxDung) {
  const T = { ...bo.tiLe, pxDung }, X = (x) => (x - T.trucX) / T.pxNgang, Du = (y) => (y - T.maiY) / T.pxDung, tb = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const cum = bo.cum.map((c) => { const tam = c.o.map(([a, b]) => (a + b) / 2), rong = c.o.map(([a, b]) => b - a);
    return { ten: c.ten, x: X(tb(tam)), duoi: Du(c.bau), n: c.o.length, w: tb(rong) / T.pxNgang, buoc: c.o.length > 1 ? (tam.at(-1) - tam[0]) / (c.o.length - 1) / T.pxNgang : tb(rong) / T.pxNgang + 0.2,
      h: (c.bau - c.dinhO) / T.pxDung, vomR: c.vom ? (c.vom[1] - c.vom[0]) / 2 / T.pxNgang : null, vomDinh: c.vom ? (c.bau - c.vom[2]) / T.pxDung : null }; });
  const tranh = (bo.tranh || []).map((t) => ({ ten: t.ten, x: X((t.hop[0] + t.hop[2]) / 2), rong: (t.hop[2] - t.hop[0]) / T.pxNgang, duoi: Du(t.hop[1]), cao: (t.hop[3] - t.hop[1]) / T.pxDung }));
  const b = bo.banCong, banCong = b && { x: X((b.trai + b.phai) / 2), rong: (b.phai - b.trai) / T.pxNgang, duoiLanCan: Du(b.lanCan), duoiSan: Du(b.san), duoiDay: Du(b.dayBan), duoiConXon: Du(b.conXon) };
  const go = (bo.go || []).map((g) => Du(g.y));
  let cuaDon = [], duoiSan = null;
  const P = bo.anhPhu;
  if (P) {
    const pN = T.pxNgang * P.tiNgang, pD = T.pxDung * P.tiDung, XP = (x) => X(P.mocXChinh) + (x - P.mocX) / pN, DP = (y) => Du(P.mocYChinh) + (y - P.mocY) / pD;
    cuaDon = P.cuaDon.map((c) => ({ x: XP((c.o[0] + c.o[1]) / 2), w: (c.o[1] - c.o[0]) / pN, duoi: DP(c.bau), h: (c.bau - c.dinh) / pD }));
    if (P.doiXung) cuaDon = [...cuaDon, ...cuaDon.map((c) => ({ ...c, x: -c.x, giaDinh: true }))];
    if (P.matSan != null) duoiSan = DP(P.matSan);
  }
  const G = bo.thapGoc, thap = G && { ids: G.ids, chop: Du(G.chop), chanChop: Du(G.chanChop), dinhRang: Du(G.dinhRang), dinhThan: Du(G.dinhThan), frieze: G.frieze.map(Du),
    tang: G.tang.map((t) => ({ dinh: Du(t.dinh), bau: Du(t.bau), w: (t.o[1] - t.o[0]) / T.pxNgang })), go: G.go.map((g) => g.map(Du)), rang: G.rang.map(Du), chanThan: Du(G.chanThan), mui: Du(G.mui) };
  return { cum, tranh, banCong, go, cuaDon, duoiSan, thap, gableCao: bo.neo ? (T.maiY - bo.neo.dinhY) / T.pxDung : null, pxDung: T.pxDung };
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
  const cuaSo = []; // ô cửa của mặt này (toạ độ thế giới) — ns.js dùng cho mở cửa trèo vào
  const KINH = new THREE.MeshStandardMaterial({ color: '#7d8691', roughness: 0.3, metalness: 0.2, emissive: '#3a4048' }); // kính chì xám như ảnh, không đen đặc
  const cum = (o, s, y) => { const c = nhomCua(THREE, { k: 0.23, cot: 0.125, ...o }); cuaSo.push({ x: mx + ux * s, y, z: mz + uz * s, nx, nz, nua: c.rong / 2, cao: o.h, ten: 'Palas' }); for (const g of c.da) dat(new THREE.Mesh(g, DA), s, y, 0); for (const g of c.toi) dat(new THREE.Mesh(g, KINH), s, y, 0); };
  // BỐ CỤC lấy TỪ TỆP ĐO ẢNH (tuong.bo = quyDoiMat(du-lieu/neuschwanstein-mat-palas-san.json)): x sang phải ảnh → s = C − x (trục x cục bộ của khung ngược ux:
  // bên trái ảnh là phía +s), duoi dưới mái → y = y1 − duoi. Mặt chạy từ tháp góc tới tháp góc = chân đầu hồi (hoi.sA → sB), tâm C.
  const C = tuong.hoi ? (tuong.hoi.sA + tuong.hoi.sB) / 2 : 0, RONG = tuong.hoi ? tuong.hoi.sB - tuong.hoi.sA : L, bo = tuong.bo;
  const go = (y, rong = RONG) => dat(new THREE.Mesh(new THREE.BoxGeometry(rong, 0.2, 0.22), DA), C, y, 0.11); // gờ đá ngang cả mặt
  if (!bo) console.warn('[mattien] thiếu tệp bố cục mặt Palas — không dựng chi tiết mặt'); else {
    for (const t of bo.tranh) {
      const tx = tranh[t.ten]; if (!tx) continue;
      const vl = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.18 }); // tranh tường hơi sáng hơn đá như ảnh
      dat(new THREE.Mesh(new THREE.PlaneGeometry(t.rong, t.cao), vl), C - t.x, y1 - t.duoi - t.cao / 2, 0.03);
    }
    for (const c of bo.cum) cum({ n: c.n, w: c.w, h: c.h, k: c.buoc - c.w, cot: Math.min(0.13, (c.buoc - c.w) * 0.45), vomR: c.vomR, vomDinh: c.vomDinh }, C - c.x, y1 - c.duoi);
    for (const c of bo.cuaDon) cum({ n: 1, w: c.w, h: c.h, vom: false, cot: 0.08 }, C - c.x, y1 - c.duoi);
    for (const d of bo.go) go(y1 - d);
    const b = bo.banCong;
    if (b) { // sàn, lan can, tay vịn, hai đầu, con-xon đỡ — theo hộp đo trên ảnh
      const yS = y1 - b.duoiSan, day = b.duoiDay - b.duoiSan, lc = b.duoiSan - b.duoiLanCan, cx = b.duoiConXon - b.duoiDay, s0 = C - b.x;
      dat(new THREE.Mesh(new THREE.BoxGeometry(b.rong, day, 1.2), DA), s0, yS - day / 2, 0.6);
      dat(new THREE.Mesh(new THREE.BoxGeometry(b.rong, lc, 0.14), DA), s0, yS + lc / 2, 1.13);
      dat(new THREE.Mesh(new THREE.BoxGeometry(b.rong + 0.18, 0.1, 0.26), DA), s0, yS + lc, 1.13);
      for (const k of [-1, 1]) dat(new THREE.Mesh(new THREE.BoxGeometry(0.14, lc, 1.2), DA), s0 + k * (b.rong / 2 - 0.07), yS + lc / 2, 0.6);
      const nCx = Math.max(2, Math.round(b.rong / 1.1)); for (let i = 0; i < nCx; i++) dat(new THREE.Mesh(new THREE.BoxGeometry(0.26, cx, 1.0), DA), s0 - b.rong / 2 + (i + 0.5) * b.rong / nCx, yS - day - cx / 2, 0.5);
    }
  }
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
  ra.cua = cuaSo; return ra;
}

// THÁP GÓC treo trên con-xon (hai tháp sa thạch hai bên mặt Palas hướng sân) — dựng HOÀN TOÀN theo số đo ảnh (tệp bố cục thapGoc, đổi ra cao độ tuyệt đối b.*):
// thân BÁT GIÁC bọc ngoài thân tròn OSM (chanThan → dinhThan); mỗi tầng cửa: MỘT cửa vòm đơn có cột nhỏ trên mỗi mặt quay ra ngoài (ngoai(x, z));
// gờ (go) + diềm răng (rang) giữa các tầng; đỉnh thân: diềm vòm nhỏ (frieze), gờ nhô, vành răng cưa nhô ra (tới dinhRang); chóp bát giác mảnh đồng xanh tới chop;
// dưới chân: gờ chân rồi con-xon thu về một mũi treo (tới mui). → [Mesh…]
export function datThapGoc({ THREE, mergeGeometries, v, b, mau, mauMai = '#7f9e8c', ngoai = () => true, nhe = false }) {
  const cx = v.reduce((s, p) => s + p[0], 0) / v.length, cz = v.reduce((s, p) => s + p[1], 0) / v.length;
  const R = Math.max(...v.map((p) => Math.hypot(p[0] - cx, p[1] - cz))) * 1.12 + 0.04, AP = R * Math.cos(Math.PI / 8), CANH = 2 * R * Math.sin(Math.PI / 8);
  const da = [], toi = [], cb = (g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
  const bat = (rt, rd, h, y, kin = false) => { const g = cb(new THREE.CylinderGeometry(rt, rd, Math.max(0.02, h), 8, 1, !kin)); g.translate(cx, y, cz); return g; }; // y = tâm
  const vanh = (y0, y1, nho) => da.push(bat(R + nho, R + nho, y1 - y0, (y0 + y1) / 2, true)); // gờ: vành bát giác nhô ra
  da.push(bat(R, R, b.dinhThan - b.chanThan, (b.chanThan + b.dinhThan) / 2)); // thân
  for (const [tr, du] of b.go) vanh(du, tr, 0.3); // gờ dày nhô như ảnh
  // diềm răng: mỗi mặt 4 khối nhỏ
  const matI = (i) => { const a = (i + 0.5) * Math.PI / 4; return { ox: Math.sin(a), oz: Math.cos(a), quay: a }; };
  const datM = (g, i, x, yy, d) => { const { ox, oz, quay } = matI(i); g.translate(x, 0, 0); g.rotateY(quay); g.translate(cx + ox * (AP + d), yy, cz + oz * (AP + d)); return g; };
  for (let i = 0; i < 8; i++) for (const x of [-0.3, -0.1, 0.1, 0.3]) da.push(datM(cb(new THREE.BoxGeometry(CANH * 0.12, b.rang[0] - b.rang[1], 0.12)), i, x * CANH, (b.rang[0] + b.rang[1]) / 2, 0.05));
  // đỉnh thân: diềm vòm nhỏ (mỗi mặt 2 vòm), gờ nhô, vành răng cưa nhô ra
  for (let i = 0; i < 8; i++) for (const x of [-CANH / 4, CANH / 4]) { const g = cb(new THREE.TorusGeometry(CANH / 5, 0.05, 3, nhe ? 4 : 6, Math.PI)); da.push(datM(g, i, x, b.frieze[1] + (b.frieze[0] - b.frieze[1]) * 0.35, 0.05)); }
  const NHO = 0.45; da.push(bat(R + NHO, R + 0.05, b.dinhThan - b.frieze[0], (b.dinhThan + b.frieze[0]) / 2, true)); // gờ nhô đỡ vành
  vanh(b.dinhThan, b.dinhThan + 0.25, NHO); // mặt vành
  const hRang = b.dinhRang - b.dinhThan - 0.25, APr = (R + NHO) * Math.cos(Math.PI / 8), CANHr = 2 * (R + NHO) * Math.sin(Math.PI / 8);
  if (hRang > 0.1) for (let i = 0; i < 8; i++) for (const x of [-CANHr / 4, CANHr / 4]) { const { ox, oz, quay } = matI(i), g = cb(new THREE.BoxGeometry(CANHr / 3.4, hRang, 0.3)); g.rotateY(quay); g.translate(cx + ox * (APr - 0.12) + Math.cos(quay) * x, b.dinhThan + 0.25 + hRang / 2, cz + oz * (APr - 0.12) - Math.sin(quay) * x); da.push(g); }
  // tầng cửa: mỗi mặt quay ra ngoài MỘT cửa vòm đơn có cột nhỏ
  for (const t of b.tang) for (let i = 0; i < 8; i++) {
    const { ox, oz } = matI(i); if (!ngoai(cx + ox * (AP + 1.2), cz + oz * (AP + 1.2))) continue;
    const c = nhomCua(THREE, { n: 1, w: Math.min(t.w, CANH * 0.55), h: t.dinh - t.bau, vom: false, nhe, cot: 0.07 });
    for (const g of c.da) da.push(datM(g, i, 0, t.bau, 0)); for (const g of c.toi) toi.push(datM(g, i, 0, t.bau, 0));
  }
  // con-xon: gờ chân đã có (go), dưới là khối nón bát giác thu về mũi treo
  const yX = Math.min(...b.go.flat()), cao = yX - b.mui;
  da.push(bat(R + 0.1, R * 0.35, cao * 0.75, yX - cao * 0.375, true), bat(R * 0.35, R * 0.18, cao * 0.25, b.mui + cao * 0.125, true));
  const ra = [], gop = (ds, vl, bong = false) => { if (!ds.length) return; const m = new THREE.Mesh(mergeGeometries(ds), vl); m.castShadow = bong; m.receiveShadow = true; ra.push(m); };
  { // chóp bát giác mảnh đồng xanh (trùm nón OSM tối bên trong) + nụ + thánh giá
    const h = b.chop - b.chanChop, g = cb(new THREE.ConeGeometry(R * 0.95, h, 8, 1, true)); g.translate(cx, b.chanChop + h / 2, cz);
    const q = cb(new THREE.SphereGeometry(0.16, 8, 6)); q.translate(cx, b.chop + 0.1, cz);
    const k = cb(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 5)); k.translate(cx, b.chop + 0.6, cz); const ng = cb(new THREE.BoxGeometry(0.5, 0.06, 0.06)); ng.translate(cx, b.chop + 0.85, cz);
    gop([g, q, k, ng], new THREE.MeshStandardMaterial({ color: mauMai, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }), !nhe);
  }
  gop(da, new THREE.MeshStandardMaterial({ color: mau, roughness: 0.8 })); gop(toi, new THREE.MeshStandardMaterial({ color: '#1b1f27', roughness: 0.6 }));
  return ra;
}

// CHÓP / THÁP NHỎ OSM không có (du-lieu/<lâu>-chop.json, tìm bằng máy kiểm đường viền + tia từ camera đã khớp): nón bát giác đá phiến + nụ + que chóp, gộp một lưới
export function datChop({ THREE, mergeGeometries, ds, nhe = false }) {
  const gs = [], cb = (g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
  for (const c of ds) {
    const h = c.yDinh - c.yChan; if (!(h > 0.5)) continue;
    const non = cb(new THREE.ConeGeometry(c.r, h, nhe ? 6 : 8, 1, false)); non.translate(c.x, c.yChan + h / 2, c.z); gs.push(non);
    const nu = cb(new THREE.SphereGeometry(Math.max(0.08, c.r * 0.12), 6, 4)); nu.translate(c.x, c.yDinh + 0.05, c.z); gs.push(nu);
    const que = cb(new THREE.CylinderGeometry(0.02, 0.03, Math.max(0.5, h * 0.12), 4)); que.translate(c.x, c.yDinh + Math.max(0.5, h * 0.12) / 2, c.z); gs.push(que);
  }
  if (!gs.length) return [];
  const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: '#3d434c', roughness: 0.6, metalness: 0.15 })); m.castShadow = !nhe; m.receiveShadow = true;
  return [m];
}
