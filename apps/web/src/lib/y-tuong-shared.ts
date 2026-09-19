// Hằng + kiểu dùng chung client/server cho sổ ý tưởng (KHÔNG import DB — client component cũng import file này).
export const Y_TUONG_TRANG_THAI = ['Ý tưởng', 'Sẵn sàng', 'Đang làm', 'Kẹt', 'Tạm dừng', 'Xong', 'Bỏ'] as const;
export const BUOC_TRANG_THAI = ['Chưa', 'Đang', 'Xong', 'Kẹt', 'Bỏ'] as const;
export type YTuongTrangThai = (typeof Y_TUONG_TRANG_THAI)[number];
export type BuocTrangThai = (typeof BUOC_TRANG_THAI)[number];

export interface Buoc { id: number; y_tuong_id: number; thu_tu: number; buoc: string; trang_thai: BuocTrangThai; ngay_xong: string | null; ket_qua: string; ghi_chu: string; updated_at: string }
export interface YTuong {
  id: number; nhom: string; ma: string; ten: string; uu_tien: number; trang_thai: YTuongTrangThai; lan: string; goc: string;
  mo_ta: string; ghi_chu: string; link: string; tab: string; project_id: string | null; created_at: string; updated_at: string;
  // tính từ bước
  tong: number; xong: number; buoc_hien_tai: string; cap_nhat: string | null;
}
export interface YTuongChiTiet extends YTuong { buoc: Buoc[]; nhat_ky: Array<{ ts: string; noi_dung: string; buoc_id: number | null }> }
export interface BuocPatch { trang_thai?: string; ket_qua?: string; ghi_chu?: string; buoc?: string }
