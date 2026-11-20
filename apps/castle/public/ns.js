// Lâu đài CÓ THẬT dựng từ số đo: khối nhà 3D OpenStreetMap (chiều cao, đáy, kiểu mái, màu) + địa hình EU-DEM 25 m.
// Bước 4–5: vật liệu (móng đá thô · mặt tiền đá vôi cửa sổ vòm · mái đá phiến · răng cưa mái bằng), vách đá, rừng; đi bộ / leo / va chạm
// (dibo.js — dùng chung, người chơi có xương + động tác thật nguoi3d.js). 1 đơn vị = 1 m, -z = bắc.
// Quy tắc OSM "Simple 3D Buildings": nhà có building:part thì chỉ vẽ các part, không vẽ vỏ ngoài.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import RAPIER from 'rapier';
import * as T from './tex.js';
const TEX = T; // tên khác cho khối có biến T cục bộ (mẫu tháp đo)
import { napNguoi3d, taoNguoi3d } from './nguoi3d.js';
import { taoDiBo } from './dibo.js';
import { taoBanDo } from './bando.js';
import { dungNoiThat } from './noithat.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ganGopY, chupCanvas } from './gopy.js';
import { ganBaoLech } from './baolech.js';
import { datCach3 } from './cach3.js';
import { ganDanhGia } from './danhgia.js';
import { taoCamUng, CHAM } from './camung.js';
import { taoChieuAnh } from './chieuanh.js';
import { datDuong } from './duong.js';
import { datTrangTri, datCuaCong } from './trangtri.js';
import { datMatTien, datMatPalas, datThapGoc, bocCuc, O_MO, quyDoiMat, tiLeDung, datChop, oCum, boTriDo, datMai, banDoMat, datMatRieng } from './mattien.js';
import { taoNhieuNguoi } from './nhieunguoi.js';
import { ganAnhQuanh } from './anhquanh.js';
import { datCanhXa } from './canhxa.js';

const $ = (id) => document.getElementById(id);
const ten = new URLSearchParams(location.search).get('lau') || 'neuschwanstein';
const D = await (await fetch(`./du-lieu/${ten}.json`, { cache: 'no-cache' })).json();
// SỬA THEO ẢNH: số đo OSM lệch so với ảnh thật thì ghi phần chỉnh vào du-lieu/<ten>-sua.json ({ "way/…": { height, min_height, "roof:height", "building:colour", ly_do } };
// thêm: phong = phóng mặt bằng quanh tâm (×), thap_goc = tháp góc treo trên con-xon — mattien.js datThapGoc dựng con-xon, gờ, cửa sổ, răng cưa),
// không sửa tệp số đo gốc — để biết khối nào là số OSM, khối nào đã chỉnh theo ảnh nào.
const SUA = await fetch(`./du-lieu/${ten}-sua.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
// CÁCH 3 (?cach=3, nút 🧩): độ cao từng khối lấy từ bản đồ độ cao thật (scripts/khoi-tu-dsm.mjs → <lâu>-sua-cach3.json) đè lên tệp sửa — mặt bằng + chi tiết giữ nguyên.
// ?cach=dsm: lớp khối thô dựng thẳng từ bản đồ độ cao (cach3.js) — chỉ để soi số đo
const CACH = new URLSearchParams(location.search).get('cach');
let S3_IDS = [];
if (CACH === '3') { const S3 = await fetch(`./du-lieu/${ten}-sua-cach3.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})); for (const [id, e] of Object.entries(S3)) SUA[id] = { ...(SUA[id] || {}), ...e }; S3_IDS = Object.keys(S3); }
// bố cục mặt Palas hướng sân đo từ ảnh (điểm ảnh thô; kiểm với ảnh: apps/castle/scripts/kiem-mat-tien.py) — mattien.js quyDoiMat đổi ra mét
const MAT_BO = await fetch(`./du-lieu/${ten}-mat-palas-san.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// mặt Torbau hướng sân dưới đo từ ảnh chụp chéo (góp ý #1641; kiểm: apps/castle/scripts/kiem-mat-tien.py <tệp>) — mattien.js banDoMat / datMatRieng
const MAT_TB_BO = await fetch(`./du-lieu/${ten}-mat-torbau-san.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// ĐO TRÊN ẢNH 3D GOOGLE (scripts/do-khoi-google.mjs): mặt đất quanh lâu đài, mặt sân trên, đỉnh từng khối — mốc chân nhà + mặt đất thật
const NEN = await fetch(`./du-lieu/${ten}-nen.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// SÂN TRƯỚC CỔNG theo ảnh trực giao + bề mặt chính thức Bavaria (scripts/san-cong-dop.py, 20/11/2026): { san: đa giác, co: [bồn cỏ], y } — thay sân suy từ tim đường
const CAY = await fetch(`./du-lieu/${ten}-cay.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); // ngọn cây theo tán chính thức (scripts/cay-tu-dom.py)
const SAN_CONG = await fetch(`./du-lieu/${ten}-san-cong.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const CHOP = await fetch(`./du-lieu/${ten}-chop.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); // chóp / tháp nhỏ OSM không có (scripts/them-chop.mjs)
const MAT_DUNG = await fetch(`./du-lieu/${ten}-mat-dung.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); // số đo mặt đứng ảnh 3D ↔ mô hình (scripts/so-mat.py): chân tháp xoè, cổng xuyên
const CUA_SO = await fetch(`./du-lieu/${ten}-cua-so.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})); // cửa sổ đo từ ảnh từng mặt (scripts/nan-google.mjs + do-cua-so.py)
// KHÔNG DÁN ẢNH LÊN MÔ HÌNH (anh 16/11/2026: 'không được dùng ảnh ghép vào 3D, phải dựng thành đối tượng 3D') — ảnh chỉ dùng để ĐO; mọi chi tiết dựng hình khối.
// Lớp ảnh dán tường (dan-mat.py) và chiếu ảnh (chieuanh.js) tắt; công cụ giữ lại cho việc đo.
const DAN_ANH = false;
const MAT_ANH = DAN_ANH ? await fetch(`./du-lieu/${ten}-mat-anh.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) : {};
const DUONG = await fetch(`./du-lieu/${ten}-duong.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); // đường + cầu thang OSM (scripts/tai-duong.mjs)
const MAI = await fetch(`./du-lieu/${ten}-mai.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); // cửa mái / chóp nhỏ đo trên ảnh 3D (scripts/do-mai.mjs)
// MÁI THEO LoD2 CHÍNH THỨC Bavaria, khớp lại theo DOM20 (scripts/mai-lod2.py, 20/11/2026): khối có trong tệp dựng mái từ mặt mái đo đạc thay cho hộp bao + sống giữa; ?mai=osm = cách cũ để so
const MAI_LOD2 = new URLSearchParams(location.search).get('mai') === 'osm' ? null : await fetch(`./du-lieu/${ten}-mai-lod2.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const NT = await fetch(`./du-lieu/${ten}-noi-that.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); // nội thất (có thì dựng)
// KHỐI OSM KHÔNG CÓ (ảnh thật có, OSM chưa vẽ): mục sua.json khoá "them/<tên>" mang "ngoai" = mặt bằng [[x, z], …] (đo trên bản đồ độ cao ảnh 3D,
// scripts/khop-khoi.mjs → <lâu>-cach3.json) + thẻ như khối OSM — dựng chung đường với khối OSM (căn nhà nhỏ chân Viereckturm, góp ý #1632)
for (const [id, e] of Object.entries(SUA)) if (Array.isArray(e?.ngoai) && e.ngoai.length >= 3 && !D.khoi.some((k) => k.id === id)) D.khoi.push({ id, ngoai: [e.ngoai], trong: [], tags: {}, them: true });
for (const k of D.khoi) if (SUA[k.id]) { k.tagsGoc = { ...k.tags }; for (const [a, b] of Object.entries(SUA[k.id])) if (!a.startsWith('ly_do') && a !== 'ngoai') k.tags[a] = String(b); }

// ---------- cảnh
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// điện thoại (CHAM) vẽ đúng 1 điểm ảnh: màn Retina 3x vẽ đủ điểm là GPU chạy hết sức → nóng máy, tụt pin (anh 15/11/2026); máy tính tới 1,5
renderer.setPixelRatio(Math.min(devicePixelRatio, CHAM ? 1 : 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = CHAM ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xa9c4dc); scene.fog = new THREE.Fog(0xa9c4dc, 2500, 18000);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 25000);
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x55603a, 1.3));
const nang = new THREE.DirectionalLight(0xfff1dc, 2.6); nang.position.set(-260, 380, 180); nang.castShadow = true;
nang.shadow.mapSize.set(CHAM ? 1024 : 2048, CHAM ? 1024 : 2048); Object.assign(nang.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 50, far: 1200 }); nang.shadow.bias = -0.0004; scene.add(nang);

// ---------- địa hình: lưới độ cao, gốc toạ độ = độ cao tâm lâu đài
const G = D.diaHinh, n = G.n, B = G.buoc, NUA = G.nua;
const caoO = (i, j) => G.cao[Math.max(0, Math.min(n - 1, j)) * n + Math.max(0, Math.min(n - 1, i))];
function caoDat(x, z) { // nội suy song tuyến
  const fx = (x + NUA) / B, fz = (z + NUA) / B, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (caoO(i, j) * (1 - u) + caoO(i + 1, j) * u) * (1 - v) + (caoO(i, j + 1) * (1 - u) + caoO(i + 1, j + 1) * u) * v;
}
const GOC_Y = caoDat(0, 0);
// HẠ LƯỚI ĐẤT THÔ (EU-DEM ô 12 m) xuống dưới MẶT ĐẤT ĐO TỪ ẢNH 3D ở chỗ thô cao hơn thật (sân dưới, chân cầu thang hai sân: thô cao hơn thật vài mét,
// đè lên bậc thang → kẹt, anh 16/11/2026). Mỗi đỉnh lưới thô trong vùng đo: lấy điểm đo thấp nhất trong 9 m, thấp hơn thô thì hạ đỉnh về đó − 0,5 m
// (mặt đất mịn đo từ ảnh phủ lên trên). Sau GOC_Y để gốc toạ độ không đổi.
const CAO_THO = Float32Array.from(G.cao); // lưới thô GỐC (trước khi hạ): số đo lệch từng khối (neuschwanstein-nen.json) đo so với chân tường tính trên lưới này
const caoTho = (x, z) => { const fx = (x + NUA) / B, fz = (z + NUA) / B, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = (a, b) => CAO_THO[Math.max(0, Math.min(n - 1, b)) * n + Math.max(0, Math.min(n - 1, a))]; return (o(i, j) * (1 - u) + o(i + 1, j) * u) * (1 - v) + (o(i, j + 1) * (1 - u) + o(i + 1, j + 1) * u) * v; };
if (NEN?.diem?.length) {
  const [hx0, hx1, hz0, hz1] = NEN.hop, o = new Map(), K = 9;
  for (const [x, z, y] of NEN.diem) { const k = Math.floor(x / K) + ',' + Math.floor(z / K); const v = o.get(k); if (v == null || y < v) o.set(k, y); }
  let ha = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -NUA + i * B, z = -NUA + j * B; if (x < hx0 || x > hx1 || z < hz0 || z > hz1) continue;
    let m = Infinity; for (let r = 1; r <= 4 && m === Infinity; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const v = o.get((Math.floor(x / K) + a) + ',' + (Math.floor(z / K) + b)); if (v != null) m = Math.min(m, v); } // nới dần tới 36 m: trong nhà không có điểm đo (ảnh 3D chỉ thấy mái) — trước giữ gò đất thô 33 m trong khối cổng, chặn lối xuyên cổng
    if (m === Infinity) continue; const yThat = m + GOC_Y - 0.5, id = j * n + i; if (yThat < G.cao[id]) { G.cao[id] = yThat; ha++; } }
  console.info('[ns] hạ lưới đất thô theo ảnh 3D:', ha, 'đỉnh');
}
const LOP_OSM = [], CAY_VA = [], CAY_XZ = []; // lớp vẽ dựng-từ-số-đo (địa hình, khối nhà, rừng, cầu) + va chạm thân cây — ẩn / tắt khi bật ẢNH THẬT 3D
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
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; scene.add(m); LOP_OSM.push(m);
  // CẢNH XA (canhxa.js): ảnh trực giao lên lưới này + vòng 2,1 km và 10 km quanh — tải sau, không chặn trang; ảnh thật 3D đang bật thì ẩn như lớp mô hình
  datCanhXa({ THREE, scene, ten, luoiTrong: m, caoDat, NUA, GOC_Y, nhe: CHAM }).then((ds) => { for (const o of ds) { o.visible = !LOP_OSM.dangAn; LOP_OSM.push(o); } }).catch((e) => console.warn('[ns] cảnh xa', e));
}

// ---------- vật lý: mặt đất = lưới độ cao (Rapier heightfield, cột trước: heights[i*n + j] với i theo x, j theo z)
try { await RAPIER.init(); } catch (e) { console.warn('[ns] không nạp được vật lý', e); }
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }), tinh = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
{
  const h = new Float32Array(n * n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h[i * n + j] = G.cao[j * n + i] - GOC_Y;
  LOP_OSM.vaDat = world.createCollider(RAPIER.ColliderDesc.heightfield(n - 1, n - 1, h, { x: 2 * NUA, y: 1, z: 2 * NUA }), tinh); // ảnh thật 3D bật: tắt, đi trên mặt mô hình Google
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
  // dời mặt bằng theo ảnh 3D (sua.json dich_x / dich_z, m — đo bằng scripts/dang-ky-khoi.mjs: OSM vẽ lệch chỗ thật vài mét)
  if (+k.tags.dich_x || +k.tags.dich_z) v = v.map(([x, z]) => [x + (+k.tags.dich_x || 0), z + (+k.tags.dich_z || 0)]);
  const f = +k.tags.phong; if (f > 0) { const [cx, cz] = tamDa(v); v = v.map(([x, z]) => [cx + (x - cx) * f, cz + (z - cz) * f]); } // sửa theo ảnh: phóng mặt bằng
  return { ...k, v, la: !!k.tags['building:part'], vo: !!k.tags.building && !k.tags['building:part'] };
}).filter((k) => k.v.length >= 3 && (k.la || k.vo) && k.tags.building !== 'courtyard' && k.tags.building !== 'roof');
// MẶT ĐẤT THẬT quanh lâu đài (ảnh 3D Google) thay lưới EU-DEM (ô 12 m; ở mỏm đá thấp ~20 m so với thật): bỏ điểm cao hơn mặt sân trên + 3 m (mái, tháp, tán cây),
// lọc mở 3 m (co rồi giãn — bỏ tán cây / mép mái lẻ), lấp chỗ dưới nhà bằng trung bình lân cận, hoà vào lưới cũ trong 10 → 20 m quanh khối lâu đài, chỉ nâng không hạ.
// datThat(x, z) = mặt đất (toạ độ cảnh) — dùng cho mặt đứng được, móng, dãy vòm, cửa tháp; caoDat giữ cho địa hình xa + chân tường (tường chạy xuống tới vách đá)
const NEN_LUOI = (() => {
  if (!NEN?.diem?.length) return null;
  const [x0, x1, z0, z1] = NEN.hop, B = NEN.buoc, W = Math.round((x1 - x0) / B) + 1, H = Math.round((z1 - z0) / B) + 1, N = W * H, id = (i, j) => j * W + i;
  const R = new Float32Array(N).fill(NaN), tran = NEN.san + 3;
  // khối thêm (sua.json "them/…"): do-khoi-google chỉ bỏ điểm trong mặt bằng OSM → mái khối thêm nằm trong số đo mặt đất (gò đá giả cao bằng mái) — bỏ, nới 0,75 m
  const vThem = dsKhoi.filter((k) => k.them).map((k) => k.v), trongThem = (x, z) => vThem.some((v) => [[0, 0], [0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([a, b]) => trongDa(x + a, z + b, v)));
  for (const [x, z, y] of NEN.diem) { const i = Math.round((x - x0) / B), j = Math.round((z - z0) / B); if (i >= 0 && i < W && j >= 0 && j < H && y <= tran && !trongThem(x, z)) R[id(i, j)] = y; }
  const loc = (A, f, r) => { const O = new Float32Array(N).fill(NaN); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let v = A[id(i, j)]; if (Number.isNaN(v)) continue;
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const q = A[id(ii, jj)]; if (!Number.isNaN(q)) v = f(v, q); } O[id(i, j)] = v; } return O; };
  // TRUNG VỊ 5 × 5 (thay lọc mở min → max: ở mép vực, min kéo mặt đất tụt xuống đáy vực — chân cầu thang sân dưới thấp hơn ảnh 3D 7 m, cổng Torbau mọc
  // một bức tường đá cao vút, anh 16/11/2026). Trung vị vẫn bỏ cây / mép mái lẻ mà giữ mép bậc.
  const giuaO = (A, r) => { const O = new Float32Array(N).fill(NaN); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (Number.isNaN(A[id(i, j)])) continue; const v = [];
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const q = A[id(ii, jj)]; if (!Number.isNaN(q)) v.push(q); }
    v.sort((p, q) => p - q); O[id(i, j)] = v[v.length >> 1]; } return O; };
  let C = giuaO(R, 2);
  for (let lan = 0; lan < 14; lan++) { const O = C.slice(); let con = 0; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (!Number.isNaN(C[id(i, j)])) continue; let t = 0, n = 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const q = C[id(ii, jj)]; if (!Number.isNaN(q)) { t += q; n++; } } if (n) O[id(i, j)] = t / n; else con++; } C = O; if (!con) break; }
  const lau = D.khoi.filter((k) => k.tags.height || k.tags['building:part'] || k.tags.building === 'courtyard').map((k) => k.ngoai?.[0]).filter((v) => v && v.length > 2 && Math.hypot(...tamDa(v)) < 100); // khối LÂU ĐÀI (có chiều cao OSM); nhà hàng / ki-ốt dưới dốc không có — vùng đó là tán rừng, không nâng
  const kc = (x, z) => { let m = 1e9; for (const v of lau) { if (trongDa(x, z, v)) return 0; for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } } return m; };
  const G = new Float32Array(N), nang = new Float32Array(N);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * B, z = z0 + j * B, dem = caoDat(x, z) - GOC_Y, c = C[id(i, j)], w = Math.max(0, Math.min(1, Math.min(x - x0, x1 - x, z - z0, z1 - z) / 10)); // dùng số đo ở MỌI chỗ có số đo, chỉ hoà dần 10 m ở mép vùng đo (trước: chỉ trong 20 m quanh khối lâu đài → sân dưới, chân cầu thang tụt về lưới thô 7 m)
    const d = Number.isNaN(c) ? 0 : (c - dem) * w; G[id(i, j)] = dem + d; nang[id(i, j)] = Math.abs(d); } // có dấu: lưới thô đã hạ dưới mặt đo, mặt đo nằm trên
  // SÂN TRÊN PHẲNG (anh 16/11/2026: thiếu cầu thang): đo ảnh 3D ra một dốc liền từ sân trên xuống sân dưới (lưới lấp chỗ trống + cây / tường lẫn vào) nên vùi
  // mất cầu thang OSM nối hai sân; ngoài đời sân trên phẳng ở mặt sân đo được (NEN.san) — trong mặt bằng sân (OSM courtyard) đặt đúng mức đó
  const sanV = D.khoi.find((k) => k.tags.building === 'courtyard')?.ngoai?.[0];
  // DẢI SÁT TƯỜNG quanh sân (anh 17/11/2026, ảnh mặt Palas hướng sân: mặt lát gợn sóng cao tới bậu cửa): đa giác sân OSM dừng cách chân tường vài mét, dải giữa
  // bám mặt đất ảnh 3D (lẫn chân tường → gồ lên 0,6–1,3 m). Trong sân, và ô cách đa giác sân ≤ 6 m VÀ cách tường một khối nhà ≤ 2,5 m: đúng mức sân (lệch > 3 m thì giữ).
  const kcCanh = (x, z, v) => { let m = 1e9; for (let q = 0; q < v.length; q++) { const [ax, az] = v[q], [bx, bz] = v[(q + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const nhaSan = sanV ? dsKhoi.filter((k) => k.tags.building !== 'courtyard' && kcCanh(...tamDa(k.v), sanV) < 40) : [];
  // gọi HAI lần: ở đây và CUỐI CÙNG (sau san nền dưới đường / dốc 12 % — các bước đó chỉ NÂNG theo tim lối đi bộ trong sân, kéo dải sát tường gồ lại)
  const sanPhangHoa = () => { if (sanV && Number.isFinite(NEN.san)) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * B, z = z0 + j * B, trong = trongDa(x, z, sanV);
    if (!trong && !(kcCanh(x, z, sanV) <= 6 && nhaSan.some((k) => kcCanh(x, z, k.v) <= 2.5 || trongDa(x, z, k.v)))) continue;
    const dem = caoDat(x, z) - GOC_Y, hien = trong ? dem : G[id(i, j)]; if (Math.abs(hien - NEN.san) > 3 && (!trong || hien > NEN.san)) continue; if (!trong && hien < NEN.san) continue;   // ngoài sân chỉ HẠ gồ, không nâng (nâng bịt đầu cầu thang xuống sân dưới — bài thử p-bac9)   // lệch > 3 m: vật thật (bậc, bệ) — giữ; ngoài sân xét mặt hiện tại (lưới thô dưới nhà lệch chục mét)
    // trước: trong sân lấy max(mặt đo, mức sân) → chỉ nâng, gồ 0,4–0,7 m sát chân tường (ảnh 3D lẫn chân tường) còn nguyên, mặt lát gợn tới bậu cửa
    G[id(i, j)] = NEN.san; nang[id(i, j)] = Math.abs(G[id(i, j)] - dem); } };
  sanPhangHoa();
  // mặt đất ĐO GỐC (trước khi san sân lát / nền đường / sân trước cổng): mốc chân nhà (datCao) tính trên lưới này — san sân không được kéo cả khối nhà
  // lên xuống (sân dưới phẳng lại làm Torbau tụt 2 m, lệch mặt đông vừa khớp ảnh, anh 16/11/2026)
  const G_GOC = G.slice();
  // SÂN LÁT KHÉP KÍN (OSM pedestrian khép kín, vd "Unterer Hof"): mặt sân là một MẶT PHẲNG nghiêng nhẹ — khớp mặt phẳng (bình phương nhỏ nhất, bỏ điểm lệch > 1,5 m,
  // chỉ lấy điểm đo cách mép sân ≥ 3 m) rồi đặt cả sân theo đó. Sát tường ảnh 3D lẫn mái / tường → đo ra gò 3–4 m ngay sau vòm cổng Torbau (anh 16/11/2026).
  // Sân trên (building=courtyard) đã phẳng theo NEN.san ở trên — bỏ qua.
  const keMep = (x, z, v) => { let m = 1e9; for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  for (const d of DUONG?.duong || []) { if (!['pedestrian', 'footway'].includes(d.loai) || d.v.length < 4 || Math.hypot(d.v[0][0] - d.v.at(-1)[0], d.v[0][1] - d.v.at(-1)[1]) > 0.3) continue;
    const v = d.v.slice(0, -1), xs = v.map((p) => p[0]), zs = v.map((p) => p[1]); if (Math.max(...xs) < x0 || Math.min(...xs) > x1 || Math.max(...zs) < z0 || Math.min(...zs) > z1) continue;
    const trong = [], loi = [];
    // đỉnh trong nhà sát sân (≤ 3 m) cũng theo mặt sân: không vẽ nhưng là góc các ô mép — giữ gò cũ thì thành gờ chắn lối ra vòm cổng
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * B, z = z0 + j * B; if (sanV && trongDa(x, z, sanV)) continue; const o = trongDa(x, z, v); if (!o && !(keMep(x, z, v) < 3 && dsKhoi.some((k) => trongDa(x, z, k.v)))) continue; trong.push(id(i, j)); if (!o) continue; if (!Number.isNaN(R[id(i, j)]) && keMep(x, z, v) >= 3) loi.push([x, z, R[id(i, j)]]); }
    if (loi.length < 20) continue;
    let c = null, dung = loi;
    for (let lan = 0; lan < 3; lan++) { let [n0, sx, sz, sy, sxx, szz, sxz, sxy, szy] = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const [x, z, y] of dung) { n0++; sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; }
      const M = [[n0, sx, sz, sy], [sx, sxx, sxz, sxy], [sz, sxz, szz, szy]]; for (let r = 0; r < 3; r++) { for (let k = r + 1; k < 3; k++) { const f = M[k][r] / M[r][r]; for (let q = r; q < 4; q++) M[k][q] -= f * M[r][q]; } }
      const cc = [0, 0, 0]; for (let r = 2; r >= 0; r--) { let t = M[r][3]; for (let q = r + 1; q < 3; q++) t -= M[r][q] * cc[q]; cc[r] = t / M[r][r]; } c = cc;
      dung = loi.filter(([x, z, y]) => Math.abs(y - (c[0] + c[1] * x + c[2] * z)) < 1.5); if (dung.length < 20) break; }
    if (!c || !c.every(Number.isFinite) || Math.hypot(c[1], c[2]) > 0.2) continue; // dốc > 0,2: vùng bậc / sườn (bãi lát dưới dốc 60 m, dốc 0,26), không phải một sân phẳng — giữ số đo
    // sân lát gần phẳng: dốc khớp > 0,06 thì giảm về 0,06 quanh trọng tâm điểm đo (số đo ảnh 3D lẫn tường kéo dốc 0,19 → chân cánh nam Torbau thấp 2 m,
    // khung tường cao/rộng 1,13 so với ảnh 0,95 — kiểm khung, anh 16/11/2026)
    { const g = Math.hypot(c[1], c[2]); if (g > 0.06) { const mx = dung.reduce((t, p) => t + p[0], 0) / dung.length, mz = dung.reduce((t, p) => t + p[1], 0) / dung.length, my = c[0] + c[1] * mx + c[2] * mz, f = 0.06 / g; c = [my - c[1] * f * mx - c[2] * f * mz, c[1] * f, c[2] * f]; } }
    // NEO cao độ sân lấy từ KHUNG TƯỜNG đo trên ảnh (sua.json "<id sân>".neo_mat_dat = [[x, z, y], …]): dời mặt phẳng lên / xuống cho khớp trung bình các neo
    const neo = SUA[d.id]?.neo_mat_dat; if (Array.isArray(neo) && neo.length) { const dy = neo.reduce((t, [x, z, y]) => t + y - (c[0] + c[1] * x + c[2] * z), 0) / neo.length; c = [c[0] + dy, c[1], c[2]]; }
    for (const q of trong) { const i = q % W, j = (q - i) / W; G[q] = c[0] + c[1] * (x0 + i * B) + c[2] * (z0 + j * B); nang[q] = Math.max(nang[q], 0.2); }
    console.info('[ns] sân phẳng', d.ten || d.id, JSON.stringify({ diem: dung.length, doc: +Math.hypot(c[1], c[2]).toFixed(3) }));
  }
  // SAN NỀN DƯỚI ĐƯỜNG: mặt đất ngang đường lấy đúng cao độ TIM đường (đường rộng 5 m trên sườn lồi: đất giữa hai mép cao hơn mặt đường tới 1,5 m → cỏ trùm
  // giữa đường lên cổng Torbau, anh 16/11/2026); hoà dần ra ngoài 1,5 m. Bỏ cầu thang (bậc riêng), cầu, hầm, vùng lát khép kín (đã phẳng theo đất).
  const G0 = G.slice(), bil = (x, z) => { const fx = Math.max(0, Math.min(W - 1.001, (x - x0) / B)), fz = Math.max(0, Math.min(H - 1.001, (z - z0) / B)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (G0[id(i, j)] * (1 - u) + G0[id(i + 1, j)] * u) * (1 - v) + (G0[id(i, j + 1)] * (1 - u) + G0[id(i + 1, j + 1)] * u) * v; };
  // ĐỘ CAO TIM ĐƯỜNG Ô TÔ: dốc tối đa 12 % — số đo ảnh 3D sát mép bệ tường chắn rơi xuống sườn dưới (đường lên cổng Torbau lõm 11 m trong 30 m rồi leo lại,
  // ngoài đời đường dốc đều, sân trước cổng phẳng; ảnh Mapillary 360° 2019, anh 16/11/2026). Chỉ NÂNG chỗ bị kéo tụt (giãn dốc từ các điểm cao lân cận), không hạ.
  const OTO = ['service', 'residential', 'unclassified'], nhaVo = dsKhoi.filter((k) => k.vo), trongNha0 = (x, z) => nhaVo.some((k) => trongDa(x, z, k.v));
  // sát nhà (≤ 0,75 m): đất đo lẫn tường / mái → mẫu tim đường ngay mép cổng không làm nguồn (trước: ngưỡng cổng Torbau 13,3 m, dốc 2,3 m chạy vào vòm)
  const satNha = (x, z) => trongNha0(x, z) || [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([a, b]) => trongNha0(x + a, z + b));
  const DOC_MAX = 0.12, MAU_DUONG = [];
  const hoSo = (d) => { // mẫu 1 m dọc tim: s, x, z, h (đất), trong (trong nhà: không làm nguồn)
    const S = [], X = [], Z = [], Hh = [], Tr = [], dau = []; let s0 = 0;
    for (let k = 0; k + 1 < d.v.length; k++) { const [ax, az] = d.v[k], [bx, bz] = d.v[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L)); dau.push(s0);
      for (let m = 0; m < n || (k + 2 === d.v.length && m === n); m++) { const t = m / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; S.push(s0 + L * t); X.push(x); Z.push(z); Hh.push(bil(x, z)); Tr.push(satNha(x, z)); } s0 += L; }
    const Y = Hh.slice();
    if (OTO.includes(d.loai)) for (let i = 0; i < S.length; i++) { if (Tr[i]) continue; for (let j = 0; j < S.length; j++) if (!Tr[j]) Y[i] = Math.max(Y[i], Hh[j] - DOC_MAX * Math.abs(S[i] - S[j])); }
    if (OTO.includes(d.loai)) for (let i = 0; i < S.length; i++) if (!Tr[i]) MAU_DUONG.push([X[i], Z[i], Y[i]]);
    return { dau, cao: (s) => { let i = 1; while (i < S.length - 1 && S[i] < s) i++; const t = Math.max(0, Math.min(1, (s - S[i - 1]) / ((S[i] - S[i - 1]) || 1))); return Y[i - 1] + (Y[i] - Y[i - 1]) * t; } };
  };
  const san = new Float32Array(N).fill(NaN), tsan = new Float32Array(N), esan = new Float32Array(N).fill(1e9); // esan: khoảng cách tới tim — chỗ cua gấp hai đoạn chồng nhau lấy tim GẦN nhất
  for (const d of DUONG?.duong || []) { if (d.loai === 'steps' || d.cau || d.ham || d.v.length < 2) continue; if (d.v.length > 3 && Math.hypot(d.v[0][0] - d.v.at(-1)[0], d.v[0][1] - d.v.at(-1)[1]) < 0.3) continue;
    const r0 = (d.rong || 2) / 2 + 0.6, r1 = r0 + 1.5, hs = hoSo(d);
    for (let k = 0; k + 1 < d.v.length; k++) { const [ax, az] = d.v[k], [bx, bz] = d.v[k + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; if (l2 < 0.01) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r1 - x0) / B)), i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + r1 - x0) / B)), j0 = Math.max(0, Math.floor((Math.min(az, bz) - r1 - z0) / B)), j1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + r1 - z0) / B));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = x0 + i * B, z = z0 + j * B, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), cx = ax + dx * t, cz = az + dz * t, e = Math.hypot(x - cx, z - cz); if (e > r1) continue;
        const w = e <= r0 ? 1 : 1 - (e - r0) / (r1 - r0), q = id(i, j); if (w > tsan[q] || (w === tsan[q] && e < esan[q])) { tsan[q] = w; esan[q] = e; san[q] = hs.cao(hs.dau[k] + t * Math.sqrt(l2)); } } } }
  for (let q = 0; q < N; q++) if (tsan[q] > 0) { G[q] = G0[q] + (san[q] - G0[q]) * tsan[q]; nang[q] = Math.max(nang[q], 0.2); }
  // SÂN TRƯỚC CỔNG NGOÀI (ảnh Mapillary 360°: sân nhựa rộng phẳng từ chân Torbau ra tới lan can mép vực): ô cổng = đỉnh đường ô tô nằm trên mép nhà; cổng ngoài =
  // ô cổng có đường ra ngoài xa thân lâu đài nhất. Sân = bao lồi các mẫu tim đường trong 16 m quanh cổng, nới nửa bề rộng đường + 3 m (tới lan can, theo ảnh 360°);
  // mặt sân nội suy từ cao độ tim đường đã chỉnh dốc
  let sanCong = null, caoSan = null;
  {
    const dinh = (DUONG?.duong || []).filter((d) => OTO.includes(d.loai) && !d.cau && !d.ham).flatMap((d) => d.v.map((p) => [...p, d.rong || 5])), tamLau = tamDa(dsKhoi.flatMap((k) => k.v)), kc = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let cg = null;
    const sanKin = (DUONG?.duong || []).filter((d) => ['pedestrian', 'footway'].includes(d.loai) && d.v.length > 3 && kc(d.v[0], d.v.at(-1)) < 0.3).map((d) => d.v); // phía trong cổng là sân khép kín
    for (const c of dinh) { if (!nhaVo.some((k) => k.v.some((q) => kc(c, q) < 0.3))) continue; const p = dinh.filter((p) => kc(p, c) >= 2 && kc(p, c) <= 15 && !trongNha0(p[0], p[1]) && !sanKin.some((v) => trongDa(p[0], p[1], v))).sort((a, b) => Math.abs(kc(a, c) - 6) - Math.abs(kc(b, c) - 6))[0]; if (!p) continue; const xa = kc(p, tamLau); if (!cg || xa > cg.xa) cg = { c, p, xa, rong: p[2] }; }
    // chỉ phía NGOÀI cổng: đoạn thẳng từ mẫu tới đỉnh đường ngoài cổng không xuyên nhà (mẫu đường phía sân trong làm bao lồi xuyên qua Torbau)
    const thay = (a, b) => { const L = kc(a, b), n = Math.ceil(L); for (let i = 1; i < n; i++) { const t = i / n; if (trongNha0(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; } return true; };
    const mau = cg ? MAU_DUONG.filter(([x, z]) => kc([x, z], cg.c) <= 16 && !sanKin.some((v) => trongDa(x, z, v)) && thay([x, z], cg.p)) : [];
    // sân chạy dọc MẶT TIỀN nhà có cổng (ảnh 360° tại cổng: sân + lan can kéo tiếp lên phía bắc dọc mặt đông Torbau): đỉnh mặt tiền ≤ 20 m quanh cổng (tới tháp tròn góc), lùi ra 3 m
    // (dải bồn sát chân nhà), nhìn thấy từ đường ngoài cổng → thêm vào bao lồi
    const nhaCong = cg && nhaVo.find((k) => k.v.some((q) => kc(cg.c, q) < 0.3)), mt = !nhaCong ? [] : nhaCong.v.filter((q) => kc(q, cg.c) <= 20).map((q) => { const l = kc(q, cg.p) || 1; return [q[0] + (cg.p[0] - q[0]) / l * 3, q[1] + (cg.p[1] - q[1]) / l * 3]; }).filter((q) => !trongNha0(q[0], q[1]) && thay(q, cg.p));
    // nới bao lồi = nửa bề rộng đường + 3 m: lan can phía vực cách tim đường ~7 m (ảnh Mapillary 360° 990990575063069 tại khúc cua, 461885445095370 trước cổng: lan can cách ~8 m)
    if (SAN_CONG?.san?.length > 2) { // sân đo trên ảnh trực giao: mặt phẳng đúng cao độ đo, mép đúng đa giác (lan can / tường chắn bám theo vungLat)
      sanCong = SAN_CONG.san; caoSan = () => SAN_CONG.y;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * B, z = z0 + j * B; if (!trongDa(x, z, sanCong) || trongNha0(x, z)) continue; const q = id(i, j); G[q] = SAN_CONG.y; nang[q] = Math.max(nang[q], 0.2); }
      console.info('[ns] sân trước cổng theo ảnh trực giao:', JSON.stringify({ dinh: sanCong.length, y: SAN_CONG.y, co: (SAN_CONG.co || []).length }));
    } else if (mau.length > 6) { const r = cg.rong / 2 + 3, ds = [...mt, ...mau.flatMap(([x, z]) => Array.from({ length: 12 }, (_, a) => [x + Math.cos(a * Math.PI / 6) * r, z + Math.sin(a * Math.PI / 6) * r]))];
      ds.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
      for (const p of ds) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); } for (const p of ds.slice().reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
      sanCong = [...lo.slice(0, -1), ...hi.slice(0, -1)];
      caoSan = (x, z) => { let t = 0, w = 0; for (const [mx, mz, my] of mau) { const q = 1 / (0.25 + (x - mx) ** 2 + (z - mz) ** 2); t += q * my; w += q; } return t / w; }; // mặt sân (cùng công thức với lưới) — lan can mép sân bám theo
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * B, z = z0 + j * B; if (!trongDa(x, z, sanCong) || trongNha0(x, z)) continue;
        let t = 0, w = 0; for (const [mx, mz, my] of mau) { const q = 1 / (0.25 + (x - mx) ** 2 + (z - mz) ** 2); t += q * my; w += q; } const q = id(i, j); G[q] = t / w; nang[q] = Math.max(nang[q], 0.2); }
      // BỒN SÁT CHÂN NHÀ (ảnh Mapillary: dải cỏ / sỏi có bó vỉa dọc Torbau): đất ngoài sân ≤ 4 m mép sân và ≤ 4 m chân nhà → phẳng, cao hơn mặt sân 0,12 m
      // (đất đo sát tường lẫn tường / mái → gò đá lồi lõm)
      const ganNha = (x, z) => [[4, 0], [-4, 0], [0, 4], [0, -4], [2.8, 2.8], [-2.8, 2.8], [2.8, -2.8], [-2.8, -2.8]].some(([a, b]) => trongNha0(x + a, z + b));
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * B, z = z0 + j * B; if (trongDa(x, z, sanCong) || keMep(x, z, sanCong) > 4 || !ganNha(x, z)) continue; // đỉnh trong nhà cũng đặt (không vẽ, nhưng là góc ô mép — giữ số đo lẫn tường thì thành mũi đá nhọn)
        let t = 0, w = 0; for (const [mx, mz, my] of mau) { const q = 1 / (0.25 + (x - mx) ** 2 + (z - mz) ** 2); t += q * my; w += q; } const q = id(i, j); G[q] = t / w + 0.12; nang[q] = Math.max(nang[q], 0.2); }
      console.info('[ns] sân trước cổng ngoài:', JSON.stringify({ cong: cg.c.slice(0, 2), mau: mau.length, dinh: sanCong.length }));
    }
  }
  sanPhangHoa();
  return { x0, z0, B, W, H, G, G_GOC, nang, id, sanCong, caoSan };
})();
function datThat(x, z) {
  const L = NEN_LUOI; if (!L) return caoDat(x, z) - GOC_Y;
  const fx = (x - L.x0) / L.B, fz = (z - L.z0) / L.B, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= L.W - 1 || j >= L.H - 1) return caoDat(x, z) - GOC_Y;
  const u = fx - i, v = fz - j, g = (a, b) => L.G[L.id(a, b)];
  return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
}
const parts = dsKhoi.filter((k) => k.la);
for (const k of dsKhoi) if (k.vo) k.coPart = parts.some((p) => { const [x, z] = tamDa(p.v); return trongDa(x, z, k.v); });
// đáy chung: điểm thấp nhất của mặt đất dưới vỏ nhà (part dùng đáy của vỏ chứa nó) → tường chạy xuống tới đá, không lơ lửng
const dayCua = (v) => Math.min(...v.map(([x, z]) => caoDat(x, z))) - GOC_Y;
for (const k of dsKhoi) if (k.vo) { k.day = dayCua(k.v); k.dayDo = Math.min(...k.v.map(([x, z]) => caoTho(x, z))) - GOC_Y; } // dayDo: chân theo lưới thô gốc — chỉ để cộng số đo lệch (đo trên lưới gốc)
for (const p of parts) { const [x, z] = tamDa(p.v); const vo = dsKhoi.find((k) => k.vo && trongDa(x, z, k.v)); p.day = vo ? vo.day : dayCua(p.v); }
// MỐC CHÂN NHÀ: chiều cao OSM tính từ MẶT ĐẤT THẬT quanh nhà (đo: đỉnh Google − chiều cao OSM ≈ mặt sân / mặt đất cạnh nhà), không từ lưới đất thô.
// Vỏ nhà: trung vị (đỉnh Google − chiều cao OSM) của các khối đo tốt (≥ 40 điểm); khối con dùng mốc của vỏ; không có số đo → mặt đất thật cao nhất quanh nhà.
// Khối đo tốt mà đỉnh lệch OSM quá 2,5 m → chiều cao theo Google (ghi k.suaGoogle). Chân tường vẫn chạy xuống tới đất thấp nhất (k.day).
const GOC_OSM = new URLSearchParams(location.search).get('goc') === 'osm'; // công cụ đo: dựng thuần OSM để so cặp
const NK = GOC_OSM ? {} : NEN?.khoi || {}, doTot = (k) => (NK[k.id]?.[1] ?? 0) >= 40 && (NK[k.id]?.[3] ?? 0) <= 3, // đủ điểm + mặt đo phẳng đều (độ trải ≤ 3 m) — chóp nhọn / tháp nhỏ trên mái làm trải rộng, không lấy
  lechK = (k) => NK[k.id][0]; // lệch = mặt Google − mặt khối thuần OSM (trung vị từng điểm)
const chieuCao = (t) => so(t.height) ?? (so(t['building:levels']) ? so(t['building:levels']) * 3.2 + (so(t['roof:height']) || 0) : 8);
const giua = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
if (!GOC_OSM) {
  for (const k of dsKhoi) if (k.vo) { const con = parts.filter((p) => trongDa(...tamDa(p.v), k.v)), ds = (con.length ? con : [k]).filter(doTot).map(lechK); k.ref = ds.length ? k.dayDo + giua(ds) : null; }
  for (const p of parts) { const vo = dsKhoi.find((k) => k.vo && trongDa(...tamDa(p.v), k.v)); p.ref = vo?.ref ?? (doTot(p) ? (vo?.dayDo ?? p.day) + lechK(p) : null); }
  for (const k of dsKhoi) { if (k.ref == null) k.ref = Math.max(k.day, ...k.v.map(([x, z]) => datGoc(x, z))); // đất đo gốc: san sân / đường không kéo khối nhà lên xuống
    if (doTot(k) && (k.la || !k.coPart)) { const r = (k.dayDo ?? dsKhoi.find((q) => q.vo && trongDa(...tamDa(k.v), q.v))?.dayDo ?? k.day) + lechK(k) - k.ref; if (Math.abs(r) > 2.5) { k.suaGoogle = +r.toFixed(1); k.tags.height = String(chieuCao(k.tags) + r); } }
    // chóp nhọn (cone / pyramidal): mặt đo trải rộng nên không qua doTot — đỉnh lấy đỉnh đo (phân vị 98) trên ảnh 3D, chỉ nâng; thân giữ nguyên, chóp dài thêm
    // khối có y_tren trong tệp sửa: độ cao tuyệt đối + roof:height đã đo → không cộng thêm chóp theo Google (y_tren thắng mọi chỉnh, xem dưới)
    else if (k.tags.y_tren == null && /^(cone|pyramidal)$/.test(k.tags['roof:shape'] || '') && (NK[k.id]?.[1] ?? 0) >= 12 && NK[k.id][2] > k.ref + chieuCao(k.tags) + 2.5) {
      const them = NK[k.id][2] - (k.ref + chieuCao(k.tags)); k.suaGoogle = +them.toFixed(1); k.tags.height = String(chieuCao(k.tags) + them); k.tags['roof:height'] = String((so(k.tags['roof:height']) || 4) + them);
    } }
}
// MÁI HIÊN ĐO TRÊN ẢNH CHÍNH DIỆN (cua-so.json yHien, trung vị các mặt của khối): chân mái = đó, đỉnh giữ nguyên → mái cao đúng, tường không cao thừa
if (!GOC_OSM) for (const k of dsKhoi) {
  const ds = Object.entries(CUA_SO).filter(([key, v]) => key.startsWith(k.id + '#') && Number.isFinite(v?.yHien)).map(([, v]) => v.yHien);
  if (!ds.length || (k.tags['roof:shape'] || 'flat') === 'flat' || k.ref == null || k.id === MAT_BO?.neo?.khoi) continue; // khối neo mặt sân: mái do tệp bố cục mặt sân quyết
  if (SUA[k.id]?.ly_do_mai_dom20) continue; // chân mái + nóc đã ghi theo số đo chính thức (sua.json roof:height + y_tren) — không tính lại từ đỉnh cũ
  const dinh = k.tags.y_tren != null ? +k.tags.y_tren : k.ref + chieuCao(k.tags), rh /* 20/11/2026: khối có y_tren thì đỉnh LÀ y_tren (trước lấy đỉnh cũ → hạ nóc Palas 12,9 m mà mái vẫn cao 25,8 m, tường tụt 13 m) */ = dinh - giua(ds); if (rh > 1 && rh < chieuCao(k.tags) - 3) { k.tags['roof:height'] = String(rh); k.maiHienDo = +giua(ds).toFixed(1); }
}
// ĐỘ CAO TUYỆT ĐỐI trong tệp sửa theo ảnh (y_tren / y_duoi, toạ độ cảnh đo trên ảnh 3D) → height / min_height theo mốc chân nhà vừa tính (thắng mọi chỉnh trên)
for (const k of dsKhoi) { const t = k.tags; if (t.y_tren == null && t.y_duoi == null) continue; const goc = k.ref ?? k.day;
  if (t.y_tren != null) t.height = String(+t.y_tren - goc); if (t.y_duoi != null) t.min_height = String(+t.y_duoi - goc); k.suaGoogle = null; }
// MẶT PALAS HƯỚNG SÂN đo trên ảnh (tệp bố cục): tỉ lệ đứng từ hai mốc Google (đỉnh khối neo + mặt sân trên) → đầu hồi (roof:height khối neo),
// cao độ hai tháp góc theo ảnh; sàn nội thất tầng ba = bậu hàng cửa tầng hai của mặt này
const MAT_SAN = NEN?.san ?? null;
const KHOI_NEO = !GOC_OSM && MAT_BO?.neo ? dsKhoi.find((k) => k.id === MAT_BO.neo.khoi && k.ref != null) : null, DINH_NEO = KHOI_NEO ? KHOI_NEO.ref + chieuCao(KHOI_NEO.tags) : null; // đỉnh khối neo sau khi khớp ảnh 3D
// tỉ lệ đứng mặt sân: hai mốc đỉnh khối neo + mặt sân. CHƯA NHẤT QUÁN (15/11/2026): ra 31,8 px/m trong khi ngang 41,2 px/m (ảnh gần chính diện → phải xấp xỉ);
// neo bằng mái hiên đo trên ảnh 3D ra 20,1 px/m — tệ hơn → giữ cách này, mặt neo không dùng mái hiên đo
const PX_DUNG = DINH_NEO != null && MAT_SAN != null ? tiLeDung(MAT_BO, DINH_NEO, MAT_SAN) : null;
const BO_MET = PX_DUNG ? quyDoiMat(MAT_BO, PX_DUNG) : null;
const MAI_SAN = BO_MET ? DINH_NEO - BO_MET.gableCao : null; // chân đầu hồi mặt sân (= y1 khối neo)
if (BO_MET) {
  const kn = dsKhoi.find((k) => k.id === MAT_BO.neo.khoi); if (kn) kn.tags['roof:height'] = String(BO_MET.gableCao);
  for (const tid of BO_MET.thap?.ids || []) { const k = dsKhoi.find((q) => q.id === tid); if (!k) continue;
    k.tags.min_height = String(MAI_SAN - BO_MET.thap.chanThan - k.ref); k.tags.height = String(MAI_SAN - BO_MET.thap.chop - k.ref); k.tags['roof:height'] = String(BO_MET.thap.chanChop - BO_MET.thap.chop); }
  console.info('[ns] mặt Palas hướng sân: tỉ lệ đứng', PX_DUNG.toFixed(1), 'px/m · đầu hồi', BO_MET.gableCao.toFixed(1), 'm · mái', MAI_SAN.toFixed(1), '· sân', MAT_SAN.toFixed(1));
}
console.info('[ns] mốc chân nhà theo ảnh 3D:', dsKhoi.filter((k) => k.suaGoogle != null).map((k) => `${k.tags.name || k.id} ${k.suaGoogle > 0 ? '+' : ''}${k.suaGoogle}`).join(' · '));

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
// mặt đất đo gốc (trước khi san) — mốc chân nhà không phụ thuộc việc san sân / đường
function datGoc(x, z) {
  const L = NEN_LUOI; if (!L?.G_GOC) return datThat(x, z);
  const fx = (x - L.x0) / L.B, fz = (z - L.z0) / L.B, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= L.W - 1 || j >= L.H - 1) return caoDat(x, z) - GOC_Y;
  const u = fx - i, v = fz - j, g = (a, b) => L.G_GOC[L.id(a, b)];
  return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
}
const dinhDat = (v) => Math.max(...v.map(([x, z]) => datGoc(x, z)));
for (const k of dsKhoi) if (k.vo) k.datCao = dinhDat(k.v);
// ---- chuẩn bị nội thất: Palas + tháp cầu thang; vách giữa các khối OSM nằm TRONG Palas bị khoét ở dải tầng ba – tầng bốn (phòng theo bản vẽ
// thay vào), mặt bắc tháp cầu thang khoét cửa vào sát mặt đất
const kcDoan = (x, z, [x1, z1], [x2, z2]) => { const dx = x2 - x1, dz = z2 - z1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - x1 - dx * t, z - z1 - dz * t); };
const kcVien = (x, z, v) => Math.min(...v.map((p, i) => kcDoan(x, z, p, v[(i + 1) % v.length])));
const NOI = (() => {
  if (!NT) return null;
  const palas = dsKhoi.find((k) => k.vo && k.tags.name === NT.palas), thap = dsKhoi.find((k) => k.id === NT.thap);
  if (!palas || !thap) return null;
  for (const k of dsKhoi) if (k.la) { const [x, z] = tamDa(k.v); k.trongPalas = trongDa(x, z, palas.v); }
  let tot = null; // cạnh bắc nhất của tháp = mặt cửa vào
  thap.v.forEach((p, i) => { const q = thap.v[(i + 1) % thap.v.length], mz = (p[1] + q[1]) / 2; if (!tot || mz < tot.mz) tot = { i, mz }; });
  const [a1, a2] = [thap.v[tot.i], thap.v[(tot.i + 1) % thap.v.length]], mx = (a1[0] + a2[0]) / 2, mz = (a1[1] + a2[1]) / 2;
  const ra = trongDa(mx, mz - 1.5, thap.v) ? 1.5 : -1.5, yCua = datThat(mx, mz - ra) + 0.05;
  const hai = BO_MET?.cum.find((c) => c.ten === 'tầng hai trái'), y3 = hai ? MAI_SAN - hai.duoi : (palas.ref ?? palas.day) + NT.tang3; // sàn tầng ba = bậu cửa tầng hai mặt sân (ảnh)
  return { palas, thap, canhCua: tot.i, yCua, y3, ngoai: [mx, mz - 2.2], dai: [y3 - 0.3, y3 + NT.caoTang3 + 0.35 + NT.caoTang4 + 0.45] };
})();
const NEO_HANG = NOI ? NOI.y3 - 0.2 : null; // hàng cửa Palas neo vào sàn tầng ba (bậu thấp hơn sàn 0,2 m) → cửa dải phòng mở được, trèo vào đứng ngay trên sàn
// lỗ trên một cạnh tường: [{ s0, s1, y0, y1 }] theo mét dọc cạnh
const SAN0 = (() => { const v = D.khoi.find((k) => k.tags.building === 'courtyard')?.ngoai?.[0]; return v ? tamDa(v) : null; })();
const huongRaSan = (x1, z1, x2, z2) => { if (!SAN0) return false; const L = Math.hypot(x2 - x1, z2 - z1), mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, d = Math.hypot(SAN0[0] - mx, SAN0[1] - mz);
  return d < 45 && ((z2 - z1) / L * (SAN0[0] - mx) - (x2 - x1) / L * (SAN0[1] - mz)) / d > 0.7; };
// VÒM CỔNG: đường ô tô / lối đi OSM cắt ngang một bức tường → khoét vòm cổng thật ở chỗ cắt (đường lên cổng Torbau xuyên khối cổng — trước đường cụt ở chân tường,
// anh 16/11/2026). Rộng theo đường + 0,6 m, cao CAO_CONG từ mặt đất; khung đá vòm dựng sau (VOM_CONG)
// SỔ KIỂM KÊ chi tiết đã dựng: { mat: "khối#cạnh" | "khối#mai" | "khối#*", loai, y } — scripts/kiem-ke.mjs gộp theo vùng mặt tường, so với <lâu>-kiem-ke.json (đếm trên ảnh)
const THIEU_ANH = []; // chi tiết có thẻ bật mà chưa có số đo / đếm trên ảnh → không dựng (trangtri.js dem.thieuAnh; scripts lấy qua window.__ns.thieuAnh)
const KIEM_KE = [], ghiKK = (mat, loai, y, n = 1, x = null, z = null, hop = null) => { if (mat) for (let i = 0; i < n; i++) KIEM_KE.push({ mat, loai, y, x, z, hop }); }; // x, z: vị trí trên mặt tường (kiểm vị trí trong khung)
const VOM_CONG = [], CAO_CONG = 6.2; // lỗ cổng cao 6,2 m tới đỉnh vòm (ảnh 360° cổng Torbau: vòm cao ~1,5 lần bề rộng; trước 4,6 m thấp lùn)
// cổng nằm trên MẶT DỰNG RIÊNG theo ảnh chụp (mặt Torbau hướng sân dưới, góp ý #1641): chiều cao lỗ lấy từ tệp bố cục (cong.cao, đo trên ảnh) thay số chung —
// cạnh tường song song + cách trục khung ≤ 1,5 m (khối cổng nhô ~1 m) là cùng mặt. Số chung 6,2 m đo ở cổng NGOÀI (phía đông); cổng phía sân thấp hơn
const CONG_RIENG = (() => { const bo = MAT_TB_BO; if (!(bo?.cong?.cao > 0) || !bo.mat?.khung) return null; const [kid, si] = bo.mat.khung.split('#'), v = dsKhoi.find((q) => q.id === kid)?.v;
  const p = v?.[+si], q = v?.[(+si + 1) % (v?.length || 1)]; if (!p || !q) return null; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); return { p, ux: (q[0] - p[0]) / L, uz: (q[1] - p[1]) / L, cao: +bo.cong.cao }; })();
function caoCong(x1, z1, x2, z2) { const C = CONG_RIENG; if (!C) return CAO_CONG; const L = Math.hypot(x2 - x1, z2 - z1), d = (x, z) => (x - C.p[0]) * C.uz - (z - C.p[1]) * C.ux;
  return Math.abs(((x2 - x1) * C.ux + (z2 - z1) * C.uz) / L) > 0.97 && Math.abs(d(x1, z1)) < 1.5 && Math.abs(d(x2, z2)) < 1.5 ? C.cao : CAO_CONG; }
const DUONG_QUA = (DUONG?.duong || []).filter((d) => !d.cau && !d.ham && ['unclassified', 'service', 'residential'].includes(d.loai) && !(d.v.length > 3 && Math.hypot(d.v[0][0] - d.v.at(-1)[0], d.v[0][1] - d.v.at(-1)[1]) < 0.3));
function cong(x1, z1, x2, z2) {
  const ra = [], L = Math.hypot(x2 - x1, z2 - z1);
  for (const d of DUONG_QUA) for (let i = 0; i + 1 < d.v.length; i++) {
    const [a1, b1] = d.v[i], [a2, b2] = d.v[i + 1], den = (x2 - x1) * (b2 - b1) - (z2 - z1) * (a2 - a1); if (Math.abs(den) < 1e-6) continue;
    const t = ((a1 - x1) * (b2 - b1) - (b1 - z1) * (a2 - a1)) / den, u = ((a1 - x1) * (z2 - z1) - (b1 - z1) * (x2 - x1)) / den;
    const w = Math.max(2.4, Math.min(5, d.rong + 0.6)), s = t * L;
    if (u < -0.02 || u > 1.02 || s < -w / 2 || s > L + w / 2) continue; // đường cắt sát GÓC tường (ngoài đầu cạnh tới nửa bề rộng cổng) vẫn khoét phần lỗ thuộc cạnh này — trước bỏ qua cạnh kề, lối cụt
    // đáy lỗ = mặt đất ngoài nhà gần nhất dọc đường (đi tiếp hai phía ≤ 5 m, cách nhà ≥ 0,75 m) — đất ngay chân tường / trong nhà đo lẫn tường, mái:
    // vòm cổng phía sân Torbau đáy 12,9 m trong khi mặt đường 17,1 m → lỗ còn 1 m, kẹt (anh 16/11/2026)
    const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, dl = Math.hypot(a2 - a1, b2 - b1) || 1, dx = (a2 - a1) / dl, dz = (b2 - b1) / dl;
    const ngoai = (px, pz) => ![[0, 0], [0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([p, q]) => dsKhoi.some((k) => trongDa(px + p, pz + q, k.v)));
    let y = null; for (let r = 0.5; r <= 5 && y == null; r += 0.5) for (const g of [1, -1]) if (y == null && ngoai(x + dx * r * g, z + dz * r * g)) y = datThat(x + dx * r * g, z + dz * r * g);
    if (y == null) y = datThat(x, z);
    const cao = caoCong(x1, z1, x2, z2);
    ra.push({ s0: Math.max(-0.1, s - w / 2), s1: Math.min(L + 0.1, s + w / 2), y0: y - 0.6, y1: y + cao, x, z, y, w, cao, ux: (x2 - x1) / L, uz: (z2 - z1) / L, trong: s > 0 && s < L });
  }
  return ra;
}
function loCanh(k, i, x1, z1, x2, z2) {
  const lo = [], L = Math.hypot(x2 - x1, z2 - z1);
  for (const c of cong(x1, z1, x2, z2)) { lo.push({ s0: c.s0, s1: c.s1, y0: c.y0, y1: c.y1 }); if (c.trong && !VOM_CONG.some((v) => Math.hypot(v.x - c.x, v.z - c.z) < 1.5)) VOM_CONG.push({ ...c, mat: k.id + '#' + i }); }
  if (!NOI) return lo;
  if (k.trongPalas || k === NOI.thap) { const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2; if (trongDa(mx, mz, NOI.palas.v) && kcVien(mx, mz, NOI.palas.v) > 0.6) {
    // vách trong: chỉ khoét tới đỉnh tường của khối bên kia (vách lộ ra trên mái khối thấp hơn mà khoét thì thủng ra trời — ô hổng mặt tây Palas, anh 16/11/2026)
    const L2 = Math.hypot(x2 - x1, z2 - z1), nx = (z2 - z1) / L2, nz = -(x2 - x1) / L2;
    const ben = [1, -1].map((d) => dsKhoi.find((q) => q !== k && q.la && trongDa(mx + nx * 0.6 * d, mz + nz * 0.6 * d, q.v)));
    const tren = Math.min(...ben.map((q) => (q ? (q.ref ?? q.day) + (so(q.tags.height) ?? 8) - (so(q.tags['roof:height']) || 0) - 0.3 : -1e9)));
    const y1 = Math.min(NOI.dai[1], tren); if (y1 > NOI.dai[0] + 2) lo.push({ s0: -1, s1: L + 1, y0: NOI.dai[0], y1 }); } }
  // cửa sổ mở được: tường ngoài Palas, hàng cửa nằm gọn trong phòng tầng ba → khoét lỗ thật ở ô giữa (bố cục chung với khung cửa 3D: mattien.js bocCuc)
  if (k.trongPalas && k._yMong != null && kcVien((x1 + x2) / 2, (z1 + z2) / 2, NOI.palas.v) <= 0.6 && !huongRaSan(x1, z1, x2, z2)) { // mặt hướng sân trên dựng riêng theo ảnh (datMatPalas) → không khoét theo bố cục chung
    const [mNua, mCao] = O_MO.ba, doTu = CUA_SO[`${k.id}#${i}`];
    if (doTu?.hang?.length) { for (const { d } of (doTu.khung ? boTriDo(doTu.hang, k._y1) : boTriDo(doTu.hang, k._y1, Number.isFinite(k.yDuoi) ? k.yDuoi : -1e9, L))) for (const o of d.o) if (o.y0 >= NOI.y3 - 0.6 && o.y1 <= NOI.y3 + NT.caoTang3 - 0.2) lo.push({ ...o, cuaSo: true }); }
    else for (const h of bocCuc({ L, yMong: k._yMong, y1: k._y1, palas: true, neo: NEO_HANG })) if (h.y >= NOI.y3 - 0.3 && h.y + mCao <= NOI.y3 + NT.caoTang3 - 0.2) for (const s of h.ds) lo.push({ s0: s - mNua, s1: s + mNua, y0: h.y, y1: h.y + mCao, cuaSo: true });
  }
  if (k === NOI.thap && i === NOI.canhCua) lo.push({ s0: L / 2 - 0.95, s1: L / 2 + 0.95, y0: NOI.yCua - 0.5, y1: NOI.yCua + 2.7 });
  if (k !== NOI.thap) { // tường khối khác chạy xuyên lòng tháp cầu thang → khoét suốt chiều cao thang (dò 48 điểm dọc cạnh)
    let dau = null; const N = 48;
    for (let j = 0; j <= N; j++) {
      const t = j / N, trong = trongDa(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, NOI.thap.v);
      if (trong && dau == null) dau = t; if ((!trong || j === N) && dau != null) { lo.push({ s0: dau * L - 0.3, s1: (trong ? 1 : t) * L + 0.3, y0: NOI.yCua - 0.5, y1: NOI.dai[1] }); dau = null; }
    }
  }
  return lo;
}
for (const p of parts) { const [x, z] = tamDa(p.v); const vo = dsKhoi.find((k) => k.vo && trongDa(x, z, k.v)); p.datCao = vo ? vo.datCao : dinhDat(p.v); }

// nhóm vật liệu: mong (móng đá thô) · mat (mặt tiền cửa sổ) · da (đá vôi trơn: nắp, răng cưa) · mai (đá phiến, pha màu mái OSM)
function nhomMoi() { return { mong: { p: [], uv: [] }, mat: { p: [], uv: [], c: [] }, da: { p: [], uv: [], c: [] }, mai: { p: [], uv: [], c: [] } }; }
// mảng tường dọc cạnh (x1,z1)→(x2,z2) từ ya lên yb, u theo mét dọc chu vi (cửa sổ liền mạch quanh khối), v theo mét từ mặt đất
// tường từ ya lên yb có lỗ (cửa / dải nội thất): tách theo dọc cạnh tại mép lỗ, mỗi đoạn giữ các khoảng cao không bị lỗ che;
// phần dưới yMong là móng đá thô, trên là mặt tiền
// MÓNG THEO TỪNG MẶT TƯỜNG: đá móng thô lên tới mặt đất NGAY NGOÀI mặt tường đó + 1,2 m (trước: mặt đất cao nhất quanh cả khối → mặt đông Torbau ngoài
// cổng đất 11 m mà móng xám lên tới 20,9 m, che mất tường sa thạch kem như ảnh thật, anh 16/11/2026). Ngoài mặt tường là nhà khác / không đo được → mốc chung của khối.
function mongCanh(k, x1, z1, x2, z2, y0, y1, yChung) {
  const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) return yChung; const nx = (z2 - z1) / L, nz = -(x2 - x1) / L; let m = -Infinity, co = 0;
  for (let t = 0.1; t < 0.95; t += 0.2) for (const s of [1, -1]) { const x = x1 + (x2 - x1) * t + nx * s * 1.2, z = z1 + (z2 - z1) * t + nz * s * 1.2;
    if (trongDa(x, z, k.v) || dsKhoi.some((q) => q !== k && !q.la && trongDa(x, z, q.v) && !trongDa(x, z, k.v))) continue; const y = datThat(x, z); if (Number.isFinite(y)) { m = Math.max(m, y); co++; } }
  return co ? Math.min(y1, Math.max(y0, m + 1.2)) : yChung;
}
// KHUNG MỘT MẶT TƯỜNG (cạnh i của khối k, mái hiên y1): mặt đất trước tường, bề rộng, đổi toạ độ khung ảnh → toạ độ thật.
// u: 0 trái → 1 phải NHÌN TỪ NGOÀI (phải = (nz, −nx)); v: 0 mặt đất trước tường → 1 mái hiên. Dữ liệu đo trên ảnh ghi theo (u, v) để
// vị trí luôn bám khung: khung đổi (chân tường, mái hiên) thì mọi thành phần dời theo, không lệch như khi tự đổi tay sang mét (anh 16/11/2026).
function khungMat(k, i, y1) {
  const p = k.v[i], q = k.v[(i + 1) % k.v.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L;
  const yDat = datThat((p[0] + q[0]) / 2 + nx * 2, (p[1] + q[1]) / 2 + nz * 2), pTrai = p[0] * nz - p[1] * nx < q[0] * nz - q[1] * nx;
  return { p, q, L, n: [nx, nz], yDat, y1, y: (v) => yDat + v * (y1 - yDat), s: (u) => (pTrai ? u : 1 - u) * L };
}
// MÀU TƯỜNG THEO TỪNG MẶT, HAI TẦNG (ảnh: mặt tây Torbau tầng dưới đá vôi trắng, tầng trên sa thạch vàng; mặt đông gạch đỏ): <lâu>-cua-so.json
// "khối#cạnh".mau = { duoi, tren, y } — mau ở đây là THREE.Color (cả mặt một màu) hoặc { duoi, tren, y } (chia ở độ cao y)
function matTuong(G, ax, az, bx, bz, p, q, s, yMong, mau) {
  if (!mau.tren) { vachTuong(G.mat, ax, az, bx, bz, p, q, s, yMong, 4, mau); return; }
  if (p < mau.y) vachTuong(G.mat, ax, az, bx, bz, p, Math.min(q, mau.y), s, yMong, 4, mau.duoi);
  if (q > mau.y) vachTuong(G.mat, ax, az, bx, bz, Math.max(p, mau.y), q, s, yMong, 4, mau.tren);
}
function tuongCoLo(G, x1, z1, x2, z2, ya, yMong, yb, s0, k, mau, lo) {
  if (!lo.length) { vachTuong(G.mong, x1, z1, x2, z2, ya, yMong, s0, k.day, 3); matTuong(G, x1, z1, x2, z2, yMong, yb, s0, yMong, mau); return; }
  const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
  const moc = [...new Set([0, L, ...lo.flatMap((o) => [o.s0, o.s1]).filter((t) => t > 0 && t < L)])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < moc.length; i++) {
    const a = moc[i], b = moc[i + 1], m = (a + b) / 2, che = lo.filter((o) => o.s0 <= m && o.s1 >= m).sort((p, q) => p.y0 - q.y0);
    const tu = []; let y = ya; for (const o of che) { if (o.y0 > y) tu.push([y, Math.min(o.y0, yb)]); y = Math.max(y, o.y1); } if (y < yb) tu.push([y, yb]);
    const [ax, az, bx, bz] = [x1 + ux * a, z1 + uz * a, x1 + ux * b, z1 + uz * b];
    for (const [p, q] of tu) { if (q <= p) continue; vachTuong(G.mong, ax, az, bx, bz, p, Math.min(q, yMong), s0 + a, k.day, 3); matTuong(G, ax, az, bx, bz, Math.max(p, yMong), q, s0 + a, yMong, mau); }
  }
}
// CHÂN THÁP XOÈ (anh 21/11/2026: "chân các tháp còn có xu hướng xoè rộng hơn"): <lâu>-mat-dung.json chan_xoe[khối].lop = [{ y_tren, doc, ra }] đo bằng scripts/so-mat.py
// (mép bóng ảnh 3D Google lấn ra ngoài mép mô hình ở chân; đo lại trên mô hình đã xoè → thêm lớp phần còn lệch). Vỏ đá móng bọc CẢ chu vi: mặt bằng nở ra
// Σ min(ra, doc·(y_tren − y)) mét — mỗi lớp nghiêng từ y_tren xuống tới chỗ đạt ra rồi thẳng đứng; giữa hai mốc gãy liền nhau độ nở tuyến tính → một vòng mặt nghiêng.
// Đỉnh nở theo góc vát (miter) mỗi đỉnh mặt bằng → các mặt khép kín, không hở góc. Chỉ khối có số đo, không số viết tay.
function chanXoe(k, G, y0) {
  const cx = MAT_DUNG?.chan_xoe?.[k.id], lop = (cx?.lop || (cx ? [cx] : [])).filter((l) => l.doc > 0 && l.ra > 0 && l.y_tren > y0); if (!lop.length) return;
  const v = k.v, n = v.length, no = (y) => lop.reduce((t, l) => t + Math.max(0, Math.min(l.ra, l.doc * (l.y_tren - y))), 0);
  const nn = v.map(([x1, z1], i) => { const [x2, z2] = v[(i + 1) % n], L = Math.hypot(x2 - x1, z2 - z1) || 1; return [(z2 - z1) / L, -(x2 - x1) / L]; });
  const vong = (d) => v.map(([x, z], i) => { const a = nn[(i + n - 1) % n], b = nn[i], f = Math.min(1.5, 1 / Math.max(1 + a[0] * b[0] + a[1] * b[1], 0.22)); // miter (a + b) / (1 + a·b), chặn góc nhọn
    return [x + (a[0] + b[0]) * f * d, z + (a[1] + b[1]) * f * d]; });
  const moc = [...new Set([y0, ...lop.flatMap((l) => [l.y_tren, l.y_tren - l.ra / l.doc]).filter((y) => y > y0), Math.max(...lop.map((l) => l.y_tren))])].sort((p, q) => p - q);
  for (let m = 0; m + 1 < moc.length; m++) {
    const ya = moc[m], yb = moc[m + 1], A = vong(no(ya)), B = vong(no(yb)); if (yb - ya < 0.01) continue; let s0 = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, L = Math.hypot(v[j][0] - v[i][0], v[j][1] - v[i][1]); // bậc dưới A[i]→A[j] ở ya, bậc trên B[i]→B[j] ở yb; cùng thứ tự đỉnh với vachTuong (mặt hướng ra ngoài)
      G.mong.p.push(A[i][0], ya, A[i][1], A[j][0], ya, A[j][1], B[j][0], yb, B[j][1], A[i][0], ya, A[i][1], B[j][0], yb, B[j][1], B[i][0], yb, B[i][1]);
      const u0 = s0 / 3, u1 = (s0 + L) / 3, va = (ya - k.day) / 3, vb = (yb - k.day) / 3; G.mong.uv.push(u0, va, u1, va, u1, vb, u0, va, u1, vb, u0, vb); s0 += L; }
  }
}
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
  const L2 = MAI_LOD2?.khoi?.[k.id];
  const goc = k.ref ?? k.day, y0 = hMin > 0 ? goc + hMin : Math.min(k.day, goc), y1 = L2 && Math.abs(L2.y1 - (goc + h - hMai)) > 1.5 ? L2.y1 : goc + h - hMai, y2 = L2 ? L2.y2 : goc + h; // chiều cao từ mốc chân nhà; mép tường LoD2 (mặt mái sát viền, cao hơn đỉnh tường vì mái chìa) chỉ thay mép OSM/ảnh khi lệch > 1,5 m — hàng cửa đo theo ảnh neo vào mép đó; tường không treo thì chạy xuống tới đất thấp nhất
  const yMong = hMin > 0 ? y0 : Math.min(y1, Math.max(y0, k.datCao + 1.2)); // móng đá thô tới quá mặt đất cao nhất 1,2 m
  k._yMong = yMong; k._y1 = y1; // loCanh khoét lỗ cửa sổ theo cùng bố cục với khung cửa 3D (mattien.js bocCuc)
  const mai = [], da = [], hoi = []; // hoi: tam giác đầu hồi đứng [{ p, mau }] — màu theo mặt tường bên dưới
  const mauT =mauOSM(t['building:colour'], new THREE.Color(1, 1, 1)).lerp(new THREE.Color(1, 1, 1), 0.3); // màu tường OSM (Torbau gạch đỏ) pha lên vân đá
  let s0 = 0;
  for (let i = 0; i < v.length; i++) {
    const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length];
    const mm = CUA_SO?.[k.id + '#' + i]?.mau, mauMat = mm ? { duoi: new THREE.Color(mm.duoi), tren: new THREE.Color(mm.tren), y: mm.v != null ? khungMat(k, i, y1).y(+mm.v) : +mm.y } : mauT; // mau.v: gờ đổi màu theo khung
    tuongCoLo(G, x1, z1, x2, z2, y0, hMin > 0 ? yMong : mongCanh(k, x1, z1, x2, z2, y0, y1, yMong), y1, s0, k, mauMat, loCanh(k, i, x1, z1, x2, z2));
    s0 += Math.hypot(x2 - x1, z2 - z1);
  }
  chanXoe(k, G, y0);
  const napPhang = (y, arr) => { const sh = new THREE.Shape(v.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(sh); const p = g.toNonIndexed().attributes.position; for (let i = 0; i < p.count; i += 3) for (const j of [0, 2, 1]) arr.push(p.getX(i + j), y, -p.getY(i + j)); };
  if (L2) {
    // mặt mái LoD2 đã cắt theo mặt bằng khối: chia tam giác, quay pháp tuyến lên trên; dải tường "tuong" từ mép mái xuống chỗ thấp ngay ngoài (mép khối → y1, bậc giữa hai mặt → mặt thấp)
    for (const m of L2.mat) { const tg = THREE.ShapeUtils.triangulateShape(m.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, l] of tg) { const A = m[i], B = m[j], C = m[l], len = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); // >0: (x, z) ngược kim → pháp tuyến hướng xuống trong three (y lên, z nam)
        const P = (q) => [q[0], q[2], q[1]]; if (len > 0) tamGiac(mai, P(A), P(C), P(B)); else tamGiac(mai, P(A), P(B), P(C)); } }
    for (const [x1, z1, d1, t1, x2, z2, d2, t2] of L2.tuong) tamGiac(da, [x1, d1, z1], [x2, d2, z2], [x2, t2, z2], [x1, d1, z1], [x2, t2, z2], [x1, t1, z1], [x1, d1, z1], [x2, t2, z2], [x2, d2, z2], [x1, d1, z1], [x1, t1, z1], [x2, t2, z2]); // hai mặt: hướng ra ngoài không ghi trong tệp
    napPhang(Math.min(y1, L2.y0 ?? y1), da); // lấp chỗ mặt mái LoD2 không phủ (≤ 15% mặt bằng) — ở mái THẤP nhất: nắp ở máng xối đè lên mái phụ thấp hơn (Torbau 223110818 cao hơn DOM20 4 m, 20/11/2026)
  } else if (kieu === 'pyramidal' || kieu === 'cone' || kieu === 'dome' || kieu === 'onion') {
    const [cx, cz] = tamDa(v);
    for (let i = 0; i < v.length; i++) { const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length]; tamGiac(mai, [x1, y1, z1], [x2, y1, z2], [cx, y2, cz]); }
  } else if (kieu === 'gabled' || kieu === 'hipped' || kieu === 'side_hipped' || kieu === 'half-hipped' || kieu === 'skillion') {
    // roof:orientation=across (OSM): sống mái theo trục NGẮN → hai đầu hồi quay ra hai mặt dài (đầu hồi bậc Torbau quay ra cổng như ảnh, anh 16/11/2026)
    const o = hopBao(v); if (t['roof:orientation'] === 'across') { const { c, s: sn } = o; Object.assign(o, { a: o.a + Math.PI / 2, c: -sn, s: c, u0: o.w0, u1: o.w1, w0: -o.u1, w1: -o.u0 }); o.ra = (u, w) => [u * o.c - w * o.s, u * o.s + w * o.c]; }
    const wm = (o.w0 + o.w1) / 2, L = o.u1 - o.u0, W = o.w1 - o.w0;
    const thut = kieu === 'hipped' ? Math.min(W / 2, L / 2) : kieu === 'half-hipped' || kieu === 'side_hipped' ? Math.min(W / 4, L / 4) : 0;
    const P = (u, w, y) => { const [x, z] = o.ra(u, w); return [x, y, z]; };
    if (kieu === 'skillion') {
      // roof:direction (OSM: độ từ bắc theo chiều kim đồng hồ, hướng mái dốc XUỐNG): mép thấp quay về hướng đó. Trục w (x, z) = (−s, c); xuống = (sin, −cos).
      // Không có thẻ → mép w0 cao như trước. Đảo mép = phản chiếu → đảo thứ tự đỉnh tam giác để mặt vẫn quay ra ngoài.
      const hd = so(t['roof:direction']), dao = hd != null && -o.s * Math.sin(hd * Math.PI / 180) - o.c * Math.cos(hd * Math.PI / 180) < 0;
      const wc = dao ? o.w1 : o.w0, wt = dao ? o.w0 : o.w1, tg = (arr, ...p) => { for (let j = 0; j < p.length; j += 3) arr.push(...p[j], ...(dao ? p[j + 2] : p[j + 1]), ...(dao ? p[j + 1] : p[j + 2])); };
      const a = P(o.u0, wc, y2), b = P(o.u1, wc, y2), c = P(o.u1, wt, y1), d = P(o.u0, wt, y1);
      tg(mai, a, c, b, a, d, c);
      tg(da, P(o.u0, wc, y1), P(o.u1, wc, y1), b, P(o.u0, wc, y1), b, a, P(o.u0, wt, y1), a, d, P(o.u0, wt, y1), P(o.u0, wc, y1), a, P(o.u1, wc, y1), P(o.u1, wt, y1), c, P(o.u1, wc, y1), c, b);
    } else {
      const r0 = P(o.u0 + thut, wm, y2), r1 = P(o.u1 - thut, wm, y2);
      const g00 = P(o.u0, o.w0, y1), g10 = P(o.u1, o.w0, y1), g11 = P(o.u1, o.w1, y1), g01 = P(o.u0, o.w1, y1);
      tamGiac(mai, g00, r1, g10, g00, r0, r1, g11, r0, g01, g11, r1, r0);
      // MÀU ĐẦU HỒI ĐỨNG = màu tầng trên của mặt tường ngay dưới nó (cua-so.json mau.tren của cạnh OSM nằm trên đường chân đầu hồi): đầu hồi là tường nối lên,
      // cùng loại đá — Torbau: phía sân sa thạch vàng, phía cổng gạch đỏ (góp ý #1645; trước cả hai đầu lấy màu gạch đỏ của khối). Không có số đo màu thì giữ màu tường OSM.
      const mauHoi = (A, B) => { const ux = B[0] - A[0], uz = B[2] - A[2], L = Math.hypot(ux, uz) || 1;
        for (let i = 0; i < v.length; i++) { const mm = CUA_SO?.[k.id + '#' + i]?.mau; if (!mm?.tren) continue;
          const [x1, z1] = v[i], [x2, z2] = v[(i + 1) % v.length], dx = (x1 + x2) / 2 - A[0], dz = (z1 + z2) / 2 - A[2], tt = (dx * ux + dz * uz) / L;
          if (tt > 0 && tt < L && Math.abs(dx * uz - dz * ux) / L < 1) return new THREE.Color(mm.tren); }
        return mauT; };
      if (thut > 0) tamGiac(mai, g01, r0, g00, g10, r1, g11);
      else { hoi.push({ p: [...g01, ...r0, ...g00], mau: mauHoi(g00, g01) }, { p: [...g10, ...r1, ...g11], mau: mauHoi(g10, g11) }); } // đầu hồi đứng = tường đá
      if (thut === 0 && t.dau_hoi_bac === 'yes') for (const [A, Bq, R] of [[g00, g01, r0], [g10, g11, r1]]) { // ĐẦU HỒI BẬC (cổng Torbau như ảnh): bậc nhô trên mép đầu hồi, cùng màu đầu hồi
        const H = R[1] - A[1], nb = Math.max(3, Math.round(H / 1.1)), mx = (A[0] + Bq[0]) / 2, mz = (A[2] + Bq[2]) / 2, mh = mauHoi(A, Bq);
        for (let b = 0; b < nb; b++) for (const P of [A, Bq]) { const f0 = b / nb, f1 = (b + 1) / nb, y0 = A[1] + H * f0, y1 = A[1] + H * f1;
          const x0 = P[0] + (mx - P[0]) * f0, z0 = P[2] + (mz - P[2]) * f0, x1 = P[0] + (mx - P[0]) * f1, z1 = P[2] + (mz - P[2]) * f1;
          BAC_HOI.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: y1 + 0.35, w: Math.hypot(x1 - x0, z1 - z0) + 0.25, h: 0.7 + (y1 - y0) * 0.3, goc: Math.atan2(z1 - z0, x1 - x0), mau: mh.clone() }); }
        // trụ đỉnh: cao theo thẻ hoi_tru (m, đo trên ảnh — 0 = không có trụ); KHÔNG có số thì không dựng (17/11/2026 bỏ mặc định 1,6 m đoán)
        const hTru = so(t.hoi_tru) ?? 0; if (so(t.hoi_tru) == null) console.info('[ns] thiếu số ảnh: trụ đỉnh đầu hồi', k.id);
        if (hTru > 0) BAC_HOI.push({ x: R[0], z: R[2], y: R[1] + 0.1 + hTru / 2, w: 0.7, h: hTru, goc: Math.atan2(Bq[2] - A[2], Bq[0] - A[0]), mau: mh.clone() });
        ghiKK(k.id + '#mai', 'hoi_bac', R[1]);
      }
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
  const mauM = kieu === 'flat' && !L2 ? null : mauOSM(t['roof:colour'], MAU_MAI).lerp(new THREE.Color(1, 1, 1), 0.55); // pha nhẹ lên vân đá phiến
  G.da.p.push(...da); G.da.uv.push(...uvChieu(da, 4)); for (let i = 0; i < da.length; i += 3) G.da.c.push(mauT.r, mauT.g, mauT.b);
  // tam giác đầu hồi đứng: màu riêng từng đầu (mauHoi); vẫn nằm trong da trả về (va chạm + công cụ đo dùng hình khối)
  for (const e of hoi) { G.da.p.push(...e.p); G.da.uv.push(...uvChieu(e.p, 4)); for (let i = 0; i < e.p.length; i += 3) G.da.c.push(e.mau.r, e.mau.g, e.mau.b); da.push(...e.p); }
  G.mai.p.push(...mai); G.mai.uv.push(...uvChieu(mai, 2.5)); for (let i = 0; i < mai.length; i += 3) G.mai.c.push(mauM.r, mauM.g, mauM.b);
  return { mai, da, ten: t.name, h, y2, y0, y1, yMong };
}

const NHOM = nhomMoi(), BAC_HOI = []; // BAC_HOI: khối bậc đầu hồi (tag dau_hoi_bac)
let caoNhat = null;
const TUONG_MT = []; // tường từng khối cho mặt tiền chi tiết (mattien.js)
for (const k of dsKhoi) {
  if (k.vo && k.coPart) continue;
  const truoc = { mong: NHOM.mong.p.length, mat: NHOM.mat.p.length };
  const r = dungKhoi(k, NHOM);
  k.yDuoi = r.y0; k.yTren = r.y2; TUONG_MT.push({ ten: k.tags.name || (k.la ? (() => { const [cx, cz] = tamDa(k.v); return dsKhoi.find((q) => q.vo && q.tags.name && trongDa(cx, cz, q.v))?.tags.name; })() : null), k, v: k.v, yMong: r.yMong, y1: r.y1, y2: r.y2, neoHang: NEO_HANG, lo: (i, x1, z1, x2, z2) => loCanh(k, i, x1, z1, x2, z2) });
  // hình từng khối: tường (móng + mặt tiền vừa thêm) + mái + nắp — cho va chạm và công cụ đo đối chiếu ảnh
  k.hinh = [[...NHOM.mong.p.slice(truoc.mong), ...NHOM.mat.p.slice(truoc.mat), ...r.da], r.mai];
  const pos = [...k.hinh[0], ...k.hinh[1]];
  if (pos.length >= 9) world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(pos), Uint32Array.from({ length: pos.length / 3 }, (_, i) => i)), tinh);
  if (!caoNhat || r.y2 > caoNhat.y2) caoNhat = r;
}
const r1 = T.rngTu(5);
const vlTu = (t, o = {}) => { for (const x of [t.map, t.bump]) x && x.wrapS && (x.wrapS = x.wrapT = THREE.RepeatWrapping); return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: o.bump ?? 1.5, roughness: o.ro ?? 0.85, side: THREE.DoubleSide, vertexColors: !!o.mau }); };
// mặt tiền: vân TRƠN (matTron) — cửa sổ là hình 3D của mattien.js, không vẽ lên vân nữa
const VL = { mong: vlTu(T.daVoi(T.rngTu(9)), { bump: 3 }), // móng / tường chắn: đá vôi sáng như ảnh thật (trước vân đá xám tối, anh 16/11/2026)
   mat: vlTu(T.matTron(r1), { mau: true }), da: vlTu(T.daVoi(r1), { mau: true }), mai: vlTu(T.daPhien(r1), { ro: 0.5, mau: true }) };
const LOP_NHA_TU = LOP_OSM.length; // từ đây tới LOP_NHA_DEN: lớp LÂU ĐÀI của cách dựng cũ (nút 🧩 Cách 3 ẩn / hiện để so)
for (const [ten, G] of Object.entries(NHOM)) {
  if (!G.p.length) continue;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
  if (G.c) g.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, VL[ten]); m.castShadow = m.receiveShadow = true; m.userData.nha = true; scene.add(m); LOP_OSM.push(m); // nha: nhận ảnh chiếu (chieuanh.js)
}
// mặt Palas hướng sân trên (đầu hồi đông, gần sân nhất): chọn TRƯỚC khi đặt cửa sổ để chừa dải trên cho tranh + ban công
const CUA = []; // cửa sổ 3D mặt tiền (mattien.js): { x, y: bậu, z, nx, nz: pháp tuyến ra ngoài, nua: nửa bề ngang, cao, ten } — leo sát cửa có phòng phía sau thì E mở cửa trèo vào
const SAN_TRONG = D.khoi.find((k) => k.tags.building === 'courtyard')?.ngoai?.[0];
// NỀN SÂN TRÊN PHẲNG (NEN_LUOI đặt mặt đất trong đa giác sân = NEN.san): mặt lát + tường chắn mép dựng theo mức này (góp ý #1633)
const SAN_PHANG = SAN_TRONG && NEN_LUOI && Number.isFinite(NEN?.san) ? { v: SAN_TRONG, y: NEN.san } : null;
const MAT_PALAS = (() => {
  if (!SAN_TRONG) return null; const [cx, cz] = tamDa(SAN_TRONG); let tot = null;
  for (const t of TUONG_MT) if (t.ten === 'Palas') for (let i = 0; i < t.v.length; i++) {
    const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1), nx = (z2 - z1) / L, nz = -(x2 - x1) / L;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, d = Math.hypot(cx - mx, cz - mz), huong = (nx * (cx - mx) + nz * (cz - mz)) / d;
    if (huong > 0.7 && L > 8 && (!tot || d < tot.d)) tot = { t, i, x1, z1, x2, z2, y1: t.y1, y2: t.y2, L, d }; // GẦN sân nhất, không phải dài nhất
  }
  if (tot) { const lo0 = tot.t.lo; tot.t.lo = (i, ...r) => (i === tot.i ? [...lo0(i, ...r), { s0: 0, s1: tot.L, y0: -1e9, y1: tot.y1 + 1, matRieng: true }] : lo0(i, ...r)); const { x1, z1, x2, z2, L } = tot; tot.yDat = caoDat((x1 + x2) / 2 + (z2 - z1) / L * 2, (z1 + z2) / 2 - (x2 - x1) / L * 2) - GOC_Y;
    // tam giác đầu hồi thật: trong các tam giác đá của khối, cái nằm trên mặt phẳng tường này và có đỉnh cao quá mái → đổi sang toạ độ s dọc tường
    const nx = (z2 - z1) / L, nz = -(x2 - x1) / L, ux = (x2 - x1) / L, uz = (z2 - z1) / L, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, da = tot.t.k.hinh?.[0] || [];
    let P = null;
    for (let i = 0; i + 8 < da.length; i += 9) { const q = [0, 3, 6].map((j) => [da[i + j], da[i + j + 1], da[i + j + 2]]);
      if (q.some(([x, , z]) => Math.abs((x - x1) * nx + (z - z1) * nz) > 0.25)) continue; const dinh = Math.max(...q.map((p) => p[1]));
      if (dinh > tot.y1 + 1 && (!P || dinh > Math.max(...P.map((p) => p[1])))) P = q; }
    if (P) { const s = P.map(([x, y, z]) => [(x - mx) * ux + (z - mz) * uz, y]).sort((a, b) => b[1] - a[1]), chan = s.slice(1).sort((a, b) => a[0] - b[0]);
      tot.hoi = { sD: s[0][0], yD: s[0][1], sA: chan[0][0], sB: chan[1][0], yC: Math.min(chan[0][1], chan[1][1]) }; }
    tot.bo = BO_MET;
  } // cả mặt dựng riêng theo ảnh (mattien.js datMatPalas)
  return tot;
})();
// CỔNG + CẦU THANG LÊN PALAS (góp ý #1644): cầu thang OSM (40 bậc) đi từ mặt Palas hướng sân xuống sân, nhưng duong.js lấy độ cao hai đầu theo mặt đất —
// cả hai đầu nằm trên sân phẳng nên thang dẹt xuống mặt sân, không thấy. Đầu sát mặt tường neo vào NGƯỠNG CỬA đo trên ảnh (tệp bố cục: cong); cửa đặt ngang
// đúng chỗ đầu thang chiếu lên mặt tường (ảnh cho cùng chỗ trong 0,33 m).
if (MAT_PALAS && BO_MET?.cong && DUONG?.duong) { const P = MAT_PALAS, d = DUONG.duong.find((q) => q.id === BO_MET.cong.thang);
  const ux = (P.x2 - P.x1) / P.L, uz = (P.z2 - P.z1) / P.L, nx = uz, nz = -ux, mx = (P.x1 + P.x2) / 2, mz = (P.z1 + P.z2) / 2;
  const kc = (p) => Math.abs((p[0] - mx) * nx + (p[1] - mz) * nz), dau = d ? [d.v[0], d.v.at(-1)].sort((a, b) => kc(a) - kc(b))[0] : null;
  if (dau && kc(dau) < 1.5) { const y = P.y1 - BO_MET.cong.duoiNguong; P.cong = { s: (dau[0] - mx) * ux + (dau[1] - mz) * uz, y }; d.neo = [{ x: dau[0], z: dau[1], y }];
    console.info('[ns] cổng Palas đầu cầu thang', d.id, 's', P.cong.s.toFixed(2), 'ngưỡng', y.toFixed(2)); }
  else console.warn('[ns] không tìm thấy cầu thang cổng Palas', BO_MET.cong.thang); }
// MẶT DỰNG RIÊNG CHE CẢ MẶT PHẲNG (anh 17/11/2026, ảnh mặt Palas hướng sân: hai lớp cửa đè nhau): mặt Palas dựng theo ảnh chỉ khoá đúng cạnh của nó, nhưng khối OSM
// khác (way/223140032#9) có cạnh NẰM TRÊN CÙNG MẶT PHẲNG tường → máy dựng cửa chung đặt thêm một lớp cửa đè lên. Khoá luôn mọi cạnh cùng mặt phẳng (cùng hướng,
// cách mặt phẳng ≤ 1 m) trên đoạn trùng với mặt dựng riêng.
if (MAT_PALAS) { const P = MAT_PALAS, nx = (P.z2 - P.z1) / P.L, nz = -(P.x2 - P.x1) / P.L, ux = (P.x2 - P.x1) / P.L, uz = (P.z2 - P.z1) / P.L;
  for (const t of TUONG_MT) for (let i = 0; i < t.v.length; i++) { if (t === P.t && i === P.i) continue;
    const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) continue;
    const d1 = (x1 - P.x1) * nx + (z1 - P.z1) * nz, d2 = (x2 - P.x1) * nx + (z2 - P.z1) * nz; if (Math.abs(d1) > 1 || Math.abs(d2) > 1) continue;
    const s1 = (x1 - P.x1) * ux + (z1 - P.z1) * uz, s2 = (x2 - P.x1) * ux + (z2 - P.z1) * uz, a = Math.max(0, Math.min(s1, s2)), b = Math.min(P.L, Math.max(s1, s2)); if (b - a < 0.5) continue;
    const ta = (a - s1) / (s2 - s1) * L, tb = (b - s1) / (s2 - s1) * L, lo0 = t.lo;
    t.lo = (j, ...r) => (j === i ? [...lo0(j, ...r), { s0: Math.min(ta, tb), s1: Math.max(ta, tb), y0: -1e9, y1: 1e9, matRieng: true }] : lo0(j, ...r)); } }
// MẶT TORBAU HƯỚNG SÂN DƯỚI dựng riêng theo ảnh chụp (góp ý #1641): trục = cạnh khung trong tệp; mốc ngang = đỉnh OSM (chiếu lên trục) + tâm vòm cổng mô hình;
// mốc đứng = gờ đổi màu (v = vGo) + mái hiên của khung. Mọi cạnh CÙNG MẶT PHẲNG (cùng hướng, cách ≤ 1,5 m — khối cổng nhô ~1 m) trong khoảng mặt dựng riêng bị khoá
// (máy dựng cửa chung không đặt thêm) và số đo cửa / ô tròn / ban công / đồng hồ cũ (cua-so.json, thước 55,8 px/m không tính phối cảnh) của các mặt đó bỏ trong bộ nhớ.
const MAT_TB = (() => {
  const bo = MAT_TB_BO; if (!bo?.mat?.khung) return null;
  const [kid, si] = bo.mat.khung.split('#'), kK = dsKhoi.find((q) => q.id === kid); if (!kK || kK._y1 == null) return null;
  const f = khungMat(kK, +si, kK._y1), ux = (f.q[0] - f.p[0]) / f.L, uz = (f.q[1] - f.p[1]) / f.L, [nx, nz] = f.n;
  const sTai = (x, z) => (x - f.p[0]) * ux + (z - f.p[1]) * uz, dTai = (x, z) => (x - f.p[0]) * nx + (z - f.p[1]) * nz;
  const neo = [];
  for (const [px, id, j] of bo.mat.ngang) {
    if (id === 'cong') { const c = VOM_CONG.filter((v) => Math.abs(dTai(v.x, v.z)) < 3 && Math.abs(v.ux * ux + v.uz * uz) > 0.9).sort((a, b) => Math.abs(dTai(a.x, a.z)) - Math.abs(dTai(b.x, b.z)))[0]; if (c) neo.push([px, sTai(c.x, c.z)]); continue; }
    const k = dsKhoi.find((q) => q.id === id), p = k?.v?.[j]; if (p) neo.push([px, sTai(p[0], p[1])]);
  }
  const bd = banDoMat(bo, { neo, yGo: f.y(bo.mat.vGo), yMai: f.y1 }); if (!bd) return null;
  const s0 = Math.min(...neo.map((n) => n[1])), s1 = Math.max(...neo.map((n) => n[1])), ung = [], khoa = new Set();
  for (const t of TUONG_MT) for (let i = 0; i < t.v.length; i++) {
    const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) continue;
    if (((z2 - z1) / L) * nx + (-(x2 - x1) / L) * nz < 0.97 || Math.abs(dTai(x1, z1)) > 1.5 || Math.abs(dTai(x2, z2)) > 1.5) continue;
    const a1 = sTai(x1, z1), a2 = sTai(x2, z2), a = Math.max(s0, Math.min(a1, a2)), b = Math.min(s1, Math.max(a1, a2)); if (b - a < 0.3) continue;
    ung.push({ k: t.k, t, i, a1, a2, d1: dTai(x1, z1), d2: dTai(x2, z2) });
    const ta = (a - a1) / (a2 - a1) * L, tb = (b - a1) / (a2 - a1) * L, lo0 = t.lo;
    t.lo = (j, ...r) => (j === i ? [...lo0(j, ...r), { s0: Math.min(ta, tb), s1: Math.max(ta, tb), y0: -1e9, y1: 1e9, matRieng: true }] : lo0(j, ...r));
    if (b - a >= L * 0.9) khoa.add(`${t.k.id}#${i}`);
  }
  for (const id of khoa) { const e = CUA_SO?.[id]; if (!e) continue; for (const x of ['hang', 'hang_khung', 'khung', 'o_tron', 'o_tron_khung', 'ban_cong', 'ban_cong_khung', 'dong_ho', 'dong_ho_khung']) delete e[x]; }
  // trang trí cả khối (sua.json) mà mặt này trên ảnh không có: tệp bố cục tatTrangTri { "khối#cạnh": ["vom_nho"] } → đặt 0 (trangtri.js bỏ trên mặt đó)
  for (const [id, ds] of Object.entries(bo.tatTrangTri || {})) if (Array.isArray(ds)) { CUA_SO[id] = CUA_SO[id] || {}; for (const x of ds) CUA_SO[id][x] = 0; }
  // điểm trên MẶT TƯỜNG NGOÀI CÙNG tại s, độ cao y: cạnh cùng mặt phẳng chứa s mà khối có tường ở độ cao đó (chân khối → đỉnh mái), lấy cạnh nhô ra xa nhất
  const viTri = (s, y) => { let tot = null;
    for (const c of ung) { if (s < Math.min(c.a1, c.a2) - 0.05 || s > Math.max(c.a1, c.a2) + 0.05) continue; if (y < (c.k.yDuoi ?? -1e9) - 0.2 || y > (c.k.yTren ?? c.t.y2 ?? c.t.y1) + 0.2) continue;
      const d = c.d1 + (c.d2 - c.d1) * (s - c.a1) / (c.a2 - c.a1 || 1); if (!tot || d > tot.d + 0.05) tot = { d, mat: `${c.k.id}#${c.i}` }; }
    return tot && { x: f.p[0] + ux * s + nx * tot.d, z: f.p[1] + uz * s + nz * tot.d, nx, nz, mat: tot.mat }; };
  console.info('[ns] mặt Torbau hướng sân (ảnh chụp):', neo.length, 'mốc', JSON.stringify(neo.map(([x, s]) => [x, +s.toFixed(2)])), '· khoá', khoa.size, 'mặt');
  return { bo, bd, viTri, neo, khoa: [...khoa], yGo: f.y(bo.mat.vGo), yMai: f.y1 };
})();
// NỀN SÂN TRÊN: mặt sân đo từ ảnh (ảnh phụ Josef Albert trong tệp bố cục mặt Palas: mặt sân ~22 m dưới mái), không phải lưới đất EU-DEM (thô 12 m, ở sân thấp hơn ~6 m).
// OSM ghi chú khối courtyard là "building for 3D reasons" — dựng thành nền đá: mặt lát đá, tường chắn, lan can mép hở, bậc thang xuống phía cổng.
const matDat = datThat; // mặt đứng được = mặt đất thật (ảnh 3D) quanh lâu đài
const LOD_MT = { gan: new THREE.Group(), xa: new THREE.Group(), dangXa: false };
{ // mặt tiền chi tiết: cửa sổ 3D + gờ tầng (một mặt tường bị khối khác áp vào ở tầng nào thì bỏ tầng đó)
  const biChe = (x, y, z) => dsKhoi.some((k) => k.yDuoi != null && y > k.yDuoi && y < (k._y1 ?? k.yTren) + 0.5 && trongDa(x, z, k.v)); // tới chân mái (+0,5) — phần mái dốc phía trên không che hết cửa
  // số đo theo KHUNG (cua-so.json "khung": true): hang_khung [{ v0, v1, cum: [[u0, u1, n]] }], o_tron_khung [[u, v, r]], o_vuong_khung [[u, v, rộng, cao]] → mét
  for (const [id, e] of Object.entries(CUA_SO || {})) { if (!e?.khung) continue; const [kid, si] = id.split('#'), k = dsKhoi.find((q) => q.id === kid); if (!k || k._y1 == null) continue;
    const f = khungMat(k, +si, k._y1), ss = (u0, u1) => { const a = f.s(u0), b = f.s(u1); return [Math.min(a, b), Math.max(a, b)]; };
    // độ cao trong khung: v (0 chân → 1 mái hiên) hoặc d (mét trên chân tường — mặt không có mái hiên rõ, đo bằng thước ảnh)
    const yy = (o, kv, kd) => (o[kd] != null ? f.yDat + o[kd] : f.y(o[kv]));
    if (e.hang_khung) e.hang = e.hang_khung.map((h) => ({ y0: yy(h, 'v0', 'd0'), y1: yy(h, 'v1', 'd1'), cum: h.cum.map(([u0, u1, n]) => [...ss(u0, u1), n]) }));
    if (e.o_tron_khung) e.o_tron = e.o_tron_khung.map(([u, v, r]) => [f.s(u), f.y(v), r]);
    if (e.ban_cong_khung) e.ban_cong = e.ban_cong_khung.map(([u, d, w, nh]) => [f.s(u), f.yDat + d, w, nh]);
    if (e.dong_ho_khung) e.dong_ho = e.dong_ho_khung.map(([u, d, r]) => [f.s(u), f.yDat + d, r]);
    if (e.o_vuong_khung) e.o_vuong = e.o_vuong_khung.map(([u, v, w, h]) => [f.s(u), f.y(v) - h / 2, w, h]); }
  const { ra, cua, dem } = datMatTien({ THREE, mergeGeometries, tuong: TUONG_MT, biChe, nhe: CHAM, cuaSo: CUA_SO, matAnh: MAT_ANH,
    matNgoai: (x, z, nx, nz) => { // mép sân OSM có chỗ cách chân tường vài mét → dò 2 / 5 / 8 m trước mặt tường; độ cao lấy ngay trước chân tường
      const san = !!SAN_TRONG && [2, 5, 8].some((d) => trongDa(x + nx * d, z + nz * d, SAN_TRONG)); return { san, yDat: matDat(x + nx * 1.5, z + nz * 1.5) }; } });
  // mesh có mức chi tiết (userData.lod) nằm trong nhóm riêng: lớp ảnh 3D bật / tắt cả NHÓM (LOP_OSM), mức chi tiết bật / tắt từng mesh con — không giẫm nhau
  for (const m of ra) { if (m.userData.lod) { LOD_MT[m.userData.lod].add(m); continue; } scene.add(m); LOP_OSM.push(m); }
  for (const g of [LOD_MT.gan, LOD_MT.xa]) { scene.add(g); LOP_OSM.push(g); }
  CUA.push(...cua); for (const c of cua) ghiKK(c.mat, 'cua_so', c.y + c.cao / 2, 1, c.x, c.z); // tâm ô cửa
  if (MAT_TB) { // mặt Torbau hướng sân dưới theo ảnh chụp (góp ý #1641): cụm cửa, ô tròn, diềm vòm, khung ô, bệ, cửa vào, lô-gia, đồng hồ — mattien.js datMatRieng
    const r = datMatRieng({ THREE, mergeGeometries, bo: MAT_TB.bo, bd: MAT_TB.bd, viTri: MAT_TB.viTri, datTai: matDat, nhe: CHAM });
    for (const m of r.ra) { m.userData.nha = true; scene.add(m); LOP_OSM.push(m); }
    CUA.push(...r.cua); for (const e of r.kk) ghiKK(e.mat, e.loai, e.y, 1, e.x, e.z, e.hop); MAT_TB.dung = { cum: r.cua.length, kk: r.kk.length, boQua: [...r.boQua], nhoLoGia: r.boQua.nhoLoGia ?? null };
    console.info('[ns] mặt Torbau hướng sân:', r.cua.length, 'cụm ·', r.kk.length, 'chi tiết kiểm kê', r.boQua.length ? '· bỏ (không có tường ở độ cao đó): ' + r.boQua.join(' | ') : ''); }
  // ẢNH DÁN MẶT TƯỜNG (LOD2 + ảnh mặt tiền): mỗi mặt có ảnh → một tấm phẳng sát ngoài tường, từ chân tường lên mái hiên mô hình (phần ảnh trên mái hiên bỏ),
  // lỗ cửa mở được (dải phòng) khoét trong suốt trên ảnh để vẫn nhìn / trèo vào; ảnh tải nền, không chặn trang
  (async () => {
    const tl = new THREE.TextureLoader(), dem2 = { mat: 0 };
    for (const t of TUONG_MT) for (let i = 0; i < t.v.length; i++) {
      const a = MAT_ANH[`${t.k?.id}#${i}`]; if (!a) continue;
      if (MAT_PALAS && t === MAT_PALAS.t && i === MAT_PALAS.i) continue; // mặt dựng riêng theo ảnh chụp rõ (datMatPalas: tranh, ban công, cụm cửa) — ảnh 3D nhoè dán đè sẽ che mất (anh 16/11/2026)
      const [x1, z1] = t.v[i], [x2, z2] = t.v[(i + 1) % t.v.length], L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux;
      const y0 = Math.max(t.k?.yDuoi ?? t.yMong, a.y0), y1 = Math.min(t.y1, a.yTren); if (y1 - y0 < 1) continue; // từ CHÂN tường (ảnh có cả móng, vòm cổng) — trước chỉ từ móng lên, cổng Torbau thành tường đá trơn
      let tx; try { tx = await tl.loadAsync(`./du-lieu/${a.tep}`); } catch (e) { console.warn('[ns] không tải được ảnh mặt', a.tep, e); continue; }
      const lo = t.lo(i, x1, z1, x2, z2).filter((o) => o.cuaSo);
      if (lo.length) { // khoét lỗ cửa mở được: vẽ ảnh lên canvas, xoá các ô
        const c = document.createElement('canvas'), W = tx.image.width, H = tx.image.height; c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(tx.image, 0, 0);
        const ky = H / (a.yTren - a.y0), kx = W / a.L; for (const o of lo) g.clearRect(o.s0 * kx, (a.yTren - o.y1) * ky, (o.s1 - o.s0) * kx, (o.y1 - o.y0) * ky);
        tx = new THREE.CanvasTexture(c);
      }
      tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      // hình dán = chữ nhật tường (chân → mái hiên) + TAM GIÁC ĐẦU HỒI nằm trên cùng mặt phẳng (lấy từ hình khối đã dựng) — trước chỉ tới mái hiên,
      // đầu hồi trơn (anh 16/11/2026); toạ độ ảnh: u = 1 − s / L (s dọc cạnh từ đầu), v theo độ cao trong khung ảnh
      const P = [], UV = [], dat = (s, y) => { P.push(x1 + ux * s + nx * 0.04, y, z1 + uz * s + nz * 0.04); UV.push(1 - s / a.L, (y - a.y0) / (a.yTren - a.y0)); };
      for (const [s, y] of [[0, y0], [L, y0], [L, y1], [0, y0], [L, y1], [0, y1]]) dat(s, y);
      const da = t.k?.hinh?.[0] || [];
      for (let j = 0; j + 8 < da.length; j += 9) {
        const q = [0, 3, 6].map((o) => [da[j + o], da[j + o + 1], da[j + o + 2]]);
        if (q.some(([x, y, z]) => Math.abs((x - x1) * nx + (z - z1) * nz) > 0.25 || y < t.y1 - 0.05) || Math.max(...q.map((p) => p[1])) < t.y1 + 0.5) continue;
        for (const [x, y, z] of q) dat((x - x1) * ux + (z - z1) * uz, Math.min(y, a.yTren));
      }
      const gH = new THREE.BufferGeometry(); gH.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gH.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      const m = new THREE.Mesh(gH, new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: 0.5, toneMapped: false, side: THREE.DoubleSide }));
      m.visible = !LOP_OSM.dangAn; scene.add(m); LOP_OSM.push(m); dem2.mat++;
    }
    console.info('[ns] ảnh dán mặt tường:', dem2.mat, 'mặt');
  })();
  // tháp góc treo trên con-xon (đánh dấu thap_goc trong tệp sửa theo ảnh): con-xon, gờ tầng, cửa sổ vòm nhỏ mặt ngoài, vành răng cưa
  const goc = dsKhoi.filter((k) => k.tags.thap_goc === 'yes' && k.yDuoi != null);
  const T = BO_MET?.thap, Y = (d) => MAI_SAN - d; // cao độ tuyệt đối từ số đo ảnh (mét dưới mái)
  const bT = T && { chop: Y(T.chop), chanChop: Y(T.chanChop), dinhRang: Y(T.dinhRang), dinhThan: Y(T.dinhThan), frieze: T.frieze.map(Y), tang: T.tang.map((t) => ({ dinh: Y(t.dinh), bau: Y(t.bau), w: t.w })), go: T.go.map((g) => g.map(Y)), rang: T.rang.map(Y), chanThan: Y(T.chanThan), mui: Y(T.mui) };
  if (bT) for (const k of goc) for (const m of datThapGoc({ THREE, mergeGeometries, v: k.v, b: bT, mauMai: k.tags['roof:colour'], mau: mauOSM(k.tags['building:colour'], new THREE.Color('#dcc48e')),
    ngoai: (x, z) => !dsKhoi.some((q) => q !== k && trongDa(x, z, q.v)), nhe: CHAM })) { m.userData.nha = true; scene.add(m); LOP_OSM.push(m); }
  // KHUNG VÒM CỔNG (đá): hai má + vòm bán nguyệt + bậu nền, hai mặt tường; lỗ đã khoét trong loCanh
  // màu đá sa thạch kem (VL.da nhân màu theo đỉnh — thiếu thuộc tính màu thì khung đen kịt như lỗ thủng)
  const MAU_VOM = new THREE.Color('#efe4c6').toArray();
  // khung vòm / cửa / huy hiệu đặt ở MẶT NGOÀI CÙNG: điểm cắt có thể nằm trên tường khối phía sau trong khi khối cổng nhô ra trước 1–2 m (khung + huy hiệu bị vùi)
  for (const c of VOM_CONG) { const nx = c.uz, nz = -c.ux; let d = 0; while (d < 4 && dsKhoi.some((k) => !(k.vo && k.coPart) && trongDa(c.x + nx * (d + 0.05), c.z + nz * (d + 0.05), k.v))) d += 0.1; c.x += nx * d; c.z += nz * d; }
  if (VOM_CONG.length) { const gs = [];
    for (const c of VOM_CONG) { const goc = Math.atan2(c.uz, -c.ux) + Math.PI / 2, h = (c.cao ?? CAO_CONG) - c.w / 2, cb = (g) => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).map((_, i) => MAU_VOM[i % 3]), 3)); g.rotateY(-Math.atan2(c.uz, c.ux)); g.translate(c.x, c.y, c.z); return g; };
      for (const k of [-1, 1]) gs.push(cb((() => { const g = new THREE.BoxGeometry(0.45, h, 1.2); g.translate(k * (c.w / 2 + 0.22), h / 2, 0); return g; })()));
      const v = new THREE.TorusGeometry(c.w / 2 + 0.22, 0.24, 5, 14, Math.PI); v.scale(1, 1, 2.4); v.translate(0, h, 0); gs.push(cb(v)); void goc; }
    const m = new THREE.Mesh(mergeGeometries(gs), VL.da); m.receiveShadow = m.castShadow = true; scene.add(m); LOP_OSM.push(m); console.info('[ns] vòm cổng (đường xuyên tường):', VOM_CONG.length); }
  // cổng NGOÀI (vòm thấp nhất — phía sân trước cổng): cánh cửa gỗ mở + huy hiệu trên vòm (trangtri.js)
  const cNgoai = VOM_CONG.slice().sort((a, b) => a.y - b.y)[0];
  if (cNgoai) { ghiKK(cNgoai.mat, 'canh_cua', cNgoai.y + 2, 2, cNgoai.x, cNgoai.z); ghiKK(cNgoai.mat, 'huy_hieu', cNgoai.y + CAO_CONG + 2.2, 1, cNgoai.x, cNgoai.z); }
  for (const c of VOM_CONG) ghiKK(c.mat, 'cong_vom', c.y + 2, 1, c.x, c.z);
  if (cNgoai) for (const m of datCuaCong({ THREE, mergeGeometries, c: cNgoai, cao: CAO_CONG, vlGo: new THREE.MeshStandardMaterial({ color: '#8a5634', roughness: 0.8 }), vlDa: new THREE.MeshStandardMaterial({ color: '#e6dcc2', roughness: 0.85 }) })) { scene.add(m); LOP_OSM.push(m); }
  { // TRANG TRÍ MẶT TIỀN theo thẻ sua.json (răng cưa, vòm nhỏ, đá góc, tháp canh, đỉnh tháp tròn) — trangtri.js
    const vlKem = vlTu(TEX.daVoi(TEX.rngTu(81)), { bump: 1 }); vlKem.color.set('#efe3c4');
    const { ra, dem, kk } = datTrangTri({ THREE, mergeGeometries, dsKhoi, vl: vlKem, coSoDo: (id) => CUA_SO?.[id]?.hang, oVuong: (id) => CUA_SO?.[id]?.o_vuong, soDo: (id) => CUA_SO?.[id], ngoai: (k, x, z, y) => !dsKhoi.some((q) => q !== k && !(q.vo && q.coPart) && (q.yTren ?? 0) > y && (q.yDuoi ?? -1e9) < y && trongDa(x, z, q.v)) });
    for (const m of ra) { m.userData.nha = true; scene.add(m); LOP_OSM.push(m); } console.info('[ns] trang trí mặt tiền:', JSON.stringify(dem)); THIEU_ANH.push(...(dem.thieuAnh || [])); KIEM_KE.push(...kk);
  }
  // đá nắp kem trên mỗi bậc (ảnh 360° cổng Torbau: bậc gạch đỏ, mặt trên phủ đá sa thạch kem nhô hai bên)
  for (const b of BAC_HOI.slice()) if (!b.nap) BAC_HOI.push({ ...b, y: b.y + b.h / 2 + 0.09, h: 0.18, w: b.w + 0.12, mau: new THREE.Color('#e8dcbe'), nap: true });
  if (BAC_HOI.length) { const gs = BAC_HOI.map((b) => { const g = new THREE.BoxGeometry(b.w, b.h, 0.55).toNonIndexed(); g.rotateY(-b.goc); g.translate(b.x, b.y, b.z); const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set([b.mau.r, b.mau.g, b.mau.b], i); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; });
    const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); m.castShadow = m.receiveShadow = true; scene.add(m); LOP_OSM.push(m); }
  // DIỀM VÒM ĐỠ dưới lan can mái bằng (tag dam_vom, tháp vuông: ảnh anh gửi 16/11/2026): dải gờ nhô 0,45 m, con-xon cách 0,9 m, vòm nhỏ giữa hai con-xon
  { const gs = [], cb = (g) => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a); return g; };
    for (const k of dsKhoi) { if (k.tags.dam_vom !== 'yes' || k._y1 == null) continue; const y1 = k._y1;
      for (let i = 0; i < k.v.length; i++) { const [x1, z1] = k.v[i], [x2, z2] = k.v[(i + 1) % k.v.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 1) continue;
        const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux, goc = Math.atan2(nx, nz), dat = (g, s, y, d) => { g.rotateY(goc); g.translate(x1 + ux * s + nx * d, y, z1 + uz * s + nz * d); gs.push(cb(g)); };
        dat(new THREE.BoxGeometry(L + 0.9, 0.35, 0.5), L / 2, y1 - 0.18, 0.25); // gờ đỡ lan can
        for (let s = 0.45; s < L - 0.2; s += 0.9) { dat(new THREE.BoxGeometry(0.22, 1.3, 0.45), s, y1 - 1.0, 0.22); } // con-xon
        for (let s = 0.9; s < L - 0.2; s += 0.9) { const v = new THREE.TorusGeometry(0.34, 0.06, 3, 6, Math.PI); dat(v, s, y1 - 0.75, 0.42); } // vòm nhỏ
      } }
    if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), VL.da); m.receiveShadow = true; m.castShadow = !CHAM; scene.add(m); LOP_OSM.push(m); } }
  // CỬA MÁI + CHÓP NHỎ dựng khối 3D theo số đo (bỏ khối có mái mô hình lệch ảnh 3D > 3 m: chỗ đó số đo không tin được); y lấy lại trên mặt mái mô hình
  if (MAI?.khoi) { const ds = [];
    for (const [id, cs] of Object.entries(MAI.khoi)) { const k = dsKhoi.find((q) => q.id === id); if (!k?.hinh?.[1]?.length) continue;
      const tg = k.hinh[1], mai = (x, z) => { let y = null; for (let i = 0; i + 8 < tg.length; i += 9) { const [ax, ay, az, bx, by, bz, cx, cy, cz] = tg.slice(i, i + 9), d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-6) continue; const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v; if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue; const yy = u * ay + v * by + w * cy; if (y == null || yy > y) y = yy; } return y; };
      for (const c of cs) { if (c.rong < 0.8 || c.rong > 6 || c.nho > 10) continue; const y = mai(c.x, c.z); if (y == null) continue; ds.push({ ...c, y: y - 0.2 }); } }
    for (const m of datMai({ THREE, mergeGeometries, ds, nhe: CHAM })) { m.userData.nha = true; scene.add(m); LOP_OSM.push(m); }
    for (const [id, cs] of Object.entries(MAI?.khoi || {})) for (const c of cs || []) ghiKK(id + '#mai', c.loai === 'chop' ? 'chop' : 'cua_mai', c.y, 1, c.x, c.z);
    console.info('[ns] cửa mái / chóp trên mái (đo ảnh 3D):', ds.filter((c) => c.loai === 'cuaMai').length, '/', ds.filter((c) => c.loai === 'chop').length); }
  if (CHOP?.chop?.length) for (const m of datChop({ THREE, mergeGeometries, ds: CHOP.chop, nhe: CHAM })) { m.userData.nha = true; scene.add(m); LOP_OSM.push(m); }
  console.info('[ns] mặt tiền chi tiết:', JSON.stringify({ ...dem, thapGoc: goc.length, chop: CHOP?.chop?.length || 0 }));
}
const LOP_NHA = new Set(LOP_OSM.slice(LOP_NHA_TU));
// CÁCH 3 (anh 16/11/2026): lâu đài dựng từ bản đồ độ cao thật (cach3.js, du-lieu/<lâu>-cach3.json) — lớp XEM để so với cách cũ; đi bộ / va chạm vẫn theo cách cũ
const CACH3 = { bat: false, g: null };
const DU_CACH3 = await fetch(`./du-lieu/${ten}-cach3.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
function datCach3Hien(bat) {
  if (bat && !CACH3.g && DU_CACH3) { const khoiTai = (x, z) => dsKhoi.find((k) => !(k.vo && k.coPart) && trongDa(x, z, k.v)) || dsKhoi.filter((k) => !(k.vo && k.coPart)).sort((a, b) => Math.hypot(...tamDa(a.v).map((v, i) => v - [x, z][i])) - Math.hypot(...tamDa(b.v).map((v, i) => v - [x, z][i])))[0];
    const daMau = new Map(), mauTuong = (x, z) => { const k = khoiTai(x, z); if (!k) return new THREE.Color('#e3ddd0'); if (!daMau.has(k.id)) daMau.set(k.id, mauOSM(k.tags['building:colour'], new THREE.Color('#e3ddd0')).lerp(new THREE.Color('#e3ddd0'), 0.25)); return daMau.get(k.id); };
    CACH3.g = datCach3({ THREE, du: DU_CACH3, datThat, mauTuong }); scene.add(CACH3.g); LOP_OSM.push(CACH3.g); console.info('[ns] cách 3:', CACH3.g.userData.tamGiac, 'tam giác'); }
  CACH3.bat = bat && !!CACH3.g; apHienCach3();
  if ($('b-cach3')) { $('b-cach3').classList.toggle('chinh', CACH3.bat); $('b-cach3').title = CACH3.bat ? 'Đang xem CÁCH 3 (khối khớp lưới ảnh 3D). Bấm để về cách dựng cũ' : 'Xem CÁCH 3: lâu đài dựng từ bản đồ độ cao thật của ảnh 3D (so với cách dựng cũ)'; }
  try { localStorage.setItem('ns-cach3', CACH3.bat ? '1' : '0'); } catch {}
}
// nút 🧩: tải lại trang ở cách kia (giữ góc nhìn #g=…) — độ cao khối áp lúc dựng nên phải dựng lại
$('b-cach3').classList.toggle('chinh', CACH === '3'); $('b-cach3').title = CACH === '3' ? 'Đang xem CÁCH 3: độ cao mọi khối đo từ bản đồ độ cao thật (ảnh 3D). Bấm để về cách cũ' : 'Xem CÁCH 3: độ cao mọi khối đo từ bản đồ độ cao thật của ảnh 3D (so với cách cũ)';
// CHUYỂN TỨC THÌ (anh 16/11/2026: "bấm không phải mở lại như F5"): máy tính — trang chính dựng sẵn bản cách 3 trong một khung ẩn phủ màn (?cach=3&nhung=1)
// sau khi trang chính xong; bấm 🧩 = đưa góc nhìn hiện tại sang khung rồi hiện khung; trong khung bấm 🧩 = đưa góc về trang chính rồi ẩn khung.
// Điện thoại (CHAM): hai bản cùng lúc quá nặng bộ nhớ → tải lại trang như cũ. Mở thẳng ?cach=3 (không nhúng) cũng tải lại khi bấm.
const NHUNG = new URLSearchParams(location.search).get('nhung') === '1' && window.parent !== window;
let khungC3 = null, khungSan = false, choHien = false, c3Hien = false; // c3Hien: (trong khung) khung đang được hiện
const hienKhung = (hien) => { if (!khungC3) return; khungC3.style.visibility = hien ? 'visible' : 'hidden'; khungC3.style.pointerEvents = hien ? 'auto' : 'none'; if (hien) khungC3.focus(); };
addEventListener('message', (e) => {
  if (e.origin !== location.origin) return; const d = e.data || {};
  if (!NHUNG && d.loai === 'c3:san-sang') { khungSan = true; if (choHien) { choHien = false; khungC3.contentWindow.postMessage({ loai: 'c3:goc', g: gocHienTai() }, location.origin); hienKhung(true); } }
  if (!NHUNG && d.loai === 'c3:ve') { if (d.g) khoiPhucGoc(d.g); hienKhung(false); }
  if (NHUNG && d.loai === 'c3:goc') { c3Hien = true; if (d.g) khoiPhucGoc(d.g); }
});
if (!NHUNG && !CHAM && CACH !== '3') setTimeout(() => { // dựng sẵn nền sau khi trang chính chạy ổn (không tranh tải lúc đầu)
  const q = new URLSearchParams(location.search); q.set('cach', '3'); q.set('nhung', '1');
  khungC3 = document.createElement('iframe'); khungC3.src = `${location.pathname}?${q}`; khungC3.title = 'Cách 3';
  khungC3.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:20;visibility:hidden;pointer-events:none;background:transparent'; document.body.append(khungC3);
}, 4000);
$('b-cach3').onclick = (e) => { e.stopPropagation();
  if (NHUNG) { c3Hien = false; parent.postMessage({ loai: 'c3:ve', g: gocHienTai() }, location.origin); return; }
  if (khungC3) { if (khungSan) { khungC3.contentWindow.postMessage({ loai: 'c3:goc', g: gocHienTai() }, location.origin); hienKhung(true); } else { choHien = true; $('b-cach3').title = 'Đang dựng sẵn cách 3… sẽ tự chuyển khi xong'; } return; }
  luuGoc(true); const q = new URLSearchParams(location.search); if (CACH === '3') q.delete('cach'); else q.set('cach', '3'); location.href = `${location.pathname}?${q}${location.hash}`; };
if (CACH === 'dsm') datCach3Hien(true);
// LỚP 🧭 KIỂM (danhgia.js): khối → mặt → chi tiết, tô màu theo kết quả máy — dựng ở cuối tệp (sau khi cửa sổ / chi tiết đã ghi sổ). Khung cũ chỉ cách 3 đã gộp vào đó.
function apHienCach3() { // gọi lại sau mọi chỗ đặt hiện / ẩn LOP_OSM (lớp ảnh thật 3D, so ảnh)
  if (LOP_OSM.dangAn) { if (CACH3.g) CACH3.g.visible = false; return; }
  for (const m of LOP_NHA) m.visible = !CACH3.bat; if (CACH3.g) CACH3.g.visible = CACH3.bat; }
{ // mặt Palas hướng sân trên: tranh thánh George + Đức Mẹ Bavaria, ban công (mattien.js datMatPalas); sân trong lát đá
  const san = SAN_TRONG, tot = MAT_PALAS;
  if (san) {
    const [cx, cz] = tamDa(san);
    console.info('[ns] mặt Palas hướng sân:', tot ? `(${tot.x1.toFixed(1)},${tot.z1.toFixed(1)})→(${tot.x2.toFixed(1)},${tot.z2.toFixed(1)}) dài ${tot.L.toFixed(1)} m, mái ${tot.y1.toFixed(1)}, đầu hồi ${JSON.stringify(tot.hoi)}` : 'không tìm thấy', '· sân', cx.toFixed(1), cz.toFixed(1));
    if (tot) (async () => { // tranh tải nền, không chặn trang
      const tl = new THREE.TextureLoader(), TR = {};
      for (const ten of ['palas-thanh-george', 'palas-duc-me']) try { const t = await tl.loadAsync(`./du-lieu/anh/ngoai/${ten}.jpg`); t.colorSpace = THREE.SRGBColorSpace; TR[ten] = t; } catch (e) { console.warn('[ns] không tải được tranh mặt Palas', ten, e); }
      const mp = datMatPalas({ THREE, mergeGeometries, tuong: tot, tranh: TR }); CUA.push(...(mp.cua || []));
      for (const m of mp) { m.visible = !LOP_OSM.dangAn && !CACH3.bat; scene.add(m); LOP_OSM.push(m); LOP_NHA.add(m); } // cờ trên LOP_OSM (khai sớm) — anh3d khai sau, đọc ở đây dễ dính lỗi chưa khai báo
    })();
    // sân lát đá trong mặt bằng sân trên (OSM courtyard), nhô 6 cm. Nền phẳng (SAN_PHANG): một mặt phẳng cắt ĐÚNG mép đa giác + va chạm — mép là tường chắn
    // (duong.js tuongSan), ô lưới đất cắt ngang mép đã hạ xuống phía thấp (khối đất mịn bên dưới); trước là ô 1,5 m bám lưới đất nội suy → mép sân võng thành dốc đá (góp ý #1633)
    const p = [], uv = [], B = 1.5;
    if (SAN_PHANG) { const sh = new THREE.Shape(san.map(([x, z]) => new THREE.Vector2(x, -z))), g0 = new THREE.ShapeGeometry(sh).toNonIndexed(); g0.rotateX(-Math.PI / 2);
      const a = g0.attributes.position; for (let i = 0; i < a.count; i++) { p.push(a.getX(i), SAN_PHANG.y + 0.06, a.getZ(i)); uv.push(a.getX(i) / 3, a.getZ(i) / 3); }
      world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p), Uint32Array.from({ length: p.length / 3 }, (_, i) => i)), tinh);
    } else { let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, z] of san) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, z); b1 = Math.max(b1, z); }
      for (let x = a0; x < a1; x += B) for (let z = b0; z < b1; z += B) { if (!trongDa(x + B / 2, z + B / 2, san)) continue;
        const q = [[x, z], [x + B, z], [x + B, z + B], [x, z + B]].map(([u, w]) => [u, datThat(u, w) + 0.06, w]);
        for (const k of [0, 2, 1, 0, 3, 2]) { p.push(...q[k]); uv.push(q[k][0] / 3, q[k][2] / 3); } } }
    if (p.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      const vt = T.daXay(T.rngTu(41), 32, 58); for (const x of [vt.map, vt.bump]) if (x) x.wrapS = x.wrapT = THREE.RepeatWrapping;
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: vt.map, bumpMap: vt.bump, bumpScale: 1.2, roughness: 0.9 })); m.receiveShadow = true; scene.add(m); LOP_OSM.push(m); }
  }
}
// LƯỚI ĐẤT MỊN quanh lâu đài (ô 1,5 m, chỗ mặt đất thật cao hơn lưới thô): mặt đá + va chạm — người đi trên mặt đất thật, không trên lưới thô bên dưới
const HOP_NHA = dsKhoi.filter((k) => k.tags.building !== 'courtyard').map((k) => { const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]); return { v: k.v, a: Math.min(...xs), b: Math.max(...xs), c: Math.min(...zs), d: Math.max(...zs) }; });
const trongNhaLuoi = (x, z) => HOP_NHA.some((h) => x > h.a && x < h.b && z > h.c && z < h.d && trongDa(x, z, h.v));
const THANG = (DUONG?.duong || []).filter((d) => d.loai === 'steps' && d.v.length >= 2);
const doc = (x, z, [x1, z1], [x2, z2]) => { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1, t = ((x - x1) * dx + (z - z1) * dz) / l2; return t > 0.05 && t < 0.95 ? Math.abs((x - x1) * dz - (z - z1) * dx) / Math.sqrt(l2) : Infinity; }; // khoảng cách ngang tới thân đoạn (không tính quanh đầu mút)
const duoiThang = (x, z) => THANG.some((d) => d.v.some((p, k) => k + 1 < d.v.length && doc(x, z, p, d.v[k + 1]) < Math.max(1.2, d.rong) / 2 + 0.4)); // chỉ dọc THÂN thang — khoét quanh đầu mút làm thủng mặt sân (rơi xuống, anh 16/11/2026)
if (NEN_LUOI) {
  // chia theo ĐỘ DỐC từng ô (anh 16/11/2026: mỏm đá thành vách lát gạch xám, nhìn giả): dốc > 45° = vách đá tự nhiên (vân bazan sáng, chiếu ngang),
  // thoải = đất rừng có cỏ (như sườn có cây ngoài đời); va chạm vẫn là một lưới chung
  const L = NEN_LUOI, p = [], uv = [], nhom = { da: { p: [], uv: [] }, co: { p: [], uv: [] }, xay: { p: [], uv: [] } };
  // MÉP NỀN SÂN TRÊN (góp ý #1633): ô lưới cắt ngang mép đa giác sân mà chênh > 1,5 m → các đỉnh TRONG sân hạ xuống mức đỉnh ngoài thấp nhất (khối đất nằm dưới mặt lát
  // phẳng, cắt đúng mép); vách đứng là tường chắn (duong.js tuongSan) — trước ô đó là một mặt dốc đá tự nhiên từ sân trên xuống sân dưới
  const trongSan = SAN_PHANG ? Uint8Array.from({ length: L.W * L.H }, (_, q) => (trongDa(L.x0 + (q % L.W) * L.B, L.z0 + Math.floor(q / L.W) * L.B, SAN_PHANG.v) ? 1 : 0)) : null;
  // VÙNG XÂY (sân lát khép kín OSM + nền sân trên): ô dốc trong đó là tường / bậc xây, không phải vách đá tự nhiên → vân đá vôi xây (VL.mong) thay đá xám chia mặt
  const VUNG_XAY = [...(SAN_PHANG ? [SAN_PHANG.v] : []), ...(DUONG?.duong || []).filter((d) => ['pedestrian', 'footway'].includes(d.loai) && d.v.length > 3 && Math.hypot(d.v[0][0] - d.v.at(-1)[0], d.v[0][1] - d.v.at(-1)[1]) < 0.3).map((d) => d.v)];
  let haMep = 0;
  for (let j = 0; j + 1 < L.H; j++) for (let i = 0; i + 1 < L.W; i++) {
    const o = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]; if (o.every(([a, b]) => L.nang[L.id(a, b)] < 0.15)) continue;
    if (duoiThang(L.x0 + (i + 0.5) * L.B, L.z0 + (j + 0.5) * L.B) || trongNhaLuoi(L.x0 + (i + 0.5) * L.B, L.z0 + (j + 0.5) * L.B)) continue; // trong mặt bằng nhà: đất lấp nội suy thành gò cao 7 m ngay sau vòm cổng (chặn lối xuyên cổng, anh 16/11/2026) — tường bao kín, lối đi có mặt đường riêng // dưới cầu thang: bậc đá là mặt đi, đất đo từ ảnh cao hơn bậc sẽ vùi bậc (kẹt, anh 16/11/2026)
    const q = o.map(([a, b]) => [L.x0 + a * L.B, L.G[L.id(a, b)] + 0.02, L.z0 + b * L.B]);
    if (trongSan) { const tr = o.map(([a, b]) => trongSan[L.id(a, b)]);
      if (tr.some(Boolean) && !tr.every(Boolean)) { const thap = Math.min(...q.filter((_, k) => !tr[k]).map((v) => v[1])); if (Math.max(...q.map((v) => v[1])) - thap > 1.5) { q.forEach((v, k) => { if (tr[k]) v[1] = thap; }); haMep++; } } }
    const ys = q.map((v) => v[1]), doc = (Math.max(...ys) - Math.min(...ys)) / (L.B * Math.SQRT2), ngang = doc > 1;
    const g = !ngang ? nhom.co : VUNG_XAY.some((v) => trongDa(L.x0 + (i + 0.5) * L.B, L.z0 + (j + 0.5) * L.B, v)) ? nhom.xay : nhom.da;
    for (const k of [0, 2, 1, 0, 3, 2]) { p.push(...q[k]); g.p.push(...q[k]); g.uv.push(ngang ? (q[k][0] + q[k][2]) / 6 : q[k][0] / 4, ngang ? q[k][1] / 6 : q[k][2] / 4); }
  }
  if (p.length) {
    // đá vôi xám sáng chia mặt (như vách Pöllat ngoài đời) — vân bazan đen + cỏ xanh đậm trước đó nhìn như đất cháy (anh 16/11/2026)
    const vlNhom = { da: new THREE.MeshStandardMaterial({ color: '#b3ada2', roughness: 0.95, flatShading: true }), co: new THREE.MeshStandardMaterial({ color: '#7d9256', roughness: 1, flatShading: true }), xay: VL.mong };
    for (const [k, gg] of Object.entries(nhom)) { if (!gg.p.length) continue;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gg.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(gg.uv, 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, vlNhom[k]); m.receiveShadow = true; scene.add(m); LOP_OSM.push(m); }
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p), Uint32Array.from({ length: p.length / 3 }, (_, i) => i)), tinh);
    console.info('[ns] mặt đất thật quanh lâu đài:', p.length / 18, 'ô · nâng tối đa', Math.max(...L.nang).toFixed(1), 'm · ô mép nền sân hạ', haMep, '· ô dốc xây', nhom.xay.p.length / 18);
  }
}

// ---- ĐƯỜNG ĐI + CẦU THANG OSM (duong.js): mặt đường bám đất thật, bậc đá có va chạm
if (DUONG?.duong?.length) {
  const tx = (t, lap) => { for (const x of [t.map, t.bump]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; } return t; };
  // sân lát Unterer / Oberer Hof: ảnh 3D Google (góp ý #1629) là đá vôi xám sáng; vân sáng 50 nhân màu #b9b3a8 trước đây ra nâu đất
  const nhua = tx(T.daXay(T.rngTu(61), 40, 76)), dat = tx(T.cuoi(T.rngTu(62))), bac = tx(T.daXay(T.rngTu(63), 30, 60));
  // BỒN CỎ SÂN TRƯỚC CỔNG (ảnh trực giao DOP20, scripts/san-cong-dop.py): mặt cỏ cao hơn mặt sân 0,15 m + bó vỉa đá
  if (SAN_CONG?.co?.length) { const vc = vlTu(T.co(T.rngTu(5))), vb = new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 0.85 });
    for (const v of SAN_CONG.co) { const sh = new THREE.Shape(v.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, SAN_CONG.y + 0.15, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
      const m = new THREE.Mesh(g, vc); m.receiveShadow = true; scene.add(m); LOP_OSM.push(m);
      for (let i = 0; i < v.length; i++) { const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const k = new THREE.Mesh(new THREE.BoxGeometry(L + 0.15, 0.22, 0.15), vb); k.position.set((ax + bx) / 2, SAN_CONG.y + 0.08, (az + bz) / 2); k.rotation.y = -Math.atan2(bz - az, bx - ax); scene.add(k); LOP_OSM.push(k); } } }
  const { ra, dem } = datDuong({ THREE, mergeGeometries, RAPIER, world, tinh, ds: DUONG.duong, cao: datThat, trongNha: (x, z) => dsKhoi.some((k) => trongDa(x, z, k.v)), vungLat: NEN_LUOI?.sanCong ? [{ v: NEN_LUOI.sanCong, cao: NEN_LUOI.caoSan }] : [],
    tuongSan: SAN_PHANG ? [{ v: SAN_PHANG.v, mat: () => SAN_PHANG.y }] : [], // nền sân trên: tường chắn + lan can mép tụt xuống sân dưới (góp ý #1633)
    vl: { nhua: new THREE.MeshStandardMaterial({ map: nhua.map, bumpMap: nhua.bump, bumpScale: 0.8, roughness: 0.92, color: '#d8d4cc' }),
      oto: new THREE.MeshStandardMaterial({ bumpMap: nhua.bump, bumpScale: 0.15, roughness: 0.9, color: '#8e8b85' }),
      tuong: VL.mong, nap: new THREE.MeshStandardMaterial({ color: '#d9d5cc', roughness: 0.85 }), // lan can / tường chắn: đá xám sáng (ảnh Mapillary), đá nắp sáng hơn
      dat: new THREE.MeshStandardMaterial({ map: dat.map || null, roughness: 0.95, color: '#9c8c72' }),
      bac: new THREE.MeshStandardMaterial({ map: bac.map, bumpMap: bac.bump, bumpScale: 1, roughness: 0.9, color: '#d6d0c4' }) } });
  for (const m of ra) { scene.add(m); LOP_OSM.push(m); }
  console.info('[ns] đường đi:', JSON.stringify({ ...dem, m: Math.round(dem.m) }));
}

// ---- NỘI THẤT Palas (noithat.js): sàn, phòng theo bản vẽ, cầu thang xoắn, đồ đạc, đèn chùm
let noiThat = null;
if (NOI) {
  const veCanvas = (ve) => { const c = document.createElement('canvas'); c.width = c.height = 512; ve(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  NT._vanKham = veCanvas((g) => { // sàn khảm phòng ngai vàng: vòng tròn đồng tâm + hoa văn (phỏng dựng)
    g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, 512, 512);
    for (let r = 250; r > 10; r -= 22) { g.strokeStyle = r % 44 ? '#7a5a2a' : '#2a4a7a'; g.lineWidth = 7; g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.fillStyle = i % 2 ? '#8a2a2a' : '#c9a24a'; g.beginPath(); g.arc(256 + Math.cos(a) * 180, 256 + Math.sin(a) * 180, 12, 0, 7); g.fill(); }
  });
  NT._vanKham.repeat.set(1, 1);
  const vanTran = veCanvas((g) => { g.fillStyle = '#1e3a7a'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#f0d070'; for (let i = 0; i < 160; i++) { const x = (i * 97) % 512, y = (i * 173) % 512; g.beginPath(); g.arc(x, y, 3 + (i % 3), 0, 7); g.fill(); } });
  vanTran.repeat.set(3, 3);
  const vanSan = T.van(T.rngTu(9)).map; vanSan.repeat?.set(1, 1);
  // đồ đạc KayKit (một tệp, mỗi món một Scene) + tranh tường thật cắt từ photochrom ~1900 — lỗi tải thì vẫn dựng phòng (thiếu đồ / tranh)
  let DO = null; const TRANH = {};
  try { const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder); const g = await ld.loadAsync('./tai-san/do-noi-that.glb'); DO = Object.fromEntries(g.scenes.map((sc) => [sc.name, sc])); } catch (e) { console.warn('[ns] không nạp được đồ nội thất', e); }
  try {
    const ds = await (await fetch('./du-lieu/anh/noi-that/nguon.json', { cache: 'no-cache' })).json(), tl = new THREE.TextureLoader();
    await Promise.all(Object.keys(ds).map(async (k) => { const t = await tl.loadAsync(`./du-lieu/anh/noi-that/${k}.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TRANH[k] = t; }));
  } catch (e) { console.warn('[ns] không nạp được tranh tường', e); }
  noiThat = dungNoiThat({ RAPIER, world, tinh, scene, NT, yDay: NOI.y3 - NT.tang3, vienPalas: NOI.palas.v, thapV: NOI.thap.v, yCua: NOI.yCua, vanSan, vanTran, DO, TRANH });
}
const RUNG = []; let RUNG_O = []; // ẩn khi so ảnh thật (cây mọc ở mép vực che tầm nhìn từ cầu Marienbrücke; so ảnh chỉ đối chiếu lâu đài)
// ---------- rừng: vân sam (thân + tán nón) vẽ hàng loạt; chừa nhà (+6 m), vách dốc, mép lưới
{
  const r2 = T.rngTu(23), viTri = [];
  // nhà + nền sân trên: không mọc cây xuyên qua
  const hopNha = [...dsKhoi, ...(SAN_TRONG ? [{ v: SAN_TRONG }] : [])].map((k) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, z] of k.v) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return [a - 6, b + 6, c - 6, d + 6]; });
  // TRONG VÙNG CÓ SỐ ĐO TÁN CHÍNH THỨC (DOM20 − DGM1, 20/11/2026): cây đứng đúng ngọn cây đo được, cao đúng tán (thân + nón cao ~15 m ở tỉ lệ 1); ngoài vùng rải như cũ
  const V = CAY?.vung, trongV = (x, z) => V && x >= V[0] && x <= V[1] && z >= V[2] && z <= V[3];
  for (const [x, z, h] of CAY?.cay || []) { if (Math.abs(x) > NUA - 15 || Math.abs(z) > NUA - 15 || (SAN_TRONG && trongDa(x, z, SAN_TRONG))) continue; viTri.push([x, datThat(x, z) - 0.3, z, Math.max(0.35, Math.min(2.4, h / 15)), r2() * 6.28]); }
  for (let t = 0; t < 9000 && viTri.length < 2600 + (CAY?.cay?.length || 0); t++) {
    const x = (r2() * 2 - 1) * (NUA - 15), z = (r2() * 2 - 1) * (NUA - 15);
    if (trongV(x, z) || hopNha.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) continue;
    const dx = caoDat(x + 2, z) - caoDat(x - 2, z), dz = caoDat(x, z + 2) - caoDat(x, z - 2);
    if (Math.hypot(dx, dz) / 4 > 0.9) continue; // vách đá: ít cây
    viTri.push([x, datThat(x, z) - 0.3, z, 0.7 + r2() * 0.6, r2() * 6.28]);
  }
  const tan = new THREE.ConeGeometry(2.6, 11, 7); tan.translate(0, 9.5, 0);
  const goc = new THREE.CylinderGeometry(0.25, 0.4, 5, 4, 1, true); goc.translate(0, 2.5, 0); // thân 4 mặt không nắp: 8 tam giác/cây thay 20 (2.600 cây; phần lớn thân nằm dưới tán)
  // CHIA Ô 140 m (cân số lệnh vẽ với lượng loại bỏ): mỗi ô một cặp InstancedMesh có khối bao riêng → ô ngoài khung nhìn bị loại sẵn (frustum culling), ô ở xa tắt hẳn (anCayXa, 4 lần/giây).
  // Trước đây cả rừng một khối: cây sau lưng / tận chân núi vẫn vẽ (anh 15/11/2026 "cái nào ở xa không cần render").
  const vlT = new THREE.MeshStandardMaterial({ color: 0x2f4a2c, roughness: 0.95, flatShading: true }), vlG = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  const rung = new THREE.Group(), O = 140, nhomO = new Map();
  viTri.forEach((v, i) => { const k = Math.floor(v[0] / O) + ',' + Math.floor(v[2] / O); if (!nhomO.has(k)) nhomO.set(k, []); nhomO.get(k).push([...v, i]); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const ds of nhomO.values()) {
    const iT = new THREE.InstancedMesh(tan, vlT, ds.length), iG = new THREE.InstancedMesh(goc, vlG, ds.length);
    ds.forEach(([x, y, z, s, a, i], j) => { m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(s, s * (0.9 + (i % 5) * 0.06), s)); iT.setMatrixAt(j, m4); iG.setMatrixAt(j, m4); iT.setColorAt(j, c.setHSL(0.3 + (i % 7) * 0.008, 0.3, 0.17 + (i % 11) * 0.008)); });
    iT.computeBoundingSphere(); iG.computeBoundingSphere(); iT.castShadow = !CHAM; iT.receiveShadow = true; // điện thoại: tán cây không đổ bóng
    const o = new THREE.Group(); o.add(iT, iG); o.userData.tam = iT.boundingSphere.center.clone(); rung.add(o);
  }
  scene.add(rung); RUNG_O = rung.children;
  // thân cây có va chạm (trụ) từ gốc tới gần ngọn: đi không xuyên cây nữa, và bộ leo dibo (bám mọi mặt đứng) trèo được lên tới ngọn tán rồi đu lên đứng ở chạc ngọn
  // va chạm cây TẮT sẵn, anCayXa chỉ bật cây trong 60 m quanh người đi bộ: ~2.600 cây × 2 khối trụ luôn bật làm mỗi bước vật lý tốn ~4 ms
  // (anh 17/11/2026 "máy tính mở page nặng quá" — đo: 5,9 ms/bước → 0,6 ms khi chỉ giữ khối gần)
  for (const [x, y, z, s] of viTri) { const h = 12 * s; CAY_VA.push(world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, 0.32 * s).setTranslation(x, y + h / 2, z).setFriction(0.8).setEnabled(false), tinh));
    CAY_VA.push(world.createCollider(RAPIER.ColliderDesc.cylinder(0.06, 0.8).setTranslation(x, y + h, z).setEnabled(false), tinh)); CAY_XZ.push(x, z, x, z); } // chạc ngọn: leo tới đỉnh thì đu lên đứng được, không tuột rơi
  RUNG.push(rung); LOP_OSM.push(rung); // bật / tắt (ảnh thật, so ảnh) tác động nhóm cha; anCayXa tác động từng ô bên trong
}

// ---------- điều khiển + nhãn
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }; // cảm ứng: hai ngón vừa chụm / mở (phóng) vừa xoay như kéo chuột trái (anh 15/11/2026); mặc định là phóng + dời
orbit.target.set(0, 25, 0); camera.position.set(-170, 90, 230); orbit.enableDamping = true; orbit.maxPolarAngle = 1.52; orbit.minDistance = 15; orbit.maxDistance = 6000; orbit.update(); // trần 1500 → 6000 m: có cảnh xa 10 km (canhxa.js) thì lùi ra phải thấy được hồ Forggensee + dãy Alps
// DỜI CAMERA TOÀN CẢNH TRÊN PC (thẻ #1640, anh 17/11/2026 "thêm tính năng span trên pc"): giữ chuột phải kéo (touchpad Mac: bấm hai ngón rồi kéo)
// hoặc Shift / Ctrl / ⌘ + kéo chuột trái = dời ngang theo MẶT ĐẤT như bản đồ (screenSpacePanning tắt: điểm nhìn không bay lên trời / chui xuống núi);
// W A S D / mũi tên = dời theo hướng camera, giữ Shift nhanh gấp 3; tốc độ theo khoảng cách camera ↔ điểm nhìn (xem xa thì dời nhanh).
// Trong lúc dời: điểm nhìn giữ trên đảo địa hình (±NUA, chừa mép DOI_LE m — ngoài đó là trời trống) và không dưới mặt đất (camera đi cùng). Ngoài lúc dời không đụng camera (so-lech / trọng tài đặt góc).
orbit.screenSpacePanning = false; orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
const PHIM_DOI = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] }, DOI_LE = 40;
const doi = { phim: {}, nhanh: false, keoDen: 0 }, _vf = new THREE.Vector3(), _vr = new THREE.Vector3(), _vd = new THREE.Vector3();
addEventListener('keydown', (e) => { doi.nhanh = e.shiftKey; if (!PHIM_DOI[e.code] || e.target.closest?.('textarea, input') || di?.dang) return; doi.phim[e.code] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', (e) => { doi.nhanh = e.shiftKey; delete doi.phim[e.code]; });
addEventListener('blur', () => { doi.phim = {}; });
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey || e.metaKey))) doi.keoDen = Infinity; });
addEventListener('pointerup', () => { if (doi.keoDen === Infinity) doi.keoDen = performance.now() + 1500; }); // quán tính (enableDamping) còn trôi ~1 s sau khi nhả
function doiToanCanh(dt) {
  let fx = 0, fz = 0; for (const k in doi.phim) { fx += PHIM_DOI[k][0]; fz += PHIM_DOI[k][1]; }
  if (!fx && !fz && performance.now() > doi.keoDen) return;
  _vd.set(0, 0, 0); const t = orbit.target;
  if (fx || fz) {
    camera.getWorldDirection(_vf); _vf.y = 0; if (_vf.lengthSq() < 1e-6) _vf.set(0, 0, -1); _vf.normalize(); _vr.crossVectors(_vf, camera.up).normalize();
    const v = camera.position.distanceTo(t) * 0.5 * (doi.nhanh ? 3 : 1) * dt / Math.hypot(fx, fz);
    _vd.addScaledVector(_vf, fz * v).addScaledVector(_vr, fx * v);
  }
  const R = NUA - DOI_LE, kep = (v) => Math.max(-R, Math.min(R, v));
  _vd.x = kep(t.x + _vd.x) - t.x; _vd.z = kep(t.z + _vd.z) - t.z;
  const day = datThat(t.x + _vd.x, t.z + _vd.z) + 2; if (t.y < day) _vd.y = day - t.y;
  if (_vd.lengthSq() > 0) { t.add(_vd); camera.position.add(_vd); }
}
$('tt').innerHTML = `${dsKhoi.filter((k) => !(k.vo && k.coPart)).length} khối từ OpenStreetMap · cao nhất ${caoNhat ? caoNhat.h + ' m' : '—'} · địa hình ${n}×${n} điểm, ô ${B} m`;
addEventListener('resize', () => { if (dangSo) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// ---------- ĐI BỘ (bước 5): người chơi có xương + động tác thật, điều khiển dibo.js (dùng chung). Vào ở cổng Torbau phía đông.
let toi = null, di = null;
try { await napNguoi3d(); toi = taoNguoi3d(); } catch (e) { console.warn('[ns] không nạp được người 3D', e); }
if (toi) {
  toi.goc.visible = false; scene.add(toi.goc);
  di = taoDiBo({ RAPIER, world, camera, dom: renderer.domElement, toi, layTruc: () => camUng?.layTruc(), khiNhap: (x, y) => nemDoDangCam(x, y), ngoai: { buoc: (dt, tr) => buocNgoi(tr), khung: () => khungNgoi() }, khiDoi: (dang) => {
    camUng?.hien(dang); if (!dang) boTuongTac(); orbit.enabled = !dang; $('so').style.display = dang || !ANH.length ? 'none' : 'block'; $('b-di').style.display = dang ? 'none' : ''; $('b-toan').style.display = dang ? '' : 'none'; khoaHd = '';
  } });
}
const torbau = dsKhoi.find((k) => k.tags.name === 'Torbau');
function vaoCong() { // trước cổng Torbau, phía đông, quay mặt vào cổng
  if (!di) return; if (dangSo) tatSo();
  // đứng TRÊN ĐƯỜNG XE ngoài cổng: ô cổng = đỉnh đường xe nằm trên mép Torbau; đỉnh đường gần ô cổng (≤ 15 m) mà ở ngoài Torbau và XA thân lâu đài nhất = phía ngoài cổng
  // (phía trong là sân); mặt quay vào ô cổng; cao độ = mặt va chạm thật (mặt đường nâng), không phải lưới đất thô
  // (trước: x tâm + 10 m về phía đông → chân dốc, thấp hơn đường ~25 m, mặt úp vào vách đá)
  let o = null;
  if (torbau) {
    const dinh = DUONG_QUA.flatMap((d) => d.v), tamLau = tamDa(dsKhoi.flatMap((k) => k.v)), kc = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const oCong = dinh.filter((p) => torbau.v.some((q) => kc(p, q) < 0.3)), ngoaiTb = (p) => !trongDa(p[0], p[1], torbau.v) && torbau.v.every((q) => kc(p, q) > 1);
    for (const c of oCong) { // mỗi ô cổng: đỉnh đường ngoài Torbau cách ô cổng gần 6 m nhất; giữa các ô cổng: ô xa thân lâu đài nhất (cổng ngoài)
      const p = dinh.filter((p) => kc(p, c) >= 2 && kc(p, c) <= 15 && ngoaiTb(p)).sort((a, b) => Math.abs(kc(a, c) - 6) - Math.abs(kc(b, c) - 6))[0]; if (!p) continue;
      const xa = kc(p, tamLau); if (!o || xa > o.xa) o = { x: p[0], z: p[1], h: Math.atan2(c[0] - p[0], c[1] - p[1]), xa }; }
  }
  if (!o) { const [cx, cz] = torbau ? tamDa(torbau.v) : [0, 0]; o = { x: (torbau ? Math.max(...torbau.v.map((p) => p[0])) : 30) + 10, z: cz, h: -Math.PI / 2 }; }
  const h = world.castRay(new RAPIER.Ray({ x: o.x, y: 400, z: o.z }, { x: 0, y: -1, z: 0 }), 800, true), y = h ? 400 - h.timeOfImpact : datThat(o.x, o.z);
  di.vao(o.x, y + 0.3, o.z, o.h);
}
// GIỮ CHỖ ĐỨNG QUA TOÀN CẢNH (anh 17/11/2026: "chuyển toàn cảnh + đi bộ vẫn phải giữ vị trí nhân vật, trên toàn cảnh vẽ thêm nhân vật"):
// rời đi bộ thì nhớ chỗ chân + hướng (localStorage ns-cho, qua cả F5); toàn cảnh vẽ nhân vật đứng thở ở đó + ghim "Bạn" (cỡ cố định trên màn, xa vẫn thấy);
// bấm Đi bộ = về đúng chỗ đó (chưa đi lần nào → cổng Torbau như cũ; nhấp đúp xuống đất vẫn là đi bộ tại chỗ nhấp). Chụp 🔍 / so ảnh thì ẩn cả hai.
let cho = null, anNguoiChup = false, lucCho = 0; try { cho = JSON.parse(localStorage.getItem('ns-cho') || 'null'); } catch {}
const ghim = (() => {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 160; c.height = 112;
  g.fillStyle = 'rgba(14,20,30,.82)'; g.beginPath(); g.roundRect(8, 6, 144, 52, 14); g.fill(); g.beginPath(); g.moveTo(66, 58); g.lineTo(94, 58); g.lineTo(80, 80); g.fill();
  g.fillStyle = '#ffd9a8'; g.font = '600 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Bạn', 80, 33);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
  sp.scale.set(0.07, 0.049, 1); sp.center.set(0.5, 0.2); sp.renderOrder = 11; sp.visible = false; scene.add(sp); return sp;
})();
function luuCho() {
  if (!di?.dang || !toi) return; const p = toi.goc.position;
  cho = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: +toi.goc.rotation.y.toFixed(3),
    yaw: +di.yaw.toFixed(3), pitch: +di.pitch.toFixed(3), kc: +di.camXa.toFixed(2), gn: di.gocNhin }; // + camera: góc quay, ngẩng, zoom, góc nhìn 1 / 3
  try { localStorage.setItem('ns-cho', JSON.stringify(cho)); } catch {}
}
function apChoDung(dt = 0) { // gọi mỗi khung + trước / sau khi chụp
  if (!toi || !di) return;
  if (di.dang) { ghim.visible = false; return; }
  const hien = !!cho && !dangSo && !anNguoiChup; ghim.visible = hien; toi.goc.visible = hien; if (!hien) return;
  toi.goc.position.set(cho.x, cho.y, cho.z); toi.goc.rotation.y = cho.h; toi.capNhat(dt, { toc: 0, nen: true });
  ghim.position.set(cho.x, cho.y + 1.95, cho.z);
}
// trả lại camera đi bộ đúng như lúc rời (vao() đặt camera sau lưng mặc định; F5 khôi phục chỗ đứng cũng gọi hàm này)
function traCamCho() { if (!cho || !di) return; if (cho.yaw != null) { di.yaw = cho.yaw; di.pitch = cho.pitch; } if (cho.kc) di.camXa = cho.kc; if (cho.gn && cho.gn !== di.gocNhin) di.doiGocNhin(); }
// CHỖ ĐỨNG CŨ NẰM DƯỚI ĐẤT MỚI (20/11/2026: nền sân trước cổng nâng 8,7 m theo số đo chính thức → link #g=d,… và chỗ đứng đã lưu ở cổng rơi vào trong tường chắn):
// chân thấp hơn mặt đứng được tại đó quá 0,3 m thì đặt lên mặt đất
const chanAnToan = (x, z, y) => { const d = matDat(x, z); return Number.isFinite(d) && y < d - 0.3 ? d : y; };
$('b-di').onclick = () => { if (cho && di) { if (dangSo) tatSo(); di.vao(cho.x, chanAnToan(cho.x, cho.z, cho.y) + 0.05, cho.z, cho.h); traCamCho(); } else vaoCong(); };
$('b-toan').onclick = () => { luuCho(); di?.ra(); camera.position.set(-170, 90, 230); orbit.target.set(0, 25, 0); orbit.update(); apChoDung(); };
addEventListener('keydown', (e) => { if (e.code === 'Escape' && di?.dang && $('doc').style.display !== 'block') $('b-toan').click(); }); // đang mở bảng giới thiệu thì Esc chỉ đóng bảng
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
  const c = dangSo ? 'so' : di ? di.nguCanh() : 'toan', pv = di?.dang && noiThat ? di.viTri() : null, phong = pv ? noiThat.phongTai(pv.x, pv.y - 0.9, pv.z) : null;
  capNhatKhu(phong);
  const khoa = c + (phong?.so || ''); if (khoa === khoaHd) return; khoaHd = khoa;
  const xoay = dg('giữ chuột + kéo', 'xoay camera') + dg(K('Z', 'X'), 'xoay trái / phải') + dg(K('V'), 'góc nhìn sau lưng / mắt') + dg(K('Esc'), 'về toàn cảnh');
  $('hd').innerHTML = c === 'so' ? '' : c === 'toan' ? '<b>Toàn cảnh</b>' + dg('kéo chuột', 'xoay') + dg('chuột phải kéo · Shift + kéo', 'dời camera') + dg(K('W', 'A', 'S', 'D') + ' · mũi tên', 'dời camera (Shift: nhanh)') + dg('lăn chuột · Shift + lăn', 'phóng to / nhỏ') + dg('nhấp đúp', 'xuống đi bộ tại đó') + dg('🚶 Đi bộ', cho ? 'về chỗ đang đứng (ghim Bạn)' : 'vào ở cổng Torbau')
    : c === 'leo' ? '<b>Đang leo</b>' + dg(K('W', 'S'), 'lên / xuống') + dg(K('A', 'D'), 'ngang theo tường') + dg(K('W') + ' tới mép', 'tự đu lên') + dg(K('Space'), 'bật ra') + xoay
    : '<b>Đi bộ</b>' + dg(K('W', 'A', 'S', 'D'), 'đi theo hướng camera') + dg(K('Shift'), 'chạy') + dg(K('Space'), 'nhảy') + dg(K('C') + ' giữ', 'ngồi xổm')
      + (phong ? dg(K('E'), 'ngồi · mở rương · cầm đồ · bật đèn · đọc') + dg(K('F') + ' · nhấp', 'đá đồ · ném đồ đang cầm') : '')
      + (phong ? `<b>Ở đây</b><div class="d"><span>📍 ${phong.ten}</span><span>tầng ${phong.tang} · phỏng dựng theo mặt bằng</span></div>` : '')
      + (c === 'tuong' ? '<b>Ở đây</b>' + dg(K('Space'), 'tường thấp: trèo qua · cao: bám leo') : '') + xoay;
  $('hd').style.display = c === 'so' ? 'none' : '';
}
// bảng đầu trang = giới thiệu ngắn KHU đang đứng (trong phòng: gioiThieu của phòng; ngoài trời: du-lieu/neuschwanstein-khu.json theo khối OSM có tên)
const KHU = await (await fetch('./du-lieu/neuschwanstein-khu.json', { cache: 'no-cache' })).json().then((j) => j.khu).catch((e) => { console.warn('[ns] không nạp được giới thiệu khu', e); return {}; });
const DA_KHU = D.khoi.map((k) => ({ khoa: k.tags.building === 'courtyard' ? 'courtyard' : k.tags.name, v: k.ngoai[0] })).filter((k) => KHU[k.khoa] && k.v.length >= 3);
function khuTai(x, z) { // trong khối có tên → khối đó (khối nhỏ trước: tháp nằm trong Palas); sát cầu ≤ 6 m → cầu; sát khối ≤ 18 m (chỗ vào trước cổng cách Torbau 16,6 m) → khối gần nhất; còn lại → quanh lâu đài
  if (kcDoan(x, z, CAU[0], CAU[1]) < 6) return 'Marienbruecke';
  const trong = DA_KHU.filter((k) => trongDa(x, z, k.v)).sort((a, b) => Math.abs(dienTich(a.v)) - Math.abs(dienTich(b.v)))[0];
  if (trong) return trong.khoa;
  let tot = null, kc = 18; for (const k of DA_KHU) { const d = kcVien(x, z, k.v); if (d < kc) { kc = d; tot = k.khoa; } }
  return tot || 'chung';
}
let khoaKhu = '';
function capNhatKhu(phong) {
  const pv = di?.dang ? di.viTri() : null;
  const g = phong ? { ...(NT?.gioiThieu?.[phong.gioiThieu] || {}), ten: phong.ten } : pv ? KHU[khuTai(pv.x, pv.z)] : KHU.chung;
  const khoa = phong ? 'p' + phong.so : g?.ten || ''; if (khoa === khoaKhu) return; khoaKhu = khoa;
  $('khu-ten').textContent = g?.ten || 'dựng từ số đo thật'; $('khu-chu').textContent = g?.chu || '';
  $('khu-nguon').innerHTML = !g?.chu ? '' : g.nguon ? `Nguồn: <a href="${g.nguon}" target="_blank" rel="noopener">${new URL(g.nguon).hostname.replace(/^www\./, '')}</a>` : 'Theo mô hình phỏng dựng';
}
{ // thu nhỏ / mở bảng, nhớ theo trình duyệt
  const dau = $('dau'), dat = (thu) => { dau.classList.toggle('thu', thu); $('b-thu').textContent = thu ? '+' : '–'; };
  let v = null; try { v = localStorage.getItem('ns-dau-thu'); } catch {} dat(v == null ? innerWidth < 560 : v === '1'); // chưa chọn: màn hẹp thì thu sẵn
  $('b-thu').onclick = () => { const thu = !dau.classList.contains('thu'); dat(thu); try { localStorage.setItem('ns-dau-thu', thu ? '1' : '0'); } catch {} };
}
// BÁO LỆCH (nút 🔍, baolech.js) + CLI scripts/so-lech.mjs: chụp HAI bản ở cùng camera — mô hình dựng từ số đo và ảnh thật 3D (Google).
// datCam (CLI): { p: [x, y, z], d: [hướng nhìn], fov, zoom } → đặt camera xem toàn cảnh đúng góc đó. Bản ảnh thật: ép hiện lớp Google (epHien) để vòng vẽ
// tự cập nhật ô + bù độ cao, chờ ô tải đủ (loadProgress ≥ 0,999 năm nhịp liền) và ít nhất một lần bù độ cao (≥ 2,5 s), rồi trả lại như cũ.
async function chupHaiBan(datCam = null) {
  anNguoiChup = true; apChoDung(); aq.anGhim(true); // ảnh mô hình / ảnh thật không có nhân vật + ghim người chơi + ghim 📷
  try { return await chupHaiBanTrong(datCam); } finally { anNguoiChup = false; apChoDung(); aq.anGhim(false); }
}
async function chupHaiBanTrong(datCam) {
  if (datCam) { if (di?.dang) $('b-toan').click(); const [x, y, z] = datCam.p, [dx, dy, dz] = datCam.d, k = datCam.zoom || 20;
    camera.fov = datCam.fov || camera.fov; camera.updateProjectionMatrix(); orbit.target.set(x + dx * k, y + dy * k, z + dz * k); camera.position.set(x, y, z); camera.lookAt(orbit.target); orbit.update(); }
  camera.updateMatrixWorld(); const d = camera.getWorldDirection(new THREE.Vector3());
  const cam = { p: camera.position.toArray().map((v) => +v.toFixed(2)), d: d.toArray().map((v) => +v.toFixed(4)), fov: +camera.fov.toFixed(1), zoom: +(di?.dang ? 0 : camera.position.distanceTo(orbit.target)).toFixed(1),
    w: innerWidth, h: innerHeight, cheDo: di?.dang ? 'di_bo' : 'toan_canh' };
  const giuOSM = LOP_OSM.map((m) => m.visible), giuGoc = anh3d?.goc.visible;
  for (const m of LOP_OSM) m.visible = true; if (CACH3.bat) { for (const m of LOP_NHA) m.visible = false; } else if (CACH3.g) CACH3.g.visible = false; if (anh3d) anh3d.goc.visible = false; // đúng cách dựng đang chọn (nút 🧩)
  const moHinh = chupCanvas(renderer.domElement, () => renderer.render(scene, camera));
  LOP_OSM.forEach((m, i) => { m.visible = giuOSM[i]; }); if (anh3d) anh3d.goc.visible = giuGoc;
  let anhThat = null;
  // lớp ảnh thật tải nền: bấm 🔍 ngay sau khi mở trang thì chờ tới 20 s cho nó nạp xong
  for (const t0 = performance.now(); !anh3d && performance.now() - t0 < 20000;) await new Promise((ok) => setTimeout(ok, 200));
  if (anh3d) {
    anh3d.epHien = true; apDungAnh3d(); const t0 = performance.now();
    // chờ ô tải đủ: TỰ gọi t.update mỗi nhịp (vòng vẽ của trang có thể đang hãm 10 khung/s hoặc chưa kịp xin ô ở góc mới → loadProgress báo xong GIẢ,
    // ảnh thật chụp ra toàn trời — thẻ #1623), tối thiểu 4 s, rồi kiểm ảnh: còn > 92 % là nền trời thì chờ tiếp (tối đa 40 s)
    const troi = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 40; const g = c.getContext('2d'); renderer.render(scene, camera); g.drawImage(renderer.domElement, 0, 0, 64, 40);
      const d = g.getImageData(0, 0, 64, 40).data, b = scene.background?.isColor ? [scene.background.r * 255, scene.background.g * 255, scene.background.b * 255] : [d[0], d[1], d[2]]; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - b[0]) + Math.abs(d[i + 1] - b[1]) + Math.abs(d[i + 2] - b[2]) < 30) n++; return n / (d.length / 4); };
    for (let on = 0; performance.now() - t0 < 40000;) {
      camera.updateMatrixWorld(); anh3d.t.setCamera(camera); anh3d.t.setResolutionFromRenderer(camera, renderer); anh3d.t.update(); renderer.render(scene, camera);
      await new Promise((ok) => setTimeout(ok, 150)); on = (anh3d.t.loadProgress ?? 1) >= 0.999 ? on + 1 : 0;
      if (on >= 6 && performance.now() - t0 > 4000 && troi() < 0.92) break; }
    anhThat = chupCanvas(renderer.domElement, () => renderer.render(scene, camera));
    anh3d.epHien = false; anh3d.hien = null; apDungAnh3d();
  }
  return { moHinh, anhThat, cam };
}
// điểm ảnh (u, v: 0–1 từ góc trên trái) → điểm trúng trên MÔ HÌNH + mặt tường OSM gần nhất ("khối#cạnh") — CLI dò lỗi ra đúng mặt cần sửa
function diemTaiAnh(u, v) {
  // dò trên MÔ HÌNH dù đang bật lớp ảnh thật (lớp OSM bị ẩn → tia lọt qua tường trúng tận phía sau): tạm hiện, dò, trả lại
  const giu = LOP_OSM.map((m) => m.visible); for (const m of LOP_OSM) m.visible = true; camera.updateMatrixWorld();
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(u * 2 - 1, 1 - v * 2), camera);
  const h = rc.intersectObjects(LOP_OSM.filter((m) => m.isObject3D), true).find((x) => { for (let o = x.object; o; o = o.parent) if (o.visible === false) return false; return true; });
  LOP_OSM.forEach((m, i) => { m.visible = giu[i]; }); if (!h) return null;
  const { x, y, z } = h.point; let tot = null;
  for (const k of dsKhoi) { if (k.yTren != null && (y > k.yTren + 2 || y < (k.yDuoi ?? -1e9) - 2)) continue;
    k.v.forEach((p, i) => { const q = k.v[(i + 1) % k.v.length], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2)), dd = Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t);
      if (!tot || dd < tot.kc) tot = { mat: k.id + '#' + i, ten: k.tags.name || '', kc: +dd.toFixed(2) }; }); }
  return { diem: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], ...(tot && tot.kc < 4 ? tot : { mat: null }) };
}
// KHỐI TRONG VÙNG ẢNH (CLI tự xử báo lệch): các khối OSM có phần thân (đỉnh mặt bằng ở chân / giữa / đỉnh khối) chiếu vào hộp [u0, v0, u1, v1]
// của camera hiện tại và không bị khối khác che hẳn → [{ id, ten, phu }] (phu: tỉ lệ điểm mẫu rơi vào hộp)
function khoiTrongVung(hop) {
  camera.updateMatrixWorld(); const ra = [], v3 = new THREE.Vector3();
  for (const k of dsKhoi) { if (k.yTren == null || (k.vo && k.coPart) || Math.hypot(...tamDa(k.v)) > 130) continue; let n = 0, tr = 0;
    for (const [x, z] of [...k.v, tamDa(k.v)]) for (const y of [k.yDuoi ?? k.day, ((k.yDuoi ?? k.day) + k.yTren) / 2, k.yTren]) { if (!Number.isFinite(y)) continue; n++;
      v3.set(x, y, z).project(camera); const u = (v3.x + 1) / 2, v = (1 - v3.y) / 2; if (v3.z < 1 && hop.some(([u0, v0, u1, v1]) => u >= u0 && u <= u1 && v >= v0 && v <= v1)) tr++; }
    if (n && tr / n >= 0.25) ra.push({ id: k.id, ten: k.tags.name || '', phu: +(tr / n).toFixed(2) }); }
  return ra.sort((a, b) => b.phu - a.phu);
}
// ĐO ĐỈNH KHỐI trên ảnh 3D Google (đã khớp toạ độ cảnh) so với mô hình: lưới 0,75 m trong mặt bằng, bỏ dải 0,35 m sát mép; đỉnh = phân vị 98, thân tường =
// phân vị 60 các điểm sát mép (≤ 1,2 m). Chỉ chạy khi lớp ảnh thật đang hiện (ô đã tải) — trả null nếu ít điểm. Dùng chung với scripts/do-khoi-google.mjs.
function doKhoiAnh3d(id) {
  const k = dsKhoi.find((q) => q.id === id); if (!k || !anh3d) return null;
  const DICH = anh3d.goc.position.y || 0, cao = (x, z) => { const h = new THREE.Raycaster(new THREE.Vector3(x, 600, z), new THREE.Vector3(0, -1, 0)).intersectObject(anh3d.t.group, true)[0]; return h ? h.point.y - DICH : null; };
  const kc = (x, z) => { let m = 1e9; for (let i = 0; i < k.v.length; i++) { const [ax, az] = k.v[i], [bx, bz] = k.v[(i + 1) % k.v.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const xs = k.v.map((p) => p[0]), zs = k.v.map((p) => p[1]), tat = [], mep = [], pv = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.75) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.75) { if (!trongDa(x, z, k.v)) continue; const d = kc(x, z); if (d < 0.35) continue; const y = cao(x, z); if (y == null) continue; tat.push(y); if (d < 1.2) mep.push(y); }
  if (tat.length < 6) return null;
  return { id, ten: k.tags.name || '', so: tat.length, dinhAnh: +pv(tat, 0.98).toFixed(2), thanAnh: mep.length ? +pv(mep, 0.6).toFixed(2) : null, dinhMoHinh: +k.yTren.toFixed(2), thanMoHinh: +(k._y1 ?? k.yTren).toFixed(2),
    duoi: +((k.yDuoi ?? k.day) || 0).toFixed(2), h: so(k.tags.height), hMin: so(k.tags.min_height) ?? 0, mai: k.tags['roof:shape'] || 'flat', hMai: so(k.tags['roof:height']) };
}
// ĐO KHỐI THEO TIA từ camera đang đặt (góc người báo, thẻ #1623): đo từ trên xuống (doKhoiAnh3d) lẫn khối chồng trên mặt bằng (khối cổng đo ra 35 m vì đầu hồi đứng trên).
// Mỗi mặt tường quay về camera, 7 cột dọc mặt; mỗi cột quét từ trên xuống, bắn tia tới điểm sát trước mặt tường: trúng gần đúng khoảng (±2,5 m) = tường có ở độ cao đó → đỉnh cột;
// trúng gần hẳn trước khi gặp tường = cột bị che, bỏ. Đo CÙNG cột trên ảnh 3D và trên mô hình → lệch = thật − mô hình (cùng cách đo, tự triệt sai số cách đo).
// kho (tuỳ chọn): bộ nhớ đỉnh ẢNH THẬT theo cột "x,z" ở camera này — ảnh 3D không đổi khi sửa mô hình, nên lượt chấm sau chỉ bắn tia vào mô hình,
// không cần tải ảnh 3D (trọng tài 55 phút → vài phút). Cột chưa có trong kho mà không có ảnh 3D thì bỏ.
function doKhoiTheoTia(id, kho = null) {
  const k = dsKhoi.find((q) => q.id === id); if (!k || (!anh3d && !kho) || k.yTren == null) return null;
  camera.updateMatrixWorld(); const C = camera.position.clone(), DICH = anh3d?.goc.position.y || 0, rc = new THREE.Raycaster(), d3 = new THREE.Vector3(), SAI = 2.5;
  const giu = LOP_OSM.map((m) => m.visible); for (const m of LOP_OSM) m.visible = true;
  const anHien = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
  // tia mô hình chỉ bắn vào LỚP NHÀ (bỏ địa hình + rừng: hai lưới lớn nhất cảnh, chiếm gần hết thời gian chấm), danh sách lấy MỘT lần mỗi khối
  const NHA = [...LOP_NHA].filter((m) => m.isObject3D), trungMH = () => rc.intersectObjects(NHA, true).find((x) => anHien(x.object))?.distance ?? Infinity;
  const trungThat = () => rc.intersectObject(anh3d.t.group, true)[0]?.distance ?? Infinity;
  const y0 = Math.max(Number.isFinite(k.yDuoi) ? k.yDuoi : -1e9, k.yTren - 22), y1 = k.yTren + 14;
  // QUÉT THÔ 1,2 m rồi MỊN 0,3 m trong đoạn vừa đổi trạng thái (trước: mịn 0,3 m suốt ~150 bước / cột — trọng tài 55 phút)
  const trangThai = (px, pz, lop, dy, y) => { d3.set(px, y + dy, pz).sub(C); const dist = d3.length(); rc.set(C, d3.normalize()); rc.far = dist + 40;
    const h = lop === 'that' ? trungThat() : trungMH(); return Math.abs(h - dist) <= SAI ? 1 : h < dist - SAI ? -1 : 0; };
  const dinhCot = (px, pz, lop, dy, tu = y1) => {
    for (let y = tu; y >= y0; y -= 1.2) { if (!trangThai(px, pz, lop, dy, y)) continue;
      for (let m = Math.min(tu, y + 1.2); m >= y - 1e-6; m -= 0.3) { const t = trangThai(px, pz, lop, dy, m); if (t === 1) return m; if (t === -1) return null; }
      return null; }
    return null; };
  const cot = [];
  for (let i = 0; i < k.v.length; i++) { const [ax, az] = k.v[i], [bx, bz] = k.v[(i + 1) % k.v.length], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.2) continue;
    let nx = dz / L, nz = -dx / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (trongDa(mx + nx * 0.5, mz + nz * 0.5, k.v)) { nx = -nx; nz = -nz; }
    if ((C.x - mx) * nx + (C.z - mz) * nz <= 0) continue;
    const nCot = L < 1.5 ? 1 : 7; for (let j = 0; j < nCot; j++) { const t = nCot === 1 ? 0.5 : 0.12 + j * 0.76 / 6, px = ax + dx * t + nx * 0.3, pz = az + dz * t + nz * 0.3;
      const khoa = px.toFixed(1) + ',' + pz.toFixed(1); let th;
      if (kho && khoa in kho) th = kho[khoa]; else if (anh3d) { th = dinhCot(px, pz, 'that', DICH, k.yTren + 25); if (kho) kho[khoa] = th; } else continue;
      const mh = dinhCot(px, pz, 'mh', 0); if (mh != null && th != null) cot.push({ mh, th, canh: i }); } }
  LOP_OSM.forEach((m, i) => { m.visible = giu[i]; });
  const nhon0 = !['flat', ''].includes(k.tags['roof:shape'] || ''), duoiMai = k._y1 ?? (k.yTren - (so(k.tags['roof:height']) ?? 0));
  const tho = cot.length; cot.splice(0, cot.length, ...cot.filter((c) => nhon0 ? c.mh <= k.yTren + 1 && c.mh >= duoiMai - 1.5 : Math.abs(c.mh - k.yTren) <= 1.5));
  if (cot.length < 3) return { id, so: cot.length, tho };
  const pv = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const nhon = !['flat', ''].includes(k.tags['roof:shape'] || ''), p = nhon ? 0.9 : 0.5;
  // lệch = TRUNG VỊ hiệu từng cột (cùng chỗ trên mặt tường, thật − mô hình) — trước lấy p90 mỗi phía rồi trừ: mái dốc một cột trúng khối phía sau kéo lệch cả khối
  // (cánh Torbau #1624: mô hình cao thêm 2,6 m mà lệch nhảy 0,4 → 7,4 m). dinhAnh / dinhMoHinhTia chỉ để xem.
  const th = pv(cot.map((c) => c.th), p), mh = pv(cot.map((c) => c.mh), p);
  return { id, ten: k.tags.name || '', so: cot.length, canh: [...new Set(cot.map((c) => c.canh))], dinhAnh: +th.toFixed(2), dinhMoHinhTia: +mh.toFixed(2), lech: +pv(cot.map((c) => c.th - c.mh), 0.5).toFixed(2), dinhMoHinh: +k.yTren.toFixed(2),
    trai: +(pv(cot.map((c) => c.th - c.mh), 0.85) - pv(cot.map((c) => c.th - c.mh), 0.15)).toFixed(2), yDuoi: Number.isFinite(k.yDuoi) ? +k.yDuoi.toFixed(2) : null, mai: k.tags['roof:shape'] || 'flat' };
}
// ép hiện ảnh thật ở camera hiện tại, chờ ô tải (CLI đo khối trên ảnh 3D ở đúng góc người báo)
const batAnh3dTam = async (bat) => { if (!anh3d) return false; anh3d.epHien = bat; anh3d.hien = null; apDungAnh3d(); if (!bat) return true; const t0 = performance.now();
  for (let on = 0; performance.now() - t0 < 30000 && on < 6;) { camera.updateMatrixWorld(); anh3d.t.setCamera(camera); anh3d.t.setResolutionFromRenderer(camera, renderer); anh3d.t.update(); renderer.render(scene, camera); await new Promise((ok) => setTimeout(ok, 150)); on = (anh3d.t.loadProgress ?? 1) >= 0.999 && performance.now() - t0 > 4000 ? on + 1 : 0; }
  return true; };
ganBaoLech({ nut: $('b-lech'), chupHai: (cam) => chupHaiBan(cam), them: () => ' ' + viTriThat() + aq.nguCanh(600), anhNgoai: () => aq.daChonAnh() }); // cam: mở lại đúng góc một báo cáo cũ
// góp ý: hộp gopy.js, kèm ảnh khung hình + ngữ cảnh chỗ đứng
// ĐIỂM GIỮA MÀN: tia từ camera qua tâm màn trúng mô hình (bỏ lớp đang ẩn); trúng trời → chỗ đang đứng / tâm toàn cảnh. Dùng cho 📷 và ngữ cảnh góp ý.
const raLatLngNS = (x, z) => [D.tam[0] - z / 111320, D.tam[1] + x / (111320 * Math.cos(D.tam[0] * Math.PI / 180))];
const laBan = (vx, vz) => ((Math.atan2(vx, -vz) * 180) / Math.PI + 360) % 360; // hướng la bàn của véc-tơ cảnh (x đông, −z bắc)
function diemGiuaMan() {
  const tia = new THREE.Raycaster(); tia.setFromCamera(new THREE.Vector2(0, 0), camera);
  const h = tia.intersectObjects(scene.children.filter((o) => o.isMesh && o.visible && !o.isInstancedMesh), false)[0];
  const p = h ? h.point : di?.dang ? (({ x, y, z }) => ({ x, y: y - 0.9, z }))(di.viTri()) : orbit.target.clone();
  const d = camera.getWorldDirection(new THREE.Vector3()); // hướng la bàn camera đang nhìn — 📷 lọc ảnh chụp cùng hướng
  const c = di?.dang ? di.viTri() : camera.position; // khu chỗ đang đứng (trong sân / ngoài thành) → chọn danh mục ảnh Commons đúng phía
  return { x: p.x, y: p.y, z: p.z, ten: khuTai(p.x, p.z) || 'điểm đang nhìn', khuCam: khuTai(c.x, c.z), huong: laBan(d.x, d.z) };
}
// VỊ TRÍ THẬT kèm mọi thẻ góp ý / báo lệch (anh 17/11/2026: "góp ý chưa gửi kèm vị trí, toạ độ thực của nhân vật"): nhân vật (vĩ độ, kinh độ, cao trên đất,
// mặt quay hướng nào) + camera (vĩ độ, kinh độ, cao trên đất, hướng nhìn, ngẩng) + điểm giữa màn (vĩ độ, kinh độ, khu) — cả khi đang xem toàn cảnh
function viTriThat() {
  const ll = (x, z) => raLatLngNS(x, z).map((v) => v.toFixed(6)).join(','), HN = ['bắc', 'đông bắc', 'đông', 'đông nam', 'nam', 'tây nam', 'tây', 'tây bắc'];
  const cay = new Set(CAY_VA.map((k) => k.handle));
  // cao trên MẶT ĐỨNG THẬT ngay dưới (tia xuống qua va chạm: sân lát, mái, cầu — lưới đất vùng ở sân trong thấp hơn mặt lát ~7 m), bỏ cây
  const trenDat = (x, y, z) => { const t = world.castRay(new RAPIER.Ray({ x, y: y + 0.3, z }, { x: 0, y: -1, z: 0 }), 500, true, undefined, undefined, undefined, undefined, (k) => !cay.has(k.handle));
    return (t ? Math.max(0, t.timeOfImpact - 0.3) : y - matDat(x, z)).toFixed(1); };
  const hn = (h) => `${HN[Math.round(h / 45) % 8]} ${Math.round(h)}°`;
  const ds = [], g = diemGiuaMan(), d = camera.getWorldDirection(new THREE.Vector3()), c = camera.position;
  if (di?.dang && toi) { const p = toi.goc.position, h = toi.goc.rotation.y; ds.push(`nhân vật ${ll(p.x, p.z)} cao ${trenDat(p.x, p.y, p.z)} m trên đất, mặt hướng ${hn(laBan(Math.sin(h), Math.cos(h)))}`); }
  else if (cho) ds.push(`nhân vật (đã rời đi bộ) ${ll(cho.x, cho.z)}`);
  ds.push(`camera ${ll(c.x, c.z)} cao ${trenDat(c.x, c.y, c.z)} m nhìn ${hn(laBan(d.x, d.z))} ngẩng ${Math.round((Math.asin(d.y) * 180) / Math.PI)}°`);
  ds.push(`điểm giữa màn ${ll(g.x, g.z)} (${g.ten})`);
  return 'VỊ TRÍ: ' + ds.join(' · ');
}
const hopGopY = ganGopY({ nut: $('b-gy'), tieuDe: 'Góp ý cho Neuschwanstein', anhNgoai: () => aq.daChonAnh(), chupAnh: () => chupCanvas(renderer.domElement, () => renderer.render(scene, camera)), nguCanh: () => {
  const p = di?.dang ? di.viTri() : null, ph = p && noiThat ? noiThat.phongTai(p.x, p.y - 0.9, p.z) : null;
  const vt = viTriThat(), nen = `Neuschwanstein · ${p ? `đi bộ, mô hình x ${p.x.toFixed(1)} y ${p.y.toFixed(1)} z ${p.z.toFixed(1)} · khu ${ph ? ph.ten : khuTai(p.x, p.z)}` : dangSo ? 'so ảnh thật' : 'toàn cảnh'} · ${innerWidth}×${innerHeight}`;
  return [vt, nen, (aq?.nguCanh(400 - vt.length - nen.length - 8) || '').trim()].filter(Boolean).join(' · '); // hòm chuẩn cắt ngữ cảnh trang ở 400 ký tự: vị trí trước, mã ảnh thật lấy phần còn lại (ảnh vẫn đính đủ)
} });
// 📷 ẢNH THẬT QUANH ĐÂY (anhquanh.js): điểm = chỗ tia giữa màn trúng mô hình (bỏ lớp đang ẩn); trúng trời → chỗ đang đứng / tâm toàn cảnh
$('nut').insertAdjacentHTML('beforeend', '<button id="b-aq" title="Tìm ảnh thật trên mạng (Wikimedia Commons, Mapillary) quanh chỗ đang nhìn giữa màn — chọn ảnh rồi gửi kèm góp ý để sửa theo">📷</button>');
// THẤY ĐƯỢC ĐIỂM KHÔNG (anh 17/11/2026, đứng sân trên bấm 📷 ra toàn ảnh chụp ngoài đường dưới chân thành, cùng hướng nhưng bị tường che): tia từ chỗ chụp
// (mặt đứng + 1,6 m) tới điểm đang nhìn qua va chạm của mô hình (bỏ cây); chạm khối nhà trước điểm > 2,5 m = bị che → ảnh xuống nhóm khác
function thayDiem(lat, lng, d) {
  const [x, z] = raMet(lat, lng), cay = new Set(CAY_VA.map((c) => c.handle)), khongCay = (c) => !cay.has(c.handle);
  const h0 = world.castRay(new RAPIER.Ray({ x, y: 900, z }, { x: 0, y: -1, z: 0 }), 3000, true, undefined, undefined, undefined, undefined, khongCay);
  if (!h0) return null;
  const mat = { x, y: 900 - h0.timeOfImpact + 1.6, z }, v = { x: d.x - mat.x, y: d.y - mat.y, z: d.z - mat.z }, L = Math.hypot(v.x, v.y, v.z);
  if (L < 3) return true;
  const h = world.castRay(new RAPIER.Ray(mat, { x: v.x / L, y: v.y / L, z: v.z / L }), L, true, undefined, undefined, undefined, undefined, khongCay);
  return !h || h.timeOfImpact >= L - 2.5;
}
const aq = ganAnhQuanh({ THREE, scene, nut: $('b-aq'), moGopY: () => hopGopY.mo(), thay: thayDiem,
  raLatLng: raLatLngNS,
  layDiem: diemGiuaMan });
// VẬT Ở XA: ô rừng gần (3D đầy đủ) xa hơn 560 m tắt khi đi bộ — phía ngoài là cảnh xa (canhxa.js: rừng vòng giữa một lệnh vẽ + ảnh trực giao trên địa hình tới 10 km), nên sương chỉ còn là
// hơi núi (đi bộ 1,5 → 14 km, toàn cảnh 2,5 → 18 km) và camera vẽ tới chân trời; trước đây sương 180–520 m + tầm 600 m che hết núi (anh 21/11/2026, bước 2)
let lucXa = 0;
function anCayXa(now) {
  if (now - lucXa < 250) return; lucXa = now;
  const dang = !!di?.dang, c = camera.position, xa = dang ? 560 : Math.max(900, c.length() * 2.2);
  const fog = scene.fog, near = dang ? 1500 : 2500, far = dang ? 14000 : 18000; if (fog.near !== near) { fog.near = near; fog.far = far; }
  const cf = dang ? 16000 : 25000; if (camera.far !== cf) { camera.far = cf; camera.updateProjectionMatrix(); }
  for (const o of RUNG_O) o.visible = o.userData.tam.distanceTo(c) < xa;
  batCayGan();
}
// bật va chạm đúng các cây trong 60 m quanh người đi bộ (ảnh thật 3D đang hiện thì tắt hết — cây thật trong ảnh mọc chỗ khác); chỉ gọi Rapier khi trạng thái đổi
const CAY_BAT = [];
function batCayGan() {
  const p = di?.dang && !LOP_OSM.dangAn ? di.viTri() : null;
  for (let i = 0; i < CAY_VA.length; i++) {
    const bat = !!p && Math.abs(CAY_XZ[2 * i] - p.x) < 60 && Math.abs(CAY_XZ[2 * i + 1] - p.z) < 60;
    if (CAY_BAT[i] !== bat) { CAY_BAT[i] = bat; CAY_VA[i].setEnabled(bat); }
  }
}
let lan = 0, tichLuy = 0, lucCham = 0;
// TOUCHPAD HAI NGÓN (anh 16/11/2026): vuốt hai ngón = XOAY như giữ chuột trái kéo; chụm / mở hai ngón (trình duyệt gửi wheel + ctrlKey) = phóng;
// lăn chuột thật (bánh xe: bước nguyên, không có trục ngang) vẫn phóng. Bắt ở pha capture trên khung vẽ, trước OrbitControls.
// SHIFT + LĂN = luôn phóng (thẻ #1626 / #1627, anh 16/11/2026): Magic Mouse / chuột có gia tốc trên Mac gửi deltaY lẻ → bị nhận là touchpad nên chỉ xoay, PC không phóng được; giữ Shift macOS đổi lăn dọc thành deltaX → lấy deltaY || deltaX.
const laTouchpad = (e) => !e.ctrlKey && e.deltaMode === 0 && (e.deltaX !== 0 || !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 40);
renderer.domElement.addEventListener('wheel', (e) => {
  if (e.shiftKey && !dangSo) { e.preventDefault(); e.stopImmediatePropagation(); const d = e.deltaY || e.deltaX;
    if (di?.dang) { di.phong(d * 0.0015); return; }
    const off = camera.position.clone().sub(orbit.target), kc = Math.max(orbit.minDistance, Math.min(orbit.maxDistance, off.length() * Math.exp(d * 0.0015)));
    camera.position.copy(orbit.target).add(off.setLength(kc)); orbit.update(); return; }
  if (di?.dang && !dangSo && !laTouchpad(e)) { e.preventDefault(); e.stopImmediatePropagation(); di.phong(e.deltaY * (e.ctrlKey ? 0.02 : 0.0015)); return; } // đi bộ: chụm / mở hai ngón (ctrl + wheel) hoặc lăn chuột = kéo camera gần / xa
  if (!laTouchpad(e) || dangSo) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (di?.dang) { di.yaw -= e.deltaX * 0.004; di.pitch = Math.max(-1.4, Math.min(1.4, di.pitch - e.deltaY * 0.004)); di.lucChuot = performance.now(); return; }
  const off = camera.position.clone().sub(orbit.target), sp = new THREE.Spherical().setFromVector3(off);
  sp.theta -= e.deltaX * 0.004; sp.phi = Math.max(0.05, Math.min(orbit.maxPolarAngle, sp.phi - e.deltaY * 0.004));
  camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(sp)); camera.lookAt(orbit.target); orbit.update();
}, { capture: true, passive: false });
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'touchmove']) addEventListener(ev, () => { lucCham = performance.now(); }, { passive: true }); // có thao tác → vẽ đủ nhịp
const dongHo = new THREE.Clock();
function ve(now = 0) { // chạy ở cuối tệp (sau khi khai báo chế độ so ảnh)
  requestAnimationFrame(ve);
  // BẢN TRANG ĐANG ẨN KHÔNG CHẠY (anh 17/11/2026 "máy tính mở page nặng quá"): khung cách 3 dựng sẵn — hoặc trang chính khi khung đang phủ — trước vẫn
  // vẽ + chạy vật lý + tải ảnh 3D ở 10 khung/s → hai bản trang cùng ngốn máy. Ẩn thì dừng hẳn, chỉ nuốt đồng hồ để lúc hiện lại không nhảy cóc.
  if (trangDangAn()) { dongHo.getDelta(); return; }
  luuGoc(); if (di?.dang && now - lucCho > 1000) { lucCho = now; luuCho(); }
  // điện thoại: xem toàn cảnh xa > 140 m → khung cửa bản xa (mattien.js userData.lod); đi bộ / lại gần → đủ chi tiết
  if (CHAM && LOD_MT.xa.children.length) { const xa = !di?.dang && camera.position.distanceTo(orbit.target) > 140; if (xa !== LOD_MT.dangXa) { LOD_MT.dangXa = xa; for (const m of LOD_MT.gan.children) m.visible = !xa; for (const m of LOD_MT.xa.children) m.visible = xa; } }
  // trần khung hình: đi bộ 60 (điện thoại 30) · xem toàn cảnh 30, không chạm gì quá 2,5 s thì 10 · mất tiêu điểm 10 — bớt vẽ thừa là bớt nóng máy
  const nghi = !di?.dang && now - lucCham > 2500;
  if (now - lan < (!document.hasFocus() || nghi ? 100 : di?.dang ? (CHAM ? 1000 / 30 : 1000 / 60) : 1000 / 30) - 3) return; lan = now;
  const dt = Math.min(dongHo.getDelta(), 0.1);
  if (di?.dang) { tichLuy += dt; while (tichLuy >= 1 / 60) { di.buoc(1 / 60); world.step(); tichLuy -= 1 / 60; } di.khung(dt); }
  else if (!dangSo) { doiToanCanh(dt); orbit.update(); } // chế độ so ảnh: camera do thông số ảnh quyết
  if (!di?.dang) apChoDung(dt); // toàn cảnh: nhân vật đứng thở ở chỗ đã rời + ghim "Bạn"
  if (noiThat) { const p = di?.dang ? di.viTri() : null; noiThat.hien(!!p && Math.hypot(p.x - noiThat.tam[0], p.z - noiThat.tam[1]) < 75); }
  noiThat?.capNhat(dt); timTuongTac(now); camUng?.capNhat(); anCayXa(now); nhieuNguoi?.capNhat(dt); capNhatAnh3d();
  capNhatHd(now); veBanDoNS(now);
  renderer.render(scene, camera);
}
// ---------- SO VỚI ẢNH THẬT (bước 3): camera đặt đúng chỗ người chụp đứng (toạ độ Commons), ảnh chồng mờ lên khung hình cùng tỉ lệ.
// Tinh chỉnh: ← → quay · ↑ ↓ ngẩng / cúi · [ ] góc ống kính · PgUp/PgDn cao thấp (Shift = nhanh). Thông số khớp ghi vào du-lieu/<ten>-anh.json (camera).
const ANH = await fetch(`./du-lieu/${ten}-anh.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
const M_LAT = 111320, M_LNG = 111320 * Math.cos(D.tam[0] * Math.PI / 180);
const raMet = (la, ln) => [(ln - D.tam[1]) * M_LNG, -(la - D.tam[0]) * M_LAT];
// ẢNH CHỤP CHIẾU LÊN MÁI + THÁP (chieuanh.js): ảnh so khớp camera tốt nhất (ghi chú khớp tự động, lệch viền ≤ 10 px) → cửa mái, ống khói, chóp, hoa văn trên mái
// hiện đúng chỗ như ảnh. Chỉ tô chỗ ảnh nhìn thấy; tải nền sau khi cảnh dựng xong
(async () => {
  // mọi ảnh khớp camera tốt (lệch viền ≤ 10 px) đều chiếu; ảnh chụp GẦN hơn vẽ sau (đè) ở chỗ cùng thấy — nét hơn
  if (!DAN_ANH) return;
  const ds = ANH.map((a, i) => ({ a, i, lech: +(/lệch viền ([\d.]+) px/.exec(a.camera?.ghi_chu || '')?.[1] ?? 999) })).filter((x) => x.a.camera && x.lech <= 10)
    .map((x) => { const [px, pz] = raMet(x.a.lat, x.a.lng); return { ...x, px, pz, xa: Math.hypot(px + 30, pz - 15) }; }).sort((p, q) => q.xa - p.xa);
  const nha = LOP_OSM.filter((m) => m.isMesh && m.userData.nha); if (!ds.length || !nha.length) return;
  for (const [k, x] of ds.entries()) {
    const c = x.a.camera, quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.pitch, c.yaw, 0, 'YXZ'));
    try {
      const phu = await taoChieuAnh({ THREE, renderer, anh: { url: `./du-lieu/${x.a.tep}`, w: x.a.rong, h: x.a.cao }, cam: { pos: new THREE.Vector3(x.px, c.y, x.pz), quat, fov: c.fov }, che: nha, nhan: nha, thu: k });
      for (const p of phu) { p.visible = !LOP_OSM.dangAn; scene.add(p); LOP_OSM.push(p); }
      console.info('[ns] chiếu ảnh', x.a.tieuDe, `(cách ${x.xa.toFixed(0)} m, lệch ${x.lech} px) lên`, phu.length, 'lưới nhà');
    } catch (e) { console.warn('[ns] chiếu ảnh lỗi', x.a.tieuDe, e); }
  }
})();
let dangSo = null, cam = null;
const hop = $('so-khung'), img = $('so-anh');
function khungAnh(a) { // khung lớn nhất cùng tỉ lệ ảnh, giữa màn
  const r = a.rong / a.cao; let w = innerWidth, h = w / r; if (h > innerHeight) { h = innerHeight; w = h * r; }
  return { w: Math.round(w), h: Math.round(h), x: Math.round((innerWidth - w) / 2), y: Math.round((innerHeight - h) / 2) };
}
function datCamSo() {
  const [x, z] = raMet(dangSo.lat, dangSo.lng);
  camera.position.set(x, cam.y, z); camera.fov = cam.fov; camera.rotation.set(cam.pitch, cam.yaw, cam.roll || 0, 'YXZ'); camera.updateProjectionMatrix(); // roll: camera giải bằng PnP (scripts/khop-lg.py) có nghiêng máy
  $('so-tt').textContent = `cao ${(cam.y + GOC_Y).toFixed(0)} m (so mặt biển) · quay ${(cam.yaw * 180 / Math.PI).toFixed(1)}° · ngẩng ${(cam.pitch * 180 / Math.PI).toFixed(1)}° · ống kính ${cam.fov.toFixed(1)}°`;
}
function moSo(i) {
  if ($('so-than')) $('so-than').style.display = 'block'; // đang so ảnh: bảng mở (có nút Tắt, thanh độ mờ)
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
  dangSo = null; for (const r of RUNG) r.visible = !anh3d?.hien; hop.style.display = 'none'; renderer.setSize(innerWidth, innerHeight); Object.assign(renderer.domElement.style, { left: '0px', top: '0px' });
  camera.aspect = innerWidth / innerHeight; camera.fov = 45; camera.updateProjectionMatrix(); orbit.enabled = true; camera.position.set(-170, 90, 230); orbit.target.set(0, 25, 0); orbit.update();
  $('so-tt').textContent = ''; $('so-nguon').textContent = ''; document.querySelectorAll('#so button[data-i]').forEach((b) => b.classList.remove('chon'));
}
if (ANH.length) {
  $('so').style.display = 'block';
  $('so-ds').innerHTML = '<button id="so-tat">✕ Tắt</button>' + ANH.map((a, i) => (a.khongDung ? '' : `<button data-i="${i}" title="${a.tieuDe}">📷 ${a.nhan || i + 1}</button>`)).join(''); // Tắt đứng ĐẦU (bảng cuộn trên điện thoại: cuối danh sách bị khuất); bỏ ảnh đã soát là không dùng được // nút ghi tên góc chụp (trước chỉ ghi số, không biết nút nào là góc nào)
  $('so-ds').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.id === 'so-tat' ? tatSo() : moSo(+b.dataset.i); });
  // bảng thu gọn mặc định (nhiều ảnh → bảng to che cảnh), bấm tiêu đề để mở / đóng; đang so ảnh thì luôn mở
  const moBang = (b) => { $('so-than').style.display = b ? 'block' : 'none'; $('so-mo-dong').textContent = `📷 So với ảnh thật ${b ? '▾' : '▸'}`; };
  $('so-mo-dong').addEventListener('click', () => moBang($('so-than').style.display === 'none'));
  $('so-ds').addEventListener('click', () => moBang(true));
  $('so-mo').addEventListener('input', (e) => { img.style.opacity = e.target.value / 100; });
  addEventListener('keydown', (e) => {
    if (!dangSo) return;
    if (e.code === 'Escape') { tatSo(); e.preventDefault(); return; } // Esc thoát so ảnh
    const k = e.shiftKey ? 10 : 1, d = Math.PI / 1800 * k;
    const m = { ArrowLeft: () => (cam.yaw += d), ArrowRight: () => (cam.yaw -= d), ArrowUp: () => (cam.pitch += d), ArrowDown: () => (cam.pitch -= d), BracketLeft: () => (cam.fov = Math.max(5, cam.fov - 0.1 * k)), BracketRight: () => (cam.fov = Math.min(90, cam.fov + 0.1 * k)), PageUp: () => (cam.y += 0.5 * k), PageDown: () => (cam.y -= 0.5 * k) }[e.code];
    if (m) { m(); datCamSo(); e.preventDefault(); }
  });
  const i = new URLSearchParams(location.search).get('anh'); if (i) moSo(+i - 1);
}
addEventListener('resize', () => { if (dangSo) moSo(ANH.indexOf(dangSo)); });

window.__ns = { D, dsKhoi, camera, orbit, caoDat, GOC_Y, scene, renderer, world, RAPIER, di: () => di, toi: () => toi, vaoCong, ANH, moSo, tatSo, cam: () => cam, datCam: (c) => { Object.assign(cam, c); datCamSo(); } };
// ---------- cầu Marienbrücke (toạ độ hai đầu từ OpenStreetMap way "Marienbrücke"): sàn + lan can, đứng ngắm lâu đài như ảnh thật
const CAU = [[47.554991, 10.7492138], [47.5549237, 10.7495946]].map(([la, ln]) => raMet(la, ln));
{
  const [[x1, z1], [x2, z2]] = CAU, L = Math.hypot(x2 - x1, z2 - z1) + 6, a = Math.atan2(z2 - z1, x2 - x1);
  const y = Math.max(caoDat(x1, z1), caoDat(x2, z2)) - GOC_Y, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
  const vl = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.7, metalness: 0.4 });
  for (const [w, h, d, oy, oz] of [[L, 0.3, 2.6, 0, 0], [L, 1.1, 0.08, 0.7, 1.25], [L, 1.1, 0.08, 0.7, -1.25]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), vl); m.position.set(cx - Math.sin(a) * oz, y + oy, cz + Math.cos(a) * oz); m.quaternion.copy(q); m.castShadow = true; scene.add(m); LOP_OSM.push(m);
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(m.position.x, m.position.y, m.position.z).setRotation(q), tinh);
  }
}
// ---------- BẢN ĐỒ + DI CHUYỂN NHANH (bando.js dùng chung): khối nhà OSM, rừng, cầu; bấm vào đâu là tới đó
function diNhanhNS(x, z, yTang) {
  if (!di) return false; if (dangSo) tatSo(); boTuongTac();
  if (yTang != null) { yTang = chanAnToan(x, z, yTang); const h = di.dang ? di.huong : 0; if (!di.dang) di.vao(x, yTang + 0.05, z, h); else di.datCho({ x, y: yTang + 1.0, z }, h - Math.PI, -0.1, h); return true; } // vào thẳng trong nhà
  const doY = (xx, zz) => { const h = world.castRay(new RAPIER.Ray({ x: xx, y: 900, z: zz }, { x: 0, y: -1, z: 0 }), 3000, true); return h ? 900 - h.timeOfImpact : null; };
  let tot = null; // trúng mái nhà thì dò vòng quanh tới 14 m tìm mặt đất / mặt cầu
  for (let r = 0; r <= 14 && !tot; r += 1) for (let a = 0; a < Math.PI * 2 && !tot; a += r ? 0.6 / r + 0.2 : 7) {
    const xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r, y = doY(xx, zz); if (y != null && y < matDat(xx, zz) + 2.5) tot = [xx, y, zz];
  }
  if (!tot) return false;
  const h = Math.atan2(-tot[0], -tot[2]); // quay mặt về lâu đài
  if (!di.dang) di.vao(tot[0], tot[1] + 0.1, tot[2], h); else di.datCho({ x: tot[0], y: tot[1] + 1.0, z: tot[2] }, h - Math.PI, -0.1, h);
  return true;
}
const sanTrong = D.khoi.find((k) => k.tags.building === 'courtyard');
const tamSan = sanTrong ? tamDa(sanTrong.ngoai[0]) : [0, 0];
const banDoNS = taoBanDo($('bd'), {
  phamVi: [110, 320], tam: [0, 60], khiChon: diNhanhNS,
  diem: [['🚪 Cổng Torbau', (torbau ? Math.max(...torbau.v.map((p) => p[0])) : 30) + 10, torbau ? tamDa(torbau.v)[1] : 0], ['🏰 Sân trong', tamSan[0], tamSan[1]], ['🌉 Cầu Marienbrücke', (CAU[0][0] + CAU[1][0]) / 2, (CAU[0][1] + CAU[1][1]) / 2], ...(NOI ? [['🚪 Lối vào Palas', NOI.ngoai[0], NOI.ngoai[1]]] : []), ...(noiThat ? noiThat.diem : [])],
  veNen(g, S, p, k) {
    g.fillStyle = '#3f5a33'; g.fillRect(0, 0, S, S);
    for (const kk of dsKhoi) { if (kk.vo && kk.coPart) continue; g.fillStyle = kk.tags.name === 'Torbau' ? '#b5523a' : '#d8d0c0'; g.beginPath(); kk.v.forEach(([x, z], i) => { const [a, b] = p(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill(); }
    g.strokeStyle = '#8a8f96'; g.lineWidth = Math.max(2, 2.6 * k); g.beginPath(); g.moveTo(...p(...CAU[0])); g.lineTo(...p(...CAU[1])); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.max(11, 6 * k)}px system-ui, sans-serif`;
    g.fillText('🌉', ...p((CAU[0][0] + CAU[1][0]) / 2, (CAU[0][1] + CAU[1][1]) / 2 + 12));
  },
});
let lucBd = 0;
function veBanDoNS(now) {
  if (now - lucBd < 120) return; lucBd = now;
  const p = di?.dang ? di.viTri() : { x: orbit.target.x, z: orbit.target.z };
  banDoNS.ve(p, di?.dang ? di.huong : Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z) + Math.PI, []);
}
// ---------- TƯƠNG TÁC đồ trong phòng (E): ngồi ghế · mở / đóng rương · cầm / thả (nhấp chuột = ném, F = đá) · bật / tắt đèn · đọc giới thiệu phòng
let dangNgoi = null, dangCam = null, ganNhat = null, lucTim = 0;
function buocNgoi(tr) { if (!dangNgoi) return false; if (tr.fx || tr.fz) dungDay(); return !!dangNgoi; } // đi một bước là đứng dậy
function khungNgoi() { if (!dangNgoi) return null; const y = dangNgoi.cao - toi.chau('cuoi'); return { x: dangNgoi.o.position.x, y, z: dangNgoi.o.position.z, huong: dangNgoi.huong, tuThe: 'cuoi', chanCam: dangNgoi.cao - 0.2, kcMax: 3 }; }
function dungDay(datLai = true) { const t = dangNgoi; dangNgoi = null; if (!t || !datLai) return; const h = t.huong, p = t.o.position; di.datCho({ x: p.x + Math.sin(h) * 0.7, y: t.cao - 0.48 + 1.0, z: p.z + Math.cos(h) * 0.7 }); }
function boTuongTac() { dungDay(false); thaDo(); dongDoc(); } // dịch chuyển nhanh / rời đi bộ: thôi ngồi (không đặt lại chỗ), thả đồ đang cầm, đóng bảng
function camLen(t) { // gắn đồ vào tay phải, tắt thân vật lý
  const v = t.vat; if (!v) return;
  v.cam = true; v.b.setEnabled(false); v.coGoc = v.goc.scale.x; v.goc.position.set(0, 0, 0); v.goc.quaternion.identity(); toi.cam(v.goc); dangCam = v;
}
function thaDo(nem = null) {
  const v = dangCam; if (!v) return; dangCam = null;
  noiThat.nhom.attach(v.goc); v.goc.scale.setScalar(v.coGoc); v.cam = false;
  const p = v.goc.getWorldPosition(new THREE.Vector3()); v.b.setTranslation({ x: p.x, y: p.y, z: p.z }, true); v.b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); v.b.setEnabled(true);
  v.b.setLinvel(nem ? { x: nem.x * 9, y: nem.y * 9 + 2.2, z: nem.z * 9 } : { x: 0, y: 0, z: 0 }, true); v.b.setAngvel(nem ? { x: 3, y: 1, z: 2 } : { x: 0, y: 0, z: 0 }, true);
}
function nemDoDangCam(x, y) { if (!dangCam) return; const d = new THREE.Vector3(); const r = renderer.domElement.getBoundingClientRect(); const tia = new THREE.Raycaster(); tia.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), camera); d.copy(tia.ray.direction); toi.lam('nem'); setTimeout(() => thaDo(d), 300); }
function daDo() { // F: đá đồ vật lý trước mặt
  if (!noiThat || !di?.dang || dangNgoi) return; toi.lam('da');
  const p = di.viTri(), h = di.huong, f = { x: Math.sin(h), z: Math.cos(h) };
  setTimeout(() => { for (const v of noiThat.dongVat) { if (v.cam) continue; const t = v.b.translation(), dx = t.x - (p.x + f.x * 0.8), dz = t.z - (p.z + f.z * 0.8); if (Math.hypot(dx, dz) < 1.0 && Math.abs(t.y - (p.y - 0.6)) < 1.2) { const m = v.b.mass(); v.b.applyImpulse({ x: f.x * 5 * m, y: 2.5 * m, z: f.z * 5 * m }, true); } } }, 260);
}
function moDoc(phong) {
  const g = NT.gioiThieu?.[phong.gioiThieu]; // mỗi phòng trong JSON trỏ khoá giới thiệu của nó
  if (!g) { console.warn('[ns] phòng thiếu giới thiệu', phong.ten, phong.gioiThieu); return; } const el = $('doc'); el.querySelector('b').textContent = g.ten; el.querySelector('.chu').textContent = g.chu; el.querySelector('a').href = g.nguon; el.style.display = 'block';
}
function dongDoc() { $('doc').style.display = 'none'; } // khai báo hàm (được nâng): boTuongTac gọi được cả khi khôi phục chỗ đứng lúc F5
// ---- CỬA SỔ khi đang leo tường: sát một ô cửa mà phía sau có sàn nội thất (Palas tầng ba / phòng tầng bốn) → E mở hai cánh vào trong rồi trèo vào đứng trên sàn
let ganCua = null;
function sanSauCua(c) { // điểm đứng trong phòng sau cửa: 1,1 m vào trong, tia dọc xuống tìm sàn ngay dưới bậu; không có phòng → null
  if (!noiThat || !NOI || !c.coLo) return null; // chỉ ô có lỗ thật trên tường (loCanh) mới mở được
  const x = c.x - c.nx * 1.1, z = c.z - c.nz * 1.1; if (!trongDa(x, z, NOI.palas.v)) return null;
  const h = world.castRay(new RAPIER.Ray({ x, y: c.y + 1.2, z }, { x: 0, y: -1, z: 0 }), 4, true); if (!h) return null;
  const y = c.y + 1.2 - h.timeOfImpact; return y >= NOI.dai[0] - 0.5 && y <= c.y + 0.4 ? { x, y, z } : null;
}
function timCua() {
  if (!di?.dang || di.tt !== 'leo') return null;
  const p = di.viTri(); let tot = null, diem = 1e9;
  for (const c of CUA) {
    const dx = p.x - c.x, dz = p.z - c.z, truoc = dx * c.nx + dz * c.nz, doc = dx * -c.nz + dz * c.nx; // trước mặt tường / dọc tường
    if (truoc < -0.3 || truoc > 1.4 || Math.abs(doc) > c.nua + 1.3 || p.y < c.y - 0.6 || p.y > c.y + c.cao + 0.8) continue;
    const d = Math.abs(doc) + Math.abs(p.y - (c.y + 1)) * 0.5; if (d < diem) { diem = d; tot = c; }
  }
  if (tot && tot.vao === undefined) tot.vao = sanSauCua(tot);
  return tot;
}
function moCuaVao(c) {
  if (!c.mo) { // hai cánh gỗ mở vào trong, bản lề hai bên (giữ mở)
    const quay = Math.atan2(c.nx, c.nz), ux = -c.nz, uz = c.nx, w = c.nua * 0.92, vl = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.7 });
    c.mo = [-1, 1].map((k) => { const g = new THREE.Group(); g.position.set(c.x + ux * k * c.nua - c.nx * 0.12, c.y + c.cao * 0.45, c.z + uz * k * c.nua - c.nz * 0.12); g.rotation.y = quay + k * 1.2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, c.cao * 0.85, 0.05), vl); m.position.x = k * w / 2; g.add(m); scene.add(g); return g; });
  }
  const p = c.vao, h = Math.atan2(-c.nx, -c.nz); // quay mặt vào trong phòng
  di.datCho({ x: p.x, y: p.y + 0.95, z: p.z }, h - Math.PI, -0.1, h); ganCua = null;
}
function nutE() {
  if (ganCua?.vao) return moCuaVao(ganCua);
  if (!noiThat || !di?.dang) return;
  if ($('doc').style.display === 'block') return dongDoc();
  if (dangNgoi) return dungDay();
  if (dangCam) return thaDo();
  const t = ganNhat; if (!t) return;
  if (t.loai === 'ngoi') { dangNgoi = t; }
  else if (t.loai === 'mo') t.dangMo = !t.dangMo;
  else if (t.loai === 'cam') camLen(t);
  else if (t.loai === 'den') { t.den.userData.tat = !t.den.userData.tat; t.den.visible = !t.den.userData.tat; }
  else if (t.loai === 'doc') moDoc(t.phong);
}
addEventListener('keydown', (e) => { if (!di?.dang || e.repeat || e.target.closest?.('textarea, input')) return; if (e.code === 'KeyE') nutE(); if (e.code === 'KeyF') daDo(); if (e.code === 'Escape') dongDoc(); });
function timTuongTac(now) { // món gần nhất (≤ 1,8 m, cùng tầng, ưu tiên trước mặt) → dòng nhắc phím
  if (now - lucTim < 150) return; lucTim = now;
  let chu = '';
  ganCua = timCua(); if (ganCua) chu = ganCua.vao ? 'E mở cửa sổ, trèo vào' : 'Cửa sổ này chưa có phòng dựng bên trong';
  if (!ganCua && noiThat && di?.dang && noiThat.nhom.visible) {
    if (dangNgoi) chu = 'E / W A S D đứng dậy';
    else if (dangCam) chu = 'E thả xuống · nhấp chuột ném';
    else {
      const p = di.viTri(), h = di.huong; let tot = null, diem = 1e9;
      for (const t of noiThat.tuongTac) {
        if (t.vat?.cam) continue;
        const q = t.o.position, dx = q.x - p.x, dz = q.z - p.z, kc = Math.hypot(dx, dz); if (kc > 1.8 || Math.abs(q.y - (p.y - 0.9)) > 1.6) continue;
        const truoc = (dx * Math.sin(h) + dz * Math.cos(h)) / (kc || 1), d = kc - truoc * 0.6; if (d < diem) { diem = d; tot = t; }
      }
      ganNhat = tot;
      const TEN = { ngoi: 'E ngồi xuống', mo: tot?.dangMo ? 'E đóng rương' : 'E mở rương', cam: 'E cầm lên · F đá', den: tot?.den?.userData.tat ? 'E bật đèn' : 'E tắt đèn', doc: 'E đọc giới thiệu phòng' };
      chu = tot ? TEN[tot.loai] : '';
    }
  }
  const g = $('goiY'); if (g.textContent !== chu) { g.textContent = chu; g.style.display = chu ? 'block' : 'none'; }
}
// ---------- ĐIỆN THOẠI: cần gạt + kéo nhìn + nút theo ngữ cảnh (camung.js dùng chung) — cùng hàm với phím E / F / Space / V / nhấp chuột
const TEN_E = { ngoi: 'Ngồi', cam: 'Cầm', doc: 'Đọc' };
const camUng = di ? taoCamUng({ dom: renderer.domElement, di, nut: [
  { id: 'nhay', chu: () => { const c = di.nguCanh(); return dangNgoi ? null : c === 'leo' ? 'Bật ra' : c === 'tuong' ? 'Leo' : 'Nhảy'; }, bam: () => camUng.nhay() },
  { id: 'e', chu: () => ganCua?.vao ? 'Vào' : $('doc').style.display === 'block' ? 'Đóng' : dangNgoi ? 'Đứng' : dangCam ? 'Thả' : ganNhat ? (ganNhat.loai === 'mo' ? (ganNhat.dangMo ? 'Đóng' : 'Mở') : ganNhat.loai === 'den' ? (ganNhat.den?.userData.tat ? 'Bật đèn' : 'Tắt đèn') : TEN_E[ganNhat.loai] || 'E') : null, bam: () => nutE() },
  { id: 'nem', chu: () => (dangCam ? 'Ném' : null), bam: () => nemDoDangCam(innerWidth / 2, innerHeight / 2) },
  { id: 'da', chu: () => (!dangNgoi && !dangCam && phongHienTai() ? 'Đá' : null), bam: () => daDo() },
  { id: 'goc', chu: () => '👁', bam: () => di.doiGocNhin() },
] }) : null;
// ---------- NHIỀU NGƯỜI: kênh trên máy chủ castle-kenh (nhieunguoi.js) — nút 👥 chọn kênh / phòng riêng / chat; người khác hiện bằng cùng bộ nhân vật
$('nut').insertAdjacentHTML('beforeend', '<button id="b-nn" title="Kênh nhiều người: chọn kênh, phòng riêng theo mã, chat">👥</button>');
// bản trang đang ẩn (khung cách 3 chưa hiện, hoặc trang chính đang bị khung phủ) không có mặt trong kênh — chỉ bản anh đang nhìn mới là "mình"
const trangDangAn = () => (NHUNG ? !c3Hien : khungC3?.style.visibility === 'visible');
const nhieuNguoi = di ? taoNhieuNguoi({ THREE, scene, lau: 'neuschwanstein', nut: $('b-nn'), taoNguoi: (ao) => taoNguoi3d({ ao }), tamAn: trangDangAn,
  layTrangThai: () => (di.dang ? { p: di.viTri(), h: di.huong, s: { tt: di.tt, toc: di.toc, nen: di.nen, ngoi: !!dangNgoi } } : null) }) : null;
function phongHienTai() { if (!noiThat || !di?.dang) return null; const p = di.viTri(); return noiThat.phongTai(p.x, p.y - 0.9, p.z); }
window.__ns.cuaSo = { CUA, timCua, sanSauCua, moCuaVao, gan: () => ganCua };
window.__ns.thieuAnh = () => THIEU_ANH; window.__ns.thayDiem = thayDiem; // kiểm tầm nhìn chỗ chụp → điểm (bài thử 📷)
// NHỚ GÓC NHÌN QUA F5 (anh 16/11/2026: "lỡ F5 là mất luôn"): mỗi giây ghi góc đang xem vào ĐỊA CHỈ TRANG (#g=… — sao chép link gửi người khác cũng mở
// đúng góc) + localStorage; mở / tải lại thì về đúng chỗ. Toàn cảnh: camera + điểm nhìn + góc nhìn. Đi bộ: chỗ đứng + hướng người + hướng nhìn.
const GOC_KHOA = 'ns-goc';
function gocHienTai() {
  const f = (v) => +v.toFixed(2);
  if (di?.dang) { const p = di.viTri(); return ['d', f(p.x), f(p.y), f(p.z), f(di.huong), f(di.yaw)].join(','); }
  return ['t', ...camera.position.toArray().map(f), ...orbit.target.toArray().map(f), f(camera.fov)].join(',');
}
let gocCu = '', lucGoc = 0;
function luuGoc(epBuoc = false) {
  if (dangSo) return; const now = performance.now(); if (!epBuoc && now - lucGoc < 1000) return; lucGoc = now;
  const g = gocHienTai(); if (g === gocCu) return; gocCu = g;
  try { history.replaceState(null, '', `${location.pathname}${location.search}#g=${g}`); } catch {}
  try { localStorage.setItem(GOC_KHOA, g); } catch {}
}
function khoiPhucGoc(gDua = null) { // gDua: chuỗi góc đưa thẳng vào (khung cách 3 nhận từ trang chính)
  let g = gDua || (location.hash.match(/[#&]g=([^&]+)/) || [])[1]; if (!g) try { g = localStorage.getItem(GOC_KHOA); } catch {}
  const v = String(g || '').split(','), n = v.slice(1).map(Number); if (!g || n.some((x) => !Number.isFinite(x))) return false;
  if (v[0] === 't' && n.length === 7) { camera.position.set(n[0], n[1], n[2]); orbit.target.set(n[3], n[4], n[5]); camera.fov = n[6]; camera.updateProjectionMatrix(); orbit.update(); gocCu = g; return true; }
  if (v[0] === 'd' && n.length === 5 && di) { diNhanhNS(n[0], n[2], n[1] - 0.9); di.huong = n[3]; if (cho && Math.hypot(cho.x - n[0], cho.z - n[2]) < 1.5) traCamCho(); di.yaw = n[4]; gocCu = g; return true; } // viTri là tâm thân, chân thấp hơn ~0,9 m
  return false;
}
addEventListener('pagehide', () => luuGoc(true)); addEventListener('beforeunload', () => luuGoc(true));
window.__ns.luuGoc = luuGoc; window.__ns.gocHienTai = gocHienTai;
window.__ns.matTb = () => MAT_TB; // mặt Torbau dựng theo ảnh chụp: mốc, ánh xạ ảnh → mét, cạnh khoá, đã dựng / bỏ (scripts/xem-mat-rieng.mjs)
window.__ns.kiemKe = () => KIEM_KE; window.__ns.datCach3Hien = (b) => datCach3Hien(b); window.__ns.chupHaiBan = chupHaiBan; window.__ns.khoiTrongVung = khoiTrongVung; window.__ns.doKhoiAnh3d = doKhoiAnh3d; window.__ns.doKhoiTheoTia = doKhoiTheoTia; window.__ns.batAnh3dTam = batAnh3dTam; window.__ns.diemTaiAnh = diemTaiAnh;
// CHỒNG LẤN: hai ô cửa cùng một mặt tường mà khung chạm nhau (kể cả cửa dựng theo luật chung) → danh sách cặp (scripts/kiem-ke.mjs báo lỗi)
// so MỌI cặp cửa CÙNG MẶT PHẲNG (cùng hướng, cách ≤ 0,8 m), mọi nguồn (mặt OSM, mặt dựng riêng Palas) — trước gom theo mã mặt nên hai khối cùng mặt phẳng đè nhau không thấy (17/11/2026)
// CỬA LƠ LỬNG (17/11/2026, Viereckturm): ô cửa có đáy dưới chân tường / đỉnh trên mái hiên của chính khối quá 1 m → treo giữa trời hoặc đè sang khối khác.
// kiem-ke.mjs coi là lỗi (thoát 1) → trọng tài máy trả mọi bản sửa làm lớp lỗi này quay lại.
window.__ns.cuaLoLung = () => CUA.filter((c) => c.mat).map((c) => { const k = dsKhoi.find((q) => q.id === c.mat.split('#')[0]); if (!k) return null;
  const d0 = Number.isFinite(k.yDuoi) ? k.yDuoi : -1e9, d1 = k._y1 ?? k.yTren; return c.y < d0 - 1 || c.y + c.cao > d1 + 1 ? { mat: c.mat, y: +c.y.toFixed(1), chan: +d0.toFixed(1), dinh: +d1.toFixed(1) } : null; }).filter(Boolean);
// CHI TIẾT ĐÈ CỬA (anh 17/11/2026, tháp canh treo cổng Torbau che ô cửa mà kiểm kê vẫn "khớp" vì chỉ đếm số lượng): chi tiết khối 3D nhô ra trước tường
// (sổ kiểm kê có hop = { cx, cz, r, y0, y1 }) mà khối bao đè lên KHUNG NGOÀI một ô cửa trên mặt tường ngay sau nó (cách mặt tường ≤ r + 1,5 m, cùng phía ngoài) → lỗi
window.__ns.chiTietDeCua = () => { const ra = [];
  for (const e of KIEM_KE) { const h = e.hop; if (!h) continue;
    for (const c of CUA) { const d = (h.cx - c.x) * c.nx + (h.cz - c.z) * c.nz; if (d < -0.3 || d > h.r + 1.5) continue; // chi tiết đứng trước mặt tường của ô cửa
      const ux = -c.nz, uz = c.nx, ds = Math.abs((h.cx - c.x) * ux + (h.cz - c.z) * uz), v = c.vien || { ngang: 0.25, tren: 0.4 };
      if (ds < h.r + c.nua + v.ngang - 0.05 && h.y0 < c.y + c.cao + v.tren - 0.05 && h.y1 > c.y + 0.05)
        ra.push({ loai: e.loai, mat: e.mat, cua: c.mat || c.ten || '?', tam: [+h.cx.toFixed(1), +h.cz.toFixed(1)], cuaY: [+c.y.toFixed(1), +(c.y + c.cao).toFixed(1)], lechNgang: +ds.toFixed(2) }); } }
  return ra; };
window.__ns.chongLan = () => { const ra = [];
  for (let i = 0; i < CUA.length; i++) for (let j = i + 1; j < CUA.length; j++) { const a = CUA[i], b = CUA[j]; if (a.nx * b.nx + a.nz * b.nz < 0.97 || Math.abs((b.x - a.x) * a.nx + (b.z - a.z) * a.nz) > 0.8) continue;
    const mat = a.mat || a.ten || 'Palas', ux = -a.nz, uz = a.nx, sa = a.x * ux + a.z * uz, sb = b.x * ux + b.z * uz;
    // so theo KHUNG NGOÀI (viền đá, vòm bao) — lòng kính tách nhau mà khung vẫn đè là đúng lỗi nhìn thấy; ô cùng một cụm (cum) không tính
    const va = a.vien || { ngang: 0.25, tren: 0.4 }, vb = b.vien || { ngang: 0.25, tren: 0.4 }; if (a.cum != null && a.cum === b.cum && Math.abs(a.y - b.y) < 0.01) continue;
    if (Math.abs(sa - sb) < a.nua + va.ngang + b.nua + vb.ngang - 0.05 && a.y - 0.15 < b.y + b.cao + vb.tren - 0.05 && b.y - 0.15 < a.y + a.cao + va.tren - 0.05 && !(Math.abs(sa - sb) < 0.01 && Math.abs(a.y - b.y) < 0.01)) ra.push({ mat, a: [+sa.toFixed(2), +a.y.toFixed(2)], b: [+sb.toFixed(2), +b.y.toFixed(2)],
      chiTiet: [a, b].map((o) => ({ mat: o.mat || o.ten || 'Palas', nua: +o.nua.toFixed(2), cao: +o.cao.toFixed(2), vien: o.vien || null, cum: o.cum ?? null })) }); }
  return ra; };
// khung một mặt tường "khối#cạnh": hai đầu p, q, pháp tuyến ngoài n, mặt đất trước tường, đỉnh tường (mái hiên) y1, đỉnh khối yTren (scripts/kiem-ke.mjs kiểm khung)
window.__ns.matTuong = (id) => { const [kid, si] = id.split('#'), k = dsKhoi.find((q) => q.id === kid), i = +si; if (!k || !Number.isFinite(i)) return null;
  const p = k.v[i], q = k.v[(i + 1) % k.v.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L;
  return { p, q, L, n: [nx, nz], yDat: datThat((p[0] + q[0]) / 2 + nx * 2, (p[1] + q[1]) / 2 + nz * 2), y1: k._y1, yTren: k.yTren }; }; // sổ chi tiết đã dựng (scripts/kiem-ke.mjs)
window.__ns.THREE = THREE; window.__ns.VOM_CONG = VOM_CONG; window.__ns.cong = cong; window.__ns.TUONG_MT = TUONG_MT; window.__ns.LOP_OSM = LOP_OSM; window.__ns.matDat = matDat; window.__ns.MAT_SAN = MAT_SAN; window.__ns.nenLuoi = NEN_LUOI; // công cụ đo scripts/do-khoi-google.mjs bù độ cao ảnh 3D theo nền sân trên
window.__ns.camUng = () => camUng; window.__ns.diNhanh = diNhanhNS; window.__ns.noiThat = noiThat; window.__ns.NOI = NOI; window.__ns.cao3d = (x, z) => { if (!anh3d) return null; const h = new THREE.Raycaster(new THREE.Vector3(x, 600, z), new THREE.Vector3(0, -1, 0)).intersectObject(anh3d.t.group, true)[0]; return h ? h.point.y : null; }; window.__ns.anh3d = () => anh3d; window.__ns.anh3dTk = () => anh3d_tk; window.__ns.khuTai = khuTai; window.__ns.thuKhu = () => [...DA_KHU.map((k) => [...tamDa(k.v), k.khoa]), [(CAU[0][0] + CAU[1][0]) / 2, (CAU[0][1] + CAU[1][1]) / 2, 'Marienbruecke']]; window.__ns.tt = { nutE, daDo, nemDoDangCam, trangThai: () => ({ ngoi: !!dangNgoi, cam: !!dangCam, gan: ganNhat?.loai || null }) };
// ---------- ẢNH THẬT 3D: Google Photorealistic 3D Tiles qua Cesium ion (tài khoản htuan82, vault #697) — thư viện 3DTilesRendererJS (NASA-AMMOS, Apache-2.0).
// Khoá web trong du-lieu/google3d.json là khoá CÔNG KHAI bị khoá phạm vi: chỉ đọc asset 2275207, chỉ chạy khi trang ở castle.on.tc / 127.0.0.1:18777.
// Bật thì ẩn lớp dựng-từ-số-đo (LOP_OSM) + tắt va chạm thân cây giả (CAY_VA, cây thật trong ảnh mọc chỗ khác); giữ va chạm địa hình / khối nhà / cầu,
// nội thất, người, bản đồ. Độ cao: mô hình Google theo ellipsoid → dò mặt đất mô hình ở vài chỗ trống rồi bù cho khớp lưới EU-DEM đang dùng làm va chạm.
let anh3d = null, anh3d_tk = null;
// anh3d.bat = lựa chọn của người xem (nút 🌍 / 🧱); anh3d.hien = đang thật sự hiện ảnh thật. Đi bộ gần lâu đài (≤ 260 m) thì TỰ về mô hình dựng có mặt tiền
// chi tiết — ảnh Google chụp từ máy bay, đứng sát đất tường bị kéo giãn méo (anh 15/11/2026 "tởm quá"); xem toàn cảnh / đứng xa thì ảnh thật.
const datAnh3d = (bat) => {
  if (!anh3d) return; anh3d.bat = bat;
  $('b-anh3d').innerHTML = bat ? '🧱<span class="nhan"> Mô hình</span>' : '🌍<span class="nhan"> Ảnh thật 3D</span>';   // .nhan ẩn trên màn cảm ứng: hàng nút đáy không tràn (19/11/2026) $('b-anh3d').title = bat ? 'Về mô hình dựng từ số đo' : 'Hiện lâu đài ảnh thật 3D (Google) khi xem toàn cảnh / từ xa';
  try { localStorage.setItem('ns-anh3d-v2', bat ? '1' : '0'); } catch {} // khoá mới: lựa chọn cũ (mặc định bật trên máy tính) không kéo sang
  apDungAnh3d();
};
function apDungAnh3d() {
  if (!anh3d) return;
  const p = di?.dang ? di.viTri() : null, gan = !!p && Math.hypot(p.x + 30, p.z - 30) < 260;
  const hien = anh3d.epHien || (anh3d.bat && !dangSo && !gan); if (hien === anh3d.hien) return; anh3d.hien = hien; // epHien: báo lệch đang chụp bản ảnh thật (kể cả khi đi bộ gần)
  anh3d.goc.visible = hien; if (!hien) $('nguon-3d').textContent = '';
  LOP_OSM.dangAn = hien; for (const m of LOP_OSM) m.visible = !hien && !(dangSo && RUNG.includes(m)); batCayGan(); apHienCach3(); // so ảnh: rừng giữ ẩn (moSo đã ẩn, không bật lại ở đây)
  if (!hien) LOP_OSM.vaDat?.setEnabled(true); for (const c of anh3d.va.values()) for (const k of c) k.setEnabled(hien); // lưới đất: capNhatAnh3d chỉ tắt khi dưới chân đã có va chạm ô
}
(async () => { // chạy NỀN: không chặn vòng vẽ / vật lý chờ tải thư viện (trước đây trang đứng mấy giây đầu)
  const cfg = await fetch('./du-lieu/google3d.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (cfg?.token) try {
    const [{ TilesRenderer }, P, { DRACOLoader }] = await Promise.all([import('3d-tiles-renderer/three'), import('3d-tiles-renderer/three/plugins'), import('three/addons/loaders/DRACOLoader.js')]);
    const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
    const t = new TilesRenderer();
    t.registerPlugin(new P.CesiumIonAuthPlugin({ apiToken: cfg.token, assetId: cfg.assetId, autoRefreshToken: true }));
    t.registerPlugin(new P.GLTFExtensionsPlugin({ dracoLoader: draco }));
    t.registerPlugin(new P.TileCompressionPlugin()); t.registerPlugin(new P.TilesFadePlugin());
    t.registerPlugin(new P.ReorientationPlugin({ lat: D.tam[0] * Math.PI / 180, lon: D.tam[1] * Math.PI / 180, height: GOC_Y + (cfg.geoid ?? 47.6), recenter: true }));
    t.errorTarget = CHAM ? 16 : cfg.errorTarget ?? 8; // điện thoại: ô thô hơn một nấc (ít tải, ít tam giác)
    // ảnh chụp đã có sáng tối thật → vẽ không đổ bóng / không chịu đèn cảnh (đèn cảnh làm mặt khuất tối thêm lần nữa)
    t.addEventListener('load-model', ({ scene: sc }) => sc.traverse((o) => { if (o.isMesh && o.material?.map) { const m = new THREE.MeshBasicMaterial({ map: o.material.map }); o.material.dispose(); o.material = m; } }));
    t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer);
    // ReorientationPlugin đặt tâm về gốc với X hướng TÂY, Z hướng BẮC (chú thích trong mã thư viện); khung cảnh này X đông, Z nam → bọc nhóm xoay 180° quanh trục đứng
    const LECH = { x: cfg.lech?.x ?? 0, z: cfg.lech?.z ?? 0 }; // dời ngang ô 3D cho khớp bản đồ OSM (google3d.json)
    const goc = new THREE.Group(); goc.rotation.y = Math.PI; goc.position.set(LECH.x, 0, LECH.z); goc.add(t.group); scene.add(goc);
    // VA CHẠM từ chính mặt mô hình (ô chi tiết, sai số ≤ cfg.loiVa m): người đi trên đất / bậc / mái thật thay lưới EU-DEM 25 m (lệch vài mét ngoài sân).
    // Bỏ tam giác nằm trong mặt bằng khối nhà OSM: nhà dùng va chạm OSM đã khoét cửa (lối vào tháp cầu thang, nội thất), tường ảnh chụp sẽ bịt mất.
    const thanVa = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation({ x: 0, y: 1, z: 0, w: 0 }).setTranslation(LECH.x, 0, LECH.z)); // cùng phép xoay 180° + dời ngang của nhóm goc
    const va = new Map(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
    const khoiNha = dsKhoi.filter((k) => k.vo || k.la).map((k) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, z] of k.v) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return { v: k.v, a, b, c, d }; });
    const trongNha = (x, z) => khoiNha.some((k) => x > k.a && x < k.b && z > k.c && z < k.d && trongDa(x, z, k.v));
    const thongKe = {}; anh3d_tk = thongKe;
    t.addEventListener('load-model', ({ scene: sc, tile }) => {
      const ge = Math.round(tile.geometricError * 10) / 10; thongKe[ge] = (thongKe[ge] || 0) + 1;
      if (!(tile.geometricError <= (cfg.loiVa ?? 4))) return;
      try {
      t.group.updateMatrix(); const ds = [];
      sc.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position) return;
        _m.identity(); for (let q = o; q; q = q.parent) { q.updateMatrix(); _m.premultiply(q.matrix); if (q === sc) break; } _m.premultiply(t.group.matrix);
        const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, vs = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m); vs[i * 3] = _v.x; vs[i * 3 + 1] = _v.y; vs[i * 3 + 2] = _v.z; }
        const giu = [];
        for (let i = 0; i < n; i += 3) { const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
          const cx = LECH.x - (vs[a * 3] + vs[b * 3] + vs[c * 3]) / 3, cz = LECH.z - (vs[a * 3 + 2] + vs[b * 3 + 2] + vs[c * 3 + 2]) / 3; // toạ độ cảnh = xoay 180° + dời ngang của khung ô
          if (trongNha(cx, cz)) continue; giu.push(a, b, c); }
        if (giu.length) ds.push(world.createCollider(RAPIER.ColliderDesc.trimesh(vs, Uint32Array.from(giu)).setEnabled(anh3d?.hien ?? false), thanVa));
      });
      if (ds.length) va.set(tile, ds);
      } catch (e) { console.warn('[ns] dựng va chạm ô 3D lỗi', e); }
    });
    t.addEventListener('dispose-model', ({ tile }) => { for (const c of va.get(tile) || []) world.removeCollider(c, false); va.delete(tile); });
    anh3d = { t, goc, bat: false, hien: null, bu: null, va, thanVa };
    $('nut').insertAdjacentHTML('beforeend', '<button id="b-anh3d"></button>');
    $('b-anh3d').onclick = () => datAnh3d(!anh3d.bat);
    // điện thoại: mặc định TẮT ảnh thật (18 MB ô 3D trong 15 s đầu + ~200 nghìn tam giác mỗi khung → nóng máy); bấm 🌍 để bật. Máy tính mặc định bật
    // ẢNH THẬT 3D (Google) = NÚT SO SÁNH, mặc định TẮT (anh 16/11/2026: mô hình là khối 3D, ảnh 3D nhìn giả — nhưng vẫn cần nút để xoay toàn cảnh so với ảnh thật,
    // tìm chỗ mô hình sai). Bấm 🌍 bật / tắt, nhớ lựa chọn của người xem; công cụ đo (scripts/chung.mjs) đặt sẵn qua ns-anh3d
    let nho = '0'; try { nho = localStorage.getItem('ns-anh3d-v2') ?? (localStorage.getItem('ns-anh3d-cong-cu') === '1' ? localStorage.getItem('ns-anh3d') ?? '0' : '0'); } catch {}
    datAnh3d(nho === '1');
  } catch (e) { console.warn('[ns] không nạp được ảnh thật 3D', e); }
})();
function capNhatAnh3d() {
  if (!anh3d) return; const { t } = anh3d;
  apDungAnh3d(); if (!anh3d.hien) return;
  camera.updateMatrixWorld(); t.setResolutionFromRenderer(camera, renderer); t.update();
  if (!anh3d.lucNguon || performance.now() - anh3d.lucNguon > 3000) { // ghi nguồn dữ liệu 3D đang hiện (điều khoản Google: luôn hiện tên nguồn)
    anh3d.lucNguon = performance.now();
    const ds = (t.getAttributions?.() || []).filter((x) => x.type === 'string' && x.value && x.value !== 'Google').map((x) => x.value);
    $('nguon-3d').textContent = 'Ảnh thật 3D: Google' + (ds.length ? ' (' + [...new Set(ds)].join(', ').slice(0, 160) + ')' : '') + ' · '; // đứng ĐẦU dòng nguồn: màn hẹp cắt đuôi dòng, tên Google vẫn phải hiện
  }
  // bù độ cao LIÊN TỤC (mỗi 2 s): dò VA CHẠM của các ô chi tiết (không dò hình — hình còn lẫn ô thô, số nhảy -35 → +86 m) trên mặt sân trong lát đá
  // (OSM courtyard), so với lưới EU-DEM mà nội thất / khối nhà OSM bám theo, chỉnh tới khi lệch < 0,3 m. Ô thô lúc đầu cho lệch 24,8 rồi 49,9 m nên không bù một lần.
  const chiO = (c) => c.parent()?.handle === anh3d.thanVa.handle;
  if (!anh3d.lucBu || performance.now() - anh3d.lucBu > 2000) {
    anh3d.lucBu = performance.now();
    const vs = sanTrong?.ngoai?.[0] || []; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, z] of vs) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, z); b1 = Math.max(b1, z); }
    const lech = [];
    for (let x = a0; x <= a1; x += 3) for (let z = b0; z <= b1; z += 3) if (trongDa(x, z, vs) && kcVien(x, z, vs) > 2.5) {
      const h = world.castRay(new RAPIER.Ray({ x, y: 700, z }, { x: 0, y: -1, z: 0 }), 1400, true, undefined, undefined, undefined, undefined, chiO);
      if (h) lech.push(matDat(x, z) - (700 - h.timeOfImpact)); // khớp mặt sân của ảnh thật 3D với nền sân trên (đo từ ảnh), không với lưới đất thô
    }
    if (lech.length >= 8) { lech.sort((a, b) => a - b); const m = lech[lech.length >> 1], tu = lech[Math.floor(lech.length * 0.25)], den = lech[Math.floor(lech.length * 0.75)];
      if (den - tu < 3 && Math.abs(m) > 0.3) { anh3d.goc.position.y += m; anh3d.bu = anh3d.goc.position.y; anh3d.thanVa.setTranslation({ x: anh3d.goc.position.x, y: anh3d.bu, z: anh3d.goc.position.z }, true); console.info('[ns] ảnh thật 3D: chỉnh độ cao', m.toFixed(2), 'm → tổng', anh3d.bu.toFixed(2), 'm'); } }
  }
  // lưới đất EU-DEM: tắt khi ngay dưới chân đã có va chạm ô (đi trên mặt thật); chưa có (ô đang nạp / ra xa) thì bật lại để không rơi
  if (di?.dang && (!anh3d.lucDat || performance.now() - anh3d.lucDat > 300)) {
    anh3d.lucDat = performance.now(); const p = di.viTri();
    const coO = !!world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 2, z: p.z }, { x: 0, y: -1, z: 0 }), 12, true, undefined, undefined, undefined, undefined, chiO);
    LOP_OSM.vaDat?.setEnabled(!coO);
  }
}
world.step(); // cập nhật bộ dò tia sau khi dựng xong mọi va chạm (chưa bước nào thì castRay không thấy gì → di chuyển nhanh từ toàn cảnh hỏng)
// F5 / mở link có #g=…: về đúng góc đã xem (công cụ đo tự đặt camera, bỏ qua — ns-anh3d-cong-cu)
let laCongCu = false; try { laCongCu = localStorage.getItem('ns-anh3d-cong-cu') === '1'; } catch {}
if (!laCongCu || /[#&]g=/.test(location.hash)) khoiPhucGoc();
ve();
if (NHUNG) parent.postMessage({ loai: 'c3:san-sang' }, location.origin); // khung cách 3 dựng xong hẳn mới báo trang chính
{ // 🧭 KIỂM: dữ liệu đánh giá (trạng thái khối + kết quả kiểm kê từng mặt) — có ở cả hai cách; cách 3 tự bật
  const [TT, KQ] = await Promise.all([`${ten}-cach3-trang-thai`, `${ten}-kiem-ke-kq`].map((f) => fetch(`./du-lieu/${f}.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))));
  const dg = ganDanhGia({ THREE, scene, camera, dom: renderer.domElement, nut: $('b-kiem'), dsKhoi, CUA, KIEM_KE, CUA_SO, TT, KQ: KQ.mat || {}, trongDa, datThat, diemTaiAnh });
  if (CACH === '3' || dg.nho) dg.batTat(true); window.__ns.danhGia = dg;
}
