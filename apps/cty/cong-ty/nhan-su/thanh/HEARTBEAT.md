# HEARTBEAT — Thành

> Trạng thái: **bật** từ 06/11/2026 — `xu-task-astrolas` mỗi 2 phút trên iMac, nghỉ 23:00–07:00 giờ VN (bộ điều phối → ~/bin/thanh/chay.mjs trên iMac, mỗi phiên là Claude Code thật trong tmux "thanh"), chỉ gọi Claude khi có task; trần 30 task / ngày.

Checklist mỗi vòng (không có việc → NO_REPLY):

- Anh có trả lời dưới tin báo không? Có → task đó thành Rework, làm trước
- `php artisan ai-tasks list` có In progress bị gián đoạn, Rework hoặc Not started không? không → NO_REPLY
- Có task chưa báo → một tin số lượng vào chủ đề Astrolas
- Mở một phiên chạy nguyên `/tasks`; sau mỗi task qua cổng máy rồi đẩy lên nhánh `ai`
- Báo ngay từng task vào chủ đề Astrolas, kèm số hôm nay đã xong + hàng chờ còn lại
- Đủ khoảng 15 task có commit và hết lô → chạy lệnh audit trên đúng các commit đó, báo đầu và cuối vào chủ đề Astrolas
