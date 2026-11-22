// Phố sống cho Red Spires: sương thành lớp giữa các tầng, xe bay theo đàn có vệt đèn, xe chạy trên đường lớn,
// tàu chạy trên tuyến tàu, cầu nối + vườn treo giữa các tháp gần nhau. Mọi thứ gắn vào nhóm `goc` của redspires.js.
// tra-repo-ok: mã dán keo nội bộ, dựng trên dữ liệu quy hoạch + tháp đã có
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TL, batTang, luoiTuyen, kiem } from './khop.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _t = new THREE.Vector3();
const LEN = new THREE.Vector3(0, 1, 0);
const gieo = (n) => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };

// tuyến: dãy điểm chia nhỏ ≤ buoc m, độ cao từng điểm dò lại khi đất dựng xong
function taoTuyen(g, buoc) {
  const P = [new THREE.Vector3(g[0][0], 0, g[0][1])];
  for (let i = 1; i < g.length; i++) { const a = g[i - 1], b = g[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / buoc));
    for (let k = 1; k <= n; k++) P.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * k / n, 0, a[1] + (b[1] - a[1]) * k / n)); }
  const dai = [0]; for (let i = 1; i < P.length; i++) dai.push(dai[i - 1] + P[i].distanceTo(P[i - 1]));
  return { P, dai, L: dai[dai.length - 1] };
}
// điểm ở quãng s: vị trí (out p) + hướng đi (out d, chuẩn hoá trên mặt phẳng)
function lay(t, s, p, d) {
  let lo = 0, hi = t.dai.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.dai[m] <= s) lo = m; else hi = m; }
  const a = t.P[lo], b = t.P[hi], f = (s - t.dai[lo]) / Math.max(0.01, t.dai[hi] - t.dai[lo]);
  p.lerpVectors(a, b, f); d.subVectors(b, a).setY(0).normalize();
}
const huong = (d, q) => q.setFromAxisAngle(LEN, Math.atan2(d.x, d.z));

export function taoSong({ goc, ql, dsThap }) {
  const uT = { value: 0 };
  // ---------- sương thành lớp: mảng mây ngang ở 4 độ cao, nhiễu trôi theo gió, mờ dần khi camera lại gần ----------
  const vSuong = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uT, uMau: { value: new THREE.Color('#dce4ea') }, uMauSuong: { value: new THREE.Color('#a3b2be') } },
    vertexShader: `attribute float aHat; varying vec3 vW; varying vec2 vUv; varying float vHat;
      void main() { vUv = uv; vHat = aHat; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT; uniform vec3 uMau, uMauSuong; varying vec3 vW; varying vec2 vUv; varying float vHat;
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float nh(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(bam(i), bam(i + vec2(1, 0)), f.x), mix(bam(i + vec2(0, 1)), bam(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * nh(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
      void main() {
        vec2 p = vW.xz * 0.0045 + vec2(uT * 0.006, uT * 0.0025) + vHat * 13.0;
        float n = fbm(p), bien = smoothstep(0.5, 0.18, length(vUv - 0.5));
        float a = smoothstep(0.42, 0.78, n) * bien;
        float dCam = distance(cameraPosition, vW);
        a *= smoothstep(30.0, 220.0, dCam) * 0.62;          // camera xuyên qua lớp mây: tan dần thay vì một mặt phẳng cứng
        if (a < 0.004) discard;
        float suong = 1.0 - exp(-pow(0.00042 * dCam, 2.0));
        vec3 c = mix(uMau * (0.9 + 0.12 * n), uMauSuong, suong * 0.85);
        gl_FragColor = vec4(c, a * (1.0 - suong * 0.5));
      }`,
  });
  const CAO = [62, 105, 158, 232], o = [], rS = gieo(91);
  for (const [li, y] of CAO.entries()) for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    if (rS() < 0.35) continue; // để hở, không phủ kín thành trần
    o.push({ x: i * 440 + (rS() - 0.5) * 260, z: j * 440 + (rS() - 0.5) * 260, y: y + (rS() - 0.5) * 18, r: 520 + rS() * 300, h: li * 7 + rS() });
  }
  const gS = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  gS.setAttribute('aHat', new THREE.InstancedBufferAttribute(new Float32Array(o.map((v) => v.h)), 1));
  const suong = new THREE.InstancedMesh(gS, vSuong, o.length);
  suong.frustumCulled = false; suong.renderOrder = 10;
  const yDat = { v: 40 };
  const datSuong = () => { for (const [i, v] of o.entries()) { _p.set(v.x, yDat.v + v.y, v.z); _s.set(v.r, 1, v.r); suong.setMatrixAt(i, _m.compose(_p, _q.identity(), _s)); } suong.instanceMatrix.needsUpdate = true; _s.set(1, 1, 1); };
  datSuong(); goc.add(suong);

  // ---------- xe bay theo đàn: nhiều tầng, nhiều làn song song trên mỗi đại lộ, vệt đèn đuôi ----------
  const lanBay = ql.lanBay.map((l) => ({ cao: l.cao, ...taoTuyen(l.g, 40) })).filter((l) => l.L > 150);
  const xeBay = []; const rB = gieo(7);
  for (const [i, l] of lanBay.entries()) {
    const n = Math.max(2, Math.round(l.L / 55));
    for (let k = 0; k < n; k++) { const chieu = k % 2 ? -1 : 1;
      xeBay.push({ l, s: rB() * l.L, v: (32 + rB() * 26) * chieu, y: l.cao + ((k >> 1) % 3) * 9 + (rB() - 0.5) * 4, ben: chieu * (4 + ((k >> 1) % 2) * 5) + (rB() - 0.5) * 1.5, lac: rB() * 6.28 }); }
  }
  const nB = xeBay.length;
  const thanBay = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1.2, 4.2, 3, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c3cbd2', roughness: 0.3, metalness: 0.55 }), nB);
  const denTruoc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff1d6', fog: false }), nB);
  // vệt đèn: dải mảnh kéo dài sau đuôi, mờ dần về sau (cộng sáng)
  const vet1 = () => { const g = new THREE.PlaneGeometry(1.3, 34, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -17);
    const uv = g.attributes.uv, a = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) a[i] = uv.getY(i); g.setAttribute('aDoc', new THREE.BufferAttribute(a, 1)); return g; };
  const gVet = mergeGeometries([vet1(), vet1().rotateZ(Math.PI / 2)]); // hai dải chéo nhau: nhìn từ trên hay từ ngang đều thấy
  const vVet = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `attribute float aDoc; varying float vA; varying float vX; void main() { vA = aDoc; vX = uv.x; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying float vA; varying float vX; void main() { float a = pow(vA, 2.2) * (1.0 - abs(vX - 0.5) * 2.0); gl_FragColor = vec4(mix(vec3(1.0, 0.55, 0.4), vec3(1.0, 0.18, 0.12), 1.0 - vA), a * 0.9); }` });
  const vet = new THREE.InstancedMesh(gVet, vVet, nB * 2);
  for (const m of [thanBay, denTruoc, vet]) { m.frustumCulled = false; goc.add(m); }

  // ---------- xe chạy trên đường lớn: đi bên trái (Nhật), nhiều làn, màu xe ngẫu nhiên ----------
  const LAN = { lon: [2.5, 6, 9.5], vua: [2.2, 5.2] };
  const tuyenXe = ql.daiLo.filter((d) => LAN[d.lop]).map((d) => ({ lop: d.lop, ...taoTuyen(d.g, 15) })).filter((t) => t.L > 60);
  const xe = [], rX = gieo(23);
  for (const t of tuyenXe) for (const [li, ben] of LAN[t.lop].entries()) for (const chieu of [1, -1]) {
    const n = Math.floor(t.L / (38 + li * 14));
    for (let k = 0; k < n; k++) xe.push({ t, s: (k + rX() * 0.6) / n * t.L, v: chieu * (10 + li * 3 + rX() * 4), ben: ben * chieu, cao: rX() < 0.12 ? 1 : 0 });
  }
  const gXe = new THREE.BoxGeometry(1.8, 1.45, 4.4).translate(0, 0.72, 0);
  const thanXe = new THREE.InstancedMesh(gXe, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.45 }), xe.length);
  const MAU_XE = ['#e8e8e6', '#e8e8e6', '#1c1f22', '#9aa2a8', '#4b5560', '#a13a32', '#2d4a6a', '#d8cfb8'];
  for (const [i, c] of xe.entries()) thanXe.setColorAt(i, new THREE.Color(c.cao ? '#3d6b5a' : MAU_XE[(rX() * MAU_XE.length) | 0]));
  const dauXe = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.55, 2).translate(0, 1.7, -0.3), new THREE.MeshStandardMaterial({ color: '#1e262c', roughness: 0.15, metalness: 0.7 }), xe.length);
  for (const m of [thanXe, dauXe]) { m.frustumCulled = false; goc.add(m); }

  // ---------- tàu: đoàn 7 toa chạy đi chạy lại trên mỗi tuyến tàu dài ----------
  const TOA = 7, DAI_TOA = 20;
  const tuyenTau = ql.tau.map((g) => taoTuyen(g, 12)).filter((t) => t.L > 400);
  const tau = tuyenTau.map((t, i) => ({ t, s: (i * 0.37 % 1) * (t.L - TOA * 21), v: 16 + (i % 3) * 3 }));
  const thanTau = new THREE.InstancedMesh(new THREE.BoxGeometry(2.9, 3.4, DAI_TOA).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: '#dfe3e4', roughness: 0.45, metalness: 0.3 }), tau.length * TOA);
  const kinhTau = new THREE.InstancedMesh(new THREE.BoxGeometry(2.96, 0.95, DAI_TOA - 1.4).translate(0, 2.75, 0), new THREE.MeshStandardMaterial({ color: '#1a2228', roughness: 0.12, metalness: 0.8 }), tau.length * TOA);
  const socTau = new THREE.InstancedMesh(new THREE.BoxGeometry(2.98, 0.28, DAI_TOA - 0.4).translate(0, 1.7, 0), new THREE.MeshBasicMaterial({ color: '#c8323a' }), tau.length * TOA);
  for (const m of [thanTau, kinhTau, socTau]) { m.frustumCulled = false; goc.add(m); }

  // ---------- cầu nối + vườn treo giữa các tháp gần nhau ----------
  // luật khớp: cầu đặt trên một sàn tầng thật của tháp thấp hơn (chân mọi tháp trên lưới tầng chung → cùng sàn ở tháp kia, cầu nằm ngang),
  // nối MẶT tháp tới mặt tháp (không xuyên tâm), nhịp ≤ cauMax, không đi xuyên tháp thứ ba, không quá 85% chiều cao tháp nào.
  const cau = []; const daCo = new Set(), dDoan = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };
  for (const [i, a] of dsThap.entries()) {
    let tot = -1, hMin = Infinity;
    for (const [j, b] of dsThap.entries()) { if (j === i) continue; const nhip = Math.hypot(a.t.o[0] - b.t.o[0], a.t.o[1] - b.t.o[1]) - a.R - b.R;
      if (nhip > TL.cauMax || nhip >= hMin) continue;
      if (dsThap.some((c, k) => k !== i && k !== j && dDoan(c.t.o[0], c.t.o[1], a.t.o, b.t.o) < c.R + 5)) continue;
      hMin = nhip; tot = j; }
    if (tot < 0) continue; const k = Math.min(i, tot) + '-' + Math.max(i, tot); if (daCo.has(k)) continue; daCo.add(k);
    const b = dsThap[tot], hThap = Math.min(a.than, b.than);
    for (const f of hThap > 200 ? [0.32, 0.56] : [0.42]) cau.push({ a, b, y: batTang(hThap * f) });
  }
  const khop = { tong: 0, luat: {} }; // bộ đếm luật khớp, cập nhật mỗi lần đất dựng lại (redspires.tk.khop trỏ cùng đối tượng)
  const vCau = new THREE.MeshStandardMaterial({ color: '#8f8578', roughness: 0.8, metalness: 0.1 });
  const vKinhCau = new THREE.MeshStandardMaterial({ color: '#41525c', roughness: 0.1, metalness: 0.75, transparent: true, opacity: 0.75 });
  const vLa = new THREE.MeshStandardMaterial({ color: '#4f7a3e', roughness: 0.95 });
  const vLaRu = new THREE.MeshStandardMaterial({ color: '#5d8a46', roughness: 0.95 });
  const RU = 9; // dây leo rủ mỗi cầu
  const sanCau = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.4, 1), vCau, cau.length);
  const kinhCau = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 3.2, 1).translate(0, 2.3, 0), vKinhCau, cau.length);
  const vuonCau = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.3, 1).translate(0, 4.6, 0), vLa, cau.length);
  const ruCau = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0), vLaRu, cau.length * RU * 2);
  for (const m of [sanCau, kinhCau, vuonCau, ruCau]) { m.frustumCulled = false; goc.add(m); }
  const rR = gieo(55), ruDai = Array.from({ length: cau.length * RU * 2 }, () => 3 + rR() * 14), ruViTri = ruDai.map(() => rR());
  function datCau() {
    let r = 0;
    for (const [i, c] of cau.entries()) {
      const ax = c.a.t.o[0], az = c.a.t.o[1], bx = c.b.t.o[0], bz = c.b.t.o[1], yA0 = c.a.y0 ?? 0, yB0 = c.b.y0 ?? 0;
      const y = Math.max(yA0, yB0) + c.y; c.yA = y - yA0; c.yB = y - yB0; c.ra = c.a.rTai(c.yA); c.rb = c.b.rTai(c.yB); // cùng sàn ở cả hai tháp
      const D = Math.hypot(bx - ax, bz - az); _d.set(bx - ax, 0, bz - az).normalize(); huong(_d, _q);
      const ga = c.ra - 0.8, gb = c.rb - 0.8, L = D - ga - gb; // mặt tới mặt, ngập 0,8 m vào thân cho kín mối nối
      _p.set(ax + _d.x * (ga + L / 2), y - 0.7, az + _d.z * (ga + L / 2)); // sàn cầu dày 1,4 m, MẶT sàn đúng cao độ sàn tầng
      _s.set(9, 1, L); sanCau.setMatrixAt(i, _m.compose(_p, _q, _s));
      _s.set(7.5, 1, L); kinhCau.setMatrixAt(i, _m.compose(_p, _q, _s));
      _s.set(8.6, 1, L * 0.82); vuonCau.setMatrixAt(i, _m.compose(_p, _q, _s));
      for (let k = 0; k < RU * 2; k++, r++) { const ben = k % 2 ? 1 : -1, f = (ruViTri[r] - 0.5) * 0.7;
        _t.set(_d.z * ben * 4.7, -0.7, -_d.x * ben * 4.7); _t.x += _d.x * f * L; _t.z += _d.z * f * L;
        _t.add(_p); _s.set(1.2, ruDai[r], 0.5); ruCau.setMatrixAt(r, _m.compose(_t, _q, _s)); }
    }
    _s.set(1, 1, 1);
    for (const m of [sanCau, kinhCau, vuonCau, ruCau]) m.instanceMatrix.needsUpdate = true;
    const k = kiem(luoiTuyen(ql), {
      thap: dsThap.map((d) => ({ x: d.t.o[0], z: d.t.o[1], r: d.R, y0: d.y0 ?? 0, cao: d.t.caoSpire, rong: 2 * d.R })),
      cau: cau.map((c) => ({ ax: c.a.t.o[0], az: c.a.t.o[1], ra: c.ra, bx: c.b.t.o[0], bz: c.b.t.o[1], rb: c.rb, yA: c.yA, yB: c.yB, yAbs: (c.a.y0 ?? 0) + c.yA, yBabs: (c.b.y0 ?? 0) + c.yB, caoA: c.a.than, caoB: c.b.than })) });
    khop.tong = k.tong; khop.luat = k.luat; khop.vd = k.vd;
  }

  // ---------- đất dựng xong: dò lại độ cao các tuyến + cầu + sương ----------
  function datLai(muot, y0) {
    for (const t of [...tuyenXe, ...tuyenTau]) for (const p of t.P) p.y = muot(p.x, p.z) + 0.6;
    yDat.v = y0; datSuong(); datCau();
  }

  // ---------- mỗi khung ----------
  let tXe = 0;
  function khung(dt) {
    uT.value += dt;
    for (const [i, c] of xeBay.entries()) {
      const l = c.l; c.s = ((c.s + c.v * dt) % l.L + l.L) % l.L;
      lay(l, c.s, _p, _d); if (c.v < 0) _d.negate();
      _p.x += _d.z * c.ben; _p.z -= _d.x * c.ben; _p.y = yDat.v + c.y + Math.sin(uT.value * 0.7 + c.lac) * 1.2;
      huong(_d, _q); thanBay.setMatrixAt(i, _m.compose(_p, _q, _s));
      _t.copy(_d).multiplyScalar(3.3).add(_p); denTruoc.setMatrixAt(i, _m.compose(_t, _q, _s));
      for (const b of [-0.9, 0.9]) { _t.set(_d.z * b, 0, -_d.x * b).add(_p); _t.addScaledVector(_d, -2.6); vet.setMatrixAt(i * 2 + (b > 0 ? 1 : 0), _m.compose(_t, _q, _s)); }
    }
    thanBay.instanceMatrix.needsUpdate = denTruoc.instanceMatrix.needsUpdate = vet.instanceMatrix.needsUpdate = true;
    // xe đường đất: nửa tốc độ khung (đủ mượt ở 10–20 m/s), đỡ việc cho CPU
    tXe += dt; if (tXe >= 1 / 30) {
      for (const [i, c] of xe.entries()) {
        const t = c.t; c.s = ((c.s + c.v * tXe) % t.L + t.L) % t.L;
        lay(t, c.s, _p, _d); if (c.v < 0) _d.negate();
        const b = Math.abs(c.ben); _p.x += _d.z * b; _p.z -= _d.x * b;
        huong(_d, _q); _m.compose(_p, _q, _s); thanXe.setMatrixAt(i, _m); dauXe.setMatrixAt(i, _m);
      }
      thanXe.instanceMatrix.needsUpdate = dauXe.instanceMatrix.needsUpdate = true; tXe = 0;
    }
    for (const [i, c] of tau.entries()) {
      const dai = TOA * (DAI_TOA + 1), chay = c.t.L - dai; c.s += c.v * dt;
      if (c.s > chay) { c.s = chay; c.v = -Math.abs(c.v); } else if (c.s < 0) { c.s = 0; c.v = Math.abs(c.v); }
      for (let k = 0; k < TOA; k++) { lay(c.t, c.s + k * (DAI_TOA + 1) + DAI_TOA / 2, _p, _d); huong(_d, _q); _m.compose(_p, _q, _s);
        const j = i * TOA + k; thanTau.setMatrixAt(j, _m); kinhTau.setMatrixAt(j, _m); socTau.setMatrixAt(j, _m); }
    }
    thanTau.instanceMatrix.needsUpdate = kinhTau.instanceMatrix.needsUpdate = socTau.instanceMatrix.needsUpdate = true;
  }
  return { datLai, khung, uT, anKhi2200: [thanBay, denTruoc, vet, suong, sanCau, kinhCau, vuonCau, ruCau], tk: { xeBay: nB, xe: xe.length, tau: tau.length, cau: cau.length, suong: o.length, khop } };
}
