// tra-repo-ok: bộ hoa văn kiến trúc nội bộ dựng trên THREE — mã dán keo giữa số đo ảnh (du-lieu/<lâu>-mat-*.json) và hình khối; không thư viện ngoài nào làm phào / vòm cuốn theo số đo riêng
// BỘ HOA VĂN DÙNG CHUNG cho MỌI mặt dựng theo ảnh (mattien.js: nhomCua, datMatTien, datMatPalas, datMatRieng, datThapGoc) — anh 21/11/2026 "chuẩn hoá luôn, không chắp vá":
// trước đây mỗi hàm tự đặt hộp / vòng xuyến trơn cho gờ, vòm, con-xon → nhìn từ sân là mất, và mỗi mặt sửa một kiểu. Nay mọi chi tiết nổi đi qua đây, cùng mặt cắt, cùng bóng vẽ sẵn.
// Toạ độ CỤC BỘ của mặt: x sang PHẢI người đứng ngoài nhìn vào, y lên, z ra ngoài tường (mặt tường z = 0). Ánh sáng ảnh chụp từ trên-trái → bóng đậm ở mép dưới + phải.
// Mỗi hàm đẩy hình vào giỏ B = xo() = { da: đá thân, vien: gờ / phào / vòm (nơi gọi chọn vật liệu, vd sa thạch), toi: lòng tối, bong: bóng vẽ sẵn }.
// Hình trong giỏ: không chỉ số, chỉ position + normal (giỏ bong thêm color RGBA) → gộp ngay bằng mergeGeometries; bóng: vlBong (máy không đổ bóng chi tiết nhỏ — bóng vẽ sẵn, gộp một lưới).
// nhe (điện thoại): ít cạnh hơn, bỏ vát, vòm ít viên — giữ dáng, bớt tam giác.

export const vlBong = (THREE) => new THREE.MeshBasicMaterial({ color: '#000000', vertexColors: true, transparent: true, depthWrite: false });

export function boHoaVan(THREE, { nhe = false } = {}) {
  const PI = Math.PI, V2 = (x, y) => new THREE.Vector2(x, y);
  const cb = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };
  const xo = () => ({ da: [], vien: [], toi: [], bong: [] });
  const dat = (B, ten, g, x = 0, y = 0, z = 0) => { g = cb(g); g.translate(x, y, z); B[ten].push(g); return g; };
  const toMau = (g, al) => { const p = g.attributes.position, n = p.count, c = new Float32Array(n * 4); for (let i = 0; i < n; i++) c[i * 4 + 3] = al(p.getX(i), p.getY(i), p.getZ(i)); g.setAttribute('color', new THREE.BufferAttribute(c, 4)); return g; };
  // đùn một hình phẳng ra ngoài nho mét (mặt sau nằm trên tường z = 0), vát cạnh nhỏ để mép bắt sáng khác mặt
  const dun = (sh, nho, vat = !nhe, cong = nhe ? 4 : 8) => { const bt = vat ? Math.min(0.015, nho * 0.2) : 0;
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.005, nho - 2 * bt), bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: 1, curveSegments: cong }); g.translate(0, 0, bt); return g; };
  // mặt cắt (zRa, y) đùn dọc x, bề ngang rong, tâm x = 0
  const dunNgang = (diem, rong) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(diem.map(([a, b]) => V2(a, b))), { depth: rong, bevelEnabled: false }); g.rotateY(-PI / 2); g.translate(rong / 2, 0, 0); return g; };

  // VIỀN BÓNG ngoài mép một hình nổi: dải rộng w chạy theo đường viền, đậm sát mép → trong suốt ra ngoài; đậm hơn ở mép dưới + phải; bỏ cạnh nằm trên yBo (chân đứng trên gờ)
  const vienBong = (sh, { yBo = null, w = 0.13, dam = 0.55 } = {}) => {
    const p = sh.getPoints(nhe ? 4 : 8); if (p.length > 2 && p[0].distanceTo(p[p.length - 1]) < 1e-4) p.pop();
    let dt = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; dt += (b.x - a.x) * (b.y + a.y); } const chieu = dt > 0 ? 1 : -1; // > 0: theo kim đồng hồ
    const n = p.length, ph = p.map((a, i) => { const t = p[(i + n - 1) % n], s = p[(i + 1) % n]; const n1 = V2(-(a.y - t.y), a.x - t.x).normalize(), n2 = V2(-(s.y - a.y), s.x - a.x).normalize();
      const m = n1.clone().add(n2); const l = m.length(); if (l < 1e-6) return n1.multiplyScalar(chieu); m.divideScalar(l); return m.multiplyScalar(chieu / Math.max(0.5, m.dot(n1))); });
    const vt = [], cl = [], hs = (q) => dam * (0.55 + 0.45 * Math.max(0, q.x * 0.45 - q.y * 0.9));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = p[i], b = p[j]; if (yBo != null && Math.abs(a.y - yBo) < 1e-3 && Math.abs(b.y - yBo) < 1e-3) continue;
      const ao = a.clone().addScaledVector(ph[i], w), bo = b.clone().addScaledVector(ph[j], w), da = hs(ph[i]), db = hs(ph[j]);
      for (const [q, al] of [[a, da], [b, db], [bo, 0], [a, da], [bo, 0], [ao, 0]]) { vt.push(q.x, q.y, 0); cl.push(0, 0, 0, al); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vt, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(vt.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4)); return g; };
  // DẢI BÓNG dưới một gờ: tấm rong × cao, mép trên (y = 0) đậm dam → mép dưới trong suốt
  const daiBong = (rong, cao, dam = 0.6) => { const g = cb(new THREE.PlaneGeometry(rong, cao)); g.translate(0, -cao / 2, 0); return toMau(g, (x, y) => dam * (1 + y / cao)); };

  // PHÀO NGANG (gờ chia tầng, bậu, gờ mái): mặt trên dốc thoát nước, mặt đứng, rãnh lõm (cove) về tường; y = tâm gờ. Kèm dải bóng dưới.
  const MC_PHAO = nhe ? [[0, 0.5], [1, 0.4], [1, 0], [0.3, -0.5], [0, -0.5]]
    : [[0, 0.5], [0.92, 0.42], [1, 0.36], [1, 0.08], [0.86, 0.02], [0.55, -0.06], [0.38, -0.18], [0.29, -0.33], [0.26, -0.5], [0, -0.5]];
  function phao(B, { rong, cao, nho, x = 0, y = 0, z = 0, ten = 'vien', bong = true }) {
    if (!(rong > 0.02 && cao > 0.01 && nho > 0.01)) return;
    dat(B, ten, dunNgang(MC_PHAO.map(([a, b]) => [a * nho, b * cao]), rong), x, y, z);
    if (bong) dat(B, 'bong', daiBong(rong, Math.min(0.45, cao * 2)), x, y - cao / 2, z + 0.012);
  }
  // PHÀO VÒNG quanh thân tháp đa giác (canh cạnh, bán kính đỉnh r = thân): cùng mặt cắt, xoay quanh trục; dải bóng ôm thân dưới gờ
  function phaoVong(B, { r, cao, nho, y = 0, cx = 0, cz = 0, canh = 8, ten = 'vien', bong = true }) {
    if (!(cao > 0.01 && nho > 0.01)) return;
    const diem = MC_PHAO.map(([a, b]) => V2(r + a * nho, b * cao)).reverse(); // dưới → trên: pháp tuyến ra ngoài
    dat(B, ten, new THREE.LatheGeometry(diem, canh), cx, y, cz);
    if (bong) { const hb = Math.min(0.5, cao * 2), g = cb(new THREE.CylinderGeometry(r + 0.015, r + 0.015, hb, canh, 1, true)); toMau(g, (_, yy) => 0.5 * (yy + hb / 2) / hb); dat(B, 'bong', g, cx, y - cao / 2 - hb / 2, cz); }
  }
  // GỜ BẬC VÒNG (gờ đỡ vành răng cưa tháp): n lăng trụ ĐỨNG nhô dần từ r0 tới r0 + nho trên chiều cao cao, chân ở y0, mặt dưới mỗi bậc nằm ngang
  // + dải bóng chuyển dưới mỗi bậc (ảnh: gờ dày nhiều lớp, đáy từng lớp tối); phào cong nhô xa trên chiều cao thấp nhìn từ dưới lên thành vạt nghiêng như mái
  function bacVong(B, { r0, nho, cao, y0 = 0, n = 3, cx = 0, cz = 0, canh = 8, ten = 'vien', bong = true }) {
    if (!(cao > 0.03 && nho > 0.01)) return;
    for (let k = 0; k < n; k++) { const r = r0 + nho * (k + 1) / n, h = cao / n, yb = y0 + h * k;
      dat(B, ten, new THREE.CylinderGeometry(r, r, h, canh, 1, false), cx, yb + h / 2, cz);
      if (bong) { const hb = Math.min(0.3, h * 1.2), rb = k ? r0 + nho * k / n + 0.012 : r0 + 0.012, g = cb(new THREE.CylinderGeometry(rb, rb, hb, canh, 1, true)); toMau(g, (_, yy) => 0.55 * (yy + hb / 2) / hb); dat(B, 'bong', g, cx, yb - hb / 2, cz); } }
  }
  // VÒM CUỐN bán nguyệt: R = mép trong, day = bề dày vành, n viên đá hình nêm có khe (n = 1: vành liền có vát — vòm nhỏ từng ô), khoa = viên đỉnh nhô cao hơn;
  // cao > 0: hai má thẳng từ chân vòm xuống cao mét + đá đỡ chân vòm. Gốc (x, y) = tâm vòm (đường chân vòm).
  function vomCuon(B, { R, day, nho, n = 9, khoa = n > 2, cao = 0, x = 0, y = 0, z = 0, ten = 'vien', bong = true }) {
    if (!(R > 0.02 && day > 0.01 && nho > 0.01)) return;
    const nn = nhe && n > 3 ? Math.max(3, Math.round(n / 2) | 1) : n, k = nn === 1 ? (nhe ? 6 : 14) : (nhe ? 2 : 3), khe = nn > 1 ? Math.min(0.02, day * 0.08) / R : 0;
    for (let i = 0; i < nn; i++) {
      const s = PI * i / nn + khe / 2, e = PI * (i + 1) / nn - khe / 2, ro = khoa && nn % 2 && i === (nn - 1) / 2 ? R + day * 1.22 : R + day, sh = new THREE.Shape();
      sh.moveTo(Math.cos(s) * R, Math.sin(s) * R); for (let j = 1; j <= k; j++) { const a = s + (e - s) * j / k; sh.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
      for (let j = k; j >= 0; j--) { const a = s + (e - s) * j / k; sh.lineTo(Math.cos(a) * ro, Math.sin(a) * ro); }
      dat(B, ten, dun(sh, nho, !nhe && nn > 1), x, y, z);
    }
    const Ro = R + day;
    if (cao > 0) for (const sx of [-1, 1]) { dat(B, ten, new THREE.BoxGeometry(day, cao, nho), x + sx * (R + day / 2), y - cao / 2, z + nho / 2);
      const hd = Math.min(0.14, day * 0.5); dat(B, ten, new THREE.BoxGeometry(day + 0.1, hd, nho + 0.05), x + sx * (R + day / 2), y - hd / 2, z + (nho + 0.05) / 2); }
    if (bong) { const c = Math.max(0, cao), sh = new THREE.Shape(); sh.moveTo(-Ro, -c); sh.lineTo(-Ro, 0); sh.absarc(0, 0, Ro, PI, 0, true); sh.lineTo(Ro, -c); sh.lineTo(R, -c); sh.lineTo(R, 0); sh.absarc(0, 0, R, 0, PI, false); sh.lineTo(-R, -c);
      dat(B, 'bong', vienBong(sh, { yBo: -c, w: Math.min(0.13, day * 0.7 + 0.04) }), x, y, z + 0.012); }
  }
  // VÀNH TRÒN (cửa sổ tròn, ô tròn, mặt đồng hồ): tâm (x, y), mép giữa r, bề dày day
  function vongTron(B, { r, day, nho, x = 0, y = 0, z = 0, ten = 'vien', bong = true }) {
    if (!(r > day / 2 && nho > 0.005)) return;
    const c = nhe ? 10 : 20, ngoai = new THREE.Shape(); ngoai.absarc(0, 0, r + day / 2, 0, 2 * PI, false);
    const sh = new THREE.Shape(); sh.absarc(0, 0, r + day / 2, 0, 2 * PI, false); const lo = new THREE.Path(); lo.absarc(0, 0, r - day / 2, 0, 2 * PI, true); sh.holes.push(lo);
    dat(B, ten, dun(sh, nho, !nhe, c), x, y, z);
    if (bong) dat(B, 'bong', vienBong(ngoai, { w: Math.min(0.12, day * 0.6 + 0.03) }), x, y, z + 0.012);
  }
  // DIỀM VÒM NHỎ (cung Lombard): dải đá cao H dài L, mép trên y = 0, n vòm nhỏ khoét từ dưới lên, mấu rủ giữa các vòm; viền bóng dưới vòm + mấu
  function dieuVom(B, { L, H, n, nho, day = Math.min(0.12, H * 0.3), x = 0, y = 0, z = 0, ten = 'vien', bong = true }) {
    if (!(L > 0.1 && H > 0.05 && n >= 1)) return;
    const buoc = L / n, r = Math.min(buoc * 0.38, (H - day) * 0.9), yS = -day - r, sh = new THREE.Shape();
    sh.moveTo(-L / 2, 0); sh.lineTo(-L / 2, -H);
    for (let i = 0; i < n; i++) { const cx = -L / 2 + (i + 0.5) * buoc; sh.lineTo(cx - r, -H); sh.lineTo(cx - r, yS); sh.absarc(cx, yS, r, PI, 0, true); sh.lineTo(cx + r, -H); }
    sh.lineTo(L / 2, -H); sh.lineTo(L / 2, 0); sh.lineTo(-L / 2, 0);
    dat(B, ten, dun(sh, nho, !nhe, nhe ? 4 : 6), x, y, z);
    if (bong) dat(B, 'bong', vienBong(sh, { yBo: 0, w: Math.min(0.1, H * 0.3) }), x, y, z + 0.012);
    // lòng vòm: ô trống dưới mỗi vòm là mặt tường lùi vào → tối dần lên đỉnh vòm (ảnh: vòm đọc được nhờ lòng tối, không nhờ viền); trước đây ô trống cùng màu tường nên dải vòm gần như mất
    if (bong) for (let i = 0; i < n; i++) { const cx = -L / 2 + (i + 0.5) * buoc, o = new THREE.Shape(); o.moveTo(cx - r, -H); o.lineTo(cx - r, yS); o.absarc(cx, yS, r, PI, 0, true); o.lineTo(cx + r, -H); o.lineTo(cx - r, -H);
      const g = cb(new THREE.ShapeGeometry(o, nhe ? 4 : 8)); toMau(g, (_, yy) => 0.18 + 0.4 * (yy + H) / (yS + r + H)); dat(B, 'bong', g, x, y, z + 0.006); }
  }
  // CON-XON (đá đỡ ban công / vành tháp): mặt cắt chữ S (ogee) — đỉnh nhô nho ở y = 0, thu về 0,3·nho ở chân (y = −cao); bóng đổ xuống tường bên phải-dưới
  const MC_CX = nhe ? [[0, 0], [1, 0], [1, -0.15], [0.45, -0.7], [0.3, -1], [0, -1]]
    : [[0, 0], [1, 0], [1, -0.12], [0.9, -0.3], [0.66, -0.48], [0.45, -0.64], [0.34, -0.8], [0.3, -0.92], [0.3, -1], [0, -1]];
  function conXon(B, { rong, cao, nho, x = 0, y = 0, z = 0, ten = 'vien', bong = true }) {
    if (!(rong > 0.02 && cao > 0.02 && nho > 0.02)) return;
    dat(B, ten, dunNgang(MC_CX.map(([a, b]) => [a * nho, b * cao]), rong), x, y, z);
    if (bong) dat(B, 'bong', daiBong(rong * 1.1, cao * 0.85 + 0.15, 0.5), x + Math.min(0.15, nho * 0.2), y - cao * 0.3, z + 0.012);
  }
  // KHUNG Ô LÕM (ô lan can, khung ô tường): khung đá bề rộng vien quanh ô w × h, tâm (x, y); bóng ngoài khung + bóng trong lòng ô ở mép trên + trái (khung che nắng)
  function khungLom(B, { w, h, vien, nho, x = 0, y = 0, z = 0, ten = 'vien', bong = true }) {
    if (!(w > 2 * vien + 0.02 && h > 2 * vien + 0.02)) return;
    const hcn = (a, b) => [V2(-a / 2, -b / 2), V2(a / 2, -b / 2), V2(a / 2, b / 2), V2(-a / 2, b / 2)];
    const sh = new THREE.Shape(hcn(w, h)); sh.holes.push(new THREE.Path(hcn(w - 2 * vien, h - 2 * vien).reverse()));
    dat(B, ten, dun(sh, nho, !nhe), x, y, z);
    if (!bong) return;
    dat(B, 'bong', vienBong(new THREE.Shape(hcn(w, h)), { w: Math.min(0.08, nho + 0.04), dam: 0.45 }), x, y, z + 0.012);
    const wi = w - 2 * vien, hi = h - 2 * vien, s = Math.min(0.12, nho * 2 + 0.03, hi * 0.4, wi * 0.4);
    const tren = cb(new THREE.PlaneGeometry(wi, s)); toMau(tren, (_, yy) => (yy > 0 ? 0.5 : 0)); dat(B, 'bong', tren, x, y + hi / 2 - s / 2, z + 0.012);
    const trai = cb(new THREE.PlaneGeometry(s, hi - s)); toMau(trai, (xx) => (xx < 0 ? 0.4 : 0)); dat(B, 'bong', trai, x - wi / 2 + s / 2, y - s / 2, z + 0.012);
  }
  return { xo, dat, cb, vienBong, daiBong, phao, phaoVong, bacVong, vomCuon, vongTron, dieuVom, conXon, khungLom };
}
