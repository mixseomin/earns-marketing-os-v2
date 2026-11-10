# HEARTBEAT — Quang

> Trạng thái: **đang chạy** — `tu-van-etp` trên box3 (worker/nhip.mjs kiểm mỗi 5 phút → worker/etp-tu-van.mjs), anh duyệt 10/11/2026.

Checklist mỗi vòng (chưa tới mốc → NO_REPLY):

- Giờ VN nằm trong [mốc, mốc + 15 phút) của 06:45 · 11:45 · 14:45 · 20:45 và mốc hôm nay chưa gửi? không → NO_REPLY
- `python3 apps/etp/tu_van.py --phien HH:MM --ai` → mỗi người một bản (số + lời bình ckey, trần 1.000₫ / ngày)
- Gửi vào chủ đề "🧭 Tư vấn · <tên>" của từng người (tạo lần đầu) trong nhóm Telegram của David
- Gửi hỏng → lỗi nhịp hiện ở bảng nhân sự, không gửi lặp mốc đó
