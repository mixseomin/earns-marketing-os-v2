// vp.on.tc — cảm ứng cho văn phòng pixel. pixel-agents chỉ kéo bằng chuột giữa và zoom bằng Ctrl+wheel (OfficeCanvas.tsx),
// trên điện thoại không làm gì được. Script này được nginx sub_filter chèn vào index.html (không sửa gói npm):
//   một ngón kéo      → WheelEvent(deltaX/deltaY)            = kéo bản đồ
//   hai ngón chụm/mở  → WheelEvent(ctrlKey, deltaY)          = zoom (ngưỡng 50 mỗi nấc, ZOOM_SCROLL_THRESHOLD)
//   lúc mở trên màn cảm ứng → zoom về mức nhỏ nhất để thấy cả văn phòng (mặc định zoom theo DPR, điện thoại DPR 3 → quá to)
// ponytail: không chạm state React; chỉ phát đúng sự kiện canvas đã nghe. Gói đổi cách bắt sự kiện thì sửa đây.
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
