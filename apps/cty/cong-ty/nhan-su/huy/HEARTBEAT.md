# HEARTBEAT — Huy

> Trạng thái: **chờ anh duyệt lịch chạy iMac** — `sua-may-etp` mỗi 5 phút (bộ điều phối → apps/cty/may/etp-sua.mjs), chỉ gọi Claude khi hàng có việc, mỗi lần một việc.

Checklist mỗi vòng (không có việc → NO_REPLY):

- `THO_MAY_TEP=etp-sua.json node worker/tho-may-viec.mjs --lay` (box3) có việc không? không → NO_REPLY
- Báo nhận trong chủ đề 📂 Ethopex (`--nhan <id>`)
- Đo · tìm gốc · sửa trong phần Ethopex của repo mos2 · kiểm (tự kiểm + check-etp-gop-y) · push · kiểm lại box3
- Trả lời dưới tin (`--bao <id> da_sua|khong_sua|can_anh`)
