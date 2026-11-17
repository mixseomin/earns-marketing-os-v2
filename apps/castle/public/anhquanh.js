// 📷 ẢNH THẬT QUANH ĐÂY (anh 17/11/2026: "thêm tính năng tìm ảnh trên mạng tại vị trí đó"): bấm 📷 → lấy điểm đang nhìn giữa màn (tia từ camera;
// trúng trời thì chỗ đang đứng / tâm toàn cảnh) → máy chủ kênh tìm ảnh Commons + Mapillary quanh đó (GET /mp/anh-quanh, server/anh-quanh.mjs)
// → ẢNH LỚN ngay khi mở + dải ảnh nhỏ (nguồn · cách bao nhiêu m · tác giả · giấy phép), ghim 📷 đánh dấu điểm trong cảnh. ← → đổi ảnh, nút Chọn dưới ảnh lớn
// (tối đa 6 — thẻ góp ý giữ tối đa 1.000 ký tự ngữ cảnh), bấm ảnh lớn = toàn màn hình.
// Ảnh đã chọn đi kèm góp ý 💬 / báo lệch 🔍 dưới dạng ANH-THAT-JSON:[…] → kỹ sư (Thắng) tải về bằng scripts/tim-anh.mjs --the <id> để đo / sửa.
// ganAnhQuanh({ THREE, scene, nut, layDiem: () => { x, y, z, ten }, raLatLng: (x, z) => [lat, lng], moGopY }) → { daChon() → [], nguCanh() → string }
const CSS = `
#aq { position: fixed; right: 12px; top: 12px; bottom: 64px; width: min(880px, calc(100vw - 24px)); display: none; flex-direction: column; gap: 8px; padding: 12px; z-index: 12; }
#aq .dau { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } #aq .dau b { font-size: 15px; flex: 1; }
#aq button { font: 600 13px system-ui, sans-serif; color: var(--chu); background: rgba(255,255,255,.08); border: 1px solid var(--vien); border-radius: 8px; padding: 6px 11px; cursor: pointer; }
#aq button.chon { background: #ffd9a8; color: #1a1208; } #aq button:disabled { opacity: .45; cursor: default; }
#aq .mo { color: var(--mo); font-size: 12px; }
#aq .lon { flex: 1; min-height: 0; position: relative; background: #000; border-radius: 10px; overflow: hidden; display: grid; place-items: center; }
#aq .lon img { width: 100%; height: 100%; object-fit: contain; cursor: zoom-in; }
#aq .lon .mui { position: absolute; top: 50%; transform: translateY(-50%); font-size: 26px; padding: 10px 14px; background: rgba(0,0,0,.55); border: 0; }
#aq .lon .trai { left: 8px; } #aq .lon .phai { right: 8px; }
#aq .lon .so { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,.6); color: #fff; font: 600 12px system-ui, sans-serif; padding: 4px 8px; border-radius: 6px; }
#aq .tt-anh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; } #aq .tt-anh span { flex: 1; min-width: 200px; } #aq .tt-anh a { color: #ffd9a8; }
#aq .dai { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; flex: none; }
#aq .dai img { height: 84px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; border: 3px solid transparent; cursor: pointer; flex: none; opacity: .75; }
#aq .dai img.dang { border-color: #fff; opacity: 1; } #aq .dai img.da { border-color: #ffd9a8; opacity: 1; }
#aq .chan { display: flex; gap: 8px; align-items: center; } #aq .chan span { flex: 1; font-size: 13px; }
#aq-lon { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,.92); display: none; align-items: center; justify-content: center; cursor: zoom-out; }
#aq-lon img { max-width: 100%; max-height: 100%; object-fit: contain; }
@media (max-width: 640px) { #aq { top: 8px; right: 8px; width: calc(100vw - 16px); } #aq .dai img { height: 64px; } }`;
const TOI_DA = 6, esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function ganAnhQuanh({ THREE, scene, nut, layDiem, raLatLng, moGopY }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const bang = document.createElement('div'); bang.id = 'aq'; bang.className = 'o'; document.body.append(bang);
  const lon = document.createElement('div'); lon.id = 'aq-lon'; document.body.append(lon);
  lon.onclick = () => { lon.style.display = 'none'; };
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
    dangTim = true; tt = 'Đang tìm ảnh trên Wikimedia Commons + Mapillary…'; ds = []; dang = 0; chon = new Map(); ve();
    try {
      const j = await (await fetch(`${MP}/mp/anh-quanh?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&r=${r}`, { cache: 'no-store', credentials: 'same-origin' })).json();
      ds = j.anh || []; tt = ds.length ? '' : `Không có ảnh nào có toạ độ trong ${r} m — thử nới bán kính`;
      if (j.loi?.length) tt = (tt ? tt + ' · ' : '') + 'nguồn lỗi: ' + j.loi.join('; ');
      if (j.coMapillary === false) tt = (tt ? tt + ' · ' : '') + 'máy chủ chưa có khoá Mapillary (chỉ Commons)';
    } catch (e) { tt = 'Lỗi tìm ảnh: ' + e.message; }
    dangTim = false; ve();
  }
  // ẢNH LỚN NGAY KHI MỞ (anh 17/11/2026: "phải hiện kích thước to hơn… phải bấm quá nhiều"): ảnh đang xem chiếm gần hết bảng, dải ảnh nhỏ bên dưới
  // (bấm = xem ảnh đó), ← → đổi ảnh, nút Chọn ngay dưới ảnh lớn, bấm vào ảnh lớn = toàn màn hình. Không còn bước "bấm 🔎 mới thấy ảnh to".
  let dang = 0;
  const xemToanMan = (a) => { lon.innerHTML = `<img src="${esc(a.lon)}" alt="">`; lon.style.display = 'flex'; };
  function ve() {
    if (bang.style.display !== 'flex') return;
    const a = ds[dang], k = a && a.nguon + a.id;
    bang.innerHTML = `<div class="dau"><b>📷 Ảnh thật quanh ${esc(diem?.ten || 'điểm đang nhìn')}</b>
        ${[60, 100, 200].map((x) => `<button data-r="${x}" class="${r === x ? 'chon' : ''}">${x} m</button>`).join('')}<button id="aq-lai" title="Tìm lại ở điểm đang nhìn giữa màn">↻</button><button id="aq-dong">✕</button></div>
      ${tt || dangTim ? `<div class="mo">${esc(tt)}</div>` : ''}
      ${a ? `<div class="lon"><img src="${esc(a.lon)}" alt="" title="Bấm để xem toàn màn hình"><span class="so">${dang + 1} / ${ds.length}</span>
          <button class="mui trai" ${dang ? '' : 'disabled'}>‹</button><button class="mui phai" ${dang < ds.length - 1 ? '' : 'disabled'}>›</button></div>
        <div class="tt-anh"><span>${a.nguon === 'commons' ? 'Wikimedia Commons' : 'Mapillary'}${a.nhinVao ? ' · nhìn vào điểm' : ''} · chụp cách ${a.kc} m${a.luc ? ' · ' + esc(a.luc) : ''} · ${esc(a.tacGia)} · ${esc(a.giayPhep)} · <a href="${esc(a.trang)}" target="_blank" rel="noopener">nguồn ↗</a></span>
          <button id="aq-chon" class="${chon.has(k) ? 'chon' : ''}" ${!chon.has(k) && chon.size >= TOI_DA ? 'disabled' : ''}>${chon.has(k) ? '✓ Đã chọn' : '＋ Chọn ảnh này'}</button></div>
        <div class="dai">${ds.map((x, i) => `<img loading="lazy" data-i="${i}" src="${esc(x.nho)}" alt="" class="${i === dang ? 'dang' : ''} ${chon.has(x.nguon + x.id) ? 'da' : ''}">`).join('')}</div>` : ''}
      <div class="chan"><span>Đã chọn ${chon.size}/${TOI_DA} — ảnh chọn đi kèm thẻ góp ý để kỹ sư sửa theo · ← → đổi ảnh</span><button id="aq-gy" ${chon.size ? '' : 'disabled'}>💬 Góp ý kèm ảnh</button></div>`;
    bang.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { r = +b.dataset.r; tim(); }; });
    bang.querySelector('#aq-lai').onclick = tim;
    bang.querySelector('#aq-dong').onclick = dong;
    bang.querySelector('#aq-gy').onclick = () => moGopY?.();
    if (!a) return;
    bang.querySelector('.lon img').onclick = () => xemToanMan(a);
    bang.querySelector('.trai').onclick = () => doi(-1); bang.querySelector('.phai').onclick = () => doi(1);
    bang.querySelector('#aq-chon').onclick = () => { if (chon.has(k)) chon.delete(k); else if (chon.size < TOI_DA) chon.set(k, a); ve(); };
    bang.querySelectorAll('.dai img').forEach((im) => { im.onclick = () => { dang = +im.dataset.i; ve(); }; });
    bang.querySelector('.dai img.dang')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const doi = (b) => { const m = Math.max(0, Math.min(ds.length - 1, dang + b)); if (m !== dang) { dang = m; ve(); } };
  const dong = () => { bang.style.display = 'none'; ghim.visible = false; lon.style.display = 'none'; };
  // ← → đổi ảnh, Esc đóng — chỉ khi bảng đang mở (bắt trước điều khiển game)
  addEventListener('keydown', (e) => { if (bang.style.display !== 'flex' || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopImmediatePropagation(); e.preventDefault(); doi(e.key === 'ArrowLeft' ? -1 : 1); }
    else if (e.key === 'Escape') { e.stopImmediatePropagation(); if (lon.style.display === 'flex') lon.style.display = 'none'; else dong(); } }, true);
  nut.onclick = (e) => { e.stopPropagation(); if (bang.style.display === 'flex') { dong(); return; } bang.style.display = 'flex'; tim(); };
  const daChon = () => [...chon.values()].map(({ nguon, id, lat, lng, kc, huong, lon: url, trang, tacGia, giayPhep, luc }) => ({ nguon, id, lat, lng, kc, huong, url, trang, tacGia, giayPhep, luc }));
  return {
    daChon,
    // thêm vào ngữ cảnh góp ý / báo lệch: điểm đang tìm + ảnh đã chọn (rỗng thì không thêm gì)
    // gọn (chỉ mã ảnh: c:<tên tệp Commons> · m:<id Mapillary>) — scripts/tim-anh.mjs tra ngược ra đường tải + tác giả + giấy phép
    nguCanh: () => { const a = daChon(); return a.length ? ` ANH-THAT-JSON:${JSON.stringify({ d: diem && { x: +diem.x.toFixed(1), z: +diem.z.toFixed(1), ten: diem.ten }, a: a.map((x) => (x.nguon === 'commons' ? 'c:' : 'm:') + x.id) })}` : ''; },
    anGhim: (an) => { ghim.visible = !an && bang.style.display === 'flex'; },
  };
}
