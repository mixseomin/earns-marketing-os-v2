// Sprawl · xe lái được (ô phố mẫu, bước 1): thân xe là vật thể động của Rapier, bốn bánh dò tia xuống đường có giảm xóc (DynamicRayCastVehicleController),
// nối vào móc "ngoai" của bộ đi bộ dùng chung (chung/dibo.js): E lên / xuống, W S ga và lùi, A D đánh lái, Space phanh.
// tra-repo-ok: bộ điều khiển xe là của Rapier (đã tra ở ROADMAP mục ô phố mẫu); tệp này chỉ dựng hình xe + nối phím. Hình xe dựng bằng hộp gộp như xe đường ở song.js,
// đổi sang mô hình CC0 sau thì chỉ thay hàm dungHinh (giữ bốn nhóm bánh rời).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BANH_R = 0.32, NGHI = 0.3, NOI_Y = -0.05; // bán kính bánh, độ dài nghỉ của giảm xóc, cao độ điểm treo so với tâm thân
const BANH = [[0.8, 1.35], [-0.8, 1.35], [0.8, -1.35], [-0.8, -1.35]]; // x (trái +), z (mũi +) — hai bánh đầu là bánh lái
const GHE = { x: -0.36, y: -0.12, z: -0.1 }; // tay lái bên phải như xe Nhật
const TOC_MAX = 24, TOC_NHANH = 40, TOC_LUI = 7, LUC = 1500, PHANH = 45; // 24 m/s ≈ 86 km/h; giữ Shift: 40 m/s ≈ 144 km/h (anh chê chậm 23/11/2026) · m/s, N mỗi bánh, xung phanh mỗi bánh mỗi bước

function hop(w, h, d, x, y, z, mau) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z), c = new THREE.Color(mau), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function dungHinh() {
  const goc = new THREE.Group(), VANG = '#e9b21c', DEN = '#15181b';
  const than = new THREE.Mesh(mergeGeometries([
    hop(1.74, 0.5, 4.3, 0, 0, 0, VANG), hop(1.62, 0.07, 2.1, 0, 0.9, -0.2, VANG), // thân, nóc
    hop(0.07, 0.62, 0.07, 0.76, 0.56, 0.8, VANG), hop(0.07, 0.62, 0.07, -0.76, 0.56, 0.8, VANG), hop(0.07, 0.62, 0.07, 0.76, 0.56, -1.2, VANG), hop(0.07, 0.62, 0.07, -0.76, 0.56, -1.2, VANG), // bốn trụ
    hop(1.78, 0.16, 0.14, 0, -0.2, 2.16, DEN), hop(1.78, 0.16, 0.14, 0, -0.2, -2.16, DEN), // cản trước, sau
    hop(0.34, 0.1, 0.05, 0.6, 0.1, 2.16, '#fff6d8'), hop(0.34, 0.1, 0.05, -0.6, 0.1, 2.16, '#fff6d8'), hop(0.34, 0.1, 0.05, 0.6, 0.1, -2.16, '#c8201a'), hop(0.34, 0.1, 0.05, -0.6, 0.1, -2.16, '#c8201a'), // đèn
    hop(0.42, 0.14, 0.16, 0, 1.0, -0.2, '#f4f1e6'), // hộp đèn nóc
    hop(1.5, 0.08, 0.5, 0, -0.16, GHE.z - 0.05, DEN), hop(1.5, 0.5, 0.1, 0, 0.1, GHE.z - 0.42, DEN), hop(0.04, 0.04, 0.3, GHE.x, 0.42, 0.62, DEN), hop(0.34, 0.34, 0.04, GHE.x, 0.42, 0.46, DEN), // ghế, cột lái, vô lăng
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 }));
  const kinh = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.6, 2.06).translate(0, 0.56, -0.2), new THREE.MeshStandardMaterial({ color: '#0d1a22', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.32, depthWrite: false }));
  goc.add(than, kinh);
  const gBanh = mergeGeometries([new THREE.CylinderGeometry(BANH_R, BANH_R, 0.24, 20).rotateZ(Math.PI / 2), new THREE.BoxGeometry(0.26, 0.36, 0.08), new THREE.BoxGeometry(0.26, 0.08, 0.36)].map((g, i) => {
    const c = new THREE.Color(i ? '#b9bec2' : '#111315'), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) a.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed(); }));
  const mBanh = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const banh = BANH.map(([x, z]) => { const tru = new THREE.Group(), quay = new THREE.Mesh(gBanh, mBanh); tru.position.set(x, NOI_Y - NGHI, z); tru.add(quay); goc.add(tru); return { tru, quay }; });
  return { goc, banh };
}

export function taoXe({ RAPIER, world, scene, toi, layDi, datTai, bao = () => {} }) {
  const { goc, banh } = dungHinh(); goc.visible = false; scene.add(goc);
  // thân: 1.200 kg, trọng tâm hạ thấp 0,35 m dưới tâm hộp để vào cua không lật
  const than = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, -400, 0).setCcdEnabled(true).setAngularDamping(0.6)
    .setAdditionalMassProperties(1100, { x: 0, y: -0.35, z: 0 }, { x: 1730, y: 1970, z: 600 }, { x: 0, y: 0, z: 0, w: 1 }));
  const va = world.createCollider(RAPIER.ColliderDesc.cuboid(0.87, 0.26, 2.15).setMass(100).setFriction(0.4), than);
  const dk = world.createVehicleController(than);
  dk.indexUpAxis = 1; dk.setIndexForwardAxis = 2; // tên lạ của Rapier: đây là thuộc tính gán, không phải hàm
  for (const [i, [x, z]] of BANH.entries()) {
    dk.addWheel({ x, y: NOI_Y, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, NGHI, BANH_R);
    dk.setWheelSuspensionStiffness(i, 32); dk.setWheelSuspensionCompression(i, 3.4); dk.setWheelSuspensionRelaxation(i, 5.6);
    dk.setWheelMaxSuspensionTravel(i, 0.25); dk.setWheelMaxSuspensionForce(i, 60000); dk.setWheelFrictionSlip(i, 1.6);
  }
  const LOC = RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS; // tia bánh không bắt vào người
  let dangLai = false, daDat = false, lai = 0, vao = { fx: 0, fz: 0, phanh: false }, lat = 0, daBao = false;
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  const huong = () => { const r = than.rotation(); _v.set(0, 0, 1).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)); return Math.atan2(_v.x, _v.z); };
  const ngua = () => { const r = than.rotation(); return _v.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).y; };
  const diem = (x, y, z) => { const p = than.translation(), r = than.rotation(); _v.set(x, y, z).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)); return { x: p.x + _v.x, y: p.y + _v.y, z: p.z + _v.z }; };
  function dat(x, y, z, h) { // đặt xe đứng yên, bánh chạm đất, mũi theo hướng h
    than.setTranslation({ x, y: y + 0.75, z }, true); than.setRotation({ x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }, true);
    than.setLinvel({ x: 0, y: 0, z: 0 }, true); than.setAngvel({ x: 0, y: 0, z: 0 }, true); daDat = true; goc.visible = true; lai = 0; lat = 0;
  }
  const api = {
    than, dk, goc, get dangLai() { return dangLai; }, get toc() { return dk.currentVehicleSpeed(); }, huong, dat,
    gan() { if (!daDat) return false; const p = layDi().viTri(), q = than.translation(); return Math.hypot(p.x - q.x, p.z - q.z) < 3.4 && Math.abs(p.y - q.y) < 3; },
    goiNeuXa(x, y, z, h, luon) { // người vừa đứng xuống: xe ở xa quá 150 m (hoặc chưa có) thì đỗ sẵn bên phải, cách 3 m · luon: gọi xe tới dù gần hay xa (phím E khi xe không ở cạnh)
      const q = than.translation(); if (dangLai || (!luon && daDat && Math.hypot(x - q.x, z - q.z) < 150)) return;
      const cx = x - Math.cos(h) * 3, cz = z + Math.sin(h) * 3, tia = world.castRay(new RAPIER.Ray({ x: cx, y: y + 3, z: cz }, { x: 0, y: -1, z: 0 }), 12, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
      dat(cx, tia ? y + 3 - tia.timeOfImpact : y, cz, h);
    },
    len() { if (dangLai || !api.gan()) return; dangLai = true; layDi().va.setEnabled(false); bao('W S: ga, lùi · A D: lái · Shift: tăng tốc · Space: phanh · E: xuống xe'); },
    xuong() { if (!dangLai) return; dangLai = false; vao = { fx: 0, fz: 0, phanh: false }; const di = layDi(), q = than.translation(), h = huong(); // xuống bên ghế lái (phải); bên đó sát tường thì xuống bên trái
      const ket = world.castRay(new RAPIER.Ray({ x: q.x, y: q.y + 0.5, z: q.z }, { x: -Math.cos(h), y: 0, z: Math.sin(h) }), 2.6, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
      const p = diem(ket ? 1.75 : -1.75, 0.5, GHE.z); di.va.setEnabled(true); di.datCho(p, null, null, h); },
    doi() { if (dangLai) return api.xuong(); // ở đâu cũng lấy được xe: xe không ở cạnh thì gọi tới đỗ sát bên phải rồi lên luôn
      if (!api.gan()) { const di = layDi(), p = di.viTri(), h = di.huongMat?.() ?? huong(); api.goiNeuXa(p.x, p.y - 0.3, p.z, h, true); if (!api.gan()) { const q = than.translation(); di.datCho({ x: q.x + Math.cos(huong()) * 1.75, y: q.y + 0.5, z: q.z - Math.sin(huong()) * 1.75 }, null, null, huong()); } }
      api.len(); },
    lai(dt, tr) { // móc ngoai.buoc của bộ đi bộ: đang lái thì nhận phím, người không tự đi
      if (!dangLai) return false; const di = layDi(); vao = { fx: tr.fx, fz: tr.fz, phanh: !!di.phim.Space, nhanh: !!(di.phim.ShiftLeft || di.phim.ShiftRight) };
      const p = than.translation(); di.than.setTranslation({ x: p.x, y: p.y + 0.6, z: p.z }, true); // thân người bám theo xe: máy quay + nạp ô va chạm lấy chỗ này
      const v = dk.currentVehicleSpeed();
      if (Math.abs(v) > 1.5 && performance.now() - di.lucChuot > 1500) { const muon = huong() - Math.PI, lech = Math.atan2(Math.sin(muon - di.yaw), Math.cos(muon - di.yaw)); di.yaw += lech * (1 - Math.exp(-dt * 2.6)); } // máy quay tự về sau đuôi xe
      return true;
    },
    buoc(dt) { // mỗi bước vật lý, trước world.step — cả khi đỗ (không gọi thì giảm xóc không đỡ thân)
      if (!daDat) return; const v = dk.currentVehicleSpeed(), { fx, fz, phanh, nhanh } = vao, tMax = nhanh ? TOC_NHANH : TOC_MAX;
      let luc = 0, ham = dangLai ? 1.5 : PHANH;
      if (phanh) ham = PHANH * 1.3;
      else if (fz > 0.05) { if (v < -0.6) ham = PHANH; else luc = LUC * (nhanh ? 1.6 : 1) * fz * Math.max(0, 1 - v / tMax); }
      else if (fz < -0.05) { if (v > 0.6) ham = PHANH; else luc = LUC * 0.7 * fz * Math.max(0, 1 + v / TOC_LUI); }
      const laiMuon = -fx * 0.55 / (1 + Math.abs(v) / 9); lai += (laiMuon - lai) * (1 - Math.exp(-dt * 7));
      for (let i = 0; i < 4; i++) { dk.setWheelEngineForce(i, luc); dk.setWheelBrake(i, luc ? 0 : ham); dk.setWheelSteering(i, i < 2 ? lai : 0); }
      dk.updateVehicle(dt, LOC);
      const p = than.translation(); // lật ngửa quá 2 s hoặc rơi khỏi nền: dựng lại tại chỗ
      lat = ngua() < 0.25 ? lat + dt : 0;
      if (lat > 2 || p.y < datTai(p.x, p.z) - 40) dat(p.x, Math.max(p.y, datTai(p.x, p.z)) + (lat > 2 ? 0.4 : 0), p.z, huong());
    },
    khung() { // mỗi khung hình, trước di.khung: đặt hình thân + bánh
      if (!daDat) return; const p = than.translation(), r = than.rotation(); goc.position.set(p.x, p.y, p.z); goc.quaternion.set(r.x, r.y, r.z, r.w);
      for (const [i, b] of banh.entries()) { b.tru.position.y = NOI_Y - (dk.wheelSuspensionLength(i) ?? NGHI); b.tru.rotation.y = dk.wheelSteering(i) || 0; b.quay.rotation.x = dk.wheelRotation(i) || 0; }
      if (!daBao && !dangLai && layDi().dang && api.gan()) { daBao = true; bao('Bấm E để lên xe'); }
    },
    nguoi() { // móc ngoai.khung: người ngồi ghế lái, máy quay lùi xa hơn
      if (!dangLai) return null; const g = diem(GHE.x, GHE.y - toi.chau('lai') + 0.05, GHE.z);
      return { x: g.x, y: g.y, z: g.z, huong: huong(), tuThe: 'lai', chanCam: g.y + 0.25, kcMax: 7.5 };
    },
  };
  return api;
}
