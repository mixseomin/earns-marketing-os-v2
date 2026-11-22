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
3. Thử 1 km² Shinjuku: nhà PLATEAU + đường OSM, khoác phong cách Red Spires, đi bộ + bay được.
4. Thêm khu Phố Bụi, chuyển khu liền mạch.
5. Mở rộng lên 30 × 30 km: mức chi tiết theo khoảng cách, đo khung hình/giây trên máy tính và điện thoại.
6. Người dân có lịch sống (sáng đi làm, trưa ra chợ, tối về nhà).
7. Chuyện + nhiệm vụ cho 20 địa điểm thử — tốn tiền AI, chỉ chạy khi anh bảo, báo giá thật trong lượt đó.
8. Mở rộng chuyện + nhiệm vụ ra toàn thành phố (cũng hỏi tiền trước).
