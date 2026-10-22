# Ethopex — lý do đóng camp (extension Chrome)

Rê chuột vào hàng camp **Paused** trên app.ethopex.dev (Report / List campaigns) → hiện lý do đóng: luật nào, ai duyệt, lúc nào, chi/thu tháng.
Nguồn: mos2 `/api/ext/ethopex-ly-do` (nhật ký luật `ethopex_nhat_ky`). Camp đóng ngoài máy → lấy từ lịch sử Ethopex.

Vị trí (đường dẫn đầy đủ):
- Bản gốc trong repo: iMac `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/ethopex-ext`
- Bản cài sẵn (kèm khoa.js): iMac `/Users/htuan/Desktop/ethopex-ly-do` · MacBook `/Users/htuan/Desktop/ethopex-ly-do`

**Từ bản 2.2 (22/10/2026) code chạy qua API User Scripts** (nen.js tải code mới nhất từ mos2 MỖI lần mở trang, chạy thẳng vào tab — không bị CSP của trang chặn như cách chèn <script> của 2.0/2.1). Bật một lần: chrome://extensions → Details → **Allow User Scripts**. Chưa bật thì chạy bản kèm ly-do.js (cũ hơn).

(Lịch sử) bản 2.0 extension chỉ là VỎ NẠP (`nap.js`): mỗi lần mở trang Ethopex nó tải code mới nhất từ mos2
`https://mos2.on.tc/api/ext/ethopex-ly-do/js` (= tệp `ly-do.js` của repo đã deploy). Cập nhật tính năng = sửa `ly-do.js` + push mos2 → mọi máy (iMac, MacBook,
iPhone userscript) có bản mới ở lần tải trang kế, KHÔNG copy, KHÔNG Reload extension. Chỉ khi đổi `nap.js` / `manifest.json` mới phải chép lại vào thư mục cài.

Cài: Chrome → `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn `/Users/htuan/Desktop/ethopex-ly-do`.
`khoa.js` (mã đọc của API, KHÔNG commit) do máy tạo: `window.ETHOPEX_LY_DO_KHOA = '<mã trong studio xv_khoa_ngoai ethopex_ext.token>'`.
