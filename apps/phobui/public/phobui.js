// Phố Bụi — thành phố tương lai chìm trong bão bụi cam, bay tự do (anh 22/11/2026, ảnh mẫu "The Ride | beneath the burning sky").
// Toàn bộ dựng bằng mã (procedural), không tải mô hình: nhà = hộp instanced + cửa sổ sáng tính trong shader theo toạ độ thế giới,
// đường trên cao + xe chạy là điểm sáng, biển neon tự sáng + bloom, bụi = sương mù FogExp2 + hạt bụi + mảnh vụn + mây bụi trôi.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------- ngẫu nhiên có hạt giống: mở lại vẫn là cùng thành phố ----------
let hat = 20261122;
const rnd = (a = 0, b = 1) => { hat |= 0; hat = (hat + 0x6d2b79f5) | 0; let t = Math.imul(hat ^ (hat >>> 15), 1 | hat); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return a + (b - a) * (((t ^ (t >>> 14)) >>> 0) / 4294967296); };
const chon = (ds) => ds[Math.floor(rnd(0, ds.length))];

// ---------- khung ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const MAU_BUI = new THREE.Color('#9a6234');
const scene = new THREE.Scene();
scene.background = MAU_BUI.clone();
scene.fog = new THREE.FogExp2(MAU_BUI.clone(), 0.0062);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2600);

scene.add(new THREE.HemisphereLight('#e09a5c', '#2a180c', 0.75));
const nang = new THREE.DirectionalLight('#ff9a50', 0.55); nang.position.set(-300, 400, -200); scene.add(nang);

// ---------- lưới phố ----------
const N = 26, BLOCK = 46, ROAD = 14, P = BLOCK + ROAD;
const X0 = -N * P / 2;                         // mép tây/bắc của khối đầu
const tamDuong = (k) => X0 + k * P - ROAD / 2; // tim đường thứ k (0..N)
const HALF = N * P / 2;

// mặt đất + đường
const dat = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 4, HALF * 4), new THREE.MeshStandardMaterial({ color: '#2b1c11', roughness: 1 }));
dat.rotation.x = -Math.PI / 2; scene.add(dat);
{ // vỉa hè các khối (hơi sáng hơn lòng đường)
  const g = new THREE.BoxGeometry(1, 1, 1); const m = new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 1 });
  const im = new THREE.InstancedMesh(g, m, N * N); const o = new THREE.Object3D(); let n = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { o.position.set(X0 + i * P + BLOCK / 2, 0.15, X0 + j * P + BLOCK / 2); o.scale.set(BLOCK + 2, 0.3, BLOCK + 2); o.updateMatrix(); im.setMatrixAt(n++, o.matrix); }
  scene.add(im);
}

// ---------- nhà: hộp instanced, cửa sổ sáng trong shader ----------
const uLit = { value: 0.8 };
const vatNha = new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 0.9, metalness: 0.1 });
vatNha.onBeforeCompile = (sh) => {
  sh.uniforms.uLit = uLit;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vNw; varying vec2 vSeed;')
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      mat4 mi = mat4(1.0);
      #ifdef USE_INSTANCING
        mi = instanceMatrix;
      #endif
      vWp = (modelMatrix * mi * vec4(transformed, 1.0)).xyz;
      vNw = normalize(mat3(modelMatrix) * mat3(mi) * objectNormal);
      vSeed = mi[3].xz;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vWp; varying vec3 vNw; varying vec2 vSeed; uniform float uLit;
      float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (abs(vNw.y) < 0.5 && vWp.y > 3.0) {
        bool trucX = abs(vNw.x) > 0.5;
        float u = trucX ? vWp.z : vWp.x;
        vec2 g = vec2(u / 1.8, vWp.y / 3.2);
        vec2 o = floor(g); vec2 f = fract(g);
        float cua = step(0.25, f.x) * step(f.x, 0.75) * step(0.35, f.y) * step(f.y, 0.75);
        vec2 k = floor(vSeed + 0.5) * 0.071 + (trucX ? vec2(17.0, 3.0) : vec2(0.0));
        float h = bam(o + k);
        float tang = bam(vec2(o.y, 7.0) + k);           // cả tầng tắt / sáng theo nhau cho giống nhà thật
        float sang = step(uLit, h) * step(0.3, tang);
        vec3 mau = mix(vec3(1.0, 0.70, 0.36), vec3(0.62, 0.88, 1.0), step(0.92, h));
        totalEmissiveRadiance += cua * sang * mau * (0.25 + 0.8 * fract(h * 13.7));
        diffuseColor.rgb *= 1.0 - 0.2 * cua;
      }`);
};

const hop = [];      // [x0,z0,x1,z1,cao] — để chặn va chạm khi bay
const tang = [];     // từng khối hộp cần vẽ: x,y,z,w,h,d
const caoNhat = [];  // nóc cao để cắm ăng-ten
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const cx = X0 + i * P, cz = X0 + j * P;
  const xa = Math.hypot(cx + BLOCK / 2, cz + BLOCK / 2) / HALF;    // 0 giữa phố → 1 rìa
  const loai = rnd();
  const lo = loai < 0.35 ? [[0, 0, BLOCK, BLOCK]]
    : loai < 0.7 ? (rnd() < 0.5 ? [[0, 0, BLOCK / 2 - 1, BLOCK], [BLOCK / 2 + 1, 0, BLOCK, BLOCK]] : [[0, 0, BLOCK, BLOCK / 2 - 1], [0, BLOCK / 2 + 1, BLOCK, BLOCK]])
      : [[0, 0, BLOCK / 2 - 1, BLOCK / 2 - 1], [BLOCK / 2 + 1, 0, BLOCK, BLOCK / 2 - 1], [0, BLOCK / 2 + 1, BLOCK / 2 - 1, BLOCK], [BLOCK / 2 + 1, BLOCK / 2 + 1, BLOCK, BLOCK]];
  for (const [a, b, c, d] of lo) {
    if (rnd() < 0.06) continue; // bãi trống
    const lui = rnd(1, 4);
    let x0 = cx + a + lui, z0 = cz + b + lui, x1 = cx + c - lui, z1 = cz + d - lui;
    let h = 14 + Math.pow(rnd(), 2.6) * 300 * (1.15 - xa * 0.8);
    if (rnd() < 0.04) h += 180;      // vài toà chọc trời vượt hẳn
    hop.push([x0, z0, x1, z1, h]);
    let y = 0, conLai = h;
    const soTang = h > 90 ? 1 + Math.floor(rnd(0, 3)) : 1;
    for (let t = 0; t < soTang; t++) {
      const hh = t === soTang - 1 ? conLai : conLai * rnd(0.35, 0.6);
      tang.push([(x0 + x1) / 2, y + hh / 2, (z0 + z1) / 2, x1 - x0, hh, z1 - z0]);
      y += hh; conLai -= hh;
      const co = rnd(0.12, 0.25);   // tầng trên thụt vào
      const dx = (x1 - x0) * co / 2, dz = (z1 - z0) * co / 2;
      x0 += dx; x1 -= dx; z0 += dz; z1 -= dz;
    }
    if (rnd() < 0.3) tang.push([(x0 + x1) / 2, h + 1.2, (z0 + z1) / 2, (x1 - x0) * 0.6, 2.4, (z1 - z0) * 0.6]); // máy móc trên nóc
    if (h > 120) caoNhat.push([(x0 + x1) / 2, h, (z0 + z1) / 2]);
  }
}
{
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vatNha, tang.length);
  const o = new THREE.Object3D();
  tang.forEach(([x, y, z, w, h, d], n) => { o.position.set(x, y, z); o.scale.set(w, h, d); o.updateMatrix(); im.setMatrixAt(n, o.matrix); });
  scene.add(im);
}
// lưới tra va chạm theo ô phố
const oVa = new Map();
hop.forEach((b) => {
  for (let i = Math.floor((b[0] - X0) / P); i <= Math.floor((b[2] - X0) / P); i++)
    for (let j = Math.floor((b[1] - X0) / P); j <= Math.floor((b[3] - X0) / P); j++) {
      const k = i + ',' + j; if (!oVa.has(k)) oVa.set(k, []); oVa.get(k).push(b);
    }
});
const trongNha = (x, y, z, le = 2.5) => {
  const ds = oVa.get(Math.floor((x - X0) / P) + ',' + Math.floor((z - X0) / P)); if (!ds) return false;
  for (const b of ds) if (x > b[0] - le && x < b[2] + le && z > b[1] - le && z < b[3] + le && y < b[4] + le) return true;
  return false;
};

// ăng-ten + đèn đỏ nhấp nháy trên nóc toà cao
const denNoc = [];
{
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 1, 6), new THREE.MeshStandardMaterial({ color: '#2a1e16' }), caoNhat.length * 2);
  const o = new THREE.Object3D(); let n = 0;
  for (const [x, h, z] of caoNhat) for (let t = 0; t < 2; t++) {
    const l = rnd(10, 45), px = x + rnd(-6, 6), pz = z + rnd(-6, 6);
    o.position.set(px, h + l / 2, pz); o.scale.set(1, l, 1); o.updateMatrix(); im.setMatrixAt(n++, o.matrix);
    denNoc.push(px, h + l + 0.5, pz);
  }
  scene.add(im);
}
const vatDenNoc = new THREE.PointsMaterial({ color: new THREE.Color(4, 0.3, 0.2), size: 3, sizeAttenuation: true, transparent: true, toneMapped: false });
const diemDenNoc = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(denNoc, 3)), vatDenNoc);
scene.add(diemDenNoc);

// đèn đường dọc các phố
{
  const ds = [];
  for (let k = 0; k <= N; k++) for (let s = X0; s < HALF; s += 22) {
    ds.push(tamDuong(k) - ROAD / 2 + 1, 7, s, s, 7, tamDuong(k) + ROAD / 2 - 1);
  }
  const m = new THREE.PointsMaterial({ color: new THREE.Color(3, 1.6, 0.6), size: 1.6, transparent: true, toneMapped: false });
  scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ds, 3)), m));
}

// ---------- đường trên cao + xe chạy ----------
const caoToc = []; // {truc:'x'|'z', viTri, cao}
for (const [truc, k, cao] of [['x', 6, 22], ['x', 15, 34], ['x', 21, 18], ['z', 9, 28], ['z', 17, 44], ['z', 4, 16]]) caoToc.push({ truc, viTri: tamDuong(k), cao });
const xeDiem = []; const xeMau = []; const xeTT = [];
{
  const vMat = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.9 });
  const mat = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vMat, caoToc.length);
  const cot = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vMat, caoToc.length * 60);
  const vien = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 0.4), toneMapped: false }), caoToc.length * 2);
  const o = new THREE.Object3D(); let nc = 0;
  caoToc.forEach((c, n) => {
    const dai = HALF * 2.2;
    const dat = (x, y, z, sx, sy, sz) => { if (c.truc === 'x') { o.position.set(x, y, z); o.scale.set(sx, sy, sz); } else { o.position.set(z, y, x); o.scale.set(sz, sy, sx); } o.updateMatrix(); };
    // trục 'x' = đường chạy dọc theo trục z tại x = viTri
    dat(c.viTri, c.cao, 0, 13, 1.6, dai); mat.setMatrixAt(n, o.matrix);
    dat(c.viTri - 6.6, c.cao + 1, 0, 0.3, 0.3, dai); vien.setMatrixAt(n * 2, o.matrix);
    dat(c.viTri + 6.6, c.cao + 1, 0, 0.3, 0.3, dai); vien.setMatrixAt(n * 2 + 1, o.matrix);
    for (let s = -HALF; s < HALF && nc < cot.count; s += P) { dat(c.viTri, c.cao / 2, s + P / 2 - ROAD / 2 + 2, 3, c.cao, 3); cot.setMatrixAt(nc++, o.matrix); }
    for (let t = 0; t < 140; t++) {
      const chieu = t % 2 ? 1 : -1;
      xeTT.push({ c, chieu, s: rnd(-dai / 2, dai / 2), v: rnd(24, 40), lan: chieu * rnd(1.5, 5) });
      xeDiem.push(0, 0, 0);
      const m = chieu > 0 ? [3.2, 2.8, 2.2] : [3.5, 0.25, 0.15];
      xeMau.push(...m);
    }
  });
  cot.count = nc;
  scene.add(mat, cot, vien);
}
const geoXe = new THREE.BufferGeometry();
geoXe.setAttribute('position', new THREE.Float32BufferAttribute(xeDiem, 3));
geoXe.setAttribute('color', new THREE.Float32BufferAttribute(xeMau, 3));
scene.add(new THREE.Points(geoXe, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, toneMapped: false, transparent: true })));

// cầu nối giữa các toà ở trên cao
{
  const ds = [];
  for (let t = 0; t < 70; t++) {
    const b = chon(hop); if (b[4] < 70) continue;
    const y = rnd(40, b[4] - 10);
    const doc = rnd() < 0.5;
    const cx = doc ? b[2] + ROAD / 2 + 3 : (b[0] + b[2]) / 2, cz = doc ? (b[1] + b[3]) / 2 : b[3] + ROAD / 2 + 3;
    if (!trongNha(doc ? b[2] + ROAD + 6 : cx, y, doc ? cz : b[3] + ROAD + 6, 0)) continue;
    ds.push([cx, y, cz, doc ? ROAD + 8 : 6, 3, doc ? 6 : ROAD + 8]);
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vatNha, ds.length);
  const o = new THREE.Object3D();
  ds.forEach(([x, y, z, w, h, d], n) => { o.position.set(x, y, z); o.scale.set(w, h, d); o.updateMatrix(); im.setMatrixAt(n, o.matrix); });
  scene.add(im);
}

// ---------- biển neon / màn hình quảng cáo ----------
function veBien(kieu) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  const bang = [['#ff2bd6', '#5a0b6e'], ['#28e8ff', '#062f4a'], ['#ffd23f', '#5a2a00'], ['#ff4d4d', '#3d0505'], ['#9dff5c', '#0b3a10'], ['#ffffff', '#273040']];
  const [sang, toi] = bang[kieu % bang.length];
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, toi); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.fillStyle = sang; g.strokeStyle = sang; g.lineWidth = 5;
  const chu = ['ネオン', '夢電気', 'ホテル', 'OZEN', 'バー', '未来', 'KAI', '酒', 'NOVA', '東京'];
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center';
  if (kieu % 3 === 0) { g.beginPath(); g.arc(64, 70, 34, 0, Math.PI * 2); g.stroke(); g.fillText(chu[kieu % chu.length].slice(0, 2), 64, 82); }
  else { const t = chu[(kieu * 3) % chu.length]; for (let i = 0; i < t.length; i++) g.fillText(t[i], 64, 50 + i * 40); }
  for (let i = 0; i < 6; i++) { g.globalAlpha = 0.5; g.fillRect(rnd(8, 90), rnd(150, 240), rnd(10, 30), 3); }
  g.globalAlpha = 1; g.strokeRect(4, 4, 120, 248);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const vatBien = Array.from({ length: 12 }, (_, k) => new THREE.MeshBasicMaterial({ map: veBien(k), color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false, side: THREE.DoubleSide }));
{
  const g = new THREE.PlaneGeometry(1, 1);
  for (let t = 0; t < 260; t++) {
    const b = chon(hop); if (b[4] < 30) continue;
    const m = new THREE.Mesh(g, chon(vatBien));
    const ngang = rnd() < 0.35;
    const w = ngang ? rnd(10, 22) : rnd(5, 9), h = ngang ? w * 0.5 : w * rnd(2, 3.4);
    m.scale.set(w, h, 1);
    const y = rnd(12, Math.min(b[4] - h / 2 - 2, 160));
    const mat = Math.floor(rnd(0, 4));
    const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
    if (mat === 0) { m.position.set(b[2] + 0.4, y, rnd(b[1] + w / 2, Math.max(b[1] + w / 2, b[3] - w / 2))); m.rotation.y = Math.PI / 2; }
    else if (mat === 1) { m.position.set(b[0] - 0.4, y, rnd(b[1] + w / 2, Math.max(b[1] + w / 2, b[3] - w / 2))); m.rotation.y = -Math.PI / 2; }
    else if (mat === 2) { m.position.set(rnd(b[0] + w / 2, Math.max(b[0] + w / 2, b[2] - w / 2)), y, b[3] + 0.4); }
    else { m.position.set(rnd(b[0] + w / 2, Math.max(b[0] + w / 2, b[2] - w / 2)), y, b[1] - 0.4); m.rotation.y = Math.PI; }
    if (!Number.isFinite(cx + cz)) continue;
    scene.add(m);
  }
}

// ---------- bụi: hạt bụi mịn + mảnh vụn bay + mây bụi trôi ----------
const BUI_R = 160;
function hat_(so, size, color, opacity) {
  const p = new Float32Array(so * 3);
  for (let i = 0; i < so * 3; i++) p[i] = rnd(-BUI_R, BUI_R);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ size, color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; scene.add(pts); return pts;
}
const buiMin = hat_(7000, 0.4, '#c88a52', 0.4);
const manhVun = hat_(700, 1.3, '#24160c', 0.85);
const VAT_MAY = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
const may = [];
for (let t = 0; t < 90; t++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: VAT_MAY, color: chon(['#7a4a26', '#6a3f20', '#8f5a32']), transparent: true, opacity: rnd(0.18, 0.4), depthWrite: false }));
  const k = rnd(120, 320); s.scale.set(k, k * 0.55, 1);
  s.position.set(rnd(-HALF, HALF), rnd(40, 260), rnd(-HALF, HALF)); scene.add(s); may.push(s);
}
// quầng mặt trời mờ sau bụi
const matTroi = new THREE.Sprite(new THREE.SpriteMaterial({ map: VAT_MAY, color: new THREE.Color(1.3, 0.8, 0.45), transparent: true, opacity: 0.45, depthWrite: false, fog: false, toneMapped: false }));
matTroi.scale.set(900, 900, 1); scene.add(matTroi);

// ---------- hậu kỳ ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- bay tự do ----------
let yaw = Math.PI * 0.75, pitch = -0.12;
const viTri = new THREE.Vector3(X0 + P * 2.5, 130, X0 + P * 2.5);
const vanToc = new THREE.Vector3();
let heSo = 1;
const phim = {};
const nutTuBay = document.getElementById('tuBay');
let tuBay = true;
const tatTuBay = () => {
  if (!tuBay) return; tuBay = false; nutTuBay.classList.remove('on');
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  yaw = Math.atan2(-d.x, -d.z); pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)); viTri.copy(camera.position); vanToc.set(0, 0, 0);
};
nutTuBay.onclick = () => { if (tuBay) tatTuBay(); else { tuBay = true; nutTuBay.classList.add('on'); uBay = gan(camera.position); } };

addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; phim[e.code] = true; if (/^(Key[WASDCE]|Space|Arrow)/.test(e.code)) { tatTuBay(); e.preventDefault(); } });
addEventListener('keyup', (e) => { phim[e.code] = false; });
let keo = null;
canvas.addEventListener('pointerdown', (e) => { keo = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!keo || keo.id !== e.pointerId) return;
  const dx = e.clientX - keo.x, dy = e.clientY - keo.y; keo.x = e.clientX; keo.y = e.clientY;
  if (Math.abs(dx) + Math.abs(dy) > 0) tatTuBay();
  yaw -= dx * 0.0042; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0042, -1.45, 1.45);
});
canvas.addEventListener('pointerup', () => { keo = null; });
canvas.addEventListener('wheel', (e) => { heSo = THREE.MathUtils.clamp(heSo * (e.deltaY > 0 ? 0.85 : 1.18), 0.2, 8); hienToc(); e.preventDefault(); }, { passive: false });
const nutToc = document.getElementById('toc');
const hienToc = () => { nutToc.textContent = 'Tốc độ ' + (heSo < 1 ? heSo.toFixed(1) : Math.round(heSo * 10) / 10) + '×'; };
nutToc.onclick = () => { heSo = heSo >= 4 ? 0.5 : heSo * 2; hienToc(); };
document.querySelectorAll('.phim button').forEach((b) => {
  const k = { len: 'Space', xuong: 'KeyC', tien: 'KeyW', lui: 'KeyS' }[b.dataset.k];
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); tatTuBay(); phim[k] = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { phim[k] = false; });
});
const oBui = document.getElementById('bui');
const datBui = () => { const v = +oBui.value / 100; scene.fog.density = 0.0012 + v * 0.0095; buiMin.material.opacity = 0.1 + v * 0.5; manhVun.material.opacity = 0.2 + v * 0.75; may.forEach((s) => (s.visible = v > 0.15)); document.getElementById('vBui').textContent = oBui.value + '%'; };
oBui.oninput = datBui; datBui();

// đường tự bay: men theo phố ở giữa các toà, lúc lên cao lúc sà xuống
const duongBay = (() => {
  const ds = []; let i = 3, j = 3, huong = 0; let cao = 70;
  for (let t = 0; t < 46; t++) {
    ds.push(new THREE.Vector3(tamDuong(i), cao, tamDuong(j)));
    const buoc = 2 + Math.floor(rnd(0, 4));
    for (let s = 0; s < buoc; s++) { if (huong === 0) i++; else if (huong === 1) j++; else if (huong === 2) i--; else j--; }
    i = THREE.MathUtils.clamp(i, 2, N - 2); j = THREE.MathUtils.clamp(j, 2, N - 2);
    huong = (huong + (rnd() < 0.5 ? 1 : 3)) % 4;
    if (i <= 2) huong = 0; else if (i >= N - 2) huong = 2; else if (j <= 2) huong = 1; else if (j >= N - 2) huong = 3;
    cao = THREE.MathUtils.clamp(cao + rnd(-35, 35), 52, 150);
  }
  return new THREE.CatmullRomCurve3(ds, true, 'centripetal');
})();
const dai = duongBay.getLength();
let uBay = 0, yBu = 0;
const gan = (p) => { let best = 0, d = Infinity; for (let u = 0; u < 1; u += 0.002) { const q = duongBay.getPointAt(u); const k = q.distanceToSquared(p); if (k < d) { d = k; best = u; } } return best; };

// ---------- vòng chạy ----------
const dong = new THREE.Clock();
const gio = new THREE.Vector3(9, 0.6, 4);
const tmp = new THREE.Vector3(), truoc = new THREE.Vector3();
function buoc(dt) {
  const t = dong.elapsedTime;
  if (tuBay) {
    uBay = (uBay + dt * 22 * heSo / dai) % 1;
    duongBay.getPointAt(uBay, camera.position);
    duongBay.getPointAt((uBay + 40 / dai) % 1, truoc);
    // nhìn trước 0–60 m: đường men theo phố nhưng góc cua có thể cắt qua nóc nhà → nâng máy quay lên đủ cao, qua rồi hạ dần
    let can = 0;
    for (let d = 0; d <= 60; d += 10) { duongBay.getPointAt((uBay + d / dai) % 1, tmp); while (can < 300 && trongNha(tmp.x, tmp.y + can, tmp.z, 7)) can += 4; }
    yBu += (can - yBu) * Math.min(1, dt * (can > yBu ? 3 : 0.6));
    camera.position.y += yBu; truoc.y += yBu - 6;
    camera.lookAt(truoc);
  } else {
    const nhanh = phim.ShiftLeft || phim.ShiftRight ? 4 : 1;
    const v = 28 * heSo * nhanh;
    const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    tmp.set(0, 0, 0);
    if (phim.KeyW || phim.ArrowUp) tmp.add({ x: fx, y: fy, z: fz });
    if (phim.KeyS || phim.ArrowDown) tmp.sub({ x: fx, y: fy, z: fz });
    if (phim.KeyD || phim.ArrowRight) tmp.add({ x: rx, y: 0, z: rz });
    if (phim.KeyA || phim.ArrowLeft) tmp.sub({ x: rx, y: 0, z: rz });
    if (phim.Space || phim.KeyE) tmp.y += 1;
    if (phim.KeyC || phim.KeyQ) tmp.y -= 1;
    if (tmp.lengthSq() > 0) tmp.normalize().multiplyScalar(v);
    vanToc.lerp(tmp, 1 - Math.exp(-dt * 4));
    // chặn từng trục để trượt dọc tường thay vì dính cứng
    const nx = viTri.x + vanToc.x * dt; if (!trongNha(nx, viTri.y, viTri.z)) viTri.x = nx; else vanToc.x = 0;
    const nz = viTri.z + vanToc.z * dt; if (!trongNha(viTri.x, viTri.y, nz)) viTri.z = nz; else vanToc.z = 0;
    const ny = Math.max(2, viTri.y + vanToc.y * dt); if (!trongNha(viTri.x, ny, viTri.z)) viTri.y = Math.min(ny, 900); else vanToc.y = 0;
    camera.position.copy(viTri);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
  // xe trên cao
  const pos = geoXe.attributes.position.array; const lim = HALF * 1.1;
  xeTT.forEach((x, n) => {
    x.s += x.chieu * x.v * dt; if (x.s > lim) x.s = -lim; else if (x.s < -lim) x.s = lim;
    const a = x.c.viTri + x.lan, y = x.c.cao + 1.6;
    if (x.c.truc === 'x') { pos[n * 3] = a; pos[n * 3 + 2] = x.s; } else { pos[n * 3] = x.s; pos[n * 3 + 2] = a; }
    pos[n * 3 + 1] = y;
  });
  geoXe.attributes.position.needsUpdate = true;
  // bụi trôi theo gió, quấn quanh máy quay
  const c = camera.position;
  for (const [pts, nhan, xoay] of [[buiMin, 1, 0], [manhVun, 2.2, 1]]) {
    const a = pts.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += (gio.x * nhan + (xoay ? Math.sin(t * 1.3 + i) * 6 : 0)) * dt;
      a[i + 1] += (gio.y + (xoay ? Math.cos(t * 0.9 + i) * 3 : Math.sin(t + i) * 0.3)) * dt;
      a[i + 2] += (gio.z * nhan) * dt;
      for (let k = 0; k < 3; k++) { const d = a[i + k] - c.getComponent(k); if (d > BUI_R) a[i + k] -= 2 * BUI_R; else if (d < -BUI_R) a[i + k] += 2 * BUI_R; }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }
  for (const s of may) { s.position.x += gio.x * 0.6 * dt; if (s.position.x > HALF * 1.2) s.position.x = -HALF * 1.2; }
  matTroi.position.set(c.x - 900, c.y + 260, c.z - 700);
  vatDenNoc.opacity = 0.35 + 0.65 * (Math.sin(t * 3) > 0.2 ? 1 : 0);
}

function khung() {
  const dt = Math.min(dong.getDelta(), 0.05);
  buoc(dt);
  composer.render();
  requestAnimationFrame(khung);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
buoc(0); composer.render();
document.getElementById('nap').hidden = true;
requestAnimationFrame(khung);
window.__pb = { scene, camera, hop, tang, trongNha, get tuBay() { return tuBay; } };
