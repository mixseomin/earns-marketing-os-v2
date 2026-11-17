// 📷 ẢNH THẬT QUANH ĐÂY (anh 17/11/2026: "thêm tính năng tìm ảnh trên mạng tại vị trí đó"): bấm 📷 → lấy điểm đang nhìn giữa màn (tia từ camera;
// trúng trời thì chỗ đang đứng / tâm toàn cảnh) → máy chủ kênh tìm ảnh Commons + Mapillary quanh đó (GET /mp/anh-quanh, server/anh-quanh.mjs)
// → lưới ảnh nhỏ (nguồn · cách bao nhiêu m · tác giả · giấy phép), ghim 📷 đánh dấu điểm trong cảnh. Bấm ảnh = chọn (tối đa 6 — thẻ góp ý giữ tối đa 1.000 ký tự ngữ cảnh); bấm 🔎 = xem lớn + mở nguồn.
// Ảnh đã chọn đi kèm góp ý 💬 / báo lệch 🔍 dưới dạng ANH-THAT-JSON:[…] → kỹ sư (Thắng) tải về bằng scripts/tim-anh.mjs --the <id> để đo / sửa.
// ganAnhQuanh({ THREE, scene, nut, layDiem: () => { x, y, z, ten }, raLatLng: (x, z) => [lat, lng], moGopY }) → { daChon() → [], nguCanh() → string }
const CSS = `
#aq { position: fixed; right: 12px; top: 64px; bottom: 64px; width: min(420px, calc(100vw - 24px)); display: none; flex-direction: column; padding: 12px; z-index: 12; } /* trên thẻ báo cáo 🔍 (#bl-bao z 9) — bảng đang mở là bảng anh đang dùng */
#aq .dau { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } #aq .dau b { font-size: 14px; flex: 1; }
#aq button { font: 600 12px system-ui, sans-serif; color: var(--chu); background: rgba(255,255,255,.08); border: 1px solid var(--vien); border-radius: 7px; padding: 4px 9px; cursor: pointer; }
#aq button.chon { background: #ffd9a8; color: #1a1208; } #aq button:disabled { opacity: .45; cursor: default; }
#aq .mo { color: var(--mo); font-size: 12px; margin-top: 6px; }
#aq .luoi { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; align-content: start; }
#aq .o-anh { position: relative; border: 2px solid transparent; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,.3); cursor: pointer; }
#aq .o-anh.da { border-color: #ffd9a8; } #aq .o-anh img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
#aq .o-anh .nhan { font-size: 11px; padding: 4px 6px; line-height: 1.35; } #aq .o-anh .tick { position: absolute; top: 6px; left: 6px; background: #ffd9a8; color: #1a1208; border-radius: 50%; width: 20px; height: 20px; display: none; place-items: center; font-weight: 700; font-size: 12px; }
#aq .o-anh.da .tick { display: grid; } #aq .o-anh .xem { position: absolute; top: 6px; right: 6px; padding: 2px 6px; }
#aq .chan { display: flex; gap: 6px; align-items: center; margin-top: 8px; } #aq .chan span { flex: 1; font-size: 12px; }
#aq-lon { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,.85); display: none; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 10px; }
#aq-lon img { max-width: 100%; max-height: calc(100% - 60px); object-fit: contain; } #aq-lon div { color: #eee; font: 13px system-ui, sans-serif; text-align: center; } #aq-lon a { color: #ffd9a8; }`;
const TOI_DA = 6, esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function ganAnhQuanh({ THREE, scene, nut, layDiem, raLatLng, moGopY }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const bang = document.createElement('div'); bang.id = 'aq'; bang.className = 'o'; document.body.append(bang);
  const lon = document.createElement('div'); lon.id = 'aq-lon'; document.body.append(lon);
  lon.onclick = (e) => { if (e.target === lon || e.target.tagName === 'IMG') lon.style.display = 'none'; };
  let diem = null, ds = [], chon = new Map(), tt = '', r = 100, dangTim = false;
  const MP = window.__mpGoc || '';
  // ghim 📷 đánh dấu điểm đang tìm (cỡ cố định trên màn)
  const ghim = (() => {
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 96; c.height = 112;
    g.fillStyle = 'rgba(14,20,30,.85)'; g.beginPath(); g.arc(48, 44, 40, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(30, 76); g.lineTo(66, 76); g.lineTo(48, 108); g.fill();
    g.font = '40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('📷', 48, 46);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.scale.set(0.045, 0.0525, 1); sp.center.set(0.5, 0); sp.renderOrder = 12; sp.visible = false; scene.add(sp); return sp;
  })();

  async function tim() {
    diem = layDiem(); if (!diem) { tt = 'Không lấy được điểm đang nhìn'; ve(); return; }
    ghim.position.set(diem.x, diem.y, diem.z); ghim.visible = true;
    const [lat, lng] = raLatLng(diem.x, diem.z); diem.lat = lat; diem.lng = lng;
    dangTim = true; tt = 'Đang tìm ảnh trên Wikimedia Commons + Mapillary…'; ds = []; chon = new Map(); ve();
    try {
      const j = await (await fetch(`${MP}/mp/anh-quanh?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&r=${r}`, { cache: 'no-store', credentials: 'same-origin' })).json();
      ds = j.anh || []; tt = ds.length ? '' : `Không có ảnh nào có toạ độ trong ${r} m — thử nới bán kính`;
      if (j.loi?.length) tt = (tt ? tt + ' · ' : '') + 'nguồn lỗi: ' + j.loi.join('; ');
      if (j.coMapillary === false) tt = (tt ? tt + ' · ' : '') + 'máy chủ chưa có khoá Mapillary (chỉ Commons)';
    } catch (e) { tt = 'Lỗi tìm ảnh: ' + e.message; }
    dangTim = false; ve();
  }
  function xemLon(a) {
    lon.innerHTML = `<img src="${esc(a.lon)}" alt=""><div>${esc(a.tacGia)} · ${esc(a.giayPhep)}${a.luc ? ' · ' + esc(a.luc) : ''} · cách điểm ${a.kc} m · <a href="${esc(a.trang)}" target="_blank" rel="noopener">mở nguồn ↗</a> — bấm ảnh để đóng</div>`;
    lon.style.display = 'flex';
  }
  function ve() {
    if (bang.style.display !== 'flex') return;
    bang.innerHTML = `<div class="dau"><b>📷 Ảnh thật quanh ${esc(diem?.ten || 'điểm đang nhìn')}</b>
        ${[60, 100, 200].map((x) => `<button data-r="${x}" class="${r === x ? 'chon' : ''}">${x} m</button>`).join('')}<button id="aq-lai" title="Tìm lại ở điểm đang nhìn giữa màn">↻</button><button id="aq-dong">✕</button></div>
      <div class="mo">${dangTim ? '' : `${ds.length} ảnh · Commons + Mapillary (chỉ ảnh có toạ độ chỗ chụp; Mapillary chỉ ảnh nhìn vào điểm) · bấm ảnh để chọn, 🔎 xem lớn`}</div>
      ${tt ? `<div class="mo">${esc(tt)}</div>` : ''}
      <div class="luoi">${ds.map((a, i) => `<div class="o-anh ${chon.has(a.nguon + a.id) ? 'da' : ''}" data-i="${i}"><img loading="lazy" src="${esc(a.nho)}" alt=""><span class="tick">✓</span><button class="xem" data-xem="${i}">🔎</button>
        <div class="nhan">${a.nguon === 'commons' ? 'Commons' : 'Mapillary'} · ${a.kc} m${a.luc ? ' · ' + esc(a.luc.slice(0, 4)) : ''}<br><span class="mo" style="margin:0">${esc(a.tacGia)} · ${esc(a.giayPhep)}</span></div></div>`).join('')}</div>
      <div class="chan"><span>Đã chọn ${chon.size}/${TOI_DA}</span><button id="aq-gy" ${chon.size ? '' : 'disabled'} title="Mở hộp góp ý — ảnh đã chọn tự đi kèm thẻ để kỹ sư tải về sửa">💬 Góp ý kèm ảnh</button></div>`;
    bang.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { r = +b.dataset.r; tim(); }; });
    bang.querySelector('#aq-lai').onclick = tim;
    bang.querySelector('#aq-dong').onclick = () => { bang.style.display = 'none'; ghim.visible = false; };
    bang.querySelector('#aq-gy').onclick = () => moGopY?.();
    bang.querySelectorAll('[data-xem]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); xemLon(ds[+b.dataset.xem]); }; });
    bang.querySelectorAll('.o-anh').forEach((o) => { o.onclick = () => { const a = ds[+o.dataset.i], k = a.nguon + a.id;
      if (chon.has(k)) chon.delete(k); else if (chon.size < TOI_DA) chon.set(k, a); ve(); }; });
  }
  nut.onclick = (e) => { e.stopPropagation(); if (bang.style.display === 'flex') { bang.style.display = 'none'; ghim.visible = false; return; } bang.style.display = 'flex'; tim(); };
  const daChon = () => [...chon.values()].map(({ nguon, id, lat, lng, kc, huong, lon: url, trang, tacGia, giayPhep, luc }) => ({ nguon, id, lat, lng, kc, huong, url, trang, tacGia, giayPhep, luc }));
  return {
    daChon,
    // thêm vào ngữ cảnh góp ý / báo lệch: điểm đang tìm + ảnh đã chọn (rỗng thì không thêm gì)
    // gọn (chỉ mã ảnh: c:<tên tệp Commons> · m:<id Mapillary>) — scripts/tim-anh.mjs tra ngược ra đường tải + tác giả + giấy phép
    nguCanh: () => { const a = daChon(); return a.length ? ` ANH-THAT-JSON:${JSON.stringify({ d: diem && { x: +diem.x.toFixed(1), z: +diem.z.toFixed(1), ten: diem.ten }, a: a.map((x) => (x.nguon === 'commons' ? 'c:' : 'm:') + x.id) })}` : ''; },
    anGhim: (an) => { ghim.visible = !an && bang.style.display === 'flex'; },
  };
}
