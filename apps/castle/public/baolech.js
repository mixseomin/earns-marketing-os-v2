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
@keyframes blChay { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,158,11,.6) } 50% { transform: scale(1.14); box-shadow: 0 0 0 6px rgba(245,158,11,0) } }
@keyframes blNhay { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,.9); border-color: #4ade80 } 100% { box-shadow: 0 0 0 14px rgba(74,222,128,0) } }
.bl-dang { animation: blChay .9s ease-in-out infinite; border-color: #f59e0b !important; }
.bl-xong { animation: blNhay .7s ease-out 3; }
#bl-bao { position: fixed; right: 16px; bottom: 76px; z-index: 9; width: min(380px, calc(100vw - 32px)); padding: 12px 14px; background: var(--o); border: 1px solid #4ade80; border-radius: 12px; color: var(--chu); font-size: 13px; display: none; backdrop-filter: blur(6px); }
#bl-bao b { color: #4ade80; } #bl-bao .dong { float: right; cursor: pointer; color: var(--mo); background: none; border: none; font-size: 15px; } #bl-bao p { margin: 6px 0 0; white-space: pre-wrap; } #bl-bao a { color: #ffd9a8; }
#bl-bao.dang { border-color: #f59e0b; } #bl-bao.dang b { color: #f59e0b; }
#bl button.chinh { background: #ffd9a8; color: #1a1208; border-color: #ffd9a8; } #bl button:disabled { opacity: .55; cursor: default; }`;

export function ganBaoLech({ nut, chupHai }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const bl = document.createElement('div'); bl.id = 'bl';
  bl.innerHTML = `<div>
  <b>🔍 Báo chỗ ảnh thật khác mô hình — ở đúng góc đang nhìn</b>
  <div class="hang">Đánh dấu vùng lỗi (tuỳ chọn, vẽ trên ảnh nào cũng được) — máy tự so cả hai bản để tìm chỗ sai. Vẽ bằng: <label><input type="radio" name="bl-cu" value="o" checked> ▭ Khung</label><label><input type="radio" name="bl-cu" value="m"> ➜ Mũi tên</label><label><input type="radio" name="bl-cu" value="b"> ✎ Bút</label></div>
  <div class="hai"><figure><figcaption>Mô hình 3D</figcaption><img class="a1"><canvas class="c1"></canvas></figure>
    <figure><figcaption>Ảnh thật 3D (Google)</figcaption><img class="a2"><canvas class="c2"></canvas></figure></div>
  <textarea placeholder="Ghi chú (tuỳ chọn): sai gì, ví dụ: tháp này thiếu tầng, mái thấp quá…"></textarea>
  <div class="tom hang" style="color:var(--chu)"></div>
  <div class="kq"></div>
  <div class="ls hang"></div>
  <div class="hang" style="justify-content:flex-end"><button class="xoa">Xoá nét đỏ</button><button class="dong">Đóng</button><button class="gui chinh">Gửi báo lệch</button></div>
</div>`;
  document.body.append(bl);
  const $q = (s) => bl.querySelector(s), kq = $q('.kq'), gui = $q('.gui'), net = []; // net: các hình đỏ { k: 'o' khung | 'm' mũi tên | 'b' bút, p: [[u, v], …] } chuẩn hoá 0–1 (khung / mũi tên: điểm đầu + điểm cuối)
  let du = null, ve = null;
  // vẽ một hình lên ngữ cảnh g, ảnh rộng W cao H lệch ngang ox
  const veHinh = (g, h, ox, W, H) => { const P = h.p.map(([u, v]) => [ox + u * W, v * H]); g.strokeStyle = g.fillStyle = h.mau || '#ff2020'; g.beginPath(); // mau: vùng YÊU CẦU gốc (vàng) khi mở lại một báo cáo
    if (h.k === 'o' && P.length > 1) { const [[a, b], [c, d]] = [P[0], P.at(-1)]; g.rect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); g.stroke(); return; }
    if (h.k === 'm' && P.length > 1) { const [[a, b], [c, d]] = [P[0], P.at(-1)], goc = Math.atan2(d - b, c - a), r = Math.max(14, W / 45); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
      g.beginPath(); g.moveTo(c, d); g.lineTo(c - r * Math.cos(goc - 0.45), d - r * Math.sin(goc - 0.45)); g.lineTo(c - r * Math.cos(goc + 0.45), d - r * Math.sin(goc + 0.45)); g.closePath(); g.fill(); return; }
    P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  const veLai = () => { for (const c of [$q('.c1'), $q('.c2')]) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.strokeStyle = '#ff2020'; g.lineWidth = Math.max(3, c.width / 260); g.lineJoin = g.lineCap = 'round';
    for (const h of net) veHinh(g, h, 0, c.width, c.height); } };
  for (const c of [$q('.c1'), $q('.c2')]) {
    const uv = (e) => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    c.onpointerdown = (e) => { c.setPointerCapture(e.pointerId); ve = { k: bl.querySelector('input[name=bl-cu]:checked').value, p: [uv(e)] }; net.push(ve); veLai(); };
    c.onpointermove = (e) => { if (!ve) return; const p = uv(e); if (ve.k === 'b') { const q = ve.p.at(-1); if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.004) ve.p.push(p); } else ve.p[1] = p; veLai(); };
    c.onpointerup = c.onpointercancel = () => { if (ve && ve.p.length < 2) net.pop(); ve = null; veLai(); }; // bấm không kéo: bỏ
  }
  const nap = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  // mo(baoCu): baoCu = một báo cáo đã gửi { id, cam, vung, tom } → camera về ĐÚNG góc đó, chụp lại hai bản (mô hình HIỆN TẠI sau khi sửa · ảnh thật),
  // vẽ lại vùng anh đánh dấu bằng màu vàng → so yêu cầu với kết quả ngay trên castle.on.tc
  async function mo(baoCu = null) {
    $q('b').textContent = baoCu ? `🔍 Đối chiếu báo lệch #${baoCu.id} — vùng VÀNG là chỗ anh đã đánh dấu, ảnh trái là mô hình hiện tại` : '🔍 Báo chỗ ảnh thật khác mô hình — ở đúng góc đang nhìn';
    $q('.tom').textContent = baoCu?.tom ? 'Kết quả máy: ' + baoCu.tom : ''; veLs();
    kq.textContent = 'Đang chụp hai bản ở góc này (chờ ảnh thật tải đủ)…'; kq.className = 'kq'; net.length = 0; bl.style.display = 'grid'; gui.disabled = true;
    try {
      du = await chupHai(baoCu?.cam || null);
      for (const n of baoCu?.vung || []) net.push({ k: 'b', p: n, mau: '#ffd400', goc: true });
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
      for (const ox of [0, W + 8]) for (const h of net) veHinh(g, h, ox, W, H);
      const anh = c.toDataURL('image/jpeg', 0.82), ghi = $q('textarea').value.trim();
      // máy chủ giữ ngữ cảnh ≤ 1 000 ký tự, nội dung ≤ 4 000: camera vào ngữ cảnh, vùng tô (mỗi nét rút còn ≤ 16 điểm) cuối nội dung
      const rut = (n) => { const b = Math.max(1, Math.ceil(n.length / 16)); return n.filter((_, i) => i % b === 0 || i === n.length - 1).map(([u, v]) => [+u.toFixed(3), +v.toFixed(3)]); };
      // gửi CLI dạng nét điểm (so-lech.py lấy hộp bao từng nét): khung → 4 góc, mũi tên → ô quanh MŨI (chỗ chỉ vào), bút → rút gọn
      const r3 = (x) => +x.toFixed(3), duong = net.filter((h) => !h.goc).map((h) => { if (h.k === 'o') { const [[a, b], [c, d]] = [h.p[0], h.p.at(-1)]; return [[a, b], [c, b], [c, d], [a, d], [a, b]].map(([u, v]) => [r3(u), r3(v)]); }
        if (h.k === 'm') { const [u, v] = h.p.at(-1); return [[r3(u - 0.04), r3(v - 0.04)], [r3(u + 0.04), r3(v + 0.04)]]; } return rut(h.p); });
      let vung = JSON.stringify(duong); if (vung.length > 2500) vung = JSON.stringify(duong.map((n) => { const us = n.map((p) => p[0]), vs = n.map((p) => p[1]); return [[Math.min(...us), Math.min(...vs)], [Math.max(...us), Math.max(...vs)]].map(([u, v]) => [+u.toFixed(3), +v.toFixed(3)]); }));
      const r = await fetch('/api/gop-y', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ noiDung: `[LỆCH ẢNH THẬT] ${ghi || '(không ghi chú — xem vùng tô đỏ / để máy tự so)'}${net.length ? `\n\nVUNG-JSON:${vung}` : ''}`, loai: 'loi', trang: location.href, nguCanh: 'LECH-JSON:' + JSON.stringify(du.cam), anh }) });
      const j = await r.json().catch(() => ({ ok: false, error: `máy chủ trả ${r.status}` }));
      if (!j.ok) throw new Error(j.error || `máy chủ trả ${r.status}`);
      kq.textContent = `Đã gửi báo lệch #${j.id}. Máy sẽ so lại đúng góc này.`; $q('textarea').value = ''; setTimeout(dong, 1800);
    } catch (e) { kq.textContent = 'Gửi không được: ' + (e.message || e); kq.className = 'kq loi'; }
    gui.disabled = false;
  }
  // TRẠNG THÁI XỬ LÝ (castle-kenh /mp/lech, CLI so-lech.mjs ghi): hỏi mỗi 3 s kể cả khi tab không focus — đang có việc → nút 🔍 nhún viền vàng,
  // di chuột / chạm giữ thấy đang làm gì; có báo cáo xong MỚI (chưa xem trên máy này) → nút nháy xanh + thẻ báo cáo góc phải dưới, bấm ✕ là đã xem
  const bao = document.createElement('div'); bao.id = 'bl-bao'; document.body.append(bao);
  let daXem = 0; try { daXem = +localStorage.getItem('ns-lech-da-xem') || 0; } catch {}
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let ttMoi = { dang: [], xong: [] };
  const nutXem = (x) => (x.cam ? ` <button class="xem" data-id="${esc(x.id)}" style="font:600 12px system-ui;margin-top:6px;padding:4px 10px;border-radius:7px;border:1px solid var(--vien);background:#ffd9a8;color:#1a1208;cursor:pointer">📍 Xem tại góc báo</button>` : '');
  const ganXem = (el) => el.querySelectorAll('button.xem').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const x = [...ttMoi.xong, ...ttMoi.dang].find((q) => q.id === b.dataset.id); if (x) mo(x); }; });
  function veLs() { const ds = ttMoi.xong.filter((x) => x.cam).slice(0, 6), el = $q('.ls'); el.innerHTML = ds.length ? 'Báo cáo trước:' + ds.map((x) => ` <button class="xem" data-id="${esc(x.id)}">#${esc(x.id)}</button>`).join('') : ''; ganXem(el); }
  async function hoiTT() {
    try {
      const r = await fetch('/mp/lech', { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); ttMoi = { dang: j.dang || [], xong: j.xong || [] };
      const dang = (j.dang || []).filter((x) => Date.now() - x.luc < 6 * 3600e3), moi = (j.xong || []).filter((x) => x.luc > daXem);
      nut.classList.toggle('bl-dang', dang.length > 0 && !moi.length);
      nut.title = dang.length ? `Đang xử báo lệch: ${dang.map((x) => '#' + x.id + ' ' + x.viec).join(' · ')}` : 'Báo chỗ ảnh thật khác mô hình 3D ở đúng góc đang nhìn (máy tự so hai bản, đánh dấu vùng lỗi nếu muốn)';
      if (moi.length) { if (!nut.classList.contains('bl-xong')) { nut.classList.add('bl-xong'); }
        bao.className = ''; bao.innerHTML = '<button class="dong" title="Đã xem">✕</button>' + moi.map((x) => `<b>✅ Báo lệch #${esc(x.id)} đã xong</b><p>${esc(x.tom)}</p>${nutXem(x)}`).join('<hr style="border:0;border-top:1px solid var(--vien)">'); ganXem(bao);
        bao.style.display = 'block'; bao.querySelector('.dong').onclick = () => { daXem = Math.max(...moi.map((x) => x.luc)); try { localStorage.setItem('ns-lech-da-xem', String(daXem)); } catch {} bao.style.display = 'none'; nut.classList.remove('bl-xong'); hoiTT(); }; }
      else if (dang.length && bao.dataset.mo !== '0') { bao.className = 'dang'; bao.innerHTML = '<button class="dong">✕</button>' + dang.map((x) => `<b>⏳ Đang xử #${esc(x.id)}</b><p>${esc(x.viec)}</p>${nutXem(x)}`).join(''); ganXem(bao); bao.style.display = 'block'; bao.querySelector('.dong').onclick = () => { bao.dataset.mo = '0'; bao.style.display = 'none'; }; }
      else if (bao.className === 'dang') bao.style.display = 'none';
    } catch { /* mạng chập: lượt sau hỏi lại */ }
  }
  hoiTT(); setInterval(hoiTT, 3000);
  nut.onclick = (e) => { e.stopPropagation(); bao.dataset.mo = '1'; mo(); }; // bấm nút: thẻ "đang xử" hiện lại nếu đã tắt
  $q('.dong').onclick = dong; gui.onclick = guiDi; $q('.xoa').onclick = () => { for (let i = net.length - 1; i >= 0; i--) if (!net[i].goc) net.splice(i, 1); veLai(); };
  addEventListener('keydown', (e) => { if (bl.style.display !== 'grid') return; e.stopImmediatePropagation(); if (e.key === 'Escape') dong(); }, true);
  return { mo, dong };
}
