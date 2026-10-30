-- MÁY EXAMWEIGHT THEO GÓC (anh 31/10/2026: "mọi bài đều phải dựa vào 1 idea góc", "tập trung sx bài mới theo rule có góc"): máy examweight-cau-hoi trước đây
-- lấy câu hỏi thẳng từ ngân hàng đề, không góc (112 bài chưa đăng đã cất lưu trữ ở 0377). Gắn nhóm góc spy #2382 "Luyện thi chứng chỉ y tế (NREMT · PTCB · TEAS)"
-- (tạo 31/10, máy cào tự cào + tự sinh góc theo luật đã duyệt) + site đích examweight.com; sự thật: apps/xuong-video/su-that/examweight-cau-hoi.md.
UPDATE xv_may SET goc_sp = '{2382}', site_dich = 'examweight.com', ngach = '{hoc}' WHERE ma = 'examweight-cau-hoi';
