# HEARTBEAT — Tài

> Trạng thái: **bật** từ 13/11/2026 — `sua-tai-nguyen` mỗi 5 phút trên iMac (bộ điều phối → apps/cty/may/tai-nguyen-sua.mjs), chỉ gọi Claude khi hàng có việc, mỗi lần một việc.

Checklist mỗi vòng (không có việc → NO_REPLY):

- Kho kiến thức `~/Me/GitHub/tai-nguyen-ky-su` có không? không → báo phòng, dừng
- `THO_MAY_TEP=tai-nguyen-sua.json node worker/tho-may-viec.mjs --lay` (box3) có việc không? không → NO_REPLY
- Báo nhận trong chủ đề 🧰 Tài nguyên (`--nhan <id>`)
- Đọc sổ tay · đo · sửa gốc hoặc trả lời bằng số thật · kiểm · deploy
- Ghi bài học / đề xuất vào kho; máy commit kho
- Trả lời dưới tin (`--bao <id> da_sua|khong_sua|can_anh`)
