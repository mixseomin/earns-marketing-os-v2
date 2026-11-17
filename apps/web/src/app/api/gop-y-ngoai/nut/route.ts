// NÚT HÒM GÓP Ý CHUẨN cho trang tĩnh (castle.on.tc …): <script src="https://mos2.on.tc/api/gop-y-ngoai/nut" defer></script>.
// Phần tử có data-gop-y-mo (vd nút 💬) mở hòm chuẩn mos2 (/nhung/gop-y) trong iframe trong suốt phủ màn; hòm đóng thì gỡ iframe.
// Trang khai window.__nguCanhTrang = () => string (chỗ đứng, chế độ…), window.__chupTrang = () => dataURL (khung hình canvas) và
// window.__anhNgoaiTrang = () => [dataURL] (ảnh thật đã chọn — castle 📷, trang tự tải sẵn) — đọc lúc bấm mở; hiện thành ảnh đính kèm trong hòm (tải lên R2 như ảnh chụp trang).
// Không đuôi .js + no-store: zone Cloudflare on.tc giữ .js 30 ngày.
export const dynamic = 'force-dynamic';

const JS = `(() => {
  const GOC = new URL(document.currentScript ? document.currentScript.src : 'https://mos2.on.tc/').origin;
  let khung = null, cho = null;
  function mo() {
    if (khung) return;
    cho = { nguCanh: '', anh: null, anhThem: [] };
    try { cho.nguCanh = String(window.__nguCanhTrang ? window.__nguCanhTrang() : '').slice(0, 1000); } catch (e) { console.warn('[gop-y] ngữ cảnh trang lỗi', e); }
    try { cho.anh = window.__chupTrang ? window.__chupTrang() : null; } catch (e) { console.warn('[gop-y] chụp trang lỗi', e); }
    try { cho.anhThem = window.__anhNgoaiTrang ? [].concat(window.__anhNgoaiTrang() || []).filter((u) => typeof u === 'string' && u.startsWith('data:image/')).slice(0, 5) : []; } catch (e) { console.warn('[gop-y] ảnh ngoài lỗi', e); }
    khung = document.createElement('iframe');
    khung.src = GOC + '/nhung/gop-y?trang=' + encodeURIComponent(location.href);
    khung.title = 'Góp ý / báo lỗi';
    khung.allow = 'display-capture; clipboard-read; clipboard-write';
    khung.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;background:transparent;color-scheme:normal'; // phải TRÙNG color-scheme của trang trong iframe (normal), lệch là trình duyệt tô nền trắng đục
    document.body.appendChild(khung);
    khung.focus();
  }
  function dong() { if (khung) khung.remove(); khung = null; cho = null; }
  addEventListener('message', (e) => {
    if (!khung || e.origin !== GOC || e.source !== khung.contentWindow) return;
    const d = e.data || {};
    if (d.loai === 'gop-y:san-sang' && cho) khung.contentWindow.postMessage({ loai: 'gop-y:mo', nguCanh: cho.nguCanh, anh: cho.anh, anhThem: cho.anhThem }, GOC);
    if (d.loai === 'gop-y:dong') dong();
  });
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-gop-y-mo]'); if (b) { e.preventDefault(); e.stopPropagation(); mo(); } }, true);
  window.moGopYMos2 = mo;
})();`;

export function GET() {
  return new Response(JS, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
}
