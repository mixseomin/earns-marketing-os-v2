---
description: Nạp và XỬ hàng đợi góp ý của Sổ Thế Giới worlds.on.tc (nút 💬 trên trang) — sửa tận gốc trong apps/worlds, deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý Sổ Thế Giới (worlds.on.tc)

**Gọi được từ MỌI chat** (lệnh toàn cục: `~/.claude/commands/tasks-worlds.md` là symlink về tệp này: `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/worlds/tasks-worlds.md`, iMac).
**Repo làm việc: `/Users/htuan/Me/GitHub/earns-marketing-os-v2`** — đường dẫn dùng TUYỆT ĐỐI. Việc đầu tiên: đọc `/Users/htuan/Me/GitHub/earns-marketing-os-v2/CLAUDE.md`.
Kỹ sư máy (Giang, `/Users/htuan/Me/GitHub/cty/may/worlds-gop-y.mjs` repo cty, iMac) làm trong cây riêng `~/may-ky-su/giang/earns-marketing-os-v2` — thay đường dẫn repo bằng cây đó.

Card sinh từ nút 💬 trên worlds.on.tc: trang tĩnh POST `/api/gop-y` (vhost) → route mos2 `apps/web/src/app/api/gop-y-ngoai/route.ts` → hòm **mos2**.
Tin gốc có **link trang** (dạng `https://worlds.on.tc/#<thế giới>/<tab>/<phần tử>` = đúng màn anh đang nhìn) và **ảnh khung hình** lúc bấm.

**Kho việc:** card mos2 (`source_platform='feedback'`) có `source_url` bắt đầu `https://worlds.on.tc/` — `GOPY_TRANG=worlds.on.tc` lọc đúng các card đó.

```bash
S="ssh root@167.233.241.16 GOPY_TRANG=worlds.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh"
$S list                       # việc còn phải làm
$S show <id>                  # toàn luồng + link ảnh
$S claim <id>                 # → In progress
$S reply <id> "<lời>"         # thêm tin, không đổi trạng thái
$S submit <id> "<lời>" [url]  # → Review (nộp cho anh duyệt)
```

## Bản đồ mã (tệp tĩnh, không build — `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/worlds/`)

| Phần | Tệp |
|---|---|
| Khung trang: danh sách thế giới bên trái, vùng chính, ngăn kéo phần tử bên phải, nút 💬 | `public/index.html` |
| Định tuyến `#<thế giới>/<tab>/<phần tử>`, 4 tab (Chuỗi nhân quả · Thành phần · Dòng thời gian · Tiếng nói), dây nối SVG (`noiDay`), ngăn kéo (`veNgan`, `moNgan` đẩy trang sang trái), trang hướng dẫn | `public/app.js` |
| Giao diện, token màu sáng / tối, ngăn kéo `--ngan-w` | `public/app.css` |
| Dữ liệu: mỗi thế giới một tệp OnlyWorlds (+ trường nhà `lop`, `sinh_tu`, `tu_vung`, `nguon`); `index.json` = danh sách + số phần tử | `public/the-gioi/*.json` |
| Kiểm dữ liệu (id trùng, `sinh_tu` trỏ id không có, mồ côi, vòng nhân quả, loại lạ, index lệch tệp) | `scripts/kiem.mjs` (`--tu-kiem` = phá thử) |
| nginx (SSO mos2, `/api/gop-y`, `/chung/` = `apps/castle/public/` cho `gopy.js` dùng chung) | `deploy/worlds.on.tc.nginx` — deploy.sh khối 5e7 tự cài |

## 1. Nạp

`$S list`, cũ trước. **Trần mỗi lượt: 10 mục.** `claim` cả batch NGAY rồi mới đọc. `$S show <id>` từng mục; **ảnh phải TẢI VỀ VÀ ĐỌC**. Mở đúng link trong tin (`~/bin/br goto <link>` rồi `~/bin/br look`).

## 2. Xử

Mỗi mục: đọc → **sửa tận gốc** → kiểm → push (GHA kéo mã về box3, tệp tĩnh lên ngay, không build) → so mã băm tệp trên box3 với máy → mở lại trang bằng br, so với ảnh của anh → `$S submit <id> "<sai gì · sửa gì · commit nào>"`.

Kiểm bắt buộc:
- `node --check apps/worlds/public/app.js` (và mọi .js đã sửa).
- `node apps/worlds/scripts/kiem.mjs` — đỏ thì chưa được push. Sửa `kiem.mjs` thì chạy thêm `--tu-kiem`.
- Sửa dữ liệu thế giới: cập nhật `so_phan_tu` trong `index.json`; phần tử mới phải có `lop` + `sinh_tu` (trừ Gốc); tiếng Việt có dấu.
- Không có cache phải xoá: nginx thay `__BAN__` trong `?v=__BAN__` bằng mã bản mỗi lần deploy.

## 3. Chặn

Thiếu ngữ cảnh → `$S reply <id> "<lý do bí>"`, để nguyên In progress. Chỉ dừng hỏi khi đụng xoá dữ liệu / tiêu tiền / tệp dùng chung ngoài `apps/worlds` (vd `apps/castle/public/gopy.js`, route mos2).

## 4. Báo

Mỗi mục một dòng (`✅ #id … → Review` / `⚠ #id … → còn In progress, đã hỏi lại`), kèm dòng NEO cuối theo luật chung.

**`submit` = nộp, KHÔNG đóng sổ** — "Duyệt xong" là nút của anh.
