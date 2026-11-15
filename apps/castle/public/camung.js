// ĐIỀU KHIỂN CẢM ỨNG dùng chung (điện thoại / máy tính bảng) cho mô-đun đi bộ dibo.js: cần gạt trái = đi (layTruc), kéo ngón trên cảnh = xoay camera,
// cột nút phải theo NGỮ CẢNH (mỗi nút tự hiện / đổi chữ theo chỗ đang đứng: chu() trả null = ẩn). Tự dựng DOM + CSS, dùng biến màu --o --vien --chu của trang.
// taoCamUng({ dom, di, nut: [{ id, chu: () => string|null, bam: () => void }] }) → { layTruc, hien(bat), capNhat() }
// Lâu đài dung nham (main.js) còn bản viết riêng từ trước — gom về đây là việc riêng, chưa làm.
export const CHAM = matchMedia('(hover: none)').matches || 'ontouchstart' in window;

const CSS = `
#cu-can { position: fixed; left: 22px; bottom: 96px; width: 124px; height: 124px; border-radius: 50%; border: 1px solid var(--vien); background: rgba(10,14,22,.35); display: none; touch-action: none; z-index: 6; }
#cu-can i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(255,217,168,.5); }
#cu-nut { position: fixed; right: 12px; bottom: 96px; display: none; flex-direction: column-reverse; flex-wrap: wrap-reverse; max-height: 300px; gap: 9px; z-index: 6; }
#cu-nut button { width: 60px; height: 60px; border-radius: 50%; padding: 0; border: 1px solid var(--vien); background: rgba(14,20,30,.62); color: var(--chu); font: 600 13px system-ui, sans-serif; touch-action: none; }
#cu-nut button:active { background: rgba(255,217,168,.35); }`;

export function taoCamUng({ dom, di, nut = [] }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const vong = document.createElement('div'); vong.id = 'cu-can'; vong.innerHTML = '<i></i>'; document.body.append(vong);
  const cot = document.createElement('div'); cot.id = 'cu-nut'; document.body.append(cot);
  const cuc = vong.querySelector('i'), can = { id: null, x: 0, y: 0, dx: 0, dy: 0, nhay: false }, nhin = { id: null, x: 0, y: 0 };
  const nutEl = nut.map((n) => { const b = document.createElement('button'); b.id = 'cu-' + n.id; b.style.display = 'none'; cot.append(b);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); n.bam(); }, { passive: false }); return [n, b]; });
  vong.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; can.id = t.identifier; const r = vong.getBoundingClientRect(); can.x = r.left + r.width / 2; can.y = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
  dom.addEventListener('touchstart', (e) => { if (!di.dang) return; const t = e.changedTouches[0]; if (nhin.id === null) { nhin.id = t.identifier; nhin.x = t.clientX; nhin.y = t.clientY; } }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === can.id) { let dx = t.clientX - can.x, dy = t.clientY - can.y; const l = Math.hypot(dx, dy); if (l > 52) { dx *= 52 / l; dy *= 52 / l; } can.dx = dx / 52; can.dy = dy / 52; cuc.style.transform = `translate(${dx}px,${dy}px)`; }
      else if (t.identifier === nhin.id) { di.yaw -= (t.clientX - nhin.x) * 0.006; di.pitch = Math.max(-1.4, Math.min(1.4, di.pitch - (t.clientY - nhin.y) * 0.006)); di.lucChuot = performance.now(); nhin.x = t.clientX; nhin.y = t.clientY; }
    }
  }, { passive: true });
  const tha = (e) => { for (const t of e.changedTouches) { if (t.identifier === can.id) { can.id = null; can.dx = can.dy = 0; cuc.style.transform = ''; } if (t.identifier === nhin.id) nhin.id = null; } };
  addEventListener('touchend', tha); addEventListener('touchcancel', tha);
  let bat = false, lucNut = 0;
  return {
    layTruc: () => { const t = { dx: can.dx, dy: can.dy, nhay: can.nhay }; can.nhay = false; return t; },
    nhay: () => { can.nhay = true; },
    hien(b) { bat = b && CHAM; vong.style.display = bat ? 'block' : 'none'; cot.style.display = bat ? 'flex' : 'none'; if (!bat) { can.dx = can.dy = 0; can.id = nhin.id = null; cuc.style.transform = ''; } },
    capNhat() { // chữ / ẩn hiện từng nút theo ngữ cảnh (5 lần / giây là đủ)
      if (!bat || performance.now() - lucNut < 200) return; lucNut = performance.now();
      for (const [n, b] of nutEl) { let c = null; try { c = n.chu(); } catch (e) { console.warn('[camung] nút', n.id, e); } b.style.display = c ? '' : 'none'; if (c && b.textContent !== c) b.textContent = c; }
    },
  };
}
