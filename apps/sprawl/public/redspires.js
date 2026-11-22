// Red Spires dựng theo bản quy hoạch chung (public/du-lieu/quy-hoach.json, máy scripts/quy-hoach.mjs).
// Ảnh mẫu: ban ngày sương xanh xám · tháp nón đỏ chóp vòm (ban công, cửa tròn, ăng-ten, vệt bẩn) · đại lộ đi bộ lát đá sáng
// có chợ + người · phố thấp xanh xám, vườn mái · khối khổng lồ mờ xa · xe bay theo làn trên đại lộ lớn.
// Nhà PLATEAU giữ nguyên bố cục thật, khoác chất liệu xanh xám; nhà thật ≥ 90 m bị khoét bỏ trong shader để tháp đỏ đứng thay.
import * as THREE from 'three';

const MAU_NGUOI = ['#2b2f36', '#4a3b33', '#c9b8a0', '#6d7f8c', '#8a3b2e', '#d8d2c4', '#3e5566', '#9b8a6a'];
const MAU_MAI = ['#c9483a', '#e0a83c', '#3f7f8c', '#d9d2c2', '#7d9a5a'];

// Mỗi tháp một bộ gen (gieo theo id): dáng thân, kiểu chóp, màu đỏ, màu viền, gân dọc, nhịp cửa, ban công, đỉnh.
// Sáu dáng: đạn (phình 1/4 thân) · bậc (3-4 trống lùi dần) · củ hành (thân mảnh, bầu gần đỉnh) · nón (thon nhọn kiểu gothic)
//           · bình (eo giữa, loe vương miện) · chùm (thân chính + 2-3 tháp vệ tinh dính chân).
const DANG = ['dan', 'bac', 'hanh', 'non', 'binh', 'chum'];
const MAU_DO = ['#b9452f', '#a63a2a', '#c4553a', '#9e3b30', '#b54a3c', '#c9603f', '#8f3a2c', '#ad4b35', '#c2483f', '#9a4632'];
const MAU_VIEN = ['#d9cdb5', '#4a3a33', '#5d8a86', '#c79a4a', '#e8e0cf', '#6b4f3f', '#8fa7a3'];
const gieo = (id) => { let h = (id * 2654435761 + 1013904223) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; };
const chon = (r, a) => a[(r() * a.length) | 0];
const buocMuot = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// hồ sơ thân: trả các điểm [t 0..1 theo chiều cao thân, hệ số bán kính]; bậc cần điểm gãy nên trả điểm thẳng
function thanTheoDang(dang, r) {
  const p = [], N = 40;
  if (dang === 'bac') {
    const n = 3 + (r() < 0.5 ? 1 : 0); let rr = 1.18, t0 = 0;
    for (let k = 0; k < n; k++) {
      const t1 = k === n - 1 ? 1 : t0 + (0.42 - k * 0.07) * (0.9 + r() * 0.2), thon = 0.04 + r() * 0.06;
      p.push([t0, rr], [t0 + (t1 - t0) * 0.5, rr * (1 - thon * 0.5)], [t1 - 0.012, rr * (1 - thon)]);
      t0 = t1; rr = rr * (1 - thon) * (0.72 + r() * 0.08);
      if (k < n - 1) p.push([t0, rr]);
    }
    return p;
  }
  const a = 0.8 + r() * 0.4; // độ phình riêng mỗi tháp
  for (let i = 0; i <= N; i++) {
    const t = i / N; let f;
    if (dang === 'dan') f = 1.1 + 0.15 * a * Math.sin(Math.PI * Math.min(1, t * 1.6)) - 0.5 * Math.pow(t, 1.5);
    else if (dang === 'hanh') f = (0.78 - 0.22 * t) + 0.42 * a * Math.max(0, Math.sin(Math.PI * (t - 0.7) / 0.3)) * (t > 0.7 ? 1 : 0);
    else if (dang === 'non') f = 1.15 * (1 - 0.8 * Math.pow(t, 0.9 + 0.3 * a)) + 0.06 * Math.sin(t * 9);
    else if (dang === 'binh') f = 1.0 - 0.32 * a * Math.sin(Math.PI * Math.min(1, t / 0.8)) + 0.3 * buocMuot(0.72, 0.96, t);
    else f = 1.05 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.8)) - 0.45 * Math.pow(t, 1.4); // chùm: thân chính
    p.push([t, Math.max(0.12, f)]);
  }
  return p;
}
// chóp: vòm tròn · vòm nhọn (ogive) · mái bằng có chòi nhỏ
function dungHoSo(R, H, dang, r) {
  const chop = dang === 'non' ? 'nhon' : dang === 'hanh' ? 'nhon' : chon(r, ['vom', 'vom', 'nhon', 'choi']);
  const diem = thanTheoDang(dang, r), rCuoi = diem[diem.length - 1][1] * R;
  const ddChop = chop === 'nhon' ? rCuoi * (1.6 + r() * 0.8) : chop === 'choi' ? rCuoi * 0.35 : rCuoi * (0.7 + r() * 0.25);
  const than = H - ddChop, p = diem.map(([t, f]) => new THREE.Vector2(Math.max(0.5, f * R), t * than));
  for (let i = 1; i <= 14; i++) {
    const s = i / 14, a = s * Math.PI / 2;
    const rr = chop === 'nhon' ? rCuoi * Math.pow(1 - s, 1.25) * (1 + 0.25 * Math.sin(Math.PI * s)) : rCuoi * Math.cos(a);
    p.push(new THREE.Vector2(Math.max(0.01, rr), than + ddChop * (chop === 'nhon' ? s : Math.sin(a))));
  }
  const rTai = (y) => { if (y <= 0) return p[0].x; for (let i = 1; i < p.length; i++) if (p[i].y >= y) { const a = p[i - 1], b = p[i]; return a.x + (b.x - a.x) * (y - a.y) / Math.max(0.01, b.y - a.y); } return 0.5; };
  return { p, than, rC: rCuoi, chop, rTai, rMax: Math.max(...p.map((v) => v.x)) };
}
// gân dọc: nắn bán kính thân theo góc (chỉ phần thân, không đụng chóp)
function khiaGan(geo, than, n, bien) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (y > than) continue;
    const k = 1 + bien * (Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * n / 2)), 6) - 0.3); pos.setX(i, x * k); pos.setZ(i, z * k); }
  geo.computeVertexNormals(); return geo;
}

function vatThap(gen) {
  const v = new THREE.MeshStandardMaterial({ color: gen.mau, roughness: 0.74 + gen.r * 0.12, metalness: 0.05 });
  const u = { uVien: { value: new THREE.Color(gen.vien) }, uNhip: { value: new THREE.Vector4(gen.oRong, gen.tang, gen.bang, gen.tron) }, uKieu: { value: new THREE.Vector2(gen.soc, gen.than) } };
  v.customProgramCacheKey = () => 'thap-do';
  v.onBeforeCompile = (sh) => { // tấm ốp + cửa sổ + cửa tròn + vệt bẩn + sọc viền, theo toạ độ trong thân; nhịp riêng mỗi tháp qua uniform
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLo = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLo; uniform vec3 uVien; uniform vec4 uNhip; uniform vec2 uKieu;
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float rr = length(vLo.xz), cung = atan(vLo.z, vLo.x) * max(rr, 1.0), goc = atan(vLo.z, vLo.x);
      float tang = floor(vLo.y / uNhip.y), fy = fract(vLo.y / uNhip.y);
      vec2 o = vec2(floor(cung / uNhip.x), tang), f = vec2(fract(cung / uNhip.x), fy);
      float h = bam(o);
      float cua = step(0.3, f.x) * step(f.x, 0.7) * step(0.32, f.y) * step(f.y, 0.78) * step(0.18, h) * step(vLo.y, uKieu.y);
      float bang = step(fract(vLo.y / uNhip.z), 0.06);
      vec2 ot = vec2(floor(cung / 7.0), floor(vLo.y / 14.4)), ft = vec2(fract(cung / 7.0), fract(vLo.y / 14.4)) - 0.5;
      float tron = step(length(ft * vec2(1.0, 2.0)), 0.3) * step(uNhip.w, bam(ot + 5.3));
      float ban = bam(vec2(floor(cung / 1.3), 3.0));
      float vet = smoothstep(0.55, 1.0, ban) * (0.35 + 0.65 * fract(vLo.y * 0.013 + ban * 7.0));
      float tam = 0.86 + 0.14 * bam(vec2(floor(cung / 9.0), floor(vLo.y / 10.8)) + 2.0);
      // sọc viền: 1 = sọc dọc, 2 = đai ngang, 3 = vảy ô trám ở chóp
      float soc = 0.0;
      if (uKieu.x > 0.5 && uKieu.x < 1.5) soc = step(0.94, fract(goc * 6.0 / 6.2832 + 0.5));
      else if (uKieu.x > 1.5 && uKieu.x < 2.5) soc = step(fract(vLo.y / (uNhip.z * 2.0)), 0.035);
      if (vLo.y > uKieu.y) { vec2 v2 = vec2(goc * 18.0 / 6.2832, vLo.y / 2.4); soc = max(soc, step(0.5, uKieu.x) * step(0.82, abs(fract(v2.x + floor(v2.y) * 0.5) - 0.5) * 2.0)); }
      diffuseColor.rgb *= tam * (1.0 - 0.32 * vet) * (1.0 - 0.35 * bang);
      diffuseColor.rgb = mix(diffuseColor.rgb, uVien * (1.0 - 0.25 * vet), soc * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.16, 0.19), cua * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.27, 0.3), tron);`);
  };
  return v;
}

// một tháp đỏ hoàn chỉnh (thân + ban công + đỉnh), gốc toạ độ ở chân
function dungThap(R, H, gen, r, vKim) {
  const g = new THREE.Group(), hs = dungHoSo(R, H, gen.dang, r);
  gen.than = hs.than;
  const vT = vatThap(gen), vBC = new THREE.MeshStandardMaterial({ color: new THREE.Color(gen.mau).multiplyScalar(0.72), roughness: 0.85 });
  const vV = new THREE.MeshStandardMaterial({ color: gen.vien, roughness: 0.7, metalness: 0.15 });
  let geo = new THREE.LatheGeometry(hs.p, 64);
  if (gen.gan) geo = khiaGan(geo, hs.than, gen.gan, 0.035);
  g.add(new THREE.Mesh(geo, vT));
  // ban công vòng: 2-5 vòng, có tháp viền cùng màu viền
  const nBC = 2 + ((r() * 4) | 0);
  for (let k = 0; k < nBC; k++) {
    const y = hs.than * (0.22 + 0.68 * (k + 0.3 + r() * 0.4) / nBC), rv = hs.rTai(y), rong = 1.6 + r() * 1.8, mv = r() < 0.35 ? vV : vBC;
    const vong = new THREE.Mesh(new THREE.CylinderGeometry(rv + rong, rv + rong, 1.2 + r(), 64, 1, true), mv); vong.position.y = y; g.add(vong);
    const san = new THREE.Mesh(new THREE.RingGeometry(rv - 0.5, rv + rong, 64), mv); san.rotation.x = -Math.PI / 2; san.position.y = y - 0.6; g.add(san);
  }
  // cổ chóp: đai viền dày
  const yc = hs.than, rc = hs.rC;
  const dai = new THREE.Mesh(new THREE.CylinderGeometry(rc + 1.2, rc + 1.6, 3.2, 64), vV); dai.position.y = yc - 1; g.add(dai);
  // đỉnh: ăng-ten chùm · kim cao + vòng hào quang · chòi nhỏ có mái vòm
  const dinh = gen.dinh, yTop = H;
  if (hs.chop === 'choi') {
    const rr = rc * 0.32, ch = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 1.1, rr * 1.6, 24), vV); ch.position.y = yTop + rr * 0.8 - 0.5; g.add(ch);
    const vm = new THREE.Mesh(new THREE.SphereGeometry(rr * 1.05, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), vT); vm.position.y = yTop + rr * 1.6 - 0.5; g.add(vm);
  }
  const yDinh = hs.chop === 'choi' ? yTop + rc * 0.32 * 2.6 : yTop;
  if (dinh === 'kim' || hs.chop === 'nhon') {
    const cao = H * (0.12 + r() * 0.1), kim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.1, cao, 8), vKim); kim.position.y = yDinh + cao / 2 - 1; g.add(kim);
    if (r() < 0.6) { const hq = new THREE.Mesh(new THREE.TorusGeometry(2.5 + r() * 3, 0.35, 6, 32), vV); hq.rotation.x = Math.PI / 2; hq.position.y = yDinh + cao * 0.4; g.add(hq); }
  } else {
    const nAng = 1 + ((r() * 4) | 0);
    for (let a = 0; a < nAng; a++) {
      const cao = H * (0.06 + r() * 0.08), lech = a ? rc * 0.35 : 0, ga = a * 2.1 + r();
      const kim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, cao, 6), vKim);
      kim.position.set(Math.cos(ga) * lech, yDinh - (a ? rc * 0.2 : 0) + cao / 2 - 1, Math.sin(ga) * lech); g.add(kim);
    }
  }
  return { g, hs };
}

export function taoRedSpires({ RAPIER, world, tinh, datTai, ql }) {
  const goc = new THREE.Group(); goc.visible = false; goc.name = 'red-spires';
  const thap = ql.thap;

  // ---------- chất liệu nhà PLATEAU: xanh xám, cửa tối, vườn mái; khoét nhà thật dưới tháp đỏ ----------
  const uKhoet = { uThap: { value: thap.map((t) => new THREE.Vector4(t.o[0], t.o[1], t.banKinh * 1.25, 0)) } };
  const vatPho = new THREE.MeshLambertMaterial({ color: '#7f93a3' });
  vatPho.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uKhoet);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform vec4 uThap[${thap.length}];
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      for (int i = 0; i < ${thap.length}; i++) { vec4 t = uThap[i]; float d = length(vWp.xz - t.xy);
        if (d < t.z * 1.3 || (d < t.z * 2.6 && vWp.y > t.w + 55.0)) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 nw = normalize(cross(dFdx(vWp), dFdy(vWp)));
      vec2 k = floor(vWp.xz / 22.0);
      float hk = bam(k), hm = bam(k + 7.7), hs = bam(k + 3.1);
      // mỗi khối một bảng màu: xanh xám · đá kem · đá phiến · xanh rêu xám · gạch nhạt
      vec3 m0 = vec3(0.50, 0.58, 0.64), m1 = vec3(0.74, 0.71, 0.64), m2 = vec3(0.40, 0.45, 0.50), m3 = vec3(0.50, 0.60, 0.57), m4 = vec3(0.68, 0.56, 0.50);
      vec3 mk = hm < 0.42 ? m0 : hm < 0.6 ? m2 : hm < 0.76 ? m1 : hm < 0.9 ? m3 : m4;
      diffuseColor.rgb = mk * (0.85 + 0.25 * hk);
      if (abs(nw.y) > 0.6) {                                                   // mái: vườn mái hoặc bê tông, có bồn nước / máy lạnh rải
        if (hk > 0.55) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.46, 0.28), 0.75 * step(0.3, bam(floor(vWp.xz / 3.0))));
        else diffuseColor.rgb *= 0.9 + 0.15 * step(0.85, bam(floor(vWp.xz / 2.0)));
      } else {
        bool trucX = abs(nw.x) > abs(nw.z);
        float u = (trucX ? vWp.z : vWp.x);
        vec2 g = vec2(u / 2.2, vWp.y / 3.4), f = fract(g);
        float cua;
        if (hs < 0.4) cua = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);          // ô cửa lưới
        else if (hs < 0.7) cua = step(0.35, f.y) * step(f.y, 0.8);                                            // dải kính ngang
        else { cua = step(0.15, fract(u / 1.1)) * step(0.2, f.y); diffuseColor.rgb *= 0.9 + 0.12 * step(0.85, fract(u / 1.1)); } // vây dọc
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.25, 0.3), cua * 0.6);
        diffuseColor.rgb *= 1.0 - 0.18 * step(fract(vWp.y / 3.4), 0.08) * step(0.5, hk);                     // gờ tầng
      }`);
  };

  // ---------- tháp đỏ: mỗi tháp một bộ gen ----------
  const vKim = new THREE.MeshStandardMaterial({ color: '#3a3532', roughness: 0.6, metalness: 0.5 });
  const dsThap = thap.map((t, i) => {
    const r = gieo(t.id + 17), R = t.banKinh, H = t.caoSpire;
    const dang = DANG[(i * 5 + ((r() * 2) | 0)) % DANG.length]; // xoay vòng đủ sáu dáng, tháp liền hạng không trùng dáng
    const tang = 3.3 + r() * 0.9;
    const gen = { dang, r: r(), mau: chon(r, MAU_DO), vien: chon(r, MAU_VIEN), oRong: 2.2 + r() * 1.1, tang, bang: tang * (6 + ((r() * 5) | 0)),
      tron: 0.78 + r() * 0.17, soc: (r() * 4) | 0, gan: r() < 0.4 ? 14 + ((r() * 14) | 0) : 0, dinh: r() < 0.45 ? 'kim' : 'ang' };
    const { g, hs } = dungThap(R, H, gen, r, vKim);
    let rVa = hs.rMax;
    if (dang === 'chum') { // 2-3 tháp vệ tinh dính chân, thấp hơn, cùng họ màu
      const n = 2 + (r() < 0.5 ? 1 : 0), g0 = r() * 6.28;
      for (let k = 0; k < n; k++) {
        const gv = { ...gen, dang: chon(r, ['dan', 'non', 'hanh']), gan: 0, dinh: 'kim', soc: (gen.soc + k + 1) % 4 }, a = g0 + k * 6.28 / n;
        const v = dungThap(R * (0.42 + r() * 0.15), H * (0.45 + r() * 0.25), gv, r, vKim);
        v.g.position.set(Math.cos(a) * R * 1.05, 0, Math.sin(a) * R * 1.05); g.add(v.g);
      }
      rVa = hs.rMax * 1.6;
    }
    g.rotation.y = r() * 6.28;
    g.position.set(t.o[0], 0, t.o[1]);
    goc.add(g);
    return { t, g, R: rVa, than: hs.than, dang, va: null };
  });

  // ---------- đại lộ lát đá + chợ + người ----------
  const vLo = new THREE.MeshLambertMaterial({ color: '#e3ddd0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  vLo.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 f = abs(fract(vWp.xz / 3.0) - 0.5);
      diffuseColor.rgb *= 1.0 - 0.1 * step(0.46, max(f.x, f.y));`);           // mạch lát đá 3 m
  };
  const loMesh = new THREE.Mesh(new THREE.BufferGeometry(), vLo); goc.add(loMesh);
  const RONG = { lon: 30, vua: 18, dibo: 14 };

  // điểm rải dọc đại lộ (dày ở gần tâm), dùng cho người + quầy chợ
  const diem = [];
  for (const d of ql.daiLo) for (let i = 1; i < d.g.length; i++) {
    const [ax, az] = d.g[i - 1], [bx, bz] = d.g[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, w = RONG[d.lop];
    for (let s = 0; s < L; s += 6) {
      const x = ax + ux * s, z = az + uz * s, kc = Math.hypot(x, z);
      diem.push({ x, z, ux, uz, w, gan: Math.exp(-kc / 900) });
    }
  }
  let hat = 1234567; const ngau = () => ((hat = (hat * 16807) % 2147483647) / 2147483647);
  const NN = 7000, NQ = 900;
  const nguoi = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.7, 0.35).translate(0, 0.85, 0), new THREE.MeshLambertMaterial(), NN);
  const quay = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 2.6, 2.4), new THREE.MeshLambertMaterial(), NQ);
  const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const datNguoi = [], datQuay = [];
  for (let n = 0, thu = 0; n < NN && thu < NN * 40; thu++) {
    const d = diem[(ngau() * diem.length) | 0]; if (!d || ngau() > d.gan * 1.4) continue;
    const lech = (ngau() - 0.5) * d.w * 0.9;
    datNguoi.push({ x: d.x - d.uz * lech + (ngau() - 0.5) * 5, z: d.z + d.ux * lech + (ngau() - 0.5) * 5, h: ngau() * 6.28, s: 0.9 + ngau() * 0.25 });
    nguoi.setColorAt(n++, _c.set(MAU_NGUOI[(ngau() * MAU_NGUOI.length) | 0]));
  }
  for (let n = 0, thu = 0; n < NQ && thu < NQ * 60; thu++) {
    const d = diem[(ngau() * diem.length) | 0]; if (!d || d.w < 18 || ngau() > d.gan * 1.6) continue;
    const ben = ngau() < 0.5 ? -1 : 1, lech = ben * (d.w / 2 - 2.5);
    datQuay.push({ x: d.x - d.uz * lech, z: d.z + d.ux * lech, h: Math.atan2(d.ux, d.uz) });
    quay.setColorAt(n++, _c.set(MAU_MAI[(ngau() * MAU_MAI.length) | 0]));
  }
  nguoi.count = datNguoi.length; quay.count = datQuay.length;
  goc.add(nguoi, quay);

  // ---------- khối khổng lồ mờ xa (không chịu sương, tự pha màu sương) ----------
  const vXa = new THREE.MeshBasicMaterial({ color: '#97a8b6', fog: false });
  const vXa2 = new THREE.MeshBasicMaterial({ color: '#8b9dac', fog: false });
  for (const [i, k] of ql.khoiXa.entries()) {
    const g = new THREE.Group();
    let y = 0, r = k.rong;
    for (let tang = 0; tang < 3; tang++) {
      const h = k.cao * [0.55, 0.3, 0.15][tang], m = new THREE.Mesh(new THREE.BoxGeometry(r, h, r * (0.7 + 0.3 * (i % 2))), tang % 2 ? vXa2 : vXa);
      m.position.y = y + h / 2; g.add(m); y += h; r *= 0.68;
    }
    const kim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, k.cao * 0.25, 6), vXa2); kim.position.y = y + k.cao * 0.125; g.add(kim);
    g.position.set(k.o[0], 30, k.o[1]); g.rotation.y = i * 0.7;
    goc.add(g);
  }

  // ---------- xe bay theo làn ----------
  const lan = ql.lanBay.map((l) => {
    const g = l.g.map(([x, z]) => new THREE.Vector3(x, 0, z)), dai = [0];
    for (let i = 1; i < g.length; i++) dai.push(dai[i - 1] + g[i].distanceTo(g[i - 1]));
    return { cao: l.cao, g, dai, L: dai[dai.length - 1] };
  }).filter((l) => l.L > 150);
  const xe = []; for (const [i, l] of lan.entries()) { const n = Math.max(1, Math.round(l.L / 500)); for (let k = 0; k < n; k++) xe.push({ l, s: (k / n) * l.L + i * 37, v: (24 + (i * 13 + k * 7) % 22) * (k % 2 ? -1 : 1), y: l.cao + (k % 2) * 8 }); }
  const xeMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1.3, 4.5, 3, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2f3a44', roughness: 0.35, metalness: 0.6 }), xe.length);
  xeMesh.frustumCulled = false; goc.add(xeMesh);
  const den = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), xe.length);
  den.frustumCulled = false; goc.add(den);
  let yXe = 40;

  function datLai(datMuot) { // gắn mọi thứ xuống mặt đất mới dựng (gọi sau mỗi lần dungDat)
    const muot = datMuot || datTai;
    for (const [i, d] of dsThap.entries()) {
      let y0 = Infinity; for (let a = 0; a < 8; a++) y0 = Math.min(y0, datTai(d.t.o[0] + Math.cos(a) * d.R, d.t.o[1] + Math.sin(a) * d.R));
      y0 = Math.min(y0, datTai(d.t.o[0], d.t.o[1])) - 1;
      d.g.position.y = y0; uKhoet.uThap.value[i].w = y0; d.y0 = y0;
    }
    yXe = datTai(0, 0);
    // dải đại lộ: mỗi đoạn một dải chữ nhật bám đất
    const vs = [], idx = [];
    for (const dl of ql.daiLo) { const w = RONG[dl.lop] / 2;
      for (let i = 1; i < dl.g.length; i++) {
        const [ax, az] = dl.g[i - 1], [bx, bz] = dl.g[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
        const nx = -(bz - az) / L * w, nz = (bx - ax) / L * w, b = vs.length / 3;
        const ex = (bx - ax) / L * w * 0.5, ez = (bz - az) / L * w * 0.5; // kéo dài nửa bề rộng cho mối nối kín
        for (const [x, z] of [[ax - ex + nx, az - ez + nz], [ax - ex - nx, az - ez - nz], [bx + ex + nx, bz + ez + nz], [bx + ex - nx, bz + ez - nz]]) vs.push(x, muot(x, z) + 0.6, z);
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3)); g.setIndex(idx); g.computeVertexNormals();
    loMesh.geometry.dispose(); loMesh.geometry = g;
    for (const [i, p] of datNguoi.entries()) { _p.set(p.x, muot(p.x, p.z) + 0.6, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); _s.setScalar(p.s); nguoi.setMatrixAt(i, _m.compose(_p, _q, _s)); }
    _s.setScalar(1);
    for (const [i, p] of datQuay.entries()) { _p.set(p.x, muot(p.x, p.z) + 1.9, p.z); _q.setFromEuler(_e.set(0, p.h, 0)); quay.setMatrixAt(i, _m.compose(_p, _q, _s)); }
    nguoi.instanceMatrix.needsUpdate = true; quay.instanceMatrix.needsUpdate = true;
    if (goc.visible) { boVa(); dungVa(); }
  }
  function dungVa() { for (const d of dsThap) if (!d.va && d.y0 !== undefined)
    d.va = world.createCollider(RAPIER.ColliderDesc.cylinder(d.than / 2, d.R).setTranslation(d.t.o[0], d.y0 + d.than / 2, d.t.o[1]), tinh); }
  function boVa() { for (const d of dsThap) if (d.va) { world.removeCollider(d.va, false); d.va = null; } }
  function hien(bat) { goc.visible = bat; if (bat) dungVa(); else boVa(); }

  const _a = new THREE.Vector3();
  function khung(dt) {
    if (!goc.visible) return;
    for (const [i, c] of xe.entries()) {
      const l = c.l; c.s = ((c.s + c.v * dt) % l.L + l.L) % l.L;
      let k = 1; while (k < l.dai.length - 1 && l.dai[k] < c.s) k++;
      const a = l.g[k - 1], b = l.g[k], f = (c.s - l.dai[k - 1]) / Math.max(0.01, l.dai[k] - l.dai[k - 1]);
      _p.lerpVectors(a, b, f); _p.y = yXe + c.y; _a.subVectors(b, a); if (c.v < 0) _a.negate();
      _q.setFromEuler(_e.set(0, Math.atan2(_a.x, _a.z), 0)); _s.setScalar(1);
      xeMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      _a.set(0, 0, 3.4).applyQuaternion(_q).add(_p); den.setMatrixAt(i, _m.compose(_a, _q, _s));
    }
    xeMesh.instanceMatrix.needsUpdate = true; den.instanceMatrix.needsUpdate = true;
  }

  return { goc, vatPho, datLai, hien, khung, tk: { thap: dsThap.length, nguoi: datNguoi.length, quay: datQuay.length, xe: xe.length } };
}
