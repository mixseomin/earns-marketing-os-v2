# Previs low-poly → Seedance (reel Thanh Nguyen, FB 02/11/2026)

Nguồn: https://www.facebook.com/share/r/1JMQNGXX19/ (65K view, 30s, dọc: nửa trên bản cuối, nửa dưới previs). Tệp tải: `ma-nguon/fb-1JMQNGXX19/` (reel.mp4, tờ khung 1s).

Cách họ làm:
1. Chat Claude/ChatGPT bản free: "low poly không màu, chỉ mô phỏng chuyển động, ngỗng gặp bão, máy bay lao tới, 30s" → video previs xám; sửa bằng chat tới khi đúng động tác + góc máy.
2. Chụp một khung previs → nhờ AI viết prompt dựng lại bối cảnh theo chất liệu hoạt hình (ảnh nền).
3. Bộ ảnh nhân vật nhiều góc (turnaround) làm tham chiếu.
4. Seedance 2.5 (OpenArt), đầu vào: video previs + ảnh bối cảnh + bộ góc nhân vật, 480p.

Kết quả: máy quay bay theo, vị trí chủ thể giữ đúng suốt clip, nhịp hành động đúng previs. Yếu: chất liệu còn ám khối low-poly (họ tự nhận), mây nền đôi khi đổi tông.

So với studio:
- Đường "video dựng thô làm khuôn chuyển động" đã có từ 23/10 (`src/lib/xuong-video/fal.ts`, nhánh `video_urls + image_urls`), nhưng chỉ nhận MỘT ảnh (`image_urls = [anhDau]`) — chưa có bộ góc nhân vật.
- Phim #1156 đi đường khung đầu → cuối (VideoExpress) giữa các mốc, nên mô hình tự bịa giữa hai mốc. Clip giấy cắt `giay-cat/ra/<gag>.mp4` chính là previs đã đúng màu, đủ nhịp — đưa nguyên clip vào đường tham chiếu chuyển động thì mỗi khung có khuôn, và không ám xám như previs low-poly của họ.
- Dạng nội dung: video chia đôi previs | bản cuối là một dạng bài đăng (hậu trường) kéo view tốt.
