# Thư viện trang bán (app / phần mềm) — mẫu thật để viết và để Phòng Nội dung chấm

Lập 23/10/2026 (anh: "có thư viện mẫu các trang bán hàng thành công sẽ hiệu quả hơn là mỗi lần thêm một chút"). Mỗi mẫu là một trang
đang chạy của sản phẩm sống bằng tiền người dùng trả. Ảnh trong `anh/`: `<ten>.jpg` = cả trang thu nhỏ (3 cột từ trên xuống),
`<ten>-dau.jpg` = màn đầu 1440×900. Số đo bằng máy (chữ trong trang, ảnh, video). Đo lại: chạy lại bộ đo trong phiên Claude
(curl trang + đếm), thêm mẫu thì thêm một mục theo khuôn dưới.

Số chữ cả 10 mẫu: 643 – 1.750, giữa ~1.050. Trang bán KHÔNG đo theo chuẩn bài SEO 1.200–1.800 chữ.

| Mẫu | Loại | Chữ | Ảnh/Video | Giá trên trang | Bằng chứng trên trang |
|---|---|---|---|---|---|
| cleanshot.com | app Mac, mua một lần + gói đám mây | 1.090 | 80 / 9 | (trang giá riêng) | dải logo công ty dùng, trích lời người dùng |
| raycast.com | app Mac miễn phí + Pro | 1.418 | 99 / 0 (demo động bằng mã) | $4 | dải logo, cửa hàng tiện ích |
| culturedcode.com/things | app trả một lần mỗi nền | 1.003 | 29 / 1 | theo nền + nút dùng thử | Apple Design Award, tường đánh giá báo + người dùng |
| bear.app | app miễn phí + gói năm | 670 | 32 / 4 | $2.99 / $29.99 | 3 huy hiệu giải thưởng |
| typora.io | app bán một lần $14.99 | 1.037 | 35 / 11 | $14.99 + có dùng thử | "loved by our users" + trích lời |
| linear.app | SaaS theo người dùng | 1.664 | 38 / 0 (giao diện thật dựng bằng mã) | (trang giá riêng) | dải logo OpenAI, Vercel… |
| descript.com | SaaS gói tháng | 1.750 | 120 / 1 | (trang giá riêng) | logo, số liệu khách hàng có tên, điểm G2 |
| arc.net | trình duyệt (trang thông báo) | 1.547 | 92 / 0 | — | thư của nhà sáng lập, chữ ký tay đội ngũ |
| speakflow.com | **đối thủ teleprompter**, $15/tháng | 643 | 20 / 1 | (trang giá riêng) | dải logo Logitech, Google, Apple… |
| promptsmart.com | **đối thủ teleprompter** | 943 | 36 / 0 | $20 | "#1 brand", "patented VoiceTrack" |

## Bảy nước đi lặp lại ở trang tốt (dùng làm thước)
1. **Màn đầu cho thấy CHÍNH SẢN PHẨM đang chạy**, to, chiếm nửa màn hoặc hơn: giao diện thật (Linear, Raycast), video (Descript,
   Speakflow chạy chữ ngay trong màn đầu), thiết bị động (Things). Không phải ảnh minh hoạ chung chung.
2. **Tiêu đề 3–8 chữ có quan điểm**: "Your shortcut to everything." · "There are average capture apps. And there's CleanShot." ·
   "Markdown notes you'll love". Dòng phụ một câu nói ai dùng, làm gì.
3. **Một bản sắc hình xuyên suốt** — một màu / một hoạ tiết / một chất liệu lặp lại cả trang (ánh đỏ Raycast, mảng màu hữu cơ Bear,
   chữ ký tay Arc, nền tối ánh lưới Linear). Trang thiếu cái này trông như ghép mẫu.
4. **Tính năng = ô có hình hoặc demo nhỏ đang chạy** (lưới bento CleanShot, thẻ tiện ích Raycast). Không có ô chỉ toàn chữ.
   Mỗi tiêu đề mục là một lợi ích nói bằng lời người dùng ("Always one drag away", "Nail it. Every time.").
5. **Bằng chứng đặt sát nút mua**: logo, giải thưởng, trích lời có tên. Chưa có người dùng thì dùng bằng chứng thật khác (số liệu
   nghiên cứu, lời chê đối thủ trích từ đánh giá công khai) — KHÔNG bịa lời khen.
6. **Một nút chính, lặp lại ở đầu và cuối**, nói rõ được gì ("Download for Mac", "Create my free account"); giá / dùng thử ghi
   ngay dưới nút.
7. **FAQ ngắn (4–8 câu) gập lại, đặt gần cuối**, rồi một dải kêu gọi cuối trang.

## Mổ từng mẫu (đọc khi viết trang cùng loại)
- **cleanshot.com** — tiêu đề so sánh với "average apps"; video ngắn cho từng tính năng; lưới bento nhiều màu, mỗi ô một hành động
  ("Highlight every click", "Hide desktop icons"). Học: mỗi tính năng một clip 3–6 giây.
- **raycast.com** — nền tối, một ánh màu thương hiệu; màn đầu là ảnh giao diện app trên máy; câu "It's not about saving time.
  It's about feeling like you're never wasting it." Học: một câu cảm xúc giữa trang, không chỉ liệt kê.
- **culturedcode.com/things** — biểu tượng app to ở giữa, nút "Watch Introduction Video"; giá theo từng nền đặt cạnh nhau; tường
  đánh giá có tên báo. Học: video giới thiệu ngay dưới tiêu đề, giá rõ từng gói.
- **bear.app** — chuyển Mac / iPhone / iPad ngay dưới tiêu đề; hoạ tiết mảng màu mềm làm nền từng mục; giải thưởng dưới ảnh đầu.
- **typora.io** — tối giản, chữ mảnh; mỗi mục là một ảnh động giao diện; cuối trang "want Typora?" + giá $14.99 + nút tải dùng thử.
- **linear.app** — chữ to trái, giao diện thật phải; mỗi mục một khối giao diện dựng bằng mã (không phải ảnh chụp) → sắc nét mọi màn.
- **descript.com** — màn đầu là trình chỉnh sửa giả lập đang thao tác (chữ bị gạch, hộp AI trả lời); số liệu khách hàng có tên công ty.
- **speakflow.com** (đối thủ) — màn đầu video người quay; mục "Stop fumbling your words" có máy nhắc chạy chữ; dải màu tím-cam
  cho "Built for collaboration". Yếu: nhiều khoảng trắng chết, chữ chung chung ("Nail it. Every time.").
- **promptsmart.com** (đối thủ) — dựa vào "#1 brand", "patented VoiceTrack"; giá $20; trang nặng chữ, ảnh sản phẩm nhỏ.
