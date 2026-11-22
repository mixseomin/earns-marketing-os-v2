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

export function taoSong({ goc, ql, dsThap, nuaNut, LONG }) {
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

  // ---------- xe chạy trên đường có lòng nhựa: đi bên trái (Nhật), làn nằm TRONG lòng đường (khuôn ngang d.k của redspires.js), cả làn một tốc độ ----------
  // Xe trong một làn giữ khoảng cách với xe trước, dừng ở vạch dừng khi đèn nút giao đang đỏ, và dừng trước vật cản (người chơi, chiếc xe vàng).
  // Làn lấy từ KHUÔN NGANG của mỗi tuyến (d.k, redspires.js khuon): đường một chiều (nửa đường đôi) có n làn trải hết lòng [-raM, raP], cùng chiều g;
  // đường hai chiều chia đôi: m làn mỗi chiều, chiều xuôi nằm phía s âm (bên trái hướng đi). Lệch ben = -s (xem _p.x += _d.z * ben).
  const TOC = { lon: [9, 11, 12.5], vua: [8, 9] }; // m/s theo làn trong → ngoài (32–45 km/h, phố đông)
  const lanCua = (k) => { const ds = [];
    if (k.mot) { const W = k.raP + k.raM, n = Math.max(1, Math.min(k.lan, Math.floor(W / 2.6))); for (let li = 0; li < n; li++) ds.push({ li, ben: -(-k.raM + 0.4 + (li + 0.5) * (W - 0.8) / n), chieu: 1 }); }
    else { const a = Math.min(k.raP, k.raM), m = Math.max(1, Math.min(Math.floor(k.lan / 2), Math.floor((a - 0.3) / 2.6))); for (let li = 0; li < m; li++) { const ben = 0.3 + (li + 0.5) * (a - 0.6) / m; ds.push({ li, ben, chieu: 1 }, { li, ben, chieu: -1 }); } }
    for (const l of ds) { const sl = -l.ben * l.chieu; if (Math.abs(sl) + 0.9 > (sl >= 0 ? k.raP : k.raM) + 1e-6) console.error(`[sprawl] làn xe ở s=${sl.toFixed(2)} m tràn khỏi lòng đường`, k); } // thân xe rộng 1,8 m
    return ds; };
  // Dữ liệu có tuyến lặp y hệt (cùng hai đầu mút, cùng số điểm): giữ một, không thì hai đoàn xe chạy chồng lên nhau.
  const daTuyen = new Set(), khoaTuyen = (g) => { const a = g[0], b = g[g.length - 1], k1 = Math.round(a[0]) + ',' + Math.round(a[1]), k2 = Math.round(b[0]) + ',' + Math.round(b[1]); return (k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1) + '|' + g.length; };
  const huongNut = new Map(); // nút giao → hướng (0–π) của tuyến đầu tiên tới đó; tuyến lệch quá 45° so với nó thuộc nhóm đèn kia
  const tuyenXe = ql.daiLo.filter((d) => { if (!d.k) return false; const k = khoaTuyen(d.g); if (daTuyen.has(k)) return false; daTuyen.add(k); return true; }).map((d) => { const t = { lop: d.lop, k: d.k, ...taoTuyen(d.g, 15), nut: [] };
    let sd = 0; for (let i = 0; i < d.g.length; i++) { if (i) sd += Math.hypot(d.g[i][0] - d.g[i - 1][0], d.g[i][1] - d.g[i - 1][1]);
      const h = nuaNut(d.lop, d.g[i]); if (!h) continue; const a = d.g[Math.max(0, i - 1)], b = d.g[Math.min(d.g.length - 1, i + 1)];
      const kn = Math.round(d.g[i][0]) + ',' + Math.round(d.g[i][1]), goc = (Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI) % Math.PI; if (!huongNut.has(kn)) huongNut.set(kn, goc);
      const lech = Math.abs(goc - huongNut.get(kn));
      t.nut.push({ s: sd, h, nhom: Math.min(lech, Math.PI - lech) > Math.PI / 4 ? 1 : 0, pha: (Math.abs(Math.round(d.g[i][0]) * 7 + Math.round(d.g[i][1]) * 13) % 36) }); } // hai đường cắt nhau cùng điểm nút → cùng pha, khác nhóm
    return t; }).filter((t) => t.L > 60);
  // Đại lộ đôi: mỗi nửa là tuyến một chiều riêng (d.k.mot, từ dữ liệu oneway) → không còn đoán chiều theo tuyến song song.
  const xe = [], lanXe = [], rX = gieo(23);
  for (const t of tuyenXe) for (const { li, ben, chieu } of lanCua(t.k)) { const toc = TOC[t.lop]; 
    const n = Math.floor(t.L / (42 + li * 14)), lan = [];
    for (let k = 0; k < n; k++) { const c = { t, s: (k + rX() * 0.5) / n * t.L, v: 0, vMuon: toc[Math.min(li, toc.length - 1)], chieu, ben, cao: rX() < 0.12 ? 1 : 0, x: 0, z: 0 }; lan.push(c); xe.push(c); }
    if (lan.length) lanXe.push(lan); // trong một làn thứ tự s không đổi (không vượt nhau)
  }
  const CHU_KY = 36, XANH = 15; // đèn: nhóm 0 xanh giây 0–15, nhóm 1 xanh giây 18–33, giữa hai lượt 3 giây đỏ cả hai cho xe thoát nút
  const denDo = (n, tg) => { const p = (tg + n.pha) % CHU_KY - n.nhom * 18; return !(p >= 0 && p < XANH); };
  const O_XE = 12, oXe = new Map(), keXe = new Int32Array(xe.length); // lưới chỗ đứng của xe, dựng lại mỗi nhịp (danh sách móc nối, không cấp phát)
  const vatCan = []; // { x, z, r }: sprawl.js đặt mỗi khung (người chơi, xe của người chơi)
  const gXe = new THREE.BoxGeometry(1.8, 1.45, 4.4).translate(0, 0.72, 0);
  const thanXe = new THREE.InstancedMesh(gXe, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.45 }), xe.length);
  const MAU_XE = ['#e8e8e6', '#e8e8e6', '#1c1f22', '#9aa2a8', '#4b5560', '#a13a32', '#2d4a6a', '#d8cfb8'];
  for (const [i, c] of xe.entries()) { c.i = i; thanXe.setColorAt(i, new THREE.Color(c.cao ? '#3d6b5a' : MAU_XE[(rX() * MAU_XE.length) | 0])); }
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
      _s.set(9, 1, L); sanCau.setMatrixAt(i, _m.compose(_p, _q, _s)); c.va = { x: _p.x, y: _p.y, z: _p.z, q: { x: _q.x, y: _q.y, z: _q.z, w: _q.w }, L, dx: _d.x, dz: _d.z }; // tư thế sàn cầu cho khung va (redspires dungVa)
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
    // xe đường đất: nửa tốc độ khung (đủ mượt ở 8–10 m/s), đỡ việc cho CPU
    tXe += dt; if (tXe >= 1 / 30) {
      oXe.clear(); for (const c of xe) { if (c.dx === undefined) continue; const k = Math.floor(c.x / O_XE) * 8192 + Math.floor(c.z / O_XE); keXe[c.i] = oXe.has(k) ? oXe.get(k) : -1; oXe.set(k, c.i); } // lưới 12 m: xe nào đang ở ô nào
      for (const lan of lanXe) for (let k = 0; k < lan.length; k++) { const c = lan[k], t = c.t, ch = c.chieu;
        let trong = 1e4; // quãng trống phía trước tới chỗ phải dừng (m)
        if (lan.length > 1) { const tr = lan[(k + ch + lan.length) % lan.length]; trong = (((tr.s - c.s) * ch) % t.L + t.L) % t.L - 7; } // xe trước: giữ hở 2,6 m sau đuôi
        for (const n of t.nut) { const d = (n.s - c.s) * ch - n.h - 8.6; if (d > -1 && d < trong && denDo(n, uT.value)) trong = d; } // vạch dừng ở 6,2 m trước mép đường cắt; qua vạch rồi thì đi tiếp
        for (const o of vatCan) { const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz > 1600) continue; lay(t, c.s, _p, _d); if (ch < 0) _d.negate();
          const doc = dx * _d.x + dz * _d.z, ngang = Math.abs(dx * _d.z - dz * _d.x); if (doc > 0 && ngang < 1.3 + o.r) trong = Math.min(trong, doc - 2.6 - o.r - 1.5); }
        // xe của TUYẾN KHÁC nằm trong hành lang phía trước (hai nửa đại lộ chập nhau, chỗ nhập tuyến, xe cắt ngang còn kẹt trong nút):
        // cùng chiều thì xe sau nhường; đè ngang nhau hoặc cắt nhau thì xe số lớn nhường (một chiều duy nhất → không khoá chết nhau)
        if (c.dx !== undefined) { const ox = Math.floor(c.x / O_XE), oz = Math.floor(c.z / O_XE);
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let j = oXe.get((ox + a) * 8192 + oz + b) ?? -1; j >= 0; j = keXe[j]) { const o = xe[j]; if (o.t === t) continue;
            const rx = o.x - c.x, rz = o.z - c.z, doc = rx * c.dx + rz * c.dz, ngang = Math.abs(rx * c.dz - rz * c.dx); if (ngang > 2.3 || doc > 16 || doc < -4.4) continue;
            const cung = o.dx * c.dx + o.dz * c.dz; if (cung < -0.5) continue; // ngược chiều: làn bên kia
            if (cung > 0.5 ? (doc > 4.4 || (doc > -4.4 && o.i < c.i)) : (doc > 0 && o.i < c.i)) trong = Math.min(trong, doc - 7); } }
        const vDuoc = Math.min(c.vMuon, Math.sqrt(2 * 3.5 * Math.max(0, trong))); // hãm êm 3,5 m/s² là dừng kịp
        c.v = vDuoc > c.v ? Math.min(vDuoc, c.v + 1.8 * tXe) : Math.max(vDuoc, c.v - 7 * tXe);
        c.s = ((c.s + c.v * ch * tXe) % t.L + t.L) % t.L;
        lay(t, c.s, _p, _d); if (ch < 0) _d.negate();
        _p.x += _d.z * c.ben; _p.z -= _d.x * c.ben; c.x = _p.x; c.z = _p.z; c.dx = _d.x; c.dz = _d.z;
        huong(_d, _q); _m.compose(_p, _q, _s); thanXe.setMatrixAt(c.i, _m); dauXe.setMatrixAt(c.i, _m);
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
  // cho người đi bộ (nguoi-gan.js): đèn cho XE của đường hướng (ux, uz) tại nút (x, z) — true đỏ, false xanh, null không phải nút có đèn
  const denXe = (x, z, ux, uz, them = 0) => { const kn = Math.round(x) + ',' + Math.round(z), g0 = huongNut.get(kn); if (g0 === undefined) return null;
    const goc = (Math.atan2(uz, ux) + Math.PI) % Math.PI, lech = Math.abs(goc - g0);
    return denDo({ pha: Math.abs(Math.round(x) * 7 + Math.round(z) * 13) % 36, nhom: Math.min(lech, Math.PI - lech) > Math.PI / 4 ? 1 : 0 }, uT.value + them); };
  // duyệt xe quanh (x, z) bán kính r theo lưới oXe; fn trả false = dừng, hàm trả false
  const xeQuanh = (x, z, r, fn) => { const o = Math.ceil(r / O_XE), ox = Math.floor(x / O_XE), oz = Math.floor(z / O_XE);
    for (let a = -o; a <= o; a++) for (let b = -o; b <= o; b++) for (let j = oXe.get((ox + a) * 8192 + oz + b) ?? -1; j >= 0; j = keXe[j]) if (fn(xe[j]) === false) return false; return true; };
  return { datLai, khung, uT, vatCan, gt: { xe, tuyenXe, lay, denDo, denXe, xeQuanh }, cau, anKhi2200: [thanBay, denTruoc, vet, suong, sanCau, kinhCau, vuonCau, ruCau], tk: { xeBay: nB, xe: xe.length, tau: tau.length, cau: cau.length, suong: o.length, khop } };
}
