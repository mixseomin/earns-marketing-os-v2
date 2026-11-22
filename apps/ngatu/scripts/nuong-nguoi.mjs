// Nướng người thật cho ngatu (bản thật): mẫu Quaternius Modular Men/Women (CC0) → các khung dáng cố định → mohinh/nguoi.bin
// Mẫu gốc có khung xương 49 khớp nhưng không kèm động tác: ở đây tự xoay khớp ra 8 khung bước đi + 1 dáng đứng + 1 dáng ngồi xe máy,
// giảm lưới bằng meshoptimizer (cùng một bộ tam giác cho mọi khung → không nhấp nháy), lượng tử hoá Int16/Int8 cho nhẹ.
// Chạy: node apps/ngatu/scripts/nuong-nguoi.mjs <thư mục chứa glb>   (tải từ github.com/trebeljahr/quaternius-showcase public/glb/)
// Định dạng: [u32 độ dài JSON][JSON][dữ liệu căn 4 byte]. Trục: +x là hướng đi (như geoBo), chân chạm y=0 (đứng/đi); dáng ngồi đặt hông ở (0.02, 0.9, 0).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const VAO = process.argv[2], RA = new URL('../public/mohinh/nguoi.bin', import.meta.url).pathname;
const MAU = [['modular_men_Casual.glb', 0.13], ['modular_women_Casual.glb', 0.13], ['modular_men_Worker.glb', 0.13]];
const SO_BUOC = 8, CAO = 1.7;
await MeshoptSimplifier.ready;

const doc = (f) => new Promise((ok, loi) => { const b = fs.readFileSync(path.join(VAO, f)); new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '', ok, loi); });
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

const dauRa = { mau: [] }, khoi = [];
for (const [f, tiLe] of MAU) {
  const g = await doc(f), goc = g.scene;
  const meshes = []; goc.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const xuong = {}; goc.traverse((o) => { if (o.isBone) xuong[o.name] = o; });
  const ban = new Map(); for (const b of Object.values(xuong)) ban.set(b, b.quaternion.clone());
  const veGoc = () => { for (const [b, q] of ban) b.quaternion.copy(q); goc.updateMatrixWorld(true); };
  // xoay một khớp quanh trục THẾ GIỚI (tính sau khi khớp cha đã xoay)
  const xoay = (ten, truc, rad) => {
    const b = xuong[ten.replace(".", "")]; goc.updateMatrixWorld(true);
    const qp = new THREE.Quaternion(); b.parent.getWorldQuaternion(qp);
    const qw = new THREE.Quaternion().setFromAxisAngle(truc, rad);
    b.quaternion.premultiply(qp.clone().invert().multiply(qw).multiply(qp)); goc.updateMatrixWorld(true);
  };
  // bên trái của mẫu nằm phía x nào (đo thật, không đoán) → dấu cho các phép xoay tay
  veGoc(); const sL = Math.sign(xuong.UpperArmL.getWorldPosition(new THREE.Vector3()).x) || 1;
  const tayXuong = () => { xoay('UpperArm.L', Z, -1.25 * sL); xoay('UpperArm.R', Z, 1.25 * sL); xoay('LowerArm.L', X, -0.15); xoay('LowerArm.R', X, -0.15); };
  // lấy các mảnh lưới theo vật liệu, gom chỉ số + màu; mảnh áo (thân, không phải da, nhiều đỉnh nhất) được nhuộm theo từng người
  const manh = [];
  for (const m of meshes) {
    const ten = m.material.name || '', mau = m.material.color.clone().convertLinearToSRGB();
    manh.push({ m, ten, mau, laThan: /_Body$/.test(m.parent?.name || m.name) || /Body/.test(m.name) });
  }
  let ao = null; for (const k of manh) if (k.laThan && !/Skin/i.test(k.ten) && (!ao || k.m.geometry.attributes.position.count > ao.m.geometry.attributes.position.count)) ao = k;
  const bo = []; // mỗi mảnh: chỉ số đã giảm (theo đỉnh gốc của mảnh)
  for (const k of manh) {
    const pos = k.m.geometry.attributes.position.array, idx = k.m.geometry.index ? new Uint32Array(k.m.geometry.index.array) : new Uint32Array(pos.length / 3).map((_, i) => i);
    const muc = Math.max(12, Math.floor((idx.length * tiLe) / 3) * 3);
    // hàn các đỉnh trùng chỗ (mẫu gốc tách đỉnh theo pháp tuyến → mọi cạnh thành biên, không giảm được)
    const han = new Map(), daiDien = [], moi = new Uint32Array(pos.length / 3);
    for (let v = 0; v < moi.length; v++) { const kh = `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`; let n = han.get(kh); if (n === undefined) { n = daiDien.length; han.set(kh, n); daiDien.push(v); } moi[v] = n; }
    const idxH = idx.map((v) => moi[v]), posH = new Float32Array(daiDien.length * 3); daiDien.forEach((v, n) => posH.set(pos.subarray(v * 3, v * 3 + 3), n * 3));
    const [rut] = MeshoptSimplifier.simplify(idxH, posH, 3, muc, 0.08, []);
    bo.push((rut.length ? rut : idxH).map((n) => daiDien[n]));
  }
  // đỉnh dùng tới sau khi giảm → đánh lại số
  const dinh = [], soMoi = manh.map(() => new Map());
  manh.forEach((k, i) => { for (const v of bo[i]) if (!soMoi[i].has(v)) { soMoi[i].set(v, dinh.length); dinh.push([i, v]); } });
  const chiSo = new Uint16Array(bo.reduce((t, b) => t + b.length, 0)); let c0 = 0;
  bo.forEach((b, i) => { for (const v of b) chiSo[c0++] = soMoi[i].get(v); });
  const mau = new Uint8Array(dinh.length * 4);
  dinh.forEach(([i, v], j) => { const k = manh[i], c = k === ao ? new THREE.Color(1, 1, 1) : k.mau; mau.set([c.r * 255, c.g * 255, c.b * 255, k === ao ? 255 : 0], j * 4); });
  // một dáng → toạ độ thế giới của các đỉnh đã chọn
  const tmp = new THREE.Vector3();
  const chup = () => { const out = new Float32Array(dinh.length * 3); dinh.forEach(([i, v], j) => { const m = manh[i].m; tmp.fromBufferAttribute(m.geometry.attributes.position, v); m.applyBoneTransform(v, tmp); tmp.applyMatrix4(m.matrixWorld); out.set([tmp.x, tmp.y, tmp.z], j * 3); }); return out; };
  // dáng đứng → tìm phép đặt chuẩn (quay +z thành +x, cao CAO, chân chạm đất)
  veGoc(); tayXuong(); const dung = chup();
  let lo = Infinity, hi = -Infinity; for (let j = 1; j < dung.length; j += 3) { lo = Math.min(lo, dung[j]); hi = Math.max(hi, dung[j]); }
  const s = CAO / (hi - lo), quay = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const dat = (a, dy = 0, dx = 0) => { const v = new THREE.Vector3(); for (let j = 0; j < a.length; j += 3) { v.set(a[j], a[j + 1] - lo, a[j + 2]).multiplyScalar(s).applyMatrix4(quay); a[j] = v.x + dx; a[j + 1] = v.y + dy; a[j + 2] = v.z; } return a; };
  const dang = [];
  for (let k = 0; k < SO_BUOC; k++) {
    const p = (k / SO_BUOC) * Math.PI * 2, sw = Math.sin(p) * 0.45;
    veGoc(); tayXuong();
    xoay('UpperLeg.L', X, -sw); xoay('UpperLeg.R', X, sw);
    xoay('LowerLeg.L', X, Math.max(0, Math.cos(p)) * 0.7 + 0.08); xoay('LowerLeg.R', X, Math.max(0, -Math.cos(p)) * 0.7 + 0.08);
    xoay('UpperArm.L', X, sw * 0.7); xoay('UpperArm.R', X, -sw * 0.7);
    dang.push(dat(chup()));
  }
  dang.push(dat(dung));
  // dáng ngồi xe máy: đùi ra trước, cẳng chân thả xuống, người hơi đổ, hai tay vươn ra tay lái
  veGoc();
  xoay('UpperLeg.L', X, -1.45); xoay('UpperLeg.R', X, -1.45); xoay('LowerLeg.L', X, 1.25); xoay('LowerLeg.R', X, 1.25);
  xoay('UpperLeg.L', Z, 0.12 * sL); xoay('UpperLeg.R', Z, -0.12 * sL);
  xoay('Abdomen', X, 0.22);
  xoay('UpperArm.L', Z, -0.55 * sL); xoay('UpperArm.R', Z, 0.55 * sL); xoay('UpperArm.L', Y, -1.25 * sL); xoay('UpperArm.R', Y, 1.25 * sL); xoay('LowerArm.L', Y, -0.35 * sL); xoay('LowerArm.R', Y, 0.35 * sL);
  const hong = new THREE.Vector3(); xuong.Hips.getWorldPosition(hong);
  const ngoi = chup(); const hv = hong.clone(); hv.y -= lo; hv.multiplyScalar(s).applyMatrix4(quay);
  dang.push(dat(ngoi, 0.9 - hv.y, 0.02 - hv.x));
  for (const a of dang) for (let j = 0; j < a.length; j += 3) a[j + 2] -= hv.z * 0; // giữ tâm z
  // lượng tử: Int16 theo bước 0,1 mm
  const nv = dinh.length;
  khoi.push(chiSo, mau, ...dang.map((a) => Int16Array.from(a, (x) => Math.round(x * 10000))));
  dauRa.mau.push({ ten: f.replace('.glb', ''), nv, ni: chiSo.length, dang: dang.length });
  console.log(f, 'đỉnh', nv, 'tam giác', chiSo.length / 3, 'cao gốc', (hi - lo).toFixed(3));
}
dauRa.buoc = SO_BUOC;
const js = Buffer.from(JSON.stringify(dauRa)), dau = Buffer.alloc(4); dau.writeUInt32LE(js.length);
const phan = [dau, js]; let len = 4 + js.length; const dem = (n) => { const p = (4 - (len % 4)) % 4; if (p) { phan.push(Buffer.alloc(p)); len += p; } };
dem();
for (const k of khoi) { const b = Buffer.from(k.buffer, k.byteOffset, k.byteLength); phan.push(b); len += b.length; dem(); }
fs.writeFileSync(RA, Buffer.concat(phan));
console.log('→', RA, (len / 1024).toFixed(0), 'KB');
