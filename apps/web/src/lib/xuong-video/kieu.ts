// Xưởng video AI — kiểu dữ liệu + bảng model/giá. File THƯỜNG (không 'use server'), client lẫn server import được.
// Giá: ai.google.dev/gemini-api/docs/pricing đọc 08/10/2026 (Veo 3.1 Lite 720p $0,05/giây; Nano Banana 2.1 1K $0,0336/ảnh).
// Sora 2 API của OpenAI đã đóng 24/09/2026 → video chỉ còn Google; chữ dùng Claude.

export type LoaiPhim = 'short' | 'phim' | 'quang_cao';
export const LOAI_PHIM: { key: LoaiPhim; label: string; mo_ta: string }[] = [
  { key: 'short', label: 'Short video', mo_ta: 'Reels / TikTok / Shorts 15-60s, một tập' },
  { key: 'phim', label: 'Phim ngắn', mo_ta: 'Nhiều tập, tuyến nhân vật đồng nhất cả bộ' },
  { key: 'quang_cao', label: 'Creative quảng cáo', mo_ta: 'Video sản phẩm 15-30s cho Meta/TikTok' },
];

export type LoaiNhanVat = 'nhan_vat' | 'san_pham' | 'boi_canh' | 'dao_cu' | 'phong_cach';
export const LOAI_NHAN_VAT: { key: LoaiNhanVat; label: string }[] = [
  { key: 'nhan_vat', label: 'Nhân vật' },
  { key: 'san_pham', label: 'Sản phẩm' },
  { key: 'boi_canh', label: 'Bối cảnh' },
  { key: 'dao_cu', label: 'Đạo cụ' },
  { key: 'phong_cach', label: 'Phong cách' },
];

export type TrangThaiCanh = 'nhap' | 'co_keyframe' | 'duyet' | 'dang_sinh' | 'xong' | 'loi';
export const TRANG_THAI_CANH: Record<TrangThaiCanh, { label: string; color: string }> = {
  nhap: { label: 'Nháp', color: 'var(--fg-3)' },
  co_keyframe: { label: 'Có keyframe', color: 'var(--neon-amber)' },
  duyet: { label: 'Đã duyệt', color: 'var(--neon-cyan)' },
  dang_sinh: { label: 'Đang sinh video', color: 'var(--neon-violet)' },
  xong: { label: 'Xong', color: 'var(--neon-lime)' },
  loi: { label: 'Lỗi', color: 'var(--neon-red, #f87171)' },
};

export type TiLe = '9:16' | '16:9';
export type DoPhanGiai = '720p' | '1080p';

/** Model ảnh (Gemini API). `gia1k` = cents một ảnh 1K. Thứ tự = thứ tự thử khi model đầu không tồn tại (tên model Google đổi nhanh). */
export const MO_HINH_ANH = [
  { key: 'gemini-nano-banana-2.1', label: 'Nano Banana 2.1 (rẻ, có tham chiếu nhân vật)', gia1k: 3.36 },
  { key: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image (rẻ nhất, 1K)', gia1k: 3.36 },
  { key: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', gia1k: 6.7 },
  { key: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image (đẹp nhất, đắt)', gia1k: 13 },
] as const;
export type MoHinhAnh = (typeof MO_HINH_ANH)[number]['key'];

/** Model video Veo 3.1 (Gemini API, predictLongRunning). `giaGiay` = cents mỗi giây theo độ phân giải. */
export const MO_HINH_VIDEO = [
  { key: 'veo-3.1-lite-generate-preview', label: 'Veo 3.1 Lite (rẻ nhất: $0,40 / 8s 720p)', giaGiay: { '720p': 5, '1080p': 8 } },
  { key: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast ($0,80 / 8s 720p)', giaGiay: { '720p': 10, '1080p': 12 } },
  { key: 'veo-3.1-generate-preview', label: 'Veo 3.1 Quality ($3,20 / 8s)', giaGiay: { '720p': 40, '1080p': 40 } },
] as const;
export type MoHinhVideo = (typeof MO_HINH_VIDEO)[number]['key'];

/** Model chữ (Anthropic). Mặc định Opus 5.5; Haiku để thử rẻ. Tách cảnh chỉ vài nghìn token nên tiền chữ không đáng kể so với ảnh/video. */
export const MO_HINH_CHU = [
  { key: 'claude-opus-5-5', label: 'Claude Opus 5.5 (mặc định)' },
  { key: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { key: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rẻ nhất)' },
] as const;
export type MoHinhChu = (typeof MO_HINH_CHU)[number]['key'];

export type KinhThanh = {
  phong_cach?: string;          // "3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm" — nối vào đầu mọi prompt ảnh/video
  ti_le?: TiLe;
  do_phan_giai?: DoPhanGiai;
  mo_hinh_anh?: MoHinhAnh;
  mo_hinh_video?: MoHinhVideo;
  mo_hinh_chu?: MoHinhChu;
  ngon_ngu?: string;            // ngôn ngữ lời thoại/phụ đề: 'vi' | 'en'
};
export const KINH_THANH_MAC_DINH: Required<KinhThanh> = {
  phong_cach: '', ti_le: '9:16', do_phan_giai: '720p',
  mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: 'veo-3.1-lite-generate-preview', mo_hinh_chu: 'claude-opus-5-5', ngon_ngu: 'vi',
};
export const docKinhThanh = (kt: KinhThanh | null | undefined): Required<KinhThanh> => ({ ...KINH_THANH_MAC_DINH, ...(kt ?? {}) });

export type Phim = {
  id: number; project: string; ten: string; loai: LoaiPhim; mo_ta: string; kinh_thanh: KinhThanh; trang_thai: string;
  so_tap: number; so_nhan_vat: number; so_canh: number; chi_phi_cents: number; updated_at: string;
};
export type NhanVat = { id: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref: string[]; giong: string };
export type Tap = { id: number; phim_id: number; so: number; ten: string; kich_ban: string; tom_tat: string; trang_thai: string; video_url: string | null; so_canh: number };
export type Canh = {
  id: number; tap_id: number; thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; am_thanh: string;
  thoi_luong_s: number; nhan_vat: number[]; prompt_anh: string; prompt_video: string;
  keyframe_url: string | null; keyframe_uv: string[]; video_url: string | null; trang_thai: TrangThaiCanh; loi: string; chi_phi_cents: number;
};
export type Job = {
  id: number; canh_id: number | null; nhan_vat_id: number | null; loai: string; provider: string; model: string;
  trang_thai: string; task_id: string | null; output_url: string | null; chi_phi_cents: number; loi: string; created_at: string;
};

export const giaAnhCents = (model: string): number => MO_HINH_ANH.find((m) => m.key === model)?.gia1k ?? 6.7;
export const giaVideoCents = (model: string, doPhanGiai: DoPhanGiai, giay: number): number => {
  const m = MO_HINH_VIDEO.find((x) => x.key === model);
  return Math.round((m?.giaGiay[doPhanGiai] ?? 10) * giay);
};
export const tien = (cents: number): string => (cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents.toFixed(cents < 10 ? 1 : 0)}¢`);
