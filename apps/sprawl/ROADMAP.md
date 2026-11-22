# Sprawl — thành phố 3D đi bộ/bay được, dựng trên bản đồ thật Tokyo

Địa chỉ: **sprawl.on.tc** (box3 167.233.241.16, đăng nhập SSO mos2). Mã: `apps/sprawl` trong repo earns-marketing-os-v2.
Sổ theo dõi: mos2 › Plays › Tiến độ, dự án `mos2`, nhóm `Sprawl` (`~/bin/tiendo list mos2/Sprawl`).
Chốt 22/11/2026: gốc bản đồ = **Tokyo**.

## Nguồn dữ liệu (giấy phép mở)
- PLATEAU (Bộ Đất đai Nhật): nhà 3D LoD2 của 23 quận Tokyo, CC BY 4.0, ghi nguồn.
- OpenStreetMap: đường, sông, công viên, địa điểm (quán, chợ, ga), ODbL, ghi nguồn.

## Ý tưởng
- Bố cục thật (đường, khối phố, mặt bằng, chiều cao) + phong cách riêng: tháp đỏ kiểu Red Spires, khu Phố Bụi (phobui.on.tc) cam bụi neon.
- Quy mô đích: vùng ~30 × 30 km, khoảng 3 giờ chạy bộ từ đầu tới cuối, tải dần theo ô.
- Người dân có lịch sống; câu chuyện + nhiệm vụ do AI viết theo từng địa điểm thật.

## Các bước
1. Tra repo / thư viện có sẵn (đọc 3D Tiles / CityGML PLATEAU, tải ô theo vị trí, đi lại ngôi thứ ba trên three.js) → bảng cho anh chọn dùng / học / tự viết.
2. Dựng sprawl.on.tc + bộ máy chung: gộp Phố Bụi (đưa `apps/phobui` từ box vào repo) và bộ đi lại của city.on.tc (`apps/castle`), ô tải dần.
2b. **Quy hoạch chung Red Spires (anh chen 22/11/2026, làm trước bước 3)** — máy `apps/sprawl/scripts/quy-hoach.mjs` lấy OSM thật 3 × 3 km quanh Nishi-Shinjuku, chia khu theo ảnh mẫu: tháp đỏ nón chóp vòm (nhà thật ≥ 90 m, cao ×1,35), đại lộ đi bộ lát đá sáng (đường lớn), phố thấp xanh xám + vườn mái, tuyến tàu, làn xe bay 140–220 m, vành khối khổng lồ mờ xa. Ra `public/du-lieu/quy-hoach.json` + bản vẽ `quy-hoach.svg`. Ban ngày sương xanh xám, KHÔNG phải đêm neon.
2c. **Luật khớp (anh 22/11/2026: "công trình, điểm nối không khớp tỷ lệ… chắp vá không được")** — một lõi luật chung `public/khop.js` mà mọi máy sinh (quy-hoach.mjs, redspires.js, song.js, nhat2200.js) đều đi qua: thước chung (tầng 4 m, làn, vỉa hè, lan can, cao tốc 46 m + dốc ≤ 7 %), lưới tuyến đo khoảng cách tới mép đường, đặt tháp ngoài mép đường + vỉa hè, không chồng nhau, chân tháp hạ về lưới tầng chung, cao tốc giao nhau khác cao độ, cột không đâm mặt tuyến dưới, làn bay trên mặt cao tốc / đỉnh tháp. Bộ kiểm `kiem()` đếm lỗi từng luật, hiện ở `tk.khop` + console; `scripts/kiem-khop.mjs` kiểm quy hoạch (thoát 1 khi có lỗi). Số: tháp đỏ 64 → 0 lỗi; Nhật 2200 bản tắt luật 88–237 lỗi (7/7 cao tốc dốc quá, đĩa bay cắt mặt cao tốc) → 0.
2d. **Nâng hình ảnh (anh 22/11/2026: "hình ảnh sắc nét chân thật đủ vibe")** — ba nhịp. Nhịp 1 (xong): bầu trời thật thay nền màu phẳng (addon Sky của three, giảm sáng riêng bằng `uDoSang`), nắng đặt đúng hướng mặt trời của bầu trời, môi trường phản chiếu dựng từ chính bầu trời đó (PMREM → `scene.environment`), sương + nền lấy màu đo từ chân trời; kính tháp Nhật 2200 là mặt gương soi trời (`vat.envMap`, `envMapIntensity` riêng). Thông số từng kiểu ở `KIEU.*.bauTroi` trong `public/sprawl.js`; Phố Bụi giữ nền phẳng. Nhịp 2: mặt đất và mặt đường. Nhịp 3: nhà và cây.
3. Thử 1 km² Shinjuku: nhà PLATEAU + đường OSM, khoác phong cách Red Spires, đi bộ + bay được.
3b. **Nhìn từ trong toà nhà ra (anh thêm 22/11/2026)** — chế độ "đứng trong nhà": bấm vào bất kỳ toà nào (tháp đỏ hoặc nhà PLATEAU), chọn tầng + mặt, camera đặt sát sau ô kính nhìn ra ngoài. Trong phòng dựng tối giản (khung cửa, bậu, kính phản chiếu nhẹ, sàn + trần theo cao tầng thật), ngoài cửa là thành phố thật đúng độ cao đó. Lưu được thành góc quay (link `&goc=`) như các góc 4K đã có.
4. Thêm khu Phố Bụi, chuyển khu liền mạch.
5. Mở rộng lên 30 × 30 km: mức chi tiết theo khoảng cách, đo khung hình/giây trên máy tính và điện thoại.
6. Người dân có lịch sống (sáng đi làm, trưa ra chợ, tối về nhà).
7. Chuyện + nhiệm vụ cho 20 địa điểm thử — tốn tiền AI, chỉ chạy khi anh bảo, báo giá thật trong lượt đó.
8. Mở rộng chuyện + nhiệm vụ ra toàn thành phố (cũng hỏi tiền trước).

## Bước 1 — kết quả tra (22/11/2026)
| Việc | Repo / nguồn | Sao · giấy phép · cập nhật | Quyết |
|---|---|---|---|
| Nạp nhà 3D theo ô, tự giảm chi tiết theo khoảng cách | NASA-AMMOS/3DTilesRendererJS | 2.545 · Apache-2.0 · 11/2026 | **DÙNG** (đọc thẳng 3D Tiles PLATEAU trên three.js) |
| Dữ liệu nhà Tokyo | PLATEAU datacatalog `api.plateauview.mlit.go.jp/datacatalog/plateau-datasets` | CC BY 4.0 · bản 2025 | **DÙNG**: Shinjuku LoD2 có texture + bản không texture, tileset.json trả 200 |
| Đổi CityGML sang glTF/3D Tiles khi cần tự cắt | Project-PLATEAU/PLATEAU-GIS-Converter | 77 · MIT · 02/2026 | dự phòng (khi muốn tự nướng ô) |
| Đi lại nhân vật ngôi thứ ba | pmndrs/ecctrl | 821 · MIT · 09/2026 | HỌC cách làm (nó dựa React Three Fiber; bộ máy mình three.js thuần) |
| Sketchbook (đi, leo, xe) | swift502/Sketchbook | 1.753 · MIT · **đã lưu trữ 2024** | chỉ học, không dùng |
| Người dân tìm đường | donmccurdy/three-pathfinding · isaac-mason/recast-navigation-js | 1.380 MIT · 443 MIT, đều 10/2026 | **DÙNG** recast-navigation-js cho bước 6 |
| Cesium | CesiumGS/cesium | 15.975 · Apache-2.0 | không dùng (bản đồ địa cầu, nặng, khó khoác phong cách game) |
| OSMBuildings / procedural-gl | — | không bảo trì từ 2021 | bỏ |

Bộ máy: three.js thuần + 3DTilesRendererJS, nhà PLATEAU khoác shader phong cách riêng; đường/địa điểm từ OSM.
