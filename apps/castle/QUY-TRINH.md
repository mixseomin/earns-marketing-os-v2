# Quy trình dựng lâu đài đúng ảnh (đo → kiểm → dựng)

Dùng chung cho mọi lâu đài / công trình. Mọi công cụ nhận `--lau <tên>` (mặc định `neuschwanstein`), đọc / ghi `public/du-lieu/<tên>-*.json`, mở trang `neuschwanstein.html?lau=<tên>`.
Công cụ chạy trên **iMac** (có trình duyệt). Lõi chung: `scripts/chung.mjs` (máy chủ tĩnh cổng 18777, Playwright, mở trang) — công cụ mới phải dùng nó, không chép lại.

Đích là **LOD3** theo chuẩn CityGML 3.0 / CityJSON: khối + mái đúng hình (LOD2) **và** cửa sổ, cửa đi, cửa mái, chóp trên từng mặt tường.

## 0. Nguồn

| Tệp | Lấy bằng | Ghi chú |
|---|---|---|
| `<tên>.json` (khối OSM + địa hình) | `node scripts/tai-lau-dai-that.mjs <tên> <lat> <lng>` | khối nhà OSM, lưới EU-DEM |
| `<tên>-anh.json` + `du-lieu/anh/` | `node scripts/tai-anh-doi-chieu.mjs <tên> "File:…"` | ảnh Commons có toạ độ chỗ đứng chụp, ghi tác giả + giấy phép |
| ảnh 3D Google | `du-lieu/google3d.json` (token web Cesium, vault #697) | nguồn hình khối + mặt tường mọi phía |

## 1a. CÁCH 3 — khối khớp lưới ảnh 3D (anh chốt 16/11/2026, xem song song bằng nút 🧩)

Cách chuyên gia dựng lại công trình thật: lấy lưới đo thật (photogrammetry / ảnh 3D Google) làm khối mẫu, dựng khối sạch bám theo, rồi gắn bộ chi tiết.
`node apps/castle/scripts/khop-khoi.mjs --lau <tên> [B=0.4] [NOI=2.5]` chụp ảnh 3D TỪ TRÊN XUỐNG (camera trực giao, ghi thẳng độ cao thế giới vào ảnh số thực)
→ `<tên>-cach3.json` (độ cao thật mỗi ô + loại vật liệu); `public/cach3.js` dựng mặt trên theo độ cao thật + tường đứng ở chỗ đổi bậc, bỏ ô sát đất (< 2 m).
Bước kế: gắn bộ chi tiết (cửa, răng cưa, tháp canh… — trangtri.js / mattien.js) lên mặt tường cách 3; va chạm / đi bộ vẫn theo cách cũ tới khi cách 3 đủ chi tiết.

## 1. Hình khối (LOD2)

1. `node scripts/do-khoi-google.mjs --lau <tên>` → `<tên>-nen.json`: mặt đất thật quanh công trình, mặt sân, lệch từng khối OSM so với ảnh 3D (đo cặp từng điểm). Trang dùng ngay: mốc chân nhà, chiều cao khối.
2. Ảnh 3D lệch ngang so với OSM → dò dời (mái Google trùng mặt bằng OSM cao nhất) rồi ghi `google3d.json` `lech`.
3. Sửa riêng theo ảnh (màu, phóng mặt bằng, tháp đặc biệt) → `<tên>-sua.json` (mỗi mục có `ly_do`).

## 2. Camera ảnh so

4. `node scripts/khop-camera.mjs --lau <tên> [chỉ số ảnh]` → camera mỗi ảnh khớp viền ảnh 3D với viền ảnh thật (ghi `<tên>-anh.json`). Đạt khi trung vị lệch viền ≤ 10 px.

## 3. Mặt tường (LOD3)

5. Ảnh chính diện mọi mặt: `node scripts/nan-google.mjs <thư mục> [khối] --lau <tên>` (ảnh 3D nhìn thẳng, 8 px/m, đủ 4 phía) và / hoặc `node scripts/nan-mat.mjs <thư mục> <ảnh> [khối] --lau <tên>` (ảnh chụp đã khớp camera, rõ hơn nhưng chỉ phía ảnh thấy).
6. **Dò nháp:** `python3 scripts/do-cua-so.py <thư mục> <nhãn> --lau <tên> --anh` → hàng cửa, cụm, số ô, cửa mái, mái hiên. Ảnh 3D nhoè: hàng thường đúng, ô ~60–70 % → **chỉ là bản nháp**.
7. **Soát + sửa:** xem ảnh `cua-*.png` (khung vẽ chồng), sửa số liệu sai trong `<tên>-cua-so.json` (mỗi sửa ghi `ly_do`). Mặt có ảnh chụp rõ thì đo trên ảnh chụp như mặt sân Palas (`<tên>-mat-*.json`, kiểm bằng `python3 scripts/kiem-mat-tien.py`).
8. Chi tiết đặc biệt (tháp góc, ban công, tranh, đầu hồi): đo điểm ảnh trên ảnh có lưới 10 px, ghi tệp bố cục, dựng hoàn toàn từ tệp (`mattien.js`), không số viết tay trong mã.

### 3b. Dựng từng mảng tường: KHUNG → VỊ TRÍ → TƯƠNG QUAN → HOA VĂN (bắt buộc theo thứ tự)

1. **KHUNG tổng thể mảng tường khớp ảnh TRƯỚC mọi chi tiết.** Đo trên ảnh gần chính diện (kẻ lưới, lấy thước từ một thứ biết cỡ — ô cửa, vòm cổng): mép trái / phải, chân tường, mái hiên, đỉnh (răng cưa / đầu hồi), chỗ lùi / nhô của từng khối. Ghi tỉ lệ `cao/rộng` vào `<tên>-kiem-ke.json` (`"khung": { "mat": "khối#cạnh", "ti_le_cao_rong": … }`).
   Khung lệch (> 6 %) thì sửa NGUỒN của khung, không xê dịch chi tiết bù: mặt đất trước tường (neo `neo_mat_dat` của sân trong `<tên>-sua.json`), chiều cao khối (sua.json), mốc chân nhà. Mốc chân nhà tính trên mặt đất ĐO GỐC — san sân / đường không được kéo khối nhà lên xuống.
2. **Thành phần ĐẾM ĐƯỢC + VỊ TRÍ trong khung.** Mỗi mặt chia vùng (`dinh`, `than_tren`, `than_duoi`, `chan`, hoặc `toan`) — ranh vùng ghi theo khung (`tu_v` / `den_v`, 0 chân → 1 mái hiên), không ghi mét tuyệt đối.
   Đếm cửa sổ, cổng, cửa đi, ô vuông, ô tròn, cửa mái, tháp canh, răng cưa… và đo VỊ TRÍ từng cái theo toạ độ khung: **u** 0 trái → 1 phải nhìn từ ngoài, **v** 0 chân → 1 mái hiên.
   Số đo dựng ghi THẲNG theo khung trong `<tên>-cua-so.json` (`"khung": true`, `hang_khung` [{v0, v1, cum: [[u0, u1, số ô]]}], `o_tron_khung`, `o_vuong_khung`, `mau.v`) — mô hình tự đổi sang mét theo khung của chính mặt đó. **Cấm tự đổi tay u, v sang mét**: khung đổi là cả mặt lệch.
3. **TƯƠNG QUAN giữa các thành phần**: thẳng cột (ô tròn trên cửa, huy hiệu trên vòm), cùng hàng, đối xứng — ghi `quan_he` trong vùng (`["thang_cot", A, B]`, `["cung_hang", A]`).
4. **HOA VĂN / HOẠ TIẾT** sau cùng: huy hiệu, gờ ngang, dải vòm nhỏ, đá góc, neo sắt, vành răng cưa, ban công, đồng hồ (`trangtri.js`; thẻ khối trong sua.json: `rang_cua`, `vom_nho`, `da_goc`, `thap_canh`, `vong_rang`, `cua_thap`, `go_y`; theo mặt trong cua-so.json: `rang_cua` (số / 0 = không), `vom_nho`, `neo_y`, `o_vuong`, `o_tron`, `ban_cong`, `dong_ho`, `mau` hai tầng).

Kiểm: `node apps/castle/scripts/kiem-ke.mjs --lau <tên>` → theo từng mặt: KHUNG (lệch %), số lượng từng vùng (THIẾU / thừa), VỊ TRÍ (lệch lớn nhất % khung, > 6 % là SAI), TƯƠNG QUAN; cộng CHỒNG LẤN trên TOÀN mô hình (khung ngoài ô cửa — viền đá, vòm bao — của hai cụm trên cùng mặt chạm nhau); thoát 1 khi còn bất kỳ lỗi nào.
Cửa theo số đo luôn đi qua `boTriDo` (mattien.js, dùng chung dựng khung + khoét lỗ): hàng thu gọn trong dải không chạm hàng kề, hàng dò trùng / cụm chạm cụm bị bỏ, vòm bao chỉ khi còn chỗ — không vẽ chi tiết đè nhau để "đủ số".
Mỗi mặt chỉ xong khi: kiểm kê sạch **và** chụp mô hình từ đúng chỗ đặt máy, đặt cạnh ảnh thật, không còn chỗ khoanh ra được. Nhầm hướng: trục z của cảnh hướng NAM (z = −(vĩ độ − vĩ độ tâm) × 111 320) — kiểm hướng trước khi đặt tên "bắc / nam".

## 4. Kiểm toàn cảnh

9. `node scripts/chup-so-anh.mjs <thư mục> --lau <tên>` rồi `python3 scripts/kiem-vien.py <thư mục>` → đoạn THIẾU / THỪA của viền trời, % cột khớp, `thieu.json`.
10. `node scripts/them-chop.mjs <thư mục> --lau <tên>` → chóp / tháp nhỏ OSM không có (`<tên>-chop.json`; chỉ giữ chóp thấy trên ≥ 2 ảnh hoặc nối khối OSM).
11. Lặp 1–10 tới khi: kiểm cụm cửa đạt hết, kiểm viền ≥ 80 % cột khớp, chồng ảnh 50 % không lệch thấy được.

### 4b. Báo lệch theo góc nhìn (nút 🔍 + CLI)

`node apps/castle/scripts/so-lech.mjs --the <id thẻ góp ý>` hoặc `--cam '{"p":[x,y,z],"d":[dx,dy,dz],"fov":50,"zoom":40,"w":1280,"h":800}' [--vung '[[[u,v],…]]']`:
chụp hai bản cùng camera (`window.__ns.chupHaiBan`, cùng hàm nút trên trang), so (`scripts/so-lech.py`: viền trời · màu khối chuẩn hoá · đường nét, lưới 32 × 20 ô), vùng tô đỏ ×2 điểm,
dò mỗi vùng ra mặt tường (`window.__ns.diemTaiAnh`). Phá thử đã chạy: hạ tháp góc Torbau còn 10 m → vùng đỉnh tháp lên #1 (bản đúng không có vùng đó).

## 5. Không lùi

**Sau MỌI lần sửa mã castle:** `node apps/castle/scripts/kiem-chu-thich.mjs` (chú thích `//` nuốt mã — `node --check` không bắt được khi phần bị nuốt vẫn đúng cú pháp; tự kiểm `--tu-kiem`). Khi sửa bằng thay chuỗi: chú thích mới đặt trên DÒNG RIÊNG, không nối vào cuối đoạn thay.

Sau mỗi nhịp: cầu thang / nội thất, leo + cửa sổ trèo vào, điều khiển điện thoại (bài thử trong phiên), đo tải điện thoại (tam giác, lệnh vẽ). Ghi mã băm box3 = iMac sau deploy.
