# So sánh mô hình VIDEO BÁM CLIP 3D (khung đầu + clip chuyển động + prompt)

Mở 14/11/2026 (phim #3071 "Hai chai nước ngọt ở sân ga", tập #3074). Anh: "Thử đi. Nhớ rõ các phương án để còn so sánh".
Mục đích: clip AI đi đúng máy quay / chỗ đứng / nhịp của clip three.js (`khung_xam.clip`), nét vẽ và người lấy từ keyframe đã duyệt.
Luật thử: mỗi phương án MỘT shot (shot #1 trước), soát rồi báo anh, anh gật mới chạy thêm.

## Vì sao không dùng VideoExpress cho việc này

Đo 14/11/2026 trên tập #3074: VideoExpress (image→video, không nhận clip chuyển động) tự bịa hành động — chú bước xuống tàu, máy lia, nhân đôi người nói
(6/6 lượt shot có thoại, kể cả clip câm). 40 clip đã xoá theo lệnh anh.

## Danh sách phương án — giá đọc trên TRANG mô hình fal (bảng giá máy đọc, modelFal), 14/11/2026

ĐỪNG lấy `unit_price` của API giá fal làm giá clip: API báo Luma $0,03/"giây" nhưng trang ghi $0,72/clip 5 s 540p (lệch ~5 lần). Giá thật = bảng trên trang.

Nhận ĐỦ khung đầu + clip chuyển động + prompt:

| Mô hình | Trường ảnh | Trường clip | Giá trang fal | Clip 5 s ≈ |
|---|---|---|---|---|
| fal `fal-ai/ltx-2.3-22b/distilled/reference-video-to-video` | `image_url` (khung đầu), `end_image_url` | `video_url` | $0,001/khung | ~$0,13 (3.400₫) |
| fal `fal-ai/ltx-2.3-22b/reference-video-to-video` | như trên | `video_url` | $0,002/khung | ~$0,25 |
| fal `fal-ai/wan-vace-14b` | `first_frame_url`, `last_frame_url` | `video_url` (độ sâu / khung xương) | 480p $0,04/s · 720p $0,08/s | $0,20 – 0,40 |
| fal `kling/v4/flash/reference-to-video` | `start_image_url`, `image_urls` | `video_urls` | $0,063 – 0,094/s | $0,32 – 0,47 |
| fal `kling/v4/reference-to-video` | khung đầu + giữa + cuối | `video_urls` | 720p $0,094 – 0,16/s | $0,47 – 0,80 |
| fal `luma/agent/ray/v3.2/video-to-video` | `start_image_url` hoặc `keyframes` + `keyframe_indexes` | `video_url` | 540p $0,72/clip 5 s | $0,72 (18.700₫) |
| fal `moonvalley/marey/motion-transfer` | `first_frame_image_url` | `video_url` | $2/clip | $2 |

Nhận ảnh THAM CHIẾU (không phải khung đầu) + clip:

| Mô hình | Giá trang fal |
|---|---|
| fal `alibaba/wan-3.0/reference-to-video` | 480p $0,05/s · 720p $0,10/s |
| fal `minimax/h3-max/3d-to-video` (làm ẢNH THẬT, dễ mất nét anime) | 480p $0,05/s · 768p $0,08/s |
| fal `wan/v2.6/reference-to-video/flash` | 720p $0,10/s |
| fal `fal-ai/kling-video/o3/standard/video-to-video/reference` | $0,13/s |
| fal `bytedance/seedance-2.0/fast/reference-to-video` | 720p $0,15 – 0,24/s |
| dola.com Seedance 2.0 Fast (giao diện, nhận .mp4 tham chiếu, lái trình duyệt) | gói tài khoản |

Không hợp (chuyển dáng MỘT người, không chuyển máy / bối cảnh): Kling Motion Control, DreamActor v2.

Cổng khác (giá "from" trên trang, chưa kiểm đơn vị / đường gửi clip): Kie.ai Seedance 2.0 $0,057 · Seedance 2.0 Fast $0,034 · Kling 3.0 Omni $0,0755 ·
Kling 3.0 Motion Control $0,1135; APIMaster Kling V4 Flash $0,094 · Kling V3 Omni $0,084.

## Nhật ký thử (mỗi dòng một lượt — điền kết quả sau khi soát)

| Ngày | Phương án | Shot | Tham số | Giá thật | Kết quả |
|---|---|---|---|---|---|
| 14/11/2026 | Luma Ray 3.2 v2v | #1 (id 9216) | keyframe ghim khung `vao×24`, edit_strength flex_2, 540p, 5s | — | KHÔNG CHẠY: cổng tiền chặn (giá thật $0,72 > ngưỡng tự chạy) — chờ anh duyệt |
| 14/11/2026 | LTX 2.3 distilled ref v2v | #1 (id 9216) · job 8293 | keyframe = image_url, video_strength 0,8, không tiếng, dài theo clip (4 s, 1376×768) | sổ ước 17,5¢; tính theo khung ~11¢ (~2.900₫) | ĐẠT bố cục: máy, tàu, cột, ki-ốt, chỗ đứng 2 người bám đúng clip 3D cả 4 s; không bịa hành động; nét anime giữ. CHƯA ĐẠT người: nhóc mặc sai đồ (áo xanh trắng thay áo be + quần kaki), mặt nhỏ mờ; áo chú thêm viền vàng. Khung lệch nhẹ so với keyframe (theo khung 3D). Clip: https://img.on.tc/xuong-video/clip/9216-c47835ba-64ba-4d2b-b69c-327c6511fff4.mp4 |
| 14/11/2026 | LTX 2.3 distilled ref v2v | #1 (id 9216) · job 8295 | như trên, video_strength 0,6 (XV_LTX_BAM) | ~11¢ (~2.900₫) | Bố cục vẫn đúng 3D. Đồ nhóc gần đúng hơn (áo be, quần tối) nhưng mặt chú xấu / méo hơn, nhóc quay lưng thay vì nhìn chú, cử chỉ giơ tay cuối shot mất. Kết luận: hạ bám nguồn đổi đồ đúng hơn nhưng mất diễn — người nhỏ trong khung toàn cảnh là chỗ LTX yếu. Clip: https://img.on.tc/xuong-video/clip/9216-518c4cf0-47f4-48f9-9c96-652aeb075034.mp4 |
