// ĐI BỘ dùng chung cho cảnh dựng bằng mã (khuôn game góc nhìn sau lưng: GTA V / Zelda BotW / Assassin's Creed).
// Chuột KHÔNG khoá: giữ + kéo xoay camera · Z X xoay camera · WASD đi theo camera (gia tốc / hãm, người quay có trần tốc độ, quay đầu xoay tại chỗ)
// · Shift chạy · C giữ ngồi · Space nhảy (coyote + đệm, nhả sớm nhảy thấp) · Space sát tường: thấp ≤ 2 m trèo qua, cao thì bám leo
// · đang leo: W S lên xuống, A D ngang, tới mép tự đu lên, tới mái hiên tìm mặt trên đu lên, Space bật ra · V đổi góc nhìn sau lưng / mắt.
// Camera tự về sau lưng khi đi bằng phím, lùi vào khi vướng tường. Va chạm: bộ điều khiển nhân vật Rapier.
// (main.js của Lâu đài dung nham còn bản riêng có bơi + ngựa + xe; chuyển sang dùng mô-đun này là việc tiếp theo.)
import * as THREE from 'three';

export function taoDiBo({ RAPIER, world, camera, dom, toi, phim = {}, khiDoi = () => {} }) {
  const NGUOI_R = 0.35, NGUOI_H = 0.55, MAT = 1.62;
  const than = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -500, 0));
  const va = world.createCollider(RAPIER.ColliderDesc.capsule(NGUOI_H, NGUOI_R), than);
  const dk = world.createCharacterController(0.03);
  dk.enableAutostep(0.45, 0.25, false); dk.enableSnapToGround(0.4); dk.setMaxSlopeClimbAngle(1.05); dk.setMinSlopeSlideAngle(1.1); dk.setApplyImpulsesToDynamicBodies(true);
  const TINH = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;
  const VD = { di: 4.2, chay: 7.5, ngoi: 1.6, tang: 28, ham: 36, tangKhong: 7, quay: 12.5, nhay: 5.4, g: 18, gRoi: 26, coyote: 0.12, dem: 0.12 };
  let dang = false, tt = 'dat', yaw = 0, pitch = -0.12, huong = 0, muon = 0, vx = 0, vz = 0, vy = 0, nen = false, roiMep = 1, demNhay = 0, chamLeo = 0;
  let toc = 0, tocLeo = 0, phaLeo = 0, lucChuot = -1e9, gocNhin = 3, camY = null;
  const leoN = { x: 0, z: 1 }, qua = { t: 0, dai: 0.5, a: null, b: null, c: null };
  const tiaN = (p, dy, dx, dz, dai) => (dx || dz) && world.castRayAndGetNormal(new RAPIER.Ray({ x: p.x, y: p.y + dy, z: p.z }, { x: dx, y: 0, z: dz }), dai, true, TINH, undefined, va);
  const matTren = (x, yTu, z, sau) => { const h = world.castRay(new RAPIER.Ray({ x, y: yTu, z }, { x: 0, y: -1, z: 0 }), sau, true, TINH, undefined, va); return h ? yTu - h.timeOfImpact : null; };
  const ease = (t) => t * t * (3 - 2 * t);
  function batDauQua(p, fx, fz, top) {
    qua.t = 0; qua.a = { x: p.x, y: p.y, z: p.z }; qua.b = { x: p.x + fx * 0.1, y: top + 0.96, z: p.z + fz * 0.1 }; qua.c = { x: p.x + fx * 0.8, y: top + 0.96, z: p.z + fz * 0.8 };
    qua.dai = Math.max(0.35, Math.min(0.95, (top + 0.96 - p.y) * 0.32)); tt = 'qua'; vy = 0; vx = vz = 0; huong = muon = Math.atan2(fx, fz);
  }
  function thuBam(p, fx, fz) {
    const h = tiaN(p, 0.3, fx, fz, 0.9); if (!h || h.timeOfImpact < 0.02 || Math.abs(h.normal.y) > 0.35) return false;
    let nx = h.normal.x, nz = h.normal.z; const l = Math.hypot(nx, nz); if (l < 0.5) return false; nx /= l; nz /= l;
    if (!tiaN(p, 0.85, -nx, -nz, 1.0)) { const top = matTren(p.x - nx * 0.75, p.y + 2.2, p.z - nz * 0.75, 2.6), chan = p.y - 0.9; if (top != null && top - chan < 2.0 && top - chan > 0.2) { batDauQua(p, -nx, -nz, top); return true; } }
    leoN.x = nx; leoN.z = nz; tt = 'leo'; vy = 0; vx = vz = 0; huong = muon = Math.atan2(-nx, -nz); return true;
  }
  // chuột: giữ + kéo xoay camera (không khoá chuột)
  const keo = { nut: -1, x: 0, y: 0, di: 0 };
  dom.addEventListener('contextmenu', (e) => { if (dang) e.preventDefault(); });
  dom.addEventListener('pointerdown', (e) => { if (!dang || e.pointerType === 'touch') return; keo.nut = e.button; keo.x = e.clientX; keo.y = e.clientY; keo.di = 0; dom.setPointerCapture?.(e.pointerId); });
  dom.addEventListener('pointermove', (e) => { if (keo.nut < 0 || !dang) return; const dx = e.clientX - keo.x, dy = e.clientY - keo.y; keo.x = e.clientX; keo.y = e.clientY; keo.di += Math.abs(dx) + Math.abs(dy); if (keo.di < 4) return; yaw -= dx * 0.005; pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * 0.005)); lucChuot = performance.now(); });
  addEventListener('pointerup', () => { keo.nut = -1; });
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('textarea, input')) return; phim[e.code] = true; if (!dang || e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); demNhay = VD.dem; }
    if (e.code === 'KeyV') { gocNhin = gocNhin === 3 ? 1 : 3; toi.goc.visible = gocNhin === 3; }
  });
  addEventListener('keyup', (e) => { phim[e.code] = false; if (e.code === 'Space' && vy > 0) vy *= 0.5; });

  function buoc(dt) { // bước vật lý cố định (1/60 s)
    if (!dang) return;
    let fz = (phim.KeyW || phim.ArrowUp ? 1 : 0) - (phim.KeyS || phim.ArrowDown ? 1 : 0), fx = (phim.KeyD || phim.ArrowRight ? 1 : 0) - (phim.KeyA || phim.ArrowLeft ? 1 : 0);
    const l0 = Math.hypot(fx, fz); if (l0 > 1) { fx /= l0; fz /= l0; }
    const zx = (phim.KeyZ ? 1 : 0) - (phim.KeyX ? 1 : 0); if (zx) { yaw += zx * 2.4 * dt; lucChuot = performance.now(); }
    demNhay = Math.max(0, demNhay - dt); chamLeo = Math.max(0, chamLeo - dt);
    const p = than.translation();
    if (tt === 'qua') {
      qua.t += dt / qua.dai; const u = Math.min(qua.t, 1), k1 = ease(Math.min(u / 0.65, 1)), k2 = ease(Math.max(0, (u - 0.65) / 0.35));
      const A = k2 > 0 ? qua.b : qua.a, B = k2 > 0 ? qua.c : qua.b, k = k2 > 0 ? k2 : k1;
      than.setNextKinematicTranslation({ x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k, z: A.z + (B.z - A.z) * k }); toc = 0; nen = true; if (u >= 1) { tt = 'dat'; vy = -1; } return;
    }
    if (tt === 'leo') {
      const h = tiaN(p, 0.3, -leoN.x, -leoN.z, 1.1);
      if (!h) { tt = 'dat'; chamLeo = 0.3; return; }
      { const l = Math.hypot(h.normal.x, h.normal.z); if (Math.abs(h.normal.y) < 0.5 && l > 0.5) { leoN.x = h.normal.x / l; leoN.z = h.normal.z / l; } }
      huong = muon = Math.atan2(-leoN.x, -leoN.z);
      const dau = tiaN(p, 0.85, -leoN.x, -leoN.z, 1.1);
      if (!dau && fz > 0) { const top = matTren(p.x - leoN.x * 0.75, p.y + 1.9, p.z - leoN.z * 0.75, 2.4); if (top != null) { batDauQua(p, -leoN.x, -leoN.z, top); return; } }
      if (demNhay > 0) { demNhay = 0; tt = 'dat'; chamLeo = 0.45; vy = 4.5; vx = leoN.x * 3.2; vz = leoN.z * 3.2; return; }
      const len = fz * 1.7, ngang = fx * 1.5, rx = leoN.z, rz = -leoN.x, hut = (h.timeOfImpact - 0.42) * Math.min(1, dt * 10);
      dk.computeColliderMovement(va, { x: rx * ngang * dt - leoN.x * hut, y: len * dt, z: rz * ngang * dt - leoN.z * hut });
      const m = dk.computedMovement();
      if (fz > 0 && m.y < len * dt * 0.3) { const top = matTren(p.x - leoN.x * 1.1, p.y + 3.2, p.z - leoN.z * 1.1, 3.6); if (top != null && top > p.y - 0.6) { batDauQua(p, -leoN.x, -leoN.z, top); qua.c.x = p.x - leoN.x * 1.3; qua.c.z = p.z - leoN.z * 1.3; qua.b.x = p.x + leoN.x * 0.35; qua.b.z = p.z + leoN.z * 0.35; return; } }
      than.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
      tocLeo += (Math.hypot(m.x, m.y, m.z) / dt - tocLeo) * 0.3; toc = 0; nen = true;
      if (fz < 0 && dk.computedGrounded()) { tt = 'dat'; chamLeo = 0.4; }
      return;
    }
    const sx = Math.sin(yaw), cz = Math.cos(yaw);
    let wx = -sx * fz + cz * fx, wz = -cz * fz - sx * fx; const wl = Math.hypot(wx, wz); if (wl) { wx /= wl; wz /= wl; }
    if (chamLeo === 0) {
      const hx = wl ? wx : Math.sin(huong), hz = wl ? wz : Math.cos(huong);
      if (demNhay > 0 && (nen || roiMep < VD.coyote) && thuBam(p, hx, hz)) { demNhay = 0; return; }
      if (!nen && fz > 0 && vy < 3 && thuBam(p, Math.sin(huong), Math.cos(huong))) return;
    }
    const v = (phim.KeyC ? VD.ngoi : phim.ShiftLeft || phim.ShiftRight ? VD.chay : VD.di) * Math.min(1, Math.hypot(fx, fz));
    let tocMuon = v;
    if (gocNhin === 3 && wl) {
      muon = Math.atan2(wx, wz); const lech = Math.atan2(Math.sin(muon - huong), Math.cos(muon - huong));
      huong += Math.sign(lech) * Math.min(Math.abs(lech), VD.quay * dt);
      tocMuon = v * Math.max(0.15, Math.cos(Math.min(Math.abs(lech), Math.PI / 2))); if (nen && Math.abs(lech) > 2.2) tocMuon = 0;
      const sau = huong - Math.PI, lc = Math.atan2(Math.sin(sau - yaw), Math.cos(sau - yaw));
      if (performance.now() - lucChuot > 800 && Math.abs(lc) < 2.4) yaw += lc * (1 - Math.exp(-dt * 1.6 * Math.min(1, toc / VD.di)));
    } else if (gocNhin === 1) huong = yaw + Math.PI;
    const hx = gocNhin === 3 && wl ? Math.sin(huong) : wx, hz = gocNhin === 3 && wl ? Math.cos(huong) : wz;
    const tx = hx * tocMuon, tz = hz * tocMuon, gia = nen ? (tocMuon > Math.hypot(vx, vz) ? VD.tang : VD.ham) : VD.tangKhong;
    const ddx = tx - vx, ddz = tz - vz, dl = Math.hypot(ddx, ddz), b = gia * dt;
    if (dl <= b) { vx = tx; vz = tz; } else { vx += ddx / dl * b; vz += ddz / dl * b; }
    roiMep = nen ? 0 : roiMep + dt;
    if (demNhay > 0 && roiMep < VD.coyote && vy <= 0.5) { vy = VD.nhay; demNhay = 0; roiMep = 1; }
    else if (nen && vy <= 0) vy = -1; else vy -= (vy > 0 ? VD.g : VD.gRoi) * dt;
    dk.computeColliderMovement(va, { x: vx * dt, y: vy * dt, z: vz * dt });
    const m = dk.computedMovement();
    than.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    { const mu = Math.hypot(vx, vz) * dt, du = Math.hypot(m.x, m.z) + Math.max(0, m.y - vy * dt); if (mu > 1e-4 && du < mu * 0.5) { vx = m.x / dt; vz = m.z / dt; } } // dốc nâng lên không tính là đâm tường
    toc += (Math.hypot(m.x, m.z) / dt - toc) * 0.25; nen = dk.computedGrounded();
    if (nen && vy > 0 && m.y < vy * dt * 0.5) vy = 0;
  }
  function khung(dt) { // mỗi khung hình: đặt hình người + camera
    if (!dang) return;
    const p = than.translation(); let chan = p.y - NGUOI_H - NGUOI_R;
    if (tt === 'dat' && nen) { const m = matTren(p.x, p.y, p.z, 1.3); if (m != null && m > chan && m - chan < 0.4) chan = m; }
    toi.goc.position.set(p.x, chan, p.z); toi.goc.rotation.y = huong; if (tt === 'leo') phaLeo += dt * tocLeo * 3.2;
    toi.capNhat(dt, { toc: tt === 'dat' ? toc : 0, nen: nen || tt !== 'dat', ngoi: tt === 'dat' && !!phim.KeyC, tuThe: tt === 'dat' ? null : tt, phaLeo });
    if (gocNhin === 1) { camera.position.set(p.x, chan + MAT, p.z); camera.rotation.set(pitch, yaw, 0, 'YXZ'); return; }
    camY = camY == null || Math.abs(camY - chan) > 3 ? chan : camY + (chan - camY) * (1 - Math.exp(-dt * 12));
    const pt = Math.max(-1.1, Math.min(0.75, pitch));
    const dich = new THREE.Vector3(p.x + Math.cos(yaw) * 0.45, camY + (phim.KeyC ? 1.05 : 1.6), p.z - Math.sin(yaw) * 0.45);
    const lui = new THREE.Vector3(Math.sin(yaw) * Math.cos(pt), -Math.sin(pt), Math.cos(yaw) * Math.cos(pt));
    const h = world.castRay(new RAPIER.Ray(dich, lui), 3.6, true, TINH, undefined, va);
    camera.position.copy(dich).addScaledVector(lui, h ? Math.max(0.4, h.timeOfImpact - 0.25) : 3.6);
    camera.lookAt(dich.x - lui.x, dich.y - lui.y, dich.z - lui.z);
  }
  return {
    get dang() { return dang; }, get tt() { return tt; }, than, va, phim,
    vao(x, y, z, h = 0) { than.setTranslation({ x, y: y + NGUOI_H + NGUOI_R + 0.1, z }, true); vy = 0; vx = vz = 0; tt = 'dat'; camY = null; huong = muon = h; yaw = h - Math.PI; pitch = -0.12; dang = true; toi.goc.visible = gocNhin === 3; khiDoi(true); },
    ra() { dang = false; toi.goc.visible = false; khiDoi(false); },
    buoc, khung,
    // ngữ cảnh cho bảng phím: đang leo / sát tường
    nguCanh() { if (!dang) return 'toan'; if (tt !== 'dat') return 'leo'; const p = than.translation(), t = tiaN(p, 0.3, Math.sin(huong), Math.cos(huong), 1.0); return t && t.timeOfImpact > 0.02 && Math.abs(t.normal.y) < 0.35 ? 'tuong' : 'dat'; },
    viTri: () => than.translation(), huong: () => huong, yaw: () => yaw,
  };
}
