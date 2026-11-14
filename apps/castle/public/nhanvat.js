// Nhân vật có khung xương sinh bằng mã + động tác thủ tục (không tệp mô hình / hoạt ảnh).
// Khung: goc (chân chạm đất) → hong → bung → nguc → co → dau; hong → dui → ong → ban chân; nguc → vai → canh tay → cang tay → tay.
// Mặt nhân vật nhìn về +z cục bộ. Động tác: đứng thở · đi · chạy · nhảy · ngồi · ném · chào · múa · đá · ngã–dậy.
import * as THREE from 'three';

// VẼ HÀNG LOẠT: mỗi bộ phận (đầu, đùi, giày…) chỉ là một điểm neo trong khung xương; mọi người cùng loại bộ phận
// vẽ chung MỘT lệnh (InstancedMesh, màu riêng từng người). 30 người × 30 bộ phận = ~20 lệnh vẽ thay vì ~900 → máy mát.
const KHO = new Map(), GOC_DS = [];
const VL_CHUNG = new THREE.MeshStandardMaterial({ roughness: 0.8 });
export function phan(key, taoHinh, mau) {
  let k = KHO.get(key); if (!k) { k = { geo: taoHinh(), ds: [], m: null }; KHO.set(key, k); }
  const o = new THREE.Object3D(); o.userData.mau = new THREE.Color(mau); k.ds.push(o); return o;
}
export function dangKyGoc(g) { GOC_DS.push(g); g.traverse((o) => { o.userData.goc = g; }); }
// Ai được vẽ chi tiết: chỉ người TRONG khung nhìn và GẦN (≤ 45 m). Xa hơn → một khối dáng người cùng màu áo (1 lệnh vẽ chung);
// ngoài khung nhìn → không vẽ, không tính động tác. Thú ở xa / ngoài khung → ẩn.
const GAN = 45, khung = new THREE.Frustum(), mPS = new THREE.Matrix4(), cau_ = new THREE.Sphere(), tamTam = new THREE.Vector3();
let XA = null;
export const DEM = { gan: 0, xa: 0, an: 0 };
function xepLod(g) {
  if (!g.visible) return 'an';
  tamTam.copy(g.position); tamTam.y += 0.9; cau_.set(tamTam, 1.3);
  if (!khung.intersectsSphere(cau_)) return 'an';
  return g.position.distanceTo(LOD.cam.position) > GAN ? (g.userData.ao != null ? 'xa' : 'an') : 'gan';
}
export function trongKhung(g) { return !LOD.cam || g.userData.lod !== 'an'; }
export function chotNguoi(scene) { // gọi một lần sau khi tạo xong mọi người / thú
  const nguoi = GOC_DS.filter((g) => g.userData.ao != null);
  XA = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.24, 1.15, 2, 6).translate(0, 0.83, 0), VL_CHUNG, nguoi.length);
  XA.frustumCulled = false; XA.castShadow = true; nguoi.forEach((g, i) => { g.userData.xaI = i; XA.setColorAt(i, new THREE.Color(g.userData.ao)); }); scene.add(XA);
  for (const k of KHO.values()) {
    if (k.m) continue;
    k.m = new THREE.InstancedMesh(k.geo, VL_CHUNG, k.ds.length); k.m.castShadow = true; k.m.frustumCulled = false;
    k.ds.forEach((o, i) => k.m.setColorAt(i, o.userData.mau)); scene.add(k.m);
  }
}
const KHONG = new THREE.Matrix4().makeScale(0, 0, 0);
export function veNguoi() {
  const cam = LOD.cam; cam.updateMatrixWorld(); mPS.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); khung.setFromProjectionMatrix(mPS);
  DEM.gan = DEM.xa = DEM.an = 0;
  for (const g of GOC_DS) {
    const l = g.userData.lod = xepLod(g); DEM[l]++;
    if (l === 'gan') g.updateMatrixWorld(true);
    if (XA && g.userData.xaI != null) { if (l === 'xa') { g.updateMatrix(); XA.setMatrixAt(g.userData.xaI, g.matrix); } else XA.setMatrixAt(g.userData.xaI, KHONG); }
  }
  if (XA) XA.instanceMatrix.needsUpdate = true;
  for (const k of KHO.values()) {
    if (!k.m) continue;
    k.ds.forEach((o, i) => k.m.setMatrixAt(i, o.userData.goc?.userData.lod === 'gan' && o.visible ? o.matrixWorld : KHONG));
    k.m.instanceMatrix.needsUpdate = true;
  }
}
export const LOD = { cam: null }; // ở xa thì cập nhật động tác thưa (35 m: 15 lần/giây, 60 m: 5 lần/giây)
const vl = (mau) => mau;
const nang = (r, h, mau, y = 0) => { const o = phan(`cap:${r}:${h}`, () => new THREE.CapsuleGeometry(r, h, 3, 8), mau); o.position.y = y; return o; };
const cau = (key, taoHinh, mau) => phan(key, taoHinh, mau);
const khop = (cha, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); cha.add(g); return g; };

export const MAU_DA = [0xf1c7a3, 0xd9a07a, 0xb37a52, 0x8a5a3c, 0xf5d6bd];
export const MAU_AO = [0x7a2e2e, 0x2e4f7a, 0x3d6b3a, 0x6b4a2a, 0x5a3a6e, 0x8a6a2a, 0x2a5f5f, 0x6e2a4a];

export function taoNguoi(o = {}) {
  const da = o.da ?? MAU_DA[0], ao = o.ao ?? MAU_AO[0], quan = o.quan ?? 0x3a3530, toc = o.toc ?? 0x2b1d14, giay = 0x2a1a10, s = o.co ?? 1;
  const goc = new THREE.Group(); goc.scale.setScalar(s);
  const k = {};
  const xoay = new THREE.Group(); goc.add(xoay); // trục ngã: quay quanh bàn chân
  k.hong = khop(xoay, 0, 0.95, 0);
  { const m = nang(0.15, 0.12, quan); m.rotation.z = Math.PI / 2; k.hong.add(m); }
  k.bung = khop(k.hong, 0, 0.06, 0);
  k.bung.add(nang(0.16, 0.14, ao, 0.12));
  k.nguc = khop(k.bung, 0, 0.24, 0);
  const nguc = nang(0.19, 0.16, ao, 0.1); nguc.scale.set(1.05, 1, 0.78); k.nguc.add(nguc);
  const that = cau('that', () => new THREE.TorusGeometry(0.155, 0.025, 5, 14), 0x3a2414); that.rotation.x = Math.PI / 2; that.position.y = -0.2; k.nguc.add(that); // thắt lưng
  k.co = khop(k.nguc, 0, 0.3, 0);
  k.co.add(nang(0.055, 0.06, da, 0.04));
  k.dau = khop(k.co, 0, 0.1, 0);
  const dau = cau('dau', () => new THREE.SphereGeometry(0.115, 14, 10), da); dau.scale.set(0.92, 1.08, 1); dau.position.y = 0.1; k.dau.add(dau);
  const t = cau('toc', () => new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), toc); t.position.set(0, 0.115, -0.012); t.rotation.x = -0.25; k.dau.add(t);
  for (const x of [-0.04, 0.04]) { const m = cau('mat', () => new THREE.SphereGeometry(0.014, 6, 4), 0x111111); m.position.set(x, 0.115, 0.1); k.dau.add(m); }
  const mui = cau('mui', () => new THREE.ConeGeometry(0.016, 0.04, 5), da); mui.rotation.x = Math.PI / 2; mui.position.set(0, 0.085, 0.115); k.dau.add(mui);
  if (o.mu) { const m = cau('mu', () => new THREE.ConeGeometry(0.15, 0.2, 12), o.mu); m.position.y = 0.27; k.dau.add(m); }
  for (const [ben, x] of [['T', 1], ['P', -1]]) { // T = trái nhân vật (+x), P = phải (-x)
    const vai = k['vai' + ben] = khop(k.nguc, x * 0.22, 0.24, 0);
    vai.add(nang(0.058, 0.2, ao, -0.14));
    const khuyu = k['khuyu' + ben] = khop(vai, 0, -0.29, 0);
    khuyu.add(nang(0.048, 0.18, da, -0.12));
    const tay = k['tay' + ben] = khop(khuyu, 0, -0.26, 0);
    tay.add(cau('tay', () => new THREE.SphereGeometry(0.05, 8, 6), da));
    const dui = k['dui' + ben] = khop(k.hong, x * 0.1, -0.03, 0);
    dui.add(nang(0.075, 0.28, quan, -0.22));
    const goi = k['goi' + ben] = khop(dui, 0, -0.45, 0);
    goi.add(nang(0.06, 0.28, quan, -0.21));
    const co = k['coChan' + ben] = khop(goi, 0, -0.44, 0);
    const chan = cau('giay', () => new THREE.BoxGeometry(0.1, 0.07, 0.24), giay); chan.position.set(0, -0.02, 0.05); co.add(chan);
  }
  goc.userData.ao = ao; dangKyGoc(goc);

  // ---- tư thế: mỗi khớp một Euler đích, khớp thật trôi về đích (mượt khi đổi động tác)
  const TEN = Object.keys(k);
  const dich = Object.fromEntries(TEN.map((n) => [n, new THREE.Vector3()]));
  let tichDt = 0, pha = 0, viec = null, tViec = 0, hongY = 0.95, hongYDich = 0.95, nghieng = 0, nghiengDich = 0;
  const DT = { nem: 0.75, chao: 2.2, mua: 3.2, da: 0.7, nga: 3.2, cungLy: 1.4 };
  const lech = Math.random() * 20; // mỗi người lệch nhịp, đám đông không cử động đồng loạt
  const xoa = () => { for (const n of TEN) dich[n].set(0, 0, 0); hongYDich = 0.95; nghiengDich = 0; };
  const api = {
    goc, khop: k,
    get viec() { return viec; },
    lam(ten, khiTha) { if (viec === 'nga') return false; if (!DT[ten]) { viec = null; return false; } viec = ten; tViec = 0; api.khiTha = khiTha || null; api.daTha = false; return true; },
    viTriTay(out) { return k.tayP.getWorldPosition(out); },
    cam(vat, noi = 'tayP') { k[noi].add(vat); return vat; }, // gắn đồ vào khớp (cốc, đàn, khay)
    capNhat(dt0, st) { // st = { toc: m/s ngang, nen, ngoi, ngoiGhe, loop }
      if (!goc.visible) return;
      if (LOD.cam) { tichDt += dt0; if (goc.userData.lod && goc.userData.lod !== 'gan') { if (tichDt > 1) tichDt = 1; return; } } // xa / ngoài khung: không tính động tác
      else tichDt += dt0;
      const dt = Math.min(tichDt, 0.25); tichDt = 0;
      xoa();
      const v = st.toc || 0;
      const ty = Math.min(v / 4.2, 1), chay = Math.max(0, Math.min((v - 4.5) / 3, 1));
      pha += dt * (v > 0.05 ? 2.2 + v * 1.25 : 0);
      const sp = Math.sin(pha), cp = Math.cos(pha);
      // thở (luôn có)
      const th = Math.sin(performance.now() / 1000 * 1.6);
      dich.nguc.x += th * 0.02; dich.vaiT.z += 0.06 + th * 0.01; dich.vaiP.z -= 0.06 + th * 0.01; dich.khuyuT.x -= 0.12; dich.khuyuP.x -= 0.12;
      // đi / chạy
      if (ty > 0) {
        const A = 0.55 * ty + 0.25 * chay, K = 0.9 * ty + 0.6 * chay;
        dich.duiT.x += -sp * A; dich.duiP.x += sp * A;
        dich.goiT.x += Math.max(0, cp) * K + 0.08 * ty; dich.goiP.x += Math.max(0, -cp) * K + 0.08 * ty;
        dich.coChanT.x += -0.3 * Math.max(0, cp) * ty + sp * 0.15 * ty; dich.coChanP.x += -0.3 * Math.max(0, -cp) * ty - sp * 0.15 * ty;
        dich.vaiT.x += sp * (0.5 * ty + 0.3 * chay); dich.vaiP.x += -sp * (0.5 * ty + 0.3 * chay);
        dich.khuyuT.x -= 0.25 * ty + 1.1 * chay; dich.khuyuP.x -= 0.25 * ty + 1.1 * chay;
        dich.hong.y += sp * 0.12 * ty; dich.nguc.y -= sp * 0.18 * ty; dich.bung.x += 0.06 * ty + 0.22 * chay; dich.dau.x -= 0.05 * ty + 0.15 * chay;
        hongYDich = 0.95 - 0.025 * ty - 0.04 * chay + Math.abs(cp) * (0.03 + 0.04 * chay);
      }
      if (!st.nen) { // trên không: co chân, dang tay
        dich.duiT.x = -0.7; dich.duiP.x = -0.2; dich.goiT.x = 1.1; dich.goiP.x = 0.5;
        dich.vaiT.x = -0.4; dich.vaiP.x = -0.4; dich.vaiT.z = 0.7; dich.vaiP.z = -0.7; dich.khuyuT.x = -0.5; dich.khuyuP.x = -0.5;
      } else if (st.ngoi) {
        dich.duiT.x = dich.duiP.x = -1.3; dich.goiT.x = dich.goiP.x = 2.1; dich.coChanT.x = dich.coChanP.x = -0.8;
        dich.bung.x = 0.35; dich.dau.x = -0.2; dich.vaiT.x = dich.vaiP.x = -0.5; dich.khuyuT.x = dich.khuyuP.x = -0.9; hongYDich = 0.48;
      }
      // ngồi ghế: st.ngoiGhe = độ cao mặt ghế
      if (st.ngoiGhe) {
        dich.duiT.x = dich.duiP.x = -1.5; dich.goiT.x = dich.goiP.x = 1.5; dich.coChanT.x = dich.coChanP.x = 0;
        dich.duiT.z = 0.06; dich.duiP.z = -0.06; hongYDich = st.ngoiGhe + 0.1;
      }
      // tư thế vận động: leo tường · đu qua mép · bơi
      const TT = st.tuThe;
      if (TT === 'leo') {
        const q = st.phaLeo || 0, a = Math.sin(q);
        dich.vaiT.x = -2.5 - 0.45 * a; dich.vaiP.x = -2.5 + 0.45 * a; dich.vaiT.z = 0.25; dich.vaiP.z = -0.25;
        dich.khuyuT.x = -0.4 - 0.6 * Math.max(0, -a); dich.khuyuP.x = -0.4 - 0.6 * Math.max(0, a);
        dich.duiT.x = -0.6 - 0.6 * Math.max(0, a); dich.duiP.x = -0.6 - 0.6 * Math.max(0, -a); dich.goiT.x = 0.9 + 0.7 * Math.max(0, a); dich.goiP.x = 0.9 + 0.7 * Math.max(0, -a);
        dich.coChanT.x = dich.coChanP.x = -0.3; dich.dau.x = -0.3; hongYDich = 0.95;
      } else if (TT === 'qua') {
        dich.vaiT.x = dich.vaiP.x = -1.1; dich.khuyuT.x = dich.khuyuP.x = -0.3; dich.duiT.x = -1.4; dich.goiT.x = 1.8; dich.duiP.x = -0.6; dich.goiP.x = 1.0; dich.bung.x = 0.45; dich.dau.x = -0.2;
      } else if (TT === 'cuoi') { // ngồi yên ngựa: hai chân dạng ôm bụng ngựa, tay cầm cương, nhún theo nước đi
        const v = st.tocXe || 0, n = Math.sin(performance.now() / 1000 * (4 + v * 0.9)) * Math.min(1, v / 6);
        dich.duiT.x = dich.duiP.x = -0.55; dich.duiT.z = 0.62; dich.duiP.z = -0.62; dich.goiT.x = dich.goiP.x = 1.05; dich.coChanT.x = dich.coChanP.x = -0.3;
        dich.vaiT.x = dich.vaiP.x = -0.65; dich.khuyuT.x = dich.khuyuP.x = -0.85; dich.bung.x = 0.1 + Math.min(0.35, v * 0.03); dich.dau.x = -0.1 - Math.min(0.25, v * 0.02);
        hongYDich = 0.95 + n * 0.05;
      } else if (TT === 'lai') { // ngồi ghế xe, tay giữ cương
        dich.duiT.x = dich.duiP.x = -1.45; dich.goiT.x = dich.goiP.x = 1.0; dich.duiT.z = 0.08; dich.duiP.z = -0.08;
        dich.vaiT.x = dich.vaiP.x = -0.75; dich.khuyuT.x = dich.khuyuP.x = -0.7; dich.bung.x = 0.12; hongYDich = 0.95;
      } else if (TT === 'boi') { // bơi ếch: thân nằm sấp, ngẩng đầu, tay quạt, chân đạp
        const q = st.phaBoi || 0, a = Math.sin(q), c = Math.cos(q);
        nghiengDich = 1.3; dich.dau.x = -1.05; dich.co.x = -0.2;
        dich.vaiT.x = dich.vaiP.x = -2.3 + 0.8 * a; dich.vaiT.z = 0.55 + 0.55 * c; dich.vaiP.z = -(0.55 + 0.55 * c); dich.khuyuT.x = dich.khuyuP.x = -0.35 - 0.5 * Math.max(0, -a);
        dich.duiT.x = dich.duiP.x = -0.25 - 0.35 * Math.max(0, a); dich.duiT.z = 0.25 * Math.max(0, a); dich.duiP.z = -0.25 * Math.max(0, a); dich.goiT.x = dich.goiP.x = 0.2 + 1.1 * Math.max(0, a);
        dich.coChanT.x = dich.coChanP.x = 0.6;
      }
      // sinh hoạt lặp: uống · nói · cười · đàn · lau · khay · say
      const tt = performance.now() / 1000 + lech, L = st.loop;
      if (L === 'uong') {
        const c = (tt % 6) / 6, len = THREE.MathUtils.smoothstep(c, 0.55, 0.65) * (1 - THREE.MathUtils.smoothstep(c, 0.85, 0.95));
        dich.vaiP.x = -0.55 - 0.85 * len; dich.vaiP.z = -0.1; dich.khuyuP.x = -1.15 - 1.0 * len; dich.dau.x = -0.35 * len; dich.nguc.x -= 0.1 * len;
      } else if (L === 'noi') {
        dich.vaiT.x = -0.45 + Math.sin(tt * 2.3) * 0.25; dich.khuyuT.x = -1.1 + Math.sin(tt * 3.1) * 0.3; dich.vaiT.z = 0.25;
        dich.vaiP.x = -0.35 + Math.sin(tt * 1.7 + 1) * 0.3; dich.khuyuP.x = -1.0 + Math.sin(tt * 2.6 + 2) * 0.35; dich.vaiP.z = -0.25;
        dich.dau.y = Math.sin(tt * 0.6) * 0.45; dich.dau.x = Math.sin(tt * 1.9) * 0.08; dich.nguc.y = Math.sin(tt * 0.6) * 0.12;
      } else if (L === 'cuoi') {
        const g = Math.max(0, Math.sin(tt * 0.9)); dich.nguc.x -= 0.22 * g + Math.sin(tt * 15) * 0.04 * g; dich.dau.x -= 0.3 * g;
        dich.vaiT.x = -0.4; dich.khuyuT.x = -1.6 * g; dich.vaiP.x = -0.5; dich.khuyuP.x = -1.2;
      } else if (L === 'dan') {
        dich.vaiT.x = -0.75; dich.vaiT.z = 0.55; dich.khuyuT.x = -1.75; dich.khuyuT.y = 0.4;
        dich.vaiP.x = -0.45; dich.vaiP.z = -0.35; dich.khuyuP.x = -1.35 + Math.sin(tt * 9) * 0.22; dich.dau.x = 0.12 + Math.sin(tt * 2.1) * 0.08; dich.dau.z = 0.15;
      } else if (L === 'lau') {
        dich.bung.x += 0.25; dich.vaiP.x = -0.95 + Math.cos(tt * 3.2) * 0.12; dich.vaiP.z = -0.15 + Math.sin(tt * 3.2) * 0.3; dich.khuyuP.x = -0.55; dich.dau.x = 0.25; dich.vaiT.x = -0.3; dich.khuyuT.x = -0.4;
      } else if (L === 'khay') {
        dich.vaiT.x = dich.vaiP.x = -0.75; dich.khuyuT.x = dich.khuyuP.x = -0.85; dich.vaiT.z = 0.12; dich.vaiP.z = -0.12;
      } else if (L === 'ren') { // vung búa rèn: nhấc chậm, đập nhanh (1,4 nhát/giây)
        const c = (tt * 1.4) % 1, len = c < 0.7 ? c / 0.7 : 1 - (c - 0.7) / 0.3;
        dich.vaiP.x = -0.5 - 1.9 * len; dich.khuyuP.x = -0.4 - 0.9 * len; dich.vaiP.z = -0.15; dich.bung.x += 0.2; dich.dau.x = 0.3;
        dich.vaiT.x = -0.7; dich.khuyuT.x = -0.9; dich.duiT.x = -0.25; dich.goiP.x = 0.15;
      } else if (L === 'keo') { // kéo dây gàu giếng: hai tay luân phiên
        const k = Math.sin(tt * 2.4);
        dich.vaiT.x = -1.3 - 0.5 * k; dich.khuyuT.x = -0.6 + 0.4 * k; dich.vaiP.x = -1.3 + 0.5 * k; dich.khuyuP.x = -0.6 - 0.4 * k; dich.bung.x += 0.25; dich.dau.x = 0.3;
      } else if (L === 'say') {
        dich.dau.z = Math.sin(tt * 1.3) * 0.28; dich.dau.x = 0.2; dich.nguc.z = Math.sin(tt * 0.9) * 0.14; dich.bung.x += 0.12;
        dich.vaiP.x = -0.6; dich.khuyuP.x = -1.2; dich.vaiT.z = 0.25 + Math.sin(tt * 1.1) * 0.15;
      }
      // động tác theo thời gian
      if (viec) {
        tViec += dt; const u = tViec / DT[viec];
        if (u >= 1) viec = null;
        else if (viec === 'nem') {
          const nap = Math.min(u / 0.35, 1), vung = Math.max(0, Math.min((u - 0.35) / 0.15, 1)), ve = Math.max(0, (u - 0.6) / 0.4);
          const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0, -2.7, nap), -0.9, vung) * (1 - ve);
          dich.vaiP.x = x; dich.vaiP.z = -0.3 * (1 - ve); dich.khuyuP.x = THREE.MathUtils.lerp(-1.6 * nap, 0, vung) * (1 - ve);
          dich.nguc.y = (0.5 * nap - 0.9 * vung) * (1 - ve); dich.vaiT.x = -0.6 * nap * (1 - ve); dich.duiT.x = -0.35 * (1 - ve); dich.goiP.x = 0.25 * (1 - ve);
          if (u > 0.45 && !api.daTha) { api.daTha = true; api.khiTha?.(); }
        } else if (viec === 'chao') {
          const len = Math.min(u / 0.12, 1) * Math.min((1 - u) / 0.12, 1);
          dich.vaiP.z = -2.55 * len; dich.vaiP.x = -0.2 * len; dich.khuyuP.z = (-0.35 + Math.sin(tViec * 11) * 0.5) * len; dich.dau.z = 0.12 * len; dich.dau.y = -0.2 * len;
        } else if (viec === 'mua') {
          const b = tViec * 7.5, len = Math.min(u / 0.08, 1) * Math.min((1 - u) / 0.08, 1);
          dich.vaiT.z = (1.6 + Math.sin(b) * 0.9) * len; dich.vaiP.z = (-1.6 + Math.sin(b) * 0.9) * len; dich.khuyuT.x = -1.2 * len; dich.khuyuP.x = -1.2 * len;
          dich.hong.y = Math.sin(b / 2) * 0.5 * len; dich.nguc.z = Math.sin(b) * 0.18 * len; dich.dau.z = -Math.sin(b) * 0.2 * len;
          dich.duiT.x = Math.min(0, Math.sin(b)) * 0.7 * len; dich.goiT.x = Math.max(0, -Math.sin(b)) * 1.0 * len;
          dich.duiP.x = Math.min(0, -Math.sin(b)) * 0.7 * len; dich.goiP.x = Math.max(0, Math.sin(b)) * 1.0 * len;
          hongYDich = 0.95 - Math.abs(Math.sin(b)) * 0.06;
        } else if (viec === 'da') {
          const nap = Math.min(u / 0.3, 1), da = Math.max(0, Math.min((u - 0.3) / 0.12, 1)), ve = Math.max(0, (u - 0.55) / 0.45);
          dich.duiP.x = THREE.MathUtils.lerp(0.5 * nap, -1.5, da) * (1 - ve); dich.goiP.x = THREE.MathUtils.lerp(1.4 * nap, 0.05, da) * (1 - ve);
          dich.bung.x = -0.25 * da * (1 - ve); dich.vaiT.z = 0.6 * (1 - ve); dich.vaiP.z = -0.6 * (1 - ve); dich.goiT.x = 0.2 * (1 - ve);
          if (u > 0.36 && !api.daTha) { api.daTha = true; api.khiTha?.(); }
        } else if (viec === 'cungLy') {
          const len = Math.sin(Math.min(u, 1) * Math.PI);
          dich.vaiP.x = -0.6 - 1.5 * len; dich.khuyuP.x = -1.0 + 0.7 * len; dich.vaiP.z = -0.1; dich.dau.x = -0.15 * len;
        } else if (viec === 'nga') {
          const nga = Math.min(u / 0.12, 1), day = Math.max(0, (u - 0.7) / 0.3);
          nghiengDich = -1.5 * nga * (1 - day);
          dich.vaiT.z = 1.2 * nga * (1 - day); dich.vaiP.z = -1.2 * nga * (1 - day); dich.duiT.x = -0.4 * (1 - day) * nga; dich.goiT.x = 0.8 * (1 - day) * nga;
        }
      }
      const a = 1 - Math.exp(-dt * (viec === 'nem' || viec === 'da' ? 30 : 14));
      for (const n of TEN) { const r = k[n].rotation, d = dich[n]; r.x += (d.x - r.x) * a; r.y += (d.y - r.y) * a; r.z += (d.z - r.z) * a; }
      hongY += (hongYDich - hongY) * a; k.hong.position.y = hongY;
      nghieng += (nghiengDich - nghieng) * (1 - Math.exp(-dt * (nghiengDich < nghieng ? 9 : 4)));
      xoay.rotation.x = nghieng; xoay.position.y = -Math.sin(-nghieng) * 0.08;
    },
  };
  return api;
}
