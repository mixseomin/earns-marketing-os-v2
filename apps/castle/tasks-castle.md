---
description: Nạp và XỬ hàng đợi góp ý của lâu đài 3D castle.on.tc (nút 💬 trên trang) — sửa tận gốc trong apps/castle, deploy, trả lời trong luồng, nộp cho anh duyệt
---

# Hàng đợi góp ý Lâu đài dung nham (castle.on.tc)

**Gọi được từ MỌI chat** (lệnh toàn cục: `~/.claude/commands/tasks-castle.md` là symlink về tệp này: `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/castle/tasks-castle.md`, iMac).
**Repo làm việc: `/Users/htuan/Me/GitHub/earns-marketing-os-v2`** — mọi lệnh / đường dẫn dùng TUYỆT ĐỐI. Việc đầu tiên: đọc `/Users/htuan/Me/GitHub/earns-marketing-os-v2/CLAUDE.md`.

Cùng script, cùng luật với `/tasks-mos2` (`/Users/htuan/Me/GitHub/earns-marketing-os-v2/.claude/commands/tasks-mos2.md` — đọc cho luật đầy đủ). Card sinh từ nút 💬 trên castle.on.tc:
trang tĩnh POST `/api/gop-y` (vhost) → route mos2 `apps/web/src/app/api/gop-y-ngoai/route.ts` → `guiGopYMos2` (hòm **mos2**). Tin gốc có **link trang**
(có `?h=<hạt giống>` = đúng lâu đài), **ngữ cảnh** (toạ độ, hướng nhìn, góc nhìn, giờ game, trong quán hay không, khổ màn) và **ảnh khung hình** lúc bấm.

**Kho việc:** card mos2 (`source_platform='feedback'`) có `source_url` bắt đầu `https://castle.on.tc/` — `GOPY_TRANG=castle.on.tc` lọc đúng các card đó.

```bash
S="ssh root@167.233.241.16 GOPY_TRANG=castle.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh"
$S list                       # việc còn phải làm
$S show <id>                  # toàn luồng + link ảnh
$S claim <id>                 # → In progress
$S reply <id> "<lời>"         # thêm tin, không đổi trạng thái
$S submit <id> "<lời>" [url]  # → Review (nộp cho anh duyệt)
```

## Bản đồ mã lâu đài (tệp tĩnh, không build — `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/castle/public/`)

| Phần | Tệp |
|---|---|
| Dựng lâu đài (đảo, tường, tháp, phố, nhà, cầu, bãi cỏ + hồ), vật lý Rapier, người chơi, camera, vòng vẽ, trần khung hình, lưu chỗ đứng (F5) | `main.js` |
| Góp ý dùng chung cả hai trang (nút 💬 → hộp gõ → `/api/gop-y` kèm ảnh + ngữ cảnh; hộp tự dựng DOM + CSS) | `gopy.js` |
| Điều khiển cảm ứng (điện thoại): cần gạt trái → `layTruc` của dibo, kéo ngón trên cảnh xoay camera, cột nút phải theo ngữ cảnh (Nhảy/Leo/Bật ra · Ngồi/Mở/Cầm/Đèn/Đọc/Đứng/Thả · Ném · Đá · 👁); Neuschwanstein dùng, Lâu đài dung nham còn bản riêng trong main.js | `camung.js` |
| Mặt tiền chi tiết (bước 2): cửa sổ vòm 3D (khung đá, bậu, lòng tối), Palas cửa vòm ba ô có cột, gờ đá mỗi tầng; bỏ tầng bị khối khác áp vào, bỏ chỗ khoét cửa; đi bộ gần lâu đài (≤ 260 m) tự về mô hình dựng, toàn cảnh / xa thì ảnh thật Google (`apDungAnh3d`) | `mattien.js`, `ns.js` |
| Nhiều người: máy chủ kênh (systemd `castle-kenh`, cổng 127.0.0.1:3891, nginx `/mp/`; kênh đông 1–4 ×25, kênh yên tĩnh ×6, phòng riêng theo mã ×10; danh tính = phiên mos2; mỗi người chỉ nhận người trong 200 m, chat trong 60 m). Sửa máy chủ xong: `systemctl restart castle-kenh`. Trang: nút 👥, tự vào kênh đông nhất còn chỗ | `server/kenh.mjs`, `public/nhieunguoi.js`, `deploy/castle-kenh.service` |
| Ảnh thật 3D: Google Photorealistic 3D Tiles qua Cesium ion (tài khoản htuan82, vault #697; khoá web khoá phạm vi trong `du-lieu/google3d.json`), thư viện 3d-tiles-renderer 0.5.3 (importmap); nhóm xoay 180° (khung thư viện X tây Z bắc), bù độ cao liên tục trên sân trong, va chạm dựng từ ô chi tiết (bỏ phần trong mặt bằng khối OSM), lưới đất EU-DEM chỉ tắt khi dưới chân có va chạm ô; nút 🌍 / 🧱 | `ns.js` (`anh3d`, `datAnh3d`, `capNhatAnh3d`) |
| Bảng đầu trang Neuschwanstein = giới thiệu khu đang đứng (phòng: `gioiThieu` của phòng; ngoài trời: `du-lieu/neuschwanstein-khu.json` theo khối OSM có tên), thu nhỏ được | `ns.js` (`khuTai`, `capNhatKhu`) |
| Bề mặt vẽ bằng canvas (đá, ngói, vữa gỗ, cuội, ván) | `tex.js` |
| Khung xương người + mọi động tác; vẽ hàng loạt; chỉ vẽ chi tiết người trong khung nhìn & gần 45 m | `nhanvat.js` |
| Quán Lửa Đỏ: nhà + nội thất + 14 người trong quán | `quan.js` |
| Ngày–đêm, lịch người dân, đường phố, chợ, lò rèn, giếng, lính tuần, lời thoại (E), gà, chó, chim, khói | `songdong.js` |
| Âm thanh Web Audio (không tệp) | `amthanh.js` |
| Bản đồ nhỏ | `bando.js` |
| Người chơi có xương + 24 động tác thật (Quaternius CC0, `tai-san/nguoi.glb` dựng bằng `scripts/tai-nhan-vat.mjs`) | `nguoi3d.js` |
| Mô-đun đi bộ dùng chung cho cả hai cảnh (đi / leo / đu mép / bơi / camera / đẩy vật; ngựa + xe móc vào qua `ngoai.buoc` / `ngoai.khung` trong main.js) | `dibo.js` |
| Đồ đạc KayKit (`tai-san/do-noi-that.glb` dựng bằng `scripts/tai-do-noi-that.mjs`) + tranh tường cắt từ photochrom (`scripts/cat-tranh-noi-that.py` → `du-lieu/anh/noi-that/`) + tương tác E (ngồi / mở / cầm / đèn / đọc) trong `ns.js` | `noithat.js`, `ns.js` |
| Nội thất Palas (tầng ba 13 phòng theo mặt bằng Commons CC BY 3.0 + Phòng hát tầng bốn, cầu thang xoắn, đồ đạc phỏng dựng) — dữ liệu `du-lieu/neuschwanstein-noi-that.json`, bản vẽ gốc `apps/castle/du-lieu-goc/` | `noithat.js` |
| Neuschwanstein thật (số đo OSM + địa hình, so ảnh thật, vật liệu, rừng, đi bộ) — trang `neuschwanstein.html`, dữ liệu `du-lieu/`, chỉnh theo ảnh `du-lieu/neuschwanstein-sua.json` | `ns.js` |
| Ngựa + xe ngựa (hình, dáng đi); cưỡi / lái / leo / bơi nằm trong `main.js` (`buocXe`, `buocDiBo`) | `phuongtien.js` |
| Giao diện (nút, bảng hướng dẫn, hộp góp ý) | `index.html` |
| nginx castle.on.tc (SSO mos2 + `/api/gop-y`) | `apps/castle/deploy/castle.on.tc.nginx` — cài tay lên box3 sau deploy (chép vào `/etc/nginx/sites-enabled/castle.on.tc`, `nginx -t`, reload); deploy.sh chưa tự cài vhost này |

## 1. Nạp

`$S list`, cũ trước. **Trần mỗi lượt: 10 mục.** `claim` cả batch NGAY rồi mới đọc. `$S show <id>` từng mục; **ảnh phải TẢI VỀ VÀ ĐỌC**
(tải về scratchpad rồi Read). Mở đúng lâu đài + chỗ đứng trong ngữ cảnh khi chụp kiểm.

## 2. Xử

Mỗi mục: đọc → **sửa tận gốc** → kiểm → push (GHA kéo mã về box3, tệp tĩnh lên ngay, không build) → so mã băm tệp trên box3 với máy → `$S submit <id> "<sai gì · sửa gì · commit nào>"`.

Kiểm bắt buộc — CHỈ trên iMac, không bao giờ mở trình duyệt trên máy chủ:
- `node --check` mọi tệp .js đã sửa.
- Chạy trang cục bộ trên iMac (`python3 -m http.server 18777` trong thư mục public), mở bằng Playwright cục bộ của iMac
  (`/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs`, cờ `--use-angle=metal --ignore-gpu-blocklist`) địa chỉ `http://127.0.0.1:18777/?h=<hạt>&thu=1`
  (`thu=1`: đi bộ không cần khoá chuột, không ghi chỗ đứng). Điều khiển qua `window.__lauDai` (vaoDiBo, than.setTranslation, datHuong, gioGame.datGio, sd, quanNguoi,
  ve() = số lệnh vẽ + số người gần/xa/ẩn). Xong thì tắt máy chủ thử.
- **Không làm nóng máy:** thêm vật nhiều thì vẽ hàng loạt (`phan()` trong nhanvat.js / InstancedMesh), đo `ve().lenh` và CPU trước–sau; giữ trần khung hình (60 / 30 để yên / 10 mất tiêu điểm).

## 3. Chặn

Thiếu ngữ cảnh → `$S reply <id> "<lý do bí>"`, để nguyên In progress. Chỉ dừng hỏi khi đụng xoá dữ liệu / tiêu tiền / tệp dùng chung ngoài `apps/castle`.

## 4. Báo

Mỗi mục một dòng (`✅ #id … → Review` / `⚠ #id … → còn In progress, đã hỏi lại`), kèm dòng NEO cuối theo luật chung.

**`submit` = nộp, KHÔNG đóng sổ** — "Duyệt xong" là nút của anh.
