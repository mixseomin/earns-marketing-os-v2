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
import { Sky } from 'three/addons/objects/Sky.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { ReorientationPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import { taoDiBo } from './chung/dibo.js';
import { napNguoi3d, taoNguoi3d } from './chung/nguoi3d.js';
import { taoCamUng, CHAM } from './chung/camung.js';
import { ganGopY, chupCanvas } from './chung/gopy.js';
import { taoBanDo } from './chung/bando.js';
import { taoRedSpires } from './redspires.js';
import { taoNhat2200 } from './nhat2200.js';
import { taoMua } from './mua.js';
import { taoXe } from './xe.js';
import { taoXeDuongVa } from './xe-duong-va.js';

const $ = (id) => document.getElementById(id);
// tâm cảnh: Nishi-Shinjuku, giữa ga Shinjuku và toà thị chính Tokyo
const TAM = { lat: 35.6900, lon: 139.6975 };
const VUNG = [{ ten: 'Shinjuku', url: 'https://assets.cms.plateau.reearth.io/assets/00/bed0bd-f882-4cde-b942-21d0f8d2ddc2/13104_shinjuku-ku_pref_2025_citygml_1_op_bldg_3dtiles_13104_shinjuku-ku_lod2/tileset.json',
  urlTron: 'https://assets.cms.plateau.reearth.io/assets/2f/d4f9a7-13ad-43cb-b984-033803199eab/13104_shinjuku-ku_pref_2025_citygml_1_op_bldg_3dtiles_13104_shinjuku-ku_lod2_no_texture/tileset.json' }];
// kiểu không cần ảnh mặt nhà (Red Spires, Phố Bụi) nạp bản không texture: ảnh mặt nhà ~16 MB/ô làm đầy bộ nhớ đệm sau ~110 ô, ô chi tiết bị từ chối
const canAnh = (k) => k === 'thuc';

// ---------- khung ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
// mật độ điểm ảnh: trần 1,5 (máy chậm 1,25) và trần tổng ~4,5 triệu điểm — màn 5K ở mật độ 1,5 là 8,3 triệu điểm qua cả chuỗi bloom, card đồ hoạ chạy hết công suất
const matDo = () => Math.min(devicePixelRatio, CHAM ? 1.25 : 1.5, Math.max(1, Math.sqrt(4.5e6 / (innerWidth * innerHeight))));
renderer.setPixelRatio(matDo()); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false; // đếm tam giác cả khung (composer render nhiều lượt, tự reset chỉ còn lượt bloom cuối)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 12000);
const troi = new THREE.HemisphereLight('#dfe8f2', '#5a5048', 1.1); scene.add(troi);
const nang = new THREE.DirectionalLight('#fff1dc', 1.4); nang.position.set(-600, 900, 400); scene.add(nang);
// bầu trời thật (tán xạ khí quyển, addon Sky của three) thay nền một màu; chính bầu trời đó lọc thành môi trường phản chiếu → kính, kim loại soi được trời.
// Mặt trời của bầu trời và đèn nắng dùng chung một hướng (cao / hướng theo từng kiểu).
const bauTroi = new Sky(); bauTroi.scale.setScalar(9000);
// bầu trời vật lý sáng gấp nhiều lần cảnh → giảm sáng RIÊNG nó (uDoSang), không hạ phơi sáng cả cảnh (hạ cả cảnh làm cây đen, tháp vẫn loá)
bauTroi.material.uniforms.uDoSang = { value: 0.3 };
bauTroi.material.fragmentShader = bauTroi.material.fragmentShader.replace('void main() {', 'uniform float uDoSang;\nvoid main() {').replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * uDoSang, 1.0 );');
if (!bauTroi.material.fragmentShader.includes('retColor * uDoSang')) console.warn('[sprawl] addon Sky đổi mã, chưa giảm sáng được bầu trời'); bauTroi.frustumCulled = false; bauTroi.visible = false; scene.add(bauTroi);
const pmrem = new THREE.PMREMGenerator(renderer), canhTroi = new THREE.Scene(); let moiTruong = null;
const dichDo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType });
function datTroi(B) {
  if (!B) { bauTroi.visible = false; scene.environment = null; nang.position.set(-600, 900, 400); return; }
  const u = bauTroi.material.uniforms, huongNang = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - B.cao), THREE.MathUtils.degToRad(B.huong));
  u.turbidity.value = B.duc; u.rayleigh.value = B.ray; u.mieCoefficient.value = B.mie; u.mieDirectionalG.value = B.g; u.sunPosition.value.copy(huongNang); u.uDoSang.value = B.ds;
  nang.position.copy(huongNang).multiplyScalar(1500); bauTroi.visible = true;
  const vt = bauTroi.position.clone(); bauTroi.position.set(0, 0, 0); canhTroi.add(bauTroi); moiTruong?.dispose(); moiTruong = pmrem.fromScene(canhTroi, 0, 1, 20000).texture;
  // sương + nền lấy đúng màu chân trời của bầu trời này (đo đúng một điểm trên đường chân trời, vuông góc hướng nắng): lệch màu là hiện vạch ở đường chân trời
  try {
    const mayDo = new THREE.PerspectiveCamera(6, 1, 1, 20000); mayDo.lookAt(-huongNang.z, 0, huongNang.x); mayDo.updateMatrixWorld();
    const cu = renderer.getRenderTarget(), px = new Float32Array(4); renderer.setRenderTarget(dichDo); renderer.render(canhTroi, mayDo);
    renderer.readRenderTargetPixels(dichDo, 0, 0, 1, 1, px); renderer.setRenderTarget(cu);
    if (px[0] + px[1] + px[2] > 0.01 && Number.isFinite(px[0])) { scene.fog?.color.setRGB(px[0], px[1], px[2]); scene.background.setRGB(px[0], px[1], px[2]); }
    else console.warn('[sprawl] không đo được màu chân trời, giữ màu sương của kiểu', px);
  } catch (e) { console.warn('[sprawl] không đo được màu chân trời, giữ màu sương của kiểu', e); }
  scene.add(bauTroi); bauTroi.position.copy(vt); scene.environment = moiTruong; scene.environmentIntensity = B.mt;
}
const orbit = new MapControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49; orbit.minDistance = 3; orbit.maxDistance = 6000; orbit.screenSpacePanning = false;

// ---------- kiểu nhìn ----------
const KIEU = {
  thuc: { ten: 'Thật', nhom: 'Phố thật', nen: '#b9cfe3', suong: () => new THREE.Fog('#c9d8e6', 1200, 7000), bloom: 0, troi: 1.0, nang: 1.4, mu: 1.0, bauTroi: { duc: 4, ray: 2.2, mie: 0.004, g: 0.8, cao: 44, huong: -56, ds: 0.3, mt: 0.4 } },
  bui: { ten: 'Phố Bụi', nhom: 'Phố thật', nen: '#9a6234', suong: () => new THREE.FogExp2('#9a6234', 0.0009), bloom: 0.75, troi: 0.7, nang: 0.5, mu: 0.9, tuong: '#2a1e16', cua: ['#ffb35c', '#9ee0ff'], lit: 0.72 },
  do: { ten: 'Red Spires', nhom: 'Tương lai', nen: '#a7b6c2', suong: () => new THREE.FogExp2('#a3b2be', 0.00042), bloom: 0, troi: 1.05, nang: 1.25, mu: 1.0, bauTroi: { duc: 10, ray: 1.4, mie: 0.01, g: 0.86, cao: 26, huong: -56, ds: 0.26, mt: 0.4 } },
  nhat: { ten: 'Nhật 2200', nhom: 'Tương lai', nen: '#bcd6ec', suong: () => new THREE.FogExp2('#d3e2ee', 0.00028), bloom: 0, troi: 1.1, nang: 1.8, mu: 1.0, bauTroi: { duc: 2, ray: 3.6, mie: 0.003, g: 0.8, cao: 36, huong: -56, ds: 0.2, mt: 0.4 } }, // reel Japan 2200: nắng trong, tháp trắng xoắn, cao tốc trên cao, xe bay đĩa bạc
};
const uNeon = { uLit: { value: 0.7 }, uCuaA: { value: new THREE.Color() }, uCuaB: { value: new THREE.Color() } };
const vatNeon = new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 0.88, metalness: 0.1, side: THREE.DoubleSide });
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
let troiMua = false; // &mua trên link hoặc lần bật gần nhất
try { troiMua = new URLSearchParams(location.search).has('mua') || localStorage.getItem('sprawl-mua') === '1'; } catch {}

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
  const h = new Float32Array(chan);
  const loang = () => { const xong = new Uint8Array(h.length); let hang = []; // lấp ô trống theo ô có dữ liệu gần nhất
    for (let k = 0; k < h.length; k++) if (h[k] < Infinity) { xong[k] = 1; hang.push(k); }
    while (hang.length) { const moi = []; for (const k of hang) { const i = k % LUOI_N, j = (k / LUOI_N) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= LUOI_N || z >= LUOI_N) continue; const q = z * LUOI_N + x; if (xong[q]) continue; xong[q] = 1; h[q] = h[k]; moi.push(q); } } hang = moi; }
    return hang; };
  if (!h.some((v) => v < Infinity)) return;
  loang();
  const loc = (src, r, f) => { const t = new Float32Array(src.length), o = new Float32Array(src.length);
    for (let j = 0; j < LUOI_N; j++) for (let i = 0; i < LUOI_N; i++) { let v = f === 'min' ? Infinity : 0, n = 0; for (let d = -r; d <= r; d++) { const x = i + d; if (x < 0 || x >= LUOI_N) continue; const s = src[j * LUOI_N + x]; if (f === 'min') v = Math.min(v, s); else { v += s; n++; } } t[j * LUOI_N + i] = f === 'min' ? v : v / n; }
    for (let j = 0; j < LUOI_N; j++) for (let i = 0; i < LUOI_N; i++) { let v = f === 'min' ? Infinity : 0, n = 0; for (let d = -r; d <= r; d++) { const z = j + d; if (z < 0 || z >= LUOI_N) continue; const s = t[z * LUOI_N + i]; if (f === 'min') v = Math.min(v, s); else { v += s; n++; } } o[j * LUOI_N + i] = f === 'min' ? v : v / n; }
    return o; };
  // ô nằm trọn trong lòng một toà chỉ có đỉnh mái → gò nhọn. CHỈ xoá đúng các ô gò đó (cao hơn chỗ thấp nhất trong ~100 m quá GO_MAI) rồi lấp lại theo ô lân cận;
  // ô thường giữ nguyên chân tường của chính nó. Trước đây lọc MIN cả lưới nên đất dốc bị kéo xuống chân nhà thấp nhất quanh đó → nhà trên cao hở chân vài mét
  const GO_MAI = 9, day = loc(h, 6, 'min'); let go = 0;
  for (let k = 0; k < h.length; k++) if (h[k] - day[k] > GO_MAI) { h[k] = Infinity; go++; }
  if (go) loang();
  h.set(loc(h, 1, 'tb'));
  datY = h;
  const vs = new Float32Array(LUOI_N * LUOI_N * 3), idx = [];
  for (let j = 0; j < LUOI_N; j++) for (let i = 0; i < LUOI_N; i++) { const k = j * LUOI_N + i; vs[k * 3] = -NUA + (i + 0.5) * LUOI_O; vs[k * 3 + 1] = h[k] - 0.05; vs[k * 3 + 2] = -NUA + (j + 0.5) * LUOI_O; }
  for (let j = 0; j < LUOI_N - 1; j++) for (let i = 0; i < LUOI_N - 1; i++) { const a = j * LUOI_N + i, b = a + 1, c = a + LUOI_N, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(vs, 3)); g.setIndex(idx); g.computeVertexNormals();
  datMesh.geometry.dispose(); datMesh.geometry = g;
  if (datVa) world.removeCollider(datVa, false);
  datVa = world.createCollider(RAPIER.ColliderDesc.trimesh(vs, Uint32Array.from(idx)), tinh);
  rs?.datLai(datMuot); n2?.datLai(datMuot);
  world.step();
  $('b-di').disabled = false;
}
function datMuot(x, z) { if (!datY) return 0; // nội suy song tuyến giữa tâm ô — khớp lưới đất đang vẽ
  const u = Math.max(0, Math.min(LUOI_N - 1.001, (x + NUA) / LUOI_O - 0.5)), v = Math.max(0, Math.min(LUOI_N - 1.001, (z + NUA) / LUOI_O - 0.5)), i = u | 0, j = v | 0, a = u - i, b = v - j, k = j * LUOI_N + i;
  return (datY[k] * (1 - a) + datY[k + 1] * a) * (1 - b) + (datY[k + LUOI_N] * (1 - a) + datY[k + LUOI_N + 1] * a) * b; }
function datTai(x, z) { if (!datY) return 0; const i = Math.max(0, Math.min(LUOI_N - 1, Math.floor((x + NUA) / LUOI_O))), j = Math.max(0, Math.min(LUOI_N - 1, Math.floor((z + NUA) / LUOI_O))); return datY[j * LUOI_N + i]; }

// ---------- Red Spires theo quy hoạch chung ----------
let rs = null;
try { rs = taoRedSpires({ RAPIER, world, tinh, datTai, bao: baoNho, ql: await fetch('./du-lieu/quy-hoach.json', { cache: 'no-cache' }).then((r) => r.json()) }); scene.add(rs.goc); rs.khoacDat(datMesh.material); }
catch (e) { console.warn('[sprawl] không nạp được quy hoạch Red Spires', e); }
let n2 = null; // Nhật 2200 mượn phố của Red Spires (nhà, người, xe đất), tháp trắng tự đặt — tháp đỏ không có mặt
try { if (rs) { n2 = taoNhat2200({ rs, ql: rs.ql, datTai, RAPIER, world, tinh }); scene.add(n2.goc); } } catch (e) { console.warn('[sprawl] không dựng được Nhật 2200', e); }
const vatCho = (o) => (kieu === 'thuc' ? o.userData.vatThuc : (kieu === 'do' || kieu === 'nhat') && rs ? rs.vatPho : vatNeon);

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
      // HAI MẶT: nhiều toà PLATEAU có mặt tường lật pháp tuyến (hoặc thiếu mặt đối diện) → vẽ một mặt là tường tàng hình mà va chạm vẫn chặn (anh 23/11/2026)
      o.userData.vatThuc = map ? new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ color: '#d9d4ca', side: THREE.DoubleSide });
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

const mua = taoMua({ renderer, scene, camera }); // mưa: đất + đường ướt soi bóng, hạt mưa (mua.js). Gắn SAU khoacDat để nối tiếp phần tô màu đất
mua.uot(datMesh.material, true); for (const o of rs?.duong || []) mua.uot(o.material);
const dsUot = [datMesh, ...(rs?.duong || [])];
function datKieu(k) {
  if (canAnh(k) !== canAnh(kieu)) { try { localStorage.setItem('sprawl-kieu', k); } catch {} location.search = '?kieu=' + k; return; } // đổi bộ ô có/không ảnh = nạp lại trang
  kieu = k; const K = KIEU[k];
  const M = troiMua; // trời mưa: mây đục phủ kín, nắng yếu, sương dày hơn
  scene.background = new THREE.Color(K.nen); scene.fog = K.suong(); if (M) { if (scene.fog.isFogExp2) scene.fog.density *= 1.6; else { scene.fog.near *= 0.35; scene.fog.far *= 0.55; } }
  datTroi(K.bauTroi && (M ? { ...K.bauTroi, duc: 20, ray: 1.0, mie: 0.1, g: 0.55, ds: K.bauTroi.ds * 0.8 } : K.bauTroi));
  troi.intensity = K.troi * (M ? 0.8 : 1); nang.intensity = K.nang * (M ? 0.3 : 1); renderer.toneMappingExposure = K.mu * (M ? 0.92 : 1); bloom.strength = K.bloom;
  mua.dat(M, K.bloom > 0 ? 1.6 : 1); $('b-mua')?.classList.toggle('on', M);
  if (K.cua) { uNeon.uLit.value = K.lit; uNeon.uCuaA.value.set(K.cua[0]); uNeon.uCuaB.value.set(K.cua[1]); vatNeon.color.set(K.tuong); }
  datMesh.material.color.set(k === 'thuc' ? '#6d6a66' : k === 'bui' ? '#3b2a1c' : k === 'nhat' ? '#9a9c98' : '#858b84');
  rs?.hien(k === 'do' || k === 'nhat', k === 'do'); rs?.sang?.(k === 'nhat' ? 0.62 : 0); n2?.hien(k === 'nhat');
  for (const t of dsTiles) t.group.traverse((o) => { if (o.isMesh && o.userData.vatThuc) o.material = vatCho(o); });
  document.querySelectorAll('#kieu button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
  try { localStorage.setItem('sprawl-kieu', k); } catch {}
}
$('kieu').innerHTML = [...new Set(Object.values(KIEU).map((v) => v.nhom))].map((n) => `<div class="nhom"><span>${n}</span>${
  Object.entries(KIEU).filter(([, v]) => v.nhom === n).map(([k, v]) => `<button data-k="${k}">${v.ten}</button>`).join('')}</div>`).join('');
$('kieu').onclick = (e) => { const b = e.target.closest('button'); if (b) datKieu(b.dataset.k); };
function doiMua() { troiMua = !troiMua; try { localStorage.setItem('sprawl-mua', troiMua ? '1' : '0'); } catch {} datKieu(kieu); }
$('b-mua').onclick = doiMua;
datKieu(kieu);

// ---------- đi bộ (castle dibo.js) ----------
let toi = null, di = null, camUng = null, xe = null;
try { await napNguoi3d('./chung/tai-san/nguoi.glb'); toi = taoNguoi3d(); toi.goc.visible = false; scene.add(toi.goc); } catch (e) { console.warn('[sprawl] không nạp được người 3D', e); }
const xeDuong = rs ? taoXeDuongVa({ RAPIER, world, gt: rs.song.gt }) : null; // 2f nhịp B: xe trên phố có thân thật quanh người chơi, đâm mạnh thì văng khỏi làn
if (toi) {
  xe = taoXe({ RAPIER, world, scene, toi, layDi: () => di, datTai, bao: (c) => baoNho(c) }); // xe lái được (ô phố mẫu, bước 1)
  di = taoDiBo({ RAPIER, world, camera, dom: renderer.domElement, toi, layTruc: () => camUng?.layTruc(), ngoai: { buoc: (dt, tr) => xe.lai(dt, tr), khung: () => xe.nguoi() }, khiDoi: (dang) => {
    if (!dang) xe.xuong();
    camUng?.hien(dang); orbit.enabled = !dang; $('b-di').style.display = dang ? 'none' : ''; $('b-bay').style.display = dang ? '' : 'none';
    if (!dang) { const p = di.viTri(); orbit.target.set(p.x, p.y, p.z); camera.position.set(p.x + 120, p.y + 160, p.z + 200); }
  } });
  camUng = taoCamUng({ dom: renderer.domElement, di, nut: [
    { id: 'nhay', chu: () => (di.nguCanh() === 'leo' ? 'Bật ra' : di.nguCanh() === 'tuong' ? 'Leo' : 'Nhảy'), bam: () => camUng.nhay() },
    { id: 'goc', chu: () => '👁', bam: () => di.doiGocNhin() },
    { id: 'xe', chu: () => (xe.dangLai ? 'Xuống' : xe.gan() ? 'Lái xe' : 'Gọi xe'), bam: () => xe.doi() }, // E / nút: ở đâu cũng gọi được xe tới
  ] });
}
function diBo() { // đứng xuống mặt đất ngay dưới tâm nhìn, quay mặt theo hướng camera đang nhìn
  if (!di || !datY) return;
  const x = orbit.target.x, z = orbit.target.z, h = Math.atan2(orbit.target.x - camera.position.x, orbit.target.z - camera.position.z), y = matTren(x, z);
  di.vao(x, y + 0.3, z, h); xe?.goiNeuXa(x, y, z, h);
}
function matTren(x, z, tu = 1200) { // mặt cao nhất dưới điểm (x, z): tháp đỏ cao tới ~450 m → thả từ trên đỉnh, trúng tháp thì đứng lên chóp / ban công
  const y0 = datTai(x, z) + tu, tia = world.castRay(new RAPIER.Ray({ x, y: y0, z }, { x: 0, y: -1, z: 0 }), tu * 2, true);
  return tia ? y0 - tia.timeOfImpact : datTai(x, z); }
$('b-di').onclick = diBo; $('b-bay').onclick = () => di?.ra();

// ---------- bấm đúp = sà xuống chỗ đó ----------
// đang ở trên cao thấy đoạn phố hay: bấm đúp vào đó → camera lượn xuống trong 1,6 s, dừng cách điểm bấm ~55 m, cao ~20 m, giữ hướng đang nhìn.
// Bấm đúp lần nữa khi đã thấp → sà sát hơn (cao ~6 m, như người đứng trên ban công tầng 2). Enter = đứng hẳn xuống đi bộ.
const _tia = new THREE.Raycaster(), _chuot = new THREE.Vector2();
let sa = null; // { t, tu: [cam, dich], toi: [cam, dich] }
renderer.domElement.addEventListener('dblclick', (e) => {
  if (di?.dang) return;
  const r = renderer.domElement.getBoundingClientRect();
  _chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  _tia.setFromCamera(_chuot, camera);
  const trung = _tia.intersectObjects(scene.children, true).find((h) => { for (let o = h.object; o; o = o.parent) if (!o.visible) return false; return true; });
  let p = trung?.point;
  if (!p) { // trượt khỏi nhà: lấy mặt đất dọc tia
    const o = _tia.ray.origin, d = _tia.ray.direction; if (d.y > -0.01) return;
    const t = (o.y - datTai(o.x, o.z)) / -d.y; p = o.clone().addScaledVector(d, t); p.y = datTai(p.x, p.z);
  }
  const caoNay = camera.position.y - p.y, thap = caoNay < 45, lui = thap ? 22 : 55, len = thap ? 6 : 20;
  const huong = new THREE.Vector3(camera.position.x - p.x, 0, camera.position.z - p.z); if (huong.lengthSq() < 1) huong.set(0, 0, 1); huong.normalize();
  const camToi = p.clone().addScaledVector(huong, lui); camToi.y = Math.max(p.y + len, datTai(camToi.x, camToi.z) + 2);
  sa = { t: 0, tu: [camera.position.clone(), orbit.target.clone()], toi: [camToi, p.clone()] };
  orbit.autoRotate = false;
});
function saKhung(dt) {
  if (!sa) return; sa.t = Math.min(1, sa.t + dt / 1.6); const k = sa.t * sa.t * (3 - 2 * sa.t);
  // lượn cung: giữa đường nhấc cao thêm một chút để không cắm thẳng qua tháp
  camera.position.lerpVectors(sa.tu[0], sa.toi[0], k); camera.position.y += Math.sin(Math.PI * k) * Math.min(80, sa.tu[0].distanceTo(sa.toi[0]) * 0.12);
  orbit.target.lerpVectors(sa.tu[1], sa.toi[1], k); orbit.update();
  if (sa.t >= 1) sa = null;
}
addEventListener('keydown', (e) => { if (e.code === 'Escape' && di?.dang) di.ra(); if (e.code === 'KeyE' && di?.dang && !e.repeat && !e.target.closest?.('input,textarea')) xe?.doi(); if (e.code === 'Enter' && !di?.dang && !e.target.closest?.('input,textarea')) diBo(); });

ganGopY({ nut: $('b-gy'), chupAnh: () => chupCanvas(renderer.domElement, () => ve()), nguCanh: () => { const p = di?.dang ? di.viTri() : orbit.target, ll = laLatLon(p.x, p.z);
  return `kiểu ${KIEU[kieu].ten} · ${di?.dang ? 'đi bộ' : 'bay'} · ${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)} · ô ${tk.o} · va chạm ${tk.va}`; } });
function laLatLon(x, z) { return { lat: TAM.lat - z / 110950, lon: TAM.lon + x / (111320 * Math.cos(TAM.lat * Math.PI / 180)) }; } // X đông, Z nam

// ---------- góc quay dựng sẵn + quay 4K ----------
// ?goc=anh|cum|gan|pho|tren  ·  &cam=x,y,z,tx,ty,tz[,fov]  ·  &sach (ẩn giao diện, H bật tắt)  ·  &4k (khung vẽ 3840 × 2160)
// &bay=quay|tien (chuyển động chậm cho quay phim) · phím: C chép góc hiện tại thành link · P chụp ảnh 4K · R bắt đầu / dừng quay video
const qs = new URLSearchParams(location.search), K4 = qs.has('4k'), DOC = qs.has('doc'), KW = DOC ? 2160 : 3840, KH = DOC ? 3840 : 2160; // &doc = khung dọc 9:16 cho reel
let gocTay = false; orbit.addEventListener('start', () => { gocTay = true; });
function gocDung(ten) { // trả [cam xyz, đích xyz, fov]; góc theo dữ liệu quy hoạch nên đổi bản quy hoạch vẫn đúng chỗ
  const ql = rs?.ql, d0 = (x, z) => datTai(x, z) || 0;
  if (!datY && ten && ten !== 'tren') return [[500, 650, 900], [0, 60, 0], 60]; // đất chưa dựng: đứng cao nhìn bao quát cho ô nhà nạp về, đất xong vòng vẽ tự đặt lại góc sát đất
  if (ten === 'anh' && ql) { // ảnh mẫu: nhìn cao, chếch xuống dọc đại lộ lớn kẹp giữa hai hàng tháp đỏ, xa là thành phố mờ sương
    let tot = null;
    for (const dl of ql.daiLo) if (dl.lop === 'lon') for (let i = 0; i < dl.g.length - 1; i++) {
      const [ax, az] = dl.g[i]; let j = i + 1; while (j < dl.g.length - 1 && Math.hypot(dl.g[j][0] - ax, dl.g[j][1] - az) < 300) j++;
      const [bx, bz] = dl.g[j], L = Math.hypot(bx - ax, bz - az); if (L < 150) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L; let diem = 0;
      for (const t of ql.thap) { const dx = t.o[0] - ax, dz = t.o[1] - az, doc = dx * ux + dz * uz, ngang = Math.abs(dx * uz - dz * ux);
        if (doc > 0 && doc < 900 && ngang > 30 && ngang < 220) diem += 1 + t.caoSpire / 300 - doc / 1500; }
      if (!tot || diem > tot.diem) tot = { diem, ax, az, ux, uz };
    }
    if (tot) { const { ax, az, ux, uz } = tot, y = d0(ax, az); return [[ax - ux * 160, y + 240, az - uz * 160], [ax + ux * 900, y + 40, az + uz * 900], 50]; }
  }
  if (ten === 'gan' && rs?.thap?.length) { // sát một tháp cao: thấy mạch tấm ốp, ban công, cửa tròn, hộp ốp
    const d = [...rs.thap].sort((a, b) => b.than - a.than)[1] || rs.thap[0], [x, z] = d.t.o, y = (d.y0 ?? d0(x, z)) + d.than * 0.62;
    return [[x + d.R * 1.9, y + 14, z + d.R * 1.6], [x, y, z], 55];
  }
  if ((ten === 'pho' || ten === 'cho') && ql) { // xuống phố: đoạn đại lộ rộng gần tâm nhất (đông người + chợ nhất)
    let tot = null;
    for (const dl of ql.daiLo) if (dl.lop !== 'nho') for (let j = 1; j < dl.g.length; j++) {
      const [ax, az] = dl.g[j - 1], [bx, bz] = dl.g[j], L = Math.hypot(bx - ax, bz - az); if (L < 60) continue;
      const k = Math.hypot((ax + bx) / 2, (az + bz) / 2) - (dl.lop === 'lon' ? 150 : 0); if (!tot || k < tot.k) tot = { k, ax, az, ux: (bx - ax) / L, uz: (bz - az) / L };
    }
    if (tot) { const { ax, az, ux, uz } = tot, y = d0(ax, az);
      return ten === 'pho' ? [[ax, y + 2.2, az], [ax + ux * 40, y + 1.6, az + uz * 40], 55]             // ngang tầm mắt giữa dòng người
        : [[ax + ux * 4, y + 22, az + uz * 4], [ax + ux * 50, y, az + uz * 50], 50]; }              // máy bay thấp nhìn xuống chợ
  }
  if (ten === 'nga' && ql) { // ngã tư đường xe gần tâm nhất: thấy vạch qua đường, vạch dừng, vạch tim, bó vỉa
    const m = new Map();
    for (const dl of ql.daiLo) if (dl.lop === 'vua') dl.g.forEach((p, i) => { const k = p[0].toFixed(1) + ',' + p[1].toFixed(1); m.set(k, (m.get(k) || 0) + (i === 0 || i === dl.g.length - 1 ? 1 : 2)); });
    const n = [...m].filter(([, v]) => v >= 3).map(([k]) => k.split(',').map(Number)).sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))[0];
    if (n) { // máy đặt lùi dọc trục một nhánh đường (lòng đường không có nhà che), lệch sang lề cho thấy cả vỉa hè
      const [x, z] = n; let ux = 0, uz = 1;
      for (const dl of ql.daiLo) if (dl.lop === 'vua') { const i = dl.g.findIndex((p) => Math.abs(p[0] - x) < 0.05 && Math.abs(p[1] - z) < 0.05); const q = i < 0 ? null : dl.g[i + 1] || dl.g[i - 1];
        if (q) { const L = Math.hypot(q[0] - x, q[1] - z) || 1; ux = (q[0] - x) / L; uz = (q[1] - z) / L; break; } }
      const y = d0(x, z); return [[x + ux * 55 - uz * 6, y + 26, z + uz * 55 + ux * 6], [x, y, z], 50];
    }
  }
  if (ten === '2200' && n2?.cao?.length && ql) { // reel Japan 2200: cao ~150 m, chúc xuống ~30° dọc cao tốc trên cao, hai hàng tháp trắng kẹp hai bên
    let tot = null;
    for (const c of n2.cao) for (let i = 16; i < c.P.length - 16; i += 2) for (const sg of [1, -1]) {
      if (c.kc[i] < 340 || c.kc[i] > c.L - 340) continue;                                            // bỏ đoạn dốc hai đầu tuyến
      const [ax, az] = c.P[i], [bx, bz] = c.P[i + 12 * sg], L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L;
      const cx = ax - ux * 60, cz = az - uz * 60; let tr = 0, ph = 0, ket = false;
      for (const t of n2.thap || ql.thap) { const dx = t.o[0] - ax, dz = t.o[1] - az, doc = dx * ux + dz * uz, s = dx * uz - dz * ux, ng = Math.abs(s);
        if (Math.hypot(t.o[0] - cx, t.o[1] - cz) < t.banKinh + 45) ket = true;                      // máy không đứng sát / trong thân tháp
        if (doc > -40 && doc < 600 && ng > 30 && ng < 260) { const w = (1 + t.caoSpire / 300) * (1 - doc / 900); if (s > 0) tr += w; else ph += w; } }
      if (ket) continue;
      const r0 = Math.hypot(ax, az) || 1, vao = -(ax * ux + az * uz) / r0;                              // nhìn vào tâm: nền xa là phố PLATEAU (dữ liệu chỉ phủ quận Shinjuku), không phải đất trống
      const [mx, mz] = c.P[i + 6 * sg], g1 = Math.atan2(mz - az, mx - ax), g2 = Math.atan2(bz - mz, bx - mx);
      const cong = Math.abs(Math.atan2(Math.sin(g2 - g1), Math.cos(g2 - g1)));                       // đoạn thẳng: cao tốc chạy dọc giữa khung, không cua ra mép
      const diem = Math.min(tr, ph) * 2.5 + tr + ph - r0 / 300 + vao * 4 - cong * 12;
      if (!tot || diem > tot.diem) tot = { diem, ax, az, ux, uz, c, i, sg };
    }
    if (tot) { // nhắm vào CHÍNH mặt cao tốc ~200 m phía trước (độ cao tuyến, không phải đất dưới gầm), máy cao ~150 m so với đất
      const { ax, az, ux, uz, c, i, sg } = tot, y = d0(ax, az), [tx, tz] = c.P[i + 10 * sg], yc = c.y[i + 10 * sg] || d0(tx, tz) + 46;
      return [[ax - ux * 70, y + 150, az - uz * 70], [tx, yc, tz], 55]; }
  }
  if (ten === '2200' && ql) { // dự phòng khi chưa có cao tốc: dọc đại lộ lớn
    let tot = null;
    for (const dl of ql.daiLo) if (dl.lop === 'lon') for (let i = 0; i < dl.g.length - 1; i++) {
      const [ax, az] = dl.g[i]; let j = i + 1; while (j < dl.g.length - 1 && Math.hypot(dl.g[j][0] - ax, dl.g[j][1] - az) < 250) j++;
      const [bx, bz] = dl.g[j], L = Math.hypot(bx - ax, bz - az); if (L < 120) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L; let tr = 0, ph = 0;
      for (const t of ql.thap) { const dx = t.o[0] - ax, dz = t.o[1] - az, doc = dx * ux + dz * uz, s = dx * uz - dz * ux, ng = Math.abs(s);
        if (doc > -80 && doc < 520 && ng > 35 && ng < 240) { const w = 1 + t.caoSpire / 300; if (s > 0) tr += w; else ph += w; } }
      const diem = Math.min(tr, ph) * 2 + tr + ph - Math.hypot(ax, az) / 2000;
      if (!tot || diem > tot.diem) tot = { diem, ax, az, ux, uz };
    }
    if (tot) { const { ax, az, ux, uz } = tot, y = d0(ax, az); return [[ax - ux * 90, y + 150, az - uz * 90], [ax + ux * 230, y + 5, az + uz * 230], 55]; }
  }
  if (ten === 'tren') return [[0, 1800, 400], [0, 0, 0], 55];
  if (kieu === 'do' || kieu === 'nhat' || ten === 'cum') return [[420, 210, 620], [-260, 150, -120], 60]; // cụm tháp Nishi-Shinjuku
  return [[500, 650, 900], [0, 60, 0], 60];
}
function datGoc() {
  const c = qs.get('cam')?.split(',').map(Number), g = c?.length >= 6 && c.every(Number.isFinite) ? [c.slice(0, 3), c.slice(3, 6), c[6] || 60]
    : choCu && !qs.has('goc') ? [choCu.cam, choCu.dich, choCu.fov || 60] : gocDung(qs.get('goc') || (kieu === 'nhat' ? '2200' : '')); // link có góc thì theo link, không thì về chỗ lần trước
  camera.position.set(...g[0]); orbit.target.set(...g[1]); camera.fov = g[2]; camera.updateProjectionMatrix(); orbit.update();
}
// ---------- nhớ chỗ qua F5 (khuôn castle ns-cho): mỗi giây + lúc rời trang ghi chế độ (bay / đi bộ), camera, chỗ chân + hướng ----------
const KHOA_CHO = 'sprawl-cho';
let choCu = null; try { choCu = JSON.parse(localStorage.getItem(KHOA_CHO) || 'null'); if (!Array.isArray(choCu?.cam) || !Array.isArray(choCu?.dich)) choCu = null; } catch {}
let choCho = choCu?.di && !qs.has('cam') && !qs.has('goc') ? choCu : null, lucCho = performance.now(); // đang chờ đất + ô nhà quanh chỗ cũ nạp xong mới đặt người xuống
function ghiCho() {
  if (choCho) return; // chưa đặt lại xong thì không ghi đè chỗ cũ bằng góc tạm
  const f = (v) => Math.round(v * 100) / 100, d = di?.dang ? di.viTri() : null;
  const o = { cam: camera.position.toArray().map(f), dich: orbit.target.toArray().map(f), fov: camera.fov,
    ...(d ? { di: { p: [f(d.x), f(d.y), f(d.z)], huong: f(di.huong), yaw: f(di.yaw), pitch: f(di.pitch) }, cam: [f(d.x + 40), f(d.y + 60), f(d.z + 70)], dich: [f(d.x), f(d.y), f(d.z)] } : {}) };
  try { localStorage.setItem(KHOA_CHO, JSON.stringify(o)); } catch {}
}
addEventListener('pagehide', ghiCho);
function datLaiCho(now) { // F5 lúc đang đi bộ: đứng lại đúng chỗ khi đất đã dựng và ô nhà quanh đó hết hàng đợi (tối đa 15 s)
  if (!choCho || !di || !datY) return;
  const ban = dsTiles.some((t) => t.stats.queued + t.stats.downloading + t.stats.parsing > 0);
  if (ban && now - lucCho < 15000) return;
  const { p, huong, yaw, pitch } = choCho.di; choCho = null;
  const y = Math.max(p[1], matTren(p[0], p[2], Math.max(4, p[1] - datTai(p[0], p[2]) + 2)));
  di.vao(p[0], y + 0.2, p[2], huong); if (Number.isFinite(yaw)) di.yaw = yaw; if (Number.isFinite(pitch)) di.pitch = pitch;
  baoNho('Đã về chỗ đứng lần trước');
}
datGoc();
function linkGoc() { const u = new URL(location.href), f = (v) => Math.round(v * 10) / 10;
  u.searchParams.delete('goc'); u.searchParams.set('kieu', kieu);
  u.searchParams.set('cam', [...camera.position.toArray(), ...orbit.target.toArray()].map(f).concat(camera.fov).join(','));
  return u.toString().replace(/%2C/g, ','); }
function baoNho(chu) { let b = $('bao-nho'); if (!b) { b = document.createElement('div'); b.id = 'bao-nho'; document.body.appendChild(b); }
  b.textContent = chu; b.classList.add('hien'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('hien'), 3500); }
// khung vẽ: chế độ 4K giữ đúng 3840 × 2160, hiển thị co vừa màn (viền đen hai bên nếu màn không 16:9)
function datCo() { // &4k: khung vẽ đúng KW × KH; &doc: khung dọc 9:16 (kèm &4k = 2160 × 3840), co vừa màn, viền đen hai bên
  if (K4 || DOC) { const tl = KW / KH, w = Math.min(innerWidth, innerHeight * tl), h = w / tl, c = renderer.domElement;
    if (K4) { renderer.setPixelRatio(1); renderer.setSize(KW, KH, false); composer.setSize(KW, KH); }
    else { renderer.setSize(w, h, false); composer.setSize(w, h); }
    Object.assign(c.style, { width: w + 'px', height: h + 'px', left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px', inset: 'auto', position: 'fixed' });
    camera.aspect = tl;
  } else { renderer.setPixelRatio(matDo()); composer.setPixelRatio(matDo()); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; }
  camera.updateProjectionMatrix();
}
if (K4 || DOC) datCo();
async function chup4k() { // một khung KW × KH (3840 × 2160, &doc = 2160 × 3840) kể cả khi đang xem khung thường, tải về PNG
  const cu = new THREE.Vector2(); renderer.getSize(cu); const pr = renderer.getPixelRatio(), asp = camera.aspect;
  renderer.setPixelRatio(1); renderer.setSize(KW, KH, false); composer.setSize(KW, KH); camera.aspect = KW / KH; camera.updateProjectionMatrix();
  for (const t of dsTiles) { t.setResolutionFromRenderer(camera, renderer); t.update(); }
  rs?.loc(camera, true);
  ve(); const blob = await new Promise((ok) => renderer.domElement.toBlob(ok, 'image/png'));
  if (!K4) { renderer.setPixelRatio(pr); renderer.setSize(cu.x, cu.y, false); composer.setSize(cu.x, cu.y); camera.aspect = asp; camera.updateProjectionMatrix(); }
  taiVe(blob, `sprawl-${kieu}-${Date.now()}.png`); baoNho(`Đã chụp ${KW} × ${KH}`);
}
function taiVe(blob, ten) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ten; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
let ghi = null;
function quayPhim() { // ghi khung vẽ thành video (mp4 nếu trình duyệt hỗ trợ, không thì webm); 4K khi mở &4k
  if (ghi) { ghi.stop(); return; }
  const loai = ['video/mp4;codecs=avc1.640033', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const luong = renderer.domElement.captureStream(60), phan = [];
  ghi = new MediaRecorder(luong, { mimeType: loai, videoBitsPerSecond: K4 ? 60e6 : 20e6 });
  ghi.ondataavailable = (e) => e.data.size && phan.push(e.data);
  ghi.onstop = () => { taiVe(new Blob(phan, { type: loai }), `sprawl-${kieu}-${Date.now()}.${loai.includes('mp4') ? 'mp4' : 'webm'}`); ghi = null; $('b-quay').textContent = '🎬'; baoNho('Đã lưu video'); };
  ghi.start(1000); $('b-quay').textContent = '⏹'; baoNho(K4 ? 'Đang quay 3840 × 2160 · R để dừng' : 'Đang quay theo cỡ màn · mở &4k để quay 4K · R để dừng');
}
const BAY = qs.get('bay'); if (BAY === 'quay') { orbit.autoRotate = true; orbit.autoRotateSpeed = 0.12; }
function bayTien(dt) { if (BAY !== 'tien' || di?.dang) return; const v = new THREE.Vector3().subVectors(orbit.target, camera.position).setY(0).normalize().multiplyScalar(8 * dt); camera.position.add(v); orbit.target.add(v); }
if (qs.has('sach')) document.body.classList.add('sach');
$('b-chup').onclick = chup4k; $('b-quay').onclick = quayPhim;
$('b-goc').onclick = () => navigator.clipboard?.writeText(linkGoc()).then(() => baoNho('Đã chép link góc này'), () => prompt('Link góc này:', linkGoc()));
addEventListener('keydown', (e) => { if (e.target.closest?.('input,textarea') || e.metaKey || e.ctrlKey) return;
  if (e.code === 'KeyH') document.body.classList.toggle('sach');
  else if (e.code === 'KeyC' && !di?.dang) $('b-goc').onclick();
  else if (e.code === 'KeyP') chup4k();
  else if (e.code === 'KeyR') quayPhim(); else if (e.code === 'KeyM') doiMua(); });

// ---------- bản đồ (bando.js dùng chung của castle): nhỏ đi theo người, bấm phóng to, bấm đâu tới đó + điểm đến nhanh ----------
// toạ độ địa danh tra OpenStreetMap Nominatim 23/11/2026, đổi sang mét quanh TAM (X đông, Z nam)
const xzCua = (lat, lon) => [(lon - TAM.lon) * 111320 * Math.cos(TAM.lat * Math.PI / 180), -(lat - TAM.lat) * 110950];
const DIEM = [['🚉 Ga Shinjuku', 35.68888, 139.69872], ['🏛 Toà thị chính', 35.68950, 139.69171], ['🌃 Kabukichō', 35.69387, 139.70103], ['🌳 Shinjuku Gyoen', 35.68507, 139.70955],
  ['🌲 Công viên Trung tâm', 35.69003, 139.68958], ['🚉 Ga Ōkubo', 35.70156, 139.69527], ['🚉 Ga Yoyogi', 35.68226, 139.70199]].map(([t, la, lo]) => [t, ...xzCua(la, lo)]);
function diNhanh(x, z) {
  if (Math.abs(x) > NUA - 20 || Math.abs(z) > NUA - 20) { baoNho('Ngoài vùng đã dựng (3 km quanh Nishi-Shinjuku)'); return false; }
  if (di?.dang) { if (xe?.dangLai) xe.xuong(); const y = matTren(x, z); di.datCho({ x, y: y + 1.2, z }); return true; }
  const lech = camera.position.clone().sub(orbit.target), y = datTai(x, z), dich = new THREE.Vector3(x, y, z); // bay: giữ góc nhìn, lượn tới
  if (lech.length() > 400) lech.setLength(400);
  sa = { t: 0, tu: [camera.position.clone(), orbit.target.clone()], toi: [dich.clone().add(lech), dich] }; gocTay = true; return true;
}
let banDo = null, lucBd = 0;
try {
  banDo = taoBanDo($('bd'), { phamVi: [260, NUA], tam: [0, 0], diem: DIEM, khiChon: diNhanh,
    veNen(g, S, p, k) {
      g.fillStyle = '#3a3d42'; g.fillRect(0, 0, S, S);
      const ql = rs?.ql; if (!ql) return;
      const net = (ds, mau, w) => { g.strokeStyle = mau; g.lineWidth = Math.max(1, w * k); g.lineCap = 'round'; g.beginPath(); for (const gg of ds) gg.forEach(([x, z], i) => { const [a, b] = p(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
      net(ql.pho, '#55595f', 6); net(ql.tau, '#8d6e63', 5);
      net(ql.daiLo.filter((d) => d.lop === 'dibo').map((d) => d.g), '#6b7078', 6); net(ql.daiLo.filter((d) => d.lop === 'vua').map((d) => d.g), '#a8adb5', 12); net(ql.daiLo.filter((d) => d.lop === 'lon').map((d) => d.g), '#e7c27a', 18);
      if (kieu === 'do' || kieu === 'nhat') { g.fillStyle = kieu === 'do' ? '#d8434f' : '#f0f3f6'; for (const t of ql.thap) { const [a, b] = p(...t.o); g.beginPath(); g.arc(a, b, Math.max(1.5, t.banKinh * k * 0.6), 0, 7); g.fill(); } }
      g.font = `${Math.max(11, 5 * k)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (const [t, x, z] of DIEM) g.fillText(t.split(' ')[0], ...p(x, z));
    } });
  // bando.js đánh dấu tâm cảnh bằng 🏰 (viết cho lâu đài) → ở Sprawl tâm là Nishi-Shinjuku: thay đúng ký tự đó, không đụng mã dùng chung
  const g2 = $('bd').querySelector('canvas').getContext('2d'), ftCu = g2.fillText.bind(g2); g2.fillText = (t, ...r) => ftCu(t === '🏰' ? '🏙' : t, ...r);
} catch (e) { console.warn('[sprawl] không dựng được bản đồ', e); $('bd').style.display = 'none'; }
function veBanDo(now) {
  if (!banDo || now - lucBd < 120) return; lucBd = now;
  const nguoi = di?.dang ? (xe?.dangLai ? xe.than.translation() : di.viTri()) : orbit.target;
  const huong = di?.dang ? (xe?.dangLai ? xe.huong() : di.huong) : Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z) + Math.PI;
  banDo.ve(nguoi, huong, []);
}

// ---------- vòng vẽ ----------
let daGoc = false, lan = 0, tichLuy = 0, demKhung = 0, tFps = performance.now(), fps = 0, tDat = 0, tO = 0;
const _camO = new THREE.Matrix4(), _chieuO = new THREE.Matrix4();
const dongHo = new THREE.Clock();
// nhịp vẽ: đang đi / lái / quay phim / vừa chạm chuột, phím hay camera còn trôi → tối đa 60 khung/s (màn 120 Hz không vẽ gấp đôi);
// để yên quá 2 s → 30 khung/s. Thành phố vẫn chạy, chỉ vẽ thưa hơn; chạm vào là về nhịp đầy ngay khung kế.
let tDong = performance.now(), tVe = 0;
for (const k of ['pointerdown', 'wheel', 'keydown', 'touchstart']) addEventListener(k, () => { tDong = performance.now(); }, { passive: true, capture: true });
addEventListener('pointermove', (e) => { if (e.buttons) tDong = performance.now(); }, { passive: true, capture: true });
function ve() { renderer.info.reset(); if (KIEU[kieu].bloom > 0) composer.render(); else renderer.render(scene, camera); }
renderer.setAnimationLoop(() => {
  { const t = performance.now(), yen = !di?.dang && !ghi && t - tDong > 2000;
    if (t - tVe < (yen ? 30 : 14)) return; tVe = t; }
  const dt = Math.min(0.05, dongHo.getDelta());
  if (di?.dang) { tichLuy += dt; while (tichLuy >= 1 / 60) { di.buoc(1 / 60); xe?.buoc(1 / 60); xeDuong?.buoc(rs.goc.visible ? di.viTri() : null, 1 / 60); world.step(); tichLuy -= 1 / 60; } xe?.khung(); xeDuong?.khung(); di.khung(dt); }
  else { bayTien(dt); orbit.update(); }
  saKhung(dt);
  rs?.khung(dt, camera); n2?.khung(dt, camera);
  if (datY && !gocTay && !daGoc) { daGoc = true; datGoc(); } // đất dựng xong mới biết độ cao thật → đặt lại góc dựng sẵn (nếu anh chưa tự xoay)
  // ô nhà: chỉ duyệt cây ô khi camera đổi, còn ô đang tải, hoặc mỗi 0,5 s (trước đây mỗi khung)
  const now = performance.now(); camera.updateMatrixWorld();
  if (!camera.matrixWorld.equals(_camO) || !camera.projectionMatrix.equals(_chieuO) || now - tO > 500 || dsTiles.some((t) => t.stats.queued + t.stats.downloading + t.stats.parsing > 0)) {
    if (!camera.matrixWorld.equals(_camO)) tDong = now; // camera còn trôi (quán tính, tự xoay, bay tới) = chưa yên
    _camO.copy(camera.matrixWorld); _chieuO.copy(camera.projectionMatrix); tO = now;
    for (const t of dsTiles) { t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer); t.update(); } }
  if (chanDoi && now - tDat > (datY ? 2500 : 600)) { tDat = now; dungDat(); if (!di?.dang && qs.has('goc') && !qs.has('bay')) daGoc = false; } // đất đổi cao độ khi ô nhà nạp thêm → góc dựng sẵn đặt lại theo (chỉ khi anh chưa tự xoay)
  bauTroi.position.copy(camera.position);
  { const pM = di?.dang ? di.viTri() : orbit.target; mua.khung(dt, datTai(pM.x, pM.z), dsUot, bauTroi.visible ? bauTroi : null); } // mưa: soi bóng ướt · khô: bóng mờ khi nhìn sát mặt đường
  const vc = rs?.song.vatCan; if (vc) { vc.length = 0; // xe trên phố dừng trước người chơi và trước chiếc xe của người chơi
    if (di?.dang) { if (!xe?.dangLai) { const p = di.viTri(); vc.push({ x: p.x, z: p.z, r: 0.5 }); } if (xe) { const p = xe.than.translation(); if (p.y > -300) vc.push({ x: p.x, z: p.z, r: 1.6 }); } }
    for (const x of xeDuong?.xac || []) { const p = x.than.translation(); vc.push({ x: p.x, z: p.z, r: 2.2 }); } // xác xe nằm trên đường: xe sau dừng trước nó, không đâm dây chuyền
    rs.nguoiGan.dayVatCan(vc); } // người gần đang băng qua lòng đường: xe dừng trước họ
  rs?.nguoiGan.datChoi(di?.dang && !xe?.dangLai ? di.viTri() : null); // người chơi đi bộ: người gần né
  ve(); demKhung++;
  datLaiCho(now); veBanDo(now);
  if (now - tFps > 1000) { fps = Math.round(demKhung * 1000 / (now - tFps)); demKhung = 0; tFps = now; ghiCho();
    const p = di?.dang ? di.viTri() : orbit.target, ll = laLatLon(p.x, p.z);
    $('tt').textContent = `${fps} khung/s · ${tk.o} ô nhà · ${renderer.info.render.triangles.toLocaleString('vi')} tam giác · ${renderer.info.render.calls} lượt vẽ · ${ll.lat.toFixed(4)}, ${ll.lon.toFixed(4)}`;
    if (!lan && tk.o) { lan = 1; $('nap').style.display = 'none'; } }
});
addEventListener('resize', datCo);
// bộ đo khung va (2f nhịp A): thả tia Rapier từ trên mặt từng công trình xuống, mặt nào tia không chạm đúng độ cao = công trình nhìn thấy mà xuyên qua được.
// Đo bằng tia Rapier chứ không bằng tia three.js vì người + đồ phố vẽ bằng shader instanced, tia three.js không thấy hình thật.
function kiemVa({ buoc = 4, lech = 0.6 } = {}) {
  const ra = { caoToc: { thu: 0, truot: [] }, cau: { thu: 0, truot: [] }, vaGan: rs?.tk.vaGan ?? 0 };
  const tha = (x, y, z) => { const t = world.castRay(new RAPIER.Ray({ x, y: y + 3, z }, { x: 0, y: -1, z: 0 }), 6, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC); return t ? y + 3 - t.timeOfImpact : null; };
  if (n2?.goc.visible) for (const [a, c] of (n2.cao || []).entries()) for (let i = 0; i < c.P.length; i += buoc) { ra.caoToc.thu++;
    const y = tha(c.P[i][0], c.y[i], c.P[i][1]); if (y == null || Math.abs(y - c.y[i]) > lech) ra.caoToc.truot.push({ a, i, x: Math.round(c.P[i][0]), z: Math.round(c.P[i][1]), can: +c.y[i].toFixed(1), cham: y == null ? null : +y.toFixed(1) }); }
  if (rs?.tk.vaCau) for (const [k, c] of rs.song.cau.entries()) { if (!c.va) continue; const v = c.va;
    for (const f of [-0.4, 0, 0.4]) { ra.cau.thu++; const x = v.x + v.dx * v.L * f, z = v.z + v.dz * v.L * f, y = tha(x, v.y + 0.7, z);
      if (y == null || Math.abs(y - (v.y + 0.7)) > lech) ra.cau.truot.push({ k, f, can: +(v.y + 0.7).toFixed(1), cham: y == null ? null : +y.toFixed(1) }); } }
  ra.dat = !ra.caoToc.truot.length && !ra.cau.truot.length; return ra; }
window.__sprawl = { RAPIER, world, scene, camera, orbit, renderer, dsTiles, tk, datTai, datMuot, rs, n2, kiemVa, get di() { return di; }, get xe() { return xe; }, xeDuong };
