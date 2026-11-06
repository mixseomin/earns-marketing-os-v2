# HEARTBEAT — Thành

> Trạng thái: **bật** từ 06/11/2026 — `xu-task-astrolas` mỗi 2 phút trên iMac, nghỉ 23:00–07:00 giờ VN (bộ điều phối → apps/cty/may/astrolas-tasks.mjs), chỉ gọi Claude khi có task; trần 30 task / ngày.

Checklist mỗi vòng (không có việc → NO_REPLY):

- Anh có trả lời dưới tin báo không? Có → task đó thành Rework, làm trước
- `php artisan ai-tasks list` có Rework / Not started không? không → NO_REPLY
- Có task chưa báo → một tin số lượng vào chủ đề Astrolas
- Nhận cả lô (tối đa 5 task, In progress), mỗi task một phiên: làm đúng luật `/tasks`, đẩy lên nhánh `ai`, Need Reviews hoặc Blocked
- Báo ngay từng task vào chủ đề Astrolas, kèm số hôm nay đã xong + hàng chờ còn lại
