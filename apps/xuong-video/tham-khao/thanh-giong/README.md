# Thánh Gióng (Little Gióng) — mổ phim mẫu Seedance 2.5 (30/10/2026)

Nguồn: https://youtu.be/uo6ipB8wz2M (kênh Nghề Công Sở, 29/10/2026, bài hướng dẫn 11:48). Phim mẫu nằm ở 8:51–10:58: 2 phút, 100 % hình Seedance 2.5 (nền AKOOL), ảnh nhân vật Seedream 5.0, nhạc Suno v6, kịch bản Claude Opus 5.5.
Tờ khung: `to-khung-1..3.jpg` (khung đầu + cuối mỗi shot, mốc giây tính từ đầu phim) · `cu-chuyen.jpg` (5 chỗ chuyển, 0,15 s/khung).

## Số đo
- 40 shot / 120 s → **trung bình 3,0 s/shot**, dài nhất 6 s (mở đầu), ngắn nhất 0,5–0,9 s (đoạn cao trào 58–70 s).
- **100 % cắt thẳng.** Không một cú hoà hình / wipe nào — cảm giác "mượt" đến từ chỗ hai shot KHỚP nhau, không từ hiệu ứng chuyển.
- Lời rất ít: một dòng phụ đề dẫn truyện mở đầu, một câu thoại của mẹ ở kết. Truyện kể bằng hình + nhạc 4 đoạn.

## Cấu trúc: hai thế giới chạy song song
| Giây | Đoạn | Thế giới |
|---|---|---|
| 0–19 | Mở bằng truyền thuyết: vó ngựa sắt, quân giặc, Gióng cưỡi ngựa phun lửa, cận mặt Gióng đội mũ | Truyền thuyết |
| 19–35 | **Cắt khớp mặt**: mặt Gióng → mặt cậu bé, cùng cỡ, cùng ánh mắt. Bé chơi "làm Gióng" với ngựa lá chuối trên sân phơi lúa | Đời thật |
| 35–49 | Đe doạ: mây bão hình ngựa khổng lồ, mẹ ngoài đồng thấy mưa tới | Xen kẽ |
| 49–74 | Bé chống bão = Gióng đánh giặc, mỗi hành động của bé cắt sang hành động tương ứng của Gióng | Xen kẽ dày |
| 74–95 | Bé nằm dang tay đè tấm bạt giữ lúa dưới mưa; mẹ chạy về, nhìn, cười, cùng giữ | Đời thật |
| 95–108 | Bữa cơm bên bếp lửa: bé ăn như Gióng ("Eating like Saint Gióng, are we?") | Đời thật |
| 108–121 | Hoàng hôn sau mưa, lúa còn nguyên; vũng nước phản chiếu bóng Gióng bay lên trời → tựa phim | Hai thế giới gặp nhau |

## Kỹ thuật làm nên cảm giác "mượt và logic"
1. **Cắt khớp theo HÀNH ĐỘNG + HƯỚNG + HÌNH khối giữa hai thế giới** (graphic / action match):
   - bé đẩy cào lúa sang ngang → Gióng quét bụi tre cùng chiều (57,9 s);
   - bé kéo tấm bạt đỏ → Gióng tung áo choàng đỏ → tấm bạt bay phủ đống lúa (69–70 s): ba shot nối bằng cùng một mảng ĐỎ đang chuyển động;
   - mây bão hình ngựa → ngựa sắt → ngựa lá chuối của bé (40–42 s);
   - mặt Gióng → mặt bé (19 s): cùng cỡ, cùng vị trí mắt trong khung.
   Mỗi cú cắt giữ ĐIỂM NHÌN của mắt người xem ở cùng chỗ trong khung (eye trace) nên não không phải tìm lại.
2. **Mỗi thế giới một "vỏ" hình riêng** để người xem không bao giờ lạc: truyền thuyết = khung cinemascope có viền đen trên dưới, tông xanh than + lửa đỏ, máy thấp hùng tráng; đời thật = đầy khung 16:9, nắng vàng tự nhiên, máy ngang tầm trẻ con.
3. **Một đạo cụ làm cầu nối (motif)**: ngựa lá chuối ↔ ngựa sắt; tấm bạt đỏ ↔ áo choàng đỏ; bát cơm ↔ "Gióng ăn bảy nong cơm". Đạo cụ xuất hiện ở đời thật trước, rồi mới "biến hình" sang truyền thuyết.
4. **Nhịp tăng dần đúng chỗ**: shot 4–6 s ở mở đầu và kết; xuống 0,5–2 s ở đoạn xen kẽ cao trào; sau cao trào là khoảng nghỉ dài (bé nằm trên bạt 2,7 s, mặt mẹ 2,7 s).
5. **Kết bằng hình ghép hai thế giới** trong cùng một khung (bóng Gióng trong vũng nước) thay vì nói ra bài học.

## Quy trình họ dùng (theo lời trong video)
- Prompt kịch bản cho Claude đòi sẵn: mở – hình ảnh – tầng nghĩa – điểm nguy – kết, **danh sách match cut giữa truyền thuyết và đời thật**, số nhân vật mỗi shot, lý do của mỗi cảnh, trạng thái nhân vật, nhạc chia 4 đoạn.
- Claude trả bảng shot ~3–4 s/shot + prompt ảnh nhân vật / đạo cụ + nơi xuất hiện của từng nhân vật; rồi "chia thành lượt gen 4–15 s cho Seedance / Kling".
- Khuôn prompt video: tiêu đề · ngoại hình nhân vật · bối cảnh + ánh sáng · máy + âm thanh · phong cách · thứ không muốn có. Đính ảnh tham chiếu nhân vật + bối cảnh vào mỗi lượt.
- Sinh 720p, chọn được thì mới upscale lên Full HD / 4K (tiết kiệm tiền).

## So với studio (30/10/2026)
- Đã có: kỹ thuật `cat_khop` (dien-anh.ts) và `xen_ke` (dien-anh-them.ts), luật `khop_hanh_dong`, `motif`, `eye_trace` (luat-dung.ts), khuôn prompt khối tương tự, ảnh tham chiếu anchor.
- Chưa có: **khuôn truyện hai thế giới** (truyền thuyết / tưởng tượng ↔ đời thật) với danh sách cặp cắt khớp viết ngay từ kịch bản; **vỏ hình theo thế giới** (tỉ lệ khung / tông màu / độ cao máy khác nhau, giữ nhất quán trong mỗi thế giới); kiểm máy rằng mỗi cú cắt chéo thế giới có một điểm khớp (hướng chuyển động, màu chủ đạo, vị trí chủ thể trong khung).
