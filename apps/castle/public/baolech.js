// BÁO LỆCH ẢNH THẬT ↔ MÔ HÌNH 3D ở đúng góc đang nhìn (nút 🔍): chụp HAI bản cùng camera (mô hình dựng từ số đo · ảnh thật 3D Google), hiện cạnh nhau,
// người xem tô ĐỎ vùng lỗi (tuỳ chọn) + ghi chú → gửi hòm góp ý castle (/api/gop-y) kèm ảnh ghép + camera (vị trí, hướng, góc nhìn, khổ, khoảng cách zoom)
// + vùng tô (toạ độ chuẩn hoá 0–1 trên ảnh). CLI apps/castle/scripts/so-lech.mjs đọc lại đúng camera đó, chụp lại hai bản, tự tìm chỗ lệch.
// ganBaoLech({ nut, chupHai: async () => ({ moHinh, anhThat, cam }) }) — chupHai do ns.js cấp (dùng chung với CLI qua window.__ns.chupHaiBan)
// tra-repo-ok: hộp DOM + canvas vẽ tay nhỏ của trang, không có thư viện tương ứng.
const CSS = `
#bl { position: fixed; inset: 0; display: none; place-items: center; background: rgba(5,5,8,.6); z-index: 9; }
#bl > div { width: min(1100px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto; padding: 14px; background: var(--o); border: 1px solid var(--vien); border-radius: 12px; display: flex; flex-direction: column; gap: 10px; backdrop-filter: blur(6px); }
#bl .hai { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@media (max-width: 700px) { #bl .hai { grid-template-columns: 1fr; } }
#bl figure { margin: 0; position: relative; }
#bl figcaption { font-size: 12px; color: var(--mo); margin-bottom: 4px; }
#bl figure img { width: 100%; display: block; border-radius: 6px; }
#bl figure canvas { position: absolute; left: 0; bottom: 0; width: 100%; touch-action: none; cursor: crosshair; border-radius: 6px; }
#bl textarea { width: 100%; min-height: 60px; resize: vertical; font: inherit; color: var(--chu); background: rgba(0,0,0,.35); border: 1px solid var(--vien); border-radius: 8px; padding: 8px 10px; box-sizing: border-box; }
#bl .hang { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--mo); font-size: 13px; }
#bl .kq { font-size: 13px; min-height: 18px; } #bl .kq.loi { color: #ff9a8a; }
#bl button { font: 600 13px system-ui, sans-serif; color: var(--chu); background: rgba(255,255,255,.08); border: 1px solid var(--vien); border-radius: 8px; padding: 7px 14px; cursor: pointer; }
#bl button.chinh { background: #ffd9a8; color: #1a1208; border-color: #ffd9a8; } #bl button:disabled { opacity: .55; cursor: default; }`;

export function ganBaoLech({ nut, chupHai }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const bl = document.createElement('div'); bl.id = 'bl';
  bl.innerHTML = `<div>
  <b>🔍 Báo chỗ ảnh thật khác mô hình — ở đúng góc đang nhìn</b>
  <div class="hang">Tô đỏ lên vùng lỗi (tuỳ chọn, vẽ trên ảnh nào cũng được) — máy tự so cả hai bản để tìm chỗ sai.</div>
  <div class="hai"><figure><figcaption>Mô hình 3D</figcaption><img class="a1"><canvas class="c1"></canvas></figure>
    <figure><figcaption>Ảnh thật 3D (Google)</figcaption><img class="a2"><canvas class="c2"></canvas></figure></div>
  <textarea placeholder="Ghi chú (tuỳ chọn): sai gì, ví dụ: tháp này thiếu tầng, mái thấp quá…"></textarea>
  <div class="kq"></div>
  <div class="hang" style="justify-content:flex-end"><button class="xoa">Xoá nét đỏ</button><button class="dong">Đóng</button><button class="gui chinh">Gửi báo lệch</button></div>
</div>`;
  document.body.append(bl);
  const $q = (s) => bl.querySelector(s), kq = $q('.kq'), gui = $q('.gui'), net = []; // net: các nét đỏ, mỗi nét [[u, v], …] chuẩn hoá 0–1
  let du = null, ve = null;
  const veLai = () => { for (const c of [$q('.c1'), $q('.c2')]) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.strokeStyle = '#ff2020'; g.lineWidth = Math.max(3, c.width / 200); g.lineJoin = g.lineCap = 'round';
    for (const n of net) { g.beginPath(); n.forEach(([u, v], i) => (i ? g.lineTo(u * c.width, v * c.height) : g.moveTo(u * c.width, v * c.height))); g.stroke(); } } };
  for (const c of [$q('.c1'), $q('.c2')]) {
    const uv = (e) => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    c.onpointerdown = (e) => { c.setPointerCapture(e.pointerId); ve = [uv(e)]; net.push(ve); veLai(); };
    c.onpointermove = (e) => { if (!ve) return; const p = uv(e), q = ve.at(-1); if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.004) { ve.push(p); veLai(); } };
    c.onpointerup = c.onpointercancel = () => { ve = null; };
  }
  const nap = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  async function mo() {
    kq.textContent = 'Đang chụp hai bản ở góc này (chờ ảnh thật tải đủ)…'; kq.className = 'kq'; net.length = 0; bl.style.display = 'grid'; gui.disabled = true;
    try {
      du = await chupHai();
      for (const [a, c, s] of [[$q('.a1'), $q('.c1'), du.moHinh], [$q('.a2'), $q('.c2'), du.anhThat || du.moHinh]]) { const i = await nap(s); a.src = s; c.width = i.width; c.height = i.height; }
      veLai(); kq.textContent = du.anhThat ? '' : 'Ảnh thật 3D chưa nạp được — chỉ gửi mô hình.'; gui.disabled = false;
    } catch (e) { kq.textContent = 'Chụp không được: ' + (e.message || e); kq.className = 'kq loi'; }
  }
  const dong = () => { bl.style.display = 'none'; };
  async function guiDi() {
    gui.disabled = true; kq.textContent = 'Đang gửi…'; kq.className = 'kq';
    try {
      // ảnh ghép: mô hình | ảnh thật, nét đỏ vẽ lên cả hai — người đọc và CLI cùng nhìn
      const i1 = await nap(du.moHinh), i2 = await nap(du.anhThat || du.moHinh), W = i1.width, H = i1.height, c = document.createElement('canvas'); c.width = W * 2 + 8; c.height = H;
      const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i1, 0, 0, W, H); g.drawImage(i2, W + 8, 0, W, H);
      g.strokeStyle = '#ff2020'; g.lineWidth = Math.max(3, W / 200); g.lineJoin = g.lineCap = 'round';
      for (const ox of [0, W + 8]) for (const n of net) { g.beginPath(); n.forEach(([u, v], i) => (i ? g.lineTo(ox + u * W, v * H) : g.moveTo(ox + u * W, v * H))); g.stroke(); }
      const anh = c.toDataURL('image/jpeg', 0.82), ghi = $q('textarea').value.trim();
      // máy chủ giữ ngữ cảnh ≤ 1 000 ký tự, nội dung ≤ 4 000: camera vào ngữ cảnh, vùng tô (mỗi nét rút còn ≤ 16 điểm) cuối nội dung
      const rut = (n) => { const b = Math.max(1, Math.ceil(n.length / 16)); return n.filter((_, i) => i % b === 0 || i === n.length - 1).map(([u, v]) => [+u.toFixed(3), +v.toFixed(3)]); };
      let vung = JSON.stringify(net.map(rut)); if (vung.length > 2500) vung = JSON.stringify(net.map((n) => { const us = n.map((p) => p[0]), vs = n.map((p) => p[1]); return [[Math.min(...us), Math.min(...vs)], [Math.max(...us), Math.max(...vs)]].map(([u, v]) => [+u.toFixed(3), +v.toFixed(3)]); }));
      const r = await fetch('/api/gop-y', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ noiDung: `[LỆCH ẢNH THẬT] ${ghi || '(không ghi chú — xem vùng tô đỏ / để máy tự so)'}${net.length ? `\n\nVUNG-JSON:${vung}` : ''}`, loai: 'loi', trang: location.href, nguCanh: 'LECH-JSON:' + JSON.stringify(du.cam), anh }) });
      const j = await r.json().catch(() => ({ ok: false, error: `máy chủ trả ${r.status}` }));
      if (!j.ok) throw new Error(j.error || `máy chủ trả ${r.status}`);
      kq.textContent = `Đã gửi báo lệch #${j.id}. Máy sẽ so lại đúng góc này.`; $q('textarea').value = ''; setTimeout(dong, 1800);
    } catch (e) { kq.textContent = 'Gửi không được: ' + (e.message || e); kq.className = 'kq loi'; }
    gui.disabled = false;
  }
  nut.onclick = (e) => { e.stopPropagation(); mo(); };
  $q('.dong').onclick = dong; gui.onclick = guiDi; $q('.xoa').onclick = () => { net.length = 0; veLai(); };
  addEventListener('keydown', (e) => { if (bl.style.display !== 'grid') return; e.stopImmediatePropagation(); if (e.key === 'Escape') dong(); }, true);
  return { mo, dong };
}
