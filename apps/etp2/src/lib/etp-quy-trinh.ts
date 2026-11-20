// QUY TRÌNH TRIỂN KHAI của từng mẫu creative — hiện trong chi tiết mẫu (anh 20/11/2026: "ở mỗi thể loại khi bấm vào xem drawer chi tiết sẽ có quy trình triển khai mẫu").
// Chép từ mã đang chạy (rà 20/11/2026: apps/etp/dong_phim.py + apps/xuong-video/scripts/ethopex/*.py), lời thường, không tên tệp. Đổi máy dựng thì sửa ở đây cùng lượt.
// Mẫu có quy trình RIÊNG ghi trong sổ (etp-mau-cr.json › quy_trinh) thì dùng bản trong sổ.
const CUOI = ['Tải creative lên Ethopex, máy chấm theo tiêu chí Meta / AFS (không tiêu chí nào từ 4 điểm trở xuống mới qua).', 'Chấm sạch thì máy tự lên camp theo luật nhà: phanh chợ, trần camp, giờ lên camp.'];
const DAU = 'Nhận phim: chỉ phim Âu-Mỹ, không nằm trong sổ phim cấm; thêm vào workspace Ethopex, lấy poster.';
/** theo mã dòng máy dựng của dạng */
export const QUY_TRINH_DONG: Record<string, string[]> = {
  CC: [DAU, 'Cắt đoạn 65–85 giây kết đúng chỗ hết tập (chỗ treo của app gốc), tập muộn nhất trước, tránh giây có từ cấm.', 'Soát đoạn: đọc phụ đề lọc từ cấm, AI xem 30 khung loại cảnh 18+ / cưỡng ép.', 'Giữ nguyên chữ và phụ đề gốc của app, thêm nút đỏ cố định.', ...CUOI],
  LT: [DAU, 'Lấy trọn từng tập dài 45–160 giây, tối đa 10 tập, tập muộn nhất trước.', 'Soát đoạn: đọc phụ đề lọc từ cấm, AI xem 30 khung loại cảnh 18+ / cưỡng ép.', 'Mọi đoạn sạch đều thành creative, không chèn thẻ giữa video.', ...CUOI],
  KT: [DAU, 'AI viết kịch bản 6 cảnh: câu móc, bối cảnh, phản bội / bị coi thường, đáy, lật ngược nhìn thấy được, nhử xem tiếp; lọc từ cấm ngay lúc viết.', 'Hình từng cảnh do AI vẽ (không phải khung phim), giọng kể theo giới tính người kể.', 'Soát video cuối: AI xem khung loại cảnh 18+.', ...CUOI],
  AT: [DAU, 'Tải 3 tập miễn phí, lọc khung: mặt to, nét, đủ sáng, không chữ đè mặt.', 'AI xếp hạng khung theo câu chuyện của phim (đọc tóm tắt thật): ưu tiên nhân vật chính ở khoảnh khắc đúng móc truyện.', 'Dựng 3 bản: khung đứng yên + tên phim (lấy từ poster nếu tách được) + nhãn và nút Free + giọng đọc.', 'Kiểm chữ trên video (từ cấm, CTA), AI soát cảnh 18+.', ...CUOI],
  ATT: [DAU, 'Chọn khung như dạng ảnh tĩnh (lọc mặt, AI xếp theo câu chuyện phim).', 'AI viết 3 đoạn tóm tắt 3–4 câu, kết ở chỗ chưa ngã ngũ; đoạn dính từ cấm bị bỏ.', 'Đoạn tóm tắt đi vào phần chữ của bài quảng cáo; hình là khung đứng yên + tên phim + giọng đọc.', ...CUOI],
  CTS: [DAU, 'Chọn khung như dạng ảnh tĩnh (lọc mặt, AI xếp theo câu chuyện phim).', 'AI chọn câu thoại gắt nhất (lăng mạ, phản bội, lộ thân phận); câu phải có thật trong phụ đề phim.', 'In câu thoại cỡ lớn lên khung đứng yên, thêm giọng đọc.', ...CUOI],
  PO: [DAU, 'Bản 1: AI vẽ poster mới theo bố cục của thể loại phim, tham chiếu poster gốc và khung đẹp; kiểm tên phim đúng chính tả.', 'Bản 2 và 3: poster gốc của phim thu 86%, thêm nhãn Free và giọng đọc.', ...CUOI],
};
/** mẫu học từ đối thủ đã có hàm vẽ — máy dựng theo mẫu */
export const QUY_TRINH_MAU: string[] = [
  'Tải 3 tập miễn phí của phim, trích khung; đọc tóm tắt thật của phim.',
  'Lọc khung mặt to, nét; AI xếp hạng theo câu chuyện của phim và gắn nhãn cảm xúc, nhân vật cho từng khung.',
  'Vẽ lớp chữ / nút / bố cục của mẫu lên khung (câu nhử do AI viết theo tóm tắt, nếu mẫu có câu nhử).',
  'Cổng chữ không che mặt: chữ phủ quá 4% mặt thì đổi sang khung xếp hạng kế, tối đa 10 khung; hết khung thì dừng, không đăng bản che mặt.',
  'Thêm giọng đọc, dựng video 1080×1920, vào thư viện, tải lên Ethopex qua cổng mẫu.',
  'Chọn lại cùng phim = bản mới: bỏ khung đã dùng, ưu tiên khung khác cảm xúc, câu nhử góc khác, câu đọc khác.',
];
