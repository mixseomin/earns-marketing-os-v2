// SỔ MẪU MÁY DỰNG (thể loại 'may_dung' trong danh sách Phim — anh 16/10/2026: "Máy Dựng") — MỘT chỗ khai. Thuần (màn client + máy chủ cùng đọc).
// Thêm kiểu video máy mới = thêm một mẫu ở đây + bộ vẽ của nó (vd may-dung-scam.ts) + một dòng trong mau-dung.ts.
export const MAU_MAY_DUNG = {
  'do-chu-mot-dung': { ten: 'Đố chữ · Only ONE is spelled right' },
  'scam-or-real': { ten: 'Scam or Real? · tin nhắn khách sạn' },
  'before-you-land': { ten: 'Before you land · eSIM theo nước' },
  'cau-hoi-thi': { ten: 'Câu hỏi luyện thi · ExamWeight' },
  'canh-dong': { ten: 'Cảnh động thả hồn' },
  'giai-thich': { ten: 'Lồng tiếng giải thích (giọng AI heygen)' },   // video nền thật + lời dẫn giọng AI + phụ đề theo câu — bước 6, 30/10/2026
  'bai-anh': { ten: 'Bài ảnh (thẻ chữ · nhận ra · đoán · hai lựa chọn)' },
  'top-n': { ten: 'Top 3/5 đếm ngược' },
  'carousel': { ten: 'Carousel 5–7 trang (chỉ ảnh 4:5)' },   // trang móc + 3–5 trang ý + trang chốt, mỗi trang một ảnh thật — bước 4, 28/10/2026
  'binh-chon': { ten: 'Bình chọn (X poll — không tệp)' },   // đường đăng poll: câu hỏi + 2–4 lựa chọn, không dựng gì — bước 4, 27/10/2026
  'lac-loai': { ten: 'Vật lạc loài (lưới ô chữ, một ô khác)' },   // lưới 3×3–5×5 trên ảnh thật, đếm 7s, khoanh — bước 3, 27/10/2026
  'cai-nao-gia': { ten: 'Cái nào giả? (hai mẫu cạnh nhau)' },   // hai thẻ chữ A/B trên ảnh thật mờ, đếm 7s, lộ FAKE/REAL + khoanh dấu hiệu — bước 3, 27/10/2026
  'cau-noi': { ten: 'Câu nói theo tình huống (ngôn ngữ khác)' },   // 3–5 câu bản ngữ + cách đọc + nghĩa trên một cảnh thật; cần font CJK trong máy dựng — bước 3, 27/10/2026
  'so-sanh': { ten: 'So sánh X vs Y (chia đôi màn)' },   // hai ảnh thật trên/dưới (nen_url = X, nen_them[0] = Y) — bước 3, 27/10/2026
  'lat-dap-an': { ten: 'Lật đáp án (lầm tưởng vs sự thật · đúng/sai)' },   // một mẫu hai dạng (dang_bai ghi ở từng video), mỗi câu một ảnh thật — bước 3, 27/10/2026   // mẫu CHUNG: mỗi mục một ảnh thật (nen_url + nen_them), số đếm ngược, tiếng thật — bước 3, 27/10/2026   // mẫu CHUNG chỉ ra ẢNH 1080×1350 (chiAnh), không MP4 — bước 3, 27/10/2026   // mẫu CHUNG mọi ngách (bước 3 Dạng × Góc × Sản phẩm, 26/10/2026): video thật + tiếng nền + câu móc nhỏ
} as const;
export type MauMayDung = keyof typeof MAU_MAY_DUNG;
