---
description: Nạp và XỬ hàng đợi góp ý của chính MOS2 (card feedback trên plays mos2) — sửa tận gốc, deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý MOS2

// turbo-all

Màn `/p/mos2/plays` trả lời "có gì đang chờ". Lệnh này trả lời "làm hết đi".

**Kho việc:** `human_tasks` với `project_id='mos2'` AND `prep_payload->>'source_platform'='feedback'`
— card do nút nổi góp ý sinh ra (`lib/actions/gop-y-mos2.ts`). Lời góp ý là **tin đầu của luồng
trao đổi** trong `prep_payload.trao_doi`, không phải một khối riêng.

**Phạm vi cứng: CHỈ card góp ý mos2.** Không đụng plays của site khác, không đụng `feedback` của
adfond, không đụng `ai_tasks` của Astrolas. Mỗi kho một cửa.

Mọi động tác đi qua một cửa duy nhất — script chạy **trên server** (nơi có `.env.production`):

```bash
S="ssh root@5.78.65.158 /opt/earns-marketing-os-v2/scripts/gop-y.sh"
$S list                       # việc còn phải làm
$S show <id>                  # toàn luồng + link ảnh
$S claim <id>                 # → In progress
$S reply <id> "<lời>"         # thêm tin, không đổi trạng thái
$S submit <id> "<lời>" [url]  # → Review (nộp cho anh duyệt)
```

## 1. Nạp

`$S list`. Chọn batch theo thứ tự cũ trước (script đã `ORDER BY created_at`).

**Trần mỗi lượt: 10 mục.** Nâng tới 15 nếu phần lớn là việc nhẹ — đổi chữ, sửa CSS, đổi ngưỡng,
ẩn/hiện một khối. Có từ một việc nặng (thêm tính năng, đổi luồng dữ liệu, refactor) thì giữ ~10.
Hết trần → dừng, báo, nhắc gõ lại `/tasks-mos2`. Batch quá dài chạy lâu và không ai soát nổi.

**`claim` cả batch NGAY sau khi chọn**, trước cả lúc đọc ảnh hay dò code:

```bash
for id in <id1> <id2> …; do $S claim $id; done
```

Chat khác đang chạy lệnh này song song sẽ đọc `pending` mà nhặt trùng. Claim sớm = họ thấy
`In progress` và bỏ qua. Không được lầm lũi sửa xong rồi mới đặt trạng thái ở cuối.

Rồi `$S show <id>` từng mục. **Ảnh thì phải TẢI VỀ VÀ ĐỌC** (`curl -o /tmp/gopy-<id>.png <url>`
rồi Read) — phần lớn báo lỗi hiển thị nằm trong ảnh chứ không nằm trong chữ. Bỏ qua ảnh là đoán mò.

## 2. Xử

Mỗi mục: đọc → **sửa tận gốc, không vá chỗ hiện** → `npm run typecheck && npm run lint` →
push (GHA tự deploy) → `$S submit <id> "<lời>"`.

Lời nộp gồm ba phần, mỗi phần một câu: **sai gì · sửa gì · commit nào**. Người mở card sau ba
tuần chỉ có mỗi câu này để hiểu chuyện đã xảy ra.

Trước khi đụng file, đọc context tương ứng trong `.claude/contexts/` theo bảng trong `CLAUDE.md`.
Sửa UI thì `.claude/contexts/ui-conventions.md` là bắt buộc.

## 3. Chặn

Thiếu ngữ cảnh không đoán được → `$S reply <id> "<lý do bí>"`, **để nguyên In progress**, đi tiếp
mục sau. Không dừng cả lượt vì một mục.

Chỉ dừng để hỏi khi đụng thứ phá vỡ hành vi — xoá dữ liệu, đổi hành vi công khai, migration
không lùi được. Hỏi đúng một câu, các mục còn lại vẫn chạy.

## 4. Báo

Một danh sách ở cuối, mỗi mục một dòng:

```
✅ #412 Drawer mất link trang lỗi → Review
✅ #415 Sai múi giờ ở cột hẹn → Review
⚠ #418 Không rõ "nút kia" là nút nào → còn In progress, đã hỏi lại trong luồng
```

Không tường thuật từng mục dọc đường.

## Luật không được lách

**`submit` = nộp, KHÔNG phải đóng sổ.** Cùng luật với `review` trong `lib/site-status.ts`: người
làm dừng ở Review, chỉ người duyệt mới đẩy sang Done. Đừng tự ký nghiệm thu việc của chính mình —
"Duyệt xong" là nút của anh trên drawer, và nó là quyền admin (`guiTraoDoiCard`).

**Sửa tận gốc.** Ca 26–29/08/2026: link trang bị lỗi biến mất khỏi mọi card ba ngày vì dữ liệu có
mà không có đường ra màn hình. Drawer vẫn đủ chữ đủ ảnh nên nhìn không ra. Vá cái nhìn thấy thì
lần sau vẫn mất im lặng — xem `scripts/check-gop-y-surface.mjs`.

**Thêm trường vào tin góp ý thì phải thêm chỗ hiện.** `check-gop-y-surface.mjs` chạy trong
`deploy.sh` và sẽ đỏ nếu quên.
