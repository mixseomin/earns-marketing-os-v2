// Văn phòng pixel (cty.on.tc/vp/<phòng>/) — script cty CHÈN vào index.html của pixel-agents qua nginx sub_filter (không sửa gói npm).
// Hai việc:
// 1) Cảm ứng (10/10/2026). pixel-agents chỉ kéo bằng chuột giữa và zoom bằng Ctrl+wheel (OfficeCanvas.tsx), trên điện thoại không làm gì được:
//   một ngón kéo      → WheelEvent(deltaX/deltaY)            = kéo bản đồ
//   hai ngón chụm/mở  → WheelEvent(ctrlKey, deltaY)          = zoom (ngưỡng 50 mỗi nấc, ZOOM_SCROLL_THRESHOLD)
//   lúc mở trên màn cảm ứng → zoom về mức nhỏ nhất để thấy cả văn phòng (mặc định zoom theo DPR, điện thoại DPR 3 → quá to)
//   ponytail: không chạm state React; chỉ phát đúng sự kiện canvas đã nghe. Gói đổi cách bắt sự kiện thì sửa đây.
// 2) Giữ websocket + chào lại khi nối lại (#1301, 11/10/2026). Cloudflare cắt websocket đứng im 100 giây (nginx để 3600s); pixel-agents tự
//   nối lại nhưng chỉ gửi "webviewReady" MỘT lần lúc mở trang → server không gửi lại bản đồ/nhân vật cho kết nối mới: văn phòng trống
//   hoặc đứng hình tới khi tải lại (đo trên box: 6/9 kết nối /ws không có lời chào, cách nhau ~2 phút). Bọc WebSocket: mỗi 45 giây gửi
//   một tin nhỏ (server bỏ qua loại lạ) để không bao giờ đứng im đủ 100 giây, và từ lần mở thứ hai tự gửi lại lời chào.
(function () {
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var last = null, dist = 0, zoomAcc = 0;
  function cv(t) { var el = document.elementFromPoint(t.clientX, t.clientY); return el && el.tagName === 'CANVAS' ? el : null; }
  function wheel(c, dx, dy, ctrl) {
    c.dispatchEvent(new WheelEvent('wheel', { deltaX: dx, deltaY: dy, ctrlKey: !!ctrl, bubbles: true, cancelable: true }));
  }
  document.addEventListener('touchstart', function (e) {
    var c = cv(e.touches[0]); if (!c) return;
    c.style.touchAction = 'none';
    if (e.touches.length === 1) last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    else if (e.touches.length === 2) { last = null; dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoomAcc = 0; }
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    var c = cv(e.touches[0]); if (!c) return;
    e.preventDefault();
    if (e.touches.length === 1 && last) {
      var t = e.touches[0];
      wheel(c, -(t.clientX - last.x), -(t.clientY - last.y), false);
      last = { x: t.clientX, y: t.clientY };
    } else if (e.touches.length === 2) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomAcc += dist - d; dist = d;
      if (Math.abs(zoomAcc) >= 40) { wheel(c, 0, zoomAcc > 0 ? 50 : -50, true); zoomAcc = 0; }
    }
  }, { passive: false });
  document.addEventListener('touchend', function () { last = null; }, { passive: true });
  if (coarse) {
    var tries = 0;
    var t = setInterval(function () {
      var c = document.querySelector('canvas');
      if (c) { for (var i = 0; i < 12; i++) wheel(c, 0, 50, true); clearInterval(t); }
      else if (++tries > 40) clearInterval(t);
    }, 250);
  }
})();

(function () {
  var Goc = window.WebSocket; if (!Goc) return;
  var lanMo = 0;
  function WS(url, giaoThuc) {
    var ws = giaoThuc === undefined ? new Goc(url) : new Goc(url, giaoThuc);
    if (!/\/ws$/.test(String(url))) return ws;
    var giu = null;
    ws.addEventListener('open', function () {
      if (lanMo++ > 0) ws.send(JSON.stringify({ type: 'webviewReady' }));   // nối lại → chào lại → server gửi lại trạng thái
      giu = setInterval(function () { if (ws.readyState === 1) ws.send('{"type":"cty-giu"}'); }, 45000);
    });
    ws.addEventListener('close', function () { clearInterval(giu); });
    return ws;
  }
  WS.prototype = Goc.prototype; WS.CONNECTING = 0; WS.OPEN = 1; WS.CLOSING = 2; WS.CLOSED = 3;
  window.WebSocket = WS;
})();
