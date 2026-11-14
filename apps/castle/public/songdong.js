// Đời sống lâu đài: đồng hồ ngày–đêm, lịch sinh hoạt từng người, đi theo phố và vào cửa, chợ, lò rèn, giếng, lính tuần đêm,
// bong bóng thoại (E), gọi rượu ở quầy, đám đông phản ứng, gà, chó, chim, khói ống khói. Tất cả sinh bằng mã.
import * as THREE from 'three';

export const VONG = { A: 15.6, B: 31.7, C: 48.6 };         // ba vành phố người đi: quảng trường · phố chính · chân tường
const DOC = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];     // bốn phố hướng tâm
const SAP = [-0.55, -0.38, -0.24, 0.24, 0.38, 0.55];       // sạp chợ phía đông, r = 33.4
const LO_REN = { a: Math.PI + 0.3, r: 33.8 }, GIENG = { a: 0, r: 13.6 };
const goc = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
const lech = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const ngau = (a, b) => a + Math.random() * (b - a);
const chon = (ds) => ds[Math.floor(Math.random() * ds.length)];

// ---------------------------------------------------------------- công trình (dựng TRƯỚC khi gộp lưới)
export function dungCongTrinh(c) {
  const { hop, tru, non, vaHop, vaTru, scene } = c;
  const ry = (a) => -a + Math.PI / 2; // trục x cục bộ dọc theo vành
  // sạp chợ: bàn + 4 cột + mái vải sọc + hàng hoá
  const vai = (m1, m2) => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? m1 : m2; g.fillRect(i * 8, 0, 8, 64); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const MAU_VAI = [['#b03a2e', '#f2e6c9'], ['#2e5fa0', '#f2e6c9'], ['#3d7a3a', '#f2e6c9'], ['#c08a2a', '#5a2a1a']];
  const HANG = [0xc0392b, 0xe6b84a, 0x8a5a2a, 0x6a8a3a, 0x5a6ab0, 0xd8d0c0];
  SAP.forEach((a, i) => {
    const [x, z] = goc(a, 33.4), r_ = ry(a);
    hop('go', 2.2, 0.85, 0.8, x, 0, z, r_); vaHop(2.2, 0.85, 0.8, x, 0, z, r_);
    for (const [dx, dz] of [[-1.05, -0.4], [1.05, -0.4], [-1.05, 0.4], [1.05, 0.4]]) { const cs = Math.cos(r_), sn = Math.sin(r_); hop('go', 0.08, 2.3, 0.08, x + dx * cs + dz * sn, 0, z - dx * sn + dz * cs, r_); }
    const mai = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.3), new THREE.MeshStandardMaterial({ map: vai(...MAU_VAI[i % 4]), side: THREE.DoubleSide, roughness: 1 }));
    mai.position.set(x, 2.35, z); mai.rotation.set(-Math.PI / 2 + 0.25, 0, 0, 'YXZ'); mai.rotation.y = r_ + Math.PI; mai.castShadow = true; scene.add(mai);
    const gs = []; for (let k = 0; k < 14; k++) { const g = Math.random() < 0.5 ? new THREE.SphereGeometry(0.07, 6, 5) : new THREE.BoxGeometry(0.16, 0.1, 0.12); const lx = ngau(-0.95, 0.95), lz = ngau(-0.3, 0.3); g.translate(x + lx * Math.cos(r_) + lz * Math.sin(r_), 0.92, z - lx * Math.sin(r_) + lz * Math.cos(r_)); gs.push(g.index ? g.toNonIndexed() : g); }
    const m = new THREE.Mesh(c.mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: HANG[i % HANG.length], roughness: 0.7 })); m.castShadow = true; scene.add(m);
  });
  // lò rèn: lán 4 cột, bếp than đỏ, đe sắt, ống khói
  const [fx, fz] = goc(LO_REN.a, LO_REN.r), fr = ry(LO_REN.a);
  const P = (lx, lz) => [fx + lx * Math.cos(fr) + lz * Math.sin(fr), fz - lx * Math.sin(fr) + lz * Math.cos(fr)];
  for (const [lx, lz] of [[-2, -1.3], [2, -1.3], [-2, 1.3], [2, 1.3]]) { const [x, z] = P(lx, lz); hop('go', 0.2, 3, 0.2, x, 0, z, fr); vaHop(0.2, 3, 0.2, x, 0, z, fr); }
  { const [x, z] = P(0, 0); hop('ngoi', 4.6, 0.2, 3.2, x, 3, z, fr); }
  const [bx, bz] = P(-1.1, 0.6); hop('da', 1.3, 0.9, 1.1, bx, 0, bz, fr); vaHop(1.3, 0.9, 1.1, bx, 0, bz, fr); hop('da', 0.6, 3, 0.6, bx, 0.9, bz, fr);
  const than = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff4a10, emissiveIntensity: 3 }));
  than.position.set(bx, 0.93, bz); than.rotation.y = fr; scene.add(than);
  const [ex, ez] = P(0.6, 0.1); const de = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.8, roughness: 0.35 }));
  de.position.set(ex, 0.72, ez); de.rotation.y = fr; de.castShadow = true; scene.add(de); tru('go', 0.2, 0.24, 0.63, ex, 0, ez, 10); vaTru(0.3, 0.8, ex, 0, ez);
  const anhLo = new THREE.PointLight(0xff5a1a, 8, 8, 1.6); anhLo.position.set(bx, 1.4, bz); scene.add(anhLo);
  // giếng: thành đá tròn, mặt nước, hai trụ + mái nón + trục quay
  const [gx, gz] = goc(GIENG.a, GIENG.r);
  tru('da', 0.95, 1.0, 0.85, gx, 0, gz, 20); vaTru(1.0, 0.85, gx, 0, gz);
  const nuoc = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), new THREE.MeshStandardMaterial({ color: 0x0a1a24, roughness: 0.05, metalness: 0.3 })); nuoc.rotation.x = -Math.PI / 2; nuoc.position.set(gx, 0.7, gz); scene.add(nuoc);
  for (const s of [-1, 1]) hop('go', 0.14, 2.1, 0.14, gx, 0, gz + s * 0.85);
  non('ngoi', 1.3, 0.9, gx, 2.1, gz, 12); hop('go', 0.1, 0.1, 1.8, gx, 1.45, gz);
  return { anhLo, than, viTriRen: P(0.6, 0.85), viTriBep: [bx, bz], gieng: [gx, gz] };
}

// ---------------------------------------------------------------- đồng hồ ngày–đêm
export function taoDongHo(L, gioDau = 17.5) {
  let gio = gioDau, nhanh = 1;
  const MAT_TROI = new THREE.Color(0xffc08a), TRANG = new THREE.Color(0x8fa0d8), tam = new THREE.Vector3();
  const DAY_SUONG = new THREE.Color(0x9a6a50), DEM_SUONG = new THREE.Color(0x30283a), DAY_TROI = new THREE.Color(0xb0a4b8), DEM_TROI = new THREE.Color(0x5a5a8a);
  const api = {
    get gio() { return gio; }, get nhanh() { return nhanh; },
    doiNhanh() { nhanh = nhanh === 1 ? 30 : 1; return nhanh; },
    datGio(g) { gio = g; },
    toi: 0,
    capNhat(dt) {
      gio = (gio + dt * nhanh / 60) % 24; // 1 giờ game = 1 phút thật
      const th = (gio - 6) / 24 * Math.PI * 2;  // 6h mọc, 18h lặn
      const cao = Math.sin(th);
      tam.set(Math.cos(th) * 0.75, cao, -0.45).normalize();
      const ngay = THREE.MathUtils.smoothstep(cao, -0.12, 0.18); api.toi = 1 - ngay;
      const huong = cao > -0.05 ? tam : tam.clone().negate();   // đêm: trăng ở phía đối diện
      L.nang.position.copy(huong).multiplyScalar(160);
      L.nang.color.copy(MAT_TROI).lerp(TRANG, api.toi);
      L.nang.intensity = cao > -0.05 ? 0.7 + 2.5 * THREE.MathUtils.smoothstep(cao, -0.05, 0.35) : 0.9; // trăng đủ sáng để thấy đường
      L.ban.intensity = 0.85 + 0.85 * ngay; L.ban.color.copy(DEM_TROI).lerp(DAY_TROI, ngay);
      L.troi.uniforms.nang.value.copy(tam); L.troi.uniforms.dem.value = api.toi;
      L.scene.fog.color.copy(DEM_SUONG).lerp(DAY_SUONG, ngay);
      const muon = gio >= 23 || gio < 5 ? 0.45 : 1; // khuya: nhà tắt bớt đèn
      L.VL.vua.emissiveIntensity = 0.15 + 2.1 * Math.pow(api.toi, 1.5) * muon;
      L.VL_DEN.emissiveIntensity = 0.2 + 4 * api.toi;
      for (const l of L.denDuong) l.intensity = 18 * api.toi;
      L.renderer.toneMappingExposure = 1.35 + 0.1 * api.toi; // 14/11: anh thấy nền tối quá (TB 56/255 lúc 13h, 32/255 đêm)
    },
    chu() { const h = Math.floor(gio), m = Math.floor((gio - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
  };
  return api;
}

// ---------------------------------------------------------------- đường đi: vành + phố hướng tâm
// Một "chỗ" = { r: bán kính vành, a: góc, cua: [x,z] | null (bước khỏi vành tới điểm này), an: ẩn khi tới (vào nhà) }
function duong(tu, den) {
  const pts = [];
  if (tu.cua) pts.push(goc(tu.a, tu.r));
  const cung = (r, a0, a1) => { const d = lech(a0, a1), n = Math.max(1, Math.ceil(Math.abs(d) * r / 2.5)); for (let i = 1; i <= n; i++) pts.push(goc(a0 + d * i / n, r)); };
  if (Math.abs(tu.r - den.r) < 0.1) cung(tu.r, tu.a, den.a);
  else {
    let tot = DOC[0], diem = 1e9;
    for (const d of DOC) { const c = Math.abs(lech(tu.a, d)) * tu.r + Math.abs(lech(d, den.a)) * den.r; if (c < diem) { diem = c; tot = d; } }
    cung(tu.r, tu.a, tot); pts.push(goc(tot, den.r)); cung(den.r, tot, den.a);
  }
  if (den.cua) pts.push(den.cua);
  return pts;
}

// ---------------------------------------------------------------- lời thoại (soạn sẵn, không gọi AI)
const LOI = {
  ban: ['Táo đỏ mới hái sáng nay, ba đồng một rổ!', 'Vải len xứ bắc đây, mùa đông tới rồi.', 'Bánh mì còn nóng, mua đi kẻo hết.', 'Muối biển, tiêu, gừng… đủ cả!', 'Mặc cả thì được, nhưng đừng quá đáng nhé.'],
  tho: ['Lò đang đỏ, đứng xa ra kẻo bỏng.', 'Lưỡi kiếm này phải tôi ba lần mới bền.', 'Móng ngựa của lính tuần mòn hết cả rồi.', 'Sắt từ mỏ dưới chân núi lửa là tốt nhất.'],
  dan: { sang: ['Chào buổi sáng! Hôm nay gió nóng thật.', 'Ra giếng lấy nước rồi còn đi chợ.', 'Nghe nói tối qua dung nham dâng cao lắm.'], chieu: ['Chợ hôm nay đông quá.', 'Cậu từ ngoài cầu vào à? Hiếm ai qua lắm.', 'Đừng đứng gần mép đảo, nóng chảy da đấy.'], toi: ['Tối rồi, ghé Quán Lửa Đỏ làm một ly không?', 'Về nhà thôi, lính tuần sắp đi gác.', 'Nhìn kìa, biển lửa đêm nay sáng thật.'] },
  linh: ['Đêm nay gió từ biển lửa thổi vào, cẩn thận.', 'Cổng thành đóng lúc nửa đêm.', 'Có thấy ai lạ mặt quanh tường thành không?', 'Đứng lại! À… người quen, đi đi.'],
  chu: ['Rượu lúa mạch hay rượu táo?', 'Hai đồng một ly, uống bao nhiêu tính bấy nhiêu.', 'Đừng để thằng say kia mượn tiền nhé.'],
  khach: ['Một ly nữa thôi!', 'Ha ha, kể tiếp đi!', 'Năm nay mùa màng tệ quá…', 'Nghe đàn hay thật.'],
  say: ['Ta… ta vẫn tỉnh mà…', 'Ai đổ rượu ra sàn thế này…', 'Hát lên nào!'],
  phucVu: ['Đợi chút, tôi mang ra ngay.', 'Bàn kia gọi thêm hai ly!'],
  dan_: ['Tôi chỉ gảy đàn kiếm vài đồng thôi.'],
  bi: ['Này!', 'Ối!', 'Ai ném đấy?!', 'Làm gì thế hả?'],
};
const loiTheo = (vai, gio) => { if (vai === 'dan') return chon(gio < 11 ? LOI.dan.sang : gio < 18 ? LOI.dan.chieu : LOI.dan.toi); if (vai === 'dan_') return chon(LOI.dan_); return chon(LOI[vai] || LOI.khach); };

// ---------------------------------------------------------------- đời sống
export function taoSongDong(c) {
  const { scene, world, RAPIER, taoNguoi, MAU_DA, MAU_AO, phan, dangKyGoc, camera, quan, quanNguoi, nhaVa, ongKhoi, ct, dongHo, R_QUAN, GOC_QUAN } = c;
  // ---- bong bóng thoại
  const bong = [];
  function noi(goc3, chu, giay = 3.5) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d'); g.font = '600 28px system-ui, sans-serif';
    const w = Math.min(560, g.measureText(chu).width + 36); cv.width = w; cv.height = 64; g.font = '600 28px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,248,236,.95)'; g.beginPath(); g.roundRect(2, 2, w - 4, 52, 14); g.fill(); g.fillStyle = '#2a1a10'; g.textBaseline = 'middle'; g.fillText(chu, 18, 29, w - 36);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(w / 160, 0.4, 1); s.renderOrder = 10; scene.add(s);
    const cu = bong.find((b) => b.goc === goc3); if (cu) cu.het = 0;
    bong.push({ s, goc: goc3, het: giay });
  }
  // ---- người dân có nhà, nghề, lịch
  const dan = [];
  const nha = nhaVa.map(([x, z, a, hang]) => { const r = hang < 22 ? VONG.A : hang < 41 ? VONG.B : VONG.C, dr = hang < 22 ? hang - 2.9 : hang < 30 ? hang + 2.9 : hang < 41 ? hang - 2.9 : hang + 2.9; return { r, a, cua: goc(a, dr), an: true }; });
  const choQuan = { r: VONG.B, a: GOC_QUAN, cua: goc(GOC_QUAN, R_QUAN - 4.9), an: true };
  // chỗ hẹn dựng MỘT lần (so sánh bằng tham chiếu — tạo mới mỗi khung thì người dân tính lại đường liên tục)
  const SAP_BAN = SAP.map((a) => ({ r: VONG.B, a, cua: goc(a, 34.3), nhin: a + Math.PI })), SAP_MUA = SAP.map((a) => ({ r: VONG.B, a, cua: goc(a, 32.5), nhin: a }));
  const choSap = (i) => SAP_BAN[i], choMua = (i) => SAP_MUA[i];
  const choGieng = { r: VONG.A, a: GIENG.a + 0.05, cua: goc(GIENG.a + 0.08, GIENG.r + 1.2), nhin: Math.PI };
  const choRen = { r: VONG.B, a: LO_REN.a, cua: ct.viTriRen, nhin: null };
  const CONG = [-1, 1].map((s) => ({ r: VONG.C, a: Math.PI / 2 + s * 0.05, cua: goc(Math.PI / 2 + s * 0.05, 50.4), nhin: -Math.PI / 2 }));
  const choCong = (s) => CONG[s < 0 ? 0 : 1];
  const VAI = ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'tho', 'linh', 'linh', ...Array(15).fill('dan')];
  VAI.forEach((vai, i) => {
    const n = taoNguoi({ da: MAU_DA[i % 5], ao: vai === 'linh' ? 0x5a5a62 : MAU_AO[(i * 7) % 8], quan: vai === 'tho' ? 0x2a1e18 : [0x3a3530, 0x4a3a28, 0x2a2a3a][i % 3], toc: [0x2b1d14, 0x6a4a2a, 0x1a1a1a, 0x8a7a6a][i % 4], mu: vai === 'linh' ? 0x707078 : i % 4 === 0 ? 0x5a3a20 : undefined, co: ngau(0.92, 1.05) });
    scene.add(n.goc);
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -80, 0)); world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), b);
    const h = nha[(i * 13) % nha.length];
    const d = { n, b, vai, nha: h, o: h, x: h.cua[0], z: h.cua[1], huong: 0, duong: [], viec: null, tg: 0, lechGio: ngau(-0.7, 0.7), sap: vai === 'ban' ? i : null, an: true, loop: null };
    if (vai === 'linh') { const duoc = new THREE.Group(); const can = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x3a2414 })); can.position.y = 0.15; const lua = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa040, emissiveIntensity: 6 })); lua.position.y = 0.48; duoc.add(can, lua); duoc.position.set(0, -0.05, 0.05); n.cam(duoc, 'tayT'); d.duoc = lua; }
    if (vai === 'tho') { const bua = new THREE.Group(); const can = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x4a3020 })); const dau = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.4 })); dau.position.y = 0.2; bua.add(can, dau); bua.position.set(0, -0.08, 0.06); bua.rotation.x = Math.PI / 2; n.cam(bua, 'tayP'); }
    dan.push(d);
  });
  // lịch: muốn ở đâu lúc mấy giờ
  function muonO(d, gio) {
    const g = (gio + d.lechGio + 24) % 24;
    if (d.vai === 'linh') return g >= 20 || g < 6 ? { tuan: true } : choCong(d === dan.find((x) => x.vai === 'linh') ? -1 : 1);
    if (g < 6 || g >= 22.5) return d.nha;
    if (d.vai === 'ban') return g < 18 ? choSap(d.sap) : (d.diQuan ?? (d.diQuan = Math.random() < 0.5)) && g < 22 ? choQuan : d.nha;
    if (d.vai === 'tho') return g < 18.5 ? choRen : d.nha;
    if (g >= 18.5) return (d.diQuan ?? (d.diQuan = Math.random() < 0.55)) ? choQuan : d.nha;
    return null; // ban ngày: đi lại tự do (giếng, chợ, quảng trường)
  }
  function diDao(d) { const k = Math.random(); if (k < 0.3) return choGieng; if (k < 0.7) return choMua(Math.floor(Math.random() * SAP.length)); return { r: VONG.A, a: Math.random() * Math.PI * 2, cua: null }; }
  const VONG_TUAN = Array.from({ length: 24 }, (_, i) => ({ r: VONG.C, a: Math.PI / 2 + i / 24 * Math.PI * 2, cua: null }));

  // ---- gà, chó, chim, khói
  const ga = [];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group(); const mau = [0xf2ead8, 0x8a4a22, 0x2a2018][i % 3];
    const than = phan('ga-than', () => new THREE.SphereGeometry(0.16, 8, 6), mau); than.scale.set(0.8, 0.8, 1.15); than.position.y = 0.26; g.add(than);
    const co = new THREE.Object3D(); co.position.set(0, 0.36, 0.14); g.add(co);
    const dau = phan('ga-dau', () => new THREE.SphereGeometry(0.075, 8, 6), mau); co.add(dau);
    const mao = phan('ga-mao', () => new THREE.BoxGeometry(0.02, 0.06, 0.07), 0xc0281e); mao.position.set(0, 0.07, 0); co.add(mao);
    const mo = phan('ga-mo', () => new THREE.ConeGeometry(0.025, 0.07, 4), 0xe0a020); mo.rotation.x = Math.PI / 2; mo.position.set(0, -0.01, 0.08); co.add(mo);
    for (const s of [-1, 1]) { const c1 = phan('ga-chan', () => new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), 0xe0a020); c1.position.set(s * 0.05, 0.08, 0); g.add(c1); }
    scene.add(g); dangKyGoc(g);
    const a = Math.random() * Math.PI * 2, r = ngau(29, 30.5);
    ga.push({ g, co, x: Math.cos(a) * r, z: Math.sin(a) * r, h: Math.random() * 6, dich: null, tg: 0, chay: 0 });
  }
  const cho = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group(), mau = [0x8a6a3a, 0x2a2420][i];
    const than = phan('cho-than', () => new THREE.CapsuleGeometry(0.13, 0.42, 3, 8), mau); than.rotation.x = Math.PI / 2; than.position.y = 0.42; g.add(than);
    const dau = new THREE.Object3D(); dau.position.set(0, 0.55, 0.32); g.add(dau);
    const so = phan('cho-dau', () => new THREE.BoxGeometry(0.17, 0.16, 0.26), mau); dau.add(so);
    for (const s of [-1, 1]) { const tai = phan('cho-tai', () => new THREE.BoxGeometry(0.05, 0.1, 0.03), mau); tai.position.set(s * 0.07, 0.11, -0.05); dau.add(tai); }
    const chan = []; for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const k = new THREE.Object3D(); k.position.set(sx * 0.08, 0.32, sz * 0.2); g.add(k); const l = phan('cho-chan', () => new THREE.CylinderGeometry(0.03, 0.03, 0.32, 5), mau); l.position.y = -0.16; k.add(l); chan.push(k); }
    const duoi = new THREE.Object3D(); duoi.position.set(0, 0.5, -0.32); g.add(duoi); const d1 = phan('cho-duoi', () => new THREE.CylinderGeometry(0.02, 0.015, 0.25, 4), mau); d1.position.y = 0.12; duoi.add(d1); duoi.rotation.x = -0.6;
    scene.add(g); dangKyGoc(g);
    cho.push({ g, dau, chan, duoi, x: 20 + i, z: 20, pha: 0, theo: null, tg: 0, huong: 0 });
  }
  // chim: bầy quạ lượn quanh tháp (vẽ hàng loạt: thân + hai cánh)
  const SO_CHIM = 26, chim = [];
  const thanChim = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.4, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x18141a }), SO_CHIM);
  const canh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.18).rotateX(-Math.PI / 2).translate(0.25, 0, 0), new THREE.MeshStandardMaterial({ color: 0x18141a, side: THREE.DoubleSide }), SO_CHIM * 2);
  thanChim.frustumCulled = canh.frustumCulled = false; scene.add(thanChim, canh);
  for (let i = 0; i < SO_CHIM; i++) chim.push({ tam: [0, 0], r: ngau(14, 40), cao: ngau(28, 46), w: ngau(0.12, 0.22) * (Math.random() < 0.5 ? 1 : -1), a: Math.random() * 6.28, pha: Math.random() * 6 });
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1);
  // khói: hạt xám bay lên từ ống khói
  const SO_KHOI = ongKhoi.length * 10, kp = new Float32Array(SO_KHOI * 3), kt = new Float32Array(SO_KHOI);
  const khoiMoi = (i) => { const o = ongKhoi[i % ongKhoi.length]; kp[i * 3] = o[0]; kp[i * 3 + 1] = o[1]; kp[i * 3 + 2] = o[2]; kt[i] = 0; };
  for (let i = 0; i < SO_KHOI; i++) { khoiMoi(i); kt[i] = Math.random(); kp[i * 3 + 1] += kt[i] * 6; }
  const gk = new THREE.BufferGeometry(); gk.setAttribute('position', new THREE.BufferAttribute(kp, 3));
  const khoiTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(180,170,165,.55)'); gr.addColorStop(1, 'rgba(180,170,165,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  scene.add(new THREE.Points(gk, new THREE.PointsMaterial({ map: khoiTex, size: 2.2, transparent: true, depthWrite: false, opacity: 0.55, color: 0x9a908a })));
  // tia lửa lò rèn
  const SO_TIA = 40, tp = new Float32Array(SO_TIA * 3), tv = new Float32Array(SO_TIA * 3), tl = new Float32Array(SO_TIA).fill(9);
  const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  scene.add(new THREE.Points(gt, new THREE.PointsMaterial({ map: c.chamLua, size: 0.12, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const banTia = (x, y, z) => { for (let i = 0, n = 0; i < SO_TIA && n < 10; i++) if (tl[i] > 0.8) { tp[i * 3] = x; tp[i * 3 + 1] = y; tp[i * 3 + 2] = z; tv[i * 3] = ngau(-2, 2); tv[i * 3 + 1] = ngau(1, 3.5); tv[i * 3 + 2] = ngau(-2, 2); tl[i] = 0; n++; } };

  let uongDen = 0;
  const api = {
    dan, noi,
    // E: nói chuyện với người gần nhất trước mặt / gọi rượu ở quầy
    noiChuyen(p, huong, am) {
      const f = [Math.sin(huong), Math.cos(huong)];
      let tot = null, kc = 2.6;
      const ds = [...dan.filter((d) => !d.an).map((d) => ({ n: d.n, x: d.x, z: d.z, vai: d.vai, d })), ...quanNguoi.ds.map((d) => ({ n: d.n, x: d.x, z: d.z, vai: d.vai === 'dan' ? 'dan_' : d.vai, q: d }))];
      for (const o of ds) { const dx = o.x - p.x, dz = o.z - p.z, l = Math.hypot(dx, dz); if (l < kc && (dx * f[0] + dz * f[1]) / (l || 1) > 0.3) { kc = l; tot = o; } }
      if (!tot) return null;
      if (tot.vai === 'chu' && quan.trong(p.x, p.z)) { noi(tot.n.goc, 'Rượu đây, hai đồng. Uống từ từ thôi!'); uongDen = performance.now() + 9000; return 'uong'; }
      noi(tot.n.goc, loiTheo(tot.vai, dongHo.gio));
      const nhin = Math.atan2(p.x - tot.x, p.z - tot.z);
      if (tot.d) { tot.d.dungNhin = { h: nhin, het: 3 }; if (!tot.n.viec) tot.n.lam('chao'); } else if (tot.q) tot.q.huongDich = nhin;
      return tot.vai;
    },
    dangUong: () => performance.now() < uongDen,
    biDa(x, z) { for (const d of dan) if (!d.an && Math.hypot(d.x - x, d.z - z) < 1.1) { d.n.lam('nga'); noi(d.n.goc, chon(LOI.bi)); } },
    capNhat(dt, ctx) {
      const { p, diBo } = ctx, gio = dongHo.gio, toi = dongHo.toi;
      // người dân theo lịch
      const dtm = dt * (ctx.nhanh || 1); // tua nhanh giờ thì việc đi lại tua theo (tay chân vẫn nhịp thường)
      for (const d of dan) {
        d.tg -= dtm; let v = 0;
        let muon = muonO(d, gio);
        if (muon && muon.tuan) { if (!d.duong.length) { const i = Math.floor(Math.random() * 24); d.duong = duong(d.o, VONG_TUAN[i]); d.o = VONG_TUAN[i]; d.lam = null; d.an = false; } d.dich = null; muon = d.o; }
        else if (muon && muon !== d.dich) { d.duong = duong(d.o, muon); d.dich = muon; d.o = muon; d.lam = null; if (d.an) d.an = false; }
        else if (!muon && !d.duong.length && d.tg <= 0) { const m = diDao(d); d.duong = duong(d.o, m); d.o = m; d.dich = null; d.lam = null; if (d.an) d.an = false; }
        if (d.n.viec === 'nga') { /* nằm */ }
        else if (d.duong.length) {
          const [tx, tz] = d.duong[0], dx = tx - d.x, dz = tz - d.z, l = Math.hypot(dx, dz);
          const chan = diBo && Math.hypot(p.x - (d.x + dx / (l || 1) * 0.9), p.z - (d.z + dz / (l || 1) * 0.9)) < 0.7; // người chơi chắn đường → đứng chờ
          if (l < 0.15) { d.duong.shift(); if (!d.duong.length) { d.tg = muon ? ngau(0, 40) : ngau(8, 25); /* xong việc theo lịch: hết giờ lịch thì ra đi dạo lệch nhau, không đồng loạt */ if (d.o.an) d.an = true; d.lam = d.o; } }
          else if (!chan) { const s = Math.min(l, (d.vai === 'linh' && muon === d.o && toi > 0.5 ? 1.0 : 1.3) * dtm); d.x += dx / l * s; d.z += dz / l * s; v = 1.3; d.huongDich = Math.atan2(dx, dz); }
        }
        // việc tại chỗ
        d.loop = null;
        if (!d.duong.length && d.lam) {
          if (d.lam.nhin != null) d.huongDich = d.lam.nhin;
          if (d.vai === 'ban') d.loop = 'noi';
          else if (d.vai === 'tho' && d.dich === choRen) { d.loop = 'ren'; d.huongDich = Math.atan2(ct.viTriRen[0] - ct.viTriBep[0], ct.viTriRen[1] - ct.viTriBep[1]) + Math.PI; const nh = (performance.now() / 1000 * 1.4 + d.lechGio) % 1; if (nh < d.nhCu) { const [ax, az] = goc(LO_REN.a, LO_REN.r); const e = ct.viTriRen; banTia(e[0] * 0.6 + ax * 0.4, 0.85, e[1] * 0.6 + az * 0.4); ctx.am?.tieng('ren', e[0], 1, e[1]); } d.nhCu = nh; }
          else if (d.lam === choGieng) d.loop = 'keo';
          else if (d.lam.cua) d.loop = 'noi';
        }
        if (d.dungNhin) { d.huongDich = d.dungNhin.h; d.dungNhin.het -= dt; if (d.dungNhin.het <= 0) d.dungNhin = null; }
        if (d.huongDich != null) d.huong += lech(d.huong, d.huongDich) * (1 - Math.exp(-dt * 7));
        d.n.goc.visible = !d.an;
        if (d.duoc) d.duoc.visible = toi > 0.35;
        d.n.goc.position.set(d.x, 0.02, d.z); d.n.goc.rotation.y = d.huong;
        d.b.setNextKinematicTranslation(d.an ? { x: d.x, y: -80, z: d.z } : { x: d.x, y: 0.85, z: d.z });
        d.n.capNhat(dt, { toc: v, nen: true, loop: d.loop });
        // trúng đá
        for (const s of ctx.soi) { const t = s.translation(), lv = s.linvel(); if (!d.an && Math.hypot(lv.x, lv.y, lv.z) > 4 && Math.hypot(t.x - d.x, t.z - d.z) < 0.55 && t.y < 2 && t.y > 0) { if (d.n.lam('nga')) noi(d.n.goc, chon(LOI.bi)); } }
      }
      // đá bay vào quán → cả quán quay ra nhìn, chủ quán quát
      for (const s of ctx.soi) { const t = s.translation(), lv = s.linvel(); if (Math.hypot(lv.x, lv.y, lv.z) > 3 && quan.trong(t.x, t.z) && t.y < 4 && !s.__daQuat) { s.__daQuat = true; for (const q of quanNguoi.ds) q.huongDich = Math.atan2(t.x - q.x, t.z - q.z), q.tg = Math.max(q.tg, 2.5); const chu = quanNguoi.ds.find((q) => q.vai === 'chu'); if (chu) noi(chu.n.goc, 'Ai ném đá vào quán ta đấy?!'); } if (Math.hypot(lv.x, lv.y, lv.z) < 1) s.__daQuat = false; }
      // gà: mổ thóc, chạy khi người chơi lại gần
      const tt = performance.now() / 1000;
      for (const g of ga) {
        g.tg -= dt; let v = 0;
        const kc = Math.hypot(p.x - g.x, p.z - g.z);
        if (diBo && kc < 2.8) { const a = Math.atan2(g.x - p.x, g.z - p.z); g.dich = [g.x + Math.sin(a) * 4, g.z + Math.cos(a) * 4]; g.chay = 1.2; if (Math.random() < dt * 3) ctx.am?.tieng('ga', g.x, 0.4, g.z); }
        else if (!g.dich && g.tg <= 0) { const a = Math.atan2(g.z, g.x) + ngau(-0.15, 0.15), r = ngau(29, 30.5); g.dich = [Math.cos(a) * r, Math.sin(a) * r]; g.tg = ngau(3, 9); }
        if (g.dich) { const dx = g.dich[0] - g.x, dz = g.dich[1] - g.z, l = Math.hypot(dx, dz); if (l < 0.2) g.dich = null; else { v = g.chay > 0 ? 3.2 : 0.7; g.x += dx / l * v * dt; g.z += dz / l * v * dt; g.g.rotation.y = Math.atan2(dx, dz); } }
        g.chay -= dt;
        const r = Math.hypot(g.x, g.z); if (r < 28.9 || r > 30.6) { const k = THREE.MathUtils.clamp(r, 28.9, 30.6) / r; g.x *= k; g.z *= k; g.dich = null; } // gà ở mép trong phố chính, không lạc vào nhà
        g.g.position.set(g.x, v > 0 ? Math.abs(Math.sin(tt * 18 + g.h)) * 0.05 : 0, g.z);
        g.co.rotation.x = v > 0 ? 0 : Math.max(0, Math.sin(tt * 3 + g.h)) * 1.1; // mổ
      }
      // chó: đi theo người chơi khi gần, không thì theo một người dân
      for (const k of cho) {
        k.tg -= dt;
        if (!k.theo || k.tg <= 0 || k.theo.an) { k.theo = diBo && Math.hypot(p.x - k.x, p.z - k.z) < 12 && Math.random() < 0.5 ? 'nguoiChoi' : chon(dan.filter((d) => !d.an)) || null; k.tg = ngau(10, 25); }
        const dich = k.theo === 'nguoiChoi' ? p : k.theo; let v = 0;
        if (dich) { const dx = dich.x - k.x, dz = dich.z - k.z, l = Math.hypot(dx, dz); if (l > 1.6) { v = Math.min(l - 1.5, 4) > 2 ? 3.5 : 1.4; k.x += dx / l * v * dt; k.z += dz / l * v * dt; k.huong += lech(k.huong, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 6)); } }
        k.pha += dt * v * 4;
        k.chan.forEach((c1, i) => { c1.rotation.x = v ? Math.sin(k.pha + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 : 0; });
        k.duoi.rotation.z = Math.sin(tt * (v ? 10 : 5)) * 0.5; k.dau.rotation.x = v ? 0 : Math.sin(tt * 0.7) * 0.15;
        k.g.position.set(k.x, 0, k.z); k.g.rotation.y = k.huong;
        if (Math.random() < dt * 0.04) ctx.am?.tieng('cho', k.x, 0.5, k.z);
      }
      // chim
      for (let i = 0; i < SO_CHIM; i++) {
        const b = chim[i]; b.a += b.w * dt; b.pha += dt * 9;
        const x = Math.cos(b.a) * b.r, z = Math.sin(b.a) * b.r, y = b.cao + Math.sin(b.a * 3) * 2;
        e4.set(0, Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w)), -Math.sign(b.w) * 0.35); q4.setFromEuler(e4);
        m4.compose(v4.set(x, y, z), q4, s4); thanChim.setMatrixAt(i, m4);
        const vo = Math.sin(b.pha) * 0.7;
        for (const s of [-1, 1]) { const qq = q4.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s < 0 ? Math.PI : 0, vo))); m4.compose(v4, qq, s4); canh.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4); }
      }
      thanChim.instanceMatrix.needsUpdate = canh.instanceMatrix.needsUpdate = true;
      // khói
      for (let i = 0; i < SO_KHOI; i++) { kt[i] += dt * 0.12; kp[i * 3 + 1] += dt * 0.9; kp[i * 3] += dt * 0.5; kp[i * 3 + 2] += dt * 0.2 * Math.sin(tt + i); if (kt[i] > 1) khoiMoi(i); }
      gk.attributes.position.needsUpdate = true;
      // tia lửa + than lò rèn chập chờn
      for (let i = 0; i < SO_TIA; i++) { if (tl[i] > 0.8) { tp[i * 3 + 1] = -50; continue; } tl[i] += dt; tv[i * 3 + 1] -= 9.8 * dt; tp[i * 3] += tv[i * 3] * dt; tp[i * 3 + 1] += tv[i * 3 + 1] * dt; tp[i * 3 + 2] += tv[i * 3 + 2] * dt; }
      gt.attributes.position.needsUpdate = true;
      ct.anhLo.intensity = 7 + Math.sin(tt * 9) * 1.5 + Math.random();
      // bong bóng thoại bám đầu người nói
      for (let i = bong.length - 1; i >= 0; i--) { const b = bong[i]; b.het -= dt; b.goc.getWorldPosition(b.s.position); b.s.position.y += 2.25; if (b.het <= 0 || !b.goc.visible) { scene.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); bong.splice(i, 1); } }
    },
  };
  return api;
}
