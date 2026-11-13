# Chuẩn câu lệnh keyframe ↔ khung 3D

Anh ra chuẩn 13/11/2026 sau phim #3071 tập #3074: 131 lượt sinh ảnh cho 20 shot mà keyframe vẫn lệch khung 3D.
Khung 3D đúng. Cái sai là **câu lệnh gửi model tự mâu thuẫn**, và mỗi lần ảnh lệch lại được vá bằng một câu mới.

## Luật

1. **Ảnh lệch khung 3D → đọc NGUYÊN VĂN câu lệnh của chính lượt đó trước** (`xv_job.request->>'prompt'`), rồi mới làm gì khác.
   Cấm sinh lại, cấm chỉnh máy, cấm thêm câu khi chưa đọc.
2. **Một nguồn sự thật cho "có gì trong khung": danh sách khối 3D** (`bo-set-3d.ts › moTaThay`).
   Món nào câu lệnh bắt vẽ thì phải có tên trong danh sách đó, kể cả đồ nhỏ đang cầm (tham số `them`).
   Vật đã khai ngoài khung thì không khối nào khác được gọi tên nó.
3. **Câu khuôn dùng chung không gọi tên đồ đạc của một bộ set** (bàn, kệ, màn hình…). Chữ phụ thuộc bộ set phải đi từ dữ liệu bộ set.
4. **Phong cách phim chỉ nói chất ảnh, nét, tông màu, ánh sáng** – không gọi tên đồ vật / địa điểm. Vế nào nhắc vật ngoài khung thì máy tự bỏ (`prompt-khoi.ts › boVeNhac`).
5. **Cấm vá theo từng shot**: không thêm câu "siết" riêng, không chỉnh máy quay riêng để né một ảnh xấu. Lỗi lặp ở từ 2 shot = lỗi của hàm dựng câu → sửa hàm + thêm luật vào bộ soát.
6. **Một shot sinh quá 3 lượt chưa đạt → dừng sinh**, quay lại luật 1. Sinh thêm không phải cách sửa.
7. **Bộ chấm ảnh chỉ được tin sau khi kiểm trên ảnh đã gắn nhãn tốt / xấu.** Chỉnh ngưỡng trên chính lô ảnh đang chấm thì con số "x/20 đạt" không có nghĩa.
8. **Model ảnh**: lượt có ảnh tham chiếu không đi qua bản Pro (tự vẽ lại bố cục) – `cong-ai.ts › laBanProBoBoCuc`.

## Máy gác

| Lớp lỗi | Chỗ sửa gốc | Luật chặn (kiem-prompt.ts, mức chặn sinh) |
|---|---|---|
| Món bị bắt vẽ nhưng không có trong danh sách khối | `moTaThay(…, them)` | `ngoai_ds` |
| Khối phong cách / cảm xúc / bối cảnh nhắc vật ngoài khung | `tuRieng` + `boVeNhac` | `nhac_ngoai` |
| Khuôn "mặt bàn" đi vào phim không có bàn | `sinh-anh.ts › gocMayChu(…, mat)` | test `sinh-anh.test.mts` |
| Khuôn liệt kê đồ văn phòng | `moTaThay` | test `bo-set-3d.test.mts` |

Cổng `lyChanKeyframe` chặn trước khi tốn tiền; xem điểm + lỗi từng shot 0₫: `scripts/sinh-anh-phim.mts --xem-prompt`.

## Đường sinh

- Mặc định một bước: Nano sửa từ khung màu 3D (ảnh 1).
- Shot vẫn lệch sau khi câu lệnh sạch: bật đường hai bước có sẵn (`kinh_thanh.keyframe_hai_buoc`, bước 1 FLUX theo bản đồ độ sâu 3D). Không dựng đường mới.
