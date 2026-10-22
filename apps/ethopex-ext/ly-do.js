// LÝ DO ĐÓNG CAMP trên trang Report / List campaigns của Ethopex (anh 22/10/2026: "khi hover vào camp nào đóng thì show cho tao lý do").
// Hàng camp = TR có thẻ A "<id>: <tên>", ô trạng thái ghi "Paused". Lý do lấy từ mos2 /api/ext/ethopex-ly-do (nhật ký luật: luật · ai duyệt · lúc · chi/thu);
// camp không có trong nhật ký (đóng ngoài máy) thì hỏi lịch sử Ethopex qua cùng API (?id=).
(() => {
  const API = 'https://mos2.on.tc/api/ext/ethopex-ly-do?k=' + encodeURIComponent(window.ETHOPEX_LY_DO_KHOA || '');
  let bang = null, luc = 0; const le = {};
  const lay = async () => { if (!bang || Date.now() - luc > 120000) { try { const r = await (await fetch(API)).json(); if (r.ok) { bang = r.camp; luc = Date.now(); } } catch (e) {} } return bang || {}; };
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;z-index:2147483647;max-width:420px;padding:10px 12px;border-radius:8px;background:#1f1d1a;color:#f4efe6;font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;display:none;white-space:normal';
  document.documentElement.appendChild(o);
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const tien = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2));
  const hien = (html, ev) => { o.innerHTML = html; o.style.display = 'block'; const x = Math.min(ev.clientX + 16, innerWidth - o.offsetWidth - 8), y = Math.min(ev.clientY + 16, innerHeight - o.offsetHeight - 8); o.style.left = x + 'px'; o.style.top = y + 'px'; };
  let dang = null;
  document.addEventListener('mouseover', async (ev) => {
    const tr = ev.target.closest && ev.target.closest('tr'); if (!tr) { o.style.display = 'none'; dang = null; return; }
    const a = [...tr.querySelectorAll('a')].find((x) => /^\s*\d{5,6}:/.test(x.textContent || '')); if (!a) { o.style.display = 'none'; return; }
    if (![...tr.children].some((td) => /^\s*Paused\s*$/i.test(td.textContent || ''))) { o.style.display = 'none'; return; }
    const id = (a.textContent.match(/(\d{5,6}):/) || [])[1]; dang = id;
    hien('<b>⏸ Camp #' + id + ' đã đóng</b><br>đang tải lý do…', ev);
    const b = await lay(); if (dang !== id) return;
    const x = b[id];
    if (x) {
      hien('<b>⏸ Camp #' + id + ' đã đóng</b> · ' + esc(x.luc) + '<br><b>Luật:</b> ' + esc(x.luat) + '<br><b>Duyệt:</b> ' + esc(x.ai) +
        '<br><b>Tháng này:</b> chi ' + tien(x.chi) + ' · thu ' + tien(x.thu) + (x.roi == null ? '' : ' · ROI ' + (x.roi > 0 ? '+' : '') + x.roi + '%'), ev); return;
    }
    if (!(id in le)) { try { le[id] = (await (await fetch(API + '&id=' + id)).json()).lich_su; } catch (e) { le[id] = null; } }
    if (dang !== id) return;
    const h = le[id];
    hien('<b>⏸ Camp #' + id + ' đã đóng</b><br>' + (h ? 'Không có trong nhật ký luật — đóng ngoài máy: <b>' + esc(h.ai) + '</b>' + (h.qua ? ' qua ' + esc(h.qua) : '') + ' · ' + esc(new Date(h.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })) : 'Chưa đọc được lý do (Ethopex chưa ghi lịch sử).'), ev);
  }, true);
  document.addEventListener('scroll', () => { o.style.display = 'none'; }, true);
})();
