---
description: Nạp và XỬ hàng đợi góp ý của thành phố city.on.tc (card feedback trên plays city) — sửa tận gốc, deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý Thành phố (city.on.tc)

**Gọi được từ MỌI chat** (lệnh toàn cục: `~/.claude/commands/tasks-city.md` là symlink về tệp này trong repo). **Repo làm việc: `/Users/htuan/Me/GitHub/earns-marketing-os-v2`** —
mọi lệnh / đường dẫn dùng TUYỆT ĐỐI vào đó, không cần mở repo làm cwd. Việc đầu tiên: đọc `/Users/htuan/Me/GitHub/earns-marketing-os-v2/CLAUDE.md`.

Cùng script, cùng luật với `/tasks-mos2` và `/tasks-studio`, khác hòm (`GOPY_PROJECT=city`). Card sinh từ nút 💬 trên city.on.tc
(`components/gop-y-mos2.tsx` với `hom='city'`, action `lib/actions/gop-y-mos2.ts`). Tin gốc có **link trang** (city.on.tc) + **ngữ cảnh**
(tiêu đề màn, ngăn đang mở, thiết bị + khổ màn) + ảnh — ảnh chụp cảnh 3D là nơi chứa phần lớn lỗi.

// turbo-all

**Kho việc:** `human_tasks` với `project_id='city'` AND `prep_payload->>'source_platform'='feedback'`. Lời góp ý là **tin đầu của luồng** `prep_payload.trao_doi`.

**Phạm vi cứng: CHỈ card góp ý city.** Không đụng hòm mos2, xuong-video, adfond.

```bash
S="ssh root@167.233.241.16 GOPY_PROJECT=city /opt/earns-marketing-os-v2/scripts/gop-y.sh"
$S list                       # việc còn phải làm
$S show <id>                  # toàn luồng + link ảnh
$S claim <id>                 # → In progress
$S reply <id> "<lời>"         # thêm tin, không đổi trạng thái
$S submit <id> "<lời>" [url]  # → Review (nộp cho anh duyệt)
```

## Bản đồ mã thành phố (đọc trước khi sửa)

| Phần | Tệp (repo `/Users/htuan/Me/GitHub/earns-marketing-os-v2`) |
|---|---|
| Mô hình thuần (khu, đích, nguồn, tiền, quy mô, tài nguyên) | `apps/web/src/lib/social-thanh-pho.ts` + test `social-thanh-pho.test.mts` |
| Đọc số thật (DB mos2, phiên adfond, máy chủ, cty, Ethopex) | `apps/web/src/lib/social-traffic.ts` (`docHeSinhThai`, `docMayChu`, `docCongTy`), `social-truc-tiep.ts` (`docNguonSite`) |
| Cảnh 3D (three.js r128: toà, rào, cổng, poster, tầng ngầm, điều khiển, thẻ hover / ngăn) | `apps/web/src/components/social-thanh-pho-canh.ts` |
| Trang city.on.tc + bản lưu đĩa mô hình | `apps/web/src/app/city/page.tsx`, `lib/thanh-pho-ban-luu.ts`, API `app/api/social/thanh-pho`, `app/api/social/canh-bao` |
| nginx city.on.tc (SSO mos2, danh sách đường mở) | box3 `/etc/nginx/sites-available/city.on.tc` — city gọi API mới thì thêm vào regex `location ~ ^/(city…)` |
| Bản artifact (cùng mã cảnh) | `scripts/thanh-pho/dung-artifact.mjs` → `scripts/thanh-pho/ra/thanh-pho-social.html`, đăng lại artifact `https://claude.ai/artifact/Mqmf53yvqxttnY3KLrnZv2` |

## 1. Nạp

`$S list`, cũ trước. **Trần mỗi lượt: 10 mục** (15 nếu toàn việc nhẹ). **`claim` cả batch NGAY** (`for id in …; do $S claim $id; done`) trước khi đọc ảnh.
`$S show <id>` từng mục; **ảnh phải TẢI VỀ VÀ ĐỌC** (`curl -o <scratchpad>/gopy-<id>.png <url>` rồi Read).

## 2. Xử

Mỗi mục: đọc → **sửa tận gốc** (luật nằm ở mô hình thì sửa mô hình + thêm assert vào test, không vá ở cảnh) →
kiểm → push (GHA tự deploy, đợi `~/bin/gh-watch deploy.yml`) → `$S submit <id> "<sai gì · sửa gì · commit nào>"`.

Kiểm bắt buộc:
- `cd /Users/htuan/Me/GitHub/earns-marketing-os-v2 && ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` và `node_modules/.bin/tsx apps/web/src/lib/social-thanh-pho.test.mts`.
- **Nhìn pixel:** KHÔNG mở mos2 / city.on.tc bằng trình duyệt tự động (luật chung; Cloudflare cũng chặn trình duyệt không đầu). Dựng tệp thử từ số thật
  `node scripts/thanh-pho/dung-artifact.mjs <scratchpad>/thu.html` rồi chụp tệp đó bằng Playwright TRÊN iMac (`/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright`, cờ `--use-gl=angle --enable-unsafe-swiftshader`), dùng ô tìm `.tim input` để bay tới đúng vật. Không chạy trình duyệt trên máy chủ.
- Số liệu: `curl` API trên box3 (`127.0.0.1:3821`, header `Host: city.on.tc` + phiên đo màn theo CLAUDE.md) hoặc `psql`.
- Đụng hiệu năng (thêm nhiều vật) thì gộp vào khối vẽ chung (`oPhang`, `rao`, `khachDs`) — đừng thêm mesh lẻ hàng loạt.
- Sau deploy: dựng lại + đăng lại artifact (Artifact tool, cùng `file_path`), ghi bước tiến độ `~/bin/tiendo` hạng mục thành phố (S05, dự án social).

## 3. Chặn

Thiếu ngữ cảnh → `$S reply <id> "<lý do bí>"`, để nguyên In progress, đi tiếp. Chỉ dừng hỏi khi đụng xoá dữ liệu / migration không lùi / tiêu tiền.

## 4. Báo

Mỗi mục một dòng (`✅ #id … → Review` / `⚠ #id … → còn In progress, đã hỏi lại`), kèm dòng NEO cuối theo luật chung.

## Luật không được lách

**`submit` = nộp, KHÔNG đóng sổ** — "Duyệt xong" là nút của anh (`guiTraoDoiCard`, quyền admin). **Sửa tận gốc** — cùng lý do `/tasks-mos2`.
**Thêm trường vào tin góp ý thì phải thêm chỗ hiện** (`scripts/check-gop-y-surface.mjs` chạy trong `deploy.sh`).
