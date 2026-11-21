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
**Bản đầy đủ (nút 🧩 = `?cach=3`):** `node apps/castle/scripts/khoi-tu-dsm.mjs --lau <tên>` lấy ĐỘ CAO từng khối từ bản đồ đó (phân vị 95 trong mặt bằng, bỏ ô vọt > trung vị + 6 m của khối cao bên cạnh;
khối có khối chồng trên / ít ô / đã đo tay bằng tia (y_tren trong sua.json) thì giữ; tháp nhỏ mái bằng mà vượt > 8 m → mái chóp) → `<tên>-sua-cach3.json`, chỉ áp khi `?cach=3`
— mặt bằng + mọi chi tiết + đi bộ giữ nguyên. Không tự ước chiều cao mái (dải mép lẫn ô thấp → mái 11 m đè mặt tiền). `?cach=dsm`: lớp khối thô từ bản đồ (soi số đo).
So ba bản: `so-lech.mjs --cam … [--cach3]`.
Bước kế: gắn bộ chi tiết (cửa, răng cưa, tháp canh… — trangtri.js / mattien.js) lên mặt tường cách 3; va chạm / đi bộ vẫn theo cách cũ tới khi cách 3 đủ chi tiết.

## 1. Hình khối (LOD2)

1. `node scripts/do-khoi-google.mjs --lau <tên>` → `<tên>-nen.json`: mặt đất thật quanh công trình, mặt sân, lệch từng khối OSM so với ảnh 3D (đo cặp từng điểm). Trang dùng ngay: mốc chân nhà, chiều cao khối.
2. Ảnh 3D lệch ngang so với OSM → dò dời (mái Google trùng mặt bằng OSM cao nhất) rồi ghi `google3d.json` `lech`.
3. Sửa riêng theo ảnh (màu, phóng mặt bằng, tháp đặc biệt) → `<tên>-sua.json` (mỗi mục có `ly_do`).

### 1b. Khung theo SỐ ĐO CHÍNH THỨC của Bavaria (chuẩn từ 20/11/2026 — thước của trọng tài)

Nguồn: dữ liệu mở Bayerische Vermessungsverwaltung (geodaten.bayern.de/opengeodata, CC BY 4.0), ô 631_5268 — `bash scripts/tai-bayern.sh` tải DOM20 (mặt trên 20 cm), DGM1 (địa hình 1 m), LoD2 (toà "Schloss Neuschwanstein": 214 mặt mái) vào `du-lieu-goc/bayern/` (tệp lớn không vào git).
Mặt bằng OSM của cảnh lệch dữ liệu chính thức +7 m đông, +1 m nam (các công cụ tự dời). Lưới ảnh 3D Google bẹp ở khối nhỏ (cụm cổng Torbau thấp hơn thật 4–8 m, sân trước cổng 8,7 m) → KHÔNG lấy Google làm thước chiều cao nữa.

- `node scripts/sua-theo-dom20.mjs [--ghi | --kiem]` — đỉnh từng khối so DOM20 (điểm nằm sâu trong mặt bằng); khối lệch đều ≥ 1,5 m → dời `y_tren`; lệch không đều → "dựng lại mái theo LoD2"; tháp chóp nhọn không dời. Khối bị khối cao hơn phủ lên (cụm Torbau): đo đỉnh RIÊNG trên phần lộ thiên rồi ghi tay `y_tren` kèm `ly_do_dom20`.
- `node scripts/dat-theo-dgm1.mjs --ghi` — mặt đất (`<tên>-nen.json` diem + neo sân) theo DGM1 / DOM20. `node scripts/so-dat-dgm1.mjs` đo lại.
- `node scripts/doi-chi-tiet.mjs --ghi` — sau khi dời khối: dời theo mọi số đo độ cao tuyệt đối của mặt khối đó (`<tên>-cua-so.json`) và dải của sổ kiểm kê.
- `node scripts/chup-goc.mjs <thư mục> truoc|sau` + `--ghep truoc sau` — ảnh trước / sau ở bộ góc cố định.
- Trọng tài (`trong-tai.mjs`) chấm chiều cao bằng `sua-theo-dom20.mjs --kiem`.

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

### 4c. So ảnh thật đúng camera — TRƯỚC / SAU mỗi lần sửa (bắt buộc)

`node apps/castle/scripts/so-anh-that.mjs --khoi <khối OSM> --nhan truoc` trước khi sửa, `--nhan sau` sau khi sửa: mọi ảnh đã định vị (`<lâu>-do-anh.json`) thấy khối → vẽ mô hình đúng
camera ảnh, so viền trời + nét từng mặt (`scripts/so-anh-that.py`), ghép ẢNH THẬT · TRƯỚC · SAU vào `apps/castle/.so-anh/<khối>/`. Mã thoát 1 = có ảnh kém đi (viền −2 điểm hoặc nét −0,03)
→ chưa xong. Gửi anh ảnh ghép các ảnh có số đổi. Chấm hồng = viền DOM20 (mặt số chính thức Bavaria).

**Mặt dựng theo ảnh có camera** (mẫu: Palas mặt sân, 21/11/2026): đổi điểm ảnh ra mét bằng TIA camera cắt mặt đứng (`mattien.js diemTheoTia` / `caoTheoTia`, mặt đứng qua hai mốc mặt bằng),
không thước px/m tuyến tính (ảnh chụp ngửa → sai dần theo độ cao). Đường viền nhìn thấy (mép đầu hồi, mép tháp) đo HAI điểm ảnh mỗi mép ghi vào tệp bố cục (vd `tiLe.hoiMep`)
→ tia → đường thẳng trên mặt đứng; không lấy chân tam giác từ đầu mút tường OSM (đầu mút = tâm tháp, mép thật dốc hơn: viền cao 8–13 px ở 3 ảnh). Bề ngang bố cục mặt (tháp tới tháp)
và chân mép đầu hồi là HAI trường riêng (`hoi.sA/sB` · `hoi.mA/mB`).

## 5. Không lùi

**Sau MỌI lần sửa mã castle:** `node apps/castle/scripts/kiem-chu-thich.mjs` (chú thích `//` nuốt mã — `node --check` không bắt được khi phần bị nuốt vẫn đúng cú pháp; tự kiểm `--tu-kiem`). Khi sửa bằng thay chuỗi: chú thích mới đặt trên DÒNG RIÊNG, không nối vào cuối đoạn thay.

Sau mỗi nhịp: cầu thang / nội thất, leo + cửa sổ trèo vào, điều khiển điện thoại (bài thử trong phiên), đo tải điện thoại (tam giác, lệnh vẽ). Ghi mã băm box3 = iMac sau deploy.
