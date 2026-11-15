// NHIỀU NGƯỜI (phía trang) — nối máy chủ kênh castle-kenh (apps/castle/server/kenh.mjs) qua wss://<host>/mp/ws/<lâu đài>?kenh=…
// Nút 👥: bảng chọn kênh (số người / trần, kênh đầy khoá), phòng riêng theo mã 4 ký tự, ô chat. Vào đi bộ là tự vào kênh đông nhất còn chỗ (hoặc kênh lần trước).
// Người khác: nhân vật cùng bộ xương (taoNguoi), tên trên đầu, bóng chữ chat 6 s, vị trí nội suy mượt giữa các gói 10 lần/s.
// taoNhieuNguoi({ THREE, scene, lau, nut, layTrangThai: () => ({ p:{x,y,z}, h, s }) | null, taoNguoi: (ao) => avatar, chauY: 0.9 }) → { capNhat(dt) }
const AO = ['hiepSi', 'nongDan', 'thuongNhan'];
const CSS = `
#nn { position: fixed; right: 12px; bottom: 64px; width: min(300px, calc(100vw - 24px)); display: none; padding: 12px; z-index: 7; }
#nn b { font-size: 14px; } #nn .d { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; }
#nn .d span:first-child { flex: 1; } #nn button { font: 600 12px system-ui, sans-serif; color: var(--chu); background: rgba(255,255,255,.08); border: 1px solid var(--vien); border-radius: 7px; padding: 4px 9px; cursor: pointer; }
#nn button.chon { background: #ffd9a8; color: #1a1208; } #nn button:disabled { opacity: .45; } #nn input { width: 100%; font: inherit; color: var(--chu); background: rgba(0,0,0,.35); border: 1px solid var(--vien); border-radius: 7px; padding: 5px 8px; }
#nn .mo { color: var(--mo); font-size: 12px; margin-top: 6px; }`;

export function taoNhieuNguoi({ THREE, scene, lau, nut, layTrangThai, taoNguoi, chauY = 0.9 }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const bang = document.createElement('div'); bang.id = 'nn'; bang.className = 'o'; document.body.append(bang);
  const khac = new Map(); // id → { av, ten, nhan, p, h, s, lucChat }
  let ws = null, kenh = null, ten = '', tb = '', lucGui = 0, dsKenh = null, toi = null;
  let nho = null; try { nho = localStorage.getItem('nn-kenh-' + lau); } catch {}
  const MP = window.__mpGoc || ''; // chỉ bài thử trên máy dev đặt (máy chủ kênh chạy cổng khác); trang thật dùng cùng host qua nginx /mp/
  const goc = MP ? `${MP.replace(/^http/, 'ws')}/mp/ws/${lau}` : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/mp/ws/${lau}`;

  function nhanTen(chu, chat) { // sprite chữ trên đầu (tên + bóng chat)
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 512; c.height = chat ? 160 : 64;
    g.font = '600 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (chat) { g.fillStyle = 'rgba(255,250,240,.94)'; g.beginPath(); g.roundRect(8, 4, 496, 96, 18); g.fill(); g.fillStyle = '#1a1208'; const t = chat.length > 34 ? chat.slice(0, 33) + '…' : chat; g.fillText(t, 256, 52); }
    g.fillStyle = 'rgba(14,20,30,.7)'; const w = Math.min(500, g.measureText(chu).width + 28), y0 = chat ? 104 : 4; g.beginPath(); g.roundRect(256 - w / 2, y0, w, 52, 12); g.fill();
    g.fillStyle = '#ffe2b8'; g.fillText(chu, 256, y0 + 27);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.scale.set(3.2, 3.2 * c.height / 512, 1); sp.renderOrder = 10; return sp;
  }
  function datNhan(k, chat) { if (k.nhan) { k.av.goc.remove(k.nhan); k.nhan.material.map.dispose(); k.nhan.material.dispose(); } k.nhan = nhanTen(k.ten, chat); k.nhan.position.y = chat ? 2.45 : 2.15; k.av.goc.add(k.nhan); }
  function bo(id) { const k = khac.get(id); if (!k) return; scene.remove(k.av.goc); khac.delete(id); }
  function boHet() { for (const id of [...khac.keys()]) bo(id); }

  async function napKenh() { try { dsKenh = await (await fetch(`${MP}/mp/kenh?lau=${lau}`, { cache: 'no-store', credentials: 'same-origin' })).json(); } catch (e) { dsKenh = null; console.warn('[nn] không lấy được danh sách kênh', e); } ve(); }
  function vaoKenh(id) {
    if (ws) { ws.onclose = null; ws.close(); ws = null; } boHet(); kenh = id; tb = 'Đang vào…'; ve();
    const w = new WebSocket(`${goc}?kenh=${encodeURIComponent(id)}${window.__mpThu ? '&thu=' + encodeURIComponent(window.__mpThu) : ''}`); ws = w;
    w.onmessage = (e) => { let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d.t === 'chao') { ten = d.ten; tb = ''; try { localStorage.setItem('nn-kenh-' + lau, id); } catch {} napKenh(); }
      else if (d.t === 'ds') { const co = new Set(); for (const [nid, nten, x, y, z, h, s] of d.n) { co.add(nid); let k = khac.get(nid);
          if (!k) { k = { av: taoNguoi(AO[parseInt(nid, 36) % AO.length]), ten: nten, p: new THREE.Vector3(x, y, z), h, s }; datNhan(k); scene.add(k.av.goc); khac.set(nid, k); }
          k.dich = new THREE.Vector3(x, y, z); k.hDich = h; k.s = s || {}; }
        for (const nid of [...khac.keys()]) if (!co.has(nid)) bo(nid); }
      else if (d.t === 'ra') bo(d.id);
      else if (d.t === 'chat') { const k = khac.get(d.id); if (k) { datNhan(k, d.c); k.lucChat = performance.now(); } else if (d.ten === ten) tb = 'Bạn: ' + d.c; ve(); } };
    w.onclose = () => { if (ws !== w) return; ws = null; boHet(); tb = kenh ? 'Mất kết nối kênh (kênh đầy hoặc máy chủ bận) — chọn kênh khác' : ''; kenh = null; napKenh(); };
  }
  function roiKenh() { if (ws) { ws.onclose = null; ws.close(); } ws = null; kenh = null; boHet(); tb = 'Đã tắt nhiều người'; try { localStorage.setItem('nn-kenh-' + lau, 'tat'); } catch {} ve(); }
  // tự vào: kênh đông ĐÔNG NHẤT còn chỗ (lấp đầy kênh 1 rồi mới sang kênh 2) — chọn kênh vắng nhất thì người rải mỗi kênh một người, không ai gặp ai
  function kenhTuVao() { const ds = dsKenh?.kenh?.filter((k) => k.kieu === 'dong' && k.so < k.toiDa) || []; ds.sort((a, b) => b.so - a.so || a.id.localeCompare(b.id)); return ds[0]?.id || 'k1'; }

  function ve() {
    if (bang.style.display !== 'block') return;
    const dong = (k) => `<div class="d"><span>${k.ten}${k.kieu === 'yen' ? ' <span class="mo">(đi ngắm một mình)</span>' : ''}</span><span class="mo">${k.so}/${k.toiDa}</span><button data-k="${k.id}" class="${kenh === k.id ? 'chon' : ''}" ${k.so >= k.toiDa && kenh !== k.id ? 'disabled' : ''}>${kenh === k.id ? 'Đang ở' : k.so >= k.toiDa ? 'Đầy' : 'Vào'}</button></div>`;
    bang.innerHTML = `<b>👥 Kênh nhiều người</b>${ten ? ` <span class="mo">· bạn là ${ten}</span>` : ''}
      ${dsKenh ? dsKenh.kenh.map(dong).join('') : '<div class="mo">Đang lấy danh sách kênh…</div>'}
      <div class="d"><span>Phòng riêng (mã 4 ký tự, tối đa ${dsKenh?.toiDaRieng ?? 10})</span></div>
      <div class="d"><input id="nn-ma" maxlength="4" placeholder="vd: ab12" value="${kenh?.startsWith('r-') ? kenh.slice(2) : ''}"><button id="nn-vao-ma">Vào</button><button id="nn-tao">Tạo</button></div>
      ${kenh ? `<div class="d"><input id="nn-chat" maxlength="120" placeholder="Nói gì đó… (Enter gửi)"><button id="nn-gui">Gửi</button></div>` : ''}
      <div class="d"><span class="mo">${tb || (kenh ? `Ở ${kenh.startsWith('r-') ? 'phòng riêng ' + kenh.slice(2) : dsKenh?.kenh.find((k) => k.id === kenh)?.ten || kenh} · thấy người trong 200 m` : 'Chưa vào kênh')}</span>${kenh ? '<button id="nn-tat">Tắt</button>' : ''}<button id="nn-dong">✕</button></div>`;
    bang.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => vaoKenh(b.dataset.k); });
    const ma = bang.querySelector('#nn-ma'), vaoMa = () => { const v = ma.value.toLowerCase().replace(/[^a-z0-9]/g, ''); if (v.length === 4) vaoKenh('r-' + v); else { tb = 'Mã phải đủ 4 chữ / số'; ve(); } };
    bang.querySelector('#nn-vao-ma').onclick = vaoMa;
    bang.querySelector('#nn-tao').onclick = () => { ma.value = Math.random().toString(36).slice(2, 6).padEnd(4, '0'); vaoMa(); };
    const chat = bang.querySelector('#nn-chat'), gui = () => { const c = chat.value.trim(); if (c && ws?.readyState === 1) { ws.send(JSON.stringify({ t: 'chat', c })); chat.value = ''; } };
    if (chat) { bang.querySelector('#nn-gui').onclick = gui; chat.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') gui(); }); }
    bang.querySelector('#nn-tat')?.addEventListener('click', roiKenh);
    bang.querySelector('#nn-dong').onclick = () => { bang.style.display = 'none'; };
    for (const i of bang.querySelectorAll('input')) i.addEventListener('keydown', (e) => e.stopPropagation()); // gõ không lọt xuống game
  }
  nut.onclick = (e) => { e.stopPropagation(); bang.style.display = bang.style.display === 'block' ? 'none' : 'block'; napKenh(); };

  return {
    capNhat(dt) {
      const tt = layTrangThai(), now = performance.now();
      if (tt && !ws && !kenh && nho !== 'tat' && !toi) { toi = setTimeout(async () => { await napKenh(); toi = null; if (!ws && layTrangThai()) vaoKenh(nho && nho !== 'tat' && (nho.startsWith('r-') || dsKenh?.kenh.some((k) => k.id === nho && k.so < k.toiDa)) ? nho : kenhTuVao()); }, 400); } // vào đi bộ → tự vào kênh
      if (ws?.readyState === 1 && tt && now - lucGui > 100) { lucGui = now; ws.send(JSON.stringify({ t: 'vt', p: [tt.p.x, tt.p.y, tt.p.z], h: tt.h, s: tt.s })); }
      for (const k of khac.values()) {
        if (k.dich) k.p.lerp(k.dich, Math.min(1, dt * 10)); if (k.hDich != null) { const l = Math.atan2(Math.sin(k.hDich - k.h), Math.cos(k.hDich - k.h)); k.h += l * Math.min(1, dt * 10); }
        k.av.goc.position.set(k.p.x, k.p.y - chauY, k.p.z); k.av.goc.rotation.y = k.h;
        const s = k.s || {}; k.av.capNhat(dt, { toc: s.toc || 0, nen: s.nen !== false, tuThe: s.tt === 'leo' ? 'leo' : s.tt === 'boi' ? 'boi' : s.ngoi ? 'cuoi' : null, tocLeo: s.tt === 'leo' ? s.toc : 0, phaLeo: now / 400 });
        if (k.lucChat && now - k.lucChat > 6000) { k.lucChat = 0; datNhan(k); }
      }
    },
    get kenh() { return kenh; }, get soNguoi() { return khac.size; },
  };
}
