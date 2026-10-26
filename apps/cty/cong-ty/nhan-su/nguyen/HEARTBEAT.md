# HEARTBEAT — Nguyên

> Trạng thái: **bật một việc** từ 19/10/2026 — `kiem-tai-nguyen` mỗi 30 phút trên box3 (worker/nhip.mjs → worker/tai-nguyen.mjs), không gọi mô hình, $0. **Bật/tắt**: cột Tự làm trên bảng nhân sự (admin).

Checklist mỗi lượt:

- Đọc bảng làn ↔ máy `may_cao_lan` + lần chạy gần nhất từng làn (DB spy)
- Đọc hạn khoá 2proxy (API đơn hàng, ≤ 1 lần/giờ) + khoá gắn làn nào
- Đọc % CPU bận thật (box3 + VPS) / RAM box3 + `spy-cao-daemon`
- Ghi `/var/lib/cty/tai-nguyen.json`; cảnh báo mới → Telegram 🧰 Tài nguyên (nhắc lại sau 6 giờ nếu còn)
- Đọc danh sách người bán ckey của spy (`/var/lib/spy/ckey-tuyen.json`, việc `spy-bao-tri-ckey.timer` 6 giờ — giao Nguyên 26/10/2026): việc đứng > 13 giờ → thợ máy · dòng hết người bán · người bán đổi giá (anh bấm chấp nhận trên ckey.vn) · danh sách đổi → Telegram
- Báo cáo ngày: thêm dòng **Spy AI hôm qua** theo tuyến ckey / fal / chính hãng — chính hãng > 10% là in đậm cảnh báo (luật anh: ckey trước, chính hãng luôn cuối)
- KHÔNG gia hạn / mua / đổi làn — chỉ báo
