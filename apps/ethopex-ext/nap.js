// VỎ NẠP (anh 22/10/2026: không phải copy extension sang từng máy mỗi lần cập nhật): extension chỉ chèn code mới nhất từ mos2 vào trang
// (app.ethopex.dev không đặt CSP nên <script src> ngoài chạy được). Khoá đọc API đưa qua thuộc tính của <html>, vì code chạy ở thế giới của trang
// không thấy biến của content script. Vỏ này hầu như không bao giờ đổi — cập nhật tính năng = sửa apps/ethopex-ext/ly-do.js rồi deploy mos2.
(() => {
  document.documentElement.dataset.etpKhoa = window.ETHOPEX_LY_DO_KHOA || '';
  const s = document.createElement('script');
  s.src = 'https://mos2.on.tc/api/ext/ethopex-ly-do/js?t=' + Date.now();
  (document.head || document.documentElement).appendChild(s);
})();
