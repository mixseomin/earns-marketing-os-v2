// SỔ NGUỒN AI (16/10/2026 — anh: "nhiều tài khoản, api các loại → một page quản lý chung: giá theo mô hình, giây, loại nào khớp nội dung gì,
// mức độ ổn định; có cả bên chưa mua để tham khảo"). Dữ liệu: xv_nguon + xv_nguon_model (migration 0263); ổn định tính từ xv_job qua ma_job.
// File thường (client lẫn server import): kiểu + bảng hằng + phép tính thuần. Tự kiểm: nguon-ai.test.mts.

export type TrangThaiNguon = 'dang' | 'co_tk' | 'tham_khao' | 'ngung';
export type LoaiNguon = 'video' | 'anh' | 'giong' | 'am' | 'chu';
/** Ô khớp nội dung: 1 nên dùng · 0 được · -1 cấm · null chưa rõ — theo thứ tự VIEC_NGUON. */
export type O = 1 | 0 | -1 | null;

export const TEN_TRANG_THAI: Record<TrangThaiNguon, string> = { dang: 'Đang dùng', co_tk: 'Có tài khoản, chưa nối', tham_khao: 'Tham khảo', ngung: 'Ngừng' };
/** Đơn vị chuẩn mỗi loại — mọi giá quy về VNĐ thật trên đúng đơn vị này để so thẳng các bên. */
export const LOAI_NGUON: { key: LoaiNguon; ten: string; donVi: string }[] = [
  { key: 'video', ten: 'Video', donVi: '1 clip 8s · 720p · không tiếng' },
  { key: 'anh', ten: 'Ảnh', donVi: '1 ảnh 1K 9:16' },
  { key: 'giong', ten: 'Giọng', donVi: '1.000 ký tự' },
  { key: 'am', ten: 'Âm thanh', donVi: '1 bản 30s' },
  { key: 'chu', ten: 'Chữ', donVi: '1 lượt ≈ 20k token vào + 5k ra' },
];
export const VIEC_NGUON = ['QC người thật', 'Giữ nhân vật', 'Cận sản phẩm', 'Hoạt hình / 3D', 'Thoại khớp miệng', 'Nối khung khoá'] as const;

export type Nguon = { key: string; ten: string; kieu: string; trang_thai: TrangThaiNguon; loai: string; tra_tien: string; vault: string; nap_tien: string; rui_ro: string; co_khoa: boolean };
export type OnDinh = { goi: number; dat: number; giay: number | null; cents: number; dat_gan: string | null; loi_gan: string | null };
export type NguonModel = { id: number; nguon_key: string; loai: LoaiNguon; model: string; goi: string; gia_vnd: number | null; gia_goc: string; /** trang chứa giá — BẮT BUỘC khi có gia_vnd (CHECK trong 0263) */ link: string; /** trang thứ hai khi phép quy đổi cần */ link_phu: string; ngay_doc: string | null; kha_nang: string; khop: O[]; tat: string; on_dinh: OnDinh | null };

/** Tỉ lệ đạt 0..1, null = chưa có lượt. */
export const tiLeDat = (o: OnDinh | null): number | null => (o && o.goi ? o.dat / o.goi : null);
/** Giá chỉ được hiện khi có link nguồn (anh 16/10/2026: "giá mọi nguồn đều phải có link, cấm bịa"). */
export const giaHien = (m: Pick<NguonModel, 'gia_vnd' | 'link'>): number | null => (m.gia_vnd != null && m.link.trim() ? m.gia_vnd : null);
/** Mức ổn định để tô màu: dưới 60% đỏ, dưới 95% vàng, còn lại xanh; ít hơn 5 lượt thì gắn cờ "ít lượt". */
export const mucOnDinh = (o: OnDinh | null): 'do' | 'vang' | 'tot' | null => { const t = tiLeDat(o); return t == null ? null : t < 0.6 ? 'do' : t < 0.95 ? 'vang' : 'tot'; };
/** Tiền thật trung bình mỗi lượt đã trừ (VNĐ, 26.000₫ ≈ $1) — để đối chiếu giá niêm yết. */
export const vndMoiLuot = (o: OnDinh | null): number | null => (o && o.dat && o.cents ? Math.round(((o.cents / 100) * 26000) / o.dat) : null);
export const fmtVnd = (n: number | null | undefined): string => (n ? `${Math.round(n).toLocaleString('vi-VN')}₫` : '—');
/** Khoá trên máy chủ: khoa_env là danh sách TÊN biến môi trường (a|b), có một cái khác rỗng là có khoá. Không bao giờ đọc ra giá trị. */
export const coKhoa = (khoaEnv: string, env: Record<string, string | undefined>): boolean => khoaEnv.split('|').map((x) => x.trim()).filter(Boolean).some((k) => !!env[k]);
