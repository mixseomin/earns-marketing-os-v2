// Lâu đài CÓ THẬT dựng từ số đo: khối nhà 3D OpenStreetMap (chiều cao, đáy, kiểu mái, màu) + địa hình EU-DEM 25 m.
// Bước 4–5: vật liệu (móng đá thô · mặt tiền đá vôi cửa sổ vòm · mái đá phiến · răng cưa mái bằng), vách đá, rừng; đi bộ / leo / va chạm
// (dibo.js — dùng chung, người chơi có xương + động tác thật nguoi3d.js). 1 đơn vị = 1 m, -z = bắc.
// Quy tắc OSM "Simple 3D Buildings": nhà có building:part thì chỉ vẽ các part, không vẽ vỏ ngoài.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import RAPIER from 'rapier';
import * as T from './tex.js';
import { napNguoi3d, taoNguoi3d } from './nguoi3d.js';
import { taoDiBo } from './dibo.js';

const $ = (id) => document.getElementById(id);
const ten = new URLSearchParams(location.search).get('lau') || 'neuschwanstein';
const D = await (await fetch(`./du-lieu/${ten}.json`, { cache: 'no-cache' })).json();
// SỬA THEO ẢNH: số đo OSM lệch so với ảnh thật thì ghi phần chỉnh vào du-lieu/<ten>-sua.json ({ "way/…": { height, min_height, "roof:height", ly_do } }),
// không sửa tệp số đo gốc — để biết khối nào là số OSM, khối nào đã chỉnh theo ảnh nào.
const SUA = await fetch(`./du-lieu/${ten}-sua.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
for (const k of D.khoi) if (SUA[k.id]) { k.tagsGoc = { ...k.tags }; for (const [a, b] of Object.entries(SUA[k.id])) if (a !== 'ly_do') k.tags[a] = String(b); }

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
  for (let k = 0; k < p.count; k++) p.setY(k, caoDat(p.getX(k), p.getZ(k)) - GOC_Y);
  g.computeVertexNormals();
  const nm = g.attributes.normal, r0 = T.rngTu(11);
  for (let k = 0; k < p.count; k++) { // cỏ / rừng thưa ở chỗ thoải, vách đá vôi xám ở chỗ dốc (hẻm Pöllat, chân lâu đài)
    const doc = 1 - nm.getY(k), da = THREE.MathUtils.smoothstep(doc, 0.22, 0.42), nhieu = (r0() - 0.5) * 0.04;
    c.setHSL(0.27, 0.34, 0.27 + nhieu).lerp(new THREE.Color().setHSL(0.1, 0.06, 0.5 + nhieu), da); mau.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(mau, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; scene.add(m);
}

// ---------- vật lý: mặt đất = lưới độ cao (Rapier heightfield, cột trước: heights[i*n + j] với i theo x, j theo z)
try { await RAPIER.init(); } catch (e) { console.warn('[ns] không nạp được vật lý', e); }
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }), tinh = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
{
  const h = new Float32Array(n * n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h[i * n + j] = G.cao[j * n + i] - GOC_Y;
  world.createCollider(RAPIER.ColliderDesc.heightfield(n - 1, n - 1, h, { x: 2 * NUA, y: 1, z: 2 * NUA }), tinh);
}

// ---------- khối nhà
const so = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
const dienTich = (v) => { let a = 0; for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
const trongDa = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const tamDa = (v) => v.reduce((s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length], [0, 0]);
const mauOSM = (s, md) => { if (!s) return md; try { return new THREE.Color(s.trim().toLowerCase() === 'tan' ? '#d2b48c' : s.trim()); } catch { return md; } };
const MAU_MAI = new THREE.Color('#3a4150');

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
// đáy cao nhất dưới vỏ nhà: phần tường dưới mặt đất cao nhất là MÓNG đá thô (dựng xuống tới chân vách), trên đó là mặt tiền
const dinhDat = (v) => Math.max(...v.map(([x, z]) => caoDat(x, z))) - GOC_Y;
for (const k of dsKhoi) if (k.vo) k.datCao = dinhDat(k.v);
for (const p of parts) { const [x, z] = tamDa(p.v); const vo = dsKhoi.find((k) => k.vo && trongDa(x, z, k.v)); p.datCao = vo ? vo.datCao : dinhDat(p.v); }

// nhóm vật liệu: mong (móng đá thô) · mat (mặt tiền cửa sổ) · da (đá vôi trơn: nắp, răng cưa) · mai (đá phiến, pha màu mái OSM)
function nhomMoi() { return { mong: { p: [], uv: [] }, mat: { p: [], uv: [], c: [] }, da: { p: [], uv: [], c: [] }, mai: { p: [], uv: [], c: [] } }; }
// mảng tường dọc cạnh (x1,z1)→(x2,z2) từ ya lên yb, u theo mét dọc chu vi (cửa sổ liền mạch quanh khối), v theo mét từ mặt đất
function vachTuong(G, x1, z1, x2, z2, ya, yb, s0, yRef, coi, mau) {
  if (yb - ya < 0.01) return; const L = Math.hypot(x2 - x1, z2 - z1), u0 = s0 / coi, u1 = (s0 + L) / coi, va = (ya - yRef) / coi, vb = (yb - yRef) / coi;
  G.p.push(x1, ya, z1, x2, ya, z2, x2, yb, z2, x1, ya, z1, x2, yb, z2, x1, yb, z1); G.uv.push(u0, va, u1, va, u1, vb, u0, va, u1, vb, u0, vb);
  if (G.c) for (let i = 0; i < 6; i++) G.c.push(mau.r, mau.g, mau.b);
}
// toạ độ vân theo mặt chiếu trội (mái, nắp): mét thế giới / coi
function uvChieu(arr, coi) {
  const uv = [];
  for (let i = 0; i < arr.length; i += 9) {
    const a = new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]), b = new THREE.Vector3(arr[i + 3], arr[i + 4], arr[i + 5]), c = new THREE.Vector3(arr[i + 6], arr[i + 7], arr[i + 8]);
    const nn = b.clone().sub(a).cross(c.clone().sub(a)), ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    for (const q of [a, b, c]) uv.push(...(ay >= ax && ay >= az ? [q.x / coi, q.z / coi] : ax >= az ? [q.z / coi, q.y / coi] : [q.x / coi, q.y / coi]));
  }
  return uv;
}

function dungKhoi(k, G) {
  const t = k.tags, v = k.v;
  const h = so(t.height) ?? (so(t['building:levels']) ? so(t['building:levels']) * 3.2 + (so(t['roof:height']) || 0) : 8);
  const hMin = so(t.min_height) ?? 0;
  const kieu = (t['roof:shape'] || 'flat').toLowerCase();
  let hMai = kieu === 'flat' ? 0 : so(t['roof:height']) ?? Math.min(12, Math.max(2, Math.sqrt(Math.abs(dienTich(v))) * (kieu === 'cone' || kieu === 'pyramidal' ? 0.9 : 0.45)));
  hMai = Math.min(hMai, Math.max(0, h - hMin - 0.5));
  const y0 = k.day + hMin, y1 = k.day + h - hMai, y2 = k.day + h;
  const yMong = hMin > 0 ? y0 : Math.min(y1, Math.max(y0, k.datCao + 1.2)); // móng đá thô tới quá mặt đất cao nhất 1,2 m
  const mai = [], da = [];
  const mauT = mauOSM(t['building:colour'], new THREE.Color(1, 1, 1)).lerp(new THREE.Color(1, 1, 1), 0.3); // màu tường OSM (Torbau gạch đỏ) pha lên vân đá
  let s0 = 0;
  for (let i = 0; i < v.length; i++) {
    const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length];
    vachTuong(G.mong, x1, z1, x2, z2, y0, yMong, s0, k.day, 3);
    vachTuong(G.mat, x1, z1, x2, z2, yMong, y1, s0, yMong, 4, mauT);
    s0 += Math.hypot(x2 - x1, z2 - z1);
  }
  const napPhang = (y, arr) => { const sh = new THREE.Shape(v.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(sh); const p = g.toNonIndexed().attributes.position; for (let i = 0; i < p.count; i += 3) for (const j of [0, 2, 1]) arr.push(p.getX(i + j), y, -p.getY(i + j)); };
  if (kieu === 'pyramidal' || kieu === 'cone' || kieu === 'dome' || kieu === 'onion') {
    const [cx, cz] = tamDa(v);
    for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; tamGiac(mai, [x1, y1, z1], [x2, y1, z2], [cx, y2, cz]); }
  } else if (kieu === 'gabled' || kieu === 'hipped' || kieu === 'side_hipped' || kieu === 'half-hipped' || kieu === 'skillion') {
    const o = hopBao(v), wm = (o.w0 + o.w1) / 2, L = o.u1 - o.u0, W = o.w1 - o.w0;
    const thut = kieu === 'hipped' ? Math.min(W / 2, L / 2) : kieu === 'half-hipped' || kieu === 'side_hipped' ? Math.min(W / 4, L / 4) : 0;
    const P = (u, w, y) => { const [x, z] = o.ra(u, w); return [x, y, z]; };
    if (kieu === 'skillion') {
      const a = P(o.u0, o.w0, y2), b = P(o.u1, o.w0, y2), c = P(o.u1, o.w1, y1), d = P(o.u0, o.w1, y1);
      tamGiac(mai, a, c, b, a, d, c);
      tamGiac(da, P(o.u0, o.w0, y1), P(o.u1, o.w0, y1), b, P(o.u0, o.w0, y1), b, a, P(o.u0, o.w1, y1), a, d, P(o.u0, o.w1, y1), P(o.u0, o.w0, y1), a, P(o.u1, o.w0, y1), P(o.u1, o.w1, y1), c, P(o.u1, o.w0, y1), c, b);
    } else {
      const r0 = P(o.u0 + thut, wm, y2), r1 = P(o.u1 - thut, wm, y2);
      const g00 = P(o.u0, o.w0, y1), g10 = P(o.u1, o.w0, y1), g11 = P(o.u1, o.w1, y1), g01 = P(o.u0, o.w1, y1);
      tamGiac(mai, g00, r1, g10, g00, r0, r1, g11, r0, g01, g11, r1, r0);
      if (thut > 0) tamGiac(mai, g01, r0, g00, g10, r1, g11); else tamGiac(da, g01, r0, g00, g10, r1, g11); // đầu hồi đứng = tường đá
    }
    napPhang(y1, da);
  } else {
    napPhang(y1, da);
    if (h >= 10) { // mái bằng của tháp: răng cưa dọc mép (cao 1,1 m, răng 0,8 m cách 0,8 m)
      for (let i = 0; i < v.length; i++) {
        const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length], L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
        for (let s = 0.2; s + 0.8 <= L; s += 1.6) {
          const ax = x1 + ux * s, az = z1 + uz * s, bx = ax + ux * 0.8, bz = az + uz * 0.8, nx = -uz * 0.45, nz = ux * 0.45; // pháp tuyến vào trong (đa giác ngược chiều kim)
          for (const [p1, p2] of [[[ax, az], [bx, bz]], [[bx, bz], [bx + nx, bz + nz]], [[bx + nx, bz + nz], [ax + nx, az + nz]], [[ax + nx, az + nz], [ax, az]]]) tamGiac(da, [p1[0], y1, p1[1]], [p2[0], y1, p2[1]], [p2[0], y1 + 1.1, p2[1]], [p1[0], y1, p1[1]], [p2[0], y1 + 1.1, p2[1]], [p1[0], y1 + 1.1, p1[1]]);
          tamGiac(da, [ax, y1 + 1.1, az], [bx, y1 + 1.1, bz], [bx + nx, y1 + 1.1, bz + nz], [ax, y1 + 1.1, az], [bx + nx, y1 + 1.1, bz + nz], [ax + nx, y1 + 1.1, az + nz]);
        }
      }
    }
  }
  const mauM = kieu === 'flat' ? null : mauOSM(t['roof:colour'], MAU_MAI).lerp(new THREE.Color(1, 1, 1), 0.55); // pha nhẹ lên vân đá phiến
  G.da.p.push(...da); G.da.uv.push(...uvChieu(da, 4)); for (let i = 0; i < da.length; i += 3) G.da.c.push(mauT.r, mauT.g, mauT.b);
  G.mai.p.push(...mai); G.mai.uv.push(...uvChieu(mai, 2.5)); for (let i = 0; i < mai.length; i += 3) G.mai.c.push(mauM.r, mauM.g, mauM.b);
  return { mai, da, ten: t.name, h, y2, y0, y1, yMong };
}

const NHOM = nhomMoi();
let caoNhat = null;
for (const k of dsKhoi) {
  if (k.vo && k.coPart) continue;
  const truoc = { mong: NHOM.mong.p.length, mat: NHOM.mat.p.length };
  const r = dungKhoi(k, NHOM);
  // hình từng khối: tường (móng + mặt tiền vừa thêm) + mái + nắp — cho va chạm và công cụ đo đối chiếu ảnh
  k.hinh = [[...NHOM.mong.p.slice(truoc.mong), ...NHOM.mat.p.slice(truoc.mat), ...r.da], r.mai];
  const pos = [...k.hinh[0], ...k.hinh[1]];
  if (pos.length >= 9) world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(pos), Uint32Array.from({ length: pos.length / 3 }, (_, i) => i)), tinh);
  if (!caoNhat || r.y2 > caoNhat.y2) caoNhat = r;
}
const r1 = T.rngTu(5);
const vlTu = (t, o = {}) => { for (const x of [t.map, t.bump]) x && x.wrapS && (x.wrapS = x.wrapT = THREE.RepeatWrapping); return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: o.bump ?? 1.5, roughness: o.ro ?? 0.85, side: THREE.DoubleSide, vertexColors: !!o.mau }); };
const VL = { mong: vlTu(T.mongDa(r1), { bump: 3 }), mat: vlTu(T.matTien(r1), { mau: true }), da: vlTu(T.daVoi(r1), { mau: true }), mai: vlTu(T.daPhien(r1), { ro: 0.5, mau: true }) };
for (const [ten, G] of Object.entries(NHOM)) {
  if (!G.p.length) continue;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
  if (G.c) g.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, VL[ten]); m.castShadow = m.receiveShadow = true; scene.add(m);
}

const RUNG = []; // ẩn khi so ảnh thật (cây mọc ở mép vực che tầm nhìn từ cầu Marienbrücke; so ảnh chỉ đối chiếu lâu đài)
// ---------- rừng: vân sam (thân + tán nón) vẽ hàng loạt; chừa nhà (+6 m), vách dốc, mép lưới
{
  const r2 = T.rngTu(23), viTri = [];
  const hopNha = dsKhoi.map((k) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, z] of k.v) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return [a - 6, b + 6, c - 6, d + 6]; });
  for (let t = 0; t < 9000 && viTri.length < 2600; t++) {
    const x = (r2() * 2 - 1) * (NUA - 15), z = (r2() * 2 - 1) * (NUA - 15);
    if (hopNha.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) continue;
    const dx = caoDat(x + 2, z) - caoDat(x - 2, z), dz = caoDat(x, z + 2) - caoDat(x, z - 2);
    if (Math.hypot(dx, dz) / 4 > 0.9) continue; // vách đá: ít cây
    viTri.push([x, caoDat(x, z) - GOC_Y - 0.3, z, 0.7 + r2() * 0.6, r2() * 6.28]);
  }
  const tan = new THREE.ConeGeometry(2.6, 11, 7); tan.translate(0, 9.5, 0);
  const goc = new THREE.CylinderGeometry(0.25, 0.4, 5, 5); goc.translate(0, 2.5, 0);
  const iT = new THREE.InstancedMesh(tan, new THREE.MeshStandardMaterial({ color: 0x2f4a2c, roughness: 0.95, flatShading: true }), viTri.length);
  const iG = new THREE.InstancedMesh(goc, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), viTri.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  viTri.forEach(([x, y, z, s, a], i) => { m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(s, s * (0.9 + (i % 5) * 0.06), s)); iT.setMatrixAt(i, m4); iG.setMatrixAt(i, m4); iT.setColorAt(i, c.setHSL(0.3 + (i % 7) * 0.008, 0.3, 0.17 + (i % 11) * 0.008)); });
  iT.castShadow = true; iT.receiveShadow = true; scene.add(iT, iG);
  RUNG.push(iT, iG);
}

// ---------- điều khiển + nhãn
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 25, 0); camera.position.set(-170, 90, 230); orbit.enableDamping = true; orbit.maxPolarAngle = 1.52; orbit.minDistance = 15; orbit.maxDistance = 1500; orbit.update();
$('tt').innerHTML = `${dsKhoi.filter((k) => !(k.vo && k.coPart)).length} khối từ OpenStreetMap · cao nhất ${caoNhat ? caoNhat.h + ' m' : '—'} · địa hình ${n}×${n} điểm, ô ${B} m`;
addEventListener('resize', () => { if (dangSo) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// ---------- ĐI BỘ (bước 5): người chơi có xương + động tác thật, điều khiển dibo.js (dùng chung). Vào ở cổng Torbau phía đông.
let toi = null, di = null;
try { await napNguoi3d(); toi = taoNguoi3d(); } catch (e) { console.warn('[ns] không nạp được người 3D', e); }
if (toi) {
  toi.goc.visible = false; scene.add(toi.goc);
  di = taoDiBo({ RAPIER, world, camera, dom: renderer.domElement, toi, khiDoi: (dang) => {
    orbit.enabled = !dang; $('so').style.display = dang || !ANH.length ? 'none' : 'block'; $('b-di').style.display = dang ? 'none' : ''; $('b-toan').style.display = dang ? '' : 'none'; khoaHd = '';
  } });
}
const torbau = dsKhoi.find((k) => k.tags.name === 'Torbau');
function vaoCong() { // trước cổng Torbau, phía đông, quay mặt vào cổng
  if (!di) return; if (dangSo) tatSo();
  const [cx, cz] = torbau ? tamDa(torbau.v) : [0, 0], xMax = torbau ? Math.max(...torbau.v.map((p) => p[0])) : 30;
  const x = xMax + 10, z = cz; di.vao(x, caoDat(x, z) - GOC_Y + 0.5, z, -Math.PI / 2);
}
$('b-di').onclick = vaoCong;
$('b-toan').onclick = () => { di?.ra(); camera.position.set(-170, 90, 230); orbit.target.set(0, 25, 0); orbit.update(); };
addEventListener('keydown', (e) => { if (e.code === 'Escape' && di?.dang) $('b-toan').click(); });
{ // nhấp đúp xuống đất / mái khi đang xem toàn cảnh → đi bộ tại đó
  const tia = new THREE.Raycaster();
  renderer.domElement.addEventListener('dblclick', (e) => {
    if (!di || di.dang || dangSo) return; const r = renderer.domElement.getBoundingClientRect();
    tia.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const h = tia.intersectObjects(scene.children.filter((o) => o.isMesh && !o.isInstancedMesh), false)[0];
    if (h) di.vao(h.point.x, h.point.y + 0.2, h.point.z, Math.atan2(-h.point.x, -h.point.z));
  });
}
// bảng phím theo ngữ cảnh (chỉ phím dùng được ở chỗ đang đứng)
const K = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(''), dg = (a, b) => `<div class="d"><span>${a}</span><span>${b}</span></div>`;
let khoaHd = '', lucHd = 0;
function capNhatHd(now) {
  if (now - lucHd < 250) return; lucHd = now;
  const c = dangSo ? 'so' : di ? di.nguCanh() : 'toan'; if (c === khoaHd) return; khoaHd = c;
  const xoay = dg('giữ chuột + kéo', 'xoay camera') + dg(K('Z', 'X'), 'xoay trái / phải') + dg(K('V'), 'góc nhìn sau lưng / mắt') + dg(K('Esc'), 'về toàn cảnh');
  $('hd').innerHTML = c === 'so' ? '' : c === 'toan' ? '<b>Toàn cảnh</b>' + dg('kéo chuột', 'xoay') + dg('lăn chuột', 'phóng to / nhỏ') + dg('nhấp đúp', 'xuống đi bộ tại đó') + dg('🚶 Đi bộ', 'vào ở cổng Torbau')
    : c === 'leo' ? '<b>Đang leo</b>' + dg(K('W', 'S'), 'lên / xuống') + dg(K('A', 'D'), 'ngang theo tường') + dg(K('W') + ' tới mép', 'tự đu lên') + dg(K('Space'), 'bật ra') + xoay
    : '<b>Đi bộ</b>' + dg(K('W', 'A', 'S', 'D'), 'đi theo hướng camera') + dg(K('Shift'), 'chạy') + dg(K('Space'), 'nhảy') + dg(K('C') + ' giữ', 'ngồi xổm')
      + (c === 'tuong' ? '<b>Ở đây</b>' + dg(K('Space'), 'tường thấp: trèo qua · cao: bám leo') : '') + xoay;
  $('hd').style.display = c === 'so' ? 'none' : '';
}
let lan = 0, tichLuy = 0;
const dongHo = new THREE.Clock();
function ve(now = 0) { // chạy ở cuối tệp (sau khi khai báo chế độ so ảnh)
  requestAnimationFrame(ve);
  if (now - lan < (!document.hasFocus() ? 100 : di?.dang ? 1000 / 60 : 1000 / 30) - 3) return; lan = now; // trần khung hình: đi bộ 60 · xem 30 · mất tiêu điểm 10
  const dt = Math.min(dongHo.getDelta(), 0.1);
  if (di?.dang) { tichLuy += dt; while (tichLuy >= 1 / 60) { di.buoc(1 / 60); world.step(); tichLuy -= 1 / 60; } di.khung(dt); }
  else if (!dangSo) orbit.update(); // chế độ so ảnh: camera do thông số ảnh quyết
  capNhatHd(now);
  renderer.render(scene, camera);
}
// ---------- SO VỚI ẢNH THẬT (bước 3): camera đặt đúng chỗ người chụp đứng (toạ độ Commons), ảnh chồng mờ lên khung hình cùng tỉ lệ.
// Tinh chỉnh: ← → quay · ↑ ↓ ngẩng / cúi · [ ] góc ống kính · PgUp/PgDn cao thấp (Shift = nhanh). Thông số khớp ghi vào du-lieu/<ten>-anh.json (camera).
const ANH = await fetch(`./du-lieu/${ten}-anh.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
const M_LAT = 111320, M_LNG = 111320 * Math.cos(D.tam[0] * Math.PI / 180);
const raMet = (la, ln) => [(ln - D.tam[1]) * M_LNG, -(la - D.tam[0]) * M_LAT];
let dangSo = null, cam = null;
const hop = $('so-khung'), img = $('so-anh');
function khungAnh(a) { // khung lớn nhất cùng tỉ lệ ảnh, giữa màn
  const r = a.rong / a.cao; let w = innerWidth, h = w / r; if (h > innerHeight) { h = innerHeight; w = h * r; }
  return { w: Math.round(w), h: Math.round(h), x: Math.round((innerWidth - w) / 2), y: Math.round((innerHeight - h) / 2) };
}
function datCamSo() {
  const [x, z] = raMet(dangSo.lat, dangSo.lng);
  camera.position.set(x, cam.y, z); camera.fov = cam.fov; camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ'); camera.updateProjectionMatrix();
  $('so-tt').textContent = `cao ${(cam.y + GOC_Y).toFixed(0)} m (so mặt biển) · quay ${(cam.yaw * 180 / Math.PI).toFixed(1)}° · ngẩng ${(cam.pitch * 180 / Math.PI).toFixed(1)}° · ống kính ${cam.fov.toFixed(1)}°`;
}
function moSo(i) {
  di?.ra(); dangSo = ANH[i]; if (!dangSo) return; for (const r of RUNG) r.visible = false;
  const [x, z] = raMet(dangSo.lat, dangSo.lng);
  let yDat = -1e9; for (let dx = -15; dx <= 15; dx += 5) for (let dz = -15; dz <= 15; dz += 5) yDat = Math.max(yDat, caoDat(x + dx, z + dz) - GOC_Y); // đứng trên cầu / mép vực: lấy mặt cao nhất quanh chỗ chụp
  const huong = Math.atan2(-(0 - x), -(0 - z)); // nhìn về tâm lâu đài
  cam = dangSo.camera ? { ...dangSo.camera } : { y: yDat + 1.6, yaw: huong, pitch: Math.atan2(30 - (yDat + 1.6), Math.hypot(x, z)), fov: 30 };
  const k = khungAnh(dangSo);
  renderer.setSize(k.w, k.h); Object.assign(renderer.domElement.style, { position: 'fixed', left: k.x + 'px', top: k.y + 'px' }); camera.aspect = k.w / k.h;
  Object.assign(hop.style, { display: 'block', left: k.x + 'px', top: k.y + 'px', width: k.w + 'px', height: k.h + 'px' });
  img.src = `./du-lieu/${dangSo.tep}`; orbit.enabled = false; datCamSo();
  $('so-nguon').innerHTML = `Ảnh: <a href="${dangSo.trang}" target="_blank" rel="noopener">${dangSo.tieuDe}</a> · ${dangSo.tacGia} · ${dangSo.giayPhep}`;
  document.querySelectorAll('#so button[data-i]').forEach((b) => b.classList.toggle('chon', +b.dataset.i === i));
}
function tatSo() {
  dangSo = null; for (const r of RUNG) r.visible = true; hop.style.display = 'none'; renderer.setSize(innerWidth, innerHeight); Object.assign(renderer.domElement.style, { left: '0px', top: '0px' });
  camera.aspect = innerWidth / innerHeight; camera.fov = 45; camera.updateProjectionMatrix(); orbit.enabled = true; camera.position.set(-170, 90, 230); orbit.target.set(0, 25, 0); orbit.update();
  $('so-tt').textContent = ''; $('so-nguon').textContent = ''; document.querySelectorAll('#so button[data-i]').forEach((b) => b.classList.remove('chon'));
}
if (ANH.length) {
  $('so').style.display = 'block';
  $('so-ds').innerHTML = ANH.map((a, i) => `<button data-i="${i}" title="${a.tieuDe}">${i + 1}</button>`).join('') + '<button id="so-tat">Tắt</button>';
  $('so-ds').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.id === 'so-tat' ? tatSo() : moSo(+b.dataset.i); });
  $('so-mo').addEventListener('input', (e) => { img.style.opacity = e.target.value / 100; });
  addEventListener('keydown', (e) => {
    if (!dangSo) return; const k = e.shiftKey ? 10 : 1, d = Math.PI / 1800 * k;
    const m = { ArrowLeft: () => (cam.yaw += d), ArrowRight: () => (cam.yaw -= d), ArrowUp: () => (cam.pitch += d), ArrowDown: () => (cam.pitch -= d), BracketLeft: () => (cam.fov = Math.max(5, cam.fov - 0.1 * k)), BracketRight: () => (cam.fov = Math.min(90, cam.fov + 0.1 * k)), PageUp: () => (cam.y += 0.5 * k), PageDown: () => (cam.y -= 0.5 * k) }[e.code];
    if (m) { m(); datCamSo(); e.preventDefault(); }
  });
  const i = new URLSearchParams(location.search).get('anh'); if (i) moSo(+i - 1);
}
addEventListener('resize', () => { if (dangSo) moSo(ANH.indexOf(dangSo)); });

window.__ns = { D, dsKhoi, camera, orbit, caoDat, GOC_Y, scene, renderer, world, RAPIER, di: () => di, toi: () => toi, vaoCong, ANH, moSo, tatSo, cam: () => cam, datCam: (c) => { Object.assign(cam, c); datCamSo(); } };
ve();
