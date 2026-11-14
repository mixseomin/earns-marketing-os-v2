// Lâu đài CÓ THẬT dựng từ số đo: khối nhà 3D OpenStreetMap (chiều cao, đáy, kiểu mái, màu) + địa hình EU-DEM 25 m.
// Bản khối thô (bước 2): đúng mặt bằng + chiều cao + kiểu mái, chưa có cửa / chi tiết. 1 đơn vị = 1 m, -z = bắc.
// Quy tắc OSM "Simple 3D Buildings": nhà có building:part thì chỉ vẽ các part, không vẽ vỏ ngoài.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const ten = new URLSearchParams(location.search).get('lau') || 'neuschwanstein';
const D = await (await fetch(`./du-lieu/${ten}.json`, { cache: 'no-cache' })).json();

// ---------- cảnh
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xa9c4dc); scene.fog = new THREE.Fog(0xa9c4dc, 600, 2200);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 5000);
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x55603a, 1.3));
const nang = new THREE.DirectionalLight(0xfff1dc, 2.6); nang.position.set(-260, 380, 180); nang.castShadow = true;
nang.shadow.mapSize.set(2048, 2048); Object.assign(nang.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 50, far: 1200 }); nang.shadow.bias = -0.0004; scene.add(nang);

// ---------- địa hình: lưới độ cao, gốc toạ độ = độ cao tâm lâu đài
const G = D.diaHinh, n = G.n, B = G.buoc, NUA = G.nua;
const caoO = (i, j) => G.cao[Math.max(0, Math.min(n - 1, j)) * n + Math.max(0, Math.min(n - 1, i))];
function caoDat(x, z) { // nội suy song tuyến
  const fx = (x + NUA) / B, fz = (z + NUA) / B, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (caoO(i, j) * (1 - u) + caoO(i + 1, j) * u) * (1 - v) + (caoO(i, j + 1) * (1 - u) + caoO(i + 1, j + 1) * u) * v;
}
const GOC_Y = caoDat(0, 0);
{
  const g = new THREE.PlaneGeometry(2 * NUA, 2 * NUA, n - 1, n - 1); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, mau = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const y = caoDat(p.getX(k), p.getZ(k)) - GOC_Y; p.setY(k, y);
    c.setHSL(0.26 - Math.min(0.08, Math.max(0, y) / 2500), 0.32, 0.26 + Math.max(-0.06, Math.min(0.12, y / 900))); mau.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(mau, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; scene.add(m);
}

// ---------- khối nhà
const so = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
const dienTich = (v) => { let a = 0; for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
const trongDa = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const tamDa = (v) => v.reduce((s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length], [0, 0]);
const mauOSM = (s, md) => { if (!s) return md; try { return new THREE.Color(s.trim().toLowerCase() === 'tan' ? '#d2b48c' : s.trim()); } catch { return md; } };
const MAU_TUONG = new THREE.Color('#e6dfcf'), MAU_MAI = new THREE.Color('#3a4150');

const dsKhoi = D.khoi.map((k) => {
  let v = k.ngoai[0].slice(); if (v.length > 1 && v[0][0] === v.at(-1)[0] && v[0][1] === v.at(-1)[1]) v.pop();
  if (dienTich(v) < 0) v.reverse(); // ngược chiều kim đồng hồ khi nhìn từ trên (x đông, z nam)
  return { ...k, v, la: !!k.tags['building:part'], vo: !!k.tags.building && !k.tags['building:part'] };
}).filter((k) => k.v.length >= 3 && (k.la || k.vo) && k.tags.building !== 'courtyard' && k.tags.building !== 'roof');
const parts = dsKhoi.filter((k) => k.la);
for (const k of dsKhoi) if (k.vo) k.coPart = parts.some((p) => { const [x, z] = tamDa(p.v); return trongDa(x, z, k.v); });
// đáy chung: điểm thấp nhất của mặt đất dưới vỏ nhà (part dùng đáy của vỏ chứa nó) → tường chạy xuống tới đá, không lơ lửng
const dayCua = (v) => Math.min(...v.map(([x, z]) => caoDat(x, z))) - GOC_Y;
for (const k of dsKhoi) if (k.vo) k.day = dayCua(k.v);
for (const p of parts) { const [x, z] = tamDa(p.v); const vo = dsKhoi.find((k) => k.vo && trongDa(x, z, k.v)); p.day = vo ? vo.day : dayCua(p.v); }

// hộp chữ nhật bao nhỏ nhất (theo cạnh dài nhất) cho mái đầu hồi / bốn mái / một mái
function hopBao(v) {
  let tot = null;
  for (let i = 0; i < v.length; i++) {
    const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length], a = Math.atan2(z2 - z1, x2 - x1), c = Math.cos(a), s = Math.sin(a);
    let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
    for (const [x, z] of v) { const u = x * c + z * s, w = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
    const dt = (u1 - u0) * (w1 - w0); if (!tot || dt < tot.dt) tot = { dt, a, c, s, u0, u1, w0, w1 };
  }
  // trục dài = trục u
  if (tot.w1 - tot.w0 > tot.u1 - tot.u0) { const { c, s } = tot; Object.assign(tot, { a: tot.a + Math.PI / 2, c: -s, s: c, u0: tot.w0, u1: tot.w1, w0: -tot.u1, w1: -tot.u0 }); }
  tot.ra = (u, w) => [u * tot.c - w * tot.s, u * tot.s + w * tot.c];
  return tot;
}
const tamGiac = (arr, ...p) => { for (const q of p) arr.push(...q); };

function dungKhoi(k) {
  const t = k.tags, v = k.v;
  const h = so(t.height) ?? (so(t['building:levels']) ? so(t['building:levels']) * 3.2 + (so(t['roof:height']) || 0) : 8);
  const hMin = so(t.min_height) ?? 0;
  const kieu = (t['roof:shape'] || 'flat').toLowerCase();
  let hMai = kieu === 'flat' ? 0 : so(t['roof:height']) ?? Math.min(12, Math.max(2, Math.sqrt(Math.abs(dienTich(v))) * (kieu === 'cone' || kieu === 'pyramidal' ? 0.9 : 0.45)));
  hMai = Math.min(hMai, Math.max(0, h - hMin - 0.5));
  const y0 = k.day + hMin, y1 = k.day + h - hMai, y2 = k.day + h;
  const tuong = [], mai = [];
  // tường: từ y0 lên y1 theo đúng đa giác
  for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; tamGiac(tuong, [x1, y0, z1], [x2, y0, z2], [x2, y1, z2], [x1, y0, z1], [x2, y1, z2], [x1, y1, z1]); }
  const napPhang = (y, arr) => { const s = new THREE.Shape(v.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(s); const p = g.toNonIndexed().attributes.position; for (let i = 0; i < p.count; i += 3) for (const j of [0, 1, 2]) arr.push(p.getX(i + j), y, -p.getY(i + j)); };
  if (kieu === 'pyramidal' || kieu === 'cone' || kieu === 'dome' || kieu === 'onion') {
    const [cx, cz] = tamDa(v);
    for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; tamGiac(mai, [x1, y1, z1], [x2, y1, z2], [cx, y2, cz]); }
  } else if (kieu === 'gabled' || kieu === 'hipped' || kieu === 'side_hipped' || kieu === 'half-hipped' || kieu === 'skillion') {
    const o = hopBao(v), wm = (o.w0 + o.w1) / 2, L = o.u1 - o.u0, W = o.w1 - o.w0;
    const thut = kieu === 'hipped' ? Math.min(W / 2, L / 2) : kieu === 'half-hipped' || kieu === 'side_hipped' ? Math.min(W / 4, L / 4) : 0;
    const P = (u, w, y) => { const [x, z] = o.ra(u, w); return [x, y, z]; };
    if (kieu === 'skillion') { // một mái: cao ở cạnh w0, thấp ở w1
      const a = P(o.u0, o.w0, y2), b = P(o.u1, o.w0, y2), c = P(o.u1, o.w1, y1), d = P(o.u0, o.w1, y1);
      tamGiac(mai, a, c, b, a, d, c);
      tamGiac(tuong, P(o.u0, o.w0, y1), P(o.u1, o.w0, y1), b, P(o.u0, o.w0, y1), b, a, P(o.u0, o.w1, y1), a, d, P(o.u0, o.w1, y1), P(o.u0, o.w0, y1), a, P(o.u1, o.w0, y1), P(o.u1, o.w1, y1), c, P(o.u1, o.w0, y1), c, b);
    } else {
      const r0 = P(o.u0 + thut, wm, y2), r1 = P(o.u1 - thut, wm, y2);
      const g00 = P(o.u0, o.w0, y1), g10 = P(o.u1, o.w0, y1), g11 = P(o.u1, o.w1, y1), g01 = P(o.u0, o.w1, y1);
      tamGiac(mai, g00, r1, g10, g00, r0, r1, g11, r0, g01, g11, r1, r0); // hai mái dài
      tamGiac(mai, g01, r0, g00, g10, r1, g11);                            // hai đầu (hồi đứng nếu thut = 0)
    }
    if (kieu !== 'flat') napPhang(y1, tuong); // trần dưới mái (đa giác thật ≠ hộp bao) để không thấy lỗ
  } else napPhang(y1, tuong); // mái bằng: nắp phẳng cùng màu tường
  const mauT = mauOSM(t['building:colour'], MAU_TUONG), mauM = kieu === 'flat' ? mauT : mauOSM(t['roof:colour'], MAU_MAI);
  return { tuong, mai, mauT, mauM, ten: t.name, h, y2 };
}

const tuongG = [], maiG = [];
const toG = (arr, mau) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); const c = new Float32Array(arr.length); for (let i = 0; i < arr.length; i += 3) c.set([mau.r, mau.g, mau.b], i); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
let caoNhat = null;
for (const k of dsKhoi) {
  if (k.vo && k.coPart) continue;
  const r = dungKhoi(k);
  if (r.tuong.length) tuongG.push(toG(r.tuong, r.mauT));
  if (r.mai.length) maiG.push(toG(r.mai, r.mauM));
  if (!caoNhat || r.y2 > caoNhat.y2) caoNhat = r;
}
const VL_T = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
const VL_M = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
for (const [gs, vl] of [[tuongG, VL_T], [maiG, VL_M]]) if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), vl); m.castShadow = m.receiveShadow = true; scene.add(m); }

// ---------- điều khiển + nhãn
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 25, 0); camera.position.set(-170, 90, 230); orbit.enableDamping = true; orbit.maxPolarAngle = 1.52; orbit.minDistance = 15; orbit.maxDistance = 1500; orbit.update();
$('tt').innerHTML = `${dsKhoi.filter((k) => !(k.vo && k.coPart)).length} khối từ OpenStreetMap · cao nhất ${caoNhat ? caoNhat.h + ' m' : '—'} · địa hình ${n}×${n} điểm, ô ${B} m`;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let lan = 0;
(function ve(now = 0) { requestAnimationFrame(ve); if (now - lan < (document.hasFocus() ? 1000 / 60 : 100) - 3) return; lan = now; orbit.update(); renderer.render(scene, camera); })();
window.__ns = { D, dsKhoi, camera, orbit, caoDat, GOC_Y };
