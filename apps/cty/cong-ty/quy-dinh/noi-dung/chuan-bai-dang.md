<!-- CHUẨN CHẤM BÀI ĐĂNG SOCIAL của Phòng Nội dung (anh 18/10/2026: "các bài đăng, nội dung đều rất lười thêm ảnh minh hoạ từ pexels… nhìn rất chán.
     Phải cho vào luật. Thêm bộ chấm điểm để bài nào, nội dung nào đăng lên cũng phải hấp dẫn được người đọc").
     worker/cham-dang.mjs đọc tệp này làm thước chấm cho mọi bài máy đăng (video ngắn, bài ảnh X/FB, câu đố, bài link, chuỗi chữ).
     Bài site / trang công cụ / quiz chấm theo chuan-duyet-bai.md (worker/kiem-bai.mjs). -->

# Chuẩn chấm bài đăng social

Người lướt feed cho mỗi bài khoảng một giây. Bài phải làm họ **dừng tay** trong giây đó, **hiểu ngay** đây là gì, và **có lý do bấm** sang trang.
Ba thứ đó là thước chấm. Bài đúng mà không ai dừng lại thì vẫn là bài hỏng.

## 1 · Ảnh thật (chặn cứng)

- Mọi bài có hình (video, ảnh, thẻ câu đố, ảnh xem trước của bài link) phải có **ảnh chụp thật, đúng chủ đề** từ Pexels / Pixabay / Unsplash:
  sảnh khách sạn, quầy lễ tân, tay cầm điện thoại đọc tin, va li ở sân bay, đường phố của đúng nước đang nói…
- Ảnh phải **nhìn rõ**: người xem nhận ra ảnh chụp gì mà không cần nheo mắt. Lớp phủ màu chỉ đủ để chữ đọc được, không phủ tối tới mất ảnh.
- **Chặn cứng:** chữ trên nền màu phẳng / gradient / hoạ tiết vẽ; ảnh phủ tối gần như đen; ảnh không liên quan chủ đề (ảnh bãi biển cho bài lừa đảo tin nhắn).
- Ảnh đổi theo bài: cùng một ảnh nền cho mọi bài của một kênh trông như bài lặp, feed nhìn chán.

## 2 · Dừng tay (giây đầu)

- **Câu móc** ở dòng đầu chữ đăng và ở chữ to nhất trên hình: một tình huống, một câu hỏi, một con số cụ thể, không phải tên kênh.
  Tốt: "This WhatsApp from your hotel wants your card. Real or scam?" · Hỏng: "Hotel Scam Alerts · Episode 12".
- Chữ trên hình đọc được ở cỡ ảnh thu nhỏ trong feed (điện thoại): tối đa ~12 chữ cho dòng lớn, tương phản rõ.
- Có **một điểm nhìn** (khuôn mặt, bàn tay, màn điện thoại, dấu khoanh đỏ), không dàn đều mọi thứ.

## 3 · Hiểu ngay và có giá trị

- Xem xong bài (không cần bấm) người xem học được một điều dùng được: một dấu hiệu, một bước, một mẹo.
- Không độn: mỗi dòng chữ đăng mang thông tin. Không lặp tiêu đề hai lần.

## 4 · Lý do bấm

- Câu dẫn sang trang nói **họ được gì** ở đó ("Take the 10-question quiz", "Paste your own message to check it"), không chỉ "Link in bio" / "Learn more".
- Link gắn UTM theo kênh và dạng bài (máy gắn; thiếu là chặn cứng).

## 5 · Giọng văn (chặn cứng như bài site)

- Không gạch ngang dài (— –), không từ máy (delve, leverage, crucial, seamless, unlock…), không mở dạo đầu.
- Tiếng Anh tự nhiên, có viết tắt, câu ngắn. Không bịa số liệu, lời chứng thực, tên người thật.
- Hashtag tối đa 3, đúng chủ đề.

## 6 · Đa dạng — đăng nhiều nhưng không spam (anh 18/10/2026: "rule này là quan trọng")

- **Chặn cứng:** tiêu đề trùng với bài khác của cùng máy / kênh. Mỗi bài một tiêu đề, một câu móc riêng (trích chính nội dung của bài, không lộ đáp án).
- Máy đăng tự giữ nhịp (puzzle-books scripts/nhip-an-toan.mjs): trần mỗi nền mỗi ngày tăng theo tuổi kênh, cách nhau ≥ 3 giờ trên một tài khoản, không cùng một chuyện lên hai nền của cùng tài khoản trong một ngày, tài khoản có cảnh báo rủi ro 7 ngày thì dừng.

- Không đăng hai bài cùng dạng, cùng khung hình liền nhau trên một kênh. Máy đăng xoay dạng bài theo lịch; phòng chấm thêm điểm trừ khi một dạng lặp quá 2 lần liên tiếp.

## Thang điểm và kết luận

- Điểm 0–10, chấm theo 6 phần trên. **DUYỆT từ 7/10** và không có chặn cứng. Còn chặn cứng thì trần 6/10.
- **SỬA LẠI:** khung đúng nhưng thiếu ảnh thật / câu móc yếu / lý do bấm mờ. Máy đăng bỏ qua bài đó, xưởng (studio) sửa mẫu rồi xuất lại.
- **KHÔNG DUYỆT:** bài không làm ai dừng lại hoặc sai chủ đề.
- Lỗi lặp ở cùng một mẫu (template) thì sửa ở **mẫu**, không sửa từng bài: một lần sửa mẫu là cả loạt bài đạt.
