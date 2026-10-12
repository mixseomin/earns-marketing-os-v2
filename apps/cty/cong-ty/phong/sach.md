---
ten: Phòng Sách (KDP · Etsy · Gumroad)
thu_tu: 3
khuon: day-chuyen
truong: Thảo
vai_truong_phong: thao   # ai giữ vai (decision 2026-10-11 nhân sự sống): tab Dây chuyền giao việc theo vai, đổi người = đổi dòng này
vai_nguoi_lam: nhi        # viết nội dung + mô tả (hai trạm máy không tự làm)
vai_kenh_keo_khach: phuc  # video ngắn, ghim, trang printables, gom số kênh
vai_thi_truong: binh      # đo cầu + cạnh tranh trước khi chọn / đổi tựa
don_vi_viec: 1 cuốn · tuần (KDP 2 bìa mềm/tuần, Etsy giãn 2/tuần)
cong_nguoi: trạm 6 Giám đốc duyệt bản xem trong MOS2; KDP Giám đốc bấm Publish (máy tạo nháp sẵn)
so_do: sach
tom_tat: Dây chuyền 6 trạm bọc lên quy-trinh.mjs đang có
du_an: [puzzle-books]
the_lien_quan: [mint-almanac]   # card plays của dự án này chỉ lấy card nhắc nền của sổ phòng (KDP/Etsy/Gumroad): bộ sách coin, không lấy 20 card backlink của site
tai_khoan_them: [503, 504]   # tài khoản phòng dùng mà vault chưa gắn dự án puzzle-books: Pinterest #503, Gumroad store #504 frontporchpuzzles
so_san_pham: [etsy:FrontPorchZ, kdp:htuan82, gumroad:frontporchpuzzles]   # sổ sản phẩm MOS2 (Directus products) phòng đọc → tab Dây chuyền (worker/sach.mjs)
van_phong_cong: 3864   # văn phòng pixel riêng ở cty.on.tc/vp/sach/ (trình chạy mos2-vp-thu.service; map ở deploy/nginx-cty.conf)
trang_thai: đang chạy · máy theo lịch (iMac + MacBook) · nhân sự AI chưa bật
---
## Một tuần mẫu

| Lúc | Việc |
|---|---|
| T2 06:00 | Thảo heartbeat: lịch nói tuần này 2 cuốn (killer sudoku + lịch 2027). Mở 2 hồ sơ, giao Nhi 100 chủ đề |
| T2 07:00 | Bình nộp số: killer sudoku 40,5k/tháng, cạnh tranh 0,01 → giữ |
| T2–T3 | Máy chạy trạm 2 → 5. Lint chặn một chủ đề có tên thương hiệu → Nhi sửa. Mỗi bước ghi "▶ quy trình n/6" lên sổ Tài sản |
| T4 07:30 | Hà soát cổng: 2 PDF có, bìa có, lint đạt, dòng khai AI có, bút danh Martha Delaney → vào lô chờ ký |
| T4 08:00 | Minh: "Phòng Sách: 2 cuốn chờ anh ký. Etsy: cuốn X đến ngày bật bán, $0,20, ký?" |
| Giám đốc | "ký cả 3" → worker kiểm cờ freeze (tắt) → kdp.mjs --publish, etsy.mjs bat từ box3 |
| T4 15:00 | Kiên thấy KDP gửi mail content review cuốn cũ → freeze KDP 48h; Trang soạn giải trình, Giám đốc ký |
| T5 | Phúc dựng clip 2 cuốn, đăng 4 nền. Khoa nhận card ghim Pinterest |
| T6 | Trang gom 4 review Etsy: 3 khen trả lời mức 1, 1 chê "in mờ" → hồ sơ vụ việc, đề xuất gửi PDF, chờ ký |
| CN | An nộp số đơn tuần; cuốn 8 tuần không đơn → đổi tựa giữ ngày |

Luật sàn (lint thương hiệu, khai AI, bút danh người, Etsy chỉ từ box3, bật bán hỏi từng lần, không né khoá) là máy chặn trong repo `puzzle-books`, phòng không nới được.
