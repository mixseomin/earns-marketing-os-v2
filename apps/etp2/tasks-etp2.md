---
description: Nạp và XỬ hàng đợi góp ý của etp2.on.tc (bản etp riêng của anh, apps/etp2) — card feedback gửi từ trang etp2; sửa tận gốc trong apps/etp2, deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý etp2.on.tc

**Gọi được từ MỌI chat** (`~/.claude/commands/tasks-etp2.md` là symlink về tệp này: `apps/etp2/tasks-etp2.md`). **Repo: `/Users/htuan/Me/GitHub/earns-marketing-os-v2`** — mọi lệnh / đường dẫn dùng TUYỆT ĐỐI.
Việc đầu tiên: đọc `/Users/htuan/Me/GitHub/earns-marketing-os-v2/CLAUDE.md`.

Cùng khuôn `/tasks-etp` (`/Users/htuan/Me/GitHub/earns-marketing-os-v2/.claude/commands/tasks-etp.md`) — đọc tệp đó cho luật riêng etp (tiền QC thật, cấm tự lên / bật / tăng camp,
không đụng camp ROAS ★, điều kiện chống quay về bản cũ) và `/tasks-mos2` cho luật hòm chung (trần 10 mục/lượt, claim cả batch trước, tải ảnh về đọc, sửa tận gốc,
lời nộp = sai gì · sửa gì · commit nào, `submit` = Review chứ không tự Done).

**Kho việc:** card góp ý mos2 (`human_tasks` project_id='mos2', source_platform='feedback') mà `source_url` là trang `https://etp2.on.tc/…`.

```bash
S() { ssh root@167.233.241.16 "GOPY_TRANG=etp2.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh $(printf '%q ' "$@")"; }
S list · S show <id> · S claim <id> · S reply <id> "…" · S submit <id> "…" [url]
```
(hàm có `printf %q` để lời nộp có dấu ngoặc / nháy không vỡ lệnh ssh)

## etp2 khác etp thế nào (anh 09/11/2026)

- **etp2 = app riêng `apps/etp2`** (etp2.on.tc :3880, `mos2-etp2.service`, chỉ admin mos2). Chép từ trang etp của `apps/web` lúc tách.
- **etp.on.tc (`apps/web/src/components/etp-view.tsx` …) ĐÓNG BĂNG** — anh: "cái hiện tại để yên ko update gì thêm nữa". Góp ý etp2 CHỈ sửa trong `apps/etp2`, không sửa `apps/web`.
- Mã etp2: trang `apps/etp2/src/components/etp-view.tsx` · dữ liệu `apps/etp2/src/lib/etp-doc.ts` · action `apps/etp2/src/lib/actions/`.
- Máy chạy nền (đồng bộ, luật, Telegram) KHÔNG thuộc etp2: `apps/etp/*.py`, `apps/xuong-video/scripts/ethopex/luat-ethopex.py`, `apps/cty/worker/ethopex.mjs` — dùng chung cho cả hai trang.
- Chống quay về bản cũ: `scripts/check-etp-gop-y.mjs` là tệp dùng chung (hook pham-vi-app chặn khi anh không gọi tên) — điều kiện của etp2 ghi ở
  `apps/etp2/kiem-gop-y.mjs` (cùng khuôn mot / co / cam, tep tính từ gốc repo) nếu có; chạy nó trước khi submit.
- Kiểm kiểu: `cd apps/etp2 && npx tsc --noEmit` (~5–15s). Deploy chỉ sửa etp2 ≈ 50s (GHA chỉ dựng etp2).
- Đo / kiểm trang: phiên tạm `auth_sessions` 15 phút (CLAUDE.md "Phiên đo màn") rồi `curl -H "Cookie: mos2-session=<token>" "https://etp2.on.tc/?t=…"`;
  journal `journalctl -u mos2-etp2 | grep -E "etp-do|etp-cham"` (thời gian đọc dữ liệu, câu SQL > 400ms).

## Thứ tự

1. Hàng đợi góp ý etp2 (`S list`), xử hết rồi mới tính việc khác.
2. Trống → `~/bin/followup list ethopex` / `~/bin/tiendo list --du-an ethopex`, đề xuất 1–3 việc etp2 đang dở; việc tốn tiền QC thì hỏi anh.
