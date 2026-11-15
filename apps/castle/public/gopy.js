// Góp ý dùng chung cho mọi trang castle (Lâu đài dung nham, Neuschwanstein): nút 💬 → hộp gõ → POST /api/gop-y (cùng host, phiên SSO,
// nginx chuyển về hòm góp ý mos2) kèm ảnh khung hình + ngữ cảnh chỗ đứng. Hộp tự dựng DOM + CSS, dùng biến màu --o --vien --chu --mo của trang.
// ganGopY({ nut, tieuDe, chupAnh: () => dataURL|null, nguCanh: () => string }) → { mo, dong, dangMo }
const CSS = `
#gy { position: fixed; inset: 0; display: none; place-items: center; background: rgba(5,5,8,.5); z-index: 8; }
#gy > div { width: min(440px, calc(100vw - 32px)); padding: 16px; background: var(--o); border: 1px solid var(--vien); border-radius: 12px; display: flex; flex-direction: column; gap: 10px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
#gy textarea { width: 100%; min-height: 110px; resize: vertical; font: inherit; color: var(--chu); background: rgba(0,0,0,.35); border: 1px solid var(--vien); border-radius: 8px; padding: 8px 10px; }
#gy .hang { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--mo); font-size: 13px; }
#gy .kq { font-size: 13px; min-height: 18px; }
#gy .kq.loi { color: #ff9a8a; }`;

export function ganGopY({ nut, tieuDe = 'Góp ý', chupAnh = () => null, nguCanh = () => '' }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const gy = document.createElement('div'); gy.id = 'gy';
  gy.innerHTML = `<div>
  <b>💬 ${tieuDe}</b>
  <textarea placeholder="Thấy gì sai, muốn thêm gì… (Ctrl+Enter để gửi)"></textarea>
  <div class="hang"><label><input type="checkbox" class="anh" checked> Kèm ảnh màn hình lúc này</label>
    <label><input type="radio" name="gy-loai" value="loi" checked> Lỗi / sửa</label><label><input type="radio" name="gy-loai" value="cau_hoi"> Hỏi</label></div>
  <div class="kq"></div>
  <div class="hang" style="justify-content:flex-end"><button class="dong">Đóng</button><button class="gui chinh">Gửi</button></div>
</div>`;
  document.body.append(gy);
  const chu = gy.querySelector('textarea'), kq = gy.querySelector('.kq'), gui = gy.querySelector('.gui');
  const mo = () => { gy.style.display = 'grid'; kq.textContent = ''; kq.className = 'kq'; setTimeout(() => chu.focus(), 30); };
  const dong = () => { gy.style.display = 'none'; };
  async function guiDi() {
    const noiDung = chu.value.trim();
    if (!noiDung) { kq.textContent = 'Chưa gõ nội dung.'; kq.className = 'kq loi'; return; }
    gui.disabled = true; kq.textContent = 'Đang gửi…'; kq.className = 'kq';
    try {
      const anh = gy.querySelector('.anh').checked ? chupAnh() : null;
      const r = await fetch('/api/gop-y', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ noiDung, loai: gy.querySelector('input[name=gy-loai]:checked').value, trang: location.href, nguCanh: nguCanh(), anh }) });
      const j = await r.json().catch(() => ({ ok: false, error: `máy chủ trả ${r.status}` }));
      if (!j.ok) throw new Error(j.error || `máy chủ trả ${r.status}`);
      kq.textContent = `Đã gửi góp ý #${j.id}. Cảm ơn!`; chu.value = '';
      setTimeout(dong, 1600);
    } catch (e) { kq.textContent = 'Gửi không được: ' + (e.message || e); kq.className = 'kq loi'; console.error('[castle] góp ý', e); }
    gui.disabled = false;
  }
  nut.onclick = (e) => { e.stopPropagation(); mo(); };
  gy.querySelector('.dong').onclick = dong; gui.onclick = guiDi;
  gy.addEventListener('click', (e) => { if (e.target === gy) dong(); });
  // hộp đang mở: bắt phím ở pha capture của window (trước mọi điều khiển game) — kể cả khi tiêu điểm đã rời ô gõ (nút Gửi bị tắt lúc gửi đẩy tiêu điểm về body)
  addEventListener('keydown', (e) => { if (gy.style.display !== 'grid') return; e.stopImmediatePropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guiDi(); if (e.key === 'Escape') dong(); }, true);
  return { mo, dong, dangMo: () => gy.style.display === 'grid' };
}

// ảnh khung hình hiện tại: gọi ve() rồi đọc canvas NGAY trong cùng nhịp (không cần preserveDrawingBuffer), thu về cạnh dài 1280 px
export function chupCanvas(src, ve) {
  ve();
  const k = Math.min(1, 1280 / src.width), c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
