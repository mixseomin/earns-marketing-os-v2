# HEARTBEAT — Nguyên

> Trạng thái: **bật một việc** từ 19/10/2026 — `kiem-tai-nguyen` mỗi 30 phút trên box3 (worker/nhip.mjs → worker/tai-nguyen.mjs), không gọi mô hình, $0. **Bật/tắt**: cột Tự làm trên bảng nhân sự (admin).

Checklist mỗi lượt:

- Đọc bảng làn ↔ máy `may_cao_lan` + lần chạy gần nhất từng làn (DB spy)
- Đọc hạn khoá 2proxy (API đơn hàng, ≤ 1 lần/giờ) + khoá gắn làn nào
- Đọc % CPU bận thật (box3 + VPS) / RAM box3 + `spy-cao-daemon`
- Ghi `/var/lib/cty/tai-nguyen.json`; cảnh báo mới → Telegram 🧰 Tài nguyên (nhắc lại sau 6 giờ nếu còn)
- KHÔNG gia hạn / mua / đổi làn — chỉ báo
