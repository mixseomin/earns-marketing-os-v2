// NỘI THẤT Palas Neuschwanstein (tầng ba theo mặt bằng Commons CC BY 3.0 + Phòng hát tầng bốn theo vùng đỏ của bản vẽ):
// toạ độ bản vẽ (px) → mô hình (m) bằng phép biến đổi affine qua 3 mốc (du-lieu/neuschwanstein-noi-that.json).
// Dựng: sàn tầng ba (theo viền Palas, chừa lỗ tháp cầu thang) · sàn tầng bốn / trần · tường phòng có ô cửa · cầu thang xoắn trong tháp
// từ cửa vào dưới đất lên tầng ba và tầng bốn · đồ đạc từng phòng (phỏng dựng) · đèn chùm. Va chạm: tường, sàn, bậc thang, đồ lớn.
// Gộp theo vật liệu (màu theo đỉnh) → ~6 lệnh vẽ; cả nhóm chỉ hiện khi người chơi ở gần Palas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

function giaiAffine(moc) { // [x,z] = [a*px + b*py + c, d*px + e*py + f] qua 3 điểm
  const [[p1, w1], [p2, w2], [p3, w3]] = moc;
  const M = [[p1[0], p1[1], 1], [p2[0], p2[1], 1], [p3[0], p3[1], 1]];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), giai = (v) => [0, 1, 2].map((c) => det(M.map((r, i) => r.map((x, j) => (j === c ? v[i] : x)))) / D);
  const [a, b, c] = giai([w1[0], w2[0], w3[0]]), [d, e, f] = giai([w1[1], w2[1], w3[1]]);
  return { ra: (px, py) => [a * px + b * py + c, d * px + e * py + f], ex: new THREE.Vector3(a, 0, d), ey: new THREE.Vector3(b, 0, e) };
}

export function dungNoiThat({ RAPIER, world, tinh, scene, NT, yDay, vienPalas, thapV, yCua, vanSan, vanTran, DO = null, TRANH = {} }) {
  const A = giaiAffine(NT.moc), s = A.ex.length(), ux = A.ex.clone().normalize(), uy = A.ey.clone().normalize();
  const goc = Math.atan2(ux.z, ux.x), quayY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -goc);
  const y3 = yDay + NT.tang3, y4 = y3 + NT.caoTang3 + 0.35;
  const nhom = new THREE.Group(); nhom.visible = false; scene.add(nhom);
  const kho = { mau: [], vang: [], sang: [] }, C = new THREE.Color();
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  // điểm bản vẽ + lệch (mét theo trục phòng) → thế giới
  const W = (px, py, dx = 0, dz = 0) => { const [x, z] = A.ra(px, py); return new THREE.Vector3(x + ux.x * dx + uy.x * dz, 0, z + ux.z * dx + uy.z * dz); };
  // một khối: g (hình tâm ở gốc) đặt tại điểm bản vẽ, xoay theo trục phòng (+ xoay thêm), màu theo đỉnh; va = có va chạm (hộp)
  function dat(g, px, py, y, mau, { kho: k = 'mau', xoay = 0, va = null, dx = 0, dz = 0 } = {}) {
    const p = W(px, py, dx, dz); p.y = y;
    const q = quayY.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), xoay));
    g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(_m.compose(p, q, _s));
    C.set(mau); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([C.r, C.g, C.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(a)) g.deleteAttribute(a);
    kho[k].push(g);
    if (va) world.createCollider(RAPIER.ColliderDesc.cuboid(va[0] / 2, va[1] / 2, va[2] / 2).setTranslation(p.x, p.y, p.z).setRotation(q), tinh);
  }
  const hop = (px, py, w, h, d, y, mau, o = {}) => dat(new THREE.BoxGeometry(w, h, d), px, py, y + h / 2, mau, { ...o, va: o.va === false ? null : (o.va ?? [w, h, d]) }); // y = mặt dưới
  const tru = (px, py, r, h, y, mau, o = {}) => dat(new THREE.CylinderGeometry(r, r, h, o.seg || 12), px, py, y + h / 2, mau, { ...o, va: o.va ? [r * 2, h, r * 2] : null });

  // ---- đèn (chỉ bật khi nhóm hiện)
  const den = [];
  const denDiem = (px, py, y, mau, cuong, xa, batTat = false) => { const l = new THREE.PointLight(mau, cuong, xa, 1.6); const p = W(px, py); l.position.set(p.x, y, p.z); nhom.add(l); den.push(l); if (batTat) tuongTac.push({ loai: 'den', ten: 'den', den: l, o: { position: new THREE.Vector3(p.x, yS0(y), p.z) } }); };
  const yS0 = (y) => (y > y4 ? y4 : y3) + 1; // điểm bấm công tắc đèn: ngang tầm người ở tầng của đèn
  // ---- ĐỒ ĐẠC CÓ HÌNH THẬT (KayKit Dungeon Remastered, CC0) + TRANH THẬT (photochrom ~1900, phạm vi công cộng) + TƯƠNG TÁC
  // loai: 'tinh' (gộp một lưới, không va chạm) · 'tinhVa' (gộp + hộp va chạm) · 'rieng' (lưới riêng: rương mở nắp…) · 'dong' (vật lý: đẩy, đá, cầm, ném)
  const KICH = { ghe: ['cao', 1.0], gheDau: ['cao', 0.46], banDai: ['dai', 2.8], banDaiTron: ['dai', 2.6], banVua: ['cao', 0.82], banNho: ['cao', 0.75], giuong: ['dai', 2.3],
    giaSach: ['dai', 1.6], keNen: ['cao', 0.8], ke: ['cao', 2.1], nen: ['cao', 0.32], nen3: ['cao', 0.4], ruongVang: ['dai', 1.0], ruong: ['dai', 1.0], hom: ['dai', 0.7],
    dia: ['dai', 0.34], dia2: ['dai', 0.3], diaTrong: ['dai', 0.28], chai: ['cao', 0.32], chai2: ['cao', 0.32], thung: ['cao', 0.72], thungRuou: ['dai', 1.1],
    coXanh: ['cao', 2.6], coDo: ['cao', 2.6], coVang: ['cao', 2.6], kiemKhien: ['dai', 1.1], duoc: ['cao', 0.55], tienVang: ['dai', 0.36] };
  const tinhMesh = [], tuongTac = [], dongVat = [], _box = new THREE.Box3(), _v = new THREE.Vector3();
  function mo(ten, px, py, y, { xoay = 0, dx = 0, dz = 0, loai = 'tinh', tt = null, coGian = 1, khoiLuong = 1 } = {}) {
    const g = DO?.[ten]; if (!g) return null;
    _box.setFromObject(g); const sz = _box.getSize(new THREE.Vector3()), [kieu, muc] = KICH[ten] || ['cao', 1];
    const k = (kieu === 'cao' ? muc / sz.y : muc / Math.max(sz.x, sz.z)) * coGian, kt = sz.clone().multiplyScalar(k), day = _box.min.y * k;
    const tam = _box.getCenter(new THREE.Vector3()).multiplyScalar(k);
    const p = W(px, py, dx, dz), q = quayY.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), xoay));
    const o = g.clone(true); o.scale.setScalar(k);
    let goc = o, vat = null;
    if (loai === 'dong') { // vật lý: bọc vào nhóm có tâm = tâm hộp, thân Rapier động
      goc = new THREE.Group(); o.position.set(-tam.x, -tam.y, -tam.z); goc.add(o); goc.position.set(p.x, y + kt.y / 2 + 0.02, p.z); goc.quaternion.copy(q);
      const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(goc.position.x, goc.position.y, goc.position.z).setRotation(q).setLinearDamping(0.3).setAngularDamping(0.6));
      world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(0.03, kt.x / 2), Math.max(0.02, kt.y / 2), Math.max(0.03, kt.z / 2)).setMass(khoiLuong).setFriction(0.7).setRestitution(0.15), b);
      vat = { goc, b }; dongVat.push(vat); goc.userData.than = b;
    } else { o.position.set(p.x, y - day, p.z); o.quaternion.copy(q); }
    goc.updateMatrixWorld(true);
    if (loai === 'tinh' || loai === 'tinhVa') o.traverse((m) => { if (m.isMesh) tinhMesh.push(m); });
    else { nhom.add(goc); goc.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
    if (loai === 'tinhVa' || loai === 'rieng') world.createCollider(RAPIER.ColliderDesc.cuboid(kt.x / 2, kt.y / 2, kt.z / 2).setTranslation(p.x, y + kt.y / 2, p.z).setRotation(q), tinh);
    if (tt) { const t = { ten, o: goc, mo: o, vat, ...tt }; if (tt.loai === 'mo') o.traverse((x) => { if (!t.nap && /lid/i.test(x.name)) t.nap = x; }); tuongTac.push(t); }
    return goc;
  }
  const VL_TRANH = {};
  function tranhAnh(ten, px, py, ngang, vao, y, rong, { lech = 0 } = {}) { // tranh tường thật: mặt ảnh + khung vàng (ngang: tường song song trục x bản vẽ)
    const t = TRANH[ten]; if (!t) return;
    const cao = rong * (t.image.height / t.image.width), dIn = 0.36 * vao;
    const g = new THREE.PlaneGeometry(rong, cao);
    const quay = ngang ? (vao > 0 ? 0 : Math.PI) : (vao > 0 ? Math.PI / 2 : -Math.PI / 2); // mặt tranh quay vào trong phòng (+z mặt phẳng → +uy khi 0, → +ux khi π/2)
    const pp = W(px, py, ngang ? lech : dIn + 0.02 * vao, ngang ? dIn + 0.02 * vao : lech); pp.y = y + cao / 2;
    g.applyMatrix4(_m.compose(pp, quayY.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), quay)), _s));
    VL_TRANH[ten] ||= new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
    const m = new THREE.Mesh(g, VL_TRANH[ten]); m.receiveShadow = true; nhom.add(m);
    for (const [w, h, oy, ox] of [[rong + 0.24, 0.12, cao + 0.06, 0], [rong + 0.24, 0.12, -0.06, 0], [0.12, cao, cao / 2, rong / 2 + 0.06], [0.12, cao, cao / 2, -rong / 2 - 0.06]])
      hop(px, py, ngang ? w : 0.06, h, ngang ? 0.06 : w, y + oy - h / 2, '#c49a3e', { kho: 'vang', va: false, ...(ngang ? { dz: dIn, dx: ox + lech } : { dx: dIn, dz: ox + lech }) });
  }
  function bucDoc(p, px, py, yS, xoay = 0) { // bục đọc giới thiệu phòng (E đọc)
    hop(px, py, 0.5, 1.0, 0.4, yS, '#5a3a22', { xoay }); dat(new THREE.BoxGeometry(0.62, 0.05, 0.46).rotateX(-0.45), px, py, yS + 1.08, '#e8dcc0', { xoay });
    tuongTac.push({ loai: 'doc', ten: 'bucDoc', phong: p, o: { position: (() => { const v = W(px, py); v.y = yS + 1; return v; })() } });
  }
  function choNgoi(px, py, y, xoay, dx = 0, dz = 0) { // chỗ ngồi gắn với ghế / ghế băng (E ngồi): mặt quay theo trục +z của ghế sau khi xoay
    const v = W(px, py, dx, dz); v.y = y;
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(quayY.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), xoay)));
    tuongTac.push({ loai: 'ngoi', ten: 'ghe', o: { position: v }, cao: y + 0.48, huong: Math.atan2(f.x, f.z) });
  }

  // ---- tầng & phòng
  const caoPhong = (p) => (p.kieu === 'ngaiVang' ? NT.caoNgaiVang : p.tang === 4 ? NT.caoTang4 : NT.caoTang3);
  const sanPhong = (p) => (p.tang === 4 ? y4 : y3);
  const cuaTren = (p, ngang, toa, tu, den) => NT.cua.filter((c) => c.tang === p.tang && (c.huong === 'ngang') === ngang && Math.abs((ngang ? c.p[1] : c.p[0]) - toa) <= 7 && (ngang ? c.p[0] : c.p[1]) > tu && (ngang ? c.p[0] : c.p[1]) < den);
  for (const p of NT.phong) {
    const [x0, y0, x1, y1] = p.o, yS = sanPhong(p), H = caoPhong(p), mauT = p.mau;
    // 4 cạnh, mỗi cạnh tách đoạn quanh ô cửa; tường dày 0,3 m lùi vào trong phòng 0,15 m (hai phòng kề không chồng nhau)
    for (const [ngang, toa, tu, den, vao] of [[true, y0, x0, x1, 1], [true, y1, x0, x1, -1], [false, x0, y0, y1, 1], [false, x1, y0, y1, -1]]) {
      const cuas = cuaTren(p, ngang, toa, tu, den).map((c) => ({ g: ngang ? c.p[0] : c.p[1], r: (c.rong || 1.5) / s / 2, h: c.cao || 2.7 })).sort((a, b) => a.g - b.g);
      let a = tu;
      const doan = (a0, a1, ya, yb) => {
        if (a1 - a0 < 0.5 || yb - ya < 0.05) return; const L = (a1 - a0) * s, m = (a0 + a1) / 2;
        const [px, py] = ngang ? [m, toa] : [toa, m];
        hop(px, py, ngang ? L : 0.3, yb - ya, ngang ? 0.3 : L, ya, mauT, ngang ? { dz: 0.15 * vao } : { dx: 0.15 * vao });
        if (ya === yS && !['hangDong', 'ngaiVang', 'nhaKinh'].includes(p.kieu)) { // ốp gỗ sồi chân tường + nẹp vàng
          hop(px, py, ngang ? L : 0.05, 1.15, ngang ? 0.05 : L, yS, '#4e321e', { va: false, ...(ngang ? { dz: 0.32 * vao } : { dx: 0.32 * vao }) });
          hop(px, py, ngang ? L : 0.07, 0.06, ngang ? 0.07 : L, yS + 1.15, '#c49a3e', { kho: 'vang', va: false, ...(ngang ? { dz: 0.33 * vao } : { dx: 0.33 * vao }) });
        }
      };
      for (const c of cuas) { doan(a, c.g - c.r, yS, yS + H); doan(c.g - c.r, c.g + c.r, yS + c.h, yS + H); a = c.g + c.r; }
      doan(a, den, yS, yS + H);
      // gờ vàng ngang tường (khung trang trí) ở 2/3 chiều cao tầng
      const L = (den - tu) * s, m = (tu + den) / 2, [px, py] = ngang ? [m, toa] : [toa, m];
      hop(px, py, ngang ? L - 0.4 : 0.06, 0.14, ngang ? 0.06 : L - 0.4, yS + Math.min(H - 0.6, 3.4), '#c9a24a', { kho: 'vang', va: false, ...(ngang ? { dz: 0.32 * vao } : { dx: 0.32 * vao }) });
    }
    noiThatPhong(p, yS, H);
  }

  // ---- sàn tầng ba theo viền Palas (chừa lỗ tháp), sàn tầng bốn + trần theo phòng
  {
    const hinh = new THREE.Shape(vienPalas.map(([x, z]) => new THREE.Vector2(x, -z)));
    hinh.holes.push(new THREE.Path(thapV.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ShapeGeometry(hinh); g.rotateX(-Math.PI / 2); g.translate(0, y3, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: vanSan, color: 0x9a7a5a, roughness: 0.8, side: THREE.DoubleSide })); m.receiveShadow = true; nhom.add(m);
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array), new Uint32Array(g.index.array)), tinh);
  }
  for (const p of NT.phong) {
    const [x0, y0, x1, y1] = p.o, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = (x1 - x0) * s, d = (y1 - y0) * s, yT = sanPhong(p) + caoPhong(p);
    if (p.tang === 4 || ['nhaKinh', 'nhaNguyen'].includes(p.kieu)) hop(cx, cy, w, 0.35, d, yT, '#6a5038', { va: false }); // trần
    if (p.tang === 4) hop(cx, cy, w, 0.35, d, y4 - 0.35, '#7a5a3c'); // sàn tầng bốn = trần tầng ba (có va chạm)
    if (p.kieu === 'ngaiVang') { // trần sao xanh của phòng ngai vàng
      const g = new THREE.PlaneGeometry(w, d); g.rotateX(Math.PI / 2); const pp = W(cx, cy); g.applyMatrix4(_m.compose(new THREE.Vector3(pp.x, yT - 0.02, pp.z), quayY, _s));
      nhom.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: vanTran, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x101830 })));
    }
  }

  // ---- cầu thang xoắn trong tháp: từ cửa dưới đất lên tầng ba rồi tầng bốn (bậc 0,22 m, 18°/bậc)
  const gocCua = Math.atan2(uy.z, uy.x); // hướng từ tâm tháp ra cửa sân trước (trục +y của bản vẽ)
  const [tx, tz] = thapV.reduce((a, [x, z]) => [a[0] + x / thapV.length, a[1] + z / thapV.length], [0, 0]);
  {
    // bậc ở phía NAM tháp (chỗ cửa ra sân trước) phải trùng đúng sàn tầng ba rồi tầng bốn: 18°/bậc → phía nam ở bậc 10 + 20n;
    // chọn số bậc cho bậc ~0,22 m tới tầng ba, rồi một vòng (20 bậc) tới tầng bốn
    const R = 3.75, r = 0.55, dGoc = (18 * Math.PI) / 180, a0 = gocCua - Math.PI; // bậc 0 đối diện cửa ra → bậc 10 + 20n đúng hướng cửa ra sân trước
    const i3 = 10 + 20 * Math.max(0, Math.round(((y3 - yCua) / 0.22 - 10) / 20)), i4 = i3 + 20 * Math.max(1, Math.round((y4 - y3) / 0.26 / 20));
    const caoBac = (i) => (i <= i3 ? yCua + (i * (y3 - yCua)) / i3 : y3 + ((i - i3) * (y4 - y3)) / (i4 - i3));
    for (let i = 1; i <= i4; i++) {
      const a = a0 + i * dGoc, rm = (R + r) / 2, x = tx + Math.cos(a) * rm, z = tz + Math.sin(a) * rm, y = caoBac(i);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      const g = new THREE.BoxGeometry(R - r, 0.22, 1.25); g.applyMatrix4(_m.compose(new THREE.Vector3(x, y - 0.11, z), q, _s));
      C.set(i % 2 ? '#b8b0a2' : '#a8a092'); const n = g.toNonIndexed(); const cc = new Float32Array(n.attributes.position.count * 3); for (let k = 0; k < cc.length; k += 3) cc.set([C.r, C.g, C.b], k); n.setAttribute('color', new THREE.BufferAttribute(cc, 3)); n.deleteAttribute('uv'); kho.mau.push(n);
      world.createCollider(RAPIER.ColliderDesc.cuboid((R - r) / 2, 0.11, 0.62).setTranslation(x, y - 0.11, z).setRotation(q), tinh);
    }
    // chiếu nghỉ tầng bốn: NỬA vòng phía sau bậc cuối (hướng cửa ra) — phủ cả vòng thì che đầu mấy bậc cuối, người kẹt dưới chiếu nghỉ
    { const diem = [];
      for (let j = 0; j <= 12; j++) { const a = gocCua - 0.15 + (j / 12) * Math.PI; for (const yy of [y4 - 0.25, y4]) diem.push(new THREE.Vector3(tx + Math.cos(a) * R, yy, tz + Math.sin(a) * R)); }
      for (const yy of [y4 - 0.25, y4]) diem.push(new THREE.Vector3(tx, yy, tz));
      const g = new ConvexGeometry(diem); C.set('#a8a092'); const n = g.index ? g.toNonIndexed() : g, cc = new Float32Array(n.attributes.position.count * 3); for (let k = 0; k < cc.length; k += 3) cc.set([C.r, C.g, C.b], k); n.setAttribute('color', new THREE.BufferAttribute(cc, 3)); if (n.attributes.uv) n.deleteAttribute('uv'); kho.mau.push(n);
      world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(diem.flatMap((v) => [v.x, v.y, v.z]))), tinh); }
    const cot = new THREE.CylinderGeometry(r, r, y4 + 3 - yCua, 14); cot.translate(tx, (y4 + 3 + yCua) / 2, tz);
    C.set('#c8c0b2'); const n = cot.toNonIndexed(), cc = new Float32Array(n.attributes.position.count * 3); for (let k = 0; k < cc.length; k += 3) cc.set([C.r, C.g, C.b], k); n.setAttribute('color', new THREE.BufferAttribute(cc, 3)); n.deleteAttribute('uv'); kho.mau.push(n);
    world.createCollider(RAPIER.ColliderDesc.cylinder((y4 + 3 - yCua) / 2, r).setTranslation(tx, (y4 + 3 + yCua) / 2, tz), tinh);
    // sàn chân cầu thang
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.1, 3.9).setTranslation(tx, yCua - 0.1, tz), tinh);
  }


  function denChum(px, py, y, rr) { // đèn chùm: vòng vàng + nến sáng + dây treo
    dat(new THREE.TorusGeometry(rr, 0.08, 8, 40).rotateX(Math.PI / 2), px, py, y, '#d4ac50', { kho: 'vang' });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; dat(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 6), px, py, y + 0.2, '#fff2c0', { kho: 'sang', dx: Math.cos(a) * rr, dz: Math.sin(a) * rr }); }
    dat(new THREE.CylinderGeometry(0.03, 0.03, 4, 5), px, py, y + 2.1, '#3a3020', { kho: 'vang' });
  }
  function tranh(px, py, ngang, vao, y, w, h, mau) { // tranh trên tường: khung vàng + mặt màu
    hop(px, py, ngang ? w + 0.2 : 0.08, h + 0.2, ngang ? 0.08 : w + 0.2, y - 0.1, '#b8903a', { kho: 'vang', va: false, ...(ngang ? { dz: 0.36 * vao } : { dx: 0.36 * vao }) });
    hop(px, py, ngang ? w : 0.1, h, ngang ? 0.1 : w, y, mau, { va: false, ...(ngang ? { dz: 0.4 * vao } : { dx: 0.4 * vao }) });
  }
  function ghe(px, py, y, mau, xoay = 0) { hop(px, py, 0.5, 0.5, 0.5, y, mau, { xoay }); dat(new THREE.BoxGeometry(0.5, 0.6, 0.08), px, py, y + 0.8, mau, { xoay, dz: 0.22 }); }

  function noiThatPhong(p, yS, H) {
    const [x0, y0, x1, y1] = p.o, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = (x1 - x0) * s, d = (y1 - y0) * s, k = p.kieu, m1 = 1 / s; // m1 = số px của 1 m
    const tham = (px, py, rw, rd) => { const t = TRANH['ngu-tham']; if (!t) return; const g = new THREE.PlaneGeometry(rw, rd); g.rotateX(-Math.PI / 2); const pp = W(px, py); g.applyMatrix4(_m.compose(new THREE.Vector3(pp.x, yS + 0.012, pp.z), quayY, _s)); VL_TRANH.tham ||= new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); nhom.add(new THREE.Mesh(g, VL_TRANH.tham)); };
    const tranDam = () => { const n = Math.floor(d / 1.3); for (let i = 1; i < n; i++) hop(cx, y0 + (i * (y1 - y0)) / n, w - 0.4, 0.28, 0.22, yS + H - 0.3, '#5a3a20', { va: false }); }; // dầm trần gỗ
    if (k === 'ngaiVang') {
      { const g = new THREE.PlaneGeometry(w - 0.6, d - 0.6); g.rotateX(-Math.PI / 2); const pp = W(cx, cy); g.applyMatrix4(_m.compose(new THREE.Vector3(pp.x, yS + 0.01, pp.z), quayY, _s)); nhom.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: NT._vanKham, roughness: 0.5 }))); }
      hop(cx, (cy + y1) / 2 + 2, 2.2, 0.03, d * 0.55, yS + 0.02, '#8a1a1a', { va: false });
      for (const xx of [x0 + 18, x1 - 18]) for (let i = 0; i < 7; i++) {
        const yy = y0 + 45 + i * ((y1 - y0 - 60) / 6);
        tru(xx, yy, 0.32, 5.6, yS, '#8a2a2a', { va: true }); tru(xx, yy, 0.24, 4.4, yS + 6.4, '#2a3a8a');
        hop(xx, yy, 0.9, 0.3, 0.9, yS + 5.6, '#c9a24a', { kho: 'vang', va: false });
      }
      for (const xx of [x0 + 10, x1 - 10]) hop(xx, cy + 8, 2.0, 0.4, d - 4, yS + 6.0, '#9a8a6a', { va: false });
      const ax = (x0 + x1) / 2, ay = y0 + 62, R = 58;
      for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI; hop(ax + Math.cos(a) * R, ay + Math.sin(a) * R, 0.4, H - 0.4, 2.4, yS, i % 2 ? '#c9a24a' : '#2a4a9a', { xoay: -a, kho: i % 2 ? 'vang' : 'mau' }); }
      for (let b = 0; b < 4; b++) hop(ax, ay - 8, 6 - b * 1.1, 0.3, 3.6 - b * 0.55, yS + b * 0.3, b === 3 ? '#c9a24a' : '#e8e0d0', { kho: b === 3 ? 'vang' : 'mau' });
      for (const [dx, dz] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) dat(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), ax, ay - 8, yS + 1.2 + 1.6, '#d4ac50', { kho: 'vang', dx, dz });
      hop(ax, ay - 8, 3.0, 0.25, 2.2, yS + 4.4, '#8a1a2a', { va: false });
      // tranh thật: hậu cung (Chúa + các thánh) trên vòm, các thánh giữa hàng cột, dãy vòm tầng trên dọc tường dài
      tranhAnh('ngai-hau-cung', ax, y0, true, 1, yS + 5.2, 7.0);
      for (const [xx, vao] of [[x0, 1], [x1, -1]]) { tranhAnh('ngai-thanh', xx, cy - 20, false, vao, yS + 0.6, 2.4); tranhAnh('ngai-thanh', xx, cy + 30, false, vao, yS + 0.6, 2.4); tranhAnh('ngai-vom-cot', xx, cy + 5, false, vao, yS + 6.6, 7.5); }
      mo('nen3', ax, ay - 8, yS + 1.2, { dx: -2.2, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.8 }); mo('nen3', ax, ay - 8, yS + 1.2, { dx: 2.2, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.8 });
      bucDoc(p, cx + 30, y1 - 14, yS, Math.PI);
      denChum(cx, cy + 15, yS + 8.2, 2.8); denDiem(cx, cy + 15, yS + 7.5, 0xffd8a0, 45, 26, true); denDiem(ax, ay - 8, yS + 4, 0xffe0b0, 18, 12);
    } else if (k === 'sanh') {
      tru(cx, cy, 0.35, H, yS, '#d8d0c0', { va: true });
      mo(p.tang === 4 ? 'coVang' : 'coXanh', x0, cy - 25, yS + 0.3, { dx: 0.45, xoay: Math.PI / 2 }); mo('coDo', x1, cy + 25, yS + 0.3, { dx: -0.45, xoay: -Math.PI / 2 });
      mo('duoc', x0, cy + 25, yS + 2.1, { dx: 0.4, xoay: Math.PI / 2 }); mo('duoc', x1, cy - 25, yS + 2.1, { dx: -0.4, xoay: -Math.PI / 2 });
      mo('thung', cx + 18, y1 - 10, yS, { loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 6 });
      bucDoc(p, cx - 18, y1 - 10, yS, 0);
      denDiem(cx, cy, yS + H - 1, 0xffe6c0, 10, 12, true);
    } else if (k === 'tienSanh') {
      mo('banVua', cx, cy, yS, { loai: 'tinhVa' }); mo('ghe', cx, cy - 8, yS, { loai: 'tinhVa', xoay: 0 }); choNgoi(cx, cy - 8, yS, 0); mo('ghe', cx, cy + 8, yS, { loai: 'tinhVa', xoay: Math.PI }); choNgoi(cx, cy + 8, yS, Math.PI);
      mo('nen', cx, cy, yS + 0.82, { dx: 0.3, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.3 }); mo('chai', cx, cy, yS + 0.82, { dx: -0.25, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.5 });
      mo('giaSach', cx, y0, yS + 1.6, { dz: 0.45 }); mo('hom', x1 - 6, y1 - 6, yS, { loai: 'tinhVa', xoay: -Math.PI / 2 }); mo('duoc', x0, cy, yS + 2.1, { dx: 0.4, xoay: Math.PI / 2 });
      bucDoc(p, x0 + 9, y1 - 7, yS, 0); denChum(cx, cy, yS + H - 1.2, 0.9); denDiem(cx, cy, yS + H - 1.6, 0xffd8a0, 10, 11, true); tranDam();
    } else if (k === 'lamViec') {
      mo('banVua', cx, cy, yS, { loai: 'tinhVa', coGian: 1.1 }); mo('ghe', cx, cy + 9, yS, { loai: 'tinhVa', xoay: Math.PI }); choNgoi(cx, cy + 9, yS, Math.PI);
      mo('nen3', cx, cy, yS + 0.9, { dx: 0.35, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.8 }); mo('tienVang', cx, cy, yS + 0.9, { dx: -0.3, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 1.5 });
      mo('ke', x0, cy - 12, yS, { dx: 0.4, xoay: Math.PI / 2 }); mo('ke', x0, cy + 12, yS, { dx: 0.4, xoay: Math.PI / 2 }); mo('ruong', x1 - 7, y1 - 8, yS, { loai: 'rieng', xoay: -Math.PI / 2, tt: { loai: 'mo' } });
      tranhAnh('lam-tannhauser', cx, y0, true, 1, yS + 1.6, 4.4); tranhAnh('lam-tranh-trai', x1, cy, false, -1, yS + 1.5, 1.8);
      bucDoc(p, x1 - 8, y0 + 8, yS, -Math.PI / 2); denChum(cx, cy, yS + H - 1.2, 0.9); denDiem(cx, cy, yS + H - 1.6, 0xffd8a0, 11, 11, true); tranDam();
    } else if (k === 'phongAn') {
      mo('banDai', cx, cy, yS, { loai: 'tinhVa', xoay: Math.PI / 2 * 0 });
      for (const [dy, xoay] of [[-14, 0], [0, 0], [14, 0]]) for (const sd of [-1, 1]) { const xx = cx + sd * 11, xo = sd > 0 ? -Math.PI / 2 : Math.PI / 2; mo('ghe', xx, cy + dy, yS, { loai: 'tinhVa', xoay: xo }); choNgoi(xx, cy + dy, yS, xo); }
      for (const [dy, ten] of [[-12, 'dia'], [-4, 'dia2'], [4, 'dia'], [12, 'dia2']]) mo(ten, cx, cy + dy, yS + 0.84, { loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.4 });
      mo('chai', cx, cy - 8, yS + 0.84, { dx: 0.2, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.5 }); mo('chai2', cx, cy + 8, yS + 0.84, { dx: -0.2, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.5 });
      mo('nen3', cx, cy, yS + 0.84, { loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.8 }); mo('thungRuou', x1 - 6, y0 + 6, yS, { loai: 'tinhVa', xoay: -Math.PI / 4 });
      tranhAnh('an-wolfram', cx, y1, true, -1, yS + 1.9, 3.6); tranhAnh('an-tranh-trai', x0, cy, false, 1, yS + 1.5, 1.8);
      bucDoc(p, x0 + 7, y0 + 7, yS, Math.PI / 2); denChum(cx, cy, yS + H - 1.3, 1.1); denDiem(cx, cy, yS + H - 1.5, 0xffd8a0, 12, 10, true); tranDam();
    } else if (k === 'hangDong') {
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, rx = (w / 2 - 0.9) * Math.cos(a), rz = (d / 2 - 0.9) * Math.sin(a); dat(new THREE.DodecahedronGeometry(0.45 + (i % 3) * 0.15, 0).scale(1, 1.5, 1), cx, cy, yS + 0.6, '#5a6a62', { dx: rx * 1.05, dz: rz * 1.05 }); }
      for (let i = 0; i < 10; i++) dat(new THREE.ConeGeometry(0.25, 1.2, 6).rotateX(Math.PI), cx, cy, yS + H - 0.6, '#6a7a72', { dx: Math.sin(i * 2.3) * (w / 3), dz: Math.cos(i * 1.7) * (d / 3) });
      dat(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 20), cx, cy + 6, yS + 0.03, '#2a7a8a');
      mo('nen', cx, cy, yS, { dx: 1.6, dz: -1.2, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.3 }); mo('nen', cx, cy, yS, { dx: -1.6, dz: -1.2, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.3 });
      bucDoc(p, cx, y0 + 7, yS, 0); denDiem(cx, cy, yS + 2.5, 0x55d0c0, 14, 10, true);
    } else if (k === 'phongNgu') {
      mo('giuong', cx, cy - 2, yS, { loai: 'tinhVa', xoay: Math.PI }); tham(cx, cy + 6, w - 2, 2.4);
      for (const [dx, dz] of [[-1.05, -1.15], [1.05, -1.15], [-1.05, 1.15], [1.05, 1.15]]) dat(new THREE.CylinderGeometry(0.07, 0.07, 3.0, 8), cx, cy - 2, yS + 1.5, '#3a2010', { dx, dz }); // cột màn giường tân Gothic
      hop(cx, cy - 2, 2.4, 0.3, 2.6, yS + 3.0, '#2a4a7a', { va: false });
      mo('keNen', x1 - 5, cy + 10, yS, { loai: 'tinhVa', xoay: -Math.PI / 2 }); mo('ruongVang', x0 + 6, y1 - 7, yS, { loai: 'rieng', xoay: Math.PI / 2, tt: { loai: 'mo' } });
      mo('ghe', x1 - 7, y1 - 8, yS, { loai: 'tinhVa', xoay: -Math.PI * 0.75 }); choNgoi(x1 - 7, y1 - 8, yS, -Math.PI * 0.75);
      mo('nen', x1 - 5, cy + 10, yS + 0.8, { loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.3 });
      tranhAnh('ngu-tristan', x0, cy, false, 1, yS + 1.5, 2.6); tranhAnh('ngu-cua-cham', cx, y1, true, -1, yS + 0.05, 1.5, { lech: 2.2 });
      bucDoc(p, x1 - 7, y0 + 7, yS, -Math.PI / 2); denDiem(cx, cy, yS + H - 1, 0xffd8a0, 8, 9, true); tranDam();
    } else if (k === 'phongKhach') {
      tham(cx, cy, w - 2.4, d - 2.4); mo('banNho', cx, cy, yS, { loai: 'tinhVa' });
      for (const [dx, dz, xo] of [[0, -1.3, 0], [1.3, 0, -Math.PI / 2], [-1.3, 0, Math.PI / 2]]) { mo('ghe', cx, cy, yS, { dx, dz, loai: 'tinhVa', xoay: xo }); choNgoi(cx, cy, yS, xo, dx, dz); }
      mo('nen3', cx, cy, yS + 0.76, { loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.8 }); mo('ke', x0, cy, yS, { dx: 0.4, xoay: Math.PI / 2 });
      tranhAnh('khach-lohengrin', x1, cy, false, -1, yS + 1.6, 3.4); tranhAnh('khach-lohengrin', cx, y0, true, 1, yS + 1.6, 3.0);
      bucDoc(p, x0 + 7, y1 - 7, yS, Math.PI / 2); denChum(cx, cy, yS + H - 1.2, 1.0); denDiem(cx, cy, yS + H - 1.6, 0xffd8a0, 11, 11, true); tranDam();
    } else if (k === 'thayDo') {
      mo('ke', x1, cy - 10, yS, { dx: -0.4, xoay: -Math.PI / 2 }); mo('ke', x1, cy + 10, yS, { dx: -0.4, xoay: -Math.PI / 2 });
      hop(x0 + 3, cy, 0.08, 1.8, 0.9, yS + 0.4, '#d8e0e8', { va: false }); // gương
      mo('ruong', cx, y1 - 7, yS, { loai: 'rieng', tt: { loai: 'mo' } }); mo('gheDau', cx, cy, yS, { loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 4 });
      bucDoc(p, x0 + 7, y0 + 7, yS, Math.PI / 2); denDiem(cx, cy, yS + H - 1.4, 0xffe0b8, 8, 10, true); tranDam();
    } else if (k === 'nhaKinh') {
      for (let i = 0; i < 6; i++) { const dx = ((i % 3) - 1) * 1.8, dz = (Math.floor(i / 3) - 0.5) * 1.6; tru(cx, cy, 0.35, 0.5, yS, '#7a4a2a', { dx, dz }); dat(new THREE.SphereGeometry(0.6, 10, 8), cx, cy, yS + 1.1, '#3a7a3a', { dx, dz }); }
    } else if (k === 'nhaNguyen') {
      hop(cx, y1 - 6, 1.6, 1.0, 0.7, yS, '#c9a24a', { kho: 'vang' }); hop(cx, y1 - 6, 0.08, 1.0, 0.08, yS + 1.0, '#d4ac50', { kho: 'vang', va: false }); hop(cx, y1 - 6, 0.5, 0.08, 0.08, yS + 1.6, '#d4ac50', { kho: 'vang', va: false });
      for (const dx of [-0.6, 0.6]) mo('nen', cx, y1 - 6, yS + 1.0, { dx, loai: 'dong', tt: { loai: 'cam' }, khoiLuong: 0.3 });
      denDiem(cx, cy, yS + 2, 0xffd890, 6, 6, true);
    } else if (k === 'phongHat') {
      hop(x1 - 18, cy, 3.6, 0.8, d - 1.2, yS, '#6a4a2a');
      for (const dz of [-d / 3, 0, d / 3]) hop(x1 - 12, cy, 0.5, H - 1.5, 0.5, yS + 0.8, '#c9a24a', { kho: 'vang', dz });
      tranhAnh('hat-san-khau', x1, cy, false, -1, yS + 0.8, d - 1.6);
      for (let i = 0; i < 6; i++) { const xx = x0 + 40 + i * 32; hop(xx, cy, 0.5, 0.45, d - 4, yS, '#5a3420'); for (const dz of [-2, 0, 2]) choNgoi(xx, cy, yS, Math.PI / 2, 0, dz); } // ghế băng, ngồi nhìn về sân khấu (đông)
      for (let i = 0; i < 3; i++) { denChum(x0 + 60 + i * 90, cy, yS + H - 1.6, 1.4); denDiem(x0 + 60 + i * 90, cy, yS + H - 2, 0xffd8a0, 18, 16, true); }
      for (let i = 0; i < 6; i++) { tranhAnh('hat-parzival', x0 + 30 + i * 48, y0, true, 1, yS + 1.5, 1.6); tranhAnh('hat-parzival', x0 + 30 + i * 48, y1, true, -1, yS + 1.5, 1.6); }
      for (let i = 0; i < 5; i++) { mo('duoc', x0 + 54 + i * 48, y0, yS + 2.2, { dz: 0.4 }); mo('duoc', x0 + 54 + i * 48, y1, yS + 2.2, { dz: -0.4, xoay: Math.PI }); }
      if (TRANH['hat-tran']) { const t = TRANH['hat-tran']; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); const g = new THREE.PlaneGeometry(w - 0.6, d - 0.6); g.rotateX(Math.PI / 2); const pp = W(cx, cy); g.applyMatrix4(_m.compose(new THREE.Vector3(pp.x, yS + H - 0.05, pp.z), quayY, _s)); nhom.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, side: THREE.DoubleSide }))); }
      bucDoc(p, x0 + 12, y1 - 8, yS, Math.PI / 2);
    }
  }

  // ---- gộp theo vật liệu
  const VL = {
    mau: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    vang: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 }),
    sang: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffd890, emissiveIntensity: 2.2 }),
  };
  for (const [ten, gs] of Object.entries(kho)) if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), VL[ten]); m.castShadow = ten !== 'sang'; m.receiveShadow = true; nhom.add(m); }
  // đồ cố định KayKit: đổi toạ độ nén (KHR_mesh_quantization) sang số thực rồi gộp theo vật liệu → 1 lưới
  { const theoVL = new Map();
    for (const m of tinhMesh) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      const ng = new THREE.BufferGeometry();
      for (const ten of ['position', 'normal', 'uv']) { const a = g.attributes[ten]; if (!a) continue; const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c); ng.setAttribute(ten, new THREE.BufferAttribute(f, a.itemSize)); }
      if (!ng.attributes.normal) ng.computeVertexNormals(); if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
      ng.applyMatrix4(m.matrixWorld);
      if (!theoVL.has(m.material)) theoVL.set(m.material, []); theoVL.get(m.material).push(ng);
    }
    for (const [vl, gs] of theoVL) { const mm = new THREE.Mesh(mergeGeometries(gs), vl); mm.castShadow = mm.receiveShadow = true; nhom.add(mm); } }
  for (const l of den) l.visible = false;
  for (const v of dongVat) { v.goc.visible = true; }

  const tamNV = NT.phong.find((p) => p.kieu === 'ngaiVang'), tamPH = NT.phong.find((p) => p.kieu === 'phongHat');
  const pNV = W((tamNV.o[0] + tamNV.o[2]) / 2, tamNV.o[3] - 12), pPH = W(tamPH.o[0] + 14, (tamPH.o[1] + tamPH.o[3]) / 2); // Phòng hát: vào ở đầu tây (cạnh cửa), không rơi vào hàng ghế
  return {
    nhom, y3, y4, tam: [tx, tz], gocCua,
    tamPhong(so) { const p = NT.phong.find((x) => x.so === so); if (!p) return null; const w = W((p.o[0] + p.o[2]) / 2, (p.o[1] + p.o[3]) / 2); return [w.x, sanPhong(p), w.z]; },
    diem: [['👑 Phòng ngai vàng', pNV.x, pNV.z, y3], ['🎵 Phòng hát', pPH.x, pPH.z, y4]], // [tên, x, z, y sàn] (khuôn bando.js)
    hien(b) { if (nhom.visible === b) return; nhom.visible = b; for (const l of den) l.visible = b && !l.userData.tat; for (const v of dongVat) v.b.setEnabled(b && !v.cam); }, // đồ đang cầm trên tay giữ thân vật lý tắt
    tuongTac, dongVat,
    capNhat(dt) { // đồng bộ đồ vật lý + nắp rương đang mở / đóng
      if (!nhom.visible) return;
      for (const v of dongVat) { if (v.cam) continue; const t = v.b.translation(), q = v.b.rotation(); v.goc.position.set(t.x, t.y, t.z); v.goc.quaternion.set(q.x, q.y, q.z, q.w); if (t.y < yDay - 5) { v.b.setTranslation({ x: t.x, y: y3 + 1, z: t.z }, true); v.b.setLinvel({ x: 0, y: 0, z: 0 }, true); } }
      for (const t of tuongTac) if (t.loai === 'mo' && t.nap) { const dich = t.dangMo ? -1.15 : 0; t.nap.rotation.x += (dich - t.nap.rotation.x) * Math.min(1, dt * 6); }
    },
    // phòng đang đứng (để ghi lên bảng): tìm hình chữ nhật bản vẽ chứa điểm
    phongTai(x, y, z) {
      const nguoc = (px, py) => { const [ax, az] = A.ra(0, 0), [bx, bz] = A.ra(1, 0), [cx, cz] = A.ra(0, 1); const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az); return [((x - ax) * (cz - az) - (cx - ax) * (z - az)) / det, ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / det]; };
      const [px, py] = nguoc(); const tang = y > y4 - 0.5 ? 4 : y > y3 - 0.5 ? 3 : 0;
      return NT.phong.find((p) => p.tang === tang && px >= p.o[0] && px <= p.o[2] && py >= p.o[1] && py <= p.o[3]) || null;
    },
  };
}
