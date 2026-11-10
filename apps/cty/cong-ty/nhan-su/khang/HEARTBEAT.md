# HEARTBEAT — Khang

> Trạng thái: **bật** từ 10/11/2026 — `sua-social` mỗi 30 phút trên iMac (bộ điều phối → apps/cty/may/social-sua.mjs), chỉ gọi Claude khi hàng có việc, mỗi lần một việc.

Checklist mỗi vòng (không có việc → NO_REPLY):

- `THO_MAY_TEP=social-sua.json node worker/tho-may-viec.mjs --lay` (box3) có việc không? không → NO_REPLY
- Báo nhận trong chủ đề 📂 Social Traffic (`--nhan <id>`)
- Đọc lý do chặn · làm lại bài (`may-dung --lam-lai-sua`) hoặc sửa gốc máy sinh · kiểm · push · chấm lại trên box3
- Trả lời dưới tin (`--bao <id> da_sua|khong_sua|can_anh`)
