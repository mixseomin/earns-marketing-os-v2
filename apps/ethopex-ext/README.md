# Ethopex — lý do đóng camp (extension Chrome)

Rê chuột vào hàng camp **Paused** trên app.ethopex.dev (Report / List campaigns) → hiện lý do đóng: luật nào, ai duyệt, lúc nào, chi/thu tháng.
Nguồn: mos2 `/api/ext/ethopex-ly-do` (nhật ký luật `ethopex_nhat_ky`). Camp đóng ngoài máy → lấy từ lịch sử Ethopex.

Cài: Chrome → `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục này.
`khoa.js` (mã đọc của API, KHÔNG commit) do máy tạo: `window.ETHOPEX_LY_DO_KHOA = '<mã trong studio xv_khoa_ngoai ethopex_ext.token>'`.
