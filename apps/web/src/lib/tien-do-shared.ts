// Hằng + kiểu dùng chung client/server cho sổ TIẾN ĐỘ (hạng mục → bước). KHÔNG import DB — client component cũng import file này.
// Chờ = chưa mở, đợi cổng của hạng mục khác (khuôn Bra: H05-H07 chờ cổng Vesnacharm) — đặt tay, không tự nhảy.
export const HANG_MUC_TRANG_THAI = ['Ý tưởng', 'Sẵn sàng', 'Chờ', 'Đang làm', 'Kẹt', 'Tạm dừng', 'Xong', 'Bỏ'] as const;
export const BUOC_TRANG_THAI = ['Chưa', 'Đang', 'Xong', 'Kẹt', 'Bỏ'] as const;
export type HangMucTrangThai = (typeof HANG_MUC_TRANG_THAI)[number];
export type BuocTrangThai = (typeof BUOC_TRANG_THAI)[number];

export interface Buoc { id: number; hang_muc_id: number; thu_tu: number; buoc: string; trang_thai: BuocTrangThai; ngay_xong: string | null; ket_qua: string; ghi_chu: string; updated_at: string }
export interface HangMuc {
  id: number; project_id: string | null; nhom: string; ma: string; ten: string; uu_tien: number; trang_thai: HangMucTrangThai; lan: string; goc: string;
  mo_ta: string; ghi_chu: string; ai: string; so: Record<string, string>; cong: string; link: string; tab: string; nguon: string | null;
  created_at: string; updated_at: string;
  // tính từ bước
  tong: number; xong: number; buoc_hien_tai: string; cap_nhat: string | null;
}
export interface HangMucChiTiet extends HangMuc { buoc: Buoc[]; nhat_ky: Array<{ ts: string; noi_dung: string; buoc_id: number | null }> }
export interface BuocPatch { trang_thai?: string; ket_qua?: string; ghi_chu?: string; buoc?: string }

/** 'Số' hiển thị một dòng: 'Vol đầu/th: 12k · CPC: $0.8'. */
export const soText = (so: Record<string, string> | null | undefined) => Object.entries(so ?? {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
