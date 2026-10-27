// SỔ MẪU MÁY DỰNG (thể loại 'may_dung' trong danh sách Phim — anh 16/10/2026: "Máy Dựng") — MỘT chỗ khai. Thuần (màn client + máy chủ cùng đọc).
// Thêm kiểu video máy mới = thêm một mẫu ở đây + bộ vẽ của nó (vd may-dung-scam.ts) + một dòng trong mau-dung.ts.
export const MAU_MAY_DUNG = {
  'do-chu-mot-dung': { ten: 'Đố chữ · Only ONE is spelled right' },
  'scam-or-real': { ten: 'Scam or Real? · tin nhắn khách sạn' },
  'before-you-land': { ten: 'Before you land · eSIM theo nước' },
  'cau-hoi-thi': { ten: 'Câu hỏi luyện thi · ExamWeight' },
  'canh-dong': { ten: 'Cảnh động thả hồn' },
  'bai-anh': { ten: 'Bài ảnh (thẻ chữ · nhận ra · đoán · hai lựa chọn)' },   // mẫu CHUNG chỉ ra ẢNH 1080×1350 (chiAnh), không MP4 — bước 3, 27/10/2026   // mẫu CHUNG mọi ngách (bước 3 Dạng × Góc × Sản phẩm, 26/10/2026): video thật + tiếng nền + câu móc nhỏ
} as const;
export type MauMayDung = keyof typeof MAU_MAY_DUNG;
