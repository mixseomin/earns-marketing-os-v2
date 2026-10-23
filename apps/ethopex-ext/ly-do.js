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
    // chọn bộ chọn đủ mạnh để thắng luật tô màu hàng tắt (tr[data-etp="tat"] td, html.dark …) — 23/10/2026 hàng Paused hiện chồng "$1.00" lên "1.00"
    'html td[data-etp-so][data-etp-so][data-etp-so]{position:relative;color:transparent!important;padding-left:calc(var(--etp-pl,12px) + 16px)!important}html td[data-etp-so][data-etp-so][data-etp-so] *{color:transparent!important}' +
    'td[data-etp-so]::before{content:"$";position:absolute;left:var(--etp-pl,12px);top:50%;transform:translateY(-50%);color:var(--etp-mau);opacity:.55;font-weight:var(--etp-dam,inherit);font-variant-numeric:tabular-nums}' +
    'td[data-etp-so]::after{content:attr(data-etp-so);position:absolute;right:var(--etp-pr,12px);top:50%;transform:translateY(-50%);color:var(--etp-mau);font-weight:var(--etp-dam,inherit);font-variant-numeric:tabular-nums;white-space:nowrap}' +
    'td[data-etp-am]::after,td[data-etp-am]::before{color:#d93025}html.dark td[data-etp-am]::after,html.dark td[data-etp-am]::before{color:#ff8a80}' +
    // SỐ CAMP Ở Ô TÊN PHIM (anh 23/10/2026: "để số sang phải, không icon, chỉ 2 số: active xanh, scheduled vàng, không hiện đã đóng"):
    // ::before = đang chạy (xanh), ::after = đã lên lịch (vàng), sát mép phải ô — vẽ bằng giả phần tử, không sửa DOM React
    'td[data-etp-chay]{position:relative;padding-right:50px!important}' +
    // hai số là PHẦN TỬ THẬT (rê vào số xanh = danh sách camp đang chạy, số vàng = camp đã lên lịch — anh 23/10/2026)
    '.etp-so{position:absolute;top:50%;transform:translateY(-50%);right:8px;display:flex;gap:6px}' +
    '.etp-so i{font:700 12px/16px system-ui,sans-serif;font-style:normal;font-variant-numeric:tabular-nums;min-width:12px;text-align:right;cursor:help}' +
    '.etp-so i[data-k="chay"]{color:#1e8e3e}.etp-so i[data-k="lich"]{color:#c98a00}html.dark .etp-so i[data-k="chay"]{color:#7bd88f}html.dark .etp-so i[data-k="lich"]{color:#ffd54f}' +
    // BADGE DẠNG CREATIVE bên trái tên phim (anh 23/10/2026): KC kể chuyện · CT cảnh thật · CC cảnh cuối · PD phim dài · LM làm mới — chỉ dạng có camp đang chạy.
    // Đặt tuyệt đối trong ô (chừa lề trái theo số badge) để không xô bố cục React; rê vào badge = khung chỉ creative của dạng đó
    '.etp-loai{position:absolute;top:50%;transform:translateY(-50%);left:6px;display:flex;gap:3px}' +
    '.etp-loai b{display:inline-block;width:22px;text-align:center;border-radius:4px;font:700 10px/16px system-ui,sans-serif;color:#fff;cursor:help}' +
    '.etp-loai b[data-loai="ke chuyen"]{background:#7b4fd6}.etp-loai b[data-loai="canh that"]{background:#1f7ae0}.etp-loai b[data-loai="canh cuoi"]{background:#0e9384}' +
    // NHÃN BỘ TÀI KHOẢN (anh 23/10/2026 "các camp, phim phải ghi thêm thuộc bộ tk thứ mấy, hover vào ra thông tin bộ tk đó"): B1 xám đậm · B2 hổ phách
    // khối LỤC GIÁC chỉ có số bộ (anh 23/10/2026 "viết tắt thôi, dùng 1 badge khối lục giác bên trong có số là hiểu")
    '.etp-bo{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);border-radius:0!important}' +
    '.etp-loai b.etp-bo{width:19px}.etp-bo[data-bo="1"]{background:#334155!important}.etp-bo[data-bo="2"]{background:#b45309!important}.etp-bo[data-bo="3"]{background:#0f766e!important}' +
    '.etp-bo-camp{position:absolute;top:50%;transform:translateY(-50%);right:6px;display:inline-block;width:19px;text-align:center;border-radius:4px;font:700 10px/16px system-ui,sans-serif;color:#fff;cursor:help}' +
    'td[data-etp-bo]{position:relative;padding-right:32px!important}' +
    '.etp-loai b[data-loai="phim dai"]{background:#c2410c}.etp-loai b[data-loai="lam moi"]{background:#6b7280}.etp-loai b[data-loai="khac"]{background:#9ca3af}' +
    'td[data-etp-nloai="1"]{padding-left:36px!important}td[data-etp-nloai="2"]{padding-left:61px!important}td[data-etp-nloai="3"]{padding-left:86px!important}td[data-etp-nloai="4"]{padding-left:111px!important}td[data-etp-nloai="5"]{padding-left:136px!important}' +
    '#etp-theme{position:fixed;right:16px;top:14px;z-index:2147483646;width:30px;height:30px;border-radius:15px;border:1px solid rgba(127,127,127,.4);background:rgba(127,127,127,.15);cursor:pointer;font:15px/28px system-ui;text-align:center;padding:0}';
  document.documentElement.appendChild(st);
  const laTat = (tr) => tr.classList.contains('opacity-30') || [...tr.children].some((x) => /^\s*Paused\s*$/i.test(x.textContent || ''));
  const TIEN = /^\s*([+\-−]?)\s*\$\s*([\d,]+(?:\.\d+)?)\s*$/;
  const keToan = () => {
    for (const td of document.querySelectorAll('tbody td, tfoot td')) {
      if (td.closest('[data-etp-khung]')) continue;   // bảng trong khung của extension không phải cột tiền của trang
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
  let boData = null, boLuc = 0;
  const layBo = async () => { if (!boData || Date.now() - boLuc > 120000) { boLuc = Date.now(); try { const r = await (await fetch(API + '&bo=1')).json(); if (r.ok) { boData = r; gan(); } } catch (e) {} } return boData; };
  const ganBoCamp = () => { if (!boData) return;
    for (const a of document.querySelectorAll('tbody td a')) {
      const m = (a.textContent || '').match(/^\s*(\d{5,6}):/); if (!m) continue; const td = a.closest('td'); if (!td || td.closest('[data-etp-khung]')) continue;
      const b = boData.camp[m[1]]; if (!b) continue;
      let sp = td.querySelector(':scope > .etp-bo-camp');
      if (!sp) { sp = document.createElement('span'); sp.className = 'etp-bo-camp etp-bo'; td.appendChild(sp); }
      if (sp.dataset.bo !== b) { sp.dataset.bo = b; sp.textContent = b; }
      if (td.dataset.etpBo !== b) td.dataset.etpBo = b;
    } };
  const gan = () => {
    keToan(); nutTheme(); ganBoCamp(); if (!boData && Date.now() - boLuc > 15000) setTimeout(layBo, 0);   // chưa có số bộ (lần đầu chạy trước khi API sẵn / mạng lỗi) → thử lại, cách nhau ≥ 15 giây
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
  o.style.cssText = 'position:fixed;z-index:2147483647;width:448px;max-width:92vw;max-height:min(560px,70vh);box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:10px 12px;border-radius:8px;background:#1f1d1a;color:#f4efe6;font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);display:none;white-space:normal';
  o.dataset.etpKhung = '1'; document.documentElement.appendChild(o);
  // TẢI SẴN (anh 22/10/2026 "có cách nào tải nhanh hơn"): mở trang là lấy luôn lý do đóng + creative của MỌI phim đang hiện (một lượt gọi) → rê vào là hiện ngay
  let dangTai = null;
  const LOAI_TAT = { 'ke chuyen': ['KC', 'Kể chuyện'], 'canh that': ['CT', 'Cảnh thật'], 'canh cuoi': ['CC', 'Cảnh cuối'], 'phim dai': ['PD', 'Phim dài'], 'lam moi': ['LM', 'Làm mới'], khac: ['?', 'Khác'] };
  const tenTd = (td) => [...td.childNodes].filter((n) => !(n.classList && (n.classList.contains('etp-loai') || n.classList.contains('etp-so')))).map((n) => n.textContent).join('').trim();
  const tenPhimTrenTrang = () => [...document.querySelectorAll('tbody tr')].filter((tr) => !tr.closest('[data-etp-khung]') && ![...tr.querySelectorAll('a')].some((x) => /^\s*\d{5,6}:/.test(x.textContent || '')))
    .map((tr) => [...tr.children].find((x) => { const t = (x.textContent || '').trim(); return t.length > 3 && !/^[-+$\d.,%\s]+$/.test(t); }))
    .filter(Boolean).map(tenTd);
  const oTenPhim = () => [...document.querySelectorAll('tbody tr')].filter((tr) => !tr.closest('[data-etp-khung]') && ![...tr.querySelectorAll('a')].some((x) => /^\s*\d{5,6}:/.test(x.textContent || '')))
    .map((tr) => [...tr.children].find((x) => { const t = (x.textContent || '').trim(); return t.length > 3 && !/^[-+$\d.,%\s]+$/.test(t); })).filter(Boolean);
  const veDem = () => { for (const td of oTenPhim()) { const d = phimNho[tenTd(td)]?.r?.dem; if (!d) continue;
    const ds = Object.keys(LOAI_TAT).filter((l) => (d.loai || {})[l] > 0), khoa = (d.bo || '') + '|' + ds.join(',');
    let w = td.querySelector(':scope > .etp-loai');
    if ((w?.dataset.k ?? '') !== khoa) {
      if (!w) { w = document.createElement('span'); w.className = 'etp-loai'; td.insertBefore(w, td.firstChild); }
      w.dataset.k = khoa; w.innerHTML = (d.bo ? `<b class="etp-bo" data-bo="${d.bo}">${d.bo}</b>` : '') + ds.map((l) => `<b data-loai="${l}" title="${LOAI_TAT[l][1]} · ${d.loai[l]} camp đang chạy">${LOAI_TAT[l][0]}</b>`).join('');
    }
    const nl = String(ds.length + (d.bo ? 1 : 0)); if (td.dataset.etpNloai !== nl) td.dataset.etpNloai = nl;
    if (td.dataset.etpChay !== String(d.chay)) td.dataset.etpChay = String(d.chay);
    let so = td.querySelector(':scope > .etp-so'); const ks = `${d.chay}|${d.lich}`;
    if ((so?.dataset.k ?? '') !== ks) {
      if (!so) { so = document.createElement('span'); so.className = 'etp-so'; td.appendChild(so); }
      so.dataset.k = ks; so.innerHTML = `<i data-k="chay" title="${d.chay} camp đang chạy">${d.chay}</i><i data-k="lich" title="${d.lich} camp đã lên lịch">${d.lich}</i>`;
    } } };
  const taiSan = () => {
    veDem();
    const can = [...new Set(tenPhimTrenTrang())].filter((t) => !phimNho[t] || Date.now() - phimNho[t].luc > 120000).slice(0, 100);
    if (!can.length || dangTai) return;
    dangTai = fetch(API + '&phims=' + encodeURIComponent(can.join('\n'))).then((r) => r.json()).then((r) => {
      if (r.ok) for (const t of can) if (r.phim[t]) phimNho[t] = { luc: Date.now(), r: r.phim[t] };
      veDem();
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
  let trongKhung = false, an = null, doi = null;
  o.addEventListener('mouseenter', () => { trongKhung = true; clearTimeout(an); clearTimeout(doi); });
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
  const anSau = () => { clearTimeout(an); clearTimeout(doi); an = setTimeout(() => { if (!trongKhung && !ghim) { o.style.display = 'none'; dang = null; dongLon(); } }, 250); };
  let dang = null;
  // ĐANG MỞ KHUNG mà rê sang chỗ khác (anh 23/10/2026: kéo chuột từ số xanh sang khung để cuộn thì đi ngang số vàng → nhảy sang danh sách lịch):
  // khung đang hiện thì chỉ đổi khi chuột DỪNG ở chỗ mới 350ms; vào khung trước hạn thì huỷ, khung giữ nguyên
  const lam = (f) => { clearTimeout(doi); if (o.style.display === 'block' && dang) doi = setTimeout(f, 350); else f(); };

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

  const veBo = async (bo, ev) => {
    if (dang === 'b' + bo) return; dang = 'b' + bo;
    const d = await layBo(), b = d?.bo_tk?.[bo]; if (dang !== 'b' + bo) return;
    if (!b) return hien('<b>Bộ tài khoản ' + esc(bo) + '</b><br>Chưa đọc được thông tin bộ.', ev);
    const td_ = 'padding:1px 0 1px 8px;text-align:right;white-space:nowrap;color:inherit;border:0';
    const dong = (nhan, x) => '<tr><td style="padding:1px 0;opacity:.75;color:inherit;border:0">' + nhan + '</td><td style="' + td_ + '">' + tien(x.chi) + '</td><td style="padding:1px 0 1px 6px;opacity:.5;color:inherit;border:0">→</td><td style="' + td_ + '">' + tien(x.thu) + '</td><td style="' + td_ + '">' + phanTram(x.roi) + '</td></tr>';
    hien('<b>Bộ tài khoản ' + esc(bo) + '</b> · ' + esc(b.ten) + (b.chi_phim_moi ? ' <span style="color:#ffd54f">· chỉ phim mới</span>' : '') +
      '<div style="margin-top:4px;font-size:12px;opacity:.8">Tài khoản QC ' + esc(b.tk_ext) + ' · Page #' + esc(b.page) + '</div>' +
      '<div style="margin-top:6px">' + b.chay + ' camp đang chạy / ' + b.camp + ' camp · ' + b.phim + ' phim</div>' +
      '<table style="border-collapse:collapse;margin-top:6px;color:inherit;font:inherit;font-variant-numeric:tabular-nums">' + dong('Tháng', b.thang) + dong('Hôm nay', b.hom_nay) + '</table>', ev);
  };
  const vePhim = async (ten, ev, loai = null, kieu = null) => {
    const kk = 'p' + ten + '|' + (loai || '') + '|' + (kieu || ''); if (dang === kk) return; dang = kk;
    hien('<b>🎬 ' + esc(ten) + '</b><br>đang tải creative…', ev);
    if (dangTai) await dangTai;   // đang tải sẵn cả trang → chờ nó, không gọi lẻ
    if (!phimNho[ten] || Date.now() - phimNho[ten].luc > 120000) {
      try { const r = await (await fetch(API + '&phim=' + encodeURIComponent(ten))).json(); phimNho[ten] = { luc: Date.now(), r }; } catch (e) { phimNho[ten] = { luc: Date.now(), r: { creative: [] } }; }
    }
    if (dang !== kk) return;
    // rê vào badge → chỉ creative của dạng đó; rê vào số xanh / vàng → chỉ camp đang chạy / đã lên lịch (creative không còn camp nào thì ẩn)
    const hop = (k) => (kieu === 'chay' ? k.trang_thai === 'ACTIVE' && !k.lich : kieu === 'lich' ? !!k.lich : true);
    const r = phimNho[ten].r, ds = (r.creative || []).filter((c) => !loai || c.loai === loai).map((c) => (kieu ? { ...c, camp: c.camp.filter(hop) } : c)).filter((c) => !kieu || c.camp.length);
    if (!ds.length) return hien('<b>🎬 ' + esc(ten) + '</b><br>' + (kieu ? 'Không có camp ' + (kieu === 'chay' ? 'đang chạy' : 'đã lên lịch') + '.' : 'Chưa nối được creative nào của phim này.'), ev);
    // HIỆU SUẤT TRỰC QUAN (anh 23/10/2026 duyệt 5 mục): 1 ô ROI tô màu theo mức lãi/lỗ (tiền chi → thu ở hover) · 2 cột ROI 7 ngày mỗi creative + cả phim ·
    // 3 creative xếp ROI tháng cao → thấp (server), lỗ cả tháng thì mờ · 4 camp thành chip một dòng · 5 đầu khung: ROI tháng chữ to + lãi/lỗ $ cả phim
    const nen = (v) => (v == null ? 'rgba(127,127,127,.28)' : v >= 0 ? 'rgba(30,142,62,' + (0.3 + Math.min(v, 150) / 150 * 0.65).toFixed(2) + ')' : 'rgba(217,48,37,' + (0.3 + Math.min(-v, 100) / 100 * 0.65).toFixed(2) + ')');
    const chuRoi = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v + '%');
    const goiY = (nhan, x) => esc(nhan + ': chi ' + tien(x.chi) + ' → thu ' + tien(x.thu) + ' · lãi ' + (x.thu - x.chi >= 0 ? '+' : '−') + '$' + Math.abs(x.thu - x.chi).toFixed(2));
    const o3 = (nhan, x) => '<div title="' + goiY(nhan, x) + '" style="flex:1;min-width:0;text-align:center;border-radius:5px;padding:2px 0 1px;background:' + nen(x.roi) + ';color:#fff;cursor:help">' +
      '<div style="font-weight:700;font-size:13px;font-variant-numeric:tabular-nums">' + chuRoi(x.roi) + '</div><div style="font-size:10px;opacity:.85">' + nhan + '</div></div>';
    const cot7 = (ds7, rong = 84, cao = 30) => {
      if (!ds7 || !ds7.length) return '';
      const w = rong / ds7.length, giua = cao / 2, tran = Math.max(50, ...ds7.map((x) => Math.min(Math.abs(x.roi ?? 0), 200)));
      const cot = ds7.map((x, i) => {
        const t = esc(x.ngay.slice(8, 10) + '/' + x.ngay.slice(5, 7) + ': ' + (x.chi < 0.01 ? 'chưa tiêu' : 'ROI ' + chuRoi(x.roi) + ' · chi ' + tien(x.chi) + ' → thu ' + tien(x.thu)));
        if (x.roi == null) return '<rect x="' + (i * w + 1.5).toFixed(1) + '" y="' + (giua - 1) + '" width="' + (w - 3).toFixed(1) + '" height="2" fill="rgba(160,160,160,.45)"><title>' + t + '</title></rect>';
        const h = Math.max(2, (Math.min(Math.abs(x.roi), 200) / tran) * (giua - 1));
        return '<rect x="' + (i * w + 1.5).toFixed(1) + '" y="' + (x.roi >= 0 ? giua - h : giua).toFixed(1) + '" width="' + (w - 3).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1" fill="' + (x.roi >= 0 ? '#3ccf6a' : '#ff6b5e') + '"><title>' + t + '</title></rect>';
      }).join('');
      return '<svg width="' + rong + '" height="' + cao + '" style="flex:none;display:block;cursor:help"><line x1="0" x2="' + rong + '" y1="' + giua + '" y2="' + giua + '" stroke="rgba(160,160,160,.35)"/>' + cot + '</svg>';
    };
    const chipCamp = (k) => {
      const [nen_, chu] = k.lich ? ['#b26a00', '⏳ ' + esc(new Date(String(k.lich).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }))]
        : k.trang_thai === 'ACTIVE' ? ['#1e8e3e', '▶ $' + k.ngan_sach + (k.moi ? ' · mới' : '')] : ['#d93025', '⏸'];
      return '<span title="' + esc('Camp #' + k.id + (k.moi && k.trang_thai === 'ACTIVE' ? ' · mới lên, chưa tiêu' : '') + ' · ROI tháng ' + chuRoi(k.roi)) + '" style="display:inline-flex;align-items:center;gap:4px;margin:2px 4px 0 0;padding:0 6px 0 0;border-radius:9px;background:rgba(127,127,127,.18);font-size:11px;white-space:nowrap">' +
        '<b style="background:' + nen_ + ';color:#fff;border-radius:9px;padding:0 6px">#' + k.id + ' ' + chu + '</b>' + (k.roi == null ? '' : phanTram(k.roi)) + '</span>';
    };
    const choNb = (k) => (k.cho_nb ? '<div style="font-size:11px;color:#ffb74d">⏳ #' + k.id + ' nhân bản đang chờ (' + esc(k.cho_nb.luc) + '): ' + esc(String(k.cho_nb.loi).split(' — ')[0].slice(0, 110)) + '</div>' : '');
    const the = ds.slice(0, 12).map((c) => {
      const lo = c.thang.roi != null && c.thang.roi < 0 && c.thang.chi >= 1;
      const anh = c.anh ? '<img data-video="' + esc(c.video || '') + '" src="' + esc(c.anh) + '" style="width:54px;height:96px;object-fit:cover;border-radius:4px;background:#000;flex:none">' : '<div style="width:54px;height:96px;background:#333;border-radius:4px;flex:none"></div>';
      return '<div style="display:flex;gap:10px;padding:7px 0;border-top:1px solid #3a3631' + (lo ? ';opacity:.55' : '') + '">' + anh + '<div style="min-width:0;flex:1">' +
        '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>#' + (c.creative_id || '?') + '</b> <b style="color:#ffd54f">' + esc(LOAI_TAT[c.loai]?.[0] || '?') + '</b>' + (c.doan ? ' ' + esc(c.doan) : '') +
        ' · ' + (c.cta_dat ? '<span style="color:#7bd88f">CTA đạt</span>' : '<span style="color:#ffb74d">CTA cũ</span>') + (c.video ? ' · <a href="' + esc(c.video) + '" target="_blank" style="color:#9ecbff">video</a>' : '') + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><div style="display:flex;gap:4px;flex:1;min-width:0">' + o3('tháng', c.thang) + o3('h.qua', c.hom_qua) + o3('h.nay', c.hom_nay) + '</div>' + cot7(c.ngay7) + '</div>' +
        '<div style="margin-top:3px">' + c.camp.slice(0, 8).map(chipCamp).join('') + (c.camp.length > 8 ? '<span style="font-size:11px;opacity:.7">+' + (c.camp.length - 8) + ' camp</span>' : '') + '</div>' +
        c.camp.slice(0, 8).map(choNb).join('') + '</div></div>';
    }).join('');
    // ĐẦU KHUNG = CẢ PHIM (cộng mọi creative đang hiện) — ROI tháng chữ to + lãi/lỗ $ · hôm nay · cột 7 ngày cả phim
    const tong = (f) => { const x = ds.reduce((a, c) => ({ chi: a.chi + c[f].chi, thu: a.thu + c[f].thu }), { chi: 0, thu: 0 }); return { chi: x.chi, thu: x.thu, roi: x.chi >= 0.1 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null }; };
    const tg_ = tong('thang'), hn = tong('hom_nay'), lai = tg_.thu - tg_.chi;
    const n7 = loai || kieu ? (ds[0]?.ngay7 || []).map((x, i) => { const s = ds.reduce((a, c) => ({ chi: a.chi + (c.ngay7?.[i]?.chi || 0), thu: a.thu + (c.ngay7?.[i]?.thu || 0) }), { chi: 0, thu: 0 }); return { ngay: x.ngay, ...s, roi: s.chi >= 0.1 ? Math.round(((s.thu - s.chi) / s.chi) * 100) : null }; }) : r.ngay7;
    const dauKhung = '<div style="display:flex;align-items:center;gap:12px;margin:6px 0 4px">' +
      '<div title="' + goiY('Tháng', tg_) + '" style="cursor:help"><div style="font-size:26px;font-weight:800;line-height:1.05;color:' + (tg_.roi == null ? 'inherit' : tg_.roi >= 0 ? '#7bd88f' : '#ff8a80') + ';font-variant-numeric:tabular-nums">' + chuRoi(tg_.roi) + '</div>' +
      '<div style="font-size:11px;opacity:.75">ROI tháng · ' + (lai >= 0 ? 'lãi +' : 'lỗ −') + '$' + Math.abs(lai).toFixed(2) + '</div></div>' +
      '<div style="flex:1;min-width:0">' + cot7(n7, 140, 34) + '<div style="font-size:10px;opacity:.6">ROI 7 ngày</div></div>' +
      '<div style="width:64px">' + o3('h.nay', hn) + '</div></div>';
    hien('<b>🎬 ' + esc(ten) + '</b>' + (loai ? ' · <b style="color:#ffd54f">chỉ ' + esc(LOAI_TAT[loai]?.[1] || loai) + '</b>' : '') + (kieu ? ' · <b style="color:' + (kieu === 'chay' ? '#7bd88f' : '#ffd54f') + '">chỉ camp ' + (kieu === 'chay' ? 'đang chạy' : 'đã lên lịch') + '</b>' : '') + ' · ' + ds.length + ' creative · ' + (loai || kieu ? ds.reduce((a, c) => a + c.camp.length, 0) : r.so_camp) + ' camp <span style="opacity:.6">(rê vào ô / cột: số tiền · rê ảnh: video · bấm ảnh: ghim)</span>' + dauKhung + the, ev);
  };

  document.addEventListener('mouseover', (ev) => {
    if (o.contains(ev.target) || lon.contains(ev.target) || ghim) return;
    // CHỈ khi rê đúng vào Ô TÊN (anh 22/10/2026: "chỉ hover vào tên phim thôi, không phải chỗ nào cũng show") — ô số / ROI / ngân sách không hiện
    const td = ev.target.closest && ev.target.closest('tbody td'); const tr = td && td.parentElement; if (!td || !tr) return anSau();
    clearTimeout(an);
    const nb = ev.target.closest('.etp-bo'); if (nb) return lam(() => veBo(nb.dataset.bo, ev));   // rê vào nhãn B1/B2 → thông tin bộ tài khoản
    const a = td.querySelector('a') && /^\s*\d{5,6}:/.test(td.querySelector('a').textContent || '') ? td.querySelector('a') : null;
    if (a) {
      if (tr.dataset.etp === 'tat' || laTat(tr)) return lam(() => veCamp(tr, a, ev));
      return anSau();
    }
    if ([...tr.querySelectorAll('a')].some((x) => /^\s*\d{5,6}:/.test(x.textContent || ''))) return anSau();   // hàng camp nhưng không phải ô tên
    // hàng PHIM (Report nhóm theo Content): ô đang rê phải là ô tên — ô chữ đầu tiên không phải số / tiền / %
    const o1 = [...tr.children].find((x) => { const t = (x.textContent || '').trim(); return t.length > 3 && !/^[-+$\d.,%\s]+$/.test(t); });
    if (o1 === td) { const b = ev.target.closest && ev.target.closest('.etp-loai b:not(.etp-bo)'), n = ev.target.closest && ev.target.closest('.etp-so i'); return lam(() => vePhim(tenTd(td), ev, b ? b.dataset.loai : null, n ? n.dataset.k : null)); }
    anSau();
  }, true);
  document.addEventListener('scroll', (ev) => { if (!o.contains(ev.target)) { o.style.display = 'none'; dang = null; } }, true);
};
  if (globalThis.chrome?.runtime?.id && !window.__etpGoiThang) window.__etpKhoiDong = __etpChay; else __etpChay(); }
