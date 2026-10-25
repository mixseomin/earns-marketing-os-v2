<!-- CHUẨN RA MẮT + NUÔI APP (anh 24/10/2026: "làm thêm app + page giới thiệu chi tiết + plan nội dung chuẩn hoá để cho mọi app về sau").
     Rút từ Giỗ Chạp ngày 24/10/2026: 319 lượt hiện / 5 tải trong 7 ngày, 0 đánh giá, site 3 trang, toàn bộ khách đến từ ô tìm kiếm store.
     Mã bước (A01…) là khoá: `sanpham add` app mới tự tạo hạng mục tiến độ với đúng các bước này (bước 4 của chuẩn) — đổi mã thì đổi cả hai.
     Áp cho mọi app (iOS, Windows, web app) của dự án clane / ios-app / militarycalc… Thiếu bước nào thì ghi lý do vào sổ tiến độ, không bỏ im. -->

# Chuẩn ra mắt và nuôi app

Một app lên store mà chỉ chờ ô tìm kiếm thì gần như không ai thấy. Mỗi app phải có đủ năm phần dưới đây, theo thứ tự.
Phần nào có máy làm thì dùng máy, không làm tay lại.

## A · Trước khi lên store

- **A01 Giữ tên + ghi sổ.** iOS: `Tools/asc.mjs bundle`; Windows: `br play run partner-center.giu-ten-app`. Ghi sổ Tài sản bằng `sanpham add` (Windows playbook tự ghi).
- **A02 Trang giới thiệu chi tiết.** Trên clane.app/<slug> (hoặc site riêng của app) theo `chuan-trang-ban.md`: tên to nhất ở đầu, demo chạy thật, ảnh màn app thật, nút store đầu + cuối, giá rõ, FAQ. Chưa bán thì form "Notify me". Nộp `kiem-bai --loai trang-ban`, DUYỆT mới lên.
- **A03 Trang hỗ trợ + quyền riêng tư** có chữ thật (store bắt buộc, `onboard-site.mjs` kiểm).
- **A04 Nhóm góc trên spy.** Mỗi app một nhóm loại `app` ở spy.on.tc/#/goc. Cụm tìm là chữ người ta gõ khi tìm loại app đó (vd "speech to text"), không phải tên app. Máy cào tự lấy gợi ý tìm, Reddit, YouTube và đánh giá store qua proxy, không tốn AI. Góc sinh ra là nguồn cho C01, C03, C04 và chữ quảng cáo D01. Lệnh: `ra-mat-app "<Tên>: <loại app>" --chi-goc --cum "…" --thi-truong US`. "Sinh góc bằng AI" tốn tiền nên vẫn do người bấm trên màn.

## B · Trang store (ASO)

- **B01 Từ khoá không phí chữ.** Tên + phụ đề chứa từ khoá chính; ô từ khoá (100 ký tự) KHÔNG lặp chữ đã có trong tên / phụ đề (Apple không tính lần hai). MilitaryCalc 1.2 phí ~25 ký tự vì lặp "military pay, BAH, VA, TSP".
- **B02 Ảnh đầu tiên nói việc app làm** bằng chữ người ta gõ tìm ("Nhắc ngày giỗ âm lịch"), không nói tính chất chung ("không quảng cáo"). Ảnh = màn app thật.
- **B03 Hỏi đánh giá** ngay sau một hành động thành công (lần tính thứ 3, vừa gửi thiệp…), tối đa 90–120 ngày một lần. App 0 đánh giá thì khó lên hạng và ít người bấm tải.
- **B04 Vùng bán mở đủ nước** (`ios-chung/Tools/vung-ban.mjs`, `asc.mjs meta` tự chạy).
- **B05 Luật riêng từng store:** Microsoft cấm chữ "free" khi app bán (10.1.4.3) và bắt khai có mua hàng (10.8.2).

## C · Nội dung kéo khách (kế hoạch nội dung)

- **C01 Kho nội dung của app thành trang web.** Liệt kê thứ trong app mà người ta vẫn tìm trên Google (bài văn khấn, bảng lương theo cấp bậc, câu hỏi luyện thi…). Mỗi mục là một trang trên site của app, gồm:
  - cảnh mở đầu;
  - công cụ cho người đọc tự thử (chạy cùng lõi với app);
  - khung ví dụ;
  - video;
  - phần "Nếu đã lỡ" và câu hỏi hay gặp;
  - nút tải ở giữa và cuối trang.

  Mỗi trang chấm theo `chuan-duyet-bai.md` và phải DUYỆT mới lên. Mẫu: giochap.com/van-khan (13 trang, duyệt 9–10).
- **C02 Bảng dịp của app.** Những ngày người dùng cần app nhất trong năm: ngày âm, mùa thuế, mùa chuyển trạm (PCS), mùa thi… Bảng dịp là nguồn cho C04, C05, D01. Tính bằng máy (Giỗ Chạp: lõi âm lịch của app), không gõ tay.
- **C03 Video ngắn** từ kho nội dung, mỗi mục một video, đủ hai khổ: ngang cho web, dọc cho Reels / Shorts. Dùng ảnh thật (Pexels / Pixabay / Unsplash), mỗi khung chữ đứng đủ thời gian đọc, dùng phông có đủ dấu tiếng Việt (ký tự "→" thiếu trong Noto Serif hiện thành ô vuông).
- **C04 Máy đăng social theo dịp.**
  - Kênh đúng ngôn ngữ và khán giả; ưu tiên đổi tên Page cũ cùng chủ đề trước khi tạo Page mới.
  - Một máy studio `xv_may` cho mỗi app; mỗi dịp một bài, tiêu đề riêng.
  - Hạn đăng `dang_tu..dang_den`: 3 ngày trước dịp.
  - Giờ đăng sớm nhất `gio_tu` theo múi giờ của khán giả.
  - Phòng Nội dung chấm theo `chuan-bai-dang.md`; máy đăng chung giữ nhịp chống spam.
- **C05 In-App Event (iOS)** cho dịp lớn nhất năm:
  - thẻ hiện trên store 14 ngày trước sự kiện, sự kiện dài tối đa 31 ngày;
  - bắt buộc có deep link;
  - nộp riêng, không kèm phiên bản app.
- **C06 Web dẫn về store:** Smart App Banner, khung mời tải ngay dưới kết quả công cụ, link store trong từng trang C01.

## D · Quảng cáo theo lịch

- **D01 Search Ads / quảng cáo store theo bảng dịp.**
  - Chạy 3 ngày trước mỗi dịp.
  - Đợt đầu là đợt thử nhỏ để đo giá mỗi lượt tải.
  - Tiền do Giám đốc duyệt từng khoản; dựng xong để chạy theo ngày đã duyệt.
  - Thẻ thanh toán chỉ chủ tài khoản nhập.

## E · Đo và sửa

- **E01 Số store về mos2** (`product_stats`): App Store (`app-store-so.mjs`), Microsoft (`ms-store-so.mjs`): lượt hiện, lượt xem trang, lượt tải, đánh giá, theo nước và theo nguồn.
- **E02 Mỗi tuần đọc một lần, sửa theo ngưỡng:**
  - lượt hiện → tải dưới 3%: sửa ảnh đầu (B02);
  - lượt hiện thấp: thêm từ khoá (B01) và trang C01;
  - có tải mà không có đánh giá: xem lại lúc hỏi đánh giá (B03);
  - toàn bộ khách đến từ tìm kiếm store: phần C chưa chạy.
