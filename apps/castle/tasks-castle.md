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
| Mặt tiền chi tiết (bước 2): cửa sổ vòm 3D (khung đá, bậu, lòng tối), Palas cửa vòm ba ô có cột, gờ đá mỗi tầng; bỏ tầng bị khối khác áp vào, bỏ chỗ khoét cửa; đi bộ gần lâu đài (≤ 260 m) tự về mô hình dựng, toàn cảnh / xa thì ảnh thật Google (`apDungAnh3d`) ; nhịp 2: mặt Palas hướng sân trên (tranh thánh George + Đức Mẹ Bavaria cắt bằng `scripts/cat-tranh-ngoai.py` từ ảnh Commons CC BY-SA 4.0 Naturliebhaberin, cửa vòm đôi, ban công — `datMatPalas`), tầng trệt nhìn ra sân trong = dãy vòm, sân lát đá; nhịp 3: mặt Palas hướng sân dựng riêng toàn bộ theo ảnh: cụm cửa Roman 4·3·4 ô có cột dưới vòm mù mỗi tầng, cửa đôi giữa hai tranh, cụm ba ô ra ban công (`nhomCua` dùng chung); đầu hồi lấy đúng tam giác từ hình khối (`MAT_PALAS.hoi`): gờ viền hai mép, diềm răng cưa bậc, cửa sổ tròn, lỗ tròn, bệ + tượng sư tử (`datMatPalas`, gộp lưới theo vật liệu), hai tháp góc sa thạch vàng (`datThapGoc`: thân bát giác bọc ngoài thân tròn OSM, con-xon xếp bậc, cửa sổ đôi có cột, diềm vòm nhỏ, vành răng cưa, mái chóp bát giác đồng xanh; khối đánh dấu `thap_goc` + `phong` trong `du-lieu/neuschwanstein-sua.json`) ; **mặt tiền theo ảnh = quy trình chuẩn**: (1) đo điểm ảnh thô trên ảnh có lưới (cụm cửa: từng ô kính, đỉnh ô, bậu, vòm; tranh; ban công; gờ; ảnh phụ neo bằng mốc chung) ghi vào `public/du-lieu/<lâu>-mat-*.json` (2) `python3 scripts/kiem-mat-tien.py [--anh ra.png]` đếm ô kính thẳng trên ảnh gốc, lệch số ô / vị trí → mã thoát 1 (3) `mattien.js quyDoiMat` đổi ra mét, `datMatPalas` dựng hoàn toàn từ tệp — không số đo viết tay trong mã; trước đây: bố cục mặt Palas hướng sân ĐO TỪ ẢNH (~38,7 px/m, mốc mái; mặt chạy từ tháp góc tới tháp góc = chân đầu hồi, tâm lệch đoạn tường OSM), tỉ lệ cụm cửa đo từ ảnh (ô 0,47 m, trụ 0,23 m, vòm bè), ảnh sân trên có trong chế độ so ảnh; cửa sổ mở được: `bocCuc` (bố cục cửa dùng chung) → `loCanh` khoét lỗ thật ở ô giữa cửa Palas dải phòng tầng ba, khung cửa ô đó không kính (`baMo`); đang leo sát cửa → E / nút Vào mở hai cánh vào trong, đứng lên sàn (`timCua`, `moCuaVao`) ; **nền sân trên** `MAT_SAN` = mái Palas − mặt sân đo trên ảnh Albert (tệp bố cục, `anhPhu.matSan`) ≈ +7,7 m (lưới EU-DEM ở sân thấp ~6 m): mặt lát đá phẳng, tường chắn từng mép xuống đất, lan can mép hở, bậc thang tự chọn ở mép hở ít bậc nhất (`soBac`), va chạm trimesh + hộp; `matDat(x, z)` = mặt đứng được (dãy vòm, dịch nhanh, khớp ảnh thật 3D đều dùng) | `mattien.js`, `ns.js`, `du-lieu/neuschwanstein-sua.json`, `du-lieu/neuschwanstein-anh.json`, `du-lieu/neuschwanstein-mat-palas-san.json`, `scripts/kiem-mat-tien.py` |
| **Nền + chiều cao theo ảnh 3D Google** (15/11/2026): `scripts/do-khoi-google.mjs` (chạy trên iMac, tự mở máy chủ tĩnh cổng 18777) đo trên ảnh 3D đã dời ngang (google3d.json `lech` −7 m: mái trùng mặt bằng OSM 70% → 98%) → `public/du-lieu/neuschwanstein-nen.json`: mặt đất quanh lâu đài, mặt sân trên (~973 m so mặt biển; lối vào 965 m), lệch từng khối (trung vị từng điểm: mặt Google − mặt khối thuần OSM, trang mở `?goc=osm`). ns.js: `datThat` = mặt đất thật (lọc mở, chỉ nâng, hoà 10 → 20 m quanh khối lâu đài có chiều cao OSM), lưới đất mịn + va chạm; mốc chân nhà `k.ref` = đất thấp nhất + trung vị lệch các khối trong vỏ; khối lệch riêng > 2,5 m → chiều cao theo Google; mặt Palas hướng sân: tỉ lệ đứng tính từ hai mốc (đỉnh khối neo, mặt sân) → đầu hồi, tháp góc, sàn tầng ba = bậu cửa tầng hai; hàng cửa Palas neo vào sàn tầng ba (`bocCuc neo`) | `ns.js`, `mattien.js`, `scripts/do-khoi-google.mjs`, `du-lieu/neuschwanstein-nen.json`, `du-lieu/google3d.json` |
| **Khớp camera + kiểm viền + thêm chóp** (15/11/2026): `scripts/khop-camera.mjs` dò camera ảnh so (độ cao / hướng / ngẩng / ống kính) cho viền ẢNH 3D GOOGLE trùng viền ảnh thật (ảnh 0: 3 px, ảnh 1: 22 px), ghi vào `du-lieu/neuschwanstein-anh.json`; `scripts/chup-so-anh.mjs` + `scripts/kiem-vien.py` so viền mô hình với ảnh (đoạn THIẾU / THỪA, % cột lệch ≤ 10 px, trung vị lệch; ghi `thieu.json`); `scripts/them-chop.mjs` tia từ camera qua đoạn THIẾU hẹp → chân trên mái mô hình + mũi → `du-lieu/neuschwanstein-chop.json` (chỉ giữ chóp thấy trên ≥ 2 ảnh hoặc trùng khối OSM), `mattien.js datChop` dựng; chỉnh chiều cao theo Google chỉ khi mặt đo phẳng đều (độ trải ≤ 3 m) | `scripts/khop-camera.mjs`, `scripts/kiem-vien.py`, `scripts/them-chop.mjs`, `du-lieu/neuschwanstein-chop.json` |
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
