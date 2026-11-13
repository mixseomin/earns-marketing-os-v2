// Lâu đài dung nham — cả cảnh sinh bằng mã (hạt giống ?h=…), vật lý Rapier, đi bộ góc nhìn thứ nhất.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import RAPIER from 'rapier';
import * as T from './tex.js';
import { taoNguoi, MAU_DA, MAU_AO } from './nhanvat.js';
import { dungNhaQuan, nguoiQuan } from './quan.js';
import { taoAmThanh } from './amthanh.js';

const $ = (id) => document.getElementById(id);
const thamSo = new URLSearchParams(location.search);
const HAT = Number(thamSo.get('h')) || Math.floor(Math.random() * 1e6);
const r = T.rngTu(HAT);
const giua = (a, b) => a + r() * (b - a);
const THU = thamSo.has('thu'); // bộ kiểm tự động: đi bộ không cần khoá chuột
const CHAM = matchMedia('(hover: none)').matches || 'ontouchstart' in window;

try { await RAPIER.init(); } catch (e) { $('tai').innerHTML = '<div class="loi">Không nạp được bộ vật lý. Tải lại trang thử lần nữa.</div>'; throw e; }

// ---------- khung dựng
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let doNet = Math.min(devicePixelRatio, CHAM ? 1.1 : 1.25); // Retina 2–3x vẽ đủ điểm ảnh là nóng máy (MacBook 14/11/2026)
renderer.setPixelRatio(doNet);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x6a3424, 0.0034);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2500);
camera.position.set(70, 48, 150);

// trời khói hoàng hôn: shader dải màu + mây khói nhiễu + quầng mặt trời (tự viết, không dùng ảnh)
const huongNang = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(-140));
const VL_TROI = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { nang: { value: huongNang }, t: { value: 0 } },
  vertexShader: `varying vec3 vd; void main(){ vd = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 nang; uniform float t; varying vec3 vd;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.1; a*=.5; } return s; }
    void main(){
      vec3 d = normalize(vd); float y = d.y;
      vec3 chan = vec3(.62,.30,.17), giua = vec3(.24,.13,.14), dinh = vec3(.06,.05,.09);
      vec3 c = mix(chan, giua, smoothstep(0., .22, y)); c = mix(c, dinh, smoothstep(.2, .75, y));
      if (y < 0.) c = mix(chan, vec3(.35,.12,.05), smoothstep(0., -.2, y));
      float sd = max(dot(d, normalize(nang)), 0.);
      c += vec3(1.,.55,.25)*pow(sd, 12.)*.55 + vec3(1.,.8,.55)*pow(sd, 400.)*3.;
      vec2 uv = d.xz/(abs(y)+.12);
      float may = fbm(uv*1.4 + vec2(t*.006, t*.002));
      float lop = smoothstep(.45, .8, may) * smoothstep(-.02, .12, y) * (1.-smoothstep(.5,.9,y));
      c = mix(c, vec3(.16,.09,.08) + vec3(.5,.22,.08)*smoothstep(.25,0.,y)*.6 + vec3(.6,.3,.15)*pow(sd,6.)*.6, lop*.75);
      gl_FragColor = vec4(c, 1.);
    }`,
});
const troi = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), VL_TROI); troi.frustumCulled = false; scene.add(troi);

const nang = new THREE.DirectionalLight(0xffc08a, 2.6);
nang.position.copy(huongNang).multiplyScalar(160); nang.castShadow = true;
nang.shadow.mapSize.set(CHAM ? 1024 : 2048, CHAM ? 1024 : 2048);
Object.assign(nang.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 400 });
nang.shadow.bias = -0.0004; nang.shadow.normalBias = 0.04;
scene.add(nang);
scene.add(new THREE.HemisphereLight(0x9a8aa8, 0xb8501e, 1.1));

// ---------- vật liệu (bề mặt vẽ bằng mã)
const vl = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: o.bump ?? 2, roughness: o.ro ?? 0.9, metalness: 0, emissiveMap: t.emis || null, emissive: t.emis ? 0xffffff : 0x000000, emissiveIntensity: t.emis ? 2.2 : 0, ...(o.color ? { color: o.color } : {}) });
const VL = {
  da: vl(T.daXay(r, 30, 54)), daTrong: vl(T.daXay(r, 24, 46)), bazan: vl(T.bazan(r), { bump: 4 }), cuoi: vl(T.cuoi(r), { bump: 3 }),
  ngoi: vl(T.ngoi(r, 10)), ngoiXanh: vl(T.ngoi(r, 205), { ro: 0.7 }), vua: vl(T.vuaGo(r)), go: vl(T.van(r)),
};
const DO_UV = { da: 5, daTrong: 5, bazan: 9, cuoi: 4, ngoi: 3, ngoiXanh: 3, vua: 6, go: 2 };

// ---------- gom hình theo vật liệu → mỗi vật liệu một lưới (nhẹ cho GPU)
const xo = {}; const dat = []; // dat = lưới mặt đất để nhấp đúp
function uvTheGioi(g, s) { // UV theo mét thế giới, chọn mặt chiếu theo pháp tuyến
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function uvTru(g, chuVi, cao, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * chuVi / s, uv.getY(i) * cao / s); }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
function dat_(vlk, g, x, y, z, ry = 0, kieuUv = 'tg') {
  g = g.index ? g.toNonIndexed() : g;
  _q.setFromEuler(_e.set(0, ry, 0)); _m.compose(new THREE.Vector3(x, y, z), _q, _s); g.applyMatrix4(_m);
  if (kieuUv === 'tg') uvTheGioi(g, DO_UV[vlk]);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  (xo[vlk] ||= []).push(g);
}
function hop(vlk, w, h, d, x, y, z, ry = 0) { dat_(vlk, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry); }
function tru(vlk, rt, rb, h, x, y, z, seg = 24) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false); uvTru(g, Math.PI * 2 * Math.max(rt, rb), h, DO_UV[vlk]); dat_(vlk, g, x, y + h / 2, z, 0, 'tru'); }
function non(vlk, rr, h, x, y, z, seg = 24) { const g = new THREE.ConeGeometry(rr, h, seg, 1, true); uvTru(g, Math.PI * 2 * rr, Math.hypot(rr, h), DO_UV[vlk]); dat_(vlk, g, x, y + h / 2, z, 0, 'tru'); }
function maiDoc(vlk, w, d, h, x, y, z, ry) { // mái hai mái, nóc chạy theo chiều w
  const a = w / 2, b = d / 2, P = [
    [-a, 0, b], [a, 0, b], [a, h, 0], [-a, 0, b], [a, h, 0], [-a, h, 0],
    [a, 0, -b], [-a, 0, -b], [-a, h, 0], [a, 0, -b], [-a, h, 0], [a, h, 0],
    [-a, 0, -b], [-a, 0, b], [-a, h, 0], [a, 0, b], [a, 0, -b], [a, h, 0]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3)); g.computeVertexNormals();
  const uv = []; const doc = Math.hypot(b, h);
  for (let i = 0; i < 12; i += 3) for (const k of [0, 1, 2]) { const p = P[i + k]; uv.push(p[0] / DO_UV[vlk], (p[1] > 0 ? doc : 0) / DO_UV[vlk]); }
  for (let i = 12; i < 18; i++) uv.push(P[i][2] / DO_UV[vlk], P[i][1] / DO_UV[vlk]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  dat_(vlk, g, x, y, z, ry, 'tay');
}
function dungLuoi() {
  for (const [k, gs] of Object.entries(xo)) {
    const m = new THREE.Mesh(mergeGeometries(gs), VL[k]); m.castShadow = m.receiveShadow = true; scene.add(m);
    if (k === 'cuoi' || k === 'go') dat.push(m);
  }
}

// ---------- vật lý
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const tinh = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
const qY = (ry) => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)); return { x: q.x, y: q.y, z: q.z, w: q.w }; };
const vaHop = (w, h, d, x, y, z, ry = 0) => world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y + h / 2, z).setRotation(qY(ry)), tinh);
const vaTru = (rr, h, x, y, z) => world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, rr).setTranslation(x, y + h / 2, z), tinh);

// ---------- dựng lâu đài
const R_DAO = 60, R_TUONG = 54, CAO_TUONG = 9, DAY_TUONG = 3.2, SO_THAP = 10, GOC_CONG = Math.PI / 2;

// đảo đá: mép gồ ghề rơi xuống dung nham
{
  const bien = []; for (let i = 0; i <= 12; i++) { const t = i / 12; bien.push(new THREE.Vector2(R_DAO + 2 + Math.pow(t, 1.6) * 14 + (r() - 0.5) * 2.5, -t * 10)); }
  bien.reverse(); bien.push(new THREE.Vector2(R_DAO + 2, 0.02), new THREE.Vector2(0, 0.02));
  const g = new THREE.LatheGeometry(bien, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); if (y < -0.2) { const k = 1 + (Math.sin(x * 0.31 + z * 0.17) * 0.04 + Math.sin(z * 0.53 - x * 0.11) * 0.03); p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.9); } }
  g.computeVertexNormals();
  dat_('bazan', g, 0, 0, 0);
  const san = new THREE.CircleGeometry(R_DAO + 2, 96); san.rotateX(-Math.PI / 2); dat_('cuoi', san, 0, 0.03, 0);
  world.createCollider(RAPIER.ColliderDesc.cylinder(5, R_DAO + 2).setTranslation(0, -5, 0), tinh);
}

// tường thành + tháp; cổng ở hướng nam (+z)
const goc = (i) => GOC_CONG + (i + 0.5) * Math.PI * 2 / SO_THAP;
const cothap = []; // [x,z,r,cao] để cắm cờ
for (let i = 0; i < SO_THAP; i++) {
  const a = goc(i), x = Math.cos(a) * R_TUONG, z = Math.sin(a) * R_TUONG, rt = giua(4, 4.8), h = giua(15, 19);
  tru('da', rt, rt + 0.4, h, x, 0, z);
  for (let k = 0; k < 12; k++) { const b = k / 12 * Math.PI * 2; hop('da', 1, 1.2, 0.9, x + Math.cos(b) * (rt + 0.1), h, z + Math.sin(b) * (rt + 0.1), -b); }
  const hr = giua(6, 9); non(i % 3 ? 'ngoi' : 'ngoiXanh', rt + 1, hr, x, h + 0.6, z);
  vaTru(rt + 0.2, h, x, 0, z);
  cothap.push([x, z, h + 0.6 + hr]); // đỉnh mái → chỗ cắm cờ
}
for (let i = 0; i < SO_THAP; i++) {
  const a1 = goc(i), a2 = goc(i + 1);
  const p1 = [Math.cos(a1) * R_TUONG, Math.sin(a1) * R_TUONG], p2 = [Math.cos(a2) * R_TUONG, Math.sin(a2) * R_TUONG];
  const dx = p2[0] - p1[0], dz = p2[1] - p1[1], L = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
  const ux = dx / L, uz = dz / L, cx = (p1[0] + p2[0]) / 2, cz = (p1[1] + p2[1]) / 2;
  const coCong = i === SO_THAP - 1; // đoạn giữa tháp cuối và tháp đầu = hướng nam
  const doan = coCong ? [[-L / 2 + 3, -3.5], [3.5, L / 2 - 3]] : [[-L / 2 + 3, L / 2 - 3]];
  for (const [s0, s1] of doan) {
    const l = s1 - s0, m = (s0 + s1) / 2, x = cx + ux * m, z = cz + uz * m;
    hop('da', l, CAO_TUONG, DAY_TUONG, x, 0, z, ry); vaHop(l, CAO_TUONG, DAY_TUONG, x, 0, z, ry);
    const nx = -uz, nz = ux; // pháp tuyến ngang của đoạn
    for (let s = s0 + 0.8; s < s1 - 0.5; s += 1.9) for (const bo of [-1, 1]) hop('da', 1, 1.3, 0.7, cx + ux * s + nx * bo * (DAY_TUONG / 2 - 0.35), CAO_TUONG, cz + uz * s + nz * bo * (DAY_TUONG / 2 - 0.35), ry);
  }
  if (coCong) { // vòm cổng + hai tháp canh nhỏ
    hop('daTrong', 7, 3, DAY_TUONG + 1, cx, CAO_TUONG - 3, cz, ry);
    for (const bo of [-1, 1]) { const x = cx + ux * bo * 5, z = cz + uz * bo * 5; tru('daTrong', 2.2, 2.4, CAO_TUONG + 4, x, 0, z, 16); non('ngoi', 3, 4.5, x, CAO_TUONG + 4.4, z, 16); vaTru(2.4, CAO_TUONG + 4, x, 0, z); }
  }
}

// cầu đá ra khỏi đảo, kết bằng sân tròn (chỗ bắt đầu đi bộ)
{
  const z0 = R_TUONG + 1, z1 = 104, L = z1 - z0, zc = (z0 + z1) / 2;
  hop('daTrong', 6, 1.6, L, 0, -1.6, zc); vaHop(6, 1.6, L, 0, -1.6, zc);
  dat_('go', new THREE.BoxGeometry(5.2, 0.1, L), 0, 0.05, zc);
  for (const bo of [-1, 1]) { hop('daTrong', 0.6, 1.1, L, bo * 2.8, 0, zc); vaHop(0.6, 1.1, L, bo * 2.8, 0, zc); }
  for (let z = R_DAO + 10; z < z1; z += 11) tru('bazan', 1.6, 2.2, 10, 0, -11.5, z, 12);
  tru('daTrong', 9, 9.5, 2, 0, -2, z1 + 6, 40); vaTru(9.5, 2, 0, -2, z1 + 6);
  dat_('cuoi', new THREE.CircleGeometry(8.9, 40).rotateX(-Math.PI / 2), 0, 0.03, z1 + 6);
}

// thành chính giữa đảo
{
  const rk = 10, hk = 24;
  tru('daTrong', rk, rk + 0.6, hk, 0, 0, 0, 40); vaTru(rk + 0.4, hk, 0, 0, 0);
  for (let k = 0; k < 24; k++) { const b = k / 24 * Math.PI * 2; hop('daTrong', 1.2, 1.4, 1, Math.cos(b) * rk, hk, Math.sin(b) * rk, -b); }
  non('ngoiXanh', rk - 1.5, 12, 0, hk, 0, 40); tru('daTrong', rk - 1.4, rk - 1.4, 0.8, 0, hk, 0, 40);
  for (let k = 0; k < 4; k++) { const b = k / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(b) * rk, z = Math.sin(b) * rk; tru('da', 2.6, 2.8, hk + 7, x, 0, z, 16); non('ngoi', 3.4, 6, x, hk + 7, z, 16); cothap.push([x, z, hk + 13]); }
  hop('go', 3.4, 4.6, 0.4, 0, 0, rk + 0.45); // cửa gỗ
}

// phố: hai vành nhà quanh vành đường r≈31, chừa 4 phố hướng tâm
const PHO = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const GOC_QUAN = Math.PI / 2 + 0.42, R_QUAN = 41.5, TAM_QUAN = [Math.cos(GOC_QUAN) * R_QUAN, Math.sin(GOC_QUAN) * R_QUAN]; // quán rượu cạnh phố cổng
const nhaVa = [];
for (const hang of [19.5, 25.5, 37.8, 44.2]) { // bốn hàng nhà; vành phố chính r≈31 nằm giữa hàng 2 và 3
  {
    let a = r() * 0.2;
    while (a < Math.PI * 2) {
      const w = giua(5, 7.5), d = giua(4.6, 5.6), tang = 1 + Math.floor(r() * (hang > 30 ? 3 : 2.4)), h = tang * 3;
      const da = w / hang;
      const am = a + da / 2;
      const gan = PHO.some((p) => Math.abs(Math.atan2(Math.sin(am - p), Math.cos(am - p))) * hang < 4.2 + w / 2);
      const choQuan = Math.hypot(Math.cos(am) * hang - TAM_QUAN[0], Math.sin(am) * hang - TAM_QUAN[1]) < 10.5;
      if (!gan && !choQuan && r() > 0.08) {
        const x = Math.cos(am) * hang, z = Math.sin(am) * hang, ry = -am + Math.PI / 2;
        hop('vua', w, h, d, x, 0, z, ry); vaHop(w, h, d, x, 0, z, ry);
        maiDoc(r() < 0.8 ? 'ngoi' : 'ngoiXanh', w + 0.8, d + 1.2, giua(2, 3.2), x, h, z, ry);
        if (r() < 0.5) { const o = giua(-w / 3, w / 3); hop('da', 0.7, 2.2, 0.7, x + Math.cos(-ry) * o, h + 0.6, z + Math.sin(-ry) * o, ry); }
        nhaVa.push([x, z]);
      }
      a += da + giua(0.4, 1.8) / hang;
    }
  }
}

// đèn đường dọc vành phố: cột gỗ + đèn lồng phát sáng, vài đèn thật đổ sáng
const VL_DEN = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb060, emissiveIntensity: 4 });
const gDen = [];
for (let k = 0; k < 28; k++) {
  const a = k / 28 * Math.PI * 2 + 0.06, x = Math.cos(a) * 31, z = Math.sin(a) * 31;
  hop('go', 0.22, 3.2, 0.22, x, 0, z); vaHop(0.22, 3.2, 0.22, x, 0, z);
  gDen.push(new THREE.BoxGeometry(0.42, 0.55, 0.42).translate(x, 3.45, z));
  if (k % 7 === 0) { const l = new THREE.PointLight(0xffa050, 18, 16, 1.8); l.position.set(x, 3.6, z); scene.add(l); }
}
scene.add(new THREE.Mesh(mergeGeometries(gDen), VL_DEN));
const quan = dungNhaQuan({ hop, tru, maiDoc, dat_, vaHop, vaTru, scene, mergeGeometries, chamLua: T.cham() }, GOC_QUAN, R_QUAN);
dungLuoi();

// ---------- dung nham: shader nhiễu chảy, vỏ nguội nứt, sáng quá 1 để bloom bắt
const VL_DN = new THREE.ShaderMaterial({
  uniforms: { t: { value: 0 }, fogColor: { value: scene.fog.color }, fogDensity: { value: scene.fog.density } },
  vertexShader: `varying vec3 vp; varying float vd; void main(){ vec4 w = modelMatrix*vec4(position,1.); vp=w.xyz; vec4 mv=viewMatrix*w; vd=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `
    uniform float t; uniform vec3 fogColor; uniform float fogDensity; varying vec3 vp; varying float vd;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
    void main(){
      vec2 p = vp.xz*.045;
      float r = length(vp.xz);
      vec2 chay = normalize(vp.xz+1e-3)*t*.035;           // chảy toả ra khỏi đảo
      float q = fbm(p*1.3 - chay + fbm(p*2.1 + t*.02));
      float vo = smoothstep(.36, .5, q);                  // vỏ nguội phủ phần lớn mặt
      float nut = 1. - smoothstep(.0, .035, abs(fbm(p*3.5 + t*.015) - .5));
      float nong = (1.-vo) + nut*.6*vo;
      float gan = smoothstep(95., 60., r)*.6;              // sát chân đảo sôi hơn
      vec3 c = mix(vec3(.045,.028,.024), vec3(1.25,.26,.03), nong);
      c = mix(c, vec3(1.8,.7,.12), pow(nong,5.)*(.25+gan*.6));
      c *= .85 + .3*n(p*9. + t*.6);
      float f = 1. - exp(-pow(fogDensity*vd, 2.));
      gl_FragColor = vec4(mix(c, fogColor, f*.85), 1.);
    }`,
  fog: false,
});
const dn = new THREE.Mesh(new THREE.CircleGeometry(1400, 64).rotateX(-Math.PI / 2), VL_DN); dn.position.y = -7.5; scene.add(dn);
const anhDn = new THREE.PointLight(0xff5a10, 22, 60, 1.4); anhDn.position.set(0, -4, 75); scene.add(anhDn);

// tia lửa bay lên từ dung nham
const SO_LUA = CHAM ? 500 : 1200;
const luaPos = new Float32Array(SO_LUA * 3), luaV = new Float32Array(SO_LUA);
const datLua = (i) => { const a = r() * Math.PI * 2, rr = giua(64, 160); luaPos[i * 3] = Math.cos(a) * rr; luaPos[i * 3 + 1] = -7 + r() * 2; luaPos[i * 3 + 2] = Math.sin(a) * rr; luaV[i] = giua(0.8, 3); };
for (let i = 0; i < SO_LUA; i++) { datLua(i); luaPos[i * 3 + 1] = -7 + r() * 30; }
const gLua = new THREE.BufferGeometry(); gLua.setAttribute('position', new THREE.BufferAttribute(luaPos, 3));
scene.add(new THREE.Points(gLua, new THREE.PointsMaterial({ map: T.cham(), size: 0.5, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

// cờ trên đỉnh tháp: lưới vải lay bằng sóng (CPU, rất ít đỉnh)
const co = [];
for (const [x, z, dinh] of cothap) {
  const cao = dinh + 2;
  const cot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6), VL.go); cot.position.set(x, cao, z); scene.add(cot);
  const g = new THREE.PlaneGeometry(2.4, 1.4, 12, 6); g.translate(1.2, 0, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: T.vai(r).map, side: THREE.DoubleSide, roughness: 1 }));
  m.position.set(x, cao + 1.4, z); m.rotation.y = 0.6; m.castShadow = true; scene.add(m);
  co.push({ g, goc: g.attributes.position.array.slice(), pha: r() * 6 });
}

// ---------- vật động: thùng gỗ, thùng tròn ở quảng trường — đẩy, ném đá đổ được
const dong = [];
const VL_THUNG = VL.go;
function themDong(mesh, desc, col) { mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); const b = world.createRigidBody(desc); world.createCollider(col, b); dong.push({ mesh, b }); return b; }
function thung(x, y, z, s = 0.8) { return themDong(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), VL_THUNG), RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z), RAPIER.ColliderDesc.cuboid(s / 2, s / 2, s / 2).setDensity(0.6).setFriction(0.8)); }
function thungTron(x, y, z) { return themDong(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.95, 14), VL_THUNG), RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z), RAPIER.ColliderDesc.cylinder(0.475, 0.38).setDensity(0.7).setFriction(0.7)); }
for (let k = 0; k < 6; k++) { // tháp thùng chồng quanh quảng trường
  const a = k / 6 * Math.PI * 2 + 0.4, cx = Math.cos(a) * 13.5, cz = Math.sin(a) * 13.5;
  for (let t = 0; t < 3; t++) for (let i = 0; i < 3 - t; i++) thung(cx + (i - (2 - t) / 2) * 0.84, 0.41 + t * 0.81, cz);
  for (let i = 0; i < 3; i++) thungTron(cx + giua(-1.5, 1.5), 0.5, cz + giua(1, 2));
}
for (let k = 0; k < 10; k++) { const a = r() * Math.PI * 2; thung(Math.cos(a) * giua(29, 33), 0.41, Math.sin(a) * giua(29, 33)); }
for (let k = 0; k < 6; k++) thung(giua(-2, 2), 0.41 + k * 0.81, 70); // chồng thùng trên cầu

const VL_SOI = VL.bazan; const soi = [];
function phongDa(o, d) {
  let s = soi.length >= 40 ? soi.shift() : null;
  if (!s) { const b = themDong(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), VL_SOI), RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setTranslation(o.x, o.y, o.z), RAPIER.ColliderDesc.ball(0.22).setDensity(9)); s = b; }
  s.setTranslation(o, true); s.setLinvel({ x: d.x * 24, y: d.y * 24 + 1.5, z: d.z * 24 }, true); s.setAngvel({ x: 0, y: 0, z: 0 }, true);
  soi.push(s);
}
// hướng ngắm: tia từ camera qua tâm màn hình (bỏ thân mình) → điểm trúng; đá bay từ tay tới đó
function huongNham(o) {
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const c = camera.position, h = world.castRay(new RAPIER.Ray({ x: c.x, y: c.y, z: c.z }, { x: d.x, y: d.y, z: d.z }), 80, true, undefined, undefined, thanVa);
  const dich = c.clone().addScaledVector(d, h ? Math.max(h.timeOfImpact, 2) : 80);
  return dich.sub(o).normalize();
}
function nem() {
  if (cheDo !== 'di' || toi.viec === 'nem' || toi.viec === 'da') return;
  muonHuong = yaw + Math.PI; // quay người theo hướng ngắm
  toi.lam('nem', () => { const o = toi.viTriTay(new THREE.Vector3()); const d = huongNham(o); phongDa(o.addScaledVector(d, 0.45), d); });
}
function da() { // đá chân: hất thùng / làm ngã người trước mặt
  if (cheDo !== 'di' || toi.viec) return;
  toi.lam('da', () => {
    const p = than.translation(), f = new THREE.Vector3(Math.sin(huongToi), 0, Math.cos(huongToi));
    const truoc = new THREE.Vector3(p.x, p.y - 0.6, p.z).addScaledVector(f, 0.9);
    for (const { b } of dong) { const t = b.translation(); if (Math.hypot(t.x - truoc.x, t.z - truoc.z) < 1.1 && Math.abs(t.y - truoc.y) < 1.2) { const m = b.mass(); b.applyImpulse({ x: f.x * 7 * m, y: 3.5 * m, z: f.z * 7 * m }, true); } }
    for (const d of dan) if (Math.hypot(d.x - truoc.x, d.z - truoc.z) < 1.1) d.n.lam('nga');
  });
}

// ---------- người đi bộ: thân hình viên nang + bộ điều khiển nhân vật Rapier
const NGUOI_R = 0.35, NGUOI_H = 0.55, MAT = 1.62;
const than = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
const thanVa = world.createCollider(RAPIER.ColliderDesc.capsule(NGUOI_H, NGUOI_R), than);
const dk = world.createCharacterController(0.03);
dk.enableAutostep(0.45, 0.25, false); dk.enableSnapToGround(0.4); dk.setMaxSlopeClimbAngle(0.9); dk.setApplyImpulsesToDynamicBodies(true); dk.setCharacterMass(70);
const DIEM_VAO = new THREE.Vector3(0, 1.2, 108);
// hình nhân vật của người chơi (khung xương + động tác sinh bằng mã)
const toi = taoNguoi({ da: MAU_DA[1], ao: 0x8a2a1e, quan: 0x2e2a26, toc: 0x1c120c });
toi.goc.visible = false; scene.add(toi.goc);
let gocNhin = 3, huongToi = 0, muonHuong = 0, tocToi = 0; // gocNhin 3 = sau lưng, 1 = mắt nhân vật
const gocLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const LOC_TINH = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;

// dân trong phố: đi vòng phố chính, dừng ngó nghiêng, chào khi mình tới gần, trúng đá / bị đá thì ngã rồi dậy
const dan = [];
for (let i = 0; i < 14; i++) {
  const n = taoNguoi({ da: MAU_DA[i % MAU_DA.length], ao: MAU_AO[i % MAU_AO.length], quan: [0x3a3530, 0x4a3a28, 0x2a2a3a][i % 3], toc: [0x2b1d14, 0x6a4a2a, 0x1a1a1a, 0x8a7a6a][i % 4], mu: i % 4 === 0 ? 0x5a3a20 : undefined, co: giua(0.92, 1.04) });
  scene.add(n.goc);
  const rr = i % 2 ? 29.6 : 32.6, a = r() * Math.PI * 2;
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(Math.cos(a) * rr, 0.85, Math.sin(a) * rr));
  world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), b);
  dan.push({ n, b, rr, a, chieu: r() < 0.5 ? 1 : -1, toc: giua(1.1, 1.6), dung: 0, hoiChao: 0, x: 0, z: 0 });
}
const quanNguoi = nguoiQuan({ taoNguoi, MAU_DA, MAU_AO, scene, world, RAPIER }, quan);
function buocDan(dt) {
  const p = than.translation();
  quanNguoi.capNhat(dt, cheDo === 'di' ? { x: p.x, z: p.z } : null);
  for (const d of dan) {
    d.hoiChao -= dt;
    let v = 0;
    const gan = cheDo === 'di' && Math.hypot(p.x - d.x, p.z - d.z) < 3.2;
    if (d.n.viec === 'nga') v = 0;
    else if (gan && d.hoiChao <= 0 && !d.n.viec) { d.dung = 2.6; d.hoiChao = 12; d.n.lam('chao'); d.nhin = Math.atan2(p.x - d.x, p.z - d.z); }
    else if (d.dung > 0) d.dung -= dt;
    else { v = d.toc; d.a += d.chieu * v * dt / d.rr; d.nhin = null; if (Math.random() < dt * 0.06) d.dung = 1.5 + Math.random() * 3; }
    d.x = Math.cos(d.a) * d.rr; d.z = Math.sin(d.a) * d.rr;
    const huong = d.nhin ?? Math.atan2(-Math.sin(d.a) * d.chieu, Math.cos(d.a) * d.chieu);
    d.n.goc.rotation.y = gocLerp(d.n.goc.rotation.y, huong, 1 - Math.exp(-dt * 6));
    d.n.goc.position.set(d.x, 0.02, d.z);
    d.b.setNextKinematicTranslation({ x: d.x, y: 0.85, z: d.z });
    for (const s of soi) { const t = s.translation(), lv = s.linvel(); if (Math.hypot(lv.x, lv.y, lv.z) > 4 && Math.hypot(t.x - d.x, t.z - d.z) < 0.55 && t.y < 2 && t.y > 0) d.n.lam('nga'); }
    d.n.capNhat(dt, { toc: v, nen: true });
  }
}

let cheDo = 'toan', yaw = Math.PI, pitch = 0, vy = 0, nen = false;
const phim = {};
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 8, 0); orbit.enableDamping = true; orbit.minDistance = 10; orbit.maxDistance = 320; orbit.maxPolarAngle = 1.48; orbit.zoomToCursor = true;

function vaoDiBo(dich) {
  const p = dich || DIEM_VAO;
  than.setTranslation({ x: p.x, y: p.y + NGUOI_H + NGUOI_R + 0.1, z: p.z }, true); vy = 0;
  yaw = dich ? Math.atan2(p.x, p.z) : 0; // nhìn về thành chính
  pitch = -0.15; cheDo = 'di'; orbit.enabled = false; huongToi = muonHuong = yaw + Math.PI; toi.goc.visible = gocNhin === 3;
  $('b-di').style.display = 'none'; $('b-toan').style.display = ''; $('tam').style.display = 'block';
  if (CHAM) { $('can').style.display = 'block'; $('cham').style.display = 'flex'; }
  else renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
}
function raToanCanh() {
  cheDo = 'toan'; orbit.enabled = true; toi.goc.visible = false; $('dung').style.display = 'none'; $('tam').style.display = 'none'; $('can').style.display = 'none'; $('cham').style.display = 'none';
  $('b-di').style.display = ''; $('b-toan').style.display = 'none';
  const p = camera.position.clone(); orbit.target.copy(p).add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(20)); camera.position.add(new THREE.Vector3(Math.sin(yaw) * 30, 25, Math.cos(yaw) * 30));
  if (document.pointerLockElement) document.exitPointerLock();
}
$('b-di').onclick = () => vaoDiBo(); $('b-toan').onclick = raToanCanh; $('b-ra').onclick = raToanCanh;
$('b-tiep').onclick = () => { $('dung').style.display = 'none'; renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); };
// âm thanh: chỉ bật sau cú bấm đầu tiên (luật trình duyệt); nút 🔇 tắt/mở
let am = null, tatAm = false;
const batAm = () => { if (am || tatAm) return; try { am = taoAmThanh(); am.gan(quan); } catch (e) { console.warn('[castle] không bật được âm thanh', e); } };
addEventListener('pointerdown', batAm); addEventListener('keydown', batAm);
$('b-am').onclick = (e) => { e.stopPropagation(); tatAm = !tatAm; $('b-am').textContent = tatAm ? '🔇' : '🔊'; if (am) am.tat(tatAm); else batAm(); };
let tuongTac = 0; for (const ev of ['pointermove', 'wheel', 'keydown', 'touchmove']) addEventListener(ev, () => { tuongTac = performance.now(); }, { passive: true });
$('b-moi').onclick = () => { thamSo.set('h', Math.floor(Math.random() * 1e6)); location.search = thamSo.toString(); };

const tia = new THREE.Raycaster();
renderer.domElement.addEventListener('dblclick', (e) => {
  if (cheDo !== 'toan') return;
  tia.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1), camera);
  const h = tia.intersectObjects(dat)[0]; if (h && h.point.y > -1) vaoDiBo(h.point);
});
let chamCuoi = 0; // chạm đúp trên điện thoại
renderer.domElement.addEventListener('touchend', (e) => {
  if (cheDo !== 'toan' || e.changedTouches.length !== 1) return;
  const now = performance.now(), t = e.changedTouches[0];
  if (now - chamCuoi < 320) { tia.setFromCamera(new THREE.Vector2(t.clientX / innerWidth * 2 - 1, -t.clientY / innerHeight * 2 + 1), camera); const h = tia.intersectObjects(dat)[0]; if (h && h.point.y > -1) vaoDiBo(h.point); }
  chamCuoi = now;
});
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && cheDo === 'di' && !CHAM) $('dung').style.display = 'grid'; });
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement !== renderer.domElement) return; yaw -= e.movementX * 0.0022; pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.0022)); });
renderer.domElement.addEventListener('mousedown', () => { if (cheDo === 'di' && document.pointerLockElement) nem(); });
function doiGocNhin() { gocNhin = gocNhin === 3 ? 1 : 3; toi.goc.visible = cheDo === 'di' && gocNhin === 3; }
addEventListener('keydown', (e) => {
  phim[e.code] = true; if (cheDo !== 'di' || e.repeat) return;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyV') doiGocNhin();
  if (e.code === 'Digit1') toi.lam('chao');
  if (e.code === 'Digit2') toi.lam('mua');
  if (e.code === 'KeyF') da();
});
addEventListener('keyup', (e) => { phim[e.code] = false; });

// cần điều khiển + kéo nhìn trên điện thoại
const can = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, nhin = { id: null, x: 0, y: 0 };
const cuc = $('can').querySelector('i');
$('can').addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; can.id = t.identifier; const b = $('can').getBoundingClientRect(); can.x = b.left + b.width / 2; can.y = b.top + b.height / 2; e.preventDefault(); }, { passive: false });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === can.id) { let dx = t.clientX - can.x, dy = t.clientY - can.y; const l = Math.hypot(dx, dy); if (l > 50) { dx *= 50 / l; dy *= 50 / l; } can.dx = dx / 50; can.dy = dy / 50; cuc.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (t.identifier === nhin.id) { yaw -= (t.clientX - nhin.x) * 0.005; pitch = Math.max(-1.4, Math.min(1.4, pitch - (t.clientY - nhin.y) * 0.005)); nhin.x = t.clientX; nhin.y = t.clientY; }
  }
}, { passive: true });
renderer.domElement.addEventListener('touchstart', (e) => { if (cheDo !== 'di') return; const t = e.changedTouches[0]; if (nhin.id === null) { nhin.id = t.identifier; nhin.x = t.clientX; nhin.y = t.clientY; } }, { passive: true });
addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === can.id) { can.id = null; can.dx = can.dy = 0; cuc.style.transform = ''; } if (t.identifier === nhin.id) nhin.id = null; } });
$('b-nhay').addEventListener('touchstart', (e) => { e.preventDefault(); if (nen) vy = 5.2; }, { passive: false });
for (const [id, f] of [['b-nem', nem], ['b-chao', () => toi.lam('chao')], ['b-mua', () => toi.lam('mua')], ['b-da', da], ['b-goc', doiGocNhin]])
  $(id).addEventListener('touchstart', (e) => { e.preventDefault(); f(); }, { passive: false });

// ---------- hậu kỳ
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.35, 1.0); composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---------- vòng chạy
const dongHo = new THREE.Clock(); let tichLuy = 0; const BUOC = 1 / 60;
function buocDiBo(dt) {
  const dang = cheDo === 'di' && (CHAM || THU || document.pointerLockElement);
  let fx = 0, fz = 0;
  if (dang) {
    fz = (phim.KeyW || phim.ArrowUp ? 1 : 0) - (phim.KeyS || phim.ArrowDown ? 1 : 0) - can.dy;
    fx = (phim.KeyD || phim.ArrowRight ? 1 : 0) - (phim.KeyA || phim.ArrowLeft ? 1 : 0) + can.dx;
    const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
    if (phim.Space && nen) vy = 5.2;
  }
  if (toi.viec === 'mua' || toi.viec === 'chao') { if (fx || fz) toi.lam('dung'); } // bước đi thì thôi múa / chào
  const v = phim.KeyC ? 1.6 : phim.ShiftLeft || phim.ShiftRight ? 8 : 4.2;
  if (fx || fz) muonHuong = Math.atan2(-Math.sin(yaw) * fz + Math.cos(yaw) * fx, -Math.cos(yaw) * fz - Math.sin(yaw) * fx);
  const sx = Math.sin(yaw), cz = Math.cos(yaw);
  const mx = (-sx * fz + cz * fx) * v * dt, mz = (-cz * fz - sx * fx) * v * dt;
  vy = nen && vy <= 0 ? -1 : vy - 9.81 * dt;
  dk.computeColliderMovement(thanVa, { x: mx, y: vy * dt, z: mz });
  const m = dk.computedMovement(), p = than.translation();
  than.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  tocToi += (Math.hypot(m.x, m.z) / dt - tocToi) * 0.25;
  nen = dk.computedGrounded();
  if (p.y < -6) vaoDiBo(); // rơi xuống dung nham → về đầu cầu
}
let lanVe = 0, demCham = 0, demKhung = 0, mocDo = 0;
function vong(now = 0) {
  requestAnimationFrame(vong);
  // trần khung hình: đi bộ / đang thao tác 60 · để yên toàn cảnh 30 · cửa sổ không được chọn 10 (màn 120 Hz không vẽ gấp đôi)
  const khoang = !document.hasFocus() ? 100 : cheDo === 'di' || now - tuongTac < 4000 ? 1000 / 60 : 1000 / 30;
  if (now - lanVe < khoang - 3) return;
  const cach = now - lanVe; lanVe = now;
  // tự hạ độ phân giải khi máy không kịp 60 (đo 2 giây một lần lúc đang ở nhịp 60)
  if (khoang < 20) { demKhung++; if (cach > 24) demCham++; if (now - mocDo > 2000) { if (demCham > demKhung * 0.3 && doNet > 0.7) { doNet = Math.max(0.7, doNet - 0.15); renderer.setPixelRatio(doNet); composer.setPixelRatio?.(doNet); } demCham = demKhung = 0; mocDo = now; } }
  const dt = Math.min(dongHo.getDelta(), 0.1), t = dongHo.elapsedTime;
  tichLuy += dt;
  while (tichLuy >= BUOC) { if (cheDo === 'di') buocDiBo(BUOC); buocDan(BUOC); world.step(); tichLuy -= BUOC; }
  for (const { mesh, b } of dong) { const p = b.translation(), q = b.rotation(); mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(q.x, q.y, q.z, q.w); if (p.y < -9) { b.setTranslation({ x: p.x, y: -200, z: p.z }, false); b.sleep(); } }
  if (cheDo === 'di') {
    const p = than.translation(), chan = p.y - NGUOI_H - NGUOI_R;
    if (gocNhin === 1) muonHuong = yaw + Math.PI;
    huongToi = gocLerp(huongToi, muonHuong, 1 - Math.exp(-dt * 10));
    toi.goc.position.set(p.x, chan, p.z); toi.goc.rotation.y = huongToi;
    toi.capNhat(dt, { toc: tocToi, nen, ngoi: !!phim.KeyC });
    if (gocNhin === 1) { camera.position.set(p.x, chan + MAT, p.z); camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
    else { // camera sau vai phải, lùi vào khi vướng tường
      const pt = Math.max(-1.1, Math.min(0.75, pitch));
      const dich = new THREE.Vector3(p.x + Math.cos(yaw) * 0.45, chan + (phim.KeyC ? 1.05 : 1.6), p.z - Math.sin(yaw) * 0.45);
      const lui = new THREE.Vector3(Math.sin(yaw) * Math.cos(pt), -Math.sin(pt), Math.cos(yaw) * Math.cos(pt));
      const h = world.castRay(new RAPIER.Ray(dich, lui), 3.6, true, LOC_TINH, undefined, thanVa);
      const kc = h ? Math.max(0.4, h.timeOfImpact - 0.25) : 3.6;
      camera.position.copy(dich).addScaledVector(lui, kc);
      camera.lookAt(dich.x - lui.x, dich.y - lui.y, dich.z - lui.z);
    }
  }
  else orbit.update();
  VL_DN.uniforms.t.value = t; VL_TROI.uniforms.t.value = t; troi.position.copy(camera.position);
  for (let i = 0; i < SO_LUA; i++) { luaPos[i * 3 + 1] += luaV[i] * dt; luaPos[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.4; if (luaPos[i * 3 + 1] > 30) datLua(i); }
  gLua.attributes.position.needsUpdate = true;
  for (const c of co) { const a = c.g.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const x = c.goc[i]; a[i + 2] = Math.sin(x * 2.2 - t * 5 + c.pha) * 0.18 * x; a[i + 1] = c.goc[i + 1] - x * 0.06 + Math.sin(x * 1.7 - t * 3.3) * 0.05 * x; } c.g.attributes.position.needsUpdate = true; c.g.computeVertexNormals(); }
  anhDn.intensity = 20 + Math.sin(t * 2.1) * 6 + Math.sin(t * 5.3) * 3;
  quan.capNhat(dt, t);
  if (am) { const p = camera.position; am.capNhat(camera, quan.trong(p.x, p.z), Math.hypot(p.x - quan.tam[0], p.z - quan.tam[1])); }
  composer.render();
}
$('tai').remove();
window.__lauDai = { hat: HAT, soLuoi: scene.children.length, soVatDong: dong.length, soNha: nhaVa.length, vaoDiBo, raToanCanh, camera, than, nem, phim, dong, datHuong: (y, p) => { yaw = y; pitch = p; }, toi, dan, da, doiGocNhin, quan, quanNguoi, doNet: () => doNet };
vong();
