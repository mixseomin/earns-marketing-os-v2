// LỚP 🧭 KIỂM — ĐÁNH GIÁ TỪ TỔNG THỂ XUỐNG CHI TIẾT (anh 16/11/2026: "tạo khung từ tổng thể rồi drilldown về các chi tiết… để ai cũng biết đang làm đúng / sai ở đâu").
// Ba tầng, mỗi tầng tô màu theo KẾT QUẢ MÁY (không phải ý con):
//   1) KHỐI   — khung mô hình (màu theo trạng thái độ cao) + KHUNG THẬT nét lam: đỉnh đo trên bản đồ độ cao ảnh 3D (khoi-tu-dsm.mjs). Hai đường lệch nhau = sai cao thấp, đọc số m.
//   2) MẶT    — mỗi mặt tường ngoài: xanh = kiểm kê khớp ảnh · đỏ = kiểm kê ra lỗi · vàng = có số đo từ ảnh, chưa kiểm kê · cam = dựng theo luật chung, chưa đo (kiem-ke.mjs → <lâu>-kiem-ke-kq.json)
//   3) CHI TIẾT — từng ô cửa (khung đúng ô) + cửa mái / răng cưa / huy hiệu… (hộp nhỏ): xanh = vị trí đo từ ảnh · cam = luật chung · đỏ = loại bị kiểm kê báo sai trên mặt đó
// Bấm một chỗ trên lâu đài (khi lớp đang bật) → bảng: khối nào, đỉnh mô hình / đỉnh thật / lệch, mặt nào, kiểm kê nói gì, chi tiết trên mặt.
// Lớp ẢNH THẬT 3D bật thì khung vẫn vẽ trên ảnh thật → thấy ngay khung mô hình lệch ảnh ở đâu (đó chính là chỗ sai cần sửa).
// tra-repo-ok: lớp phủ đường kẻ three.js nhỏ của cảnh, dữ liệu từ các công cụ đo trong repo.
export function ganDanhGia({ THREE, scene, camera, dom, nut, dsKhoi, CUA, KIEM_KE, CUA_SO, TT, KQ, trongDa, datThat, diemTaiAnh }) {
  const MAU = { doi: '#ffd400', do_tay: '#3ee07a', khop: '#ffffff', chua_do: '#ff4a3a', ngoai: '#888888', that: '#39b6ff', mat_khop: '#3ee07a', mat_sai: '#ff3b30', mat_so: '#ffd400', mat_luat: '#ff9a2e', ct_do: '#3ee07a', ct_luat: '#ff9a2e', ct_sai: '#ff3b30' };
  const TEN = { doi: 'cách 3 đổi theo bản đồ', do_tay: 'đã đo tay bằng tia', khop: 'đo khớp sẵn', chua_do: 'chưa đo được', ngoai: 'ngoài lâu đài' };
  const goc = new THREE.Group(); goc.visible = false; scene.add(goc);
  const tang = { khoi: new THREE.Group(), mat: new THREE.Group(), ct: new THREE.Group(), chon: new THREE.Group() }; for (const g of Object.values(tang)) goc.add(g);
  const tt = (id) => (typeof TT[id] === 'string' ? { tt: TT[id] } : TT[id] || null);
  const gan = (k) => Math.hypot(...k.v.reduce((s, p) => [s[0] + p[0] / k.v.length, s[1] + p[1] / k.v.length], [0, 0])) < 110;
  const dsK = dsKhoi.filter((k) => k.yTren != null && !(k.vo && k.coPart) && gan(k));
  const net = (pos, mau, sau = true, mo = 0.9) => { if (!pos.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: mau, depthTest: sau, transparent: true, opacity: mo })); l.renderOrder = 998; return l; };
  const chuNhat = (arr, A, B, C, D) => arr.push(...A, ...B, ...B, ...C, ...C, ...D, ...D, ...A);
  const day = (k) => Math.max(k.yDuoi ?? k.day, Math.min(...k.v.map(([x, z]) => datThat(x, z))) - 0.3);
  // ---- tầng 1: KHỐI (khung mô hình + khung thật)
  const posK = {}, posThat = [];
  for (const k of dsK) { const t = tt(k.id)?.tt || 'khop', p = (posK[t] ??= []), y0 = day(k), y1 = k.yTren;
    for (let i = 0; i < k.v.length; i++) { const [ax, az] = k.v[i], [bx, bz] = k.v[(i + 1) % k.v.length]; p.push(ax, y1, az, bx, y1, bz, ax, y0, az, bx, y0, bz, ax, y0, az, ax, y1, az); }
    const d = tt(k.id); if (d?.dinh != null && !d.chong) for (let i = 0; i < k.v.length; i++) { const [ax, az] = k.v[i], [bx, bz] = k.v[(i + 1) % k.v.length]; posThat.push(ax, d.dinh, az, bx, d.dinh, bz); } }
  for (const [t, p] of Object.entries(posK)) { const l = net(p, MAU[t]); if (l) tang.khoi.add(l); }
  { const l = net(posThat, MAU.that, true, 1); if (l) tang.khoi.add(l); }
  // ---- tầng 2: MẶT tường ngoài
  const MAT = [];
  for (const k of dsK) for (let i = 0; i < k.v.length; i++) {
    const [ax, az] = k.v[i], [bx, bz] = k.v[(i + 1) % k.v.length], L = Math.hypot(bx - ax, bz - az); if (L < 2.5) continue;
    const nx = (bz - az) / L, nz = -(bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2, y1 = k._y1 ?? k.yTren, y0 = Math.max(k.yDuoi ?? k.day, Math.min(datThat(ax, az), datThat(bx, bz)) - 0.3);
    if (dsKhoi.some((q) => q !== k && !(q.vo && q.coPart) && (q.yTren ?? 0) > (y0 + y1) / 2 && (q.yDuoi ?? -1e9) < (y0 + y1) / 2 && trongDa(mx + nx * 1.0, mz + nz * 1.0, q.v))) continue;
    const id = `${k.id}#${i}`, kq = KQ?.[id] || KQ?.[`${k.id}#*`], so = CUA_SO?.[id];
    const loai = kq ? (kq.loi?.length ? 'mat_sai' : 'mat_khop') : so && (so.hang?.length || so.khung || so.hang_khung) ? 'mat_so' : 'mat_luat';
    MAT.push({ id, k, i, a: [ax, az], b: [bx, bz], n: [nx, nz], y0, y1, loai, kq, so }); }
  const posM = {};
  for (const m of MAT) { const o = 0.18, A = [m.a[0] + m.n[0] * o, m.a[1] + m.n[1] * o], B = [m.b[0] + m.n[0] * o, m.b[1] + m.n[1] * o];
    chuNhat(posM[m.loai] ??= [], [A[0], m.y0, A[1]], [B[0], m.y0, B[1]], [B[0], m.y1, B[1]], [A[0], m.y1, A[1]]); }
  for (const [t, p] of Object.entries(posM)) { const l = net(p, MAU[t]); if (l) tang.mat.add(l); }
  // ---- tầng 3: CHI TIẾT (dựng lần đầu bật — CUA có phần nạp nền)
  let daCT = false; const demCT = { do: 0, luat: 0, sai: 0 };
  function dungCT() {
    daCT = true; for (const c of [...tang.ct.children]) tang.ct.remove(c); demCT.do = demCT.luat = demCT.sai = 0; const p = { ct_do: [], ct_luat: [], ct_sai: [] };
    const saiTai = (mat, loai) => (KQ?.[mat]?.loai_sai || []).includes(loai);
    for (const c of CUA) { const loai = saiTai(c.mat, 'cua_so') ? 'ct_sai' : c.mat && CUA_SO?.[c.mat]?.hang?.length ? 'ct_do' : 'ct_luat', ux = -c.nz, uz = c.nx, o = 0.2, x = c.x + c.nx * o, z = c.z + c.nz * o;
      chuNhat(p[loai], [x - ux * c.nua, c.y, z - uz * c.nua], [x + ux * c.nua, c.y, z + uz * c.nua], [x + ux * c.nua, c.y + c.cao, z + uz * c.nua], [x - ux * c.nua, c.y + c.cao, z - uz * c.nua]); demCT[loai.slice(3)]++; }
    for (const e of KIEM_KE) { if (e.loai === 'cua_so' || e.x == null) continue; const loai = saiTai(e.mat, e.loai) ? 'ct_sai' : 'ct_do', r = { rang_cua: 0.45, vom_nho: 0.3, neo: 0.4, o_vuong: 0.4, o_tron: 0.35, da_goc: 0.35, go_ngang: 0.25 }[e.loai] ?? 0.9;
      chuNhat(p[loai], [e.x - r, e.y - r, e.z], [e.x + r, e.y - r, e.z], [e.x + r, e.y + r, e.z], [e.x - r, e.y + r, e.z]); chuNhat(p[loai], [e.x, e.y - r, e.z - r], [e.x, e.y - r, e.z + r], [e.x, e.y + r, e.z + r], [e.x, e.y + r, e.z - r]); demCT[loai.slice(3)]++; }
    for (const [t, q] of Object.entries(p)) { const l = net(q, MAU[t]); if (l) tang.ct.add(l); }
  }
  // ---- bảng điều khiển + bảng chọn
  const bang = document.createElement('div');
  bang.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:6;display:none;padding:8px 12px;border-radius:10px;background:var(--o);border:1px solid #39b6ff;color:var(--chu);font:13px system-ui;max-width:calc(100vw - 32px);text-align:center';
  const chon = document.createElement('div');
  chon.style.cssText = 'position:fixed;left:16px;top:70px;z-index:6;display:none;width:min(360px,calc(100vw - 32px));max-height:60vh;overflow:auto;padding:10px 12px;border-radius:10px;background:var(--o);border:1px solid var(--vien);color:var(--chu);font:13px system-ui';
  document.body.append(bang, chon);
  const hien = { khoi: true, mat: true, ct: false };
  const sw = (k, ten) => `<label style="margin:0 6px;cursor:pointer"><input type="checkbox" data-t="${k}" ${hien[k] ? 'checked' : ''}> ${ten}</label>`;
  const dem = (o) => Object.entries(o).filter(([, n]) => n).map(([t, n]) => `<span style="color:${MAU[t]}">■</span> ${n}`).join(' ');
  const demK = {}; for (const k of dsK) { const t = tt(k.id)?.tt || 'khop'; demK[t] = (demK[t] || 0) + 1; }
  const demM = {}; for (const m of MAT) demM[m.loai] = (demM[m.loai] || 0) + 1;
  function veBang() {
    bang.innerHTML = `<b>🧭 Kiểm từ tổng thể → chi tiết</b> — bấm vào lâu đài để xem chỗ đó đúng / sai gì<br>` + sw('khoi', 'Khối') + sw('mat', 'Mặt tường') + sw('ct', 'Chi tiết') +
      `<div style="font-size:12px;margin-top:4px;color:var(--mo)">Khối: ${dem(demK)} · <span style="color:${MAU.that}">━</span> đỉnh thật (ảnh 3D)` +
      ` &nbsp;|&nbsp; Mặt: <span style="color:${MAU.mat_khop}">■</span> khớp ảnh ${demM.mat_khop || 0} · <span style="color:${MAU.mat_sai}">■</span> sai ${demM.mat_sai || 0} · <span style="color:${MAU.mat_so}">■</span> có số đo, chưa kiểm ${demM.mat_so || 0} · <span style="color:${MAU.mat_luat}">■</span> chưa đo ${demM.mat_luat || 0}` +
      (daCT ? ` &nbsp;|&nbsp; Chi tiết: <span style="color:${MAU.ct_do}">■</span> đo từ ảnh ${demCT.do} · <span style="color:${MAU.ct_luat}">■</span> luật chung ${demCT.luat} · <span style="color:${MAU.ct_sai}">■</span> sai ${demCT.sai}` : '') + '</div>';
    bang.querySelectorAll('input[data-t]').forEach((c) => { c.onchange = () => { hien[c.dataset.t] = c.checked; if (c.dataset.t === 'ct' && c.checked && !daCT) dungCT(); apHien(); veBang(); }; });
  }
  const apHien = () => { tang.khoi.visible = hien.khoi; tang.mat.visible = hien.mat; tang.ct.visible = hien.ct; };
  function batTat(b) { goc.visible = b; bang.style.display = b ? 'block' : 'none'; if (!b) chon.style.display = 'none'; nut?.classList.toggle('chinh', b); if (b) { veBang(); apHien(); } try { localStorage.setItem('ns-kiem', b ? '1' : '0'); } catch {} }
  // bấm chọn: nhấp (không kéo) lên khung vẽ khi lớp đang bật
  let xuong = null;
  dom.addEventListener('pointerdown', (e) => { xuong = goc.visible ? [e.clientX, e.clientY] : null; });
  dom.addEventListener('pointerup', (e) => {
    if (!xuong || Math.hypot(e.clientX - xuong[0], e.clientY - xuong[1]) > 4) return; const r = dom.getBoundingClientRect(), t = diemTaiAnh((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); if (!t?.mat) return;
    // trúng VỎ nhà có khối con (Torbau…): đổi sang khối con chứa độ cao điểm trúng, cạnh gần nhất — đánh giá theo khối con (vỏ không có trạng thái)
    const v0 = dsKhoi.find((q) => q.id === t.mat.split('#')[0]);
    if (v0?.vo && v0.coPart && t.diem) { const [x, y, z] = t.diem; let tot = null;
      for (const q of dsKhoi) { if (!q.la || q.yTren == null || y < (q.yDuoi ?? -1e9) - 1 || y > q.yTren + 1) continue;
        q.v.forEach((p, i) => { const r = q.v[(i + 1) % q.v.length], dx = r[0] - p[0], dz = r[1] - p[1], s = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1))), dd = Math.hypot(x - p[0] - dx * s, z - p[1] - dz * s); if (!tot || dd < tot.dd) tot = { mat: `${q.id}#${i}`, dd }; }); }
      if (tot && tot.dd < 2) t.mat = tot.mat; }
    const [kid] = t.mat.split('#'), k = dsKhoi.find((q) => q.id === kid), d = tt(kid), m = MAT.find((q) => q.id === t.mat), kq = m?.kq || KQ?.[t.mat];
    const ctTren = KIEM_KE.filter((x) => x.mat === t.mat).reduce((o, x) => ((o[x.loai] = (o[x.loai] || 0) + 1), o), {});
    for (const c of [...tang.chon.children]) tang.chon.remove(c);
    if (m) { const p = [], o = 0.3, A = [m.a[0] + m.n[0] * o, m.a[1] + m.n[1] * o], B = [m.b[0] + m.n[0] * o, m.b[1] + m.n[1] * o]; for (const dd of [0, 0.15, 0.3]) chuNhat(p, [A[0], m.y0 - dd, A[1]], [B[0], m.y0 - dd, B[1]], [B[0], m.y1 + dd, B[1]], [A[0], m.y1 + dd, A[1]]); const l = net(p, '#ff00ff', false, 1); if (l) tang.chon.add(l); }
    const lech = d?.dinh != null && !d.chong ? +(k.yTren - d.dinh).toFixed(1) : null;
    chon.innerHTML = `<div style="display:flex;justify-content:space-between"><b>${k?.tags?.name || kid}</b><button style="background:none;border:none;color:var(--mo);cursor:pointer">✕</button></div>` +
      `<div><b>1 · Khối</b> ${kid} — <span style="color:${MAU[d?.tt] || '#fff'}">${TEN[d?.tt] || 'chưa có trạng thái'}</span><br>đỉnh mô hình ${k?.yTren?.toFixed(1)} m · ${d?.dinh != null ? (d.chong ? `đỉnh thật đo lẫn khối chồng trên (${d.dinh} m)` : `đỉnh thật ${d.dinh} m → <b style="color:${Math.abs(lech) > 1.5 ? MAU.mat_sai : MAU.mat_khop}">${lech > 0 ? 'cao hơn' : 'thấp hơn'} ${Math.abs(lech)} m</b>`) : 'chưa đo được đỉnh thật'}</div>` +
      `<div style="margin-top:6px"><b>2 · Mặt tường</b> ${t.mat} — ${m ? `<span style="color:${MAU[m.loai]}">${{ mat_khop: 'kiểm kê khớp ảnh', mat_sai: 'kiểm kê ra lỗi', mat_so: 'có số đo từ ảnh, chưa kiểm kê', mat_luat: 'dựng theo luật chung, CHƯA ĐO' }[m.loai]}</span>` : 'mặt khuất / trong nhà'}` +
      (kq ? `<br>${kq.ten ? `kiểm kê "${kq.ten}"` : ''}${kq.anh ? ` · ảnh: ${kq.anh}` : ''} · ${kq.khop} mục khớp${kq.loi?.length ? `<br><span style="color:${MAU.mat_sai}">✗ ${kq.loi.join('<br>✗ ')}</span>` : ''}` : '') + '</div>' +
      `<div style="margin-top:6px"><b>3 · Chi tiết trên mặt</b> ${Object.entries(ctTren).map(([a, n]) => `${a} ${n}`).join(' · ') || 'chưa có chi tiết ghi sổ'}</div>`;
    chon.style.display = 'block'; chon.querySelector('button').onclick = () => { chon.style.display = 'none'; for (const c of [...tang.chon.children]) tang.chon.remove(c); };
  });
  if (nut) nut.onclick = (e) => { e.stopPropagation(); batTat(!goc.visible); };
  let nho = '0'; try { nho = localStorage.getItem('ns-kiem') || '0'; } catch {}
  return { batTat, dangBat: () => goc.visible, nho: nho === '1' };
}
