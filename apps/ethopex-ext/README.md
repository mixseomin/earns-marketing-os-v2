# Ethopex — lý do đóng camp (extension Chrome)

Rê chuột vào hàng camp **Paused** trên app.ethopex.dev (Report / List campaigns) → hiện lý do đóng: luật nào, ai duyệt, lúc nào, chi/thu tháng.
Nguồn: mos2 `/api/ext/ethopex-ly-do` (nhật ký luật `ethopex_nhat_ky`). Camp đóng ngoài máy → lấy từ lịch sử Ethopex.

Vị trí (đường dẫn đầy đủ):
- Bản gốc trong repo: iMac `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/ethopex-ext`
- Bản cài sẵn (kèm khoa.js): iMac `/Users/htuan/Desktop/ethopex-ly-do` · MacBook `/Users/htuan/Desktop/ethopex-ly-do`

Cài: Chrome → `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn `/Users/htuan/Desktop/ethopex-ly-do`.
`khoa.js` (mã đọc của API, KHÔNG commit) do máy tạo: `window.ETHOPEX_LY_DO_KHOA = '<mã trong studio xv_khoa_ngoai ethopex_ext.token>'`.
