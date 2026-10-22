// EXTENSION ETHOPEX trên app.ethopex.dev (Report / List campaigns) — nguồn: mos2 /api/ext/ethopex-ly-do (khoá ở khoa.js).
// 1. Rê chuột vào hàng CAMP đang Paused → lý do đóng: luật · ai duyệt · lúc · chi/thu tháng (anh 22/10/2026).
// 2. Rê chuột vào hàng PHIM (Report chế độ Content) → các creative của phim: ảnh (rê vào ảnh = phát video), dạng, đoạn cắt, đạt luật CTA,
//    camp đang dùng, chi/thu/ROI tháng · hôm nay · hôm qua (anh 22/10/2026: "xem được creative của phim tương ứng… và các chỉ số liên quan").
// Khung hiện ra rê chuột vào được (xem video, bấm link); rời cả hàng lẫn khung thì ẩn.
// 3. TRẠNG THÁI CAMP NHÌN LÀ THẤY (anh 22/10/2026: "camp bị tắt hay bật phải show rõ ra, giờ nhìn mãi mới thấy"): Ethopex chỉ làm mờ hàng Paused
//    (class opacity-30) → mọi hàng camp được gắn nhãn ở ô tên: đỏ "⏸ TẮT" / xanh "▶ BẬT", hàng tắt nền đỏ nhạt + vạch đỏ bên trái, chữ vẫn đọc được.
(() => {
  if (window.__etpLyDo) return; window.__etpLyDo = true;   // vỏ nạp + userscript cũ cùng chạy thì chỉ một bản
  const st = document.createElement('style');
  st.textContent = 'tr[data-etp="tat"]{opacity:.85!important;background:#fdecea!important;box-shadow:inset 5px 0 0 #d93025}' +
    'tr[data-etp="tat"] td{color:#7a2a24!important}' +
    'tr[data-etp="bat"]{box-shadow:inset 5px 0 0 #1e8e3e}' +
    'td[data-etp-ten]::before{display:inline-block;margin-right:6px;padding:1px 7px;border-radius:10px;font:700 11px/16px system-ui,sans-serif;vertical-align:middle;letter-spacing:.3px}' +
    'td[data-etp-ten="tat"]::before{content:"⏸ TẮT";background:#d93025;color:#fff}' +
    'td[data-etp-ten="bat"]::before{content:"▶ BẬT";background:#1e8e3e;color:#fff}';
  document.documentElement.appendChild(st);
  const laTat = (tr) => tr.classList.contains('opacity-30') || [...tr.children].some((x) => /^\s*Paused\s*$/i.test(x.textContent || ''));
  const gan = () => {
    for (const a of document.querySelectorAll('tbody td a')) {
      if (!/^\s*\d{5,6}:/.test(a.textContent || '')) continue;
      const td = a.closest('td'), tr = td && td.parentElement; if (!tr) continue;
      const v = laTat(tr) ? 'tat' : 'bat';
      if (tr.dataset.etp !== v) tr.dataset.etp = v;
      if (td.dataset.etpTen !== v) td.dataset.etpTen = v;
    }
  };
  let hen = 0;
  let henTai = 0;
  new MutationObserver(() => { if (!hen) hen = requestAnimationFrame(() => { hen = 0; gan(); }); clearTimeout(henTai); henTai = setTimeout(() => taiSan(), 1500); })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  gan();

  const API = 'https://mos2.on.tc/api/ext/ethopex-ly-do?k=' + encodeURIComponent(window.ETHOPEX_LY_DO_KHOA || document.documentElement.dataset.etpKhoa || '');
  let bang = null, luc = 0; const le = {}, phimNho = {};
  const lay = async () => { if (!bang || Date.now() - luc > 120000) { try { const r = await (await fetch(API)).json(); if (r.ok) { bang = r.camp; luc = Date.now(); } } catch (e) {} } return bang || {}; };
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;z-index:2147483647;max-width:560px;max-height:80vh;overflow:auto;padding:10px 12px;border-radius:8px;background:#1f1d1a;color:#f4efe6;font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);display:none;white-space:normal';
  document.documentElement.appendChild(o);
  // TẢI SẴN (anh 22/10/2026 "có cách nào tải nhanh hơn"): mở trang là lấy luôn lý do đóng + creative của MỌI phim đang hiện (một lượt gọi) → rê vào là hiện ngay
  let dangTai = null;
  const tenPhimTrenTrang = () => [...document.querySelectorAll('tbody tr')].filter((tr) => ![...tr.querySelectorAll('a')].some((x) => /^\s*\d{5,6}:/.test(x.textContent || '')))
    .map((tr) => [...tr.children].find((x) => { const t = (x.textContent || '').trim(); return t.length > 3 && !/^[-+$\d.,%\s]+$/.test(t); }))
    .filter(Boolean).map((td) => td.textContent.trim());
  const taiSan = () => {
    const can = [...new Set(tenPhimTrenTrang())].filter((t) => !phimNho[t] || Date.now() - phimNho[t].luc > 120000).slice(0, 100);
    if (!can.length || dangTai) return;
    dangTai = fetch(API + '&phims=' + encodeURIComponent(can.join('\n'))).then((r) => r.json()).then((r) => {
      if (r.ok) for (const t of can) if (r.phim[t]) phimNho[t] = { luc: Date.now(), r: r.phim[t] };
      for (const t of can) for (const c of ((phimNho[t] || {}).r || {}).creative?.slice(0, 4) || []) if (c.anh) new Image().src = c.anh;   // ảnh 4 creative đầu vào bộ nhớ trình duyệt
    }).catch(() => {}).finally(() => { dangTai = null; });
  };
  lay(); setTimeout(taiSan, 800);
  // KHUNG XEM LỚN: rê vào ảnh creative → ảnh to; video chỉ bắt đầu tải lúc này, đủ dữ liệu mới chạy (anh 22/10/2026: "tải ảnh + chỉ số trước,
  // hover vào creative mới tải video; ảnh cần xem to"). Bấm ảnh = ghim khung, bấm ra ngoài = đóng.
  const lon = document.createElement('div');
  lon.style.cssText = 'position:fixed;z-index:2147483647;width:360px;height:640px;border-radius:10px;overflow:hidden;background:#000;box-shadow:0 8px 32px rgba(0,0,0,.5);display:none';
  document.documentElement.appendChild(lon);
  let ghim = false;
  const dongLon = () => { if (ghim) return; lon.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); }); lon.innerHTML = ''; lon.style.display = 'none'; };
  const moLon = (im) => {
    const r = o.getBoundingClientRect(), x = r.left > 380 ? r.left - 372 : Math.min(r.right + 12, innerWidth - 368);
    lon.style.left = x + 'px'; lon.style.top = Math.max(8, Math.min(r.top, innerHeight - 648)) + 'px';
    lon.innerHTML = '<img src="' + im.src + '" style="width:100%;height:100%;object-fit:contain"><div data-tt style="position:absolute;left:0;right:0;bottom:0;padding:6px 8px;background:rgba(0,0,0,.6);color:#fff;font:12px system-ui">' + (im.dataset.video ? 'đang tải video…' : 'không có video') + '</div>';
    lon.style.display = 'block';
    if (!im.dataset.video) return;
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .2s';
    v.addEventListener('canplay', () => { v.style.opacity = '1'; v.play().catch(() => {}); const t = lon.querySelector('[data-tt]'); if (t) t.textContent = 'video · bấm ảnh để ghim'; });
    v.src = im.dataset.video; lon.appendChild(v);
  };
  document.addEventListener('click', (ev) => { if (ghim && !lon.contains(ev.target) && !(ev.target.dataset && ev.target.dataset.video !== undefined)) { ghim = false; dongLon(); } }, true);
  let trongKhung = false, an = null;
  o.addEventListener('mouseenter', () => { trongKhung = true; clearTimeout(an); });
  o.addEventListener('mouseleave', () => { trongKhung = false; if (ghim) return; o.style.display = 'none'; dang = null; dongLon(); });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const tien = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2));
  const roi = (v) => (v == null ? '' : ' · <b style="color:' + (v >= 0 ? '#7bd88f' : '#ff8a80') + '">' + (v > 0 ? '+' : '') + v + '%</b>');
  const phanTram = (v) => (v == null ? '' : '<b style="color:' + (v >= 0 ? '#7bd88f' : '#ff8a80') + '">' + (v > 0 ? '+' : '') + v + '%</b>');
  const hien = (html, ev) => {
    o.innerHTML = html; o.style.display = 'block';
    const x = Math.min(ev.clientX + 16, innerWidth - o.offsetWidth - 8), y = Math.max(8, Math.min(ev.clientY + 12, innerHeight - o.offsetHeight - 8));
    o.style.left = x + 'px'; o.style.top = y + 'px';
    o.querySelectorAll('img[data-video]').forEach((im) => {
      im.style.cursor = 'zoom-in';
      im.addEventListener('mouseenter', () => { if (!ghim) moLon(im); });
      im.addEventListener('mouseleave', () => dongLon());
      im.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ghim = !ghim; if (ghim && lon.style.display === 'none') moLon(im); if (!ghim) dongLon(); });
    });
  };
  const anSau = () => { clearTimeout(an); an = setTimeout(() => { if (!trongKhung && !ghim) { o.style.display = 'none'; dang = null; dongLon(); } }, 250); };
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
    if (dangTai) await dangTai;   // đang tải sẵn cả trang → chờ nó, không gọi lẻ
    if (!phimNho[ten] || Date.now() - phimNho[ten].luc > 120000) {
      try { const r = await (await fetch(API + '&phim=' + encodeURIComponent(ten))).json(); phimNho[ten] = { luc: Date.now(), r }; } catch (e) { phimNho[ten] = { luc: Date.now(), r: { creative: [] } }; }
    }
    if (dang !== 'p' + ten) return;
    const r = phimNho[ten].r, ds = r.creative || [];
    if (!ds.length) return hien('<b>🎬 ' + esc(ten) + '</b><br>Chưa nối được creative nào của phim này.', ev);
    // CHỈ SỐ THẲNG CỘT (anh 22/10/2026: "bố cục phần chỉ số thẳng cột với nhau cho đẹp và dễ theo dõi"): bảng nhãn | chi | → | thu | ROI, số căn phải,
    // chữ số đều bề ngang; dòng camp dùng chung cột: #id | nhãn BẬT/TẮT | ROI tháng
    const td_ = 'padding:1px 0 1px 8px;text-align:right;white-space:nowrap;color:inherit;border:0;background:none';
    const dong = (nhan, x) => '<tr><td style="padding:1px 0;opacity:.75;color:inherit;border:0">' + nhan + '</td><td style="' + td_ + '">' + tien(x.chi) + '</td><td style="padding:1px 0 1px 6px;opacity:.5;color:inherit;border:0">→</td><td style="' + td_ + '">' + tien(x.thu) +
      '</td><td style="' + td_ + ';min-width:52px">' + phanTram(x.roi) + '</td></tr>';
    const nhanCamp = (k) => k.trang_thai === 'ACTIVE' ? '<span style="background:#1e8e3e;color:#fff;border-radius:8px;padding:0 6px;font-weight:700">▶ BẬT $' + k.ngan_sach + '</span>' : '<span style="background:#d93025;color:#fff;border-radius:8px;padding:0 6px;font-weight:700">⏸ TẮT</span>';
    const the = ds.slice(0, 12).map((c) => {
      const anh = c.anh ? '<img data-video="' + esc(c.video || '') + '" src="' + esc(c.anh) + '" style="width:76px;height:135px;object-fit:cover;border-radius:4px;background:#000;flex:none">' : '<div style="width:76px;height:135px;background:#333;border-radius:4px;flex:none"></div>';
      const camps = c.camp.slice(0, 4).map((k) => '<tr><td style="padding:1px 0;color:inherit;border:0">Camp #' + k.id + '</td><td colspan="3" style="padding:1px 0 1px 8px;border:0">' + nhanCamp(k) + '</td><td style="' + td_ + '">' + phanTram(k.roi) + '</td></tr>').join('') +
        (c.camp.length > 4 ? '<tr><td colspan="5" style="padding:1px 0;opacity:.7;color:inherit;border:0">+' + (c.camp.length - 4) + ' camp</td></tr>' : '');
      return '<div style="display:flex;gap:10px;padding:6px 0;border-top:1px solid #3a3631">' + anh + '<div style="min-width:0">' +
        '<b>Creative' + (c.creative_id ? ' #' + c.creative_id : '') + '</b> · ' + esc(c.dang || '') + (c.doan ? ' · ' + esc(c.doan) : '') +
        ' · ' + (c.cta_dat ? '<span style="color:#7bd88f">CTA đạt luật</span>' : '<span style="color:#ffb74d">CTA cũ</span>') +
        '<table style="border-collapse:collapse;table-layout:fixed;width:326px;margin-top:3px;color:inherit;font:inherit;font-variant-numeric:tabular-nums;background:none">' +
        '<colgroup><col style="width:92px"><col style="width:72px"><col style="width:20px"><col style="width:80px"><col style="width:62px"></colgroup>' + dong('Tháng', c.thang) + dong('Hôm nay', c.hom_nay) + dong('Hôm qua', c.hom_qua) +
        '<tr><td colspan="5" style="padding:5px 0 1px;border:0;font-size:11px;opacity:.6;color:inherit">' + (c.camp.length > 1 ? c.camp.length + ' camp dùng creative này (chỉ số trên = tổng) · ROI tháng' : 'Camp dùng creative này · ROI tháng') + '</td></tr>' + camps + '</table>' +
        (c.video ? '<a href="' + esc(c.video) + '" target="_blank" style="color:#9ecbff;font-size:12px">mở video</a>' : '') + '</div></div>';
    }).join('');
    // TỔNG PHIM = cộng mọi creative (anh 22/10/2026 hỏi "có 4 camp à?") — dòng Hôm nay khớp hàng phim trên Report khi Report đang xem hôm nay
    const tong = (f) => { const x = ds.reduce((a, c) => ({ chi: a.chi + c[f].chi, thu: a.thu + c[f].thu }), { chi: 0, thu: 0 }); return { chi: x.chi, thu: x.thu, roi: x.chi >= 0.1 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null }; };
    const dauKhung = '<table style="border-collapse:collapse;table-layout:fixed;width:326px;margin:6px 0 2px 86px;color:inherit;font:inherit;font-variant-numeric:tabular-nums;background:none">' +
      '<colgroup><col style="width:92px"><col style="width:72px"><col style="width:20px"><col style="width:80px"><col style="width:62px"></colgroup>' +
      '<tr><td colspan="5" style="padding:0 0 1px;border:0;font-size:11px;opacity:.6;color:inherit">CẢ PHIM (cộng mọi creative)</td></tr>' +
      dong('<b>Tháng</b>', tong('thang')).replace('opacity:.75', 'opacity:1') + dong('<b>Hôm nay</b>', tong('hom_nay')).replace('opacity:.75', 'opacity:1') + '</table>';
    hien('<b>🎬 ' + esc(ten) + '</b> · ' + ds.length + ' creative · ' + r.so_camp + ' camp <span style="opacity:.6">(rê vào ảnh: xem to + video · bấm ảnh: ghim)</span>' + dauKhung + the, ev);
  };

  document.addEventListener('mouseover', (ev) => {
    if (o.contains(ev.target) || lon.contains(ev.target) || ghim) return;
    // CHỈ khi rê đúng vào Ô TÊN (anh 22/10/2026: "chỉ hover vào tên phim thôi, không phải chỗ nào cũng show") — ô số / ROI / ngân sách không hiện
    const td = ev.target.closest && ev.target.closest('tbody td'); const tr = td && td.parentElement; if (!td || !tr) return anSau();
    clearTimeout(an);
    const a = td.querySelector('a') && /^\s*\d{5,6}:/.test(td.querySelector('a').textContent || '') ? td.querySelector('a') : null;
    if (a) {
      if (tr.dataset.etp === 'tat' || laTat(tr)) return veCamp(tr, a, ev);
      return anSau();
    }
    if ([...tr.querySelectorAll('a')].some((x) => /^\s*\d{5,6}:/.test(x.textContent || ''))) return anSau();   // hàng camp nhưng không phải ô tên
    // hàng PHIM (Report nhóm theo Content): ô đang rê phải là ô tên — ô chữ đầu tiên không phải số / tiền / %
    const o1 = [...tr.children].find((x) => { const t = (x.textContent || '').trim(); return t.length > 3 && !/^[-+$\d.,%\s]+$/.test(t); });
    if (o1 === td) return vePhim(td.textContent.trim(), ev);
    anSau();
  }, true);
  document.addEventListener('scroll', (ev) => { if (!o.contains(ev.target)) { o.style.display = 'none'; dang = null; } }, true);
})();
