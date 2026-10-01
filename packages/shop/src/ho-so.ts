// SHOP — HỒ SƠ TRAO ĐỔI với khách / nhà cung cấp (bảng shop_ho_so + shop_ho_so_tin, migration 0197). Một khuôn cho hai phía; loại +
// trạng thái khai ở đây để mặt tiền (form liên hệ), nhịp đồng bộ (dispute Stripe/CJ) và màn /shop cùng đọc một bản.
// File THUẦN (không DB) — trình duyệt import được. Ghi: ./ho-so-ghi.ts.

export type Ben = 'khach' | 'ncc';
export const LOAI_HO_SO: Record<Ben, { key: string; nhan: string; chuThich: string }[]> = {
  khach: [
    { key: 'lien_he', nhan: 'Liên hệ', chuThich: 'Khách gửi form Contact us / hỏi chung.' },
    { key: 'khieu_nai', nhan: 'Khiếu nại', chuThich: 'Sai size, lỗi hàng, giao trễ, không nhận được…' },
    { key: 'doi_tra', nhan: 'Đổi / trả', chuThich: 'Khách muốn đổi size hoặc trả hàng.' },
    { key: 'hoan_tien', nhan: 'Hoàn tiền', chuThich: 'Khách đòi hoàn tiền (chưa qua ngân hàng).' },
    { key: 'dispute', nhan: 'Dispute', chuThich: 'Khách khiếu nại qua ngân hàng/thẻ (Stripe dispute) — có HẠN nộp bằng chứng.' },
    { key: 'khac', nhan: 'Khác', chuThich: '' },
  ],
  ncc: [
    { key: 'hoi', nhan: 'Hỏi NCC', chuThich: 'Hỏi tồn kho, tuyến ship, mẫu, giá…' },
    { key: 'khieu_nai', nhan: 'Khiếu nại NCC', chuThich: 'Thiếu/sai/hỏng hàng — dispute bên CJ.' },
    { key: 'giao_tre', nhan: 'Giao trễ', chuThich: 'Đơn đứng lâu, vận đơn không chạy — giục NCC.' },
    { key: 'khac', nhan: 'Khác', chuThich: '' },
  ],
};
export const TRANG_THAI_HO_SO = [
  { key: 'moi', nhan: 'Mới', chuThich: 'Chưa ai đụng tới.' },
  { key: 'dang_xu_ly', nhan: 'Đang xử lý', chuThich: 'Mình đang làm (tra đơn, hỏi NCC, soạn trả lời…).' },
  { key: 'cho_ho', nhan: 'Chờ bên kia', chuThich: 'Đã trả lời/gửi — chờ khách hoặc NCC phản hồi.' },
  { key: 'xong', nhan: 'Xong', chuThich: 'Đã giải quyết / đóng.' },
] as const;
export const NHAN_LOAI = (ben: Ben, k: string) => LOAI_HO_SO[ben].find((x) => x.key === k)?.nhan ?? k;

