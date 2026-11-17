# HEARTBEAT — Khôi

> Trạng thái: **bật** từ 17/11/2026 — `xu-gop-y-cty` mỗi 5 phút trên iMac (bộ điều phối → apps/cty/may/cty-gop-y.mjs), chỉ gọi Claude khi hòm có card mở.

Checklist mỗi vòng (không có việc → NO_REPLY):

- Card góp ý cty pending / claimed / broken nào chưa làm, hoặc có tin mới của anh? không → NO_REPLY
- Kéo origin/main vào cây riêng, chạy /tasks-cty cho đúng card đó: claim · sửa gốc apps/cty · typecheck + tu-kiem · push · gh-watch · mở lại trang
- `gop-y.sh reply` vào luồng card rồi `submit` (nộp Review); cần anh quyết thì chỉ reply một câu hỏi
