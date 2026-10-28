---
description: Nạp và XỬ hàng đợi góp ý của etp.on.tc (quản lý camp Ethopex) — card feedback gửi từ trang etp; sửa tận gốc, deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý etp.on.tc

**Gọi được từ MỌI chat** (lệnh toàn cục: `~/.claude/commands/tasks-etp.md` là symlink về tệp này trong repo). **Repo làm việc: `/Users/htuan/Me/GitHub/earns-marketing-os-v2`** —
mọi lệnh / đường dẫn dùng TUYỆT ĐỐI vào đó. Việc đầu tiên: đọc `/Users/htuan/Me/GitHub/earns-marketing-os-v2/CLAUDE.md`.

Cùng khuôn `/tasks-mos2` (`/Users/htuan/Me/GitHub/earns-marketing-os-v2/.claude/commands/tasks-mos2.md`) — đọc file đó cho luật đầy đủ
(trần 10 mục/lượt, claim cả batch trước, tải ảnh về đọc, sửa tận gốc, lời nộp = sai gì · sửa gì · commit nào, `submit` = Review chứ không tự Done).

**Kho việc:** card góp ý mos2 (`human_tasks` project_id='mos2', source_platform='feedback') mà `source_url` là trang `https://etp.on.tc/…`
— nút nổi "Góp ý" trên etp ghi chung hòm mos2. `GOPY_TRANG=etp.on.tc` lọc đúng các card đó (list / show / claim / submit đều chỉ chạm card etp).

```bash
S="ssh root@167.233.241.16 GOPY_TRANG=etp.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh"
$S list · $S show <id> · $S claim <id> · $S reply <id> "…" · $S submit <id> "…" [url]
```

## Mã etp nằm đâu

- Trang: `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/web/src/components/etp-view.tsx` (cả màn) · dữ liệu `apps/web/src/lib/etp-doc.ts`
- Đồng bộ Ethopex → kho `etp.*`: `apps/etp/dong-bo.py` (box3, timer `etp-dong-bo` 10 phút)
- Máy luật camp: `apps/xuong-video/scripts/ethopex/luat-ethopex.py` · nhịp + tin Telegram: `apps/cty/worker/ethopex.mjs`
- Xưởng creative (cắt / dựng / lên): `apps/xuong-video/scripts/ethopex/*.py` (chạy trên iMac)

Nhiều phiên cùng sửa `etp-view.tsx` / `luat-ethopex.py` → đọc lại tệp ngay trước khi sửa, chỉ commit tệp của mình.

## Luật riêng etp (Ethopex — tiền QC thật)

- **Cấm tự lên / bật / tăng ngân sách camp** khi góp ý không ra lệnh rõ; góp ý về luật máy = sửa luật, không tay bấm camp.
- Không đụng camp ROAS ★ trừ khi card nói đích danh. Không chấm lại hàng loạt creative khi anh chưa cho.
- Chụp kiểm giao diện: phiên tạm `auth_sessions` + đường hầm `ssh -f -N -L 13821:127.0.0.1:3821 root@167.233.241.16` + Playwright cục bộ
  (`/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs`), mở `http://127.0.0.1:13821/etp?…`; lệnh ssh và script chụp tách hai lượt; xong `pkill -f "13821:127.0.0.1:3821"`.

## Thứ tự

1. Hàng đợi góp ý etp trước (`$S list`), xử hết rồi mới tính việc khác.
2. Trống → `~/bin/tiendo list --du-an ethopex`, đề xuất 1–3 bước đang dở nên làm tiếp (mỗi mục một dòng lý do); việc tốn tiền QC thì hỏi anh.
