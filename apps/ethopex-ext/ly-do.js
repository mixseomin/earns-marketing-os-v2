// EXTENSION ETHOPEX trên app.ethopex.dev (Report / List campaigns) — nguồn: mos2 /api/ext/ethopex-ly-do (khoá ở khoa.js).
// 1. Rê chuột vào hàng CAMP đang Paused → lý do đóng: luật · ai duyệt · lúc · chi/thu tháng (anh 22/10/2026).
// 2. Rê chuột vào hàng PHIM (Report chế độ Content) → các creative của phim: ảnh (rê vào ảnh = phát video), dạng, đoạn cắt, đạt luật CTA,
//    camp đang dùng, chi/thu/ROI tháng · hôm nay · hôm qua (anh 22/10/2026: "xem được creative của phim tương ứng… và các chỉ số liên quan").
// Khung hiện ra rê chuột vào được (xem video, bấm link); rời cả hàng lẫn khung thì ẩn.
(() => {
  const API = 'https://mos2.on.tc/api/ext/ethopex-ly-do?k=' + encodeURIComponent(window.ETHOPEX_LY_DO_KHOA || '');
  let bang = null, luc = 0; const le = {}, phimNho = {};
  const lay = async () => { if (!bang || Date.now() - luc > 120000) { try { const r = await (await fetch(API)).json(); if (r.ok) { bang = r.camp; luc = Date.now(); } } catch (e) {} } return bang || {}; };
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;z-index:2147483647;max-width:560px;max-height:80vh;overflow:auto;padding:10px 12px;border-radius:8px;background:#1f1d1a;color:#f4efe6;font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);display:none;white-space:normal';
  document.documentElement.appendChild(o);
  let trongKhung = false, an = null;
  o.addEventListener('mouseenter', () => { trongKhung = true; clearTimeout(an); });
  o.addEventListener('mouseleave', () => { trongKhung = false; o.style.display = 'none'; dang = null; });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const tien = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2));
  const roi = (v) => (v == null ? '' : ' · <b style="color:' + (v >= 0 ? '#7bd88f' : '#ff8a80') + '">' + (v > 0 ? '+' : '') + v + '%</b>');
  const so = (x) => tien(x.chi) + ' → ' + tien(x.thu) + roi(x.roi);
  const hien = (html, ev) => {
    o.innerHTML = html; o.style.display = 'block';
    const x = Math.min(ev.clientX + 16, innerWidth - o.offsetWidth - 8), y = Math.max(8, Math.min(ev.clientY + 12, innerHeight - o.offsetHeight - 8));
    o.style.left = x + 'px'; o.style.top = y + 'px';
    o.querySelectorAll('[data-video]').forEach((im) => im.addEventListener('mouseenter', () => {   // rê vào ảnh = phát video (tắt tiếng, lặp)
      const v = document.createElement('video'); v.src = im.dataset.video; v.muted = true; v.autoplay = true; v.loop = true; v.playsInline = true; v.style.cssText = im.style.cssText; im.replaceWith(v);
    }, { once: true }));
  };
  const anSau = () => { clearTimeout(an); an = setTimeout(() => { if (!trongKhung) { o.style.display = 'none'; dang = null; } }, 250); };
  let dang = null;

  const veCamp = async (tr, a, ev) => {
    const id = (a.textContent.match(/(\d{5,6}):/) || [])[1]; if (dang === 'c' + id) return; dang = 'c' + id;
    hien('<b>⏸ Camp #' + id + ' đã đóng</b><br>đang tải lý do…', ev);
    const b = await lay(); if (dang !== 'c' + id) return;
    const x = b[id];
    if (x) return hien('<b>⏸ Camp #' + id + ' đã đóng</b> · ' + esc(x.luc) + '<br><b>Luật:</b> ' + esc(x.luat) + '<br><b>Duyệt:</b> ' + esc(x.ai) +
      '<br><b>Tháng này:</b> chi ' + tien(x.chi) + ' · thu ' + tien(x.thu) + (x.roi == null ? '' : ' · ROI ' + (x.roi > 0 ? '+' : '') + x.roi + '%'), ev);
    if (!(id in le)) { try { le[id] = (await (await fetch(API + '&id=' + id)).json()).lich_su; } catch (e) { le[id] = null; } }
    if (dang !== 'c' + id) return;
    const h = le[id];
    hien('<b>⏸ Camp #' + id + ' đã đóng</b><br>' + (h ? 'Không có trong nhật ký luật — đóng ngoài máy: <b>' + esc(h.ai) + '</b>' + (h.qua ? ' qua ' + esc(h.qua) : '') + ' · ' + esc(new Date(h.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })) : 'Chưa đọc được lý do (Ethopex chưa ghi lịch sử).'), ev);
  };

  const vePhim = async (ten, ev) => {
    if (dang === 'p' + ten) return; dang = 'p' + ten;
    hien('<b>🎬 ' + esc(ten) + '</b><br>đang tải creative…', ev);
    if (!phimNho[ten] || Date.now() - phimNho[ten].luc > 120000) {
      try { const r = await (await fetch(API + '&phim=' + encodeURIComponent(ten))).json(); phimNho[ten] = { luc: Date.now(), r }; } catch (e) { phimNho[ten] = { luc: Date.now(), r: { creative: [] } }; }
    }
    if (dang !== 'p' + ten) return;
    const r = phimNho[ten].r, ds = r.creative || [];
    if (!ds.length) return hien('<b>🎬 ' + esc(ten) + '</b><br>Chưa nối được creative nào của phim này.', ev);
    const the = ds.slice(0, 12).map((c) => {
      const anh = c.anh ? '<img data-video="' + esc(c.video || '') + '" src="' + esc(c.anh) + '" style="width:76px;height:135px;object-fit:cover;border-radius:4px;background:#000;flex:none">' : '<div style="width:76px;height:135px;background:#333;border-radius:4px;flex:none"></div>';
      const camps = c.camp.slice(0, 4).map((k) => '#' + k.id + ' <span style="opacity:.7">' + (k.trang_thai === 'ACTIVE' ? '▶ $' + k.ngan_sach : '⏸') + '</span>' + roi(k.roi)).join('<br>') + (c.camp.length > 4 ? '<br>+' + (c.camp.length - 4) + ' camp' : '');
      return '<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid #3a3631">' + anh + '<div style="min-width:0">' +
        '<b>' + esc(c.dang || 'creative') + '</b>' + (c.doan ? ' · ' + esc(c.doan) : '') + (c.creative_id ? ' · #' + c.creative_id : '') +
        ' · ' + (c.cta_dat ? '<span style="color:#7bd88f">CTA đạt luật</span>' : '<span style="color:#ffb74d">CTA cũ</span>') +
        '<br>Tháng: ' + so(c.thang) + '<br>Hôm nay: ' + so(c.hom_nay) + '<br>Hôm qua: ' + so(c.hom_qua) +
        '<div style="margin-top:4px;font-size:12px">' + camps + '</div>' +
        (c.video ? '<a href="' + esc(c.video) + '" target="_blank" style="color:#9ecbff;font-size:12px">mở video</a>' : '') + '</div></div>';
    }).join('');
    hien('<b>🎬 ' + esc(ten) + '</b> · ' + ds.length + ' creative · ' + r.so_camp + ' camp <span style="opacity:.6">(rê vào ảnh để xem video)</span>' + the, ev);
  };

  document.addEventListener('mouseover', (ev) => {
    if (o.contains(ev.target)) return;
    const tr = ev.target.closest && ev.target.closest('tbody tr'); if (!tr) return anSau();
    clearTimeout(an);
    const a = [...tr.querySelectorAll('a')].find((x) => /^\s*\d{5,6}:/.test(x.textContent || ''));
    if (a) {
      if ([...tr.children].some((td) => /^\s*Paused\s*$/i.test(td.textContent || ''))) return veCamp(tr, a, ev);
      return anSau();
    }
    // hàng PHIM (Report nhóm theo Content): ô chữ đầu tiên không phải số / tiền / %
    const o1 = [...tr.children].map((td) => (td.textContent || '').trim()).find((t) => t.length > 3 && !/^[-+$\d.,%\s]+$/.test(t));
    if (o1) return vePhim(o1, ev);
    anSau();
  }, true);
  document.addEventListener('scroll', (ev) => { if (!o.contains(ev.target)) { o.style.display = 'none'; dang = null; } }, true);
})();
