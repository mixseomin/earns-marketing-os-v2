// NỀN 2.2 (22/10/2026): trang Ethopex khi đã đăng nhập chặn <script src> ngoài (thẻ script của app mang nonce — nhật ký mos2: máy anh không lần nào tải
// được /js, chỉ báo dự phòng) → dùng API User Scripts của Chrome (chạy ở thế giới USER_SCRIPT, không bị CSP của trang chặn): mỗi lần mở trang Ethopex,
// nền tải code mới nhất từ mos2 rồi cập nhật bản đăng ký → cập nhật tính năng = deploy mos2, không chép, không Reload.
// Cần bật một lần: chrome://extensions → Details của extension → "Allow User Scripts". Chưa bật → content script chạy bản kèm (ly-do.js).
self.window = self;   // khoa.js ghi window.ETHOPEX_LY_DO_KHOA — service worker không có window (2.2 chết ngay ở dòng này, anh luôn chạy bản kèm)
importScripts('khoa.js');
const GOC = 'https://mos2.on.tc/api/ext/ethopex-ly-do/js', KHOA = self.ETHOPEX_LY_DO_KHOA || '';
// MỖI LẦN MỞ TRANG = TẢI CODE MỚI NHẤT NGAY LÚC ĐÓ (anh 22/10/2026: "đã dùng bản chung thì lúc nào cũng phải là mới nhất"): không đăng ký sẵn
// (bản đăng ký chỉ áp cho lượt tải SAU → chậm một lượt) mà chạy thẳng bằng userScripts.execute vào đúng tab vừa mở.
async function chay(tabId) {
  try {
    const us = chrome.userScripts; if (!us || !us.execute) throw new Error('chưa bật Allow User Scripts');
    const r = await fetch(`${GOC}?k=${encodeURIComponent(KHOA)}&lan=us&t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`mos2 ${r.status}`);
    const code = `window.ETHOPEX_LY_DO_KHOA = ${JSON.stringify(KHOA)};\n` + (await r.text());
    await us.execute({ target: { tabId }, js: [{ code }], world: 'USER_SCRIPT', injectImmediately: false });
    await chrome.storage.local.set({ us: { ok: true, luc: Date.now() } });
  } catch (e) { await chrome.storage.local.set({ us: { ok: false, luc: Date.now(), loi: String(e && e.message || e) } }); }
}
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.status === 'complete' && /^https:\/\/app\.ethopex\.dev\//.test(tab.url || '')) chay(id); });
