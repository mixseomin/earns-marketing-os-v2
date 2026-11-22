// tra-repo-ok: keo dán recast-navigation-js (đã chọn ở ROADMAP 2e) với dữ liệu Sprawl
// Người đi bộ GẦN camera (ô phố mẫu, bước 2): người đi tới lui trong shader không biết xe, không biết nhau.
// Trong bán kính R_NHAN quanh camera, mỗi người đang đi được "nhận" thành một tác tử của recast Crowd:
// đi trên lưới đi được (vỉa hè + phố đi bộ + vạch qua đường), né nhau, né người chơi, dừng ở mép vạch
// chờ đèn đỏ cho xe + khoảng trống, và xe dừng trước người đang ở trên lòng đường (đẩy vào song.vatCan).
// Lưới đi được dựng từ CHÍNH dữ liệu vẽ đường (tuyen, LONG, nuaNut) → khớp đúng vỉa hè / vạch ngựa vằn trên màn.
// Xa hơn R_THA người trở lại shader (rẻ). Không nạp được thư viện → kêu to + giữ người shader.
// 2f nhịp C: bị xe (xe người chơi, xác xe văng) đâm → rời crowd, thành viên nhộng Rapier 70 kg văng theo đà xe, lăn, nằm 4–8 s rồi đứng dậy (1 s) và đi tiếp.
// Hình người instanced không có khớp nên không dùng ragdoll nhiều khúc (rapierjs-ragdoll / advanced-ragdoll đã tra, ROADMAP 2f): cả thân xoay theo viên nhộng.
// Đâm / đồ vỡ gần → người quanh đó chạy tán ra (tan).
import * as THREE from 'three';

const O = 0.5, NUA = 150, N = (NUA * 2) / O; // ô lưới 0,5 m · lưới 300 × 300 m quanh tâm C
const R_NHAN = 65, R_THA = 80, MAX = 280, DOI_TAM = 60;
const MAX_NGA = 24, NAM_MIN = 4, NAM_MAX = 8, NGA_TOI_DA = 40, R_TAN = 14;
const B_DUONG = 1, B_LONG = 2, B_VACH = 4, B_CAN = 8;

export function taoNguoiGan({ RAPIER, world, tuyen, LOP, LONG, nuaNut, vatTinh, nguoi, bo, geos, vatLieu, song, goc, bao }) {
  let core = null, gen = null, loi = null;
  const nap = Promise.all([import('@recast-navigation/core'), import('@recast-navigation/generators')])
    .then(async ([c, g]) => { await c.init(); core = c; gen = g; })
    .catch((e) => { loi = e; console.error('[sprawl] không nạp được recast-navigation — người gần vẫn đi theo shader (không né xe):', e); bao?.('Người đi bộ né xe: không nạp được thư viện recast — xem console'); });

  // người đang đi (aDi.x > 0) + bản gốc thuộc tính / màu của lớp shader
  const aDiGoc = () => bo.phu[0].src;
  let dsDi = null; // chỉ số người đi
  const an = bo.an = new Uint8Array(bo.n);

  // ---- lớp vẽ tác tử: 4 InstancedMesh chung ma trận, hình y hệt người shader, đi bằng CPU (aDi = tốc độ, pha) ----
  const aDi = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  const lop = geos.map((g) => { const g2 = g.clone(); g2.setAttribute('aDi', aDi); const m = new THREE.InstancedMesh(g2, vatLieu, MAX); m.count = 0; m.frustumCulled = false; return m; });
  for (const m of lop) { m.instanceMatrix = lop[0].instanceMatrix; m.setColorAt(0, new THREE.Color()); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  goc.add(...lop);

  // ---- lưới đi được ----
  let cx = 0, cz = 0, x0 = 0, z0 = 0, bit = null, vid = null, vach = [], navMesh = null, crowd = null, q = null, tDung = -1e9, dungMs = 0;
  const oCua = (x, z) => { const i = Math.floor((x - x0) / O), j = Math.floor((z - z0) / O); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  const bitTai = (x, z) => { const k = oCua(x, z); return k < 0 ? 0 : bit[k]; };
  function to(xa, za, xb, zb, fn) { // duyệt các ô trong hộp [xa..xb]×[za..zb] (cắt theo lưới)
    const i0 = Math.max(0, Math.floor((xa - x0) / O)), i1 = Math.min(N - 1, Math.floor((xb - x0) / O)), j0 = Math.max(0, Math.floor((za - z0) / O)), j1 = Math.min(N - 1, Math.floor((zb - z0) / O));
    for (let j = j0; j <= j1; j++) { const z = z0 + (j + 0.5) * O; for (let i = i0; i <= i1; i++) fn(j * N + i, x0 + (i + 0.5) * O, z); } }
  function dungLuoi(tx, tz) {
    cx = tx; cz = tz; x0 = cx - NUA; z0 = cz - NUA; bit = new Uint8Array(N * N); vid = new Int16Array(N * N).fill(-1); vach = [];
    const xa = x0 - 30, xb = x0 + 2 * NUA + 30, za = z0 - 30, zb = z0 + 2 * NUA + 30;
    for (const t of tuyen) { if (t.lop === 'tau') continue; const k = t.k, hw = t.hw, lg = k ? Math.max(k.raP, k.raM) : 0, g = t.g;
      // khuôn ngang từng phía (s > 0 = bên phải hướng g): hwS = mép ngoài, lgS = mép lòng nhựa; phía dải phân cách (giua) cấm đi hết bề ngang, chỉ qua ở vạch
      const hwP = k ? k.hwP : hw, hwM = k ? k.hwM : hw, lgP = !k ? 0 : k.giua > 0 ? k.hwP : k.raP, lgM = !k ? 0 : k.giua < 0 ? k.hwM : k.raM;
      for (let s = 1; s < g.length; s++) { const [ax, az] = g[s - 1], [bx, bz] = g[s];
        if (Math.max(ax, bx) < xa || Math.min(ax, bx) > xb || Math.max(az, bz) < za || Math.min(az, bz) > zb) continue;
        const L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue; const ux = (bx - ax) / L, uz = (bz - az) / L;
        for (let a = 0; a < L; a += 10) { const b = Math.min(L, a + 10), px = ax + ux * a, pz = az + uz * a, qx = ax + ux * b, qz = az + uz * b, l = b - a;
          to(Math.min(px, qx) - hw, Math.min(pz, qz) - hw, Math.max(px, qx) + hw, Math.max(pz, qz) + hw, (k, x, z) => {
            const rx = x - px, rz = z - pz, d = Math.min(l, Math.max(0, rx * ux + rz * uz)), ex = rx - ux * d, ez = rz - uz * d, d2 = ex * ex + ez * ez, P = ez * ux - ex * uz >= 0, h = P ? hwP : hwM, lgS = P ? lgP : lgM;
            if (d2 < h * h) bit[k] |= B_DUONG; if (lgS && d2 < lgS * lgS) bit[k] |= B_LONG; }); } }
      if (!lg) continue;
      // vạch qua đường: dải h+1,2 … h+5,2 m tính từ nút, ngang hết lòng đường (đúng chỗ shader vẽ ngựa vằn)
      g.forEach((p, i) => { const h = nuaNut(t.lop, p); if (!h || p[0] < xa || p[0] > xb || p[1] < za || p[1] > zb) return;
        for (const j of [i - 1, i + 1]) { const nb = g[j]; if (!nb) continue; const L = Math.hypot(nb[0] - p[0], nb[1] - p[1]); if (L < h + 6) continue;
          const ux = (nb[0] - p[0]) / L, uz = (nb[1] - p[1]) / L, xuoi = j > i, wP = (xuoi ? lgP : lgM) + 0.3, wM = (xuoi ? lgM : lgP) + 0.3, id = vach.length; if (id > 32000) return; // đi ngược g thì hai phía đổi chỗ
          vach.push({ nx: p[0], nz: p[1], ux, uz, h, lg });
          const s0 = h + 1.2, s1 = h + 5.2, cs = [[s0, -wM], [s0, wP], [s1, -wM], [s1, wP]].map(([s, n]) => [p[0] + ux * s - uz * n, p[1] + uz * s + ux * n]);
          to(Math.min(...cs.map((c) => c[0])), Math.min(...cs.map((c) => c[1])), Math.max(...cs.map((c) => c[0])), Math.max(...cs.map((c) => c[1])), (k, x, z) => {
            const rx = x - p[0], rz = z - p[1], s = rx * ux + rz * uz, n = rz * ux - rx * uz; if (s >= s0 && s <= s1 && n < wP && n > -wM) { bit[k] |= B_VACH; vid[k] = id; } }); } }); }
    // vật cản đứng yên: quầy, đồ phố, cây, người đứng (người bán, khách xem)
    for (const [ds, r] of vatTinh) for (const o of ds) { if (o.x < xa || o.x > xb || o.z < za || o.z > zb) continue; const r2 = r * r;
      to(o.x - r, o.z - r, o.x + r, o.z + r, (k, x, z) => { if ((x - o.x) ** 2 + (z - o.z) ** 2 < r2) bit[k] |= B_CAN; }); }
    // dải đi được mỗi hàng → hai tam giác (mặt phẳng y = 0; vẽ thì nâng theo đất)
    const P = [], I = [], di = (b) => (b & B_DUONG) && (!(b & B_LONG) || (b & B_VACH)) && !(b & B_CAN);
    for (let j = 0; j < N; j++) { let i = 0; while (i < N) { if (!di(bit[j * N + i])) { i++; continue; } let e = i; while (e + 1 < N && di(bit[j * N + e + 1])) e++;
      const ax = x0 + i * O, bx = x0 + (e + 1) * O, az = z0 + j * O, bz = az + O, v = P.length / 3; P.push(ax, 0, az, ax, 0, bz, bx, 0, az, bx, 0, bz); I.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); i = e + 1; } }
    P.push(x0, 3, z0, x0 + 0.01, 3, z0, x0, 3, z0 + 0.01); I.push(P.length / 3 - 3, P.length / 3 - 1, P.length / 3 - 2); // một tam giác tí xíu ở y = 3 để hộp bao có chiều cao (bị loại vì nhỏ hơn minRegionArea)
    return { P: new Float32Array(P), I: new Uint32Array(I) };
  }

  // ---- tác tử ----
  const ta = []; // { i (chỉ số người), ag, h, ph, v, dich, cho, tKet, s }
  let choi = null, agChoi = null, muot = null, tNhan = 0, tDen = 0, bat = false, doi = false, demCho = 0;
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _e = new THREE.Euler(), _c = new THREE.Color();
  const HE = { x: 2, y: 4, z: 2 };
  const ganLuoi = (x, z) => { const r = q.findClosestPoint({ x, y: 0, z }, { halfExtents: HE }); return r.success && Math.hypot(r.point.x - x, r.point.z - z) < 1.5 ? r.point : null; };
  const thamSo = (v) => ({ radius: 0.3, height: 1.7, maxAcceleration: 4, maxSpeed: v, collisionQueryRange: 3, pathOptimizationRange: 10, separationWeight: 1.5, updateFlags: 15, obstacleAvoidanceType: 1 });
  function dichMoi(t, p) { // điểm đến ngẫu nhiên quanh chỗ gốc của người đó (giữ họ trong khu, thỉnh thoảng băng qua đường)
    const d = nguoi[t.i], r = q.findRandomPointAroundCircle({ x: d.x, y: 0, z: d.z }, 35, { halfExtents: HE });
    t.dich = r.success ? r.randomPoint : { x: p.x, y: 0, z: p.z }; t.ag.requestMoveTarget(t.dich); t.tKet = 0; }
  function nhan(i, cam) { // người shader i → tác tử, đứng đúng chỗ shader đang vẽ
    const d = nguoi[i], src = aDiGoc(), v = src[i * 2], ph = src[i * 2 + 1], T = song.uT.value;
    const L = 24, dd = ((T * v + ph * 2 * L) % (2 * L) + 2 * L) % (2 * L), lui = dd >= L, di = dd < L ? dd : 2 * L - dd, off = (di - L * 0.5) * d.s;
    const x = d.x + Math.sin(d.h) * off, z = d.z + Math.cos(d.h) * off, h = lui ? d.h + Math.PI : d.h, p = ganLuoi(x, z); if (!p) return false;
    const ag = crowd.addAgent(p, thamSo(v)); if (!ag) return false;
    const t = { i, ag, h, ph: Math.random() * 6.28, v, dich: null, cho: -1, tKet: 0, k: ta.length };
    const tr = q.findClosestPoint({ x: p.x + Math.sin(h) * 30, y: 0, z: p.z + Math.cos(h) * 30 }, { halfExtents: { x: 6, y: 4, z: 6 } });
    if (tr.success) { t.dich = tr.point; ag.requestMoveTarget(tr.point); } else dichMoi(t, p);
    for (const [k, m] of lop.entries()) { const a = bo.mau[k]; if (a) m.setColorAt(ta.length, _c.setRGB(a[i * 3], a[i * 3 + 1], a[i * 3 + 2])); }
    ta.push(t); an[i] = 1; doi = true; return true;
  }
  function tha(k) { const t = ta[k]; if (t.ag) crowd.removeAgent(t.ag); if (t.nga?.than) world.removeRigidBody(t.nga.than); an[t.i] = 0; doi = true;
    const cuoi = ta.pop(); if (k < ta.length) { ta[k] = cuoi; for (const m of lop) if (m.instanceColor) for (let j = 0; j < 3; j++) m.instanceColor.array[k * 3 + j] = m.instanceColor.array[ta.length * 3 + j]; } }
  function thaHet() { while (ta.length) tha(ta.length - 1); if (agChoi) { crowd.removeAgent(agChoi); agChoi = null; } for (const m of lop) m.count = 0; }

  function dungLai(tx, tz) { // dựng lưới + navmesh mới quanh (tx, tz), chuyển tác tử cũ sang
    const t0 = performance.now(), { P, I } = dungLuoi(tx, tz);
    let kq; // detailSampleDist 0 làm buildPolyMeshDetail của wasm 0.44 ghi ngoài bộ nhớ → để 6 (mặc định)
    try { kq = gen.generateSoloNavMesh(P, I, { cs: 0.4, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 9, walkableClimb: 2, walkableRadius: 1, maxEdgeLen: 30, maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20, maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1 }); }
    catch (e) { kq = { success: false, error: e }; }
    if (!kq.success) { console.error('[sprawl] dựng lưới đi bộ hỏng:', kq.error); bao?.('Người đi bộ né xe: dựng lưới đi bộ hỏng — xem console'); return false; }
    const nga = ta.filter((t) => t.nga), cu = ta.filter((t) => !t.nga).map((t) => ({ ...t, p: t.ag.position(), vt: t.ag.velocity() }));
    if (crowd) { crowd.destroy(); navMesh.destroy(); }
    ta.length = 0; agChoi = null; navMesh = kq.navMesh; crowd = new core.Crowd(navMesh, { maxAgents: MAX + 4, maxAgentRadius: 0.6 }); q = crowd.navMeshQuery;
    for (const t of nga) ta.push(t); // người đang ngã không có tác tử: giữ nguyên, đứng dậy thì vào crowd mới
    for (const t of cu) { const p = ganLuoi(t.p.x, t.p.z); an[t.i] = 0; if (!p) { doi = true; continue; }
      t.ag = crowd.addAgent(p, thamSo(t.v)); if (!t.ag) { doi = true; continue; } an[t.i] = 1; if (t.dich) t.ag.requestMoveTarget(t.dich); t.cho = -1; ta.push(t); }
    for (const [k, m] of lop.entries()) { const a = bo.mau[k]; if (a) ta.forEach((t, j) => m.setColorAt(j, _c.setRGB(a[t.i * 3], a[t.i * 3 + 1], a[t.i * 3 + 2]))); }
    dungMs = performance.now() - t0; tDung = performance.now(); return true;
  }

  // vạch id an toàn để bước xuống: đèn đang đỏ cho xe đường đó (và còn đỏ đủ lâu để qua hết), không xe nào đang lao tới vạch
  function anToan(id, v) {
    const c = vach[id], qua = (2 * c.lg) / Math.max(0.6, v) + 1, mx = c.nx + c.ux * (c.h + 3.2), mz = c.nz + c.uz * (c.h + 3.2);
    const den = song.gt.denXe(c.nx, c.nz, c.ux, c.uz, 0); if (den === false || (den && !song.gt.denXe(c.nx, c.nz, c.ux, c.uz, qua))) return false;
    return song.gt.xeQuanh(mx, mz, 48, (o) => { if (o.dx === undefined || Math.abs(o.dx * c.ux + o.dz * c.uz) < 0.7) return;
      const rx = o.x - c.nx, rz = o.z - c.nz; if (Math.abs(rx * c.uz - rz * c.ux) > c.lg + 1) return; // không nằm trên đường này
      const toi = (mx - o.x) * o.dx + (mz - o.z) * o.dz; if (toi > -3 && toi < o.v * 3.5 + 6) return false; });
  }

  const viTri = (t) => t.nga ? (t.nga.than ? t.nga.than.translation() : t.nga.p1) : t.ag.position();
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v2 = new THREE.Vector3(), CHAN = new THREE.Vector3(0, -0.85, 0), TRUC_Y = new THREE.Vector3(0, 1, 0);
  function nga(t, v) { // tác tử → viên nhộng động, văng theo đà xe
    let dangNga = ta.filter((o) => o.nga); if (dangNga.length >= MAX_NGA) { const cu = dangNga.sort((a, b) => b.nga.t - a.nga.t)[0]; dungDay(cu, true); }
    const p = t.ag.position(), y = (muot ? muot(p.x, p.z) : 0) + 0.6 + 0.9, sp = Math.hypot(v.x, v.z), k = 1 + Math.random() * 0.3;
    crowd.removeAgent(t.ag); t.ag = null; t.cho = -1;
    const than = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, y, p.z).setRotation(_qa.setFromAxisAngle(TRUC_Y, t.h)).setCcdEnabled(true).setLinearDamping(0.3).setAngularDamping(0.8)
      .setLinvel(v.x * k, 2 + sp * 0.25, v.z * k).setAngvel({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 8 }));
    world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.28).setMass(70).setFriction(0.9).setRestitution(0.05), than);
    t.nga = { than, t: 0, nam: 0, can: NAM_MIN + Math.random() * (NAM_MAX - NAM_MIN), dung: -1 }; doi = true; tan(p.x, p.z); }
  function dungDay(t, ngay) { // bắt đầu đứng dậy: bỏ thân vật lý, nội suy 1 s từ tư thế nằm về đứng thẳng ở điểm gần nhất trên lưới
    const n = t.nga, p = n.than.translation(), r = n.than.rotation(), g = ganLuoi(p.x, p.z) || q.findClosestPoint({ x: p.x, y: 0, z: p.z }, { halfExtents: { x: 8, y: 4, z: 8 } }).point;
    _qa.set(r.x, r.y, r.z, r.w); n.q0 = _qa.clone(); n.p0 = _v2.copy(CHAN).applyQuaternion(_qa).add(p).clone(); n.p1 = { x: g.x, y: 0, z: g.z };
    world.removeRigidBody(n.than); n.than = null; n.dung = ngay ? 1 : 0; }
  function dayXong(t) { const n = t.nga; t.nga = null; const ag = crowd.addAgent(n.p1, thamSo(t.v)); if (!ag) return false; t.ag = ag; dichMoi(t, n.p1); return true; }
  // xe đâm: dsXe = [{ than, nua: {x,y,z}, oy }] — người trong hộp thân xe (nới 0,3 m) khi xe chạy > 2,5 m/s về phía họ
  function vaXe(dsXe) { if (!bat || !crowd) return;
    for (const x of dsXe) { const v = x.than.linvel(), sp = Math.hypot(v.x, v.z); if (sp < 2.5) continue; const c = x.than.translation(), r = x.than.rotation(); _qa.set(r.x, r.y, r.z, r.w).invert();
      for (const t of ta) { if (t.nga) continue; const p = t.ag.position(), py = (muot ? muot(p.x, p.z) : 0) + 1.5;
        if ((p.x - c.x) * v.x + (p.z - c.z) * v.z <= 0 || Math.hypot(p.x - c.x, p.z - c.z) > 6) continue;
        _v2.set(p.x - c.x, py - c.y - x.oy, p.z - c.z).applyQuaternion(_qa);
        if (Math.abs(_v2.x) < x.nua.x + 0.3 && Math.abs(_v2.z) < x.nua.z + 0.3 && Math.abs(_v2.y) < x.nua.y + 1) nga(t, v); } } }
  // người quanh (x, z) chạy tán ra xa R_TAN m, nhanh gấp đôi, 4 s
  function tan(x, z) { if (!crowd) return;
    for (const t of ta) { if (t.nga) continue; const p = t.ag.position(), dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > R_TAN) continue;
      const ux = d > 0.1 ? dx / d : Math.random() - 0.5, uz = d > 0.1 ? dz / d : Math.random() - 0.5, l = Math.hypot(ux, uz) || 1;
      const r = q.findClosestPoint({ x: p.x + ux / l * R_TAN, y: 0, z: p.z + uz / l * R_TAN }, { halfExtents: { x: 6, y: 4, z: 6 } }); if (!r.success) continue;
      t.cho = -1; t.dich = r.point; t.ag.requestMoveTarget(r.point); t.ag.updateParameters({ maxSpeed: 3.2, maxAcceleration: 8 }); t.chay = 4; } }
  function khungNga(dt) { for (const t of ta) { const n = t.nga;
      if (!n) { if (t.chay > 0 && (t.chay -= dt) <= 0) t.ag.updateParameters({ maxSpeed: t.v, maxAcceleration: 4 }); continue; }
      n.t += dt;
      if (n.than) { const vl = n.than.linvel(), p = n.than.translation();
        if (p.y < (muot ? muot(p.x, p.z) : 0) - 6) n.than.setTranslation({ x: p.x, y: (muot ? muot(p.x, p.z) : 0) + 1.6, z: p.z }, true); // lọt qua đất: đặt lại lên mặt đất
        n.nam = Math.hypot(vl.x, vl.y, vl.z) < 0.4 ? n.nam + dt : 0;
        if (n.nam > n.can || n.t > NGA_TOI_DA) dungDay(t, false); }
      else if ((n.dung += dt) >= 1) dayXong(t); } }

  function khung(dt, cam) {
    if (loi || !core) return false; doi = false;
    const y0 = muot ? muot(cam.position.x, cam.position.z) : 0, canBat = goc.visible && cam.position.y - y0 < 80;
    if (!canBat) { if (bat) { bat = false; if (crowd) thaHet(); } const d = doi; doi = false; return d; }
    if (!dsDi) { const src = aDiGoc(); dsDi = []; for (let i = 0; i < bo.dem; i++) if (src[i * 2] > 0.01) dsDi.push(i); }
    const now = performance.now();
    if (!crowd || ((Math.hypot(cam.position.x - cx, cam.position.z - cz) > DOI_TAM) && now - tDung > 2000)) { if (!dungLai(cam.position.x, cam.position.z)) { loi = new Error('navmesh'); return false; } }
    bat = true;
    const kx = cam.position.x, kz = cam.position.z;
    // nhận / thả 10 lần mỗi giây
    tNhan += dt; if (tNhan > 0.1) { tNhan = 0;
      for (let k = ta.length - 1; k >= 0; k--) { const t = ta[k], d = nguoi[t.i], p = viTri(t);
        if (Math.hypot(d.x - kx, d.z - kz) > R_THA && Math.hypot(p.x - kx, p.z - kz) > R_THA) tha(k); }
      if (ta.length < MAX) { const ung = [];
        for (const i of dsDi) { if (an[i]) continue; const d = nguoi[i], k2 = (d.x - kx) ** 2 + (d.z - kz) ** 2; if (k2 < R_NHAN * R_NHAN && Math.abs(d.x - cx) < NUA - 20 && Math.abs(d.z - cz) < NUA - 20) ung.push([k2, i]); }
        ung.sort((a, b) => a[0] - b[0]); for (const [, i] of ung) { if (ta.length >= MAX) break; nhan(i, cam); } }
      // người chơi: một tác tử đứng (bị đặt mỗi khung) để người khác né
      if (choi && oCua(choi.x, choi.z) >= 0) { const p = { x: choi.x, y: 0, z: choi.z }; if (!agChoi) agChoi = crowd.addAgent(p, { radius: 0.5, height: 1.8, maxAcceleration: 0, maxSpeed: 0.01, updateFlags: 0 }); }
      else if (agChoi) { crowd.removeAgent(agChoi); agChoi = null; }
      // qua đường: sắp bước từ vỉa hè xuống vạch → chờ tới khi an toàn
      demCho = 0;
      for (const t of ta) { if (t.nga) continue; const p = t.ag.position(), vl = t.ag.velocity(), sp = Math.hypot(vl.x, vl.z);
        if (t.cho >= 0) { demCho++; if (anToan(t.cho, t.v)) { t.cho = -1; t.ag.requestMoveTarget(t.dich); } continue; }
        if (sp > 0.2) { const lx = p.x + vl.x / sp * 0.9, lz = p.z + vl.z / sp * 0.9, bL = bitTai(lx, lz), bP = bitTai(p.x, p.z);
          if ((bL & B_VACH) && !(bP & (B_VACH | B_LONG))) { const id = vid[oCua(lx, lz)]; if (id >= 0 && !anToan(id, t.v)) { t.cho = id; t.ag.requestMoveVelocity({ x: 0, y: 0, z: 0 }); continue; } } }
        if (t.dich && (Math.hypot(p.x - t.dich.x, p.z - t.dich.z) < 1.5 || (sp < 0.05 && (t.tKet += 0.1) > 3))) dichMoi(t, p); else if (sp >= 0.05) t.tKet = 0; } }
    if (agChoi && choi) agChoi.teleport({ x: choi.x, y: 0, z: choi.z });
    crowd.update(1 / 30, Math.min(dt, 0.1), 3);
    khungNga(Math.min(dt, 0.1));
    for (let k = ta.length - 1; k >= 0; k--) if (ta[k].nga === null && !ta[k].ag) tha(k); // đứng dậy mà crowd đầy: trả về shader
    // vẽ
    for (const [k, t] of ta.entries()) { const d = nguoi[t.i], n = t.nga;
      if (n) { _s.setScalar(d.s); aDi.setXY(k, 0, t.ph);
        if (n.than) { const p = n.than.translation(), r = n.than.rotation(); _q.set(r.x, r.y, r.z, r.w); _v.copy(CHAN).applyQuaternion(_q).add(p); } // chân = đáy viên nhộng
        else { const a = Math.min(1, n.dung), e = a * a * (3 - 2 * a); _q.slerpQuaternions(n.q0, _qb.setFromAxisAngle(TRUC_Y, t.h), e);
          _v.set(n.p1.x, (muot ? muot(n.p1.x, n.p1.z) : 0) + 0.6, n.p1.z).sub(n.p0).multiplyScalar(e).add(n.p0); }
        lop[0].setMatrixAt(k, _m.compose(_v, _q, _s)); continue; }
      const p = t.ag.interpolatedPosition, vl = t.ag.velocity(), sp = Math.hypot(vl.x, vl.z);
      if (sp > 0.1) { let dh = Math.atan2(vl.x, vl.z) - t.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); t.h += dh * Math.min(1, dt * 8); }
      t.ph += sp * 5.2 * dt; aDi.setXY(k, sp > 0.1 ? sp : 0, t.ph);
      _v.set(p.x, (muot ? muot(p.x, p.z) : 0) + 0.6, p.z); _q.setFromEuler(_e.set(0, t.h, 0)); _s.setScalar(d.s); lop[0].setMatrixAt(k, _m.compose(_v, _q, _s)); }
    for (const m of lop) { m.count = ta.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    lop[0].instanceMatrix.needsUpdate = true; aDi.needsUpdate = true;
    const d = doi; doi = false; return d;
  }
  // người đang ở trên lòng đường (đang qua) → xe dừng trước họ
  function dayVatCan(vc) { if (!bat) return; for (const t of ta) { const p = viTri(t); if (bitTai(p.x, p.z) & B_LONG) vc.push({ x: p.x, z: p.z, r: t.nga ? 1 : 0.4 }); } } // người nằm trên đường: xe trên làn dừng lại
  return { khung, dayVatCan, vaXe, tan, get nga() { return ta.filter((t) => t.nga).length; }, datMuot: (m) => { muot = m; }, datChoi: (p) => { choi = p; }, nap,
    tk: () => ({ tacTu: ta.length, cho: demCho, dungMs: Math.round(dungMs), bat, loi: loi ? String(loi.message || loi) : null, vach: vach.length }),
    // cho bài thử: vị trí người gần + xe
    _vach: () => vach.map((c) => ({ x: c.nx + c.ux * (c.h + 3.2), z: c.nz + c.uz * (c.h + 3.2), lg: c.lg })),
    _ds: () => ta.map((t) => { const p = viTri(t); return { x: p.x, z: p.z, b: bitTai(p.x, p.z), cho: t.cho, nga: !!t.nga }; }) };
}
