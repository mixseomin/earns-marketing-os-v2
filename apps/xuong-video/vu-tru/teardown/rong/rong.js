// IGNIS DR-3: rồng máy dựng bằng mã. Đầu hướng +x, trên +y, phải +z; 1 đơn vị = 25 cm.
// Thân là các "phần" (part) phẳng dưới root, có hướng bay ra khi tách rời. Cổ và đuôi là chuỗi đốt lồng nhau: tách rời thì
// mỗi khớp giãn ra một khoảng, nên cả chuỗi xoè đều như bản vẽ lắp ráp. pose(s) đặt mọi khớp từ state của kin.js:
// cánh theo pha đập, chân theo IK, pít-tông chân bám đúng hai điểm neo, màng cánh căng giữa các xương ngón, lửa phun từ họng.
import * as THREE from 'three';
import {LEG, legIK, ss} from './kin.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const lerp = (a, b, k) => a + (b - a) * k;

export function makeMats() {
  const side = THREE.DoubleSide;
  return {
    armor: new THREE.MeshPhysicalMaterial({color: '#c9ccd2', metalness: 0.72, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.3, side}),
    plate: new THREE.MeshPhysicalMaterial({color: '#3b4048', metalness: 0.62, roughness: 0.36, clearcoat: 0.5, side}),
    copper: new THREE.MeshStandardMaterial({color: '#c8743a', metalness: 0.9, roughness: 0.3}),
    dark: new THREE.MeshStandardMaterial({color: '#1d1f24', metalness: 0.5, roughness: 0.5}),
    steel: new THREE.MeshStandardMaterial({color: '#aab0b7', metalness: 0.94, roughness: 0.24}),
    rivet: new THREE.MeshStandardMaterial({color: '#e2c08f', metalness: 0.9, roughness: 0.35}),
    teeth: new THREE.MeshStandardMaterial({color: '#ebe6dc', roughness: 0.38, metalness: 0.15}),
    membrane: new THREE.MeshStandardMaterial({color: '#8a3420', roughness: 0.58, metalness: 0.08, side}),
    vein: new THREE.LineBasicMaterial({color: '#2a120c', transparent: true, opacity: 0.55}),
    eye: new THREE.MeshStandardMaterial({color: '#ffb347', emissive: '#ff9a1f', emissiveIntensity: 0.2, roughness: 0.25}),
    glass: new THREE.MeshPhysicalMaterial({color: '#0b0c0f', roughness: 0.04, clearcoat: 1, metalness: 0.3}),
    core: new THREE.MeshStandardMaterial({color: '#8af2ff', emissive: '#2fd0ff', emissiveIntensity: 0.6, roughness: 0.2}),
    seam: new THREE.MeshStandardMaterial({color: '#ff8a3c', emissive: '#ff5a1c', emissiveIntensity: 0.4, roughness: 0.3}),
  };
}

const mesh = (geo, mat, [x, y, z] = [0, 0, 0], shadow = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
// ống dọc trục x từ x0 tới x1, thuôn từ r0 tới r1
const rodX = (r0, r1, x0, x1, mat, seg = 16) => {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(x1 - x0), seg);
  g.rotateZ(x1 > x0 ? -Math.PI / 2 : Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return mesh(g, mat);
};
// ống dọc trục z từ 0 tới len (xương cánh)
const rodZ = (r0, r1, len, mat, seg = 14) => {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, len / 2);
  return mesh(g, mat);
};
const ringX = (r, tube, mat, x = 0) => {
  const g = new THREE.TorusGeometry(r, tube, 10, 40);
  g.rotateY(Math.PI / 2);
  return mesh(g, mat, [x, 0, 0]);
};
const ball = (r, mat, p, seg = 16) => mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7)), mat, p);
// mặt tròn xoay quanh trục x từ biên dạng [(x, r)…]; phi 0..π là nửa dưới (-y), π..2π nửa trên; 0..π/2 là phía +z dưới
function latheX(prof, mat, phiStart = 0, phiLen = Math.PI * 2, seg = 36) {
  const pts = prof.map(([x, r]) => new THREE.Vector2(Math.max(1e-4, r), x));
  const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLen);
  g.rotateZ(-Math.PI / 2);
  return mesh(g, mat);
}
// biên dạng thuôn từ (x0, r0) tới (x1, r1), phồng giữa một chút
const taper = (x0, x1, r0, r1, bulge = 0.04, n = 8) => Array.from({length: n + 1}, (_, k) => {
  const u = k / n;
  return [lerp(x0, x1, u), lerp(r0, r1, u) + bulge * Math.sin(Math.PI * u)];
});
// gai: nón dựng trên lưng, nghiêng về sau
const spike = (h, r, mat, p, lean = -0.5) => {
  const g = new THREE.ConeGeometry(r, h, 10);
  g.translate(0, h / 2, 0);
  const m = mesh(g, mat, p);
  m.rotation.z = lean;
  return m;
};
const rivetGeo = new THREE.SphereGeometry(0.018, 6, 4);
const rivet = (parent, mat, p) => parent.add(mesh(rivetGeo, mat, p, false));
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function buildDragon(M) {
  const root = new THREE.Group();
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
    return o;
  };

  // ================================================================ thân: khung xương, lõi, tua-bin, vỏ trên, bụng, hai cửa ngực
  const frame = part('frame', V(0, 0, 0), V(0, 1, 0), 0, 0);
  frame.g.add(rodX(0.09, 0.08, -1.35, 1.25, M.steel));
  for (let i = 0; i < 7; i++) {
    const x = -1.1 + i * 0.36;
    const r = 0.5 - 0.06 * Math.abs(i - 3.2) * 0.6;
    const rib = new THREE.TorusGeometry(r, 0.03, 8, 30, Math.PI * 1.25);
    rib.rotateY(Math.PI / 2);
    rib.rotateX(-Math.PI * 0.125 - Math.PI / 2);
    frame.g.add(mesh(rib, i % 2 ? M.dark : M.steel, [x, 0, 0]));
  }
  // dây cáp chạy dọc sườn
  for (const z of [-1, 1])
    for (const [k, mat] of [[0, M.copper], [1, M.dark]]) {
      const c = new THREE.CatmullRomCurve3([V(1.25, 0.18 - 0.06 * k, 0.12 * z), V(0.6, -0.05, (0.36 + 0.04 * k) * z), V(-0.3, -0.12, (0.4 + 0.03 * k) * z), V(-1.2, 0.05 - 0.05 * k, 0.2 * z)]);
      frame.g.add(mesh(new THREE.TubeGeometry(c, 40, 0.022, 6), mat));
    }
  anchor('frame', frame.g, -0.4, 0.3, 0);

  const core = part('core', V(0.3, -0.06, 0), V(0.2, 0.15, 0), 0.0, 0.0);
  core.g.add(ball(0.27, M.core, [0, 0, 0], 32));
  core.g.add(ringX(0.3, 0.022, M.steel, 0));
  const coreLight = new THREE.PointLight('#53dcff', 0, 6, 1.6);
  core.g.add(coreLight);
  const gyro = [];
  for (const [r, mat] of [[0.36, M.copper], [0.44, M.steel]]) {
    const gg = new THREE.Group();
    gg.add(mesh(new THREE.TorusGeometry(r, 0.022, 8, 48), mat));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      gg.add(ball(0.03, M.dark, [Math.cos(a) * r, Math.sin(a) * r, 0], 8));
    }
    core.g.add(gg);
    gyro.push(gg);
  }
  anchor('core', core.g, 0, 0.22, 0);

  const turbines = [];
  for (const z of [-1, 1]) {
    const tb = part('turbine', V(0.82, -0.16, 0.27 * z), V(0.35, -0.2, z), 0, 0);
    tb.g.add(rodX(0.15, 0.13, -0.16, 0.16, M.dark, 24));
    tb.g.add(ringX(0.155, 0.018, M.copper, 0.16));
    const rotor = new THREE.Group();
    rotor.position.x = 0.17;
    for (let i = 0; i < 11; i++) {
      const b = mesh(new THREE.BoxGeometry(0.012, 0.12, 0.045), M.steel, [0, 0.07, 0]);
      const arm = new THREE.Group();
      arm.rotation.x = (i / 11) * Math.PI * 2;
      b.rotation.y = 0.5;
      arm.add(b);
      rotor.add(arm);
    }
    rotor.add(ball(0.04, M.copper, [0.01, 0, 0], 12));
    tb.g.add(rotor);
    turbines.push(rotor);
    if (z > 0) anchor('turbine', tb.g, 0.17, 0.1, 0.05);
  }

  // vỏ trên: nửa trên thân, vảy giáp xếp lớp, gai lưng, đinh tán
  const TORSO = [[-1.35, 0.36], [-1.0, 0.5], [-0.4, 0.58], [0.2, 0.62], [0.8, 0.56], [1.2, 0.44], [1.35, 0.34]];
  const torsoR = (x) => {
    for (let i = 0; i < TORSO.length - 1; i++)
      if (x <= TORSO[i + 1][0]) return lerp(TORSO[i][1], TORSO[i + 1][1], (x - TORSO[i][0]) / (TORSO[i + 1][0] - TORSO[i][0]));
    return TORSO[TORSO.length - 1][1];
  };
  const smoothTorso = Array.from({length: 25}, (_, k) => {
    const x = -1.35 + (2.7 * k) / 24;
    return [x, torsoR(x)];
  });
  const dorsal = part('dorsal', V(0, 0, 0), V(0, 1, 0), 1.25, 0.12, [0, 0, 0.12]);
  dorsal.g.add(latheX(smoothTorso, M.armor, Math.PI, Math.PI));
  const R = rnd(91);
  for (let i = 0; i < 9; i++) {
    const x0 = 1.2 - i * 0.29;
    const x1 = x0 - 0.36;
    for (const [p0, pl] of [[Math.PI * 1.5 - 0.42, 0.84], [Math.PI * 1.06, 0.4], [Math.PI * 1.54 + 0.42, 0.4]]) {
      const pr = taper(x0, x1, torsoR(x0) * 1.035 + 0.01, torsoR(x1) * 1.035 + 0.03, 0.015, 5);
      dorsal.g.add(latheX(pr, M.plate, p0, pl, 10));
    }
    dorsal.g.add(spike(0.22 - 0.012 * Math.abs(i - 2) * 1.2, 0.05, M.copper, [x0 - 0.12, torsoR(x0 - 0.12) + 0.02, 0], -0.6));
    for (const a of [-0.55, 0.55]) {
      const r = torsoR(x0 - 0.05) * 1.05 + 0.02;
      rivet(dorsal.g, M.rivet, [x0 - 0.05, r * Math.cos(a), r * Math.sin(a)]);
    }
    if (R() > 0.3) rivet(dorsal.g, M.rivet, [x0 - 0.2, torsoR(x0) * 0.92, torsoR(x0) * 0.42]);
  }
  // khe tản nhiệt phát sáng theo lõi
  for (const z of [-1, 1])
    for (let k = 0; k < 4; k++) {
      const s = mesh(new THREE.BoxGeometry(0.16, 0.012, 0.03), M.seam, [0.25 - k * 0.2, 0.45, 0.3 * z], false);
      s.rotation.x = 0.7 * z;
      dorsal.g.add(s);
    }

  // bụng sau + hai cửa ngực (bản lề ở mép trên, mở ra ngoài cho thấy lõi và tua-bin)
  const belly = part('belly', V(0, 0, 0), V(0, -1, 0), 1.0, 0.18, [0, 0, -0.1]);
  belly.g.add(latheX(smoothTorso.filter(([x]) => x <= -0.1), M.armor, 0, Math.PI));
  for (let i = 0; i < 4; i++) {
    const x0 = -0.15 - i * 0.3;
    belly.g.add(latheX(taper(x0, x0 - 0.32, torsoR(x0) * 1.03, torsoR(x0 - 0.32) * 1.03, 0.012, 4), M.plate, Math.PI * 0.5 - 0.5, 1.0, 8));
  }
  const doors = [];
  for (const z of [-1, 1]) {
    const hz = 0.6 * z;
    const door = part('door', V(0, 0, hz), V(0.15, -0.3, z), 1.1, 0.2, [0.6 * z, 0, 0]);
    const hinge = new THREE.Group();
    door.g.add(hinge);
    const front = smoothTorso.filter(([x]) => x >= -0.12);
    const dm = latheX(front, M.armor, z > 0 ? 0 : Math.PI / 2, Math.PI / 2, 18);
    dm.position.z = -hz;
    hinge.add(dm);
    for (let k = 0; k < 3; k++) {
      const pr = taper(1.0 - k * 0.38, 0.62 - k * 0.38, torsoR(1.0 - k * 0.38) * 1.04, torsoR(0.62 - k * 0.38) * 1.04, 0.012, 4);
      const pm = latheX(pr, M.plate, z > 0 ? 0.15 : Math.PI / 2 + 0.15, Math.PI / 2 - 0.3, 8);
      pm.position.z = -hz;
      hinge.add(pm);
    }
    hinge.add(rodX(0.03, 0.03, -0.1, 1.15, M.copper, 8));
    doors.push({hinge, z});
  }

  // ================================================================ cổ: 7 đốt lồng nhau, mỗi đốt có giáp, vảy lưng, gai, pít-tông bụng
  const neckBase = part('neck', V(1.2, 0.26, 0), V(1, 0.35, 0), 0.55, 0.1);
  const neck = [];
  let parent = neckBase.g;
  const NL = 0.42;
  for (let i = 0; i < 7; i++) {
    const r = 0.34 - i * 0.022;
    const j = new THREE.Group();
    j.position.x = i === 0 ? 0 : NL;
    parent.add(j);
    j.add(ball(r * 0.6, M.dark, [0, 0, 0], 16));
    j.add(rodX(r * 0.5, r * 0.46, 0, NL, M.dark, 14));
    j.add(ringX(r * 0.66, 0.022, M.copper, 0.03));
    j.add(latheX(taper(0.04, NL + 0.06, r * 0.98, r * 0.88, 0.03, 6), M.armor, Math.PI - 0.55, Math.PI + 1.1, 20));
    j.add(latheX(taper(0.0, NL + 0.1, r * 1.1, r * 0.98, 0.025, 6), M.plate, Math.PI * 1.5 - 0.5, 1.0, 10));
    j.add(spike(0.2 - i * 0.012, 0.045, M.copper, [NL * 0.45, r * 1.05, 0], -0.7));
    for (const z of [-1, 1]) {
      const p = rodX(0.022, 0.022, 0.05, NL - 0.02, M.steel, 8);
      p.position.set(0, -r * 0.62, r * 0.36 * z);
      j.add(p);
      rivet(j, M.rivet, [NL * 0.3, r * 0.55, r * 0.72 * z]);
      rivet(j, M.rivet, [NL * 0.7, r * 0.5, r * 0.7 * z]);
    }
    neck.push(j);
    parent = j;
    if (i === 3) anchor('neck', j, NL * 0.5, r * 1.1, 0);
  }

  // ================================================================ đầu: sọ, mõm, răng, mắt, mày, sừng chia đốt, mào, hàm dưới, vòi đánh lửa
  const headG = new THREE.Group();
  headG.position.x = NL + 0.1;
  parent.add(headG);
  const hp = [];
  const sub = (dir, dist, spin = [0, 0, 0]) => {
    const g = new THREE.Group();
    headG.add(g);
    const o = {g, dir: dir.clone(), dist, spin: V(...spin)};
    hp.push(o);
    return g;
  };
  const skull = sub(V(0, 0.2, 0), 0.25);
  const cran = ball(0.3, M.armor, [0.08, 0.06, 0], 32);
  cran.scale.set(1.35, 0.95, 0.95);
  skull.add(cran);
  const snout = latheX(taper(0.25, 1.02, 0.2, 0.085, 0.02, 10), M.armor, 0, Math.PI * 2, 24);
  snout.scale.set(1, 0.78, 1);
  snout.position.y = 0.0;
  skull.add(snout);
  skull.add(latheX(taper(0.3, 0.95, 0.19, 0.08, 0.02, 6), M.plate, Math.PI * 1.5 - 0.6, 1.2, 10));
  for (const z of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const x = 0.38 + k * 0.088;
      const tg = new THREE.ConeGeometry(0.018, 0.075 - k * 0.004, 6);
      tg.rotateX(Math.PI);
      skull.add(mesh(tg, M.teeth, [x, -0.1 + k * 0.004, (0.135 - k * 0.008) * z], false));
    }
    skull.add(mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 14), M.dark, [1.0, 0.035, 0.035 * z]));
    const brow = mesh(new THREE.BoxGeometry(0.3, 0.035, 0.09), M.plate, [0.3, 0.2, 0.16 * z]);
    brow.rotation.set(0.35 * z, 0, -0.25);
    skull.add(brow);
    for (let k = 0; k < 3; k++) {
      const fr = mesh(new THREE.BoxGeometry(0.22 - k * 0.04, 0.012, 0.1), M.copper, [-0.18 - k * 0.07, 0.08 - k * 0.04, 0.26 * z]);
      fr.rotation.set(0.9 * z, 0.4 * z, -0.3 - k * 0.2);
      skull.add(fr);
    }
    rivet(skull, M.rivet, [0.55, 0.12, 0.15 * z]);
    rivet(skull, M.rivet, [0.75, 0.09, 0.12 * z]);
  }
  anchor('skull', skull, 0.1, 0.32, 0);
  const eyes = sub(V(0.6, 0.4, 0), 0.35);
  for (const z of [-1, 1]) {
    eyes.add(ball(0.06, M.eye, [0.34, 0.12, 0.185 * z], 18));
    eyes.add(mesh(new THREE.TorusGeometry(0.066, 0.012, 6, 20), M.dark, [0.34, 0.12, 0.19 * z]));
  }
  anchor('eye', eyes, 0.36, 0.14, 0.2);
  const horns = sub(V(-0.4, 1, 0), 0.45, [0, 0, 0.3]);
  const hornSegs = [];
  for (const z of [-1, 1])
    for (const [hx, hy, len, n] of [[-0.02, 0.24, 0.17, 5], [-0.12, 0.16, 0.12, 4]]) {
      let hpar = new THREE.Group();
      hpar.position.set(hx, hy, 0.13 * z);
      hpar.rotation.set(-0.35 * z, 0, 2.6);
      horns.add(hpar);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Group();
        s.position.y = k ? len * (1 - 0.12 * k) : 0;
        s.rotation.z = k ? 0.22 : 0;
        const cg = new THREE.ConeGeometry(0.05 * (1 - 0.18 * k), len * (1 - 0.1 * k) * 1.1, 10);
        cg.translate(0, (len * (1 - 0.1 * k) * 1.1) / 2, 0);
        s.add(mesh(cg, k % 2 ? M.plate : M.teeth));
        if (k < n - 1) s.add(mesh(new THREE.TorusGeometry(0.045 * (1 - 0.18 * k), 0.008, 6, 16), M.copper, [0, len * (1 - 0.12 * k), 0]).rotateX(Math.PI / 2));
        hpar.add(s);
        hpar = s;
        hornSegs.push(s);
      }
    }
  const jawG = sub(V(0.1, -1, 0), 0.45, [0, 0, -0.3]);
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0.02, -0.1, 0);
  jawG.add(jawPivot);
  const jm = latheX(taper(0.0, 0.92, 0.15, 0.06, 0.02, 8), M.armor, 0, Math.PI, 20);
  jm.scale.set(1, 0.7, 1);
  jawPivot.add(jm);
  jawPivot.add(latheX(taper(0.05, 0.85, 0.155, 0.065, 0.02, 6), M.plate, 0.5, Math.PI - 1.0, 10));
  for (const z of [-1, 1])
    for (let k = 0; k < 6; k++) {
      const tg = new THREE.ConeGeometry(0.016, 0.06, 6);
      jawPivot.add(mesh(tg, M.teeth, [0.4 + k * 0.085, 0.02, (0.1 - k * 0.007) * z], false));
    }
  anchor('jaw', jawPivot, 0.6, -0.08, 0.1);
  const nozzle = sub(V(1, -0.1, 0), 0.5);
  nozzle.add(rodX(0.05, 0.035, 0.35, 0.86, M.copper, 14));
  nozzle.add(ringX(0.04, 0.012, M.seam, 0.86));
  nozzle.position.y = -0.07;
  const mouth = anchor('mouth', headG, 0.95, -0.08, 0);

  // lửa: hạt phát sáng cộng dồn sống trong khung đầu; tuổi hạt = hàm của t, độ đậm theo nhịp phun lúc hạt sinh ra
  const NF = 720;
  const fPos = new Float32Array(NF * 3);
  const fCol = new Float32Array(NF * 3);
  const fSize = new Float32Array(NF);
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fgeo.setAttribute('fcol', new THREE.BufferAttribute(fCol, 3));
  fgeo.setAttribute('size', new THREE.BufferAttribute(fSize, 1));
  const fireU = {uPx: {value: 450}};
  const fmat = new THREE.ShaderMaterial({
    uniforms: fireU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `attribute float size; attribute vec3 fcol; varying vec3 vC;
      uniform float uPx;
      void main(){ vC = fcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPx * projectionMatrix[1][1] / -mv.z; }`,
    fragmentShader: `varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
        float a = pow(1.0 - r, 1.8); gl_FragColor = vec4(vC * a, 1.0); }`,
  });
  const fireMesh = new THREE.Points(fgeo, fmat);
  fireMesh.frustumCulled = false;
  fireMesh.renderOrder = 10;
  headG.add(fireMesh);
  const fr = rnd(777);
  const fireP = Array.from({length: NF}, () => ({L: 0.5 + 0.45 * fr(), o: fr(), th: fr() * Math.PI * 2, j: 0.5 + 0.9 * fr(), sw: (fr() - 0.5) * 7, v: 0.8 + 0.4 * fr(), hot: fr()}));
  const flameLight = new THREE.PointLight('#ff8a3a', 0, 16, 1.3);
  flameLight.position.set(1.8, -0.1, 0);
  headG.add(flameLight);
  // màu theo tuổi: lõi trắng vàng → cam → đỏ thẫm rồi tắt (cộng dồn nên chỗ dày tự sáng trắng)
  const FIRE_COL = [[0, '#fff0c0', 1.0], [0.12, '#ffc85a', 0.9], [0.32, '#ff7a22', 0.75], [0.6, '#d8380f', 0.45], [0.85, '#5a1606', 0.15], [1, '#000000', 0]].map(([k, c, a]) => [k, new THREE.Color(c), a]);
  const fireCol = (k, out) => {
    for (let i = 0; i < FIRE_COL.length - 1; i++)
      if (k <= FIRE_COL[i + 1][0]) {
        const u = (k - FIRE_COL[i][0]) / (FIRE_COL[i + 1][0] - FIRE_COL[i][0]);
        out.copy(FIRE_COL[i][1]).lerp(FIRE_COL[i + 1][1], u);
        return lerp(FIRE_COL[i][2], FIRE_COL[i + 1][2], u);
      }
    out.set(0, 0, 0);
    return 0;
  };

  // ================================================================ đuôi: 14 đốt lồng nhau hướng -x, lưỡi đuôi cuối
  const tailBase = part('tail', V(-1.32, 0.05, 0), V(-1, 0.1, 0), 0.6, 0.14);
  const tail = [];
  parent = tailBase.g;
  const TL = 0.4;
  for (let i = 0; i < 14; i++) {
    const r = 0.37 * (1 - i / 16.5);
    const j = new THREE.Group();
    j.position.x = i === 0 ? 0 : -TL;
    parent.add(j);
    j.add(ball(r * 0.6, M.dark, [0, 0, 0], 12));
    j.add(rodX(r * 0.5, r * 0.45, 0, -TL, M.dark, 12));
    j.add(latheX(taper(-0.03, -TL - 0.05, r * 0.98, r * 0.86, 0.025, 5), M.armor, Math.PI - 0.6, Math.PI + 1.2, 16));
    j.add(latheX(taper(0.0, -TL - 0.09, r * 1.1, r * 0.96, 0.02, 5), M.plate, Math.PI * 1.5 - 0.5, 1.0, 8));
    if (i % 2 === 0) j.add(ringX(r * 0.7, 0.016, M.copper, -0.04));
    j.add(spike(0.17 * (1 - i / 18), 0.04 * (1 - i / 20), i % 2 ? M.plate : M.copper, [-TL * 0.5, r * 1.04, 0], 0.65));
    for (const z of [-1, 1]) rivet(j, M.rivet, [-TL * 0.5, r * 0.5, r * 0.75 * z]);
    tail.push(j);
    parent = j;
    if (i === 6) anchor('tail', j, -TL * 0.5, r * 1.15, 0);
  }
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.lineTo(-0.25, 0.28);
  blade.lineTo(-0.75, 0.04);
  blade.lineTo(-0.25, -0.28);
  blade.lineTo(0, 0);
  const bg = new THREE.ExtrudeGeometry(blade, {depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1});
  bg.translate(0, 0, -0.015);
  bg.rotateX(Math.PI / 2);
  const bladeM = mesh(bg, M.copper, [-TL, 0, 0]);
  parent.add(bladeM);
  parent.add(rodX(0.025, 0.02, -TL, -TL - 0.6, M.steel, 8));
  anchor('fin', bladeM, -0.35, 0.02, 0);

  // ================================================================ bốn chân: vai giáp, đùi, ống, pít-tông thuỷ lực, bàn ba vuốt + cựa
  const legs = [];
  const HIPS = [[0.82, -0.26, 0.44, 'front', -1], [-0.86, -0.2, 0.48, 'rear', 1]];
  for (const z of [-1, 1])
    for (const [hx, hy, hzz, kind, knee] of HIPS) {
      const {L1, L2} = LEG[kind];
      const lp = part('leg', V(hx, hy, hzz * z), V(hx * 0.3, -0.8, z), 1.1, 0.3 + (kind === 'rear' ? 0.05 : 0), [0.25 * z, 0, 0]);
      const plane = new THREE.Group();
      plane.rotation.x = -0.06 * z;
      lp.g.add(plane);
      const pa = ball(0.24, M.armor, [0, 0.04, 0.03 * z], 24);
      pa.scale.set(1.1, 0.9, 0.8);
      lp.g.add(pa);
      lp.g.add(latheX(taper(-0.25, 0.25, 0.22, 0.2, 0.04, 6), M.plate, Math.PI * 1.25, Math.PI * 0.5 + 0.4, 10).rotateX(z > 0 ? 0.6 : -0.6));
      const thigh = new THREE.Group();
      plane.add(thigh);
      thigh.add(ball(0.15, M.dark, [0, 0, 0], 16));
      thigh.add(rodX(0.13, 0.085, 0, L1, M.armor, 16));
      thigh.add(latheX(taper(0.08, L1 * 0.75, 0.15, 0.11, 0.03, 5), M.plate, Math.PI * 0.5, Math.PI, 10));
      rivet(thigh, M.rivet, [L1 * 0.3, 0.12, 0.07]);
      rivet(thigh, M.rivet, [L1 * 0.55, 0.1, 0.06]);
      const shin = new THREE.Group();
      shin.position.x = L1;
      thigh.add(shin);
      shin.add(ball(0.1, M.copper, [0, 0, 0], 16));
      const kc = new THREE.CylinderGeometry(0.08, 0.08, 0.26, 16);
      kc.rotateX(Math.PI / 2);
      shin.add(mesh(kc, M.dark));
      shin.add(rodX(0.08, 0.06, 0, L2, M.armor, 14));
      shin.add(latheX(taper(0.05, L2 * 0.7, 0.095, 0.075, 0.02, 4), M.plate, Math.PI * 1.5 - 0.6, 1.2, 8));
      // pít-tông: thân xi lanh neo trên đùi gần hông, cần đẩy neo trên ống chân; pose() đặt lại giữa hai điểm neo
      const pA = new THREE.Object3D();
      pA.position.set(0.2, 0.16 * -knee, 0);
      thigh.add(pA);
      const pB = new THREE.Object3D();
      pB.position.set(0.32, 0.07 * -knee, 0);
      shin.add(pB);
      const piston = new THREE.Group();
      piston.position.z = 0.14 * z;
      plane.add(piston);
      const barrel = new THREE.CylinderGeometry(0.04, 0.04, 1, 12);
      barrel.rotateZ(-Math.PI / 2);
      barrel.translate(0.5, 0, 0);
      const bar = mesh(barrel, M.copper);
      const rodG = new THREE.CylinderGeometry(0.018, 0.018, 1, 8);
      rodG.rotateZ(-Math.PI / 2);
      rodG.translate(-0.5, 0, 0);
      const pr = mesh(rodG, M.steel);
      const eA = ball(0.03, M.dark, [0, 0, 0], 8);
      const eB = ball(0.03, M.dark, [0, 0, 0], 8);
      piston.add(bar, pr, eA, eB);
      if (z > 0 && kind === 'rear') anchor('leg', pB, 0, 0, 0.14);
      // bàn
      const ankle = new THREE.Group();
      ankle.position.x = L2;
      shin.add(ankle);
      ankle.add(ball(0.07, M.dark, [0, 0, 0], 12));
      const pad = ball(0.13, M.armor, [0.05, -0.08, 0], 16);
      pad.scale.set(1.3, 0.5, 1);
      ankle.add(pad);
      const toes = [];
      for (const [yaw, len] of [[-0.42, 0.26], [0, 0.3], [0.42, 0.26], [Math.PI, 0.14]]) {
        const tyaw = new THREE.Group();
        tyaw.position.set(0.05, -0.1, 0);
        tyaw.rotation.y = yaw;
        ankle.add(tyaw);
        const t1 = new THREE.Group();
        tyaw.add(t1);
        t1.add(rodX(0.035, 0.03, 0, len * 0.55, M.plate, 8));
        const t2 = new THREE.Group();
        t2.position.x = len * 0.55;
        t1.add(t2);
        t2.add(ball(0.03, M.copper, [0, 0, 0], 8));
        const cg = new THREE.ConeGeometry(0.028, len * 0.55, 8);
        cg.rotateZ(-Math.PI / 2);
        cg.translate(len * 0.27, -0.01, 0);
        t2.add(mesh(cg, M.teeth));
        toes.push({t1, t2, back: yaw === Math.PI});
      }
      legs.push({kind, knee, L1, L2, hipY: hy, plane, thigh, shin, ankle, toes, pA, pB, piston, bar, pr, eA, eB, side: z});
    }

  // ================================================================ cánh: vai, xương cánh tay, cẳng, cổ tay + vuốt cái, bốn ngón ba đốt, màng căng
  const wings = [];
  const HUM = 1.25;
  const FORE = 1.5;
  const FING = [2.45, 2.8, 2.5, 1.95];
  const NU = 9;
  const NV = 7;
  const PANELS = 4;
  for (const z of [-1, 1]) {
    const wp = part('wing', V(0.5, 0.42, 0.42 * z), V(-0.1, 0.55, z), 1.6, 0.36, [0.35 * z, 0, 0]);
    const mirror = new THREE.Group();
    mirror.scale.z = z;
    wp.g.add(mirror);
    const shoulder = new THREE.Group();
    shoulder.rotation.order = 'XYZ';
    mirror.add(shoulder);
    shoulder.add(ball(0.13, M.copper, [0, 0, 0], 18));
    shoulder.add(rodZ(0.1, 0.075, HUM, M.armor));
    const hc = latheX(taper(0.1, HUM * 0.8, 0.12, 0.09, 0.03, 5), M.plate, Math.PI, Math.PI, 10);
    hc.rotation.y = -Math.PI / 2;
    shoulder.add(hc);
    rivet(shoulder, M.rivet, [0, 0.1, 0.4]);
    rivet(shoulder, M.rivet, [0, 0.09, 0.75]);
    const elbow = new THREE.Group();
    elbow.rotation.order = 'XYZ';
    elbow.position.z = HUM;
    shoulder.add(elbow);
    elbow.add(ball(0.1, M.dark, [0, 0, 0], 16));
    elbow.add(rodZ(0.075, 0.055, FORE, M.armor));
    const pist = rodZ(0.02, 0.02, FORE * 0.7, M.steel, 8);
    pist.position.set(0.09, 0.03, 0.1);
    elbow.add(pist);
    const wrist = new THREE.Group();
    wrist.rotation.order = 'XYZ';
    wrist.position.z = FORE;
    elbow.add(wrist);
    wrist.add(ball(0.085, M.copper, [0, 0, 0], 14));
    const thumb = new THREE.ConeGeometry(0.04, 0.24, 8);
    thumb.rotateX(Math.PI / 2);
    thumb.translate(0, 0, 0.12);
    const th = mesh(thumb, M.teeth, [0.02, 0.02, 0]);
    th.rotation.y = 0.9;
    wrist.add(th);
    const fingers = FING.map((len, fi) => {
      const fy = new THREE.Group();
      fy.rotation.order = 'XYZ';
      wrist.add(fy);
      const segs = [];
      let par = fy;
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Group();
        s.position.z = k ? len / 3 : 0;
        par.add(s);
        s.add(rodZ(0.045 * (1 - 0.25 * k), 0.035 * (1 - 0.28 * k), len / 3, k ? M.plate : M.armor, 8));
        if (k) s.add(ball(0.04 * (1 - 0.2 * k), M.copper, [0, 0, 0], 8));
        par = s;
        segs.push(s);
      }
      const tip = new THREE.Object3D();
      tip.position.z = len / 3;
      par.add(tip);
      const cl = new THREE.ConeGeometry(0.022, 0.12, 6);
      cl.rotateX(Math.PI / 2);
      cl.translate(0, 0, 0.06);
      par.add(mesh(cl, M.teeth, [0, 0, len / 3]));
      const mid = new THREE.Object3D();
      mid.position.z = 0;
      segs[1].add(mid);
      return {fy, segs, tip, mid};
    });
    const rootPt = new THREE.Object3D();
    shoulder.add(rootPt);
    const elbowPt = new THREE.Object3D();
    elbow.add(elbowPt);
    const wristPt = new THREE.Object3D();
    wrist.add(wristPt);
    // màng: 4 tấm lưới NU×NV (ba khoảng giữa các ngón + một khoảng từ ngón cuối về sườn), tính lại mỗi khung
    const panels = PANELS;
    const pos = new Float32Array(panels * NU * NV * 3);
    const idx = [];
    for (let p = 0; p < panels; p++)
      for (let i = 0; i < NU - 1; i++)
        for (let j = 0; j < NV - 1; j++) {
          const a = p * NU * NV + i * NV + j;
          idx.push(a, a + NV, a + 1, a + 1, a + NV, a + NV + 1);
        }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mg.setIndex(idx);
    const memb = mesh(mg, M.membrane);
    memb.frustumCulled = false;
    wp.g.add(memb);
    // gân màng: đường giữa mỗi tấm + mép sau
    const veinPos = new Float32Array(panels * 2 * (NU - 1) * 2 * 3);
    const vgeo = new THREE.BufferGeometry();
    vgeo.setAttribute('position', new THREE.BufferAttribute(veinPos, 3));
    const veins = new THREE.LineSegments(vgeo, M.vein);
    veins.frustumCulled = false;
    wp.g.add(veins);
    const bodyPt = V(-1.75, -0.28, -0.18 * z); // điểm màng bám vào sườn, trong khung phần cánh
    wings.push({wp, shoulder, elbow, wrist, fingers, rootPt, elbowPt, wristPt, memb, mg, pos, veinPos, vgeo, bodyPt, side: z});
    if (z > 0) anchor('wing', wrist, 0, 0.12, 0);
  }

  // ================================================================ mảnh vụn: bu lông, đai ốc, mẩu đồng
  const r = rnd(4242);
  const debris = [];
  const iS = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), M.steel, 60);
  const iN = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 6), M.dark, 36);
  const iB = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), M.copper, 28);
  for (const im of [iS, iN, iB]) {
    im.castShadow = true;
    im.frustumCulled = false;
    root.add(im);
  }
  const ims = [[iS, 60], [iN, 36], [iB, 28]];
  for (const [im, n] of ims)
    for (let i = 0; i < n; i++) {
      const p0 = V(-1.3 + r() * 2.6, (r() - 0.5) * 0.8, (r() - 0.5) * 0.9);
      const d = V(r() - 0.5, r() - 0.3, r() - 0.5).add(V(p0.x * 0.2, p0.y, p0.z)).normalize();
      debris.push({im, i, p0, d, dist: 1.2 + r() * 2.4, delay: 0.1 + r() * 0.45, ax: V(r(), r(), r()).normalize(), sp: 2 + r() * 7});
    }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = V(1, 1, 1);
  const zero = V(0, 0, 0);
  const tmp = V(0, 0, 0);
  const eul = new THREE.Euler();
  const col = new THREE.Color();
  const wA = V(0, 0, 0);
  const wB = V(0, 0, 0);
  const pts = Array.from({length: 12}, () => V(0, 0, 0));
  const nrm = V(0, 0, 0);
  const e1 = V(0, 0, 0);
  const e2 = V(0, 0, 0);
  const pa = V(0, 0, 0);
  const pb = V(0, 0, 0);
  const scv = V(1, 1, 1);

  const localIn = (obj, frameObj, out) => frameObj.worldToLocal(obj.getWorldPosition(out));

  /** s: state(t) của kin.js; s.explode là hàm (t) → 0..1, mỗi phần đọc với độ trễ của nó */
  function pose(s) {
    const t = s.t;
    const eAll = s.explode(t);
    // ---- mở ngực: lõi trượt ra khỏi khoang như khay bảo dưỡng, tua-bin lùi ra theo
    core.shift.set(0.05 * s.chest, -0.42 * s.chest, 0.62 * s.chest);
    for (const p of parts) if (p.name === 'turbine') p.shift.set(0.1 * s.chest, -0.12 * s.chest, 0.32 * s.chest * Math.sign(p.base.z));
    // ---- phần phẳng
    for (const p of parts) {
      const e = s.explode(t - p.delay);
      p.g.position.copy(p.base).add(p.shift).addScaledVector(p.dir, p.dist * e);
      eul.set(p.spin.x * e, p.spin.y * e, p.spin.z * e);
      p.g.quaternion.setFromEuler(eul);
    }
    // ---- cửa ngực, lõi, tua-bin
    for (const d of doors) d.hinge.rotation.x = -2.35 * s.chest * d.z; // hất lên như cánh chim, lộ lõi và tua-bin
    gyro[0].rotation.set(t * 1.3, t * 0.7, 0);
    gyro[1].rotation.set(-t * 0.8, 0, t * 1.1);
    M.core.emissiveIntensity = 0.25 + 1.4 * s.wake * (0.85 + 0.15 * Math.sin(t * 5.3));
    coreLight.intensity = 6 * s.wake * (0.15 + 0.85 * Math.max(s.chest, eAll)) * (0.85 + 0.15 * Math.sin(t * 5.3));
    M.seam.emissiveIntensity = 0.15 + 0.9 * s.wake * (0.5 + 0.5 * s.u) + 1.2 * s.breath;
    M.eye.emissiveIntensity = 0.12 + 2.2 * s.wake;
    for (const tb of turbines) tb.rotation.x = s.phase * 2.4 + t * 9 * s.wake;
    // ---- cổ: đường cong chữ S nâng đầu, quay theo hướng nhìn, duỗi tới khi phun lửa
    const NP = [0.62, 0.3, 0.06, -0.12, -0.24, -0.3, -0.3];
    const NB = [-0.28, -0.08, 0.04, 0.08, 0.08, 0.06, 0.02];
    const NY = [0.04, 0.1, 0.15, 0.2, 0.2, 0.16, 0.15];
    const lift = 0.12 * s.u; // bay thì cổ vươn ngang hơn
    neck.forEach((j, i) => {
      j.position.x = (i === 0 ? 0 : NL) + 0.3 * eAll * (i ? 1 : 0);
      const bob = 0.025 * Math.sin(t * 1.15 - i * 0.5) * (1 - eAll);
      const rest = (1 - s.wake) * [0.2, 0.15, 0.1, 0.05, -0.05, -0.1, -0.15][i]; // ngủ: cổ cúi
      j.rotation.set(0, (s.look + 0.08 * Math.sin(t * 0.43 - i * 0.35)) * NY[i] * (1 - eAll), NP[i] + NB[i] * s.breath - lift * (i < 2 ? 1 : -0.3) + bob - rest);
    });
    // ---- đầu
    headG.position.x = NL + 0.1 + 0.4 * eAll;
    jawPivot.rotation.z = -0.62 * s.jaw;
    for (const h of hp) {
      h.g.position.copy(h.dir).multiplyScalar(h.dist * eAll);
      h.g.rotation.set(h.spin.x * eAll, h.spin.y * eAll, h.spin.z * eAll);
    }
    // ---- đuôi: sóng ngang chạy dọc đuôi, rủ xuống khi đứng, duỗi thẳng khi bay
    const TP = [0.16, 0.12, 0.09, 0.06, 0.03, 0.01, -0.01, -0.02, -0.03, -0.03, -0.03, -0.02, -0.02, -0.01];
    tail.forEach((j, i) => {
      j.position.x = (i === 0 ? 0 : -TL) - 0.22 * eAll * (i ? 1 : 0);
      const amp = (0.035 + 0.01 * i) * (1 - 0.55 * s.u) * (0.4 + 0.6 * s.wake) * (1 - eAll);
      const yaw = amp * Math.sin(t * 1.05 - i * 0.42);
      const pitch = TP[i] * (1 - 0.75 * s.air) + 0.03 * s.u * Math.sin(s.phase - 0.35 * i) * (1 - eAll);
      j.rotation.set(0, yaw, pitch);
    });
    // ---- cánh
    const f = s.fold;
    const flap = s.u;
    const up = Math.max(0, Math.cos(s.phase));
    const FS = [-12, -42, -76, -110];
    const FF = [-166, -170, -174, -178];
    for (const w of wings) {
      w.elbow.position.z = HUM + 0.3 * eAll;
      w.wrist.position.z = FORE + 0.3 * eAll;
      const stroke = lerp(42, 6, f) + s.amp * Math.sin(s.phase);
      w.shoulder.rotation.set(-stroke * D2R, lerp(-74, 6, f) * D2R, lerp(0.3, 0, f));
      w.elbow.rotation.set(-0.35 * s.amp * Math.sin(s.phase - 0.7) * D2R, (lerp(152, -16, f) + 16 * flap * up) * D2R, 0);
      w.wrist.rotation.set(-0.32 * s.amp * Math.sin(s.phase - 1.25) * D2R, lerp(0, -6, f) * D2R, 0);
      w.fingers.forEach((fg, fi) => {
        fg.fy.rotation.set(-0.06 * fi * f, lerp(FF[fi], FS[fi] * (1 - 0.14 * flap * up), f) * D2R, 0);
        fg.segs[1].rotation.x = -0.05 * flap * Math.sin(s.phase - 1.5) - 0.02 * f;
        fg.segs[2].rotation.x = -0.07 * flap * Math.sin(s.phase - 1.8) - 0.03 * f;
        fg.segs[1].position.z = FING[fi] / 3 + 0.08 * eAll;
        fg.segs[2].position.z = FING[fi] / 3 + 0.08 * eAll;
      });
    }
    // ---- chân: đứng thì IK tới điểm trên sàn, bay thì co lên, vuốt quặp
    for (const L of legs) {
      const gx = L.kind === 'front' ? 0.12 : -0.08;
      const gy = -s.bodyY - L.hipY + 0.17;
      const ax = L.kind === 'front' ? 0.62 : -0.8;
      const ay = L.kind === 'front' ? -0.6 : -0.62;
      const k = s.air;
      const {a1, a2} = legIK(L.L1, L.L2, lerp(gx, ax, k), lerp(gy, ay, k) + 0.02 * Math.sin(t * 1.2 + L.side), L.knee);
      L.thigh.rotation.z = a1;
      L.shin.rotation.z = a2 - a1;
      L.shin.position.x = L.L1 + 0.22 * eAll;
      L.ankle.position.x = L.L2 + 0.16 * eAll;
      L.ankle.rotation.z = -a2 - 0.9 * k;
      for (const tt of L.toes) {
        tt.t1.rotation.z = tt.back ? 0.2 + 0.3 * k : -0.05 - 0.4 * k;
        tt.t2.rotation.z = tt.back ? 0.1 : -0.25 - 0.6 * k;
      }
    }
    root.updateMatrixWorld(true);
    // pít-tông chân: thân + cần giữa hai điểm neo (tính trong mặt phẳng chân)
    for (const L of legs) {
      localIn(L.pA, L.plane, pa);
      localIn(L.pB, L.plane, pb);
      pa.z = pb.z = 0;
      const len = pa.distanceTo(pb);
      const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      L.bar.position.copy(pa);
      L.bar.rotation.z = ang;
      L.bar.scale.set(len * 0.58, 1, 1);
      L.pr.position.copy(pb);
      L.pr.rotation.z = ang;
      L.pr.scale.set(len * 0.62, 1, 1);
      L.eA.position.copy(pa);
      L.eB.position.copy(pb);
    }
    // màng cánh
    for (const w of wings) {
      const F = w.wp.g;
      localIn(w.rootPt, F, pts[0]);
      localIn(w.elbowPt, F, pts[1]);
      localIn(w.wristPt, F, pts[2]);
      w.fingers.forEach((fg, fi) => localIn(fg.tip, F, pts[3 + fi]));
      w.fingers.forEach((fg, fi) => localIn(fg.mid, F, pts[7 + fi]));
      pts[11].copy(w.bodyPt);
      const billow = 0.11 + 0.09 * Math.sin(s.phase + Math.PI / 2) * flap;
      let vi = 0;
      const P = w.pos;
      const VP = w.veinPos;
      for (let p = 0; p < PANELS; p++) {
        // cạnh A: cổ tay → đầu ngón p (gấp khúc qua khớp giữa); cạnh B: cổ tay → ngón p+1; tấm cuối: vai → khuỷu → sườn
        const last = p === PANELS - 1;
        const A0 = pts[2];
        const A1 = pts[7 + p];
        const A2 = pts[3 + p];
        const B0 = last ? pts[0] : pts[2];
        const B1 = last ? pts[1] : pts[8 + p];
        const B2 = last ? pts[11] : pts[4 + p];
        e1.subVectors(A2, A0);
        e2.subVectors(B2, B0);
        nrm.crossVectors(e1, e2).normalize();
        if (nrm.y < 0) nrm.negate();
        for (let i = 0; i < NU; i++) {
          const u = i / (NU - 1);
          for (let j = 0; j < NV; j++) {
            const v = j / (NV - 1);
            const uu = u * (1 - 0.16 * Math.sin(Math.PI * v) * (last ? 0.5 : 1)); // mép sau lõm vào giữa hai ngón
            // điểm trên cạnh A và B ở tham số uu (gấp khúc qua điểm giữa)
            const qa = uu < 0.4 ? wA.lerpVectors(A0, A1, uu / 0.4) : wA.lerpVectors(A1, A2, (uu - 0.4) / 0.6);
            const qb = uu < 0.4 ? wB.lerpVectors(B0, B1, uu / 0.4) : wB.lerpVectors(B1, B2, (uu - 0.4) / 0.6);
            tmp.lerpVectors(qa, qb, v);
            const wdt = qa.distanceTo(qb);
            tmp.addScaledVector(nrm, billow * wdt * Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.min(1, uu * 1.2)));
            P[vi++] = tmp.x;
            P[vi++] = tmp.y;
            P[vi++] = tmp.z;
          }
        }
      }
      w.mg.attributes.position.needsUpdate = true;
      w.mg.computeVertexNormals();
      // gân: đường giữa mỗi tấm (v = 1/2) + mép sau (u = 1)
      let k = 0;
      const at = (p, i, j) => (p * NU * NV + i * NV + j) * 3;
      for (let p = 0; p < PANELS; p++) {
        const jm = (NV - 1) >> 1;
        for (let i = 0; i < NU - 1; i++) {
          for (const [a, b] of [[at(p, i, jm), at(p, i + 1, jm)], [at(p, NU - 1, i % (NV - 1)), at(p, NU - 1, (i % (NV - 1)) + 1)]]) {
            VP[k++] = P[a];
            VP[k++] = P[a + 1] + 0.004;
            VP[k++] = P[a + 2];
            VP[k++] = P[b];
            VP[k++] = P[b + 1] + 0.004;
            VP[k++] = P[b + 2];
          }
        }
      }
      w.vgeo.attributes.position.needsUpdate = true;
    }
    // ---- lửa
    for (let i = 0; i < NF; i++) {
      const fp = fireP[i];
      const age = (((t + fp.o * fp.L) % fp.L) + fp.L) % fp.L;
      const b = s.breathAt(t - age) * (1 - ss(0, 0.05, eAll));
      const k = age / fp.L;
      if (b < 0.02) {
        fSize[i] = 0;
        continue;
      }
      const dist = 5.2 * fp.v * (0.55 + 0.45 * b) * age * (1 - 0.42 * k);
      const spread = (0.03 + 0.7 * Math.pow(k, 0.9)) * fp.j * (0.6 + 0.4 * b);
      const th = fp.th + fp.sw * age;
      fPos[i * 3] = 0.98 + dist;
      fPos[i * 3 + 1] = -0.09 - 0.05 * dist + Math.sin(th) * spread + 1.1 * age * age;
      fPos[i * 3 + 2] = Math.cos(th) * spread;
      const al = fireCol(Math.min(1, k * (0.85 + 0.3 * fp.hot)), col) * b * 0.55;
      fCol[i * 3] = col.r * al;
      fCol[i * 3 + 1] = col.g * al;
      fCol[i * 3 + 2] = col.b * al;
      fSize[i] = (0.1 + 1.05 * Math.pow(k, 0.8)) * (0.7 + 0.3 * b);
    }
    fgeo.attributes.position.needsUpdate = fgeo.attributes.fcol.needsUpdate = fgeo.attributes.size.needsUpdate = true;
    flameLight.intensity = 30 * s.breath * (0.85 + 0.15 * Math.sin(t * 31)) * (1 - eAll);
    // ---- mảnh vụn
    for (const d of debris) {
      const e = s.explode(t - d.delay);
      if (e < 0.01) m4.compose(d.p0, q.identity(), zero);
      else {
        tmp.copy(d.p0).addScaledVector(d.d, d.dist * e);
        q.setFromAxisAngle(d.ax, d.sp * e);
        m4.compose(tmp, q, one);
      }
      d.im.setMatrixAt(d.i, m4);
    }
    for (const [im] of ims) im.instanceMatrix.needsUpdate = true;
  }

  return {root, parts, anchors, pose, mouth, fireU};
}
