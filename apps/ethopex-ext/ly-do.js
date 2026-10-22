// EXTENSION ETHOPEX trên app.ethopex.dev (Report / List campaigns) — nguồn: mos2 /api/ext/ethopex-ly-do (khoá ở khoa.js).
// 1. Rê chuột vào hàng CAMP đang Paused → lý do đóng: luật · ai duyệt · lúc · chi/thu tháng (anh 22/10/2026).
// 2. Rê chuột vào hàng PHIM (Report chế độ Content) → các creative của phim: ảnh (rê vào ảnh = phát video), dạng, đoạn cắt, đạt luật CTA,
//    camp đang dùng, chi/thu/ROI tháng · hôm nay · hôm qua (anh 22/10/2026: "xem được creative của phim tương ứng… và các chỉ số liên quan").
// Khung hiện ra rê chuột vào được (xem video, bấm link); rời cả hàng lẫn khung thì ẩn.
// 3. TRẠNG THÁI CAMP NHÌN LÀ THẤY (anh 22/10/2026: "camp bị tắt hay bật phải show rõ ra, giờ nhìn mãi mới thấy"): Ethopex chỉ làm mờ hàng Paused
//    (class opacity-30) → mọi hàng camp được gắn nhãn ở ô tên: đỏ "⏸ TẮT" / xanh "▶ BẬT", hàng tắt nền đỏ nhạt + vạch đỏ bên trái, chữ vẫn đọc được.
// HAI CÁCH CHẠY (2.1): (a) vỏ nạp chèn <script src=mos2…/js?k=…> → chạy ở thế giới của trang, khoá lấy từ URL của chính script, báo 'etp-chay' cho vỏ nạp;
// (b) bản kèm extension (content script) chỉ ĐĂNG KÝ window.__etpKhoiDong — vỏ nạp gọi khi mã mos2 không chạy được sau 2 lần (dự phòng).
{ const __etpKhoaUrl = (() => { try { return new URL(document.currentScript.src).searchParams.get('k') || ''; } catch { return ''; } })();
  const __etpChay = () => {
  if (window.__etpLyDo || document.getElementById('etp-mark')) return; window.__etpLyDo = true;   // một bản duy nhất trên trang: dấu #etp-mark nằm ở DOM chung mọi thế giới
  { const mk = document.createElement('i'); mk.id = 'etp-mark'; mk.hidden = true; document.documentElement.appendChild(mk); }
  window.dispatchEvent(new CustomEvent('etp-chay'));
  const st = document.createElement('style');
  st.textContent = 'tr[data-etp="tat"]{opacity:.85!important;background:#fdecea!important;box-shadow:inset 5px 0 0 #d93025}' +
    'tr[data-etp="tat"] td{color:#7a2a24!important}' +
    'tr[data-etp="bat"]{box-shadow:inset 5px 0 0 #1e8e3e}' +
    'td[data-etp-ten]::before{display:inline-block;margin-right:6px;padding:1px 7px;border-radius:10px;font:700 11px/16px system-ui,sans-serif;vertical-align:middle;letter-spacing:.3px}' +
    'td[data-etp-ten="tat"]::before{content:"⏸ TẮT";background:#d93025;color:#fff}' +
    'td[data-etp-ten="bat"]::before{content:"▶ BẬT";background:#1e8e3e;color:#fff}' +
    // theme tối của chính Ethopex (html.dark) — hàng tắt đổi sang đỏ trầm cho dễ đọc
    'html.dark tr[data-etp="tat"]{background:#3a1f1d!important}html.dark tr[data-etp="tat"] td{color:#ffb4ab!important}' +
    // CỘT TIỀN KIỂU KẾ TOÁN (anh 22/10/2026): "$" sát trái ô, số căn phải, phân cách nghìn, 2 số lẻ, số âm trong ngoặc tô đỏ, chữ số đều bề ngang.
    // Chữ gốc của trang giữ nguyên (trong suốt, vẫn chọn/copy được) — lớp hiển thị vẽ bằng ::before/::after, không sửa DOM React.
    'td[data-etp-so]{position:relative;color:transparent!important;padding-left:calc(var(--etp-pl,12px) + 16px)!important}td[data-etp-so] *{color:transparent!important}' +
    'td[data-etp-so]::before{content:"$";position:absolute;left:var(--etp-pl,12px);top:50%;transform:translateY(-50%);color:var(--etp-mau);opacity:.55;font-weight:var(--etp-dam,inherit);font-variant-numeric:tabular-nums}' +
    'td[data-etp-so]::after{content:attr(data-etp-so);position:absolute;right:var(--etp-pr,12px);top:50%;transform:translateY(-50%);color:var(--etp-mau);font-weight:var(--etp-dam,inherit);font-variant-numeric:tabular-nums;white-space:nowrap}' +
    'td[data-etp-am]::after,td[data-etp-am]::before{color:#d93025}html.dark td[data-etp-am]::after,html.dark td[data-etp-am]::before{color:#ff8a80}' +
    '#etp-theme{position:fixed;right:16px;top:14px;z-index:2147483646;width:30px;height:30px;border-radius:15px;border:1px solid rgba(127,127,127,.4);background:rgba(127,127,127,.15);cursor:pointer;font:15px/28px system-ui;text-align:center;padding:0}';
  document.documentElement.appendChild(st);
  const laTat = (tr) => tr.classList.contains('opacity-30') || [...tr.children].some((x) => /^\s*Paused\s*$/i.test(x.textContent || ''));
  const TIEN = /^\s*([+\-−]?)\s*\$\s*([\d,]+(?:\.\d+)?)\s*$/;
  const keToan = () => {
    for (const td of document.querySelectorAll('tbody td, tfoot td')) {
      const goc = td.dataset.etpGoc, chu = td.textContent || '';
      if (goc === chu && td.dataset.etpSo) continue;   // chưa đổi gì
      const m = chu.match(TIEN);
      if (!m) { if (td.dataset.etpSo) { delete td.dataset.etpSo; delete td.dataset.etpAm; delete td.dataset.etpGoc; } continue; }
      if (!td.dataset.etpSo) { const cs = getComputedStyle(td), con = td.firstElementChild ? getComputedStyle(td.firstElementChild) : cs;
        td.style.setProperty('--etp-mau', con.color); td.style.setProperty('--etp-pl', cs.paddingLeft); td.style.setProperty('--etp-pr', cs.paddingRight); td.style.setProperty('--etp-dam', con.fontWeight); }
      const v = Number(m[2].replace(/,/g, '')), am = m[1] === '-' || m[1] === '−';
      const so = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      td.dataset.etpGoc = chu; td.dataset.etpSo = am ? `(${so})` : so + '\u2008';   // số dương chừa chỗ bằng dấu ')' để chữ số thẳng hàng với số âm
      if (am) td.dataset.etpAm = '1'; else delete td.dataset.etpAm;
    }
  };
  // THEME TỐI (anh 22/10/2026): bật giao diện tối CÓ SẴN của Ethopex (next-themes: localStorage 'theme' + class 'dark' trên <html>) — nút 🌙/☀️ góc phải trên (góc trái dưới đè Sign out)
  const datTheme = (toi) => { try { localStorage.setItem('theme', toi ? 'dark' : 'light'); } catch {}
    document.documentElement.classList.toggle('dark', toi); document.documentElement.classList.toggle('light', !toi); document.documentElement.style.colorScheme = toi ? 'dark' : 'light';
    for (const td of document.querySelectorAll('td[data-etp-so]')) { delete td.dataset.etpSo; delete td.dataset.etpGoc; td.style.removeProperty('--etp-mau'); }   // đọc lại màu chữ theo theme mới
    const b = document.getElementById('etp-theme'); if (b) { b.textContent = toi ? '☀️' : '🌙'; b.title = toi ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'; } };
  const nutTheme = () => { if (document.getElementById('etp-theme') || !document.body) return;
    const b = document.createElement('button'); b.id = 'etp-theme'; document.body.appendChild(b);
    b.addEventListener('click', () => { datTheme(!document.documentElement.classList.contains('dark')); keToan(); });
    datTheme(document.documentElement.classList.contains('dark')); };
  const gan = () => {
    keToan(); nutTheme();
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

  const API = 'https://mos2.on.tc/api/ext/ethopex-ly-do?k=' + encodeURIComponent(window.ETHOPEX_LY_DO_KHOA || __etpKhoaUrl || document.documentElement.dataset.etpKhoa || '');
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
      // camp CHỜ (anh 22/10/2026): camp mới lên chưa tiêu → "⏳ mới lên"; camp thắng mà lần nhân bản gần nhất bị chặn → dòng cam ghi lý do
      const choNb = (k) => (k.cho_nb ? '<tr><td colspan="5" style="padding:0 0 3px 12px;border:0;font-size:11px;color:#ffb74d">⏳ Nhân bản đang chờ (' + esc(k.cho_nb.luc) + '): ' + esc(String(k.cho_nb.loi).split(' — ')[0].slice(0, 110)) + '</td></tr>' : '');
      const camps = c.camp.slice(0, 6).map((k) => '<tr><td style="padding:1px 0;color:inherit;border:0">Camp #' + k.id + '</td><td colspan="3" style="padding:1px 0 1px 8px;border:0">' + nhanCamp(k) + (k.moi && k.trang_thai === 'ACTIVE' ? ' <span style="color:#9ecbff;font-size:11px">⏳ mới lên, chưa tiêu</span>' : '') + '</td><td style="' + td_ + '">' + phanTram(k.roi) + '</td></tr>' + choNb(k)).join('') +
        (c.camp.length > 6 ? '<tr><td colspan="5" style="padding:1px 0;opacity:.7;color:inherit;border:0">+' + (c.camp.length - 6) + ' camp</td></tr>' : '');
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
};
  if (globalThis.chrome?.runtime?.id && !window.__etpGoiThang) window.__etpKhoiDong = __etpChay; else __etpChay(); }
