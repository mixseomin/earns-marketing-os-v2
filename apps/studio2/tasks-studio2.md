---
description: Nạp và XỬ hàng đợi góp ý của Studio 2 (studio2.on.tc, nút 💬 trên thanh trên) — sửa tận gốc trong apps/studio2 (và phần studio nó gọi), deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý Studio 2 (studio2.on.tc)

**Repo làm việc: `/Users/htuan/Me/GitHub/earns-marketing-os-v2`** (iMac) — mọi lệnh / đường dẫn dùng TUYỆT ĐỐI. Việc đầu tiên: đọc `/Users/htuan/Me/GitHub/earns-marketing-os-v2/CLAUDE.md`
và `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/studio2/README.md`.

Cùng script, cùng luật với `/tasks-mos2` (`/Users/htuan/Me/GitHub/earns-marketing-os-v2/.claude/commands/tasks-mos2.md` — đọc cho luật đầy đủ). Card sinh từ nút 💬 trên studio2.on.tc:
trang nạp script `https://mos2.on.tc/api/gop-y-ngoai/nut` → hòm chuẩn mos2 (`/nhung/gop-y`) trong khung phủ màn → `guiGopYMos2` (hòm **mos2**). Tin gốc có **link trang**
(`?phim=<id>&tap=<id>&ban=…&bc=…` = đúng phim, tập, bản, bố cục), **ngữ cảnh** (`window.__nguCanhTrang` trong `studio2.js`: phim, tập, số cảnh, bản Gọn / Pro, có đang xem như người mới,
bố cục, cảnh đang chọn, mục quy trình đang mở, bước đang chạy / vừa bị studio từ chối) và ảnh người gửi dán / chụp trong hòm.

**Kho việc:** card mos2 (`source_platform='feedback'`) có `source_url` bắt đầu `https://studio2.on.tc/` — `GOPY_TRANG=studio2.on.tc` lọc đúng các card đó.

```bash
S="ssh root@167.233.241.16 GOPY_TRANG=studio2.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh"
$S list                       # việc còn phải làm
$S show <id>                  # toàn luồng + link ảnh
$S claim <id>                 # → In progress
$S reply <id> "<lời>"         # thêm tin, không đổi trạng thái (hỏi lại người gửi: mở tin bằng ❓)
$S submit <id> "<lời>" [url]  # → Review (nộp cho anh duyệt)
```

## Bản đồ mã

| Phần | Tệp |
|---|---|
| Cả trình dựng (trang tĩnh, không build): mô hình dự án, widget, lưới bố cục, quy trình, các bước làm phim, lưu sửa, người mới, nút góp ý + ngữ cảnh | `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/studio2/public/studio2.js`, `studio2.css`, `index.html` |
| Các bước làm phim Studio 2 được gọi trên studio (sổ hàm đọc / ghi, bảng quyền đội) | `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/src/lib/doc-ham.ts`, `ghi-ham.ts`, `quyen-s2.ts`, `actions-studio2.ts` |
| vhost (SSO mos2, chuyển `/api/xv/` sang studio, mã bản `__BAN__`) | `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/studio2/deploy/studio2.on.tc.nginx` (deploy.sh khối 5e3 tự cài) |
| Lọc "Của tôi" theo nơi đang xem | `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/web/src/lib/gop-y-loc-nguon.ts` |

## 1. Nạp

`$S list`, cũ trước. **Trần mỗi lượt: 10 mục.** `claim` cả batch NGAY rồi mới đọc. `$S show <id>` từng mục; **ảnh phải TẢI VỀ VÀ ĐỌC** (tải về scratchpad rồi Read).
Mở đúng link trang trong card (phim, tập, bản, bố cục) khi chụp kiểm.

## 2. Xử

Mỗi mục: đọc → **sửa tận gốc** → kiểm (`node --check` cho `studio2.js`; bước tốn tiền chỉ bấm khi anh bảo, mỗi lần một bước) → push (GHA kéo mã về box3; tệp tĩnh lên theo mã bản mới của
`/etc/nginx/snippets/studio2-ban.conf`) → mở trang thật kiểm đúng chỗ người gửi báo → `$S submit <id> "<sai gì · sửa gì · commit nào>"`. Câu hỏi thì trả lời thẳng trong luồng rồi `submit`.
Kỹ sư chỉ nộp Review; Done là chữ ký người duyệt.
