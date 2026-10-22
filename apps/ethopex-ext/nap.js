// VỎ 2.2: code mới nhất chạy qua User Scripts (nen.js). Sau 1,5 giây chưa thấy dấu #etp-mark (công tắc "Allow User Scripts" chưa bật / mos2 lỗi)
// → chạy BẢN KÈM (ly-do.js trong extension) và báo mos2 để con thấy máy nào đang dự phòng.
(() => {
  setTimeout(async () => {
    if (document.getElementById('etp-mark')) return;
    let us = null; try { us = (await chrome.storage.local.get('us')).us; } catch {}
    if (us && !us.ok) console.warn('[ethopex] chạy bản kèm — ' + us.loi + ' (chrome://extensions → Details → Allow User Scripts)');
    fetch(`https://mos2.on.tc/api/ext/ethopex-ly-do?k=${encodeURIComponent(window.ETHOPEX_LY_DO_KHOA || '')}&bao=du-phong-${us ? (us.ok ? 'us-ok' : 'us-tat') : 'us-chua'}`).catch(() => {});
    window.__etpGoiThang = true; window.__etpKhoiDong && window.__etpKhoiDong();
  }, 4000);
})();
