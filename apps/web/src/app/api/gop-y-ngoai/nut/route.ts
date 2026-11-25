// NÚT HÒM GÓP Ý CHUẨN cho trang tĩnh (castle.on.tc …): <script src="https://mos2.on.tc/api/gop-y-ngoai/nut" defer></script>.
// Phần tử có data-gop-y-mo (vd nút 💬) mở hòm chuẩn mos2 (/nhung/gop-y) trong iframe trong suốt phủ màn.
// NẠP SẴN (anh 21/11/2026 "nút góp ý bấm vào mãi mới load"): iframe dựng ẩn lúc trang rảnh — bấm chỉ còn hiện hòm, không tải nguội
// cả trang mos2 (~880 KB JS + dựng React) mỗi lần bấm; hòm đóng thì ẨN iframe, lần sau mở lại tức thì. Trang hiện tại gửi kèm mỗi lần mở
// (trang một-trang đổi URL sau khi iframe đã nạp).
// Trang khai window.__nguCanhTrang = () => string (chỗ đứng, chế độ…), window.__chupTrang = () => dataURL (khung hình canvas) và
// window.__anhNgoaiTrang = () => [dataURL] (ảnh thật đã chọn — castle 📷, trang tự tải sẵn) — đọc lúc bấm mở; hiện thành ảnh đính kèm trong hòm (tải lên R2 như ảnh chụp trang).
// Không đuôi .js + no-store: zone Cloudflare on.tc giữ .js 30 ngày.
import { nuocDuocKhach, TRANG_KHACH } from '@/lib/gop-y-khach';
import { GY_NUT_CSS } from '@mos2/gop-y/nut';

export const dynamic = 'force-dynamic';

const JS = `(() => {
  const GOC = new URL(document.currentScript ? document.currentScript.src : 'https://mos2.on.tc/').origin;
  let khung = null, sanSang = false, dangMo = false, cho = null;
  function tao() {
    if (khung && khung.isConnected) return;
    sanSang = false;
    khung = document.createElement('iframe');
    khung.src = GOC + '/nhung/gop-y?trang=' + encodeURIComponent(location.href);
    khung.title = 'Góp ý / báo lỗi';
    khung.allow = 'display-capture; clipboard-read; clipboard-write';
    khung.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;background:transparent;color-scheme:normal;visibility:hidden;pointer-events:none'; // color-scheme phải TRÙNG trang trong iframe (normal), lệch là trình duyệt tô nền trắng đục
    document.body.appendChild(khung);
  }
  function hien(co) { if (!khung) return; khung.style.visibility = co ? 'visible' : 'hidden'; khung.style.pointerEvents = co ? 'auto' : 'none'; }
  function guiMo() { if (!cho || !sanSang || !khung) return; khung.contentWindow.postMessage({ loai: 'gop-y:mo', trang: location.href, nguCanh: cho.nguCanh, anh: cho.anh, anhThem: cho.anhThem }, GOC); }   // GIỮ cho tới khi đóng: iframe nạp lại (thẻ "cần đăng nhập" → hòm thật sau khi đăng nhập) báo san-sang lần nữa thì gửi lại
  function mo() {
    if (dangMo) return;
    dangMo = true;
    cho = { nguCanh: '', anh: null, anhThem: [] };
    try { cho.nguCanh = String(window.__nguCanhTrang ? window.__nguCanhTrang() : '').slice(0, 1000); } catch (e) { console.warn('[gop-y] ngữ cảnh trang lỗi', e); }
    try { cho.anh = window.__chupTrang ? window.__chupTrang() : null; } catch (e) { console.warn('[gop-y] chụp trang lỗi', e); }
    try { cho.anhThem = window.__anhNgoaiTrang ? [].concat(window.__anhNgoaiTrang() || []).filter((u) => typeof u === 'string' && u.startsWith('data:image/')).slice(0, 5) : []; } catch (e) { console.warn('[gop-y] ảnh ngoài lỗi', e); }
    tao(); hien(true); khung.focus(); guiMo();   // chưa nạp xong thì gửi lúc iframe báo 'gop-y:san-sang'
  }
  function dong() { dangMo = false; cho = null; hien(false); try { khung.blur(); } catch (e) { /* iframe đã gỡ */ } window.focus(); }   // iframe ẩn không được giữ bàn phím (phím tắt trang)
  addEventListener('message', (e) => {
    if (!khung || e.origin !== GOC || e.source !== khung.contentWindow) return;
    const d = e.data || {};
    if (d.loai === 'gop-y:san-sang') { sanSang = true; guiMo(); }
    if (d.loai === 'gop-y:dong') dong();
    if (d.loai === 'gop-y:dem') { dem = d; to(); }
    if (d.loai === 'gop-y:chup') chup();
  });
  // 📷 CHỤP TRANG TRONG LUỒNG GÓP Ý (anh 25/11/2026): nút 💬 mở thẳng hòm, không hỏi chụp; muốn kèm ảnh thì bấm 📷 Chụp trang trong hòm →
  // ẩn hòm, chụp trang đang xem (khung canvas của trang nếu có __chupKhungTrang, không thì chọn tab hiện tại), hiện lại hòm kèm ảnh.
  let dangChup = false;
  const doi = (ms) => new Promise((r) => setTimeout(r, ms));
  const nho = (src, w, h) => { const k = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); };
  async function chupTab() {
    const md = navigator.mediaDevices;
    if (!md || !md.getDisplayMedia) throw new Error('trình duyệt không hỗ trợ chụp màn hình');
    const st = await md.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
    try {
      const v = document.createElement('video'); v.muted = true; v.srcObject = st; await v.play();
      await doi(400);   // khung picker vừa đóng — chờ trang vẽ lại
      return nho(v, v.videoWidth, v.videoHeight);
    } finally { st.getTracks().forEach((t) => t.stop()); }
  }
  async function chup() {
    if (dangChup || !khung) return;
    dangChup = true;
    let anh = null, loi = '';
    hien(false);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      try { anh = window.__chupKhungTrang ? window.__chupKhungTrang() : null; } catch (e) { console.warn('[gop-y] chụp khung trang lỗi', e); }
      if (!(typeof anh === 'string' && anh.startsWith('data:image/'))) anh = await chupTab();
    } catch (e) { loi = (e && e.message) || 'đã huỷ'; anh = null; }
    dangChup = false;
    if (dangMo) { hien(true); try { khung.focus(); } catch (e) {} }
    khung.contentWindow.postMessage({ loai: 'gop-y:anh-chup', anh, loi }, GOC);
  }
  // NÚT CHUẨN (packages/gop-y/src/nut.ts, anh 25/11/2026): AI đang làm → sáng nhấp nhô · có việc kẹt → chấm tròn đỏ góc · chờ ý kiến → số đỏ.
  // Số do hòm trong iframe đếm (60 giây một lần) rồi gửi 'gop-y:dem'; tô mọi nút [data-gop-y-mo] / [data-gop-y-nut] (nút tự gắn bằng moGopYMos2 thì khai data-gop-y-nut).
  let dem = null;
  const css = document.createElement('style'); css.textContent = __GY_NUT_CSS__; document.head.appendChild(css);
  function to() {
    if (!dem) return;
    document.querySelectorAll('[data-gop-y-mo],[data-gop-y-nut]').forEach((b) => {
      if (!b.dataset.gyGoc) { b.dataset.gyGoc = b.title || ' '; b.classList.add('gy-nut'); if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; }
      b.classList.toggle('gy-dang-lam', dem.working > 0);
      let c = b.querySelector(':scope > .gy-cham-do');
      if (dem.ket > 0 && !c) { c = document.createElement('span'); c.className = 'gy-cham-do'; b.appendChild(c); }
      if (dem.ket <= 0 && c) c.remove();
      let n = b.querySelector(':scope > .gy-so-do');
      if (dem.can_y_kien > 0) { if (!n) { n = document.createElement('span'); n.className = 'gy-so-do'; b.appendChild(n); } n.textContent = String(dem.can_y_kien); } else if (n) n.remove();
      b.title = dem.working || dem.ket || dem.can_y_kien ? dem.tieuDe : b.dataset.gyGoc.trim();
    });
  }
  let hen = 0;
  new MutationObserver(() => { if (dem && !hen) hen = requestAnimationFrame(() => { hen = 0; to(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-gop-y-mo]'); if (b) { e.preventDefault(); e.stopPropagation(); mo(); } }, true);
  window.moGopYMos2 = mo;
  const napSan = () => (window.requestIdleCallback ? requestIdleCallback(tao, { timeout: 4000 }) : setTimeout(tao, 1500));
  if (document.readyState === 'complete') napSan(); else addEventListener('load', napSan, { once: true });
})();`;

// Trang công khai (TRANG_KHACH, vd dantranh): nút chỉ hiện cho người vào TỪ VN (anh 21/11/2026) — nước lấy CF-IPCountry lúc tải script,
// ngoài VN thì giấu mọi [data-gop-y-mo] (cả phần tử thêm sau) và không nạp hòm. Trang nội bộ (castle/studio2…) không đổi.
export function GET(req: Request) {
  const vn = nuocDuocKhach(req.headers.get('cf-ipcountry'));
  const chan = `if (${JSON.stringify(TRANG_KHACH)}.includes(location.hostname) && !${vn}) { const s = document.createElement('style'); s.textContent = '[data-gop-y-mo]{display:none!important}'; document.head.appendChild(s); return; }`;
  return new Response(JS.replace('__GY_NUT_CSS__', JSON.stringify(GY_NUT_CSS)).replace('(() => {\n', '(() => {\n  ' + chan + '\n'), { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
}
