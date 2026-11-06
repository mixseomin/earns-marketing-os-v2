// MELLIS HB-7: hình khối dựng bằng mã. Đầu hướng +x, trên là +y, phải là +z; 1 đơn vị = 10 mm.
// Mỗi cụm là một "phần" (part) có vị trí lắp ráp, hướng bay ra khi tách rời, độ trễ và vòng xoay riêng.
// pose(s) đặt cả con ong từ state của kin.js: cánh theo pha, chân theo IK, bụng mở, các phần bay ra.
import * as THREE from 'three';
import {LEG, legIK, ss} from './kin.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;

export function makeMats() {
  return {
    white: new THREE.MeshPhysicalMaterial({color: '#f4f2ee', roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.22}),
    shell: new THREE.MeshPhysicalMaterial({color: '#f4f2ee', roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.22, side: THREE.DoubleSide}),
    orange: new THREE.MeshPhysicalMaterial({color: '#ea5523', roughness: 0.4, clearcoat: 0.45}),
    dark: new THREE.MeshStandardMaterial({color: '#2b2c30', roughness: 0.46, metalness: 0.5}),
    steel: new THREE.MeshStandardMaterial({color: '#a6abb1', roughness: 0.32, metalness: 0.92}),
    glass: new THREE.MeshPhysicalMaterial({color: '#0c0d10', roughness: 0.05, clearcoat: 1, metalness: 0.25}),
    lens: new THREE.MeshStandardMaterial({color: '#ff8048', emissive: '#ff5a1c', emissiveIntensity: 0.55, roughness: 0.3}),
    membrane: new THREE.MeshPhysicalMaterial({color: '#eaf0f4', roughness: 0.25, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false}),
    vein: new THREE.LineBasicMaterial({color: '#2c2f33', transparent: true, opacity: 0.8}),
    rim: new THREE.LineBasicMaterial({color: '#2c2f33', transparent: true, opacity: 0.45}),
  };
}

const mesh = (geo, mat, [x, y, z] = [0, 0, 0], shadow = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
// ống dọc trục x từ x0 tới x1
const rod = (r, x0, x1, mat, seg = 16) => {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return mesh(g, mat);
};
// vành khuyên quay mặt theo trục x
const ringX = (r, tube, mat, x = 0) => {
  const g = new THREE.TorusGeometry(r, tube, 12, 48);
  g.rotateY(Math.PI / 2);
  return mesh(g, mat, [x, 0, 0]);
};
// bánh răng trục z
function gear(r, teeth, thick, mat, hub) {
  const g = new THREE.Group();
  const body = new THREE.CylinderGeometry(r * 0.86, r * 0.86, thick, 40);
  body.rotateX(Math.PI / 2);
  g.add(mesh(body, mat));
  const tooth = new THREE.BoxGeometry(r * 0.2, r * 0.22, thick);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const m = mesh(tooth, mat, [Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, 0]);
    m.rotation.z = a;
    g.add(m);
  }
  const h = new THREE.CylinderGeometry(r * 0.28, r * 0.28, thick * 1.5, 20);
  h.rotateX(Math.PI / 2);
  g.add(mesh(h, hub));
  return g;
}
// mặt tròn xoay quanh trục x từ biên dạng [(x, r)…]; phi chọn nửa trên / nửa dưới
function latheX(prof, mat, phiStart = 0, phiLen = Math.PI * 2, seg = 40) {
  const pts = prof.map(([x, r]) => new THREE.Vector2(Math.max(1e-4, r), x));
  const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLen);
  g.rotateZ(-Math.PI / 2); // trục y của lathe → trục x; phi 0..π nằm nửa dưới (-y), π..2π nửa trên
  return mesh(g, mat);
}
const capsuleProf = (r, half, n = 14) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    p.push([-half + r * Math.sin(a), r * Math.cos(a)]);
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    p.push([half + r * Math.sin(a), r * Math.cos(a)]);
  }
  return p;
};

// cánh: biên dạng trong mặt phẳng ngang (x = dây cung, z = sải ra ngoài), gốc ở bản lề
function wingGeom(len, chord) {
  const s = new THREE.Shape();
  const P = (u, v) => new THREE.Vector2(v * chord, u * len); // u dọc sải 0..1, v dọc dây cung
  s.moveTo(0, 0);
  s.splineThru([P(0.1, 0.32), P(0.45, 0.46), P(0.8, 0.38), P(1, 0.12), P(0.97, -0.2), P(0.75, -0.5), P(0.4, -0.58), P(0.12, -0.36), P(0, 0)]);
  const g = new THREE.ShapeGeometry(s, 40);
  g.rotateX(Math.PI / 2); // (x, y) → (x, 0, y)
  // gân: một gân chính sát mép trước, các gân toả từ gốc, hai gân ngang
  const L = [];
  const seg = (a, b) => L.push(V(a.x, 0.002, a.y), V(b.x, 0.002, b.y));
  const lead = [P(0, 0.05), P(0.3, 0.3), P(0.6, 0.36), P(0.85, 0.27), P(1, 0.1)];
  for (let i = 0; i < lead.length - 1; i++) seg(lead[i], lead[i + 1]);
  for (const [u, v] of [[0.95, -0.12], [0.8, -0.4], [0.6, -0.52], [0.38, -0.55]]) seg(P(0.02, 0), P(u, v));
  seg(P(0.45, 0.33), P(0.42, -0.5));
  seg(P(0.7, 0.33), P(0.68, -0.4));
  const vg = new THREE.BufferGeometry().setFromPoints(L);
  const rim = new THREE.BufferGeometry().setFromPoints(s.getSpacedPoints(80).map((p) => V(p.x, 0.001, p.y)));
  return {g, vg, rim};
}

const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function buildBee(mats) {
  const M = mats;
  const root = new THREE.Group(); // thân bay: vị trí + bàn xoay + nghiêng
  const parts = [];
  const anchors = {};
  const part = (name, base, dir, dist, delay, spin = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.position.copy(base);
    root.add(g);
    const p = {name, g, base: base.clone(), dir: dir.clone().normalize(), dist, delay, spin: V(...spin), shift: V(0, 0, 0)};
    parts.push(p);
    return p;
  };
  const anchor = (key, parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    anchors[key] = o;
  };

  // ---------------------------------------------------------------- đầu: vỏ, mắt quang học, râu
  const HEAD = V(1.62, 0.12, 0);
  const head = part('head', HEAD, V(1, 0.22, 0), 1.7, 0.06, [0, 0.35, 0.15]);
  head.g.add(mesh(new THREE.SphereGeometry(0.52, 48, 32), M.white));
  for (const z of [-1, 1]) {
    const pod = mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 16), M.orange, [0.08, 0.06, 0.44 * z]);
    pod.rotation.x = Math.PI / 2;
    head.g.add(pod);
    const jaw = rod(0.045, 0.3, 0.62, M.dark);
    jaw.position.set(0, -0.38, 0.12 * z);
    jaw.rotation.z = -0.35;
    head.g.add(jaw);
  }
  head.g.add(ringX(0.43, 0.03, M.dark, 0.36));
  const optic = part('optic', HEAD.clone().add(V(0.02, 0, 0)), V(1, 0.12, 0), 2.4, 0, [0.6, 0, 0]);
  optic.g.add(mesh(new THREE.SphereGeometry(0.3, 40, 28), M.glass, [0.3, 0, 0]));
  optic.g.add(ringX(0.33, 0.055, M.orange, 0.44));
  optic.g.add(mesh(new THREE.SphereGeometry(0.085, 24, 16), M.lens, [0.56, 0, 0]));
  optic.g.add(ringX(0.16, 0.018, M.steel, 0.55));
  anchor('optic', optic.g, 0.6, 0.12, 0);
  for (const z of [-1, 1]) {
    const ant = part('antenna', HEAD.clone().add(V(0.15, 0.42, 0.14 * z)), V(0.8, 1, 0.35 * z), 1.5, 0.1, [0.3 * z, 0, 0.3]);
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.25, 0.5, 0.12 * z), V(0.55, 0.85, 0.24 * z), V(0.9, 1.0, 0.3 * z)]);
    ant.g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.022, 8), M.dark));
    ant.g.add(mesh(new THREE.SphereGeometry(0.055, 16, 12), M.orange, [0.9, 1.0, 0.3 * z]));
    ant.g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), M.orange));
  }

  // ---------------------------------------------------------------- cổ: ổ bi 3 bậc tự do
  const neck = part('neck', V(1.06, 0.06, 0), V(1, -0.35, 0), 0.9, 0.12, [0.8, 0, 0]);
  neck.g.add(rod(0.19, -0.18, 0.18, M.dark));
  neck.g.add(ringX(0.21, 0.04, M.orange, 0.04));
  neck.g.add(ringX(0.2, 0.02, M.steel, -0.08));
  anchor('neck', neck.g, 0.04, 0.24, 0);

  // ---------------------------------------------------------------- ngực: hai nửa vỏ, khung, bộ truyền bánh răng
  const TH = V(0.34, 0, 0);
  const prof = capsuleProf(0.58, 0.3);
  const top = part('shellTop', TH, V(0, 1, 0), 1.25, 0.16, [0.15, 0, 0.12]);
  top.g.add(latheX(prof, M.shell, Math.PI, Math.PI));
  const bot = part('shellBot', TH, V(0, -1, 0), 1.1, 0.2, [-0.15, 0, -0.1]);
  bot.g.add(latheX(prof, M.shell, 0, Math.PI));
  for (const z of [-1, 1]) {
    const plate = part('plate', TH.clone().add(V(0, 0, 0.3 * z)), V(0, 0.1, z), 0.75, 0.24, [0, 0, 0.3 * z]);
    const pg = new THREE.CylinderGeometry(0.42, 0.42, 0.035, 40);
    pg.rotateX(Math.PI / 2);
    plate.g.add(mesh(pg, M.dark));
  }
  const gears = [];
  for (const [i, [x, y, r, n, mat, ratio]] of [[0, 0, 0.3, 20, M.orange, 1], [0.3, 0.2, 0.15, 11, M.dark, -2], [-0.27, 0.2, 0.15, 11, M.dark, -2], [0.05, -0.27, 0.12, 9, M.steel, -2.5]].entries()) {
    const gp = part('gear', TH.clone().add(V(x, y, 0.06 * (i % 2 ? 1 : -1))), V(x * 0.6, 0.25 + y, i % 2 ? 1 : -1), 0.45 + 0.18 * i, 0.26 + 0.03 * i, [0, 0, 1.2]);
    const gg = gear(r, n, 0.07, mat, M.steel);
    gp.g.add(gg);
    gears.push({g: gg, ratio});
    if (i === 0) anchor('gears', gp.g, 0, r, 0);
  }

  // ---------------------------------------------------------------- bản lề cánh và bốn cánh (mỗi cánh có 5 bóng mờ chuyển động)
  const wings = [];
  const fore = wingGeom(2.7, 0.78);
  const hind = wingGeom(1.7, 0.52);
  for (const z of [-1, 1]) {
    const hp = part('hinge', V(0.42, 0.5, 0.4 * z), V(0, 0.5, z), 0.95, 0.3, [0, 0, 0]);
    const hg = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 20);
    hg.rotateX(Math.PI / 2);
    hp.g.add(mesh(hg, M.dark));
    const cap = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20);
    cap.rotateX(Math.PI / 2);
    hp.g.add(mesh(cap, M.orange, [0, 0, 0.11 * z]));
    if (z > 0) anchor('hinge', hp.g, 0, 0.1, 0.12);
    for (const [k, w] of [[0, fore], [1, hind]]) {
      const wp = part('wing', V(0.42 - 0.22 * k, 0.5 - 0.03 * k, 0.48 * z), V(-0.25 * k, 0.45, z), 1.5 + 0.45 * k, 0.32 + 0.04 * k, [0.5 * z, 0.2, 0]);
      const mirror = new THREE.Group();
      mirror.scale.z = z;
      wp.g.add(mirror);
      const pivots = [];
      for (let gi = 0; gi < 6; gi++) {
        const pv = new THREE.Group();
        pv.rotation.order = 'YXZ';
        const mat = gi ? M.membrane.clone() : M.membrane;
        if (gi) mat.opacity = 0;
        pv.add(new THREE.Mesh(w.g, mat));
        if (!gi) {
          pv.add(new THREE.LineSegments(w.vg, M.vein));
          pv.add(new THREE.Line(w.rim, M.rim));
        }
        mirror.add(pv);
        pivots.push({pv, mat});
      }
      wings.push({pivots, hind: k === 1, side: z});
    }
  }

  // ---------------------------------------------------------------- bụng: năm đốt, vạch cam, pin trong, kim
  const ABD = [];
  const R = [0.55, 0.6, 0.58, 0.5, 0.38, 0.26];
  for (let i = 0; i < 5; i++) {
    const x0 = -0.22 - 0.42 * i;
    const seg = part('abd', V(x0, 0, 0), V(-1, i % 2 ? 0.12 : -0.12, 0), 0.6 + 0.45 * i, 0.36 + 0.03 * i, [0.5, 0, 0.12 * (i % 2 ? 1 : -1)]);
    const pr = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      pr.push([-0.42 * u, R[i] + (R[i + 1] - R[i]) * u + 0.035 * Math.sin(Math.PI * u)]);
    }
    seg.g.add(latheX(pr, M.shell));
    if (i % 2) seg.g.add(ringX(R[i] + 0.005, 0.035, M.orange, -0.03));
    ABD.push(seg);
    if (i === 1) anchor('abdomen', seg.g, -0.2, R[i] + 0.04, 0);
  }
  const cells = part('cells', V(-1.2, 0, 0), V(-0.35, -1, 0), 1.15, 0.42, [0.25, 0, 0]);
  for (const [x, y] of [[0.28, 0.08], [-0.28, 0.08]]) {
    const c = rod(0.17, x - 0.24, x + 0.24, M.orange);
    c.position.y = y;
    cells.g.add(c);
  }
  const board = new THREE.BoxGeometry(1.15, 0.04, 0.36);
  cells.g.add(mesh(board, M.dark, [0, -0.14, 0]));
  anchor('cells', cells.g, 0.28, 0.26, 0);
  const sting = part('sting', V(-2.32, 0, 0), V(-1, 0, 0), 2.9, 0.5, [0.6, 0, 0]);
  const cone = new THREE.ConeGeometry(0.26, 0.62, 32);
  cone.rotateZ(Math.PI / 2);
  sting.g.add(mesh(cone, M.dark, [-0.3, 0, 0]));
  const tip = new THREE.ConeGeometry(0.06, 0.2, 16);
  tip.rotateZ(Math.PI / 2);
  sting.g.add(mesh(tip, M.white, [-0.68, 0, 0]));

  // ---------------------------------------------------------------- sáu chân: servo hông, đùi trắng, gối, ống chân, bàn
  const legs = [];
  const HIPS = [[0.68, 52], [0.36, 92], [0.04, 132]];
  for (const z of [-1, 1])
    for (const [li, [hx, yaw]] of HIPS.entries()) {
      const dir = V(Math.cos(yaw * D2R) * 0.5, -0.7, Math.sin(yaw * D2R) * z);
      const lp = part('leg', V(hx, -0.36, 0.28 * z), dir, 1.05, 0.38 + 0.04 * li, [0, 0, 0]);
      const yawG = new THREE.Group();
      yawG.rotation.y = -yaw * D2R * z;
      lp.g.add(yawG);
      const sv = new THREE.CylinderGeometry(0.1, 0.1, 0.17, 20);
      sv.rotateX(Math.PI / 2);
      yawG.add(mesh(sv, M.dark));
      const svc = new THREE.TorusGeometry(0.1, 0.022, 8, 24);
      yawG.add(mesh(svc, M.orange, [0, 0, 0.09]));
      const femur = new THREE.Group();
      yawG.add(femur);
      femur.add(rod(0.052, 0, LEG.L1, M.white));
      const knee = new THREE.Group();
      knee.position.x = LEG.L1;
      femur.add(knee);
      knee.add(mesh(new THREE.SphereGeometry(0.075, 20, 14), M.dark));
      const kc = new THREE.CylinderGeometry(0.06, 0.06, 0.17, 18);
      kc.rotateX(Math.PI / 2);
      knee.add(mesh(kc, M.orange));
      knee.add(rod(0.032, 0, LEG.L2, M.dark));
      const foot = mesh(new THREE.SphereGeometry(0.05, 14, 10), M.dark, [LEG.L2, 0, 0]);
      knee.add(foot);
      const hook = new THREE.ConeGeometry(0.035, 0.14, 10);
      hook.rotateZ(Math.PI / 2);
      knee.add(mesh(hook, M.white, [LEG.L2 + 0.08, 0, 0]));
      if (z > 0 && li === 2) anchor('leg', knee, 0, 0.08, 0);
      legs.push({femur, knee, hipY: -0.36, reach: [1.3, 1.2, 1.35][li], side: z, li});
    }

  // ---------------------------------------------------------------- mảnh vụn: vít và mẩu cam bay ra lúc tách rời
  const r = rnd(4242);
  const debris = [];
  const screw = new THREE.CylinderGeometry(0.028, 0.028, 0.13, 8);
  const bit = new THREE.BoxGeometry(0.09, 0.05, 0.13);
  const nS = 48;
  const nB = 24;
  const iS = new THREE.InstancedMesh(screw, M.dark, nS);
  const iB = new THREE.InstancedMesh(bit, M.orange, nB);
  iS.castShadow = iB.castShadow = true;
  root.add(iS, iB);
  for (let i = 0; i < nS + nB; i++) {
    const p0 = V(-2.1 + r() * 3.9, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7);
    const d = V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9).add(V(p0.x * 0.15, p0.y, p0.z)).normalize();
    debris.push({p0, d, dist: 0.9 + r() * 1.7, delay: 0.1 + r() * 0.45, ax: V(r(), r(), r()).normalize(), sp: 2 + r() * 6});
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = V(1, 1, 1);
  const zero = V(0, 0, 0);
  const tmp = V(0, 0, 0);
  const eul = new THREE.Euler();

  /** s: state(t) của kin.js; s.explode là hàm (t) → 0..1, mỗi phần đọc với độ trễ của nó */
  function pose(s) {
    const t = s.t;
    // bụng mở: các đốt trượt lùi, pin hạ xuống lộ ra
    ABD.forEach((p, i) => p.shift.set(-0.3 * i * s.open, 0, 0));
    cells.shift.set(-0.4 * s.open, -0.05 * s.open, 0);
    sting.shift.set(-1.35 * s.open, 0, 0);
    for (const p of parts) {
      const e = s.explode(t - p.delay);
      p.g.position.copy(p.base).add(p.shift).addScaledVector(p.dir, p.dist * e);
      eul.set(p.spin.x * e, p.spin.y * e, p.spin.z * e);
      p.g.quaternion.setFromEuler(eul);
    }
    // bộ truyền quay theo pha cánh
    for (const g of gears) g.g.rotation.z = s.phase * 0.25 * g.ratio;
    // cánh
    const open = ss(0, 1, s.u * 1.6); // cánh xoè ra trước khi đập
    const flap = s.u;
    for (const w of wings) {
      w.pivots.forEach(({pv, mat}, gi) => {
        const ph = s.phase - gi * 0.5 + (w.hind ? 0.35 : 0);
        const stroke = -78 + 78 * open + (w.hind ? -12 : 8) * open + 0.55 * s.amp * Math.cos(ph);
        const elev = 9 + 4 * (w.hind ? -1 : 1) + 30 * flap * Math.sin(ph);
        const pitch = 38 * flap * Math.cos(ph);
        pv.rotation.set(-elev * D2R, stroke * D2R, pitch * D2R);
        if (gi) mat.opacity = 0.13 * (1 - gi / 7) * s.blur * ss(0.05, 0.5, flap);
      });
    }
    // chân: chạm đất thì IK tới điểm trên sàn, bay thì buông thõng
    const bodyY = s.bodyY;
    for (const L of legs) {
      const gx = L.reach;
      const gy = -bodyY - L.hipY + 0.05;
      const ax = 0.42 + 0.12 * L.li + 0.04 * Math.sin(t * 1.3 + L.li);
      const ay = -0.82 + 0.05 * Math.sin(t * 1.1 + L.li * 2);
      const k = s.air;
      const {a1, a2} = legIK(gx + (ax - gx) * k, gy + (ay - gy) * k);
      L.femur.rotation.z = a1;
      L.knee.rotation.z = a2 - a1;
    }
    // mảnh vụn
    let i = 0;
    for (const d of debris) {
      const e = s.explode(t - d.delay);
      const im = i < nS ? iS : iB;
      const j = i < nS ? i : i - nS;
      if (e < 0.01) m4.compose(d.p0, q.identity(), zero);
      else {
        tmp.copy(d.p0).addScaledVector(d.d, d.dist * e);
        q.setFromAxisAngle(d.ax, d.sp * e);
        m4.compose(tmp, q, one);
      }
      im.setMatrixAt(j, m4);
      i++;
    }
    iS.instanceMatrix.needsUpdate = iB.instanceMatrix.needsUpdate = true;
  }

  return {root, parts, anchors, pose, STAND_Y: 1.0};
}
