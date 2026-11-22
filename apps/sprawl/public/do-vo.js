// Sprawl · 2f nhịp D + quầy hàng của nhịp F: đồ trên phố bị xe đâm thì vỡ theo vật lý, tuỳ thứ.
// Đồ phố gần người chơi đã có khối va tĩnh (redspires dungVaGan). Ở đây canh va chạm của các xe ĐỘNG (xe người chơi, xác xe văng):
//   - xe chạm một món với tốc độ trước va chạm vượt ngưỡng của món đó → món biến khỏi lớp vẽ instanced + bỏ khối va tĩnh,
//     thay bằng các MẢNH thân động Rapier (khung quầy, cột, mái bạt, thùng hàng, ghế gãy rời, bánh xe đẩy lăn đi, cột đèn đổ),
//     hàng hoá nhỏ (trái cây, đèn lồng) thành hạt rơi nảy rẻ, không tốn thân Rapier;
//   - xe mất một phần tốc độ theo độ nặng của món (đâm sạp chậm lại một chút, đâm cột đèn khựng mạnh) thay vì dừng cứng như đâm tường;
//   - dưới ngưỡng thì chỉ là va chạm thường (xe chậm chạm ghế không vỡ). Bồn cây bê tông + cây vườn không vỡ.
//   - món vỡ nằm đó; quá 75 s và người chơi đi xa > 110 m (khuất) thì dọn mảnh, món về nguyên chỗ.
// tra-repo-ok: mã dán keo giữa lớp instanced của redspires và thân động có sẵn của Rapier; ragdoll / fracture repo đã tra (ROADMAP 2f nhịp C) không có phần nối này.
import * as THREE from 'three';

const MAX_MON = 30, MAX_HAT = 600, NAM = 75, XA_VE = 110, G = -9.8;

export function taoDoVo({ RAPIER, world, goc, loai, layDat, an, hien, boVa, datVa, hoang }) {
  // loai[k] = { bo, ds, manh: [{ geo, va: ['h',hx,hy,hz] | ['t',hh,r,'x'|'z'?] | ['h',…,gócX], o: [x,y,z], kg, mau? }], hat: [{ o, mau, r }], nguong, giam, do? }
  const vat = new Map(), vatLieu = (hex) => { const k = hex || ''; if (!vat.has(k)) vat.set(k, new THREE.MeshLambertMaterial({ vertexColors: true, ...(hex ? { color: hex } : {}) })); return vat.get(k); };
  const mon = []; // { k, i, manh: [{ than, mesh }], t, x, z }
  const daVo = new Map(); // `${k}:${i}` → món
  const vTruoc = new Map(); // thân xe → vận tốc ngay trước bước vật lý vừa rồi
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _o = new THREE.Vector3(), _qr = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
  const TX = new THREE.Vector3(1, 0, 0), QX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), QZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  // hạt: trái cây, đèn lồng — rơi + nảy trên mặt đất, không qua Rapier
  const hatMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshLambertMaterial(), MAX_HAT); hatMesh.count = 0; hatMesh.frustumCulled = false;
  hatMesh.setColorAt(0, _c.set('#fff')); hatMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); goc.add(hatMesh);
  const hat = []; // { p, v, r, t, mau }

  function pha(k, i, v) {
    const L = loai[k], d = L.ds[i], s = d.s || 1, y = layDat(d.x, d.z) + 0.6, sp = Math.hypot(v.x, v.z);
    _q.setFromEuler(_e.set(0, d.h, 0)); _m.compose(_p.set(d.x, y, d.z), _q, _s.setScalar(s)); _s.setScalar(1);
    an(k, i, true); boVa(k, i);
    const m = { k, i, manh: [], t: 0, x: d.x, z: d.z };
    for (const c of L.manh) {
      _o.set(...c.o).applyMatrix4(_m);
      const tung = 0.55 + Math.random() * 0.55, len = 1 + Math.random() * 2.5 + sp * 0.12;
      const b = RAPIER.RigidBodyDesc.dynamic().setTranslation(_o.x, _o.y, _o.z).setRotation(_q).setCcdEnabled(sp > 8).setLinearDamping(0.15).setAngularDamping(0.5)
        .setLinvel(v.x * tung + (Math.random() - 0.5) * 2, len * (c.kg > 50 ? 0.3 : 1), v.z * tung + (Math.random() - 0.5) * 2);
      if (L.do) { const ax = new THREE.Vector3(0, 1, 0).cross(_p.set(v.x, 0, v.z).normalize()).multiplyScalar(1.2 + sp * 0.08); b.setAngvel({ x: ax.x, y: 0, z: ax.z }); } // cột đổ về phía xe đang lao
      else b.setAngvel({ x: (Math.random() - 0.5) * sp * 0.6, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * sp * 0.6 });
      const than = world.createRigidBody(b), va = c.va;
      const cd = va[0] === 'h' ? RAPIER.ColliderDesc.cuboid(va[1] * s, va[2] * s, va[3] * s) : RAPIER.ColliderDesc.cylinder(va[1] * s, va[2] * s);
      if (va[4] === 'x') cd.setRotation(QX); else if (va[4] === 'z') cd.setRotation(QZ); else if (typeof va[4] === 'number') cd.setRotation(_qr.setFromAxisAngle(TX, va[4])); // mái bạt nghiêng
      world.createCollider(cd.setMass(c.kg).setFriction(0.7).setRestitution(0.12), than);
      const mesh = new THREE.Mesh(c.geo, vatLieu(c.mau ? c.mau(i) : null)); mesh.scale.setScalar(s); mesh.frustumCulled = false; goc.add(mesh);
      m.manh.push({ than, mesh });
    }
    for (const h of L.hat || []) { if (hat.length >= MAX_HAT) hat.shift(); _o.set(...h.o).applyMatrix4(_m);
      hat.push({ p: _o.clone(), v: new THREE.Vector3(v.x * (0.4 + Math.random() * 0.7) + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 3.5, v.z * (0.4 + Math.random() * 0.7) + (Math.random() - 0.5) * 3), r: h.r, t: 0, mau: h.mau }); }
    mon.push(m); daVo.set(`${k}:${i}`, m); hien(); hoang?.(d.x, d.z);
    if (mon.length > MAX_MON) ve(mon[0]);
    return L.giam;
  }

  function ve(m) { for (const c of m.manh) { world.removeRigidBody(c.than); goc.remove(c.mesh); } mon.splice(mon.indexOf(m), 1); daVo.delete(`${m.k}:${m.i}`); an(m.k, m.i, false); datVa(m.k, m.i); hien(); }

  return {
    vo: (k, i) => daVo.has(`${k}:${i}`),
    // mỗi bước vật lý, trước world.step · dsXe = [{ than, va }] các xe động · monCua(collider) → [k, i] nếu là khối va của một món phá được
    buoc(dsXe, monCua) {
      for (const x of dsXe) { const v0 = vTruoc.get(x.than); let giam = 0;
        if (v0) world.contactPairsWith(x.va, (o) => { const ki = monCua(o); if (!ki || daVo.has(`${ki[0]}:${ki[1]}`)) return; const L = loai[ki[0]]; if (!L) return;
          let cham = false; world.contactPair(x.va, o, (mf) => { if (mf.numContacts() > 0) cham = true; }); if (!cham) return;
          if (Math.hypot(v0.x, v0.z) > L.nguong) giam = Math.max(giam, pha(ki[0], ki[1], v0)); });
        if (giam > 0) { const k = 1 - giam; x.than.setLinvel({ x: v0.x * k, y: v0.y, z: v0.z * k }, true); } // giữ đà trước va chạm, trừ phần mất vào món vỡ
        vTruoc.set(x.than, x.than.linvel()); }
      for (const b of [...vTruoc.keys()]) if (!dsXe.some((x) => x.than === b)) vTruoc.delete(b);
    },
    khung(dt, tam) {
      for (const m of [...mon]) { m.t += dt;
        for (const c of m.manh) { if (c.than.isSleeping()) continue; const p = c.than.translation(), r = c.than.rotation(); c.mesh.position.set(p.x, p.y, p.z); c.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
        if (m.manh.some((c) => c.than.translation().y < -300) || (m.t > NAM && tam && Math.hypot(m.x - tam.x, m.z - tam.z) > XA_VE)) ve(m); }
      let n = 0;
      for (let j = hat.length - 1; j >= 0; j--) { const h = hat[j]; h.t += dt; if (h.t > 45) { hat.splice(j, 1); continue; } }
      for (const h of hat) { const san = layDat(h.p.x, h.p.z) + 0.6 + h.r;
        if (h.p.y > san + 0.001 || Math.abs(h.v.y) > 0.05) { h.v.y += G * dt; h.p.addScaledVector(h.v, dt);
          if (h.p.y < san) { h.p.y = san; h.v.y = Math.abs(h.v.y) > 0.8 ? -h.v.y * 0.35 : 0; h.v.x *= 0.6; h.v.z *= 0.6; } }
        hatMesh.setMatrixAt(n, _m.compose(h.p, _qr.identity(), _s.setScalar(h.r))); hatMesh.setColorAt(n, _c.set(h.mau)); n++; }
      _s.setScalar(1); hatMesh.count = n; hatMesh.instanceMatrix.needsUpdate = true; if (hatMesh.instanceColor) hatMesh.instanceColor.needsUpdate = true;
    },
    get tk() { return { mon: mon.length, manh: mon.reduce((a, m) => a + m.manh.length, 0), thuc: mon.reduce((a, m) => a + m.manh.filter((c) => !c.than.isSleeping()).length, 0), hat: hat.length }; },
    mon,
  };
}
