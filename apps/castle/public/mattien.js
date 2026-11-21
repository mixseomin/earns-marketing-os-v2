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
  const k = 0.2, w = Math.max(0.55, Math.min(0.9, (s1 - s0 + 0.2 - (n - 1) * k) / n)), h = Math.min(hang.hMax ?? 9, Math.max(1.7, Math.min(3, hang.y1 - hang.y0 + 0.4))), s = (s0 + s1) / 2, y = (hang.y0 + hang.y1) / 2 - h / 2;
  const o = []; for (let i = 0; i < n; i++) { const c = s + (i - (n - 1) / 2) * (w + k); o.push({ s0: c - w / 2, s1: c + w / 2, y0: y, y1: y + h - w / 2 }); }
  return { n, w, h, k, s, y, o };
}
// BỐ TRÍ SỐ ĐO MỘT MẶT KHÔNG CHỒNG LẤN (dùng chung: mattien dựng khung · ns.js khoét lỗ — hai bên phải trùng nhau). Ảnh 3D nhoè cho hàng thấp
// 0,9–1,2 m sát nhau; oCum nới ô tối thiểu 1,7 m → hai hàng chồng nửa thân, vòm bao cửa đôi trùm lên hàng trên (anh 16/11/2026: "chi tiết đè lên nhau").
//   1) hàng xếp theo độ cao; mỗi hàng chỉ cao tới cách hàng kề 0,3 m (chia đôi khoảng hở) — còn < 1 m thì bỏ (hàng dò trùng)
//   2) trong mặt: cụm có khung (kể cả vòm bao) chạm khung cụm đã đặt thì bỏ (ưu tiên hàng đếm được nhiều ô hơn)
//   3) vòm bao lớn cho cửa đôi chỉ khi trên đỉnh ô còn ≥ 0,9 m tới hàng trên / mái hiên
// Trả [{ c, h, d, vom }] — h là hàng đã thu gọn (y0, y1), d = oCum(c, h).
// yChan: chân tường — hàng cửa đo (độ cao TUYỆT ĐỐI từ ảnh Google) nằm HẲN ngoài [chân, đỉnh] của chính bức tường thì BỎ (17/11/2026, Viereckturm: khối được
// chỉnh độ cao theo ảnh 3D sau khi đo cửa → cửa lơ lửng trên đỉnh tường / đè sang khối chồng bên trên). Hàng chỉ chạm / vắt qua đỉnh vẫn giữ (lọc chặt làm hụt 36 mặt).
// L: bề ngang tường — cụm cửa đo lố khỏi [0, L] quá 0,1 m (mặt bằng bị thu nhỏ theo ảnh 3D sau khi đo cửa, vd Viereckturm) thì BỎ, không để cửa lơ lửng ngoài góc
export function boTriDo(hang, yTran = Infinity, yChan = null, L = Infinity) {   // yChan = null: KHÔNG lọc (mặt đo tay — khung)
  const H = hang.filter((h) => yChan == null || (h.y0 < yTran - 0.5 && h.y1 > yChan + 0.5)).map((h) => ({ ...h, n: h.cum.reduce((t, c) => t + c[2], 0) })).sort((a, b) => a.y0 - b.y0);
  const khoang = H.map((h) => { const d0 = oCum([0, 1, 1], h); return [d0.y - 0.1, d0.y + d0.h + 0.15]; }); // bao đứng của hàng sau khi nới
  for (let i = 0; i + 1 < H.length; i++) { const tren = khoang[i][1], duoi = khoang[i + 1][0]; if (tren > duoi - 0.3) { const g = (tren + duoi) / 2; khoang[i][1] = g - 0.15; khoang[i + 1][0] = g + 0.15; } }
  const ra = [], dat = [];
  const thu = H.map((h, i) => ({ h, i })).sort((a, b) => b.h.n - a.h.n); // hàng nhiều ô đặt trước
  for (const { h, i } of thu) {
    const [b0, b1] = khoang[i]; if (b1 - b0 < 1.0) continue;
    const hh = { ...h, y0: b0 + 0.1, y1: b1 - 0.15, hMax: b1 - b0 - 0.25 }; // ô nằm gọn trong dải của hàng (hMax: oCum không nới quá dải)
    const tran = Math.min(yTran, i + 1 < H.length ? khoang[i + 1][0] : Infinity);
    for (const c of h.cum) {
      const d = oCum(c, hh), W = d.n * d.w + (d.n - 1) * d.k, vom = d.n === 2 && tran - (d.y + d.h) >= 0.9, x0 = d.s - W / 2 - (vom ? 0.5 : 0.3), x1 = d.s + W / 2 + (vom ? 0.5 : 0.3), y0 = d.y - 0.15, y1 = d.y + d.h + (vom ? 0.6 : 0.15);
      if (yChan != null && (d.s - W / 2 < -0.1 || d.s + W / 2 > L + 0.1)) continue;   // chỉ khi bật lọc (số đo tự động) — mặt đo tay cố ý cho cụm vắt qua đầu cạnh, kể cả s âm
      if (dat.some((b) => x0 < b[1] && b[0] < x1 && y0 < b[3] && b[2] < y1)) continue;
      dat.push([x0, x1, y0, y1]); ra.push({ c, h: hh, d, vom });
    }
  }
  return ra;
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
  // ô cửa của KHỐI KHÁC cùng một mặt phẳng (hai đường viền OSM chồng nhau của một toà, ví dụ Viereckturm way/221599098 · way/223069515): ô mới đè khung ô đã đặt
  // thì bỏ — cùng luật với window.__ns.chongLan (khung ngoài = nửa bề ngang + viền, đỉnh + viền trên); trong một mặt boTriDo đã lo
  const VIEN0 = { ngang: 0.25, tren: 0.4 };
  const deLen = (o) => cua.some((b) => { if (b.mat === o.mat || o.nx * b.nx + o.nz * b.nz < 0.97 || Math.abs((b.x - o.x) * o.nx + (b.z - o.z) * o.nz) > 0.8) return false;
    const va = o.vien || VIEN0, vb = b.vien || VIEN0, ds = Math.abs((o.x - b.x) * -o.nz + (o.z - b.z) * o.nx);
    return ds < o.nua + va.ngang + b.nua + vb.ngang - 0.05 && o.y - 0.15 < b.y + b.cao + vb.tren - 0.05 && b.y - 0.15 < o.y + o.cao + va.tren - 0.05; });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), mot1 = new THREE.Vector3(1, 1, 1);
  for (const t of tuong) {
    const palas = t.ten === 'Palas';
    for (let i = 0; i < t.v.length; i++) {
      const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 2.5) continue;
      const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, goc = Math.atan2(nx, nz); // pháp tuyến RA NGOÀI (đa giác ngược chiều kim nhìn từ trên)
      const lo = t.lo(i, x1, z1, x2, z2), mn = palas ? { san: false } : matNgoai((x1 + x2) / 2, (z1 + z2) / 2, nx, nz), coVom = mn.san && Number.isFinite(mn.yDat) && t.yMong <= mn.yDat + 1.5; // dãy vòm sát đất chỉ khi chân tường CHẠM đất — khối đặt cao (phần trên tháp, chân 53,7 m) từng bị dựng cửa từ mặt sân lên, lơ lửng giữa trời (17/11/2026)
      q.setFromAxisAngle(Y, goc);
      // cạnh bị KHOÁ gần hết (mặt dựng riêng theo ảnh phủ lên, ns.js — kể cả cạnh của khối khác cùng mặt phẳng) → không dựng cửa nào, kể cả cửa có số đo:
      // đường số đo trước không xét khoá → hai lớp cửa đè nhau ở mặt Palas hướng sân (anh 17/11/2026)
      if (lo.some((l) => l.matRieng && l.s1 - l.s0 >= L * 0.9)) continue;   // chỉ khoá của mặt dựng riêng (matRieng) — lỗ khoét cổng cũng phủ cả cạnh từ dưới đất, không được tính (Torbau mặt tây mất hết cửa)
      const doTu = cuaSo[`${t.k?.id}#${i}`], coAnh = !!matAnh[`${t.k?.id}#${i}`];
      if (coAnh && !doTu?.hang?.length) continue; // mặt có ảnh dán thật (đã có cửa, gờ thật trong ảnh) → không dựng cửa 3D đoán đè lên
      if (doTu?.hang?.length && coVom && !palas) { /* mặt nhìn ra sân trong: giữ dãy vòm tầng trệt theo ảnh Josef Albert (số đo ảnh 3D không thấy vòm) — bỏ số đo */ }
      else if (doTu?.hang?.length) { // MẶT CÓ SỐ ĐO TỪ ẢNH: hàng / cụm / số ô đúng ảnh, ô trong dải phòng có lỗ thật thì không kính (mở được)
        // lọc ngoài tường chỉ cho số đo TỰ ĐỘNG trên ảnh Google; mặt đo tay trên ảnh rõ (khung: true) có thể cố ý cho cụm vắt qua đầu cạnh OSM ngắn (Torbau mặt tây)
        const boTri = doTu.khung ? boTriDo(doTu.hang, t.y1) : boTriDo(doTu.hang, t.y1, Number.isFinite(t.k?.yDuoi) ? t.k.yDuoi : -1e9, L);
        for (const h of new Set(boTri.map((b) => b.h))) if (!coAnh) go.push([x1, z1, ux, uz, nx, nz, L, h.y0 - 0.35]); // gờ dưới mỗi hàng còn lại (mặt có ảnh dán: gờ đã có trong ảnh)
        for (const { c, h, d, vom } of boTri) {
          {
            const coLo = d.o.map((o) => lo.some((l) => l.cuaSo && Math.abs(l.s0 - o.s0) < 0.05 && Math.abs(l.y0 - o.y0) < 0.05));
            const moi = d.o.map((o, j) => ({ x: x1 + ux * (o.s0 + o.s1) / 2, y: o.y0, z: z1 + uz * (o.s0 + o.s1) / 2, nx, nz, nua: d.w / 2, cao: o.y1 - o.y0, coLo: coLo[j], ten: t.ten, mat: `${t.k?.id}#${i}`, vien: { ngang: vom ? 0.5 : 0.3, tren: d.w / 2 + (vom ? 0.6 : 0.15) }, cum: d.s })); // vien: khung đá ngoài lòng kính (kiểm chồng lấn)
            if (moi.some(deLen)) continue;
            // cửa đôi: vòm đá lớn bao ngoài (ảnh 360° cánh Torbau; kiểu Roman) — chỉ khi boTriDo thấy còn chỗ phía trên
            const g = nhomCua(THREE, { n: d.n, w: d.w, h: d.h, k: d.k, cot: 0.06, vom, nhe });
            const dat = (gg) => { gg.rotateY(goc); gg.translate(x1 + ux * d.s, d.y, z1 + uz * d.s); return gg; };
            if (!coAnh || coLo.some(Boolean)) { for (const gg of g.da) doDa.push(dat(gg)); g.toi.forEach((gg, j) => { if (!coLo[j]) doToi.push(dat(gg)); }); } // mặt có ảnh dán: ảnh đã có cửa thật — chỉ dựng khung cho cụm có ô mở được
            cua.push(...moi);
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
        const coCua = cua.length;   // gờ đá dưới hàng chỉ đặt khi hàng có ít nhất một cửa (tường hẹp / cửa bị khối khác che → gờ cụt lơ lửng trên mặt tháp, anh 17/11/2026)
        for (const s of ds) {
          // TỪNG CỬA: tâm cửa (0,35 m ra ngoài mặt) nằm trong khối khác ở độ cao đó → cửa của khối bị khối to hơn bọc ngoài, khung sẽ đâm xuyên tường khối kia (thanh lơ lửng dọc mép tháp, anh 16/11/2026) → bỏ
          if (biChe(x1 + ux * s + nx * 0.35, y + cao / 2, z1 + uz * s + nz * 0.35) || biChe(x1 + ux * (s - nua) + nx * 0.35, y + cao / 2, z1 + uz * (s - nua) + nz * 0.35) || biChe(x1 + ux * (s + nua) + nx * 0.35, y + cao / 2, z1 + uz * (s + nua) + nz * 0.35)) continue;
          if (lo.some((o) => !o.cuaSo && s + nua > o.s0 && s - nua < o.s1 && y + cao > o.y0 && y < o.y1)) continue; // chỗ khoét cửa / dải nội thất (lỗ của chính ô cửa sổ thì không tính)
          const [mNua, mCao] = O_MO[kieu], coLo = lo.some((o) => o.cuaSo && Math.abs((o.s0 + o.s1) / 2 - s) < 0.05 && Math.abs(o.y0 - y) < 0.05);
          const moi = { x: x1 + ux * s, y, z: z1 + uz * s, nx, nz, nua: mNua, cao: mCao, coLo, ten: t.ten, mat: `${t.k?.id}#${i}` }; // cho ns.js: đang leo sát cửa sổ có phòng phía sau thì mở cửa trèo vào
          if (deLen(moi)) continue;
          viTri[coLo && kieu === 'ba' ? 'baMo' : kieu].push(m4.compose(new THREE.Vector3(x1 + ux * s, y, z1 + uz * s), q, mot1).clone());
          cua.push(moi);
        }
        if (cua.length > coCua) go.push([x1, z1, ux, uz, nx, nz, L, y - 0.55]);
      }
    }
  }
  const vl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), ra = [];
  // MỨC CHI TIẾT THEO KHOẢNG CÁCH (chỉ điện thoại, nhe): ở xa (toàn cảnh ~300 m) khung đá từng ô nhỏ hơn một điểm ảnh mà ăn ~100 nghìn tam giác →
  // bản XA chỉ còn tấm cửa tối + khung phẳng (2 hộp / ô); userData.lod = 'gan' | 'xa', ns.js bật / tắt theo khoảng cách camera
  const XA = { mot: [1.15, 2.4], ba: [2.65, 2.7], baMo: [2.65, 2.7], vom: [1.9, 2.9] };
  for (const [ten, g] of [['mot', mot], ['ba', ba], ['baMo', baMo], ['vom', dayVom]]) { const ds = viTri[ten]; if (!ds.length) continue; const im = new THREE.InstancedMesh(g, vl, ds.length); ds.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; ra.push(im);
    if (nhe) { im.userData.lod = 'gan'; const [w, h] = XA[ten], gx = mergeGeometries([hop(w + 0.4, h + 0.3, 0.12, 0, h / 2, 0.06, DA), hop(w, h, 0.02, 0, h / 2 + 0.05, 0.13, TOI)]), ix = new THREE.InstancedMesh(gx, vl, ds.length); ds.forEach((m, i) => ix.setMatrixAt(i, m)); ix.userData.lod = 'xa'; ix.visible = false; ra.push(ix); } } // chi tiết nhỏ không đổ bóng: lượt vẽ bóng tốn gấp đôi mà bóng khung cửa gần như không thấy
  if (go.length) { const gs = go.map(([x1, z1, ux, uz, nx, nz, L, y]) => { const g = hop(L, 0.22, 0.2, 0, 0, 0, _c.copy(DA)); g.rotateY(Math.atan2(nx, nz)); g.translate(x1 + ux * L / 2 + nx * 0.1, y, z1 + uz * L / 2 + nz * 0.1); return g; });
    const m = new THREE.Mesh(mergeGeometries(gs), vl); m.receiveShadow = true; ra.push(m); }
  if (doDa.length) { const m = new THREE.Mesh(mergeGeometries(doDa), new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.8 })); m.receiveShadow = true; if (nhe) m.userData.lod = 'gan'; ra.push(m); } // ở xa: còn tấm kính tối (doToi) + gờ, đủ đọc ra cửa
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
  let cuaDon = [], duoiSan = null, cong = null;
  const P = bo.anhPhu;
  if (P) {
    const pN = T.pxNgang * P.tiNgang, pD = T.pxDung * P.tiDung, XP = (x) => X(P.mocXChinh) + (x - P.mocX) / pN, DP = (y) => Du(P.mocYChinh) + (y - P.mocY) / pD;
    cuaDon = P.cuaDon.map((c) => ({ x: XP((c.o[0] + c.o[1]) / 2), w: (c.o[1] - c.o[0]) / pN, duoi: DP(c.bau), h: (c.bau - c.dinh) / pD }));
    if (P.doiXung) cuaDon = [...cuaDon, ...cuaDon.map((c) => ({ ...c, x: -c.x, giaDinh: true }))];
    // cụm cửa phần dưới đo thẳng trên ảnh 3D (cumPhu, toạ độ hệ ảnh phụ, không lấy đối xứng): mỗi cụm một khung như cụm ảnh chính
    for (const c of P.cumPhu || []) { const tam = c.o.map(([a, b]) => (a + b) / 2), rong = c.o.map(([a, b]) => b - a), w = rong.reduce((p, q) => p + q, 0) / rong.length / pN;
      cum.push({ ten: c.ten, x: XP(tam.reduce((p, q) => p + q, 0) / tam.length), duoi: DP(c.bau), n: c.o.length, w, buoc: c.o.length > 1 ? (tam.at(-1) - tam[0]) / (c.o.length - 1) / pN : w + 0.2,
        h: (c.bau - c.dinhO) / pD, vomR: null, vomDinh: null, khongVom: true }); }
    if (P.matSan != null) duoiSan = DP(P.matSan);
    // cổng đầu cầu thang (góp ý #1644): độ cao theo hệ ảnh phụ kéo dài; chỗ đặt ngang lấy đầu trên cầu thang OSM (ns.js) để thang và cửa gặp nhau
    const Cg = P.cong;
    if (Cg) cong = { ten: Cg.ten, thang: Cg.thang, duoiNguong: DP(Cg.nguong), cua: (Cg.nguong - Cg.dinhCua) / pD, khung: (Cg.nguong - Cg.dinhKhung) / pD, rongCua: Cg.rongCua / pN, rongKhung: Cg.rongKhung / pN };
  }
  // tháp góc treo nhô ra trước mặt tường về phía người chụp (đứng dưới sân nhìn ngửa) → trên ảnh trông cao + to hơn thật:
  // thapGoc.phoiCanh = { ti, matNguoi } co mọi độ cao tháp về ngang mắt người chụp (mặt sân + matNguoi) theo ti, bề ngang theo ti (góp ý #1649)
  const G = bo.thapGoc, PC = G?.phoiCanh, matMay = PC && duoiSan != null ? duoiSan - PC.matNguoi : null;
  const Dt = (y) => matMay == null ? Du(y) : matMay + PC.ti * (Du(y) - matMay), tiN = matMay == null ? 1 : PC.ti;
  const thap = G && { ids: G.ids, chop: Dt(G.chop), chanChop: Dt(G.chanChop), dinhRang: Dt(G.dinhRang), dinhThan: Dt(G.dinhThan), frieze: G.frieze.map(Dt),
    tang: G.tang.map((t) => ({ dinh: Dt(t.dinh), bau: Dt(t.bau), w: tiN * (t.o[1] - t.o[0]) / T.pxNgang })), go: G.go.map((g) => g.map(Dt)), rang: G.rang.map(Dt), chanThan: Dt(G.chanThan), mui: Dt(G.mui),
    // bề ngang đo trên ảnh (thapGoc.rong: thân, vành, vòng răng, chân nón — px [trái, phải]) → bán kính đỉnh bát giác: bề ngang thấy ≈ đường kính ngoại tiếp chiếu từ chính diện ≈ R·(1 + cos 22,5°)
    ...Object.fromEntries(Object.entries(G.rong || {}).filter(([, r]) => Array.isArray(r)).map(([k, r]) => ['r' + k[0].toUpperCase() + k.slice(1), tiN * (r[1] - r[0]) / T.pxNgang / (1 + Math.cos(Math.PI / 8))])) };
  return { cum, tranh, banCong, go, cuaDon, duoiSan, cong, thap, gableCao: bo.neo ? (T.maiY - bo.neo.dinhY) / T.pxDung : null, pxDung: T.pxDung };
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
  // vien (kiểm chồng lấn): rong đã gồm trụ hai bên nên cụm có vòm khai ngang 0 (main 280167213: viền mặc định 0,25 m báo nhầm hai cửa đôi sát nhau); cụm có vòm lớn → bề ngang c.rong đã là mép ngoài vòm, đỉnh vòm cao hơn đỉnh ô (vomDinh − h); cụm không vòm → bậu nhô 0,1 m, vòm nhỏ từng ô ~0,2 m
  const cum = (o, s, y) => { const c = nhomCua(THREE, { k: 0.23, cot: 0.125, ...o }), coVom = o.vom !== false;
    cuaSo.push({ x: mx + ux * s, y, z: mz + uz * s, nx, nz, nua: c.rong / 2, cao: o.h, ten: 'Palas', vien: coVom && o.vomR ? { ngang: 0, tren: Math.max(0.2, (o.vomDinh ?? o.h) - o.h) } : coVom ? { ngang: 0, tren: 0.6 } : { ngang: 0.1, tren: 0.2 } }); for (const g of c.da) dat(new THREE.Mesh(g, DA), s, y, 0); for (const g of c.toi) dat(new THREE.Mesh(g, KINH), s, y, 0); };
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
    for (const c of bo.cum) cum({ n: c.n, w: c.w, h: c.h, k: c.buoc - c.w, cot: Math.min(0.13, (c.buoc - c.w) * 0.45), vomR: c.vomR, vomDinh: c.vomDinh, ...(c.khongVom ? { vom: false } : {}) }, C - c.x, y1 - c.duoi);
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
    const g = bo.cong;
    if (g && Number.isFinite(tuong.cong?.s)) { // CỔNG ĐẦU CẦU THANG (góp ý #1644): khung sa thạch nhô ra, lòng cửa vòm, cánh gỗ, hai cột, vòm viền, diềm răng, gờ mái
      const SA = new THREE.MeshStandardMaterial({ color: '#dccaa2', roughness: 0.75 }), GO = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.7 });
      const s0 = tuong.cong.s, y0 = y1 - g.duoiNguong, K = g.rongKhung, Wc = g.rongCua, yV = g.cua - Wc / 2, NHO = 0.45;
      const vien = new THREE.Shape(); vien.moveTo(-K / 2, 0); vien.lineTo(K / 2, 0); vien.lineTo(K / 2, g.khung); vien.lineTo(-K / 2, g.khung); vien.lineTo(-K / 2, 0);
      const lo = new THREE.Path(); lo.moveTo(-Wc / 2, 0); lo.lineTo(-Wc / 2, yV); lo.absarc(0, yV, Wc / 2, Math.PI, 0, true); lo.lineTo(Wc / 2, 0); lo.lineTo(-Wc / 2, 0); vien.holes.push(lo);
      dat(new THREE.Mesh(new THREE.ExtrudeGeometry(vien, { depth: NHO, bevelEnabled: false, curveSegments: 10 }), SA), s0, y0, 0);
      const canh = new THREE.Shape(); canh.moveTo(-Wc / 2, 0); canh.lineTo(Wc / 2, 0); canh.lineTo(Wc / 2, yV); canh.absarc(0, yV, Wc / 2, 0, Math.PI, false); canh.lineTo(-Wc / 2, 0);
      dat(new THREE.Mesh(new THREE.ShapeGeometry(canh, 10), GO), s0, y0, 0.06);
      for (const k of [-1, 1]) { // cột nhỏ hai bên lòng cửa: thân + đầu cột + chân cột
        dat(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, yV - 0.3, 10), SA), s0 + k * (Wc / 2 + 0.17), y0 + 0.12 + (yV - 0.3) / 2, NHO + 0.06);
        dat(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.34), SA), s0 + k * (Wc / 2 + 0.17), y0 + yV - 0.08, NHO + 0.06);
        dat(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), SA), s0 + k * (Wc / 2 + 0.17), y0 + 0.06, NHO + 0.06);
      }
      dat(new THREE.Mesh(new THREE.TorusGeometry(Wc / 2 + 0.17, 0.1, 5, 14, Math.PI), SA), s0, y0 + yV, NHO + 0.04);
      dat(new THREE.Mesh(new THREE.BoxGeometry(K + 0.3, 0.26, NHO + 0.3), SA), s0, y0 + g.khung - 0.13, (NHO + 0.3) / 2);
      for (let q = -K / 2 + 0.2; q <= K / 2 - 0.15; q += 0.26) dat(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.12), SA), s0 + q, y0 + g.khung - 0.42, NHO + 0.06);
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

// ÁNH XẠ ẢNH CHỤP CHÉO → MẶT TƯỜNG (mặt dựng riêng ngoài Palas, du-lieu/<lâu>-mat-<tên>.json): ảnh chụp chéo nên tỉ lệ đổi dọc mặt (gần to, xa nhỏ).
// NGANG: s = (a·x + b) / (c·x + 1) — ảnh của một đường thẳng qua máy ảnh lỗ kim — khớp bình phương nhỏ nhất qua các mốc [x ảnh, s],
// rồi nắn phần dư tuyến tính từng khúc giữa hai mốc kề (mọi mốc đúng hẳn: tâm vòm cổng mô hình phải nằm đúng dưới cụm cửa trên cổng).
// ĐỨNG: hai đường ngang vẽ trên ảnh (gờ chia tầng ↔ yGo, mái hiên ↔ yMai), nội suy từng khúc theo x → y tuyệt đối theo tỉ lệ trên CỘT ảnh đó.
// → { s(x), y(x, yAnh), m(x0, x1): bề ngang mét, n: số mốc }
export function banDoMat(bo, { neo, yGo, yMai }) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], V = [0, 0, 0];
  for (const [x, s] of neo) { const r = [x, 1, -x * s]; for (let i = 0; i < 3; i++) { V[i] += r[i] * s; for (let j = 0; j < 3; j++) M[i][j] += r[i] * r[j]; } }
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M); if (!(Math.abs(D) > 1e-12) || neo.length < 3) return null;
  const [a, b, c] = [0, 1, 2].map((j) => det(M.map((r, i) => r.map((v, k) => (k === j ? V[i] : v)))) / D);
  const f = (x) => (a * x + b) / (c * x + 1), du = neo.map(([x, s]) => [x, s - f(x)]).sort((p, q) => p[0] - q[0]);
  const noi = (ds, x) => { if (x <= ds[0][0]) return ds[0][1]; for (let i = 0; i + 1 < ds.length; i++) if (x <= ds[i + 1][0]) return ds[i][1] + (ds[i + 1][1] - ds[i][1]) * (x - ds[i][0]) / (ds[i + 1][0] - ds[i][0]); return ds.at(-1)[1]; };
  const s = (x) => f(x) + noi(du, x), go = (x) => noi(bo.mat.go, x), mai = (x) => noi(bo.mat.maiHien, x);
  return { s, y: (x, yy) => yGo + (go(x) - yy) / (go(x) - mai(x)) * (yMai - yGo), m: (x0, x1) => Math.abs(s(x1) - s(x0)), n: neo.length };
}

// MẶT DỰNG RIÊNG THEO ẢNH CHỤP (mặt Torbau hướng sân dưới, góp ý #1641): mọi chi tiết lấy từ tệp bố cục (điểm ảnh thô) qua banDoMat — không số đo trong mã.
// viTri(s, y) → { x, z, nx, nz, mat } điểm trên MẶT TƯỜNG NGOÀI CÙNG tại s, độ cao y (null: không có tường ở đó → bỏ, ghi vào boQua);
// datTai(x, z) → mặt đất. Trục x cục bộ = sang PHẢI trên ảnh (nhìn từ ngoài), y lên, z ra ngoài. → { ra: [Mesh], cua: [...], kk: [{ mat, loai, y, x, z }], boQua: [tên] }
export function datMatRieng({ THREE, mergeGeometries, bo, bd, viTri, datTai, nhe = false }) {
  const cb = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; };
  const nhom = { da: [], kinh: [], go: [], mat: [], kim: [], mai: [] }, cua = [], kk = [], boQua = [];
  // đặt hình cục bộ g tại điểm p của mặt tường (gốc cục bộ ở độ cao y)
  const dat = (ten, g, p, y, ra = 0) => { g = cb(g); g.rotateY(Math.atan2(p.nx, p.nz)); g.translate(p.x + p.nx * ra, y, p.z + p.nz * ra); nhom[ten].push(g); };
  const hop = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)); g.translate(x, y, z); return g; };
  const vong = (r, ong, x, y, z, cung = Math.PI) => { const g = new THREE.TorusGeometry(r, ong, 4, nhe ? 8 : 16, cung); g.translate(x, y, z); return g; };
  const tb = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const choTuong = (ten, s, y0, y1) => { const p = viTri(s, y0 + 0.05), q = viTri(s, y1 - 0.05); if (!p || !q) { boQua.push(ten); return null; } return p; };
  // CỤM CỬA: n ô vòm nhỏ (nhomCua); vom = viền đá lớn bao ngoài (cửa đơn tầng trệt / khối cổng), mui = vòm mù riêng từng ô (ba vòm trên cổng)
  for (const c of bo.cum || []) {
    const tam = c.o.map(([a, b]) => (a + b) / 2), xc = tb(tam), s = bd.s(xc), w = tb(c.o.map(([a, b]) => bd.m(a, b))), buoc = c.o.length > 1 ? bd.m(tam[0], tam.at(-1)) / (c.o.length - 1) : w + 0.2;
    const yB = bd.y(xc, c.bau), h = bd.y(xc, c.dinhO) - yB, coVom = !!c.vom, vomR = coVom ? bd.m(c.vom[0], c.vom[1]) / 2 : null, vomDinh = coVom ? bd.y(xc, c.vom[2]) - yB : null;
    const p = choTuong(c.ten, s, yB, yB + (coVom ? vomDinh : h)); if (!p) continue;
    const g = nhomCua(THREE, { n: c.o.length, w, h, k: Math.max(0.08, buoc - w), cot: Math.min(0.1, Math.max(0.05, (buoc - w) * 0.4)), vom: coVom, vomR, vomDinh, nhe });
    for (const q of g.da) dat('da', q, p, yB); for (const q of g.toi) dat('kinh', q, p, yB);
    if (c.mui) { // vòm mù từng ô: vành đá đồng tâm với ô (cùng bước ô như nhomCua) + hai má, chân vòm ngang yM; bề ngang vòm đo trên ảnh (mui)
      const R = bd.m(c.mui[0], c.mui[1]) / c.o.length / 2, yM = bd.y(xc, c.mui[2]) - yB - R, b = w + Math.max(0.08, buoc - w);
      if (yM > 0.3) for (let i = 0; i < c.o.length; i++) { const cx = (i - (c.o.length - 1) / 2) * b; dat('da', vong(R - 0.13, 0.13, cx, yM, 0.13), p, yB); for (const sx of [-1, 1]) dat('da', hop(0.26, yM, 0.26, cx + sx * (R - 0.13), yM / 2, 0.13), p, yB); } }
    const rong = g.rong; cua.push({ x: p.x, y: yB, z: p.z, nx: p.nx, nz: p.nz, nua: rong / 2, cao: h, ten: c.ten, mat: p.mat, vien: coVom ? { ngang: 0, tren: Math.max(0.2, vomDinh - h) } : { ngang: 0.1, tren: 0.25 } });
    c.o.forEach(([a, b]) => { const q = viTri(bd.s((a + b) / 2), yB + h / 2) || p; kk.push({ mat: p.mat, loai: 'cua_so', y: yB + h / 2, x: q.x, z: q.z }); });
  }
  // Ô TRÒN: vành đá + đĩa đá lõm (ảnh: ô tròn đặc, không phải cửa sổ)
  for (const o of bo.oTron || []) { const s = bd.s(o.x), y = bd.y(o.x, o.y), r = bd.m(o.x - o.r, o.x + o.r) / 2, p = choTuong(o.ten, s, y - r, y + r); if (!p) continue;
    dat('da', vong(r, Math.max(0.05, r * 0.16), 0, 0, 0.06, Math.PI * 2), p, y); const d = new THREE.CircleGeometry(r * 0.85, nhe ? 10 : 18); d.translate(0, 0, 0.015); dat('mat', d, p, y); kk.push({ mat: p.mat, loai: 'o_tron', y, x: p.x, z: p.z }); }
  // DIỀM VÒM NHỎ (cung Lombard): gờ trên + n vòm nhỏ cung lên + mấu rủ giữa hai vòm
  for (const d of bo.dieMVom || []) { const xc = (d.tu + d.den) / 2, s = bd.s(xc), L = bd.m(d.tu, d.den), yT = bd.y(xc, d.y0), yD = bd.y(xc, d.y1), H = yT - yD, p = choTuong(d.ten, s, yD, yT); if (!p || !(H > 0.05)) continue;
    const buoc = L / d.n, r = Math.min(buoc * 0.42, H * 0.6), day = Math.min(0.12, H * 0.25);
    dat('da', hop(L, day, 0.12, 0, yT - day / 2, 0.06), p, 0);
    for (let i = 0; i < d.n; i++) { const cx = -L / 2 + (i + 0.5) * buoc; dat('da', vong(r, Math.max(0.025, r * 0.18), cx, yD, 0.05), p, 0); if (i) dat('da', hop(Math.min(0.12, buoc * 0.2), H * 0.35, 0.1, cx - buoc / 2, yD + H * 0.05, 0.05), p, 0); } }
  // KHUNG Ô TƯỜNG (gờ nổi viền từng ô tầng trên cánh nam)
  for (const k of bo.khungTam || []) { const xc = (k.tu + k.den) / 2, s = bd.s(xc), L = bd.m(k.tu, k.den), yT = bd.y(xc, k.tren), yD = bd.y(xc, k.duoi), p = choTuong(k.ten, s, yD, yT); if (!p) continue;
    for (const yy of [yT, yD]) dat('da', hop(L, 0.1, 0.06, 0, yy, 0.03), p, 0);
    for (const sx of [-1, 1]) dat('da', hop(0.1, yT - yD, 0.06, sx * L / 2, (yT + yD) / 2, 0.03), p, 0); }
  // BỆ ĐÁ NHÔ
  for (const b of bo.be || []) { const xc = (b.tu + b.den) / 2, s = bd.s(xc), L = bd.m(b.tu, b.den), yT = bd.y(xc, b.tren), yD = bd.y(xc, b.duoi), p = choTuong(b.ten, s, yD, yT); if (!p) continue;
    dat('da', hop(L, yT - yD, b.nho, 0, (yT + yD) / 2, b.nho / 2), p, 0); dat('da', hop(L + 0.12, 0.12, b.nho + 0.08, 0, yT - 0.06, b.nho / 2), p, 0); }
  // CỬA ĐI: cánh gỗ từ mặt đất tới lanh tô, lunette (bán nguyệt đá chạm) trên lanh tô, viền đá vòm bao ngoài + hai má xuống đất
  for (const c of bo.cuaDi || []) { const xc = (c.o[0] + c.o[1]) / 2, s = bd.s(xc), w = bd.m(c.o[0], c.o[1]), yL = bd.y(xc, c.dinhO), rT = bd.m(c.vom[0], c.vom[1]) / 2, rV = bd.m(c.vien[0], c.vien[1]) / 2;
    const p0 = viTri(s, yL - 0.5); if (!p0) { boQua.push(c.ten); continue; } const yD = datTai(p0.x + p0.nx * 1.5, p0.z + p0.nz * 1.5), p = choTuong(c.ten, s, yD + 0.3, yL + rT); if (!p) continue;
    dat('go', hop(w, yL - yD, 0.06, 0, (yL + yD) / 2, -0.02), p, 0);
    dat('da', hop(w + 0.2, 0.18, 0.3, 0, yL + 0.09, 0.15), p, 0);
    const lu = new THREE.CircleGeometry(rT, nhe ? 8 : 16, 0, Math.PI); lu.translate(0, yL + 0.18, 0.04); dat('mat', lu, p, 0);
    dat('da', vong(Math.max(rT + 0.05, rV - 0.18), 0.18, 0, yL + 0.18, 0.12), p, 0);
    for (const sx of [-1, 1]) dat('da', hop(0.36, yL + 0.18 - yD, 0.24, sx * Math.max(rT + 0.05, rV - 0.18), (yL + 0.18 + yD) / 2, 0.12), p, 0);
    cua.push({ x: p.x, y: yD, z: p.z, nx: p.nx, nz: p.nz, nua: rV, cao: yL - yD, ten: c.ten, mat: p.mat, vien: { ngang: 0, tren: rT + 0.36 } });
    kk.push({ mat: p.mat, loai: 'cua_so', y: (yL + yD) / 2, x: p.x, z: p.z }); }
  // LÔ-GIA (ban công lồi có mái): sàn trên con-xon, lan can đặc, cột + ba vòm mặt trước, hai mặt bên, mái dốc một mái tựa vào tường, lòng tối phía sau
  const G = bo.loGia;
  // độ nhô từ mặt bên thấy trên ảnh: px/m đứng (dọc cột) và ngang (dọc mặt) tại cột lô-gia → cos góc nhìn = ngang / đứng; nhô = bề ngang mặt bên / (đứng · sin)
  const nhoTuAnh = (x, yy, [a, b]) => { const dung = 1 / Math.abs(bd.y(x, yy + 1) - bd.y(x, yy)), ngang = 1 / Math.abs(bd.s(x + 1) - bd.s(x)), cos = Math.min(1, ngang / dung); return (b - a) / (dung * Math.max(0.3, Math.sqrt(1 - cos * cos))); };
  if (G) { const xc = (G.hop[0] + G.hop[1]) / 2, s = bd.s(xc), W = bd.m(G.hop[0], G.hop[1]), Y = (yy) => bd.y(xc, yy), N = G.matBen ? nhoTuAnh(xc, G.bau, G.matBen) : G.nho, yS = Y(G.bau), yDay = Y(G.day), yMD = Y(G.maiDuoi), yMT = Y(G.maiTren);
    const p = choTuong(G.ten, s, Y(G.conXon[1]), yMD); if (p) { boQua.nhoLoGia = +N.toFixed(2);
      dat('da', hop(W + 0.2, yS - yDay, N + 0.15, 0, (yS + yDay) / 2, (N + 0.15) / 2), p, 0); // sàn
      const yLC = Y(G.lanCan[0]) - Y(G.lanCan[1]);
      dat('da', hop(W, Math.max(0.3, yLC), 0.18, 0, yS + Math.max(0.3, yLC) / 2, N - 0.09), p, 0); // lan can mặt trước
      for (const sx of [-1, 1]) dat('da', hop(0.18, yMD - yS, N, sx * (W / 2 - 0.09), (yMD + yS) / 2, N / 2), p, 0); // hai mặt bên
      const o = G.o.map(([a, b]) => [bd.s(a) - s, bd.s(b) - s].map((v) => -v).sort((m, n) => m - n)), yDinh = Y(G.dinhO); // ô theo trục x cục bộ (sang phải ảnh = s giảm)
      for (const [a, b] of o) { const r = (b - a) / 2, yV = yDinh - r; dat('da', vong(r, 0.1, (a + b) / 2, yV, N - 0.1), p, 0); dat('kinh', hop(b - a, yV - yS, 0.02, (a + b) / 2, (yV + yS) / 2, 0.02), p, 0); }
      for (const xx of [o[0][0], ...o.slice(1).map((q, i) => (o[i][1] + q[0]) / 2), o.at(-1)[1]]) { const cy = new THREE.CylinderGeometry(0.1, 0.12, yDinh - yS - 0.2, nhe ? 6 : 10); cy.translate(xx, yS + (yDinh - yS - 0.2) / 2, N - 0.12); dat('da', cy, p, 0); }
      dat('da', hop(W, yMD - yDinh + 0.1, 0.22, 0, (yMD + yDinh) / 2, N - 0.11), p, 0); // dầm đá trên vòm
      const R = bd.m(G.maiRong[0], G.maiRong[1]), doc = Math.atan2(yMT - yMD, N + 0.3), dai = Math.hypot(yMT - yMD, N + 0.3), m = new THREE.BoxGeometry(R, 0.12, dai); m.rotateX(doc); m.translate(0, (yMT + yMD) / 2, (N + 0.3) / 2); dat('mai', m, p, 0);
      const nCx = G.nConXon, yCx = Y(G.conXon[1]); for (let i = 0; i < nCx; i++) { const xx = -W / 2 + (i + 0.5) * W / nCx; dat('da', hop(0.32, yDay - yCx, N * 0.8, xx, (yDay + yCx) / 2, N * 0.4), p, 0); }
      cua.push({ x: p.x, y: yS, z: p.z, nx: p.nx, nz: p.nz, nua: W / 2, cao: yDinh - yS, ten: G.ten, mat: p.mat, vien: { ngang: 0, tren: yMT - yDinh } });
      kk.push({ mat: p.mat, loai: 'ban_cong', y: yS, x: p.x, z: p.z });
      for (const [a, b] of G.o) { const q = viTri(bd.s((a + b) / 2), (yS + yDinh) / 2) || p; kk.push({ mat: p.mat, loai: 'cua_so', y: (yS + yDinh) / 2, x: q.x, z: q.z }); } } }
  // ĐỒNG HỒ: vành đá, mặt số sáng, hai kim
  const H = bo.dongHo;
  if (H) { const s = bd.s(H.x), y = bd.y(H.x, H.y), r = bd.m(H.x - H.r, H.x + H.r) / 2, p = choTuong(H.ten, s, y - r, y + r); if (p) {
    dat('da', vong(r, Math.max(0.06, r * 0.14), 0, 0, 0.08, Math.PI * 2), p, y); const d = new THREE.CircleGeometry(r * 0.8, nhe ? 12 : 24); d.translate(0, 0, 0.05); dat('mat', d, p, y);
    dat('kim', hop(0.05, r * 0.55, 0.03, 0, r * 0.25, 0.08), p, y); dat('kim', hop(r * 0.42, 0.05, 0.03, r * 0.19, 0, 0.08), p, y); kk.push({ mat: p.mat, loai: 'dong_ho', y, x: p.x, z: p.z }); } }
  const VL = { da: new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.8 }), kinh: new THREE.MeshStandardMaterial({ color: '#4d5560', roughness: 0.3, metalness: 0.2, emissive: '#22272e' }),
    go: new THREE.MeshStandardMaterial({ color: '#7a4f2c', roughness: 0.75 }), mat: new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.7 }), kim: new THREE.MeshStandardMaterial({ color: '#1d2228', roughness: 0.5 }),
    mai: new THREE.MeshStandardMaterial({ color: '#4b5058', roughness: 0.6, metalness: 0.15 }) };
  const ra = [];
  for (const [ten, gs] of Object.entries(nhom)) { if (!gs.length) continue; const m = new THREE.Mesh(mergeGeometries(gs), VL[ten]); m.castShadow = !nhe && ten === 'da'; m.receiveShadow = true; ra.push(m); }
  return { ra, cua, kk, boQua };
}

// THÁP GÓC treo trên con-xon (hai tháp sa thạch hai bên mặt Palas hướng sân) — dựng HOÀN TOÀN theo số đo ảnh (tệp bố cục thapGoc, đổi ra cao độ tuyệt đối b.*):
// thân BÁT GIÁC bọc ngoài thân tròn OSM (chanThan → dinhThan); mỗi tầng cửa: MỘT cửa vòm đơn có cột nhỏ trên mỗi mặt quay ra ngoài (ngoai(x, z));
// gờ (go) + diềm răng (rang) giữa các tầng; đỉnh thân: diềm vòm nhỏ (frieze), gờ nhô, vành răng cưa nhô ra (tới dinhRang); chóp bát giác mảnh đá phiến tới chop;
// dưới chân: gờ chân rồi con-xon thu về một mũi treo (tới mui). Bán kính thân / vành / vòng răng / chân nón: b.rThan / rVanh / rRang / rChop đo trên ảnh (quyDoiMat);
// thiếu số đo thì lấy theo mặt bằng OSM như trước. → [Mesh…]
export function datThapGoc({ THREE, mergeGeometries, v, b, mau, mauMai = '#56625f', ngoai = () => true, nhe = false }) {
  const cx = v.reduce((s, p) => s + p[0], 0) / v.length, cz = v.reduce((s, p) => s + p[1], 0) / v.length;
  const R = b.rThan ?? Math.max(...v.map((p) => Math.hypot(p[0] - cx, p[1] - cz))) * 1.12 + 0.04, AP = R * Math.cos(Math.PI / 8), CANH = 2 * R * Math.sin(Math.PI / 8);
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
  const NHO = b.rVanh ? Math.max(0.1, b.rVanh - R) : 0.45; da.push(bat(R + NHO, R + 0.05, b.dinhThan - b.frieze[0], (b.dinhThan + b.frieze[0]) / 2, true)); // gờ nhô đỡ vành
  vanh(b.dinhThan, b.dinhThan + 0.25, NHO); // mặt vành
  const hRang = b.dinhRang - b.dinhThan - 0.25, Rr = b.rRang ?? R + NHO, APr = Rr * Math.cos(Math.PI / 8), CANHr = 2 * Rr * Math.sin(Math.PI / 8);
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
  { // chóp bát giác mảnh đá phiến (trùm nón OSM tối bên trong) + nụ + thánh giá
    const h = b.chop - b.chanChop, g = cb(new THREE.ConeGeometry(b.rChop ?? R * 0.95, h, 8, 1, true)); g.translate(cx, b.chanChop + h / 2, cz);
    const q = cb(new THREE.SphereGeometry(0.16, 8, 6)); q.translate(cx, b.chop + 0.1, cz);
    const k = cb(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 5)); k.translate(cx, b.chop + 0.6, cz); const ng = cb(new THREE.BoxGeometry(0.5, 0.06, 0.06)); ng.translate(cx, b.chop + 0.85, cz);
    gop([g, q, k, ng], new THREE.MeshStandardMaterial({ color: mauMai, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide }), !nhe);
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

// CỬA MÁI + CHÓP NHỎ TRÊN MÁI (du-lieu/<lâu>-mai.json, scripts/do-mai.mjs đo trên ảnh 3D): cửa mái = thân đá sáng nhô ra theo hướng mặt mái, mặt trước có cửa sổ vòm,
// đầu hồi nhọn + mái đá phiến hai dốc; chóp = nón bát giác đá phiến + que. ds: [{ x, z, y, rong, nho, loai, huong }] → [Mesh]
export function datMai({ THREE, mergeGeometries, ds, nhe = false }) {
  const da = [], phien = [], toi = [], cb = (g) => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a); return g; };
  for (const c of ds) {
    const q = (g, x, y, z) => { g = cb(g); g.translate(x, y, z); g.rotateY(c.huong); g.translate(c.x, c.y, c.z); return g; };
    if (c.loai === 'chop') { const h = Math.max(2, Math.min(9, c.nho)), r = Math.max(0.45, Math.min(1.4, c.rong / 2)); phien.push(q(new THREE.ConeGeometry(r, h, nhe ? 6 : 8), 0, h / 2, 0), q(new THREE.CylinderGeometry(0.02, 0.04, 0.9, 4), 0, h + 0.45, 0)); continue; }
    const w = Math.max(1.2, Math.min(2.8, c.rong * 0.8)), h = Math.max(1.6, Math.min(3.4, c.nho + 0.4)), sau = 2.2, hv = h * 0.65; // thân: rộng w, cao tường hv, đầu hồi tới h
    da.push(q(new THREE.BoxGeometry(w, hv, sau), 0, hv / 2 - 0.3, sau / 2 - 0.6));
    const tg = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h - hv)]), dh = new THREE.ExtrudeGeometry(tg, { depth: sau, bevelEnabled: false }); da.push(q(dh, 0, hv - 0.3, -0.6));
    const L = Math.hypot(w / 2 + 0.15, h - hv); for (const k of [-1, 1]) { const g = new THREE.BoxGeometry(L, 0.12, sau + 0.3); g.rotateZ(k * Math.atan2(h - hv, w / 2 + 0.15) * -1); phien.push(q(g, k * (w / 4 + 0.04), hv - 0.3 + (h - hv) / 2 + 0.05, sau / 2 - 0.6)); }
    const cw = w * 0.45, ch = hv * 0.7, sh = new THREE.Shape(); sh.moveTo(-cw / 2, 0); sh.lineTo(cw / 2, 0); sh.lineTo(cw / 2, ch - cw / 2); sh.absarc(0, ch - cw / 2, cw / 2, 0, Math.PI, false); sh.lineTo(-cw / 2, 0);
    toi.push(q(new THREE.ShapeGeometry(sh, 6), 0, 0.05, sau - 0.59));
  }
  const ra = [], gop = (gs, vl) => { if (!gs.length) return; const m = new THREE.Mesh(mergeGeometries(gs), vl); m.castShadow = !nhe; m.receiveShadow = true; ra.push(m); };
  gop(da, new THREE.MeshStandardMaterial({ color: '#e9e3d6', roughness: 0.85 })); gop(phien, new THREE.MeshStandardMaterial({ color: '#4b5058', roughness: 0.6, metalness: 0.1 }));
  gop(toi, new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.5, side: THREE.DoubleSide }));
  return ra;
}
