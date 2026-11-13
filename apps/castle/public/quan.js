// Quán rượu "Lửa Đỏ": nhà có nội thất đi vào được + người sinh hoạt bên trong. Mọi thứ sinh bằng mã.
// Toạ độ cục bộ: x dọc mặt tiền, z hướng ra cửa (về phía phố chính), y lên. Sàn gỗ mặt trên y = 0.1.
import * as THREE from 'three';

const W = 13, D = 9, H = 4.4, DAY = 0.3, SAN = 0.1;
// bàn: [x, z, số ghế, góc bắt đầu]; ghế cách tâm bàn 0.95 m
const BAN = [[-3.0, 1.8, 3, 0.4], [0.6, 2.2, 3, -0.5], [3.9, 1.6, 2, 0.9], [-3.0, -1.1, 3, 2.2]];
const QUAY = { x: 0.6, z: -2.6, w: 6.2, d: 0.7, h: 1.1 };

export function dungNhaQuan(c, goc, rr) {
  const { THREE: _, hop, tru, maiDoc, dat_, vaHop, vaTru, scene } = c;
  const tx = Math.cos(goc) * rr, tz = Math.sin(goc) * rr;
  const ry = Math.atan2(-Math.cos(goc), -Math.sin(goc)); // +z cục bộ nhìn về tâm thành
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const W_ = (x, z) => [tx + x * cs + z * sn, tz - x * sn + z * cs];
  const box = (vl, w, h, d, x, y, z, va = true) => { const [a, b] = W_(x, z); hop(vl, w, h, d, a, y, b, ry); if (va) vaHop(w, h, d, a, y, b, ry); };
  const cyl = (vl, r1, r2, h, x, y, z, seg = 16, va = 0) => { const [a, b] = W_(x, z); tru(vl, r1, r2, h, a, y, b, seg); if (va) vaTru(va, h, a, y, b); };

  // vỏ nhà: tường 4 mặt, cửa giữa mặt trước
  box('vua', W, H, DAY, 0, 0, -D / 2 + DAY / 2);
  box('vua', DAY, H, D, -W / 2 + DAY / 2, 0, 0); box('vua', DAY, H, D, W / 2 - DAY / 2, 0, 0);
  const cua = 1.8, ben = (W - cua) / 2;
  box('vua', ben, H, DAY, -(cua / 2 + ben / 2), 0, D / 2 - DAY / 2); box('vua', ben, H, DAY, cua / 2 + ben / 2, 0, D / 2 - DAY / 2);
  box('vua', cua, H - 2.6, DAY, 0, 2.6, D / 2 - DAY / 2);
  box('go', W - 0.4, SAN, D - 0.4, 0, 0, 0, false); { const [a, b] = W_(0, 0); vaHop(W, SAN, D, a, 0, b, ry); }
  box('go', W - 0.4, 0.15, D - 0.4, 0, H - 0.35, 0, false);
  for (let x = -5; x <= 5; x += 2.5) box('go', 0.22, 0.25, D - 0.4, x, H - 0.6, 0, false); // xà ngang
  { const [a, b] = W_(0, 0); maiDoc('ngoi', W + 0.9, D + 1.3, 3, a, H, b, ry); }
  box('go', 2.2, 0.12, 0.6, 0, 2.6, D / 2 + 0.25, false); // mái hiên nhỏ trên cửa

  // quầy + kệ chai + thùng rượu
  box('go', QUAY.w, QUAY.h, QUAY.d, QUAY.x, SAN, QUAY.z);
  box('go', QUAY.w + 0.2, 0.08, QUAY.d + 0.15, QUAY.x, SAN + QUAY.h, QUAY.z, false);
  for (const y of [1.5, 2.15]) box('go', 5.2, 0.06, 0.32, QUAY.x, y, -D / 2 + DAY + 0.16, false);
  const chai = [];
  for (const y of [1.56, 2.21]) for (let x = -1.8; x <= 3.0; x += 0.24 + Math.random() * 0.1) {
    const [a, b] = W_(x + QUAY.x - 0.6, -D / 2 + DAY + 0.16); const h = 0.22 + Math.random() * 0.12;
    chai.push(new THREE.CylinderGeometry(0.035, 0.05, h, 7).translate(a, y + h / 2, b));
  }
  const mauChai = new THREE.MeshStandardMaterial({ color: 0x2a4a2a, emissive: 0x2a6a3a, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1 });
  scene.add(new THREE.Mesh(c.mergeGeometries(chai), mauChai));
  for (const x of [4.75, 5.75]) cyl('go', 0.5, 0.45, 1.15, x, SAN, -3.6, 18, 0.55);
  cyl('go', 0.45, 0.42, 0.95, -5.6, SAN, 3.6, 16, 0.5); cyl('go', 0.45, 0.42, 0.95, -5.6, SAN + 0.95, 3.6, 16);

  // lò sưởi tường trái: hai trụ + bệ + ống khói, lửa đặt ở giữa
  box('da', 1.0, 1.3, 0.45, -W / 2 + 0.8, SAN, -1.55); box('da', 1.0, 1.3, 0.45, -W / 2 + 0.8, SAN, 0.55);
  box('da', 1.1, 0.5, 2.6, -W / 2 + 0.85, SAN + 1.3, -0.5); box('da', 0.8, H - 1.9, 1.6, -W / 2 + 0.7, SAN + 1.8, -0.5, false);
  box('da', 0.4, 1.3, 1.7, -W / 2 + 0.45, SAN, -0.5);
  const lua = W_(-W / 2 + 0.95, -0.5);

  // bàn tròn + ghế đẩu
  const ghe = [];
  BAN.forEach(([x, z, n, g0], i) => {
    cyl('go', 0.62, 0.62, 0.07, x, SAN + 0.72, z, 20); cyl('go', 0.07, 0.12, 0.72, x, SAN, z, 8, 0.66);
    for (let k = 0; k < n; k++) {
      const g = g0 + k * Math.PI * 2 / n, sx = x + Math.cos(g) * 0.95, sz = z + Math.sin(g) * 0.95;
      cyl('go', 0.2, 0.17, 0.45, sx, SAN, sz, 10, 0.3);
      ghe.push({ ban: i, x: sx, z: sz, nhin: Math.atan2(x - sx, z - sz) });
    }
  });
  const dan = { x: 5.4, z: 3.3 }; cyl('go', 0.2, 0.17, 0.45, dan.x, SAN, dan.z, 10, 0.3);

  // đèn chùm: vòng sắt + nến phát sáng; biển hiệu trên cửa
  const den = new THREE.Group();
  den.add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 28), new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.6, roughness: 0.5 })));
  den.children[0].rotation.x = Math.PI / 2;
  const nen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 5 });
  for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), nen); m.position.set(Math.cos(k / 8 * 6.283) * 0.9, 0.08, Math.sin(k / 8 * 6.283) * 0.9); den.add(m); }
  { const [a, b] = W_(0.4, 0.6); den.position.set(a, H - 0.9, b); scene.add(den); }
  const bien = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#3a2414'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#c8962e'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 112);
    g.fillStyle = '#f0c060'; g.font = 'bold 58px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('QUÁN LỬA ĐỎ', 256, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bang = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: bien, emissive: 0xffffff, emissiveMap: bien, emissiveIntensity: 0.35 }));
  { const [a, b] = W_(0, D / 2 + 0.02); bang.position.set(a, 3.35, b); bang.rotation.y = ry; scene.add(bang); }

  // ánh sáng trong quán: lửa (chập chờn) + đèn chùm + đèn quầy
  const anhLua = new THREE.PointLight(0xff7a2a, 14, 9, 1.6); anhLua.position.set(lua[0], 0.9, lua[1]); scene.add(anhLua);
  const anhChum = new THREE.PointLight(0xffb070, 10, 11, 1.5); anhChum.position.set(den.position.x, H - 1.2, den.position.z); scene.add(anhChum);
  { const [a, b] = W_(QUAY.x, -3.2); const l = new THREE.PointLight(0xffa860, 6, 7, 1.6); l.position.set(a, 2.6, b); scene.add(l); }

  // lửa lò sưởi: hạt cộng sáng bốc lên
  const SO = 70, pos = new Float32Array(SO * 3), tuoi = new Float32Array(SO);
  const hatMoi = (i) => { pos[i * 3] = lua[0] + (Math.random() - 0.5) * 0.5; pos[i * 3 + 1] = SAN + 0.1; pos[i * 3 + 2] = lua[1] + (Math.random() - 0.5) * 0.9; tuoi[i] = Math.random(); };
  for (let i = 0; i < SO; i++) hatMoi(i);
  const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(gl, new THREE.PointsMaterial({ map: c.chamLua, size: 0.45, color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const than = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.9), new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff3a00, emissiveIntensity: 2.5 }));
  than.position.set(lua[0], SAN + 0.06, lua[1]); than.rotation.y = ry; scene.add(than);

  const trong = (x, z) => { const dx = x - tx, dz = z - tz; const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) < W / 2 - 0.2 && Math.abs(lz) < D / 2 - 0.2; };
  return {
    tam: [tx, tz], ry, W_, ghe, dan, quay: QUAY, lua, trong, SAN,
    capNhat(dt, t) {
      anhLua.intensity = 12 + Math.sin(t * 11) * 2.5 + Math.sin(t * 23.7) * 1.5 + Math.random() * 1.5;
      for (let i = 0; i < SO; i++) { tuoi[i] += dt * 1.4; pos[i * 3 + 1] += dt * (0.5 + tuoi[i]); pos[i * 3] += (Math.random() - 0.5) * dt * 0.4; if (tuoi[i] > 1.05 || pos[i * 3 + 1] > SAN + 1.1) hatMoi(i); }
      gl.attributes.position.needsUpdate = true;
    },
  };
}

// Người trong quán: chủ quán · cô phục vụ · khách ngồi bàn · hai người tựa quầy · người gảy đàn · một người say
export function nguoiQuan(c, q) {
  const { taoNguoi, MAU_DA, MAU_AO, scene, world, RAPIER } = c;
  const ds = [];
  const vlCoc = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.7 }), vlBia = new THREE.MeshStandardMaterial({ color: 0xf0e0c0, roughness: 0.9 });
  const coc = () => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.13, 10), vlCoc); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 10), vlBia); b.position.y = 0.065; g.add(a, b); g.position.set(0, -0.06, 0.05); return g; };
  const W = (x, z) => q.W_(x, z);
  const moi = (o, vai) => {
    const n = taoNguoi(o); scene.add(n.goc);
    let b = null;
    if (vai.coVa) { b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -60, 0)); world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.28), b); }
    const p = { n, b, x: 0, z: 0, huong: 0, loop: null, ngoi: 0, toc: 0, tg: Math.random() * 6, ...vai };
    ds.push(p); return p;
  };
  const datO = (p, lx, lz, nhin) => { [p.x, p.z] = W(lx, lz); p.huong = nhin + q.ry; };
  const quay = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  const di = (p, lx, lz, v, dt) => { // đi thẳng tới điểm cục bộ, trả true khi tới
    const [gx, gz] = W(lx, lz), dx = gx - p.x, dz = gz - p.z, l = Math.hypot(dx, dz);
    if (l < 0.08) { p.toc = 0; return true; }
    const s = Math.min(l, v * dt); p.x += dx / l * s; p.z += dz / l * s; p.toc = v; p.huongDich = Math.atan2(dx, dz); return false;
  };
  let i = 0;
  // khách ngồi: 2–3 người mỗi bàn
  for (const g of q.ghe) {
    if (Math.random() < 0.18) continue;
    const p = moi({ da: MAU_DA[i % 5], ao: MAU_AO[(i * 3) % 8], toc: [0x2b1d14, 0x6a4a2a, 0x1a1a1a, 0x9a8a6a][i % 4], mu: i % 5 === 1 ? 0x4a3020 : undefined, co: 0.94 + Math.random() * 0.1 }, { vai: 'khach', ghe: g });
    p.n.cam(coc()); datO(p, g.x, g.z, g.nhin); p.ngoi = q.SAN + 0.45; p.loop = ['uong', 'noi', 'cuoi'][i % 3]; i++;
  }
  const nguoiDan = moi({ da: MAU_DA[2], ao: 0x2a4a6a, toc: 0x8a5a2a, mu: 0x6a2a2a }, { vai: 'dan' });
  { const g = new THREE.Group(); const hop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), vlCoc); hop.scale.set(1, 1.25, 0.45); const can = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.03), vlCoc); can.position.y = 0.38; g.add(hop, can); g.position.set(0.04, -0.12, 0.2); g.rotation.z = -0.95; nguoiDan.n.cam(g, 'nguc'); }
  datO(nguoiDan, q.dan.x, q.dan.z, Math.atan2(0 - q.dan.x, 0 - q.dan.z)); nguoiDan.ngoi = q.SAN + 0.45; nguoiDan.loop = 'dan';
  const chu = moi({ da: MAU_DA[1], ao: 0xd8c8a8, quan: 0x3a2a1a, toc: 0x3a2a1a, co: 1.06 }, { vai: 'chu', coVa: true, dich: 0 });
  datO(chu, q.quay.x, q.quay.z - 0.85, 0);
  const pv = moi({ da: MAU_DA[4], ao: 0x8a2a3a, quan: 0x4a2a2a, toc: 0x5a2a10, co: 0.93 }, { vai: 'phucVu', coVa: true, buoc: 0, duong: [] });
  { const k = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.3), vlCoc); k.position.set(0.22, -0.02, 0.18); pv.n.cam(k, 'tayT'); const c1 = coc(); c1.position.set(0.12, 0.07, 0.15); k.add(c1); }
  datO(pv, 2.2, -1.85, Math.PI);
  for (const [lx, nh] of [[-0.3, 0.5], [0.5, -0.5]]) { const p = moi({ da: MAU_DA[(i++) % 5], ao: MAU_AO[(i * 5) % 8], toc: 0x2b1d14 }, { vai: 'quay', coVa: true, nh }); p.n.cam(coc()); datO(p, lx, q.quay.z + 0.75, Math.PI + nh); p.loop = 'uong'; }
  const say = moi({ da: MAU_DA[3], ao: 0x5a5a3a, toc: 0x1a1a1a }, { vai: 'say', coVa: true, dich: null });
  say.n.cam(coc()); datO(say, -1.2, 0.5, 0); say.loop = 'say';

  const LOI_BAN = [[-0.8, 0.45], [0.6, 0.85], [3.9, 0.55], [-1.6, -0.5]]; // chỗ cô phục vụ đứng phục vụ từng bàn
  const tinhDuong = (ban) => { const [bx, bz] = LOI_BAN[ban]; return [[2.2, -1.85], [2.2, 0.45], [bx, 0.45], [bx, bz]]; };

  return {
    ds,
    capNhat(dt, nguoiChoi) {
      for (const p of ds) {
        p.tg -= dt; p.toc = 0; p.huongDich = null;
        if (p.vai === 'khach') {
          if (p.tg <= 0) { p.tg = 5 + Math.random() * 8; p.loop = ['uong', 'noi', 'cuoi', 'uong'][Math.floor(Math.random() * 4)];
            if (Math.random() < 0.12) for (const o of ds) if (o.vai === 'khach' && o.ghe.ban === p.ghe.ban) o.n.lam('cungLy'); }
        } else if (p.vai === 'chu') {
          if (p.tg <= 0) { p.tg = 3 + Math.random() * 5; p.dich = q.quay.x - 2.6 + Math.random() * 5.2; p.loop = Math.random() < 0.6 ? 'lau' : 'noi'; }
          if (p.dich != null && !di(p, p.dich, q.quay.z - 0.85, 1.0, dt)) p.loop = null; else p.huongDich = q.ry;
        } else if (p.vai === 'phucVu') {
          p.loop = 'khay';
          if (!p.duong.length) { if (p.tg <= 0) { const d = tinhDuong(Math.floor(Math.random() * 4)); p.duong = [...d, ...d.slice(0, -1).reverse()]; p.cho = 0; } }
          else { const [lx, lz] = p.duong[0]; if (di(p, lx, lz, 1.25, dt)) { p.duong.shift(); if (p.duong.length === 3 || !p.duong.length) { p.tg = 2 + Math.random() * 2; p.loop = 'noi'; } } }
          if (p.duong.length && p.duong.length !== 3 && p.tg > 0) p.duong.unshift(p.duong[0]); // đứng chờ ở bàn / quầy
        } else if (p.vai === 'quay') {
          if (p.tg <= 0) { p.tg = 4 + Math.random() * 6; p.loop = Math.random() < 0.5 ? 'uong' : 'noi'; p.quayVao = Math.random() < 0.5; }
          p.huongDich = q.ry + Math.PI + (p.quayVao ? 0 : (p.nh > 0 ? 1.4 : -1.4));
        } else if (p.vai === 'say') {
          if (!p.dich || p.tg <= 0) { p.dich = [-4 + Math.random() * 8, 0.1 + Math.random() * 0.7]; p.tg = 6 + Math.random() * 6; if (Math.random() < 0.15) p.n.lam('nga'); }
          if (p.n.viec !== 'nga') di(p, p.dich[0] + Math.sin(performance.now() / 700) * 0.4, p.dich[1], 0.7, dt);
        }
        // người chơi đứng sát thì quay ra nhìn
        if (nguoiChoi && p.vai !== 'khach' && p.vai !== 'dan' && Math.hypot(nguoiChoi.x - p.x, nguoiChoi.z - p.z) < 1.6) p.huongDich = Math.atan2(nguoiChoi.x - p.x, nguoiChoi.z - p.z);
        if (p.huongDich != null) p.huong = quay(p.huong, p.huongDich, 1 - Math.exp(-dt * 6));
        p.n.goc.position.set(p.x, p.ngoi ? q.SAN - 0.02 : q.SAN, p.z); p.n.goc.rotation.y = p.huong;
        if (p.b) p.b.setNextKinematicTranslation({ x: p.x, y: q.SAN + 0.82, z: p.z });
        p.n.capNhat(dt, { toc: p.toc, nen: true, ngoiGhe: p.ngoi, loop: p.loop });
      }
    },
  };
}
