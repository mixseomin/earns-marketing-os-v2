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
import { taoNguoi, MAU_DA, MAU_AO, phan, dangKyGoc, chotNguoi, veNguoi, LOD, DEM } from './nhanvat.js';
import { dungCongTrinh, taoDongHo, taoSongDong } from './songdong.js';
import { dungNhaQuan, nguoiQuan } from './quan.js';
import { taoAmThanh } from './amthanh.js';
import { taoBanDo } from './bando.js';
import { dungNgua, dungXe } from './phuongtien.js';
import { napNguoi3d, taoNguoi3d } from './nguoi3d.js';
import { taoDiBo } from './dibo.js';

const $ = (id) => document.getElementById(id);
const thamSo = new URLSearchParams(location.search);
// nhớ chỗ đang đứng: F5 / mở lại thì về đúng lâu đài, đúng chỗ, đúng hướng, đúng giờ (lưu trong trình duyệt người xem)
const KHOA_LUU = 'castle-cho-dung-v1';
const docLuu = () => { try { return JSON.parse(localStorage.getItem(KHOA_LUU) || 'null'); } catch { return null; } };
const LUU = docLuu();
const HAT = Number(thamSo.get('h')) || LUU?.hat || Math.floor(Math.random() * 1e6);
if (!thamSo.get('h')) { thamSo.set('h', HAT); try { history.replaceState(null, '', '?' + thamSo.toString()); } catch {} }
const r = T.rngTu(HAT);
const giua = (a, b) => a + r() * (b - a);
const THU = thamSo.has('thu'); // bộ kiểm tự động: không ghi chỗ đứng
const CHAM = matchMedia('(hover: none)').matches || 'ontouchstart' in window;

try { await RAPIER.init(); } catch (e) { $('tai').innerHTML = '<div class="loi">Không nạp được bộ vật lý. Tải lại trang thử lần nữa.</div>'; throw e; }

// ---------- khung dựng
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let doNet = Math.min(devicePixelRatio, CHAM ? 1.1 : 1.25); // Retina 2–3x vẽ đủ điểm ảnh là nóng máy (MacBook 14/11/2026)
renderer.setPixelRatio(doNet);
renderer.setSize(innerWidth, innerHeight);
renderer.info.autoReset = false; // đếm lệnh vẽ cả khung (nhiều lượt hậu kỳ)
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
  uniforms: { nang: { value: huongNang }, t: { value: 0 }, dem: { value: 0 } },
  vertexShader: `varying vec3 vd; void main(){ vd = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 nang; uniform float t; uniform float dem; varying vec3 vd;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.1; a*=.5; } return s; }
    void main(){
      vec3 d = normalize(vd); float y = d.y;
      // ban ngày khói cam; ban đêm xanh đen, chân trời đỏ ánh dung nham (dem: 0 ngày → 1 đêm)
      vec3 chan = mix(vec3(.72,.42,.28), vec3(.26,.08,.05), dem), giua = mix(vec3(.42,.34,.40), vec3(.05,.035,.06), dem), dinh = mix(vec3(.22,.26,.40), vec3(.008,.01,.028), dem);
      vec3 c = mix(chan, giua, smoothstep(0., .22, y)); c = mix(c, dinh, smoothstep(.2, .75, y));
      if (y < 0.) c = mix(chan, vec3(.35,.12,.05), smoothstep(0., -.2, y));
      vec3 hn = normalize(nang);
      float sd = max(dot(d, hn), 0.), tr = max(dot(d, -hn), 0.);
      c += (vec3(1.,.55,.25)*pow(sd, 12.)*.55 + vec3(1.,.8,.55)*pow(sd, 400.)*3.) * (1.-dem*.9);
      c += vec3(.75,.8,.95)*(pow(tr, 900.)*2.5 + pow(tr, 30.)*.08)*dem; // trăng
      vec2 g = floor(vec2(atan(d.z, d.x), asin(clamp(y,-1.,1.)))*140.);
      c += vec3(1.,.95,.9) * step(.9965, h(g)) * smoothstep(.06,.35,y) * dem * (.55+.45*sin(t*2.7+h(g+3.)*60.)); // sao
      vec2 uv = d.xz/(abs(y)+.12);
      float may = fbm(uv*1.4 + vec2(t*.006, t*.002));
      float lop = smoothstep(.45, .8, may) * smoothstep(-.02, .12, y) * (1.-smoothstep(.5,.9,y));
      c = mix(c, mix(vec3(.16,.09,.08) + vec3(.5,.22,.08)*smoothstep(.25,0.,y)*.6 + vec3(.6,.3,.15)*pow(sd,6.)*.6, vec3(.03,.02,.025) + vec3(.25,.07,.02)*smoothstep(.25,0.,y), dem), lop*.75);
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
const ban = new THREE.HemisphereLight(0x9a8aa8, 0xb8501e, 1.1); scene.add(ban);

// ---------- vật liệu (bề mặt vẽ bằng mã)
const vl = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: o.bump ?? 2, roughness: o.ro ?? 0.9, metalness: 0, emissiveMap: t.emis || null, emissive: t.emis ? 0xffffff : 0x000000, emissiveIntensity: t.emis ? 2.2 : 0, ...(o.color ? { color: o.color } : {}) });
const VL = {
  da: vl(T.daXay(r, 30, 54)), daTrong: vl(T.daXay(r, 24, 46)), bazan: vl(T.bazan(r), { bump: 4 }), cuoi: vl(T.cuoi(r), { bump: 3 }),
  ngoi: vl(T.ngoi(r, 10)), ngoiXanh: vl(T.ngoi(r, 205), { ro: 0.7 }), vua: vl(T.vuaGo(r)), go: vl(T.van(r)), co: vl(T.co(r), { bump: 1.5 }),
};
const DO_UV = { da: 5, daTrong: 5, bazan: 9, cuoi: 4, ngoi: 3, ngoiXanh: 3, vua: 6, go: 2, co: 5 };

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
// Dựng khối = vẽ + VA CHẠM cùng hình, trong một lệnh. Trước 15/11/2026 va chạm phải gọi tay riêng (vaHop / vaTru) nên mái nhà, mái tháp,
// gờ răng cưa, ống khói không có va chạm: đi xuyên qua, trèo lên nóc thì bị đặt vào trong mái. TU_VA = false chỉ khi dựng đồ trong nhà
// (quán, sạp chợ tự gọi vaHop cho đúng chỗ cần chặn; cốc, chai, ghế không chặn đường).
let TU_VA = true;
const vaLoi = (pts) => { const d = RAPIER.ColliderDesc.convexHull(new Float32Array(pts)); if (d) world.createCollider(d, tinh); };
function hop(vlk, w, h, d, x, y, z, ry = 0) { dat_(vlk, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry); if (TU_VA) vaHop(w, h, d, x, y, z, ry); }
function tru(vlk, rt, rb, h, x, y, z, seg = 24) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false); uvTru(g, Math.PI * 2 * Math.max(rt, rb), h, DO_UV[vlk]); dat_(vlk, g, x, y + h / 2, z, 0, 'tru');
  if (!TU_VA) return;
  if (Math.abs(rt - rb) < 0.05) vaTru(Math.max(rt, rb), h, x, y, z);
  else { const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(x + Math.cos(a) * rb, y, z + Math.sin(a) * rb, x + Math.cos(a) * rt, y + h, z + Math.sin(a) * rt); } vaLoi(pts); }
}
function non(vlk, rr, h, x, y, z, seg = 24) { // mái chóp: luôn có va chạm (cả mái sạp / quán)
  const g = new THREE.ConeGeometry(rr, h, seg, 1, true); uvTru(g, Math.PI * 2 * rr, Math.hypot(rr, h), DO_UV[vlk]); dat_(vlk, g, x, y + h / 2, z, 0, 'tru');
  world.createCollider(RAPIER.ColliderDesc.cone(h / 2, rr).setTranslation(x, y + h / 2, z), tinh);
}
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
  const c = Math.cos(ry), s_ = Math.sin(ry), pts = []; // mái hai mái: luôn có va chạm (khối lồi 6 đỉnh)
  for (const [px, py, pz] of [[-a, 0, b], [a, 0, b], [-a, 0, -b], [a, 0, -b], [-a, h, 0], [a, h, 0]]) pts.push(x + px * c + pz * s_, y + py, z - px * s_ + pz * c);
  vaLoi(pts);
}
function dungLuoi() {
  for (const [k, gs] of Object.entries(xo)) {
    const m = new THREE.Mesh(mergeGeometries(gs), VL[k]); m.castShadow = m.receiveShadow = true; scene.add(m);
    if (k === 'cuoi' || k === 'go' || k === 'co') dat.push(m);
  }
}

// ---------- vật lý
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const tinh = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
// nhóm va chạm: rào vô hình quanh hồ chỉ chặn ngựa / xe (người vẫn nhảy xuống bơi được). nhóm = (thuộc << 16) | chạm-với
const NHOM_NGUOI = (0x0001 << 16) | 0xfffd, NHOM_XE = (0x0004 << 16) | 0xffff, NHOM_RAO = (0x0002 << 16) | 0x0004;
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
    hop('da', l, CAO_TUONG, DAY_TUONG, x, 0, z, ry);
    const nx = -uz, nz = ux; // pháp tuyến ngang của đoạn
    for (let s = s0 + 0.8; s < s1 - 0.5; s += 1.9) for (const bo of [-1, 1]) hop('da', 1, 1.3, 0.7, cx + ux * s + nx * bo * (DAY_TUONG / 2 - 0.35), CAO_TUONG, cz + uz * s + nz * bo * (DAY_TUONG / 2 - 0.35), ry);
  }
  if (coCong) { // vòm cổng + hai tháp canh nhỏ
    hop('daTrong', 7, 3, DAY_TUONG + 1, cx, CAO_TUONG - 3, cz, ry);
    for (const bo of [-1, 1]) { const x = cx + ux * bo * 5, z = cz + uz * bo * 5; tru('daTrong', 2.2, 2.4, CAO_TUONG + 4, x, 0, z, 16); non('ngoi', 3, 4.5, x, CAO_TUONG + 4.4, z, 16); }
  }
}

// cầu đá ra khỏi đảo, kết bằng sân tròn (chỗ bắt đầu đi bộ)
{
  const z0 = R_TUONG + 1, z1 = 104, L = z1 - z0, zc = (z0 + z1) / 2;
  hop('daTrong', 6, 1.6, L, 0, -1.6, zc);
  dat_('go', new THREE.BoxGeometry(5.2, 0.1, L), 0, 0.05, zc);
  for (const bo of [-1, 1]) { hop('daTrong', 0.6, 1.1, L, bo * 2.8, 0, zc); }
  for (let z = R_DAO + 10; z < z1; z += 11) tru('bazan', 1.6, 2.2, 10, 0, -11.5, z, 12);
  tru('daTrong', 9, 9.5, 2, 0, -2, z1 + 6, 40);
  dat_('cuoi', new THREE.CircleGeometry(8.9, 40).rotateX(-Math.PI / 2), 0, 0.03, z1 + 6);
}

// thành chính giữa đảo
{
  const rk = 10, hk = 24;
  tru('daTrong', rk, rk + 0.6, hk, 0, 0, 0, 40);
  for (let k = 0; k < 24; k++) { const b = k / 24 * Math.PI * 2; hop('daTrong', 1.2, 1.4, 1, Math.cos(b) * rk, hk, Math.sin(b) * rk, -b); }
  non('ngoiXanh', rk - 1.5, 12, 0, hk, 0, 40); tru('daTrong', rk - 1.4, rk - 1.4, 0.8, 0, hk, 0, 40);
  for (let k = 0; k < 4; k++) { const b = k / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(b) * rk, z = Math.sin(b) * rk; tru('da', 2.6, 2.8, hk + 7, x, 0, z, 16); non('ngoi', 3.4, 6, x, hk + 7, z, 16); cothap.push([x, z, hk + 13]); }
  hop('go', 3.4, 4.6, 0.4, 0, 0, rk + 0.45); // cửa gỗ
}

// phố: hai vành nhà quanh vành đường r≈31, chừa 4 phố hướng tâm
const PHO = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
const GOC_QUAN = Math.PI / 2 + 0.42, R_QUAN = 41.5, TAM_QUAN = [Math.cos(GOC_QUAN) * R_QUAN, Math.sin(GOC_QUAN) * R_QUAN]; // quán rượu cạnh phố cổng
const nhaVa = [], ongKhoi = [];
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
        hop('vua', w, h, d, x, 0, z, ry);
        maiDoc(r() < 0.8 ? 'ngoi' : 'ngoiXanh', w + 0.8, d + 1.2, giua(2, 3.2), x, h, z, ry);
        if (r() < 0.5) { const o = giua(-w / 3, w / 3), ox = x + Math.cos(-ry) * o, oz = z + Math.sin(-ry) * o; hop('da', 0.7, 2.2, 0.7, ox, h + 0.6, oz, ry); ongKhoi.push([ox, h + 2.9, oz]); }
        nhaVa.push([x, z, am, hang]);
      }
      a += da + giua(0.4, 1.8) / hang;
    }
  }
}

// đèn đường dọc vành phố: cột gỗ + đèn lồng phát sáng, vài đèn thật đổ sáng
const VL_DEN = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb060, emissiveIntensity: 4 });
const gDen = [], denDuong = [];
for (let k = 0; k < 28; k++) {
  const a = k / 28 * Math.PI * 2 + 0.06, x = Math.cos(a) * 31, z = Math.sin(a) * 31;
  hop('go', 0.22, 3.2, 0.22, x, 0, z);
  gDen.push(new THREE.BoxGeometry(0.42, 0.55, 0.42).translate(x, 3.45, z));
  if (k % 7 === 0) { const l = new THREE.PointLight(0xffa050, 18, 16, 1.8); l.position.set(x, 3.6, z); scene.add(l); denDuong.push(l); }
}
scene.add(new THREE.Mesh(mergeGeometries(gDen), VL_DEN));
// bãi cỏ cạnh sân đầu cầu (phía đông) + hồ nước sâu để bơi; chỗ cưỡi ngựa / lái xe ngựa
const BAI = { x: 26.5, z: 110, r: 17 }, HO = { x: 30, z: 111, r: 6.5, mat: -0.3, day: -2.8 };
{
  const hinh = new THREE.Shape(); hinh.absarc(0, 0, BAI.r, 0, Math.PI * 2, false);
  const lo = new THREE.Path(); lo.absarc(HO.x - BAI.x, -(HO.z - BAI.z), HO.r, 0, Math.PI * 2, true); hinh.holes.push(lo);
  const g = new THREE.ShapeGeometry(hinh, 64); g.rotateX(-Math.PI / 2); g.translate(BAI.x, 0.02, BAI.z);
  const v = g.attributes.position.array, idx = g.index.array;
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(v), new Uint32Array(idx)), tinh);
  dat_('co', g, 0, 0, 0);
  { const g = new THREE.CylinderGeometry(BAI.r, BAI.r - 3, 12, 48, 1, true); uvTru(g, Math.PI * 2 * BAI.r, 12, DO_UV.bazan); dat_('bazan', g, BAI.x, -6, BAI.z, 0, 'tru'); } // vách đá, hở nắp (nắp kín sẽ che miệng hồ)
  // lòng hồ: thành đá (nhìn từ trong), đáy, va chạm thành + đáy
  const tg = new THREE.CylinderGeometry(HO.r, HO.r, -HO.day, 48, 1, true); tg.translate(HO.x, HO.day / 2, HO.z);
  const vlThanh = VL.daTrong.clone(); vlThanh.side = THREE.BackSide;
  const thanh = new THREE.Mesh(tg, vlThanh); thanh.receiveShadow = true; scene.add(thanh);
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(tg.attributes.position.array), new Uint32Array(tg.index.array)), tinh);
  dat_('daTrong', new THREE.CircleGeometry(HO.r, 48).rotateX(-Math.PI / 2), HO.x, HO.day, HO.z);
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.5, HO.r).setTranslation(HO.x, HO.day - 0.5, HO.z), tinh);
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; hop('daTrong', 1.5, 0.25, 0.6, HO.x + Math.cos(a) * (HO.r + 0.3), 0, HO.z + Math.sin(a) * (HO.r + 0.3), -a + Math.PI / 2); } // bờ đá
}
const VL_NUOC = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { t: { value: 0 }, sang: { value: 1 } },
  vertexShader: `varying vec3 vp; varying vec3 vv; void main(){ vec4 w = modelMatrix*vec4(position,1.); vp=w.xyz; vv=cameraPosition-w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float t; uniform float sang; varying vec3 vp; varying vec3 vv;
    void main(){ vec2 p=vp.xz; float g = sin(p.x*2.1+t*1.7)*sin(p.y*1.7-t*1.3)+sin((p.x+p.y)*3.3+t*2.4)*.5;
      vec3 n = normalize(vec3(cos(p.x*2.1+t*1.7)*.12, 1., cos((p.x+p.y)*3.3+t*2.4)*.1));
      float fr = pow(1.-max(dot(normalize(vv), n),0.), 3.);
      vec3 c = mix(vec3(.04,.22,.3), vec3(.28,.42,.5), fr) + vec3(.9,.85,.7)*pow(max(g,0.),8.)*.12;
      gl_FragColor = vec4(c*sang, .9+fr*.08); }`,
});
{ const g = new THREE.CylinderGeometry(HO.r + 0.9, HO.r + 0.9, 1.6, 32, 1, true); g.translate(HO.x, 0.8, HO.z); // rào vô hình cho ngựa / xe
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array), new Uint32Array(g.index.array)).setCollisionGroups(NHOM_RAO), tinh); }
{ const m = new THREE.Mesh(new THREE.CircleGeometry(HO.r, 48).rotateX(-Math.PI / 2), VL_NUOC); m.position.set(HO.x, HO.mat, HO.z); m.renderOrder = 2; scene.add(m); }
const mucNuoc = (x, z) => Math.hypot(x - HO.x, z - HO.z) < HO.r ? HO.mat : null;
TU_VA = false; // đồ trong nhà / sạp: tự gọi vaHop chỗ cần chặn
const ct = dungCongTrinh({ hop, tru, non, vaHop, vaTru, scene, mergeGeometries });
const quan = dungNhaQuan({ hop, tru, maiDoc, dat_, vaHop, vaTru, scene, mergeGeometries, chamLua: T.cham() }, GOC_QUAN, R_QUAN);
TU_VA = true;
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
for (const a of [1.0, 1.55, 2.6, 4.2, 4.9, 5.4]) thung(Math.cos(a) * giua(29.2, 30.4), 0.41, Math.sin(a) * giua(29.2, 30.4)); // chừa chợ (đông), lò rèn (tây), lối quán
for (let k = 0; k < 6; k++) thung(giua(-2, 2), 0.41 + k * 0.81, 70); // chồng thùng trên cầu

const VL_SOI = VL.bazan; const soi = [];
function phongDa(o, d) {
  let s = soi.length >= 40 ? soi.shift() : null;
  if (!s) { const b = themDong(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), VL_SOI), RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setTranslation(o.x, o.y, o.z), RAPIER.ColliderDesc.ball(0.22).setDensity(9)); s = b; }
  s.setTranslation(o, true); s.setLinvel({ x: d.x * 24, y: d.y * 24 + 1.5, z: d.z * 24 }, true); s.setAngvel({ x: 0, y: 0, z: 0 }, true);
  soi.push(s);
}
const tiaNem = new THREE.Raycaster();
// hướng ngắm: tia từ camera qua chỗ nhấp (hoặc tâm màn hình) (bỏ thân mình) → điểm trúng; đá bay từ tay tới đó
function huongNham(o, sx, sy) {
  const d = new THREE.Vector3();
  if (sx == null) camera.getWorldDirection(d);
  else { tiaNem.setFromCamera(new THREE.Vector2(sx / innerWidth * 2 - 1, -sy / innerHeight * 2 + 1), camera); d.copy(tiaNem.ray.direction); }
  const c = camera.position, h = world.castRay(new RAPIER.Ray({ x: c.x, y: c.y, z: c.z }, { x: d.x, y: d.y, z: d.z }), 80, true, undefined, NHOM_NGUOI, thanVa);
  const dich = c.clone().addScaledVector(d, h ? Math.max(h.timeOfImpact, 2) : 80);
  return dich.sub(o).normalize();
}
function nem(sx, sy) {
  if (cheDo !== 'di' || cuoi || toi.viec === 'nem' || toi.viec === 'da') return;
  { const d = huongNham(camera.position.clone(), sx, sy); di.quayVe(Math.atan2(d.x, d.z)); } // quay người theo hướng ném
  toi.lam('nem', () => { const o = toi.viTriTay(new THREE.Vector3()); const d = huongNham(o, sx, sy); phongDa(o.addScaledVector(d, 0.45), d); });
}
function da() { // đá chân: hất thùng / làm ngã người trước mặt
  if (cheDo !== 'di' || cuoi || toi.viec) return;
  toi.lam('da', () => {
    const p = than.translation(), f = new THREE.Vector3(Math.sin(di.huong), 0, Math.cos(di.huong));
    const truoc = new THREE.Vector3(p.x, p.y - 0.6, p.z).addScaledVector(f, 0.9);
    for (const { b } of dong) { const t = b.translation(); if (Math.hypot(t.x - truoc.x, t.z - truoc.z) < 1.1 && Math.abs(t.y - truoc.y) < 1.2) { const m = b.mass(); b.applyImpulse({ x: f.x * 7 * m, y: 3.5 * m, z: f.z * 7 * m }, true); } }
    sd.biDa(truoc.x, truoc.z);
  });
}

// ---------- người đi bộ: mô-đun chung dibo.js (thân viên nang + bộ điều khiển nhân vật Rapier, leo, bơi, camera) — tạo sau `phim`
const DIEM_VAO = new THREE.Vector3(0, 1.2, 108);
// hình nhân vật của người chơi (khung xương + động tác sinh bằng mã)
// người chơi: người mẫu có xương + 24 động tác thật (nguoi3d.js, CC0 Quaternius); tải lỗi thì lùi về khung xương vẽ bằng mã
let toi;
try { await napNguoi3d(); toi = taoNguoi3d(); } catch (e) { console.warn('[castle] không nạp được người 3D, dùng khung xương vẽ bằng mã', e); toi = taoNguoi({ da: MAU_DA[1], ao: 0x8a2a1e, quan: 0x2e2a26, toc: 0x1c120c }); }
const chauToi = (tuThe) => (toi.chau ? toi.chau(tuThe) : 0.95); // độ cao xương chậu theo tư thế (khung xương cũ: hông ở 0,95 m)
toi.goc.visible = false; scene.add(toi.goc);
const LOC_TINH = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;

// đời sống: đồng hồ ngày–đêm + người dân có nhà/nghề/lịch, chợ, lò rèn, giếng, lính tuần, thú, chim, khói
const gioGame = taoDongHo({ nang, ban, troi: VL_TROI, scene, VL, VL_DEN, denDuong, renderer }, 17.5);
const quanNguoi = nguoiQuan({ taoNguoi, MAU_DA, MAU_AO, scene, world, RAPIER }, quan);
const sd = taoSongDong({ scene, world, RAPIER, taoNguoi, MAU_DA, MAU_AO, phan, dangKyGoc, camera, quan, quanNguoi, nhaVa, ongKhoi, ct, dongHo: gioGame, R_QUAN, GOC_QUAN, chamLua: T.cham() });
const cocToi = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.13, 10), new THREE.MeshStandardMaterial({ color: 0x6a4424 })); cocToi.position.set(0, -0.06, 0.05); cocToi.visible = false; toi.cam(cocToi);
chotNguoi(scene); LOD.cam = camera;
function buocDan(dt) {
  const p = than.translation();
  quanNguoi.capNhat(dt, cheDo === 'di' ? { x: p.x, z: p.z } : null);
  sd.capNhat(dt, { p, diBo: cheDo === 'di', soi, am, nhanh: gioGame.nhanh });
}

let cheDo = 'toan';
const phim = {};
const di = taoDiBo({
  RAPIER, world, camera, dom: renderer.domElement, toi, phim, nhomVa: NHOM_NGUOI, mucNuoc: (x, z) => mucNuoc(x, z),
  layTruc: () => { const t = { dx: can.dx, dy: can.dy, nhay: !!can.nhay }; can.nhay = false; return t; }, // cần + nút Nhảy trên điện thoại
  khiNhap: (x, y) => nem(x, y), // nhấp nhanh = ném đá về chỗ nhấp
  stThem: () => ({ loop: sd.dangUong() ? 'uong' : null }),
  ngoai: {
    buoc(dt, tr) { // cưỡi ngựa / lái xe: phương tiện tự điều khiển bước này
      if (!toi.la3d && (toi.viec === 'mua' || toi.viec === 'chao') && (tr.fx || tr.fz)) toi.lam('dung'); // khung xương cũ: bước đi thì thôi múa / chào
      if (!cuoi) return false; buocXe(cuoi, dt, tr); return true;
    },
    khung() { // người ngồi trên yên / ghế xe + gốc camera theo chỗ ngồi, lùi camera xa hơn
      if (!cuoi) return null; const g = cuoi.vo.goc;
      if (cuoi.kieu === 'ngua') { const y = g.position.y + cuoi.vo.than.position.y + 0.5 - chauToi('cuoi'); return { x: g.position.x, y, z: g.position.z, huong: cuoi.huong, tuThe: 'cuoi', chanCam: y + 0.55, kcMax: 5.2 }; }
      const v = new THREE.Vector3(0, cuoi.vo.ghe.y - chauToi('lai') + 0.05, cuoi.vo.ghe.z); g.localToWorld(v);
      return { x: v.x, y: v.y, z: v.z, huong: cuoi.huong, tuThe: 'lai', chanCam: v.y + 0.55, kcMax: 7.5 };
    },
  },
});
const than = di.than, thanVa = di.va;
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 8, 0); orbit.enableDamping = true; orbit.minDistance = 10; orbit.maxDistance = 320; orbit.maxPolarAngle = 1.48; orbit.zoomToCursor = true;

function vaoDiBo(dich) {
  if (cuoi) { cuoi.b.setBodyType(RAPIER.RigidBodyType.Fixed, true); cuoi = null; thanVa.setEnabled(true); }
  const p = dich || DIEM_VAO, yaw0 = dich ? Math.atan2(p.x, p.z) : 0; // nhìn về thành chính
  di.vao(p.x, p.y, p.z, yaw0 + Math.PI); cheDo = 'di'; orbit.enabled = false;
  $('b-di').style.display = 'none'; $('b-toan').style.display = '';
  if (CHAM) { $('can').style.display = 'block'; $('cham').style.display = 'flex'; }
}
function raToanCanh() {
  if (cuoi) xuongXe();
  cheDo = 'toan'; orbit.enabled = true; di.ra(); $('can').style.display = 'none'; $('cham').style.display = 'none';
  $('b-di').style.display = ''; $('b-toan').style.display = 'none';
  const p = camera.position.clone(); const yaw = di.yaw; orbit.target.copy(p).add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(20)); camera.position.add(new THREE.Vector3(Math.sin(yaw) * 30, 25, Math.cos(yaw) * 30));
}
$('b-di').onclick = () => vaoDiBo(); $('b-toan').onclick = raToanCanh;
// âm thanh: chỉ bật sau cú bấm đầu tiên (luật trình duyệt); nút 🔇 tắt/mở
let am = null, tatAm = false;
const batAm = () => { if (am || tatAm) return; try { am = taoAmThanh(); am.gan(quan); } catch (e) { console.warn('[castle] không bật được âm thanh', e); } };
addEventListener('pointerdown', batAm); addEventListener('keydown', batAm);
$('b-am').onclick = (e) => { e.stopPropagation(); tatAm = !tatAm; $('b-am').textContent = tatAm ? '🔇' : '🔊'; if (am) am.tat(tatAm); else batAm(); };
$('b-gio').onclick = (e) => { e.stopPropagation(); gioGame.doiNhanh(); $('b-gio').textContent = `🕒 ${gioGame.chu()} ×${gioGame.nhanh}`; };
let tuongTac = 0; for (const ev of ['pointermove', 'wheel', 'keydown', 'touchmove']) addEventListener(ev, () => { tuongTac = performance.now(); }, { passive: true });
$('b-moi').onclick = () => { try { localStorage.removeItem(KHOA_LUU); } catch {} thamSo.set('h', Math.floor(Math.random() * 1e6)); location.search = thamSo.toString(); };

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
function noiChuyen() { if (cheDo !== 'di') return; const p = than.translation(); const kq = sd.noiChuyen(p, di.huong, am); if (!kq) sd.noi(toi.goc, 'Không có ai gần đây.', 1.5); }
function nutE() { if (cheDo !== 'di') return; if (cuoi) return xuongXe(); const X = ganXeNhat(than.translation()); if (X) lenXe(X); else noiChuyen(); } // E / nút Nói: lên-xuống ngựa, xe; không thì nói chuyện
function doiGocNhin() { di.doiGocNhin(); }
addEventListener('keydown', (e) => {
  if (e.target.closest?.('textarea, input')) return; // đang gõ góp ý thì phím không điều khiển game
  phim[e.code] = true; if (cheDo !== 'di' || e.repeat) return;
  if (e.code === 'Digit1') toi.lam('chao');
  if (e.code === 'Digit2') toi.lam('mua');
  if (e.code === 'KeyF') da();
  if (e.code === 'KeyE') nutE();
  if (e.code === 'Escape' && gy.style.display !== 'grid') raToanCanh();
});
addEventListener('keyup', (e) => { phim[e.code] = false; });

// cần điều khiển + kéo nhìn trên điện thoại
const can = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, nhin = { id: null, x: 0, y: 0 };
const cuc = $('can').querySelector('i');
$('can').addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; can.id = t.identifier; const b = $('can').getBoundingClientRect(); can.x = b.left + b.width / 2; can.y = b.top + b.height / 2; e.preventDefault(); }, { passive: false });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === can.id) { let dx = t.clientX - can.x, dy = t.clientY - can.y; const l = Math.hypot(dx, dy); if (l > 50) { dx *= 50 / l; dy *= 50 / l; } can.dx = dx / 50; can.dy = dy / 50; cuc.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (t.identifier === nhin.id) { di.yaw -= (t.clientX - nhin.x) * 0.005; di.pitch = Math.max(-1.4, Math.min(1.4, di.pitch - (t.clientY - nhin.y) * 0.005)); di.lucChuot = performance.now(); nhin.x = t.clientX; nhin.y = t.clientY; }
  }
}, { passive: true });
renderer.domElement.addEventListener('touchstart', (e) => { if (cheDo !== 'di') return; const t = e.changedTouches[0]; if (nhin.id === null) { nhin.id = t.identifier; nhin.x = t.clientX; nhin.y = t.clientY; } }, { passive: true });
addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === can.id) { can.id = null; can.dx = can.dy = 0; cuc.style.transform = ''; } if (t.identifier === nhin.id) nhin.id = null; } });
$('b-nhay').addEventListener('touchstart', (e) => { e.preventDefault(); can.nhay = true; }, { passive: false });
for (const [id, f] of [['b-nem', nem], ['b-chao', () => toi.lam('chao')], ['b-mua', () => toi.lam('mua')], ['b-da', da], ['b-goc', doiGocNhin], ['b-noi', nutE]])
  $(id).addEventListener('touchstart', (e) => { e.preventDefault(); f(); }, { passive: false });

// ---------- hậu kỳ
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.35, 1.0); composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---------- vòng chạy
const dongHo = new THREE.Clock(); let tichLuy = 0; const BUOC = 1 / 60;

// ---------- ngựa + xe ngựa trên bãi cỏ (khuôn RDR2 / Zelda: E lên / xuống)
// Ngựa: lái theo hướng camera như đi bộ nhưng quay chậm hơn (càng nhanh càng khó bẻ), W nước kiệu · Shift phi nước đại · Space nhảy rào.
// Xe ngựa: lái kiểu xe (GTA): W tiến · S phanh rồi lùi · A/D bẻ lái, xe quay quanh trục bánh theo tốc độ.
const dkX = world.createCharacterController(0.05);
dkX.enableAutostep(0.55, 0.3, false); dkX.enableSnapToGround(0.5); dkX.setMaxSlopeClimbAngle(0.8); dkX.setApplyImpulsesToDynamicBodies(true); dkX.setCharacterMass(500);
const XE = [];
function themXe(kieu, x, z, huong) {
  const vo = kieu === 'xe' ? dungXe(scene) : dungNgua(scene, x < 18 ? 0x6b4226 : 0x2e2620);
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.86, z));
  const va = world.createCollider(kieu === 'xe' ? RAPIER.ColliderDesc.cuboid(0.8, 0.8, 2.5).setTranslation(0, 0, 1.3).setRotation(qY(0)) : RAPIER.ColliderDesc.cuboid(0.35, 0.82, 1.05), b); va.setCollisionGroups(NHOM_XE);
  const X = { kieu, vo, b, va, huong, toc: 0, vy: 0, nen: true, lai: 0, anCo: Math.random() * 10 };
  b.setRotation(qY(huong), true); b.setBodyType(RAPIER.RigidBodyType.Fixed, true); XE.push(X); return X; // đỗ = vật cố định: bộ điều khiển nhân vật Rapier không chặn vật động học, đỗ mà để động học thì xe / người đi xuyên qua
}
themXe('ngua', 17, 104, 2.2); themXe('ngua', 21, 121, 0.4); themXe('xe', 40, 104, -Math.PI / 2);
let cuoi = null; // phương tiện đang cưỡi / lái
const viTriXe = (X) => X.b.translation();
function ganXeNhat(p) { let tot = null, kc = 3; for (const X of XE) { const q = viTriXe(X), dx = X.kieu === 'xe' ? q.x + Math.sin(X.huong) * 0.6 : q.x, dz = X.kieu === 'xe' ? q.z + Math.cos(X.huong) * 0.6 : q.z, d = Math.hypot(dx - p.x, dz - p.z) - (X.kieu === 'xe' ? 0.8 : 0.4); if (d < kc) { kc = d; tot = X; } } return tot; }
function lenXe(X) { cuoi = X; X.b.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true); thanVa.setEnabled(false); X.toc = 0; toi.lam('dung'); }
function xuongXe() {
  const X = cuoi; if (!X) return; cuoi = null; X.b.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  const q = viTriXe(X), rx = -Math.cos(X.huong), rz = Math.sin(X.huong), kc = X.kieu === 'xe' ? 1.4 : 1.1; // xuống bên trái
  thanVa.setEnabled(true); di.datCho({ x: q.x + rx * kc, y: q.y + 0.6, z: q.z + rz * kc }, null, null, X.huong); X.toc = 0;
}
const HINH_XE = { xe: [new RAPIER.Cuboid(0.75, 0.74, 2.45), 1.3], ngua: [new RAPIER.Cuboid(0.32, 0.76, 1.0), 0] };
function xoayDuoc(X, q, h) { // thân xoay sang hướng h có lấn vào tường / rào không (KCC chỉ chặn tịnh tiến, không chặn xoay)
  const [hinh, lech] = HINH_XE[X.kieu], r = qY(h);
  return !world.intersectionWithShape({ x: q.x + Math.sin(h) * lech, y: q.y + 0.08, z: q.z + Math.cos(h) * lech }, r, hinh, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, NHOM_XE, X.va);
}
function buocXe(X, dt, tr) {
  const { fx, fz } = tr, yaw = di.yaw, q = viTriXe(X), sx = Math.sin(yaw), cz = Math.cos(yaw), h0 = X.huong;
  if (X.kieu === 'ngua') {
    let wx = -sx * fz + cz * fx, wz = -cz * fz - sx * fx; const wl = Math.hypot(wx, wz);
    let tocMuon = 0;
    if (wl) {
      const muon = Math.atan2(wx, wz), lech = Math.atan2(Math.sin(muon - X.huong), Math.cos(muon - X.huong));
      X.huong += Math.sign(lech) * Math.min(Math.abs(lech), Math.max(1.1, 2.8 - X.toc * 0.13) * dt);
      tocMuon = (phim.ShiftLeft || phim.ShiftRight ? 12 : phim.KeyC ? 2 : 6.5) * Math.min(1, wl) * Math.max(0.25, Math.cos(Math.min(Math.abs(lech), Math.PI / 2)));
    }
    X.toc += Math.sign(tocMuon - X.toc) * Math.min(Math.abs(tocMuon - X.toc), (tocMuon > X.toc ? 7 : 10) * dt);
    if (tr.nhay && X.nen) { X.vy = 6.4; tr.tieuNhay(); }
  } else { // xe: lái kiểu ô tô
    const tien = fz > 0 ? 1 : 0, lui = fz < 0 ? 1 : 0, max = phim.ShiftLeft || phim.ShiftRight ? 13 : 8.5;
    if (tien) X.toc = Math.min(max, X.toc + 4.5 * dt);
    else if (lui) X.toc = X.toc > 0.2 ? Math.max(0, X.toc - 10 * dt) : Math.max(-3, X.toc - 3 * dt);
    else X.toc -= Math.sign(X.toc) * Math.min(Math.abs(X.toc), 2.5 * dt);
    X.lai += ((-fx * 0.55 / (1 + Math.abs(X.toc) * 0.06)) - X.lai) * Math.min(1, dt * 6);
    X.huong += X.toc * Math.tan(X.lai) / 2.8 * dt;
  }
  if (X.huong !== h0 && !xoayDuoc(X, q, X.huong)) X.huong = h0;
  X.vy = X.nen && X.vy <= 0 ? -1 : X.vy - 20 * dt;
  const muonDi = { x: Math.sin(X.huong) * X.toc * dt, y: X.vy * dt, z: Math.cos(X.huong) * X.toc * dt };
  X.b.setNextKinematicRotation(qY(X.huong));
  dkX.computeColliderMovement(X.va, muonDi, undefined, NHOM_XE);
  const m = dkX.computedMovement(); X.nen = dkX.computedGrounded();
  if (Math.hypot(m.x, m.z) < Math.hypot(muonDi.x, muonDi.z) * 0.3 && Math.abs(X.toc) > 1) X.toc *= 0.6; // đâm vật cản
  const nq = { x: q.x + m.x, y: q.y + m.y, z: q.z + m.z };
  if (nq.y < -6) { nq.x = 26; nq.y = 0.86; nq.z = 104; X.toc = 0; } // rơi xuống dung nham → về bãi cỏ
  X.b.setNextKinematicTranslation(nq);
  than.setTranslation({ x: nq.x, y: nq.y + 0.05, z: nq.z }, false); // thân người (tắt va chạm) đi theo, để camera / lưu chỗ đứng dùng chung
  di.toc = Math.abs(X.toc); di.nen = X.nen;
  // camera tự về sau lưng (xe: luôn kéo nhẹ; ngựa: như đi bộ)
  const sauLung = X.huong - Math.PI, lc = Math.atan2(Math.sin(sauLung - yaw), Math.cos(sauLung - yaw));
  if (performance.now() - di.lucChuot > 800 && Math.abs(lc) < 2.6 && Math.abs(X.toc) > 0.5) di.yaw += lc * (1 - Math.exp(-dt * (X.kieu === 'xe' ? 2.2 : 1.4)));
}
let veGio = -1, lanVe = 0, demCham = 0, demKhung = 0, mocDo = 0;
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
  renderer.info.reset();
  gioGame.capNhat(dt); buocDan(dt);
  if ((t * 2 | 0) !== (veGio | 0)) { veGio = t * 2; $('b-gio').textContent = `🕒 ${gioGame.chu()} ×${gioGame.nhanh}`; }
  while (tichLuy >= BUOC) { if (cheDo === 'di') di.buoc(BUOC); world.step(); tichLuy -= BUOC; }
  if (cheDo === 'di' && !cuoi && than.translation().y < -6) vaoDiBo(); // rơi xuống dung nham → về đầu cầu
  for (const { mesh, b } of dong) { const p = b.translation(), q = b.rotation(); mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(q.x, q.y, q.z, q.w); if (p.y < -9) { b.setTranslation({ x: p.x, y: -200, z: p.z }, false); b.sleep(); } }
  for (const X of XE) { // hình ngựa / xe theo thân vật lý
    const q = X.b.translation(), xa = Math.hypot(q.x - camera.position.x, q.z - camera.position.z) > 75;
    X.vo.goc.visible = !xa; if (xa) continue;
    X.vo.goc.position.set(q.x, q.y - 0.86, q.z); X.vo.goc.rotation.y = X.huong;
    if (X !== cuoi) X.toc *= Math.exp(-dt * 3);
    X.vo.capNhat(dt, Math.abs(X.toc), X !== cuoi);
  }
  if (cheDo === 'di') { cocToi.visible = sd.dangUong(); di.khung(dt); }
  else orbit.update();
  VL_DN.uniforms.t.value = t; VL_NUOC.uniforms.t.value = t; VL_NUOC.uniforms.sang.value = 1 - 0.6 * gioGame.toi; VL_TROI.uniforms.t.value = t; troi.position.copy(camera.position);
  for (let i = 0; i < SO_LUA; i++) { luaPos[i * 3 + 1] += luaV[i] * dt; luaPos[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.4; if (luaPos[i * 3 + 1] > 30) datLua(i); }
  gLua.attributes.position.needsUpdate = true;
  for (const c of co) { const a = c.g.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const x = c.goc[i]; a[i + 2] = Math.sin(x * 2.2 - t * 5 + c.pha) * 0.18 * x; a[i + 1] = c.goc[i + 1] - x * 0.06 + Math.sin(x * 1.7 - t * 3.3) * 0.05 * x; } c.g.attributes.position.needsUpdate = true; c.g.computeVertexNormals(); }
  anhDn.intensity = 20 + Math.sin(t * 2.1) * 6 + Math.sin(t * 5.3) * 3;
  quan.capNhat(dt, t);
  if (am) { const p = camera.position; am.capNhat(camera, quan.trong(p.x, p.z), Math.hypot(p.x - quan.tam[0], p.z - quan.tam[1])); }
  veNguoi(); ghiLuu(now); veBanDo(now); capNhatHd(now);
  composer.render();
}
// khôi phục chỗ đứng cũ (chỉ khi cùng lâu đài)
if (LUU && LUU.hat === HAT && !THU) {
  if (LUU.gio != null) gioGame.datGio(LUU.gio);
  if (LUU.gocNhin && LUU.gocNhin !== di.gocNhin) di.doiGocNhin();
  if (LUU.cheDo === 'di' && LUU.p) {
    vaoDiBo(); di.datCho(LUU.p, LUU.yaw, LUU.pitch, LUU.huong ?? (LUU.yaw ?? di.yaw) + Math.PI);
  } else if (LUU.cam) { camera.position.fromArray(LUU.cam); orbit.target.fromArray(LUU.dich); orbit.update(); }
}
let lucLuu = 0;
function ghiLuu(now) {
  if (now - lucLuu < 1000 || THU) return; lucLuu = now;
  const p = than.translation();
  try { localStorage.setItem(KHOA_LUU, JSON.stringify({ hat: HAT, cheDo, gio: gioGame.gio, gocNhin: di.gocNhin, ...(cheDo === 'di' ? { p: { x: p.x, y: p.y + 0.05, z: p.z }, yaw: di.yaw, pitch: di.pitch, huong: di.huong } : { cam: camera.position.toArray(), dich: orbit.target.toArray() }) })); } catch {}
}
// bảng hướng dẫn nút: H hoặc ❔ để ẩn / hiện (nhớ lựa chọn)
const hd = $('hd');
try { if (localStorage.getItem('castle-an-hd') === '1') hd.classList.add('an'); } catch {}
const doiHd = () => { hd.classList.toggle('an'); try { localStorage.setItem('castle-an-hd', hd.classList.contains('an') ? '1' : '0'); } catch {} };
$('b-hd').onclick = (e) => { e.stopPropagation(); doiHd(); };
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.repeat && !e.target.closest?.('textarea, input')) doiHd(); });
// lưu ngay lúc trang sắp đóng / tải lại (F5): không mất bước đi trong giây cuối
addEventListener('pagehide', () => { lucLuu = 0; ghiLuu(performance.now() + 5000); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { lucLuu = 0; ghiLuu(performance.now() + 5000); } });

// bảng phím THEO NGỮ CẢNH: chỉ hiện phím / nút dùng được ở chỗ đang đứng (toàn cảnh · đi bộ · leo · bơi · cưỡi ngựa · lái xe),
// mục phụ (E cưỡi / lên xe / nói / gọi rượu, Space leo) chỉ hiện khi đứng cạnh đúng thứ đó. Nút cảm ứng ẩn / đổi chữ theo cùng ngữ cảnh.
const K = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join('');
function nguCanh() {
  if (cheDo !== 'di') return { ten: 'toan' };
  if (cuoi) return { ten: cuoi.kieu };
  if (di.tt === 'leo' || di.tt === 'qua') return { ten: 'leo' };
  if (di.tt === 'boi') return { ten: 'boi' };
  const p = than.translation(), X = ganXeNhat(p);
  const h = di.huong, tuong = di.tiaN(p, 0.3, Math.sin(h), Math.cos(h), 1.0);
  return { ten: 'dat', xe: X ? X.kieu : null, nguoi: X ? null : sd.ganNguoi(p, h), tuong: !!(tuong && tuong.timeOfImpact > 0.02 && Math.abs(tuong.normal.y) < 0.35) };
}
function dongHd(c) {
  const pc = !CHAM, d = (a, b) => `<div class="d"><span>${a}</span><span>${b}</span></div>`;
  const xoay = pc ? d('giữ chuột + kéo', 'xoay camera') + d(K('Z', 'X'), 'xoay camera trái / phải') : d('kéo bên phải', 'nhìn quanh');
  if (c.ten === 'toan') return '<b>Toàn cảnh</b>' + (pc ? d('kéo chuột', 'xoay') + d('lăn chuột', 'phóng to / nhỏ') + d('nhấp đúp', 'xuống đi bộ tại đó') : d('1 ngón', 'xoay') + d('2 ngón chụm', 'phóng to / nhỏ') + d('chạm đúp', 'xuống đi bộ tại đó')) + d('🚶 Đi bộ', 'vào từ đầu cầu');
  if (c.ten === 'leo') return '<b>Đang leo</b>' + (pc ? d(K('W', 'S'), 'leo lên / xuống') + d(K('A', 'D'), 'đi ngang theo tường') + d(K('W') + ' tới mép', 'tự đu người lên') + d(K('Space'), 'bật ra khỏi tường') + d(K('S') + ' chạm đất', 'thả tay') : d('cần trái', 'lên / xuống / ngang') + d('Bật ra', 'nhảy khỏi tường')) + xoay;
  if (c.ten === 'boi') return '<b>Đang bơi</b>' + (pc ? d(K('W', 'A', 'S', 'D'), 'bơi theo hướng camera') + d(K('Shift'), 'bơi nhanh') : d('cần trái', 'bơi')) + d('bơi vào bờ', 'tự trèo lên') + xoay;
  if (c.ten === 'ngua') return '<b>Cưỡi ngựa</b>' + (pc ? d(K('W', 'A', 'S', 'D'), 'đi theo hướng camera') + d(K('Shift'), 'phi nước đại') + d(K('C'), 'đi chậm') + d(K('Space'), 'nhảy') + d(K('E'), 'xuống ngựa') : d('cần trái', 'đi theo hướng camera') + d('Nhảy', 'nhảy') + d('Xuống', 'xuống ngựa')) + xoay;
  if (c.ten === 'xe') return '<b>Lái xe ngựa</b>' + (pc ? d(K('W'), 'tiến') + d(K('S'), 'phanh, rồi lùi') + d(K('A', 'D'), 'bẻ lái') + d(K('Shift'), 'nhanh') + d(K('E'), 'xuống xe') : d('cần trái', 'lên tiến · xuống lùi · ngang bẻ lái') + d('Xuống', 'xuống xe')) + xoay;
  let h = '<b>Đi bộ</b>' + (pc ? d(K('W', 'A', 'S', 'D'), 'đi') + d(K('Shift'), 'chạy') + d(K('Space'), 'nhảy') + d(K('C') + ' giữ', 'ngồi xuống') : d('cần trái', 'đi')) + xoay;
  const them = [];
  if (c.tuong) them.push(d(pc ? K('Space') : 'Leo', 'trèo qua (thấp) · bám leo (cao)'));
  if (c.xe) them.push(d(pc ? K('E') : c.xe === 'xe' ? 'Lên xe' : 'Cưỡi', c.xe === 'xe' ? 'lên xe ngựa' : 'cưỡi ngựa'));
  if (c.nguoi) them.push(d(pc ? K('E') : c.nguoi === 'ruou' ? 'Gọi rượu' : 'Nói', c.nguoi === 'ruou' ? 'gọi rượu ở quầy' : 'nói chuyện'));
  if (them.length) h += '<b>Ở đây</b>' + them.join('');
  h += '<b>Động tác</b>' + (pc ? d('nhấp chuột', 'ném đá vào chỗ nhấp') + d(K('F'), 'đá chân') + d(K('1') + ' ' + K('2'), 'chào · múa') + d(K('V'), 'góc nhìn sau lưng / mắt') + d(K('Esc'), 'về toàn cảnh') : d('nút phải', 'Ném · Đá · Chào · Múa · 👁 góc nhìn'));
  return h;
}
// nút cảm ứng theo ngữ cảnh: [id, hiện?, chữ]
function nutCham(c) {
  const dat = c.ten === 'dat';
  return [['b-goc', c.ten !== 'toan', '👁'], ['b-noi', (dat && (c.xe || c.nguoi)) || c.ten === 'ngua' || c.ten === 'xe', c.ten === 'ngua' || c.ten === 'xe' ? 'Xuống' : c.xe === 'xe' ? 'Lên xe' : c.xe ? 'Cưỡi' : c.nguoi === 'ruou' ? 'Gọi rượu' : 'Nói'],
    ['b-chao', dat, 'Chào'], ['b-mua', dat, 'Múa'], ['b-da', dat, 'Đá'], ['b-nem', dat, 'Ném'], ['b-nhay', dat || c.ten === 'ngua' || c.ten === 'leo', c.ten === 'leo' ? 'Bật ra' : dat && c.tuong ? 'Leo' : 'Nhảy']];
}
let khoaHd = '', lucHd = 0;
function capNhatHd(now) {
  if (now - lucHd < 250) return; lucHd = now;
  const c = nguCanh(), khoa = JSON.stringify(c);
  if (khoa === khoaHd) return; khoaHd = khoa;
  $('hd-nc').innerHTML = dongHd(c);
  if (CHAM) for (const [id, hien, chu] of nutCham(c)) { const b = $(id); b.style.display = hien ? '' : 'none'; if (b.textContent !== chu) b.textContent = chu; }
}

// bản đồ nhỏ + toạ độ
const banDo = taoBanDo($('bd'), { nha: nhaVa, thap: cothap.slice(0, SO_THAP), quan: quan.tam, ren: [Math.cos(Math.PI + 0.3) * 33.8, Math.sin(Math.PI + 0.3) * 33.8], gieng: [13.6, 0], cho: [34, 0] });
let lucBd = 0;
function veBanDo(now) {
  if (now - lucBd < 100) return; lucBd = now;
  const p = cheDo === 'di' ? than.translation() : { x: orbit.target.x, z: orbit.target.z };
  const gan = []; for (const d of sd.dan) if (!d.an && Math.hypot(d.x - p.x, d.z - p.z) < 30) gan.push([d.x, d.z]);
  banDo.ve(p, cheDo === 'di' ? di.huong : Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z) + Math.PI, gan);
  { const X = cuoi ? null : cheDo === 'di' ? ganXeNhat(than.translation()) : null; const gy_ = $('goiY'); const chu = cuoi ? (cuoi.kieu === 'xe' ? 'E xuống xe · W tiến · S phanh/lùi · A D bẻ lái · Shift nhanh' : 'E xuống ngựa · W đi · Shift phi · Space nhảy') : X ? (X.kieu === 'xe' ? 'E lên xe ngựa' : 'E cưỡi ngựa') : ''; if (gy_.textContent !== chu) { gy_.textContent = chu; gy_.style.display = chu ? 'block' : 'none'; } }
  $('toado').textContent = `📍 ${p.x.toFixed(1)}, ${p.z.toFixed(1)}${cheDo === 'di' ? '' : ' (tâm nhìn)'}`;
}

// góp ý: gửi về hòm mos2 qua /api/gop-y (cùng host, phiên SSO), kèm ảnh khung hình + ngữ cảnh chỗ đứng
const gy = $('gy');
function moGopY() { gy.style.display = 'grid'; $('gy-kq').textContent = ''; $('gy-kq').className = 'kq'; setTimeout(() => $('gy-chu').focus(), 30); }
function chupMan() {
  composer.render(); // đọc ngay sau khi vẽ, cùng nhịp → khung hình còn nguyên
  const src = renderer.domElement, k = Math.min(1, 1280 / src.width), c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
async function guiGopY() {
  const chu = $('gy-chu').value.trim(), kq = $('gy-kq');
  if (!chu) { kq.textContent = 'Chưa gõ nội dung.'; kq.className = 'kq loi'; return; }
  $('gy-gui').disabled = true; kq.textContent = 'Đang gửi…'; kq.className = 'kq';
  const p = than.translation();
  const nguCanh = `Lâu đài h=${HAT} · ${cheDo === 'di' ? `đi bộ tại (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}) hướng ${(di.yaw * 180 / Math.PI).toFixed(0)}° · góc nhìn ${di.gocNhin === 3 ? 'sau lưng' : 'mắt'}` : 'toàn cảnh'} · giờ game ${gioGame.chu()} · ${quan.trong(p.x, p.z) ? 'trong quán · ' : ''}${innerWidth}×${innerHeight}${CHAM ? ' cảm ứng' : ''}`;
  try {
    const anh = gy.querySelector('#gy-anh').checked ? chupMan() : null;
    const r = await fetch('/api/gop-y', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ noiDung: chu, loai: gy.querySelector('input[name=gy-loai]:checked').value, trang: location.href, nguCanh, anh }) });
    const j = await r.json().catch(() => ({ ok: false, error: `máy chủ trả ${r.status}` }));
    if (!j.ok) throw new Error(j.error || `máy chủ trả ${r.status}`);
    kq.textContent = `Đã gửi góp ý #${j.id}. Cảm ơn!`; $('gy-chu').value = '';
    setTimeout(() => { gy.style.display = 'none'; }, 1600);
  } catch (e) { kq.textContent = 'Gửi không được: ' + (e.message || e); kq.className = 'kq loi'; console.error('[castle] góp ý', e); }
  $('gy-gui').disabled = false;
}
$('b-gy').onclick = (e) => { e.stopPropagation(); moGopY(); };
$('gy-dong').onclick = () => { gy.style.display = 'none'; };
$('gy-gui').onclick = guiGopY;
$('gy-chu').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guiGopY(); if (e.key === 'Escape') gy.style.display = 'none'; });
$('tai').remove();
window.__lauDai = { hat: HAT, nhaVa, nguCanh: () => nguCanh(), dbg: () => ({ nen: di.nen, tt: di.tt, toc: di.toc }), tt: () => di.tt, di, XE, cuoi: () => cuoi, lenXe, xuongXe, thu: (f) => f({ world, RAPIER, tiaN: di.tiaN, matTren: di.matTren, thanVa, LOC_TINH }), yaw: () => di.yaw, huong: () => di.huong, soLuoi: scene.children.length, soVatDong: dong.length, soNha: nhaVa.length, vaoDiBo, raToanCanh, camera, than, nem, phim, dong, datHuong: (y, p) => { di.yaw = y; di.pitch = p; }, toi, dan: sd.dan, da, doiGocNhin, quan, quanNguoi, doNet: () => doNet, renderer, bloom, composer, sd, gioGame, ve: () => ({ lenh: renderer.info.render.calls, tamGiac: renderer.info.render.triangles, nguoi: { ...DEM } }) };
vong();
