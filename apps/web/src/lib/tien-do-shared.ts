// Hằng + kiểu dùng chung client/server cho sổ TIẾN ĐỘ (hạng mục → bước). KHÔNG import DB — client component cũng import file này.
// Trạng thái hạng mục đặt tay (như cột Trạng thái trên sheet). Chờ = chưa mở, đợi cổng của hạng mục khác (Bra H05-H07).
export const HANG_MUC_TRANG_THAI = ['Ý tưởng', 'Sẵn sàng', 'Chờ', 'Đang làm', 'Kẹt', 'Tạm dừng', 'Xong', 'Bỏ'] as const;
// 'Đợi số' = bước ĐANG CHẠY nhưng không ai gỡ được, chỉ chờ dữ liệu đủ (camp gom click, chờ
// Google index, A/B test gom mẫu). Tách khỏi 'Kẹt' vì Kẹt nghĩa là CHỜ AI ĐÓ gỡ — gộp hai loại
// chờ này vào một chữ thì `tiendo ket` (danh sách việc cần gỡ) đầy thứ không gỡ được.
// Anh chốt 20/09/2026 sau khi bước "Bật camp + theo 14 ngày" ghi Kẹt mà chẳng ai kẹt cả.
export const BUOC_TRANG_THAI = ['Chưa', 'Đang', 'Đợi số', 'Xong', 'Kẹt', 'Bỏ'] as const;
export type HangMucTrangThai = (typeof HANG_MUC_TRANG_THAI)[number];
/** Hạng mục ĐANG CHẠY (có việc thật): dùng để quyết dự án nào lên chip ở /plays?view=tiendo. Dự án chỉ toàn
 *  Ý tưởng / Tạm dừng / Xong / Bỏ là dự án ít mở → nằm trong picker "＋ dự án khác…" (anh chốt 20/09/2026). */
export const HANG_MUC_DANG_CHAY: ReadonlySet<string> = new Set(['Sẵn sàng', 'Chờ', 'Đang làm', 'Kẹt']);
export type BuocTrangThai = (typeof BUOC_TRANG_THAI)[number];
/** Dấu đứng trước trạng thái — MỘT nguồn cho server (bước hiện tại), UI và CLI phải khớp. */
export const TRANG_THAI_MARK: Record<HangMucTrangThai | BuocTrangThai, string> = {
  'Ý tưởng': '○', 'Sẵn sàng': '◔', 'Chờ': '⏳', 'Đang làm': '▶', 'Kẹt': '⛔', 'Tạm dừng': '⏸', 'Xong': '✓', 'Bỏ': '×', 'Chưa': '○', 'Đang': '▶', 'Đợi số': '⏱',
};

export interface Buoc { id: number; hang_muc_id: number; thu_tu: number; buoc: string; trang_thai: BuocTrangThai; ngay_xong: string | null; ket_qua: string; ghi_chu: string; updated_at: string }
export interface HangMuc {
  id: number; project_id: string | null; nhom: string; ma: string; ten: string; uu_tien: number; trang_thai: HangMucTrangThai; lan: string; goc: string;
  mo_ta: string; ghi_chu: string; ai: string; so: Record<string, string>; cong: string; link: string; nguon: string | null;
  created_at: string; updated_at: string;
  // tính từ bước
  tong: number; xong: number; buoc_hien_tai: string; cap_nhat: string | null;
}
export interface HangMucChiTiet extends HangMuc { buoc: Buoc[]; nhat_ky: Array<{ ts: string; noi_dung: string; buoc_id: number | null }> }
export interface BuocPatch { trang_thai?: string; ket_qua?: string; ghi_chu?: string; buoc?: string }

/** 'Số' hiển thị một dòng: 'Vol đầu/th: 12k · CPC: $0.8'. */
export const soText = (so: Record<string, string> | null | undefined) => Object.entries(so ?? {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
