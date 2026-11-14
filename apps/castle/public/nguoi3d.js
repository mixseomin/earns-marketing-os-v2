// NGƯỜI CHƠI có xương + động tác thật: người mẫu Quaternius "Universal Animation Library" (CC0 1.0) đã lọc 24 động tác
// (scripts/tai-nhan-vat.mjs → tai-san/nguoi.glb, nén meshopt). Cùng cách gọi với taoNguoi() của nhanvat.js (goc, lam, viec,
// viTriTay, cam, capNhat) nên main.js / ns.js đổi qua lại được; người dân vẫn dùng khung xương vẽ hàng loạt (nhẹ).
// Trạng thái → động tác (pha trộn 0,2 s): đứng / đi / chạy / nước rút theo tốc độ (nhịp chân theo tốc độ, không trượt chân),
// trên không, ngồi xổm, leo (ClimbUp lặp theo tốc độ leo), đu qua mép, bơi, ngồi yên ngựa / ghế xe; việc một lần: ném, đá, chào, múa, ngã.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const CAO = 1.78; // chiều cao người (m)
// tốc độ gốc của động tác di chuyển (m/s) để nhịp chân khớp tốc độ thật
const TOC_GOC = { di: 1.45, chay: 3.6, nuocRut: 6.2, ngoiDi: 1.1, boi: 1.6 };
// việc một lần: [động tác, thời điểm "thả" (ném đá / chạm chân) theo tỉ lệ, lặp trong bao lâu (giây, cho múa / chào)]
const VIEC = { nem: ['nem', 0.42], da: ['da', 0.38], chao: ['chao', 0.5, 2.2], mua: ['mua', 0, 3.2], nga: ['nga', 0, 3.2], cungLy: ['gat', 0.5] };

let MAU = null;
export async function napNguoi3d(url = './tai-san/nguoi.glb') {
  if (MAU) return MAU;
  const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
  const g = await ld.loadAsync(url);
  const goc = g.scene, hop = new THREE.Box3().setFromObject(goc), co = CAO / (hop.max.y - hop.min.y);
  const clips = Object.fromEntries(g.animations.map((a) => [a.name, a]));
  // độ cao xương chậu khi ngồi / bơi (đo trên khung đầu của động tác) để đặt người đúng lên yên ngựa / mặt nước
  const doChau = (ten) => {
    const c = SkeletonUtils.clone(goc), m = new THREE.AnimationMixer(c); m.clipAction(clips[ten]).play(); m.update(0.01);
    c.updateMatrixWorld(true); let y = 0; c.traverse((o) => { if (o.isBone && o.name === 'pelvis') y = o.getWorldPosition(new THREE.Vector3()).y; }); return y * co;
  };
  MAU = { goc, clips, co, chau: { dung: doChau('dung'), ngoiGhe: doChau('ngoiGhe'), laiXe: doChau('laiXe'), boi: doChau('boi') } };
  return MAU;
}

export function taoNguoi3d(o = {}) {
  if (!MAU) throw new Error('chưa napNguoi3d()');
  const goc = new THREE.Group();
  const than = SkeletonUtils.clone(MAU.goc); than.scale.setScalar(MAU.co); goc.add(than);
  let xuong = {};
  than.traverse((x) => {
    if (x.isBone) xuong[x.name] = x;
    if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; if (o.mau) { x.material = x.material.clone(); x.material.color = new THREE.Color(o.mau); } }
  });
  const mixer = new THREE.AnimationMixer(than), hd = {};
  for (const [ten, clip] of Object.entries(MAU.clips)) hd[ten] = mixer.clipAction(clip);
  for (const t of ['nem', 'da', 'len1m', 'len2m', 'vuot', 'nga', 'gat']) { hd[t].setLoop(THREE.LoopOnce, 1); hd[t].clampWhenFinished = true; }
  let dangChay = null, viec = null, tViec = 0, daTha = false, khiTha = null;
  function choi(ten, mo = 0.2, tocDo = 1) {
    const a = hd[ten]; a.timeScale = tocDo;
    if (dangChay === a) return;
    a.reset().setEffectiveWeight(1).play();
    if (dangChay) a.crossFadeFrom(dangChay, mo, false);
    dangChay = a;
  }
  const api = {
    goc, khop: xuong, la3d: true,
    get viec() { return viec; },
    // việc một lần (ném / đá / chào / múa / ngã / cụng ly); 'dung' = thôi việc đang làm
    lam(ten, tha) { if (viec === 'nga') return false; if (!VIEC[ten]) { viec = null; return false; } viec = ten; tViec = 0; daTha = false; khiTha = tha || null; const [c, , lap] = VIEC[ten]; if (!lap) hd[c].reset(); choi(c, 0.12); return true; },
    viTriTay(out) { return (xuong.hand_r || than).getWorldPosition(out); },
    cam(vat, noi = 'tayP') { const b = xuong[noi === 'tayT' ? 'hand_l' : 'hand_r'] || than; vat.scale.multiplyScalar(1 / MAU.co); b.add(vat); return vat; },
    // độ cao xương chậu trên mặt đất theo tư thế (đặt lên yên / ghế / mặt nước)
    chau: (tuThe) => (tuThe === 'cuoi' ? MAU.chau.ngoiGhe : tuThe === 'lai' ? MAU.chau.laiXe : tuThe === 'boi' ? MAU.chau.boi : MAU.chau.dung),
    capNhat(dt, st = {}) {
      if (!goc.visible) return;
      const v = st.toc || 0;
      if (viec) {
        const [c, mocTha, lap] = VIEC[viec], dai = lap || hd[c].getClip().duration; tViec += dt;
        if (!daTha && mocTha && tViec >= dai * mocTha) { daTha = true; khiTha?.(); }
        if (tViec >= dai || (lap && v > 0.3)) viec = null; // bước đi thì thôi múa / chào
      }
      if (!viec) {
        const T = st.tuThe;
        if (T === 'leo') choi('len2m', 0.15, Math.max(0.15, Math.min(1.4, (st.tocLeo ?? 1.2) / 1.2)));
        else if (T === 'qua') choi('len1m', 0.1, 1.3);
        else if (T === 'boi') v > 0.3 ? choi('boi', 0.3, Math.max(0.6, Math.min(1.6, v / TOC_GOC.boi))) : choi('boiDung', 0.3);
        else if (T === 'cuoi') choi('ngoiGhe', 0.25);
        else if (T === 'lai') choi('laiXe', 0.25);
        else if (!st.nen) choi('tren', 0.15);
        else if (st.ngoi) v > 0.3 ? choi('ngoiDi', 0.2, Math.max(0.6, v / TOC_GOC.ngoiDi)) : choi('ngoi', 0.2);
        else if (st.loop === 'uong' || st.loop === 'noi') choi('noi', 0.3);
        else if (v < 0.25) choi('dung', 0.25);
        else if (v < 2.6) choi('di', 0.2, Math.max(0.6, Math.min(1.5, v / TOC_GOC.di)));
        else if (v < 5.4) choi('chay', 0.2, Math.max(0.75, Math.min(1.4, v / TOC_GOC.chay)));
        else choi('nuocRut', 0.2, Math.max(0.8, Math.min(1.5, v / TOC_GOC.nuocRut)));
      }
      mixer.update(dt);
    },
  };
  return api;
}
