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
  // LEO TƯỜNG lặp: bộ CC0 không có động tác leo liên tục → cắt đoạn "với tay bám — kéo người" của ClimbUp_2m (0,30–0,62 s), chạy qua lại
  clips.leoLap = THREE.AnimationUtils.subclip(clips.len2m, 'leoLap', 9, 19, 30);
  MAU = { goc, clips, co, chau: { dung: doChau('dung'), ngoiGhe: doChau('ngoiGhe'), laiXe: doChau('laiXe'), boi: doChau('boi') } };
  return MAU;
}

// ÁO TRUNG CỔ: người mẫu gốc là hình nộm cam (M_Main) + khớp tím (M_Joints) → tô màu theo XƯƠNG chi phối từng đỉnh:
// thân + vai + cánh tay = áo chẽn · cẳng tay = tay áo sẫm · tay / cổ / đầu = da · chậu + đùi = quần · cẳng chân + bàn chân = ủng
// · đỉnh chia đôi chậu / thân (0,35–0,65) = thắt lưng. Giữ nguyên mọi động tác vì chỉ đổi màu, không đổi hình.
export const AO = {
  hiepSi: { ao: 0x7a2420, tay: 0x5a1a16, quan: 0x3a3028, ung: 0x2a1e16, da: 0xe0b48e, toc: 0x3a2618, that: 0x2a1a10 },
  nongDan: { ao: 0x5a6a3a, tay: 0x46542e, quan: 0x6b5a44, ung: 0x3a2a1c, da: 0xd8a47c, toc: 0x2a1a10, that: 0x4a3420 },
  thuongNhan: { ao: 0x2e4a7a, tay: 0x22385e, quan: 0x3a3a40, ung: 0x2a1e16, da: 0xc89670, toc: 0x1a120c, that: 0x6a4a1c },
};
const NHOM_XUONG = [[/^(Head|neck_01)$/, 'da'], [/^(hand_|index|middle|pinky|ring|thumb)/, 'da'], [/^lowerarm_/, 'tay'], [/^(spine_|clavicle_|upperarm_)/, 'ao'],
  [/^(pelvis|thigh_)/, 'quan'], [/^(calf_|foot_|ball_)/, 'ung'], [/^root$/, 'quan']];
function toMauAo(mesh, ao) {
  const g = mesh.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position, bones = mesh.skeleton.bones, c = new THREE.Color();
  const mau = new Float32Array(si.count * 3);
  let yDau = -1e9; for (let i = 0; i < pos.count; i++) yDau = Math.max(yDau, pos.getY(i));
  for (let i = 0; i < si.count; i++) {
    let tot = 0, w0 = -1; const wChau = [];
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > w0) { w0 = w; tot = si.getComponent(i, k); } wChau.push([bones[si.getComponent(i, k)]?.name, w]); }
    const ten = bones[tot]?.name || '';
    let nhom = (NHOM_XUONG.find(([re]) => re.test(ten)) || [, 'ao'])[1];
    const wPel = wChau.filter(([n]) => n === 'pelvis').reduce((s, [, w]) => s + w, 0), wSpi = wChau.filter(([n]) => n === 'spine_01').reduce((s, [, w]) => s + w, 0);
    if (wPel > 0.3 && wSpi > 0.3) nhom = 'that';
    if (nhom === 'da' && ten === 'Head' && pos.getY(i) > yDau - (yDau * 0.045)) nhom = 'toc'; // đỉnh đầu = tóc
    c.set(ao[nhom]); mau.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(mau, 3));
  mesh.geometry = g; mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
}

// LEO TỪNG BÊN (anh 15/11/2026: "bò như ếch không đẹp, phải lên từng bên"): bộ CC0 không có động tác leo tay chân lần lượt
// → lấy tư thế đứng làm nền rồi XOAY XƯƠNG theo trục ngang của người (không cần biết trục riêng từng xương):
// tay trái với cao trong khi tay phải kéo (khuỷu gập), chân phải bước lên cùng lúc tay trái với — rồi đổi bên; người đứng im thì giữ tư thế bám.
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _truc = new THREE.Vector3();
function xoayTheGioi(x, truc, goc) { // xoay xương x quanh trục thế giới `truc` một góc, giữ nguyên phần còn lại của tư thế
  if (!x) return;
  x.parent.getWorldQuaternion(_qp); x.getWorldQuaternion(_qw);
  _q.setFromAxisAngle(truc, goc).multiply(_qw); x.quaternion.copy(_qp.invert().multiply(_q)); x.updateMatrixWorld(true);
}
function tuTheLeo(goc, x, pha) {
  const h = goc.rotation.y; _truc.set(-Math.cos(h), 0, Math.sin(h)); // trục ngang (sang phải người): xoay + = đưa chi ra trước / lên
  goc.updateMatrixWorld(true);
  const s = Math.sin(pha), tL = Math.max(0, s), tR = Math.max(0, -s);
  xoayTheGioi(x.spine_02, _truc, 0.12); xoayTheGioi(x.Head, _truc, -0.35); // ngả vào tường, ngẩng nhìn lên
  for (const [ben, voi, keo] of [['l', tL, tR], ['r', tR, tL]]) {
    xoayTheGioi(x['upperarm_' + ben], _truc, 2.25 + 0.55 * voi - 0.25 * keo);   // tay với cao / hạ khi kéo
    xoayTheGioi(x['lowerarm_' + ben], _truc, 0.25 + 0.9 * keo);                 // khuỷu gập khi kéo người lên
  }
  for (const [ben, len] of [['r', tL], ['l', tR]]) {                           // chân đối diện tay đang với: bước lên bậc
    xoayTheGioi(x['thigh_' + ben], _truc, 0.35 + 0.85 * len);
    xoayTheGioi(x['calf_' + ben], _truc, -(0.35 + 1.0 * len));
  }
}

export function taoNguoi3d(o = {}) {
  if (!MAU) throw new Error('chưa napNguoi3d()');
  const goc = new THREE.Group();
  const than = SkeletonUtils.clone(MAU.goc); than.scale.setScalar(MAU.co); goc.add(than);
  let xuong = {};
  than.traverse((x) => {
    if (x.isBone) xuong[x.name] = x;
    if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; if (x.isSkinnedMesh) toMauAo(x, AO[o.ao || 'hiepSi'] || AO.hiepSi); }
  });
  const mixer = new THREE.AnimationMixer(than), hd = {};
  for (const [ten, clip] of Object.entries(MAU.clips)) hd[ten] = mixer.clipAction(clip);
  for (const t of ['nem', 'da', 'len1m', 'len2m', 'vuot', 'nga', 'gat']) { hd[t].setLoop(THREE.LoopOnce, 1); hd[t].clampWhenFinished = true; }
  hd.leoLap.setLoop(THREE.LoopPingPong, Infinity);
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
        if (T === 'leo') choi('dung', 0.12); // nền đứng, tay chân do tuTheLeo xoay từng bên (sau mixer)
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
      if (!viec && st.tuThe === 'leo') tuTheLeo(goc, xuong, (st.phaLeo || 0) * 1.1);
    },
  };
  return api;
}
