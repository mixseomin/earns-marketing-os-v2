// NÚT HÒM GÓP Ý CHUẨN cho trang tĩnh (castle.on.tc …): <script src="https://mos2.on.tc/api/gop-y-ngoai/nut" defer></script>.
// Phần tử có data-gop-y-mo (vd nút 💬) mở hòm chuẩn mos2 (/nhung/gop-y) trong iframe trong suốt phủ màn.
// NẠP SẴN (anh 21/11/2026 "nút góp ý bấm vào mãi mới load"): iframe dựng ẩn lúc trang rảnh — bấm chỉ còn hiện hòm, không tải nguội
// cả trang mos2 (~880 KB JS + dựng React) mỗi lần bấm; hòm đóng thì ẨN iframe, lần sau mở lại tức thì. Trang hiện tại gửi kèm mỗi lần mở
// (trang một-trang đổi URL sau khi iframe đã nạp).
// Trang khai window.__nguCanhTrang = () => string (chỗ đứng, chế độ…), window.__chupTrang = () => dataURL (khung hình canvas) và
// window.__anhNgoaiTrang = () => [dataURL] (ảnh thật đã chọn — castle 📷, trang tự tải sẵn) — đọc lúc bấm mở; hiện thành ảnh đính kèm trong hòm (tải lên R2 như ảnh chụp trang).
// Không đuôi .js + no-store: zone Cloudflare on.tc giữ .js 30 ngày.
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
  });
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-gop-y-mo]'); if (b) { e.preventDefault(); e.stopPropagation(); mo(); } }, true);
  window.moGopYMos2 = mo;
  const napSan = () => (window.requestIdleCallback ? requestIdleCallback(tao, { timeout: 4000 }) : setTimeout(tao, 1500));
  if (document.readyState === 'complete') napSan(); else addEventListener('load', napSan, { once: true });
})();`;

export function GET() {
  return new Response(JS, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
}
