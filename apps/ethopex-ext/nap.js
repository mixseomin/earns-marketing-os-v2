// VỎ NẠP 2.1 (anh 22/10/2026: không phải copy extension sang từng máy mỗi lần cập nhật): chèn code mới nhất từ mos2 vào trang (app.ethopex.dev
// không đặt CSP). Khoá đi trong URL của script (2.0 đặt ở thuộc tính <html> — React của trang có thể ghi đè, MacBook không chạy).
// Mã mos2 chạy thì phát sự kiện 'etp-chay'; 5 giây không thấy → nạp lại; thêm 5 giây vẫn không → chạy BẢN KÈM extension (ly-do.js, content script)
// và báo mos2 (?bao=du-phong) để thấy máy nào hỏng. Vỏ này hầu như không đổi — cập nhật tính năng = sửa ly-do.js rồi deploy mos2.
(() => {
  const k = encodeURIComponent(window.ETHOPEX_LY_DO_KHOA || ''), GOC = 'https://mos2.on.tc/api/ext/ethopex-ly-do';
  let chay = false; window.addEventListener('etp-chay', () => { chay = true; });
  const nap = (lan) => { const s = document.createElement('script'); s.src = `${GOC}/js?k=${k}&lan=${lan}&t=${Date.now()}`;
    s.onerror = () => console.warn(`[ethopex] lần ${lan}: không tải được mã từ mos2`); (document.head || document.documentElement).appendChild(s); };
  nap(1);
  setTimeout(() => { if (chay) return; nap(2);
    setTimeout(() => { if (chay) return; console.warn('[ethopex] mã mos2 không chạy — dùng bản kèm extension');
      fetch(`${GOC}?k=${k}&bao=du-phong`).catch(() => {}); window.__etpGoiThang = true; window.__etpKhoiDong && window.__etpKhoiDong(); }, 5000); }, 5000);
})();
