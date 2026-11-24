// SỔ HƯỚNG DẪN STUDIO 2 cho Lệnh AI (anh 24/11/2026: câu hỏi về studio2 hoặc kiến thức làm video phải được xử cho hợp lý).
// Lệnh AI trả lời câu "cách dùng" CHỈ từ sổ này — sổ không nói thì máy nói không biết và chỉ sang Hỏi đội, không đoán tên nút.
// Nguồn: apps/studio2/README.md (mô tả cho kỹ sư) viết lại theo cách người dùng thấy trên màn. Thêm / đổi nút ở studio2.js thì sửa cả mục ở đây.
// tra-repo-ok: văn bản hướng dẫn nội bộ, không phải mã.

export const HUONG_DAN_S2 = `
TẠO VIDEO
- Nút ＋ trên thanh trên: hộp tạo video. Thẻ "Tạo mới": tên, loại (Short / Phim nhiều tập / Quảng cáo), ý tưởng, ô tìm gói thể loại (chọn gói thì loại, thể loại, khung hình tự đặt). Thẻ "Từ template": chọn template quảng cáo rồi điền các ô nó cần. Tạo video không tốn credit.
- Menu tên phim (đầu thanh trên): tìm và mở video của mình.

WIDGET QUY TRÌNH (cột trái) — làm phim theo từng mục
- Phim chưa có cảnh: Ý tưởng → "Máy viết kịch bản" → "Máy tách thành cảnh" (tách cảnh có thể mất gần 5 phút; nút hiện "Vẫn đang chạy bên studio…" và tự hiện kết quả).
- Phim đã có cảnh: 16 mục của studio, mỗi mục ghi đạt / thiếu gì / đang chặn bước nào. Nút bước: thử người xem, gợi ý phong cách, đề xuất nhân vật + bối cảnh, ảnh mẫu, vẽ ảnh, duyệt, đọc lời, chốt nhịp, dựng clip, nhạc, xuất video.
- Bước tốn credit: bấm lần đầu hiện giá ước, bấm lần nữa mới chạy; mỗi lần một bước. Studio từ chối thì lý do hiện ngay dưới nút.
- Mục "Người xem hiểu phim": điểm chấm, chỗ người xem vấp + gợi ý sửa. Nút "Thử người xem" → "Máy sửa theo góp ý người xem" → thử lại; hoặc "Tôi nhận kịch bản này" khi thấy máy chấm sai.
- Mẫu nhân vật / bối cảnh: "Gắn mẫu người vào các cảnh có người" (0 credit, khi phim có đúng một mẫu người), "Vẽ ảnh mẫu còn thiếu".
- Dựng clip: "Máy kiểm khung các ảnh" → danh sách ảnh lệch → "Vẽ lại các ảnh máy báo lệch" hoặc "Nhận các ảnh máy báo lệch" (0 credit) → xuất bản dựng từ ảnh → "Chốt nhịp" → dựng clip. Phim dùng H3: nút "Xếp hàng dựng clip bằng H3" (0 credit lúc bấm, máy tự chạy lô sau vài phút) hoặc "↻ Dựng clip cảnh này".
- Clip bị máy soi báo lỗi (chữ tự in, vật thể lạ…): sinh lại cảnh đó, hoặc bấm "Bỏ qua lỗi soi" trên thẻ cảnh nếu máy báo nhầm.
- Video trả phí chỉ quản trị bật được cho tập.
- Mục nào chưa có nút ở Studio 2 thì có link "Làm ở studio ↗".

SỬA VÀ LƯU
- Sửa trong khung Thuộc tính / timeline (lời, thoại, chữ màn, giây phát, cỡ cảnh, góc, ống kính, chuyển động máy, thứ tự cảnh) rồi bấm "Lưu N chỗ sửa về studio" trên thanh trên. Còn chỗ chưa lưu thì không chạy được bước.
- Chưa lưu được từ Studio 2: mô tả, tên cảnh, đoạn, tiếng động, cảm xúc, nhân vật có mặt, xoá / tách cảnh (dùng Lệnh AI hoặc studio).
- Nút ＋ cảnh trên timeline: thêm cảnh trống.

SINH LẠI
- Nút "↻ …" ở ảnh cảnh, clip cảnh, lời đọc (Thuộc tính › tab Hình) và ảnh mẫu: hiện ô yêu cầu riêng (bỏ trống = sinh theo cấu trúc chung) + giá, rồi bấm "Sinh lại". Tốn credit.
- Ảnh vẽ lại thành ứng viên: tab Hình có lưới các ảnh đã vẽ của cảnh để bấm chọn. Trang đóng trước khi ảnh về thì dùng "Dùng ảnh mới vẽ cho các cảnh" (mục Storyboard).
- Âm thanh trên timeline: bấm clip lời đọc / tiếng động / thanh nhạc → "＋ Sinh…" hoặc "↻ Sinh lại…". "＋ Lớp lời": thêm người nói mới cho cảnh.
- Cảnh đã có clip: viền xanh lá + nhãn "▶ clip" trên timeline.

LỆNH AI (nút ✦ Lệnh AI, cột phải)
- Chọn clip trên timeline (keyframe / lời / tiếng động / nhạc) hoặc một mẫu, chip "Đang sửa" đổi theo; không chọn gì = cả tập. Gõ lệnh: sửa chữ chạy ngay (có Hoàn tác); sinh lại tốn credit hiện thẻ xác nhận, dưới ngưỡng nhỏ thì tự chạy và báo giá.

WIDGET VÀ BỐ CỤC
- Menu tổng ☰ (đầu thanh trên): mọi chức năng xếp theo nhóm Video / Chế độ / Widget / Hỗ trợ / Sửa.
- Bản Gọn / Pro. Bản Pro trên màn rộng: kéo đầu widget để dời, kéo mép để co giãn; menu Bố cục chọn bố cục đặt sẵn theo loại video, độ mịn lưới, "Xếp lại một hàng". Kéo một widget thả vào dải "＋ Thả vào đây" của widget khác để gộp thành tab; nút "Tách" để tách ra.
- Widget Hàng đợi (nút "Hàng đợi" đầu khung Quy trình hoặc menu Bố cục): các việc sinh của phim, trạng thái, lỗi nguyên văn, credit từng việc.
- Widget Nhật ký: từng bước của cảnh (Kịch bản · 3D · Ảnh · Clip · Giọng · Soát) và các lượt sinh, bấm để xem câu lệnh.
- Widget Cẩm nang (nút "Cẩm nang" đầu khung Quy trình): quy trình sản xuất từng loại video, các bước trên Studio 2, phim đang mở đạt / chưa đạt bước nào.

CREDIT, ĐỘI, HỖ TRỢ
- Credit: 1 credit = 0,1 cent; hiện tài khoản không giới hạn credit.
- Người không phải quản trị dùng Studio 2 khi quản trị cấp quyền ("Đội và quyền": Dùng · Bấm bước tốn tiền), chỉ thấy video mình tạo.
- Video được chia sẻ để xem (menu tên phim ghi "chia sẻ để xem", thanh trên ghi "Được chia sẻ · chỉ xem"): xem được hết nhưng không sửa / sinh được. Bấm "Nhân bản để sửa" trên thanh trên: máy chép nguyên video thành video của bạn (0 credit) rồi mở bản đó, sửa thoải mái; video gốc không đổi.
- Nút 💬 Góp ý trên thanh trên: báo lỗi / hỏi đội, dán ảnh, chụp trang; tab card đã gửi xem trả lời; tab Hỏi đáp.
`.trim();

/** CHỖ TRÊN MÀN mà Lệnh AI chỉ tới được (anh 24/11/2026: hỏi "nút X ở đâu" thì máy mở đúng widget / tab, cuộn tới và tô sáng).
 *  Khoá phải khớp sổ CHO_MAN trong apps/studio2/public/studio2.js (cách mở từng chỗ nằm ở đó). */
export const CHO_MAN_S2 = [
  ['sinh_lai_clip', 'nút ↻ Sinh lại clip của cảnh (Thuộc tính › Hình)'],
  ['sinh_lai_anh', 'nút ↻ Sinh lại keyframe / ảnh cảnh (Thuộc tính › Hình)'],
  ['sinh_lai_giong', 'nút ↻ Sinh lại lời đọc của cảnh (Thuộc tính › Hình)'],
  ['luu_ve', 'nút "Lưu N chỗ sửa về studio" (thanh trên)'],
  ['gop_y', 'nút 💬 Góp ý (thanh trên)'],
  ['menu_tong', 'menu tổng ☰ (đầu thanh trên)'],
  ['menu_phim', 'menu tên phim: tìm / mở video (thanh trên)'],
  ['tao_video', 'nút ＋ tạo video'],
  ['ban_gon_pro', 'nút chuyển bản Gọn / Pro'],
  ['bo_cuc', 'menu Bố cục (bản Pro)'],
  ['them_canh', 'nút ＋ cảnh trên timeline'],
  ['timeline', 'timeline cảnh / âm thanh'],
  ['thuoc_tinh', 'widget Thuộc tính của cảnh'],
  ['quy_trinh', 'widget Quy trình'],
  ['hang_doi', 'widget Hàng đợi'],
  ['cam_nang', 'widget Cẩm nang'],
  ['nhat_ky', 'widget Nhật ký'],
  ['lenh_ai', 'khung Lệnh AI'],
  ['ve_anh', 'bước vẽ ảnh keyframe (Quy trình › Keyframe)'],
  ['doc_loi', 'bước đọc lời (Quy trình › Giọng)'],
  ['chot_nhip', 'bước Chốt nhịp trước khi dựng clip (Quy trình › Clip)'],
  ['dung_clip', 'bước dựng clip (Quy trình › Clip)'],
  ['nguoi_xem', 'mục Người xem hiểu phim (Quy trình)'],
  ['xuat', 'bước xuất video (Quy trình)'],
] as const;
export type ChoManS2 = (typeof CHO_MAN_S2)[number][0];
