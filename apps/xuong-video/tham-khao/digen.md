# Học từ Digen (agent.digen.ai) — ghi một lần, không cần vào lại

Xem ngày 18/10/2026 bằng trình duyệt cục bộ, không đăng nhập. Trang tới từ một quảng cáo Meta (chiến dịch lấy lead).
Phần công khai: trang chủ agent, danh mục skill, bảng xếp hạng người làm skill. Chi tiết bên trong từng skill phải đăng nhập, nên không xem được.

## Digen là gì

- **Agent chat kèm chợ "Open Skills".** Người dùng gõ một câu mô tả ý tưởng, rồi gõ `/` để chọn skill ("Describe your idea. Type / to pick a Skill.").
- **Quy mô:** 8.864 skill do người dùng khắp nơi tạo ("8,863 open skills, built by creators worldwide").
- **Menu bên trái:** New · Open Skill · Connectors · Search · Library · Creator Center.
- **Lối tắt trên ô nhập:** Movie · Drama · YouTuber · Music · Create Skill · MiniSora · Image Bot.
- **Skill chính thức (@official):**

  | Skill | Lượt dùng |
  |---|---|
  | Digen Drama Studio | 27K |
  | Clip Studio | 971 |
  | Image Bot | 24K |
  | Candy Series | 19K |
  | K-POP Idol | 239 |
  | FLUX 3 Image Klein | 279 |

  Còn có Movie Maker và MiniSora (con không đọc được số lượt dùng).
- **Skill cộng đồng nổi bật:** China Drama Studio, One Minute Drama (Live-Action Series Creator), AI Mini Movie Director, Trailer Maker, MAKE A WEB SERIES, Kids Story Video Maker, DanceFlow, Video Editor, Photoreal Character Sheet.
  Phần lớn skill phổ biến là filter gợi cảm và clip để câu tương tác (bikini, sleepwear, body morph…).
- **Xếp hạng người làm skill (theo ngày và toàn cầu):** đo bằng số token đã chạy, lượt dùng, lượt yêu thích, lượt cài. Người đứng đầu: 347M token, 26K lượt dùng.
- **Kéo người dùng:** mời bạn được 300 credit mỗi người; báo qua trình duyệt khi việc chạy xong ("Turn on browser notifications when tasks finish").
- **Lọc danh mục:** Featured · Popular · Recent, và khoảng 40 nhóm loại video. Danh sách nhóm nằm ở `src/lib/xuong-video/goi-the-loai.ts › DIGEN_NHOM`.

## Học được gì → studio đã làm gì (18/10/2026)

| Bài học | Studio đã làm | Ở đâu |
|---|---|---|
| Đóng gói theo định dạng ("skill" mỗi loại video) | **Gói thể loại:** 39 gói. Mỗi gói gồm khung beat, khuôn chuỗi, quy chuẩn dòng phim, cung khán giả, luật nhấn, độ dài, khung hình, tham chiếu | `goi-the-loai.ts`; Thư viện › Định dạng › 📦; Kinh thánh phim › Gói thể loại |
| Phủ đủ loại video ngành đang làm | Mọi nhóm làm video của Digen đều có gói; bài tự kiểm báo đỏ nếu sót | `goi-the-loai.test.mts` (DIGEN_NHOM) |
| Khung riêng cho từng định dạng | Thêm khung beat: series hoạt hình gag, trailer, tài liệu, MV, video YouTuber, tin tức, explainer, bài học. Thêm quy chuẩn dòng phim: hài, tình cảm, phiêu lưu, tài liệu, hành động, viễn tưởng | `dien-anh.ts › CAU_TRUC`, `khuon-chuoi.ts › QUY_CHUAN_DONG` |
| Agent hỏi về cảm xúc và nhịp trước khi làm | Ý đồ khán giả (11 hiệu ứng) vào kế hoạch shot, prompt video và nhạc nền | `khan-gia.ts` |

## Bài học chưa làm (chờ anh quyết)

1. **Vào việc bằng một câu.** Mô tả ý tưởng → chọn gói → máy dựng sẵn Kinh thánh và tách cảnh. Studio hiện phải qua nhiều bước mới tới tách cảnh.
2. **Đo theo từng gói.** Không đo lượt dùng như Digen, mà đo thứ có ích cho sản xuất: tiền trên một phút phim xong, tỉ lệ shot qua cổng ngay lần đầu, số lần sinh lại.
3. **Báo khi việc nền chạy xong** (sinh ảnh, video, dựng 3D) bằng thông báo trình duyệt.

## Không chép

Chợ skill cộng đồng, thưởng mời bạn, filter câu tương tác, xếp hạng theo số token.
Thế mạnh riêng của studio là phần Digen không cho thấy: luật ngành có nguồn, cổng máy, bản 3D dựng trước, ý đồ khán giả, chấm dẫn dắt, liền mạch.

## Nguồn

- Trang Digen: https://agent.digen.ai/en
- Bài giới thiệu của chính Digen (tiếng Pháp; số liệu không có nguồn kiểm chứng): https://resource.digen.ai/digen-ai-agent-generateur-videos-2026/
