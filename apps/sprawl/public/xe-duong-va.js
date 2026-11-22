// Sprawl · 2f nhịp B: xe trên phố thành vật thật quanh người chơi.
// Xe trên phố vẫn do song.js lái theo làn (đèn, giữ khoảng cách, dừng trước vật cản). Ở đây chỉ gắn thân Rapier cho ~24 xe gần người chơi nhất:
//   - đang chạy trên làn: thân kinematic bám đúng chỗ song.js đặt → xe của người chơi, người đi bộ, xác xe đâm vào là chạm thật, không xuyên;
//   - bị đâm mạnh (chênh tốc độ > 4 m/s với một vật động: xe người chơi hoặc xác xe khác): rời làn, thành thân động 1,2 tấn, văng / lật theo vật lý;
//   - xác xe nằm quá 60 s và ở xa người chơi > 90 m (khuất sau lưng) thì về lại làn, chạy tiếp.
// tra-repo-ok: chỉ là mã dán keo giữa song.js và Rapier (thân kinematic / dynamic có sẵn của Rapier), không có thư viện nào làm phần nối này.
import * as THREE from 'three';

const SO = 24, BAN_KINH = 70, CHAN_DAM = 4, DO_MAX = 14, NAM = 60, XA_VE = 90;
const NUA = { x: 0.9, y: 0.72, z: 2.2 }; // nửa hộp thân xe (BoxGeometry 1,8 × 1,45 × 4,4 của song.js), gốc thân ở mặt đường

export function taoXeDuongVa({ RAPIER, world, gt }) {
  const LEN = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
  const hop = () => RAPIER.ColliderDesc.cuboid(NUA.x, NUA.y, NUA.z).setTranslation(0, NUA.y, 0).setFriction(0.6);
  const taoO = () => { const than = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -500, 0));
    return { than, va: world.createCollider(hop(), than), c: null }; };
  const kho = Array.from({ length: SO }, taoO), theoVa = new Map(); // handle collider → ô kho (để biết vật đâm vào là xe trên phố)
  for (const o of kho) theoVa.set(o.va.handle, o);
  const xac = []; // { c, than, va, t }
  let nhip = 0;

  const tuThe = (c, q) => q.setFromAxisAngle(LEN, Math.atan2(c.dx, c.dz));
  function cat(o) { o.c = null; o.than.setTranslation({ x: 0, y: -500, z: 0 }, true); }

  function chon(tam) { // 10 lần / giây: SO xe gần nhất trên làn
    const ds = []; gt.xeQuanh(tam.x, tam.z, BAN_KINH, (c) => { if (!c.ngoai && c.dx !== undefined) ds.push([(c.x - tam.x) ** 2 + (c.z - tam.z) ** 2, c]); });
    ds.sort((a, b) => a[0] - b[0]); const muon = new Set(ds.slice(0, SO).map((d) => d[1]));
    for (const o of kho) if (o.c && !muon.has(o.c)) cat(o); else if (o.c) muon.delete(o.c);
    for (const o of kho) { if (o.c) continue; const c = muon.values().next().value; if (!c) break; muon.delete(c); o.c = c;
      o.than.setTranslation({ x: c.x, y: c.y, z: c.z }, true); o.than.setRotation(tuThe(c, _q), true); } }

  function dam(o) { // xe trên làn → xác xe động, mang vận tốc đang chạy (c.dx, c.dz đã là hướng chạy thật, c.v là tốc độ)
    const c = o.c, than = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(c.x, c.y, c.z).setRotation(tuThe(c, _q))
      .setLinvel(c.dx * c.v, 0, c.dz * c.v).setCcdEnabled(true).setAngularDamping(0.4).setLinearDamping(0.1));
    const va = world.createCollider(hop().setMass(1200), than);
    c.ngoai = than; c.v = 0; xac.push({ c, than, va, t: 0 }); cat(o);
    if (xac.length > DO_MAX) ve(xac[0]); } // quá nhiều xác: xác cũ nhất về làn trước

  function ve(x) { world.removeRigidBody(x.than); x.c.ngoai = null; xac.splice(xac.indexOf(x), 1); }

  // vận tốc của một collider (thân kinematic của xe trên làn tính từ song.js)
  const vanToc = (va) => { const o = theoVa.get(va.handle); if (o?.c) return { x: o.c.dx * o.c.v, y: 0, z: o.c.dz * o.c.v };
    const b = va.parent(); return b ? b.linvel() : { x: 0, y: 0, z: 0 }; };

  return {
    // mỗi bước vật lý, trước world.step · tam = chỗ người chơi (null: không ở chế độ đi bộ / lái)
    buoc(tam, dt) {
      if (!tam) { for (const o of kho) if (o.c) cat(o); return; }
      if (nhip++ % 6 === 0) chon(tam);
      for (const o of kho) { if (!o.c) continue; const c = o.c; // song.js cập nhật chỗ xe 30 lần / giây; thân bám theo bằng next-kinematic cho vật đâm vào thấy vận tốc
        o.than.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z }); o.than.setNextKinematicRotation(tuThe(c, _q)); }
      // va chạm của bước trước: xe trên làn chạm vật động với chênh tốc độ đủ lớn → bị hất khỏi làn
      for (const o of kho) { if (!o.c) continue; let bi = false;
        world.contactPairsWith(o.va, (k) => { if (bi) return; const b = k.parent(); if (!b || !b.isDynamic()) return;
          let cham = false; world.contactPair(o.va, k, (m) => { if (m.numContacts() > 0) cham = true; }); if (!cham) return;
          const a = vanToc(o.va), v = b.linvel(), chenh = Math.hypot(v.x - a.x, v.y - a.y, v.z - a.z);
          if (chenh > CHAN_DAM && (!xac.some((x) => x.than === b) || xac.length < DO_MAX)) bi = true; });
        if (bi) dam(o); }
      for (const x of [...xac]) { x.t += dt; const p = x.than.translation();
        if (p.y < -300 || (x.t > NAM && Math.hypot(p.x - tam.x, p.z - tam.z) > XA_VE)) ve(x); }
    },
    khung() { // mỗi khung hình: vẽ xác xe theo thân vật lý
      for (const x of xac) { const p = x.than.translation(), r = x.than.rotation(); gt.datHinh(x.c, _p.set(p.x, p.y, p.z), _q.set(r.x, r.y, r.z, r.w)); } },
    get tk() { return { va: kho.filter((o) => o.c).length, xac: xac.length }; },
    xac, kho,
  };
}
