// SPRAWL — thành phố 3D trên bản đồ thật Tokyo (anh 22/11/2026, roadmap apps/sprawl/ROADMAP.md). Bước 2: nền máy.
// Nhà = PLATEAU LoD2 (Bộ Đất đai Nhật, 3D Tiles b3dm) nạp theo ô bằng 3DTilesRendererJS → tự tải / bỏ ô theo tầm nhìn (đường lên 30×30 km ở bước 5).
// Đi bộ = bộ dùng chung của castle.on.tc (dibo.js + người Quaternius + cảm ứng), nginx phục vụ thư mục castle ở /chung/ nên không chép mã.
// Ba kiểu nhìn: Thật (ảnh mặt nhà PLATEAU) · Phố Bụi (bão bụi cam, cửa sổ sáng, bloom — gộp phobui.on.tc vào) · Red Spires (ban ngày sương xanh xám, tháp đỏ dựng theo quy hoạch chung — redspires.js).
// Mặt đất: tập dữ liệu chỉ có nhà, không có địa hình → lưới đất 16 m dựng từ chân tường nhà (đỉnh thấp nhất mỗi ô), ô trống lấp theo ô gần nhất.
// tra-repo-ok: thư viện đã tra ở bước 1 (apps/sprawl/ROADMAP.md: 3DTilesRendererJS, PLATEAU, ecctrl, Sketchbook); bộ đi bộ dùng lại castle
import * as THREE from 'three';
import RAPIER from 'rapier';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { ReorientationPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import { taoDiBo } from './chung/dibo.js';
import { napNguoi3d, taoNguoi3d } from './chung/nguoi3d.js';
import { taoCamUng, CHAM } from './chung/camung.js';
import { ganGopY, chupCanvas } from './chung/gopy.js';
import { taoRedSpires } from './redspires.js';

const $ = (id) => document.getElementById(id);
// tâm cảnh: Nishi-Shinjuku, giữa ga Shinjuku và toà thị chính Tokyo
const TAM = { lat: 35.6900, lon: 139.6975 };
const VUNG = [{ ten: 'Shinjuku', url: 'https://assets.cms.plateau.reearth.io/assets/00/bed0bd-f882-4cde-b942-21d0f8d2ddc2/13104_shinjuku-ku_pref_2025_citygml_1_op_bldg_3dtiles_13104_shinjuku-ku_lod2/tileset.json',
  urlTron: 'https://assets.cms.plateau.reearth.io/assets/2f/d4f9a7-13ad-43cb-b984-033803199eab/13104_shinjuku-ku_pref_2025_citygml_1_op_bldg_3dtiles_13104_shinjuku-ku_lod2_no_texture/tileset.json' }];
// kiểu không cần ảnh mặt nhà (Red Spires, Phố Bụi) nạp bản không texture: ảnh mặt nhà ~16 MB/ô làm đầy bộ nhớ đệm sau ~110 ô, ô chi tiết bị từ chối
const canAnh = (k) => k === 'thuc';

// ---------- khung ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, CHAM ? 1.25 : 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false; // đếm tam giác cả khung (composer render nhiều lượt, tự reset chỉ còn lượt bloom cuối)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 12000);
const troi = new THREE.HemisphereLight('#dfe8f2', '#5a5048', 1.1); scene.add(troi);
const nang = new THREE.DirectionalLight('#fff1dc', 1.4); nang.position.set(-600, 900, 400); scene.add(nang);
const orbit = new MapControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49; orbit.minDistance = 20; orbit.maxDistance = 6000; orbit.screenSpacePanning = false;

// ---------- kiểu nhìn ----------
const KIEU = {
  thuc: { ten: 'Thật', nen: '#b9cfe3', suong: () => new THREE.Fog('#c9d8e6', 1200, 7000), bloom: 0, troi: 1.1, nang: 1.4, mu: 1.0 },
  bui: { ten: 'Phố Bụi', nen: '#9a6234', suong: () => new THREE.FogExp2('#9a6234', 0.0009), bloom: 0.75, troi: 0.7, nang: 0.5, mu: 0.9, tuong: '#2a1e16', cua: ['#ffb35c', '#9ee0ff'], lit: 0.72 },
  do: { ten: 'Red Spires', nen: '#a7b6c2', suong: () => new THREE.FogExp2('#a3b2be', 0.00042), bloom: 0, troi: 1.15, nang: 1.25, mu: 1.0 },
};
const uNeon = { uLit: { value: 0.7 }, uCuaA: { value: new THREE.Color() }, uCuaB: { value: new THREE.Color() } };
const vatNeon = new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 0.88, metalness: 0.1 });
vatNeon.onBeforeCompile = (sh) => { // cửa sổ sáng theo toạ độ thế giới (khuôn phobui.js), pháp tuyến tính trong mảnh nên mô hình thiếu normal vẫn đúng
  Object.assign(sh.uniforms, uNeon);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vWp; uniform float uLit; uniform vec3 uCuaA; uniform vec3 uCuaB;
    float bam(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    vec3 nw = normalize(cross(dFdx(vWp), dFdy(vWp)));
    if (abs(nw.y) < 0.5) {
      bool trucX = abs(nw.x) > abs(nw.z);
      vec2 g = vec2((trucX ? vWp.z : vWp.x) / 1.8, vWp.y / 3.4);
      vec2 o = floor(g), f = fract(g);
      float cua = step(0.25, f.x) * step(f.x, 0.75) * step(0.35, f.y) * step(f.y, 0.75);
      vec2 k = floor(vWp.xz / 24.0) * 0.071 + (trucX ? vec2(17.0, 3.0) : vec2(0.0));
      float h = bam(o + k), tang = bam(vec2(o.y, 7.0) + k);
      float sang = step(uLit, h) * step(0.3, tang);
      totalEmissiveRadiance += cua * sang * mix(uCuaA, uCuaB, step(0.92, h)) * (0.25 + 0.8 * fract(h * 13.7));
      diffuseColor.rgb *= 1.0 - 0.2 * cua;
    }`);
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.72); composer.addPass(bloom);
composer.addPass(new OutputPass());
let kieu = 'thuc';
try { kieu = new URLSearchParams(location.search).get('kieu') || localStorage.getItem('sprawl-kieu') || 'thuc'; } catch {}
if (!KIEU[kieu]) kieu = 'thuc';

// ---------- vật lý + mặt đất ----------
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }), tinh = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
const LUOI_O = 16, LUOI_N = 192, NUA = LUOI_O * LUOI_N / 2; // 3,07 km quanh tâm
const chan = new Float32Array(LUOI_N * LUOI_N).fill(Infinity); // đỉnh thấp nhất mỗi ô = chân tường
let chanDoi = false, datY = null, datVa = null;
const datMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#6d6a66', roughness: 1 }));
scene.add(datMesh);
function ghiChan(x, y, z) { const i = Math.floor((x + NUA) / LUOI_O), j = Math.floor((z + NUA) / LUOI_O); if (i < 0 || j < 0 || i >= LUOI_N || j >= LUOI_N) return; const k = j * LUOI_N + i; if (y < chan[k]) { chan[k] = y; chanDoi = true; } }
function dungDat() { // lấp ô trống theo ô có dữ liệu gần nhất (loang nhiều nguồn), rồi dựng lưới hiện + va chạm
  chanDoi = false;
  const h = new Float32Array(chan), xong = new Uint8Array(h.length); let hang = [];
  for (let k = 0; k < h.length; k++) if (h[k] < Infinity) { xong[k] = 1; hang.push(k); }
  if (!hang.length) return;
  while (hang.length) { const moi = []; for (const k of hang) { const i = k % LUOI_N, j = (k / LUOI_N) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= LUOI_N || z >= LUOI_N) continue; const q = z * LUOI_N + x; if (xong[q]) continue; xong[q] = 1; h[q] = h[k]; moi.push(q); } } hang = moi; }
  // ô nằm trọn trong lòng một toà chỉ có đỉnh mái → gò nhọn. Lọc MIN bán kính 6 ô (~100 m) xoá mái, rồi làm mượt hộp 2 ô
  const loc = (src, r, f) => { const t = new Float32Array(src.length), o = new Float32Array(src.length);
    for (let j = 0; j < LUOI_N; j++) for (let i = 0; i < LUOI_N; i++) { let v = f === 'min' ? Infinity : 0, n = 0; for (let d = -r; d <= r; d++) { const x = i + d; if (x < 0 || x >= LUOI_N) continue; const s = src[j * LUOI_N + x]; if (f === 'min') v = Math.min(v, s); else { v += s; n++; } } t[j * LUOI_N + i] = f === 'min' ? v : v / n; }
    for (let j = 0; j < LUOI_N; j++) for (let i = 0; i < LUOI_N; i++) { let v = f === 'min' ? Infinity : 0, n = 0; for (let d = -r; d <= r; d++) { const z = j + d; if (z < 0 || z >= LUOI_N) continue; const s = t[z * LUOI_N + i]; if (f === 'min') v = Math.min(v, s); else { v += s; n++; } } o[j * LUOI_N + i] = f === 'min' ? v : v / n; }
    return o; };
  h.set(loc(loc(h, 6, 'min'), 2, 'tb'));
  datY = h;
  const vs = new Float32Array(LUOI_N * LUOI_N * 3), idx = [];
  for (let j = 0; j < LUOI_N; j++) for (let i = 0; i < LUOI_N; i++) { const k = j * LUOI_N + i; vs[k * 3] = -NUA + (i + 0.5) * LUOI_O; vs[k * 3 + 1] = h[k] - 0.05; vs[k * 3 + 2] = -NUA + (j + 0.5) * LUOI_O; }
  for (let j = 0; j < LUOI_N - 1; j++) for (let i = 0; i < LUOI_N - 1; i++) { const a = j * LUOI_N + i, b = a + 1, c = a + LUOI_N, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(vs, 3)); g.setIndex(idx); g.computeVertexNormals();
  datMesh.geometry.dispose(); datMesh.geometry = g;
  if (datVa) world.removeCollider(datVa, false);
  datVa = world.createCollider(RAPIER.ColliderDesc.trimesh(vs, Uint32Array.from(idx)), tinh);
  rs?.datLai(datMuot);
  world.step();
  $('b-di').disabled = false;
}
function datMuot(x, z) { if (!datY) return 0; // nội suy song tuyến giữa tâm ô — khớp lưới đất đang vẽ
  const u = Math.max(0, Math.min(LUOI_N - 1.001, (x + NUA) / LUOI_O - 0.5)), v = Math.max(0, Math.min(LUOI_N - 1.001, (z + NUA) / LUOI_O - 0.5)), i = u | 0, j = v | 0, a = u - i, b = v - j, k = j * LUOI_N + i;
  return (datY[k] * (1 - a) + datY[k + 1] * a) * (1 - b) + (datY[k + LUOI_N] * (1 - a) + datY[k + LUOI_N + 1] * a) * b; }
function datTai(x, z) { if (!datY) return 0; const i = Math.max(0, Math.min(LUOI_N - 1, Math.floor((x + NUA) / LUOI_O))), j = Math.max(0, Math.min(LUOI_N - 1, Math.floor((z + NUA) / LUOI_O))); return datY[j * LUOI_N + i]; }

// ---------- Red Spires theo quy hoạch chung ----------
let rs = null;
try { rs = taoRedSpires({ RAPIER, world, tinh, datTai, ql: await fetch('./du-lieu/quy-hoach.json', { cache: 'no-cache' }).then((r) => r.json()) }); scene.add(rs.goc); }
catch (e) { console.warn('[sprawl] không nạp được quy hoạch Red Spires', e); }
const vatCho = (o) => (kieu === 'thuc' ? o.userData.vatThuc : kieu === 'do' && rs ? rs.vatPho : vatNeon);

// ---------- nhà PLATEAU theo ô ----------
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const goc = new THREE.Group(); goc.rotation.y = Math.PI; scene.add(goc); // ReorientationPlugin: X tây, Z bắc → xoay 180° cho X đông, Z nam
goc.updateMatrix();
const vaO = new Map(), tk = { o: 0, va: 0 };
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const dsTiles = VUNG.map((v) => {
  const t = new TilesRenderer(canAnh(kieu) ? v.url : v.urlTron);
  t.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  // KHÔNG dùng TilesFadePlugin: nó bọc shader mờ dần vào chất liệu, chất liệu neon dùng chung bị bọc chồng → nhà biến mất ở kiểu Phố Bụi / Red Spires
  t.registerPlugin(new ReorientationPlugin({ lat: TAM.lat * Math.PI / 180, lon: TAM.lon * Math.PI / 180, height: 0, recenter: true }));
  t.errorTarget = CHAM ? 24 : 12;
  // trần bộ nhớ đệm mặc định (~0,3 GB) đầy ngay ở Shinjuku có ảnh mặt nhà → từ chối ô chi tiết, thành phố kẹt ở mức thô (đo 22/11: nạp 98, từ chối 113)
  t.lruCache.maxBytesSize = (CHAM ? 0.7 : 1.6) * 2 ** 30; t.lruCache.minBytesSize = t.lruCache.maxBytesSize * 0.75; t.lruCache.maxSize = 4000; t.lruCache.minSize = 3000;
  t.addEventListener('load-model', ({ scene: sc, tile }) => {
    tk.o++;
    t.group.updateMatrix(); const ds = [];
    sc.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const cu = o.material, map = cu?.map || null;
      o.userData.vatThuc = map ? new THREE.MeshBasicMaterial({ map }) : new THREE.MeshLambertMaterial({ color: '#d9d4ca' });
      cu?.dispose?.(); o.material = vatCho(o);
      _m.identity(); for (let q = o; q; q = q.parent) { q.updateMatrix(); _m.premultiply(q.matrix); if (q === sc) break; } _m.premultiply(t.group.matrix).premultiply(goc.matrix);
      const pos = o.geometry.attributes.position, vs = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m); vs[i * 3] = _v.x; vs[i * 3 + 1] = _v.y; vs[i * 3 + 2] = _v.z; ghiChan(_v.x, _v.y, _v.z); }
      if (tile.geometricError <= 5) { const idx = o.geometry.index ? Uint32Array.from(o.geometry.index.array) : Uint32Array.from({ length: pos.count }, (_, i) => i);
        try { ds.push(world.createCollider(RAPIER.ColliderDesc.trimesh(vs, idx), tinh)); } catch (e) { console.warn('[sprawl] va chạm ô lỗi', e); } }
    });
    if (ds.length) { vaO.set(tile, ds); tk.va += ds.length; }
  });
  t.addEventListener('dispose-model', ({ tile }) => { tk.o--; for (const c of vaO.get(tile) || []) { world.removeCollider(c, false); tk.va--; } vaO.delete(tile); });
  t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer);
  goc.add(t.group);
  return t;
});

function datKieu(k) {
  if (canAnh(k) !== canAnh(kieu)) { try { localStorage.setItem('sprawl-kieu', k); } catch {} location.search = '?kieu=' + k; return; } // đổi bộ ô có/không ảnh = nạp lại trang
  kieu = k; const K = KIEU[k];
  scene.background = new THREE.Color(K.nen); scene.fog = K.suong();
  troi.intensity = K.troi; nang.intensity = K.nang; renderer.toneMappingExposure = K.mu; bloom.strength = K.bloom;
  if (K.cua) { uNeon.uLit.value = K.lit; uNeon.uCuaA.value.set(K.cua[0]); uNeon.uCuaB.value.set(K.cua[1]); vatNeon.color.set(K.tuong); }
  datMesh.material.color.set(k === 'thuc' ? '#6d6a66' : k === 'bui' ? '#3b2a1c' : '#a29f96');
  rs?.hien(k === 'do');
  for (const t of dsTiles) t.group.traverse((o) => { if (o.isMesh && o.userData.vatThuc) o.material = vatCho(o); });
  document.querySelectorAll('#kieu button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
  try { localStorage.setItem('sprawl-kieu', k); } catch {}
}
$('kieu').innerHTML = Object.entries(KIEU).map(([k, v]) => `<button data-k="${k}">${v.ten}</button>`).join('');
$('kieu').onclick = (e) => { const b = e.target.closest('button'); if (b) datKieu(b.dataset.k); };
datKieu(kieu);

// ---------- đi bộ (castle dibo.js) ----------
let toi = null, di = null, camUng = null;
try { await napNguoi3d('./chung/tai-san/nguoi.glb'); toi = taoNguoi3d(); toi.goc.visible = false; scene.add(toi.goc); } catch (e) { console.warn('[sprawl] không nạp được người 3D', e); }
if (toi) {
  di = taoDiBo({ RAPIER, world, camera, dom: renderer.domElement, toi, layTruc: () => camUng?.layTruc(), khiDoi: (dang) => {
    camUng?.hien(dang); orbit.enabled = !dang; $('b-di').style.display = dang ? 'none' : ''; $('b-bay').style.display = dang ? '' : 'none';
    if (!dang) { const p = di.viTri(); orbit.target.set(p.x, p.y, p.z); camera.position.set(p.x + 120, p.y + 160, p.z + 200); }
  } });
  camUng = taoCamUng({ dom: renderer.domElement, di, nut: [
    { id: 'nhay', chu: () => (di.nguCanh() === 'leo' ? 'Bật ra' : di.nguCanh() === 'tuong' ? 'Leo' : 'Nhảy'), bam: () => camUng.nhay() },
    { id: 'goc', chu: () => '👁', bam: () => di.doiGocNhin() },
  ] });
}
function diBo() { // đứng xuống mặt đất ngay dưới tâm nhìn, quay mặt theo hướng camera đang nhìn
  if (!di || !datY) return;
  const x = orbit.target.x, z = orbit.target.z, h = Math.atan2(orbit.target.x - camera.position.x, orbit.target.z - camera.position.z);
  const tia = world.castRay(new RAPIER.Ray({ x, y: datTai(x, z) + 400, z }, { x: 0, y: -1, z: 0 }), 800, true);
  const y = tia ? datTai(x, z) + 400 - tia.timeOfImpact : datTai(x, z);
  di.vao(x, y + 0.3, z, h);
}
$('b-di').onclick = diBo; $('b-bay').onclick = () => di?.ra();
addEventListener('keydown', (e) => { if (e.code === 'Escape' && di?.dang) di.ra(); if (e.code === 'Enter' && !di?.dang && !e.target.closest?.('input,textarea')) diBo(); });

ganGopY({ nut: $('b-gy'), chupAnh: () => chupCanvas(renderer.domElement, () => ve()), nguCanh: () => { const p = di?.dang ? di.viTri() : orbit.target, ll = laLatLon(p.x, p.z);
  return `kiểu ${KIEU[kieu].ten} · ${di?.dang ? 'đi bộ' : 'bay'} · ${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)} · ô ${tk.o} · va chạm ${tk.va}`; } });
function laLatLon(x, z) { return { lat: TAM.lat - z / 110950, lon: TAM.lon + x / (111320 * Math.cos(TAM.lat * Math.PI / 180)) }; } // X đông, Z nam

// ---------- vòng vẽ ----------
if (kieu === 'do') { camera.position.set(420, 210, 620); orbit.target.set(-260, 150, -120); } // nhìn cụm tháp Nishi-Shinjuku như ảnh mẫu
else camera.position.set(500, 650, 900), orbit.target.set(0, 60, 0);
orbit.update();
let lan = 0, tichLuy = 0, demKhung = 0, tFps = performance.now(), fps = 0, tDat = 0;
const dongHo = new THREE.Clock();
function ve() { renderer.info.reset(); if (KIEU[kieu].bloom > 0) composer.render(); else renderer.render(scene, camera); }
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, dongHo.getDelta());
  if (di?.dang) { tichLuy += dt; while (tichLuy >= 1 / 60) { di.buoc(1 / 60); world.step(); tichLuy -= 1 / 60; } di.khung(dt); }
  else orbit.update();
  rs?.khung(dt);
  for (const t of dsTiles) { t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer); t.update(); }
  const now = performance.now();
  if (chanDoi && now - tDat > (datY ? 2500 : 600)) { tDat = now; dungDat(); }
  ve(); demKhung++;
  if (now - tFps > 1000) { fps = Math.round(demKhung * 1000 / (now - tFps)); demKhung = 0; tFps = now;
    const p = di?.dang ? di.viTri() : orbit.target, ll = laLatLon(p.x, p.z);
    $('tt').textContent = `${fps} khung/s · ${tk.o} ô nhà · ${renderer.info.render.triangles.toLocaleString('vi')} tam giác · ${ll.lat.toFixed(4)}, ${ll.lon.toFixed(4)}`;
    if (!lan && tk.o) { lan = 1; $('nap').style.display = 'none'; } }
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
window.__sprawl = { scene, camera, orbit, dsTiles, tk, datTai, rs, get di() { return di; } };
