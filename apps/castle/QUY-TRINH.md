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

### 3b. Kiểm kê theo VÙNG (chi tiết đếm được → hoa văn)

Mỗi ảnh mặt tiền chia thành **vùng** trước khi dựng: `dinh` (răng cưa, tháp canh, đầu hồi) · `than_tren` · `than_duoi` · `chan` (hoặc `toan` cho tháp tròn), theo độ cao tuyệt đối toạ độ cảnh.
Trong từng vùng quét theo thứ tự cố định:
1. **Thành phần đếm được**: cửa sổ (`cua_so`), cổng (`cong_vom`, `canh_cua`), ô cửa vuông (`o_vuong`), cửa mái (`cua_mai`), chóp, tháp canh, răng cưa (`rang_cua`), đầu hồi bậc (`hoi_bac`).
2. **Hoa văn / hoạ tiết**: huy hiệu, gờ ngang (`go_ngang`), dải vòm nhỏ (`vom_nho`), đá góc (`da_goc`), neo sắt (`neo`), vành răng cưa tháp (`vong_rang`).

Ghi số đếm vào `public/du-lieu/<tên>-kiem-ke.json` (mỗi mặt: nhóm cạnh OSM `khối#cạnh`, ảnh nguồn, vùng `tu`–`den`, `dem` theo loại). Chi tiết dựng bằng `trangtri.js`
(thẻ trong `<tên>-sua.json`: `rang_cua`, `vom_nho`, `da_goc`, `thap_canh`, `vong_rang`, `cua_thap`, `go_y`, `neo_y`; số đếm từng mặt trong `<tên>-cua-so.json`: `rang_cua`, `vom_nho`, `o_vuong`).
Mọi chi tiết mô hình tự ghi sổ (`window.__ns.kiemKe()`); `node scripts/kiem-ke.mjs --lau <tên>` so từng vùng → THIẾU / thừa / khớp, thoát 1 khi còn THIẾU.
Một mặt chỉ coi là xong khi kiểm kê khớp hết **và** chụp đúng chỗ đặt máy ảnh đặt cạnh ảnh thật không còn chi tiết khoanh được là thiếu.

## 4. Kiểm toàn cảnh

9. `node scripts/chup-so-anh.mjs <thư mục> --lau <tên>` rồi `python3 scripts/kiem-vien.py <thư mục>` → đoạn THIẾU / THỪA của viền trời, % cột khớp, `thieu.json`.
10. `node scripts/them-chop.mjs <thư mục> --lau <tên>` → chóp / tháp nhỏ OSM không có (`<tên>-chop.json`; chỉ giữ chóp thấy trên ≥ 2 ảnh hoặc nối khối OSM).
11. Lặp 1–10 tới khi: kiểm cụm cửa đạt hết, kiểm viền ≥ 80 % cột khớp, chồng ảnh 50 % không lệch thấy được.

## 5. Không lùi

Sau mỗi nhịp: cầu thang / nội thất, leo + cửa sổ trèo vào, điều khiển điện thoại (bài thử trong phiên), đo tải điện thoại (tam giác, lệnh vẽ). Ghi mã băm box3 = iMac sau deploy.
