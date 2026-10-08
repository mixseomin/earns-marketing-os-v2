import type { TheLoai, KyThuatShot, Beat } from './dien-anh';
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
  co_keyframe: { label: 'Có keyframe', color: 'var(--amber)' },
  duyet: { label: 'Đã duyệt', color: 'var(--cyan)' },
  dang_sinh: { label: 'Đang sinh video', color: 'var(--violet)' },
  xong: { label: 'Xong', color: 'var(--lime)' },
  loi: { label: 'Lỗi', color: 'var(--red)' },
};

export type TiLe = '9:16' | '16:9';
export type DoPhanGiai = '720p' | '1080p';

/** Model ảnh (Gemini API). `gia1k` = cents một ảnh 1K. Thứ tự = thứ tự thử khi model đầu không tồn tại (tên model Google đổi nhanh). */
export const MO_HINH_ANH = [
  { key: 'gemini-nano-banana-2.1', label: 'Nano Banana 2.1 (rẻ, có tham chiếu nhân vật)', gia1k: 3.36 },
  { key: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image (rẻ nhất, 1K)', gia1k: 3.36 },
  { key: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', gia1k: 6.7 },
  { key: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image (đẹp nhất, đắt)', gia1k: 13 },
  { key: 'gpt-image-1.5', label: 'OpenAI gpt-image-1.5 (không cần billing Google; có tham chiếu)', gia1k: 3.4 },
  { key: 'gpt-image-1', label: 'OpenAI gpt-image-1', gia1k: 4 },
] as const;
export type MoHinhAnh = (typeof MO_HINH_ANH)[number]['key'];

/** Model video Veo 3.1 (Gemini API, predictLongRunning). `giaGiay` = cents mỗi giây theo độ phân giải. */
export const MO_HINH_VIDEO = [
  { key: 'veo-3.1-lite-generate-preview', label: 'Veo 3.1 Lite (rẻ nhất: $0,40 / 8s 720p)', giaGiay: { '720p': 5, '1080p': 8 } },
  { key: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast ($0,80 / 8s 720p)', giaGiay: { '720p': 10, '1080p': 12 } },
  { key: 'veo-3.1-generate-preview', label: 'Veo 3.1 Quality ($3,20 / 8s)', giaGiay: { '720p': 40, '1080p': 40 } },
  // fal.ai (khoá FAL_KEY) — giá ước theo bảng giá công khai 10/2026, tiền thật xem ở fal.ai/dashboard/usage.
  { key: 'fal:fal-ai/kling-video/v3/pro/image-to-video', label: 'Kling 3.0 Pro · fal (giữ nhân vật tốt, có tiếng, ~$0,14/s)', giaGiay: { '720p': 14, '1080p': 14 } },
  { key: 'fal:bytedance/seedance-2.5/image-to-video', label: 'Seedance 2.5 · fal (ByteDance, ~$0,23/s 720p)', giaGiay: { '720p': 23, '1080p': 57 } },
  { key: 'fal:fal-ai/vidu/q4/image-to-video', label: 'Vidu Q4 · fal (Shengshu, có lời thoại)', giaGiay: { '720p': 10, '1080p': 10 } },
  { key: 'fal:minimax/h3/image-to-video', label: 'MiniMax H3 · fal (Hailuo, ~$0,26/s)', giaGiay: { '720p': 26, '1080p': 26 } },
] as const;
export type MoHinhVideo = (typeof MO_HINH_VIDEO)[number]['key'];

/** Model chữ (Anthropic). Mặc định Opus 5.5; Haiku để thử rẻ. Tách cảnh chỉ vài nghìn token nên tiền chữ không đáng kể so với ảnh/video. */
export const MO_HINH_CHU = [
  { key: 'claude-opus-5-5', label: 'Claude Opus 5.5 (mặc định)' },
  { key: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { key: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rẻ nhất)' },
] as const;
export type MoHinhChu = (typeof MO_HINH_CHU)[number]['key'];

/** Một phân cảnh (scene): nhóm shot cùng phan_doan. Cảm xúc -5..5. */
export type PhanCanh = { ten: string; beat: string; muc_tieu: string; xung_dot: string; an_y: string; nhip: string; cam_xuc_dau: number; cam_xuc_cuoi: number };
export type KinhThanh = {
  phong_cach?: string;          // "3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm" — nối vào đầu mọi prompt ảnh/video
  ti_le?: TiLe;
  do_phan_giai?: DoPhanGiai;
  mo_hinh_anh?: MoHinhAnh;
  mo_hinh_video?: MoHinhVideo;
  mo_hinh_chu?: MoHinhChu;
  ngon_ngu?: string;            // ngôn ngữ lời thoại/phụ đề: 'vi' | 'en'
  the_loai?: TheLoai | '';      // thể loại → thư viện điện ảnh gợi ý kỹ thuật hợp (kinh dị ≠ hài ≠ QC UGC)
  logline?: string;             // một câu: ai, muốn gì, cản trở gì
  chu_de?: string;              // điều bộ phim muốn nói (theme)
};
export const KINH_THANH_MAC_DINH: Required<KinhThanh> = {
  phong_cach: '', ti_le: '9:16', do_phan_giai: '720p',
  mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: 'veo-3.1-lite-generate-preview', mo_hinh_chu: 'claude-opus-5-5', ngon_ngu: 'vi', the_loai: '', logline: '', chu_de: '',
};
export const docKinhThanh = (kt: KinhThanh | null | undefined): Required<KinhThanh> => ({ ...KINH_THANH_MAC_DINH, ...(kt ?? {}) });

export type Phim = {
  id: number; project: string; ten: string; loai: LoaiPhim; mo_ta: string; kinh_thanh: KinhThanh; trang_thai: string;
  so_tap: number; so_nhan_vat: number; so_canh: number; chi_phi_cents: number; updated_at: string;
};
export type BienThe = { id: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string; anh_url: string | null };
export type NhanVat = { id: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref: string[]; giong: string; giong_model: string; giong_id: string; giong_mau_url: string | null; bien_the?: BienThe[] };

/** Nhóm biến thể gợi ý theo loại anchor (nhãn hiển thị). */
export const NHOM_BIEN_THE: Record<LoaiNhanVat, { key: string; label: string }[]> = {
  nhan_vat: [{ key: 'bieu_cam', label: 'Biểu cảm' }, { key: 'trang_phuc', label: 'Trang phục' }, { key: 'tu_the', label: 'Tư thế / hành động' }],
  san_pham: [{ key: 'goc_may', label: 'Góc chụp' }, { key: 'ngu_canh', label: 'Ngữ cảnh dùng' }, { key: 'trang_thai', label: 'Trạng thái / màu' }],
  boi_canh: [{ key: 'goc_may', label: 'Góc máy' }, { key: 'thoi_diem', label: 'Thời điểm / thời tiết' }],
  dao_cu: [{ key: 'trang_thai', label: 'Trạng thái' }, { key: 'goc_may', label: 'Góc' }],
  phong_cach: [{ key: 'trang_thai', label: 'Biến tấu' }],
};
export const nhanNhom = (loai: LoaiNhanVat, nhom: string) => NHOM_BIEN_THE[loai]?.find((x) => x.key === nhom)?.label ?? nhom;
export type Tap = { id: number; phim_id: number; so: number; ten: string; brief: string; noi_khung: boolean; nhac_url: string | null; nhac_mo_ta: string; nhac_phan_canh: Record<string, string>; beats: Beat[]; phan_canh: PhanCanh[]; kich_ban: string; tom_tat: string; trang_thai: string; video_url: string | null; so_canh: number };
export type Canh = {
  id: number; tap_id: number; thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; am_thanh: string; thoai_url: string | null; am_thanh_url: string | null; phan_doan: string; cam_xuc: number; ky_thuat: KyThuatShot;
  thoi_luong_s: number; nhan_vat: number[]; bien_the: number[]; prompt_anh: string; prompt_video: string; dang_sinh_anh?: boolean; dang_sinh_am?: boolean;
  keyframe_url: string | null; keyframe_uv: string[]; video_url: string | null; video_cuoi_url: string | null; nguon_video: Record<string, unknown>; video_phien_ban: { url: string; ban: 'nhap' | 'cuoi'; model?: string; job?: number; luc?: string }[]; trang_thai: TrangThaiCanh; loi: string; chi_phi_cents: number;
};
export type Job = {
  id: number; canh_id: number | null; nhan_vat_id: number | null; loai: string; provider: string; model: string;
  trang_thai: string; task_id: string | null; output_url: string | null; chi_phi_cents: number; loi: string; created_at: string;
  phim_id?: number | null; nhan?: string; tokens_in?: number; tokens_out?: number; phim_ten?: string;
};

/** Giá Claude (USD / 1M token in/out, docs Anthropic 09/2026) → cents. */
const GIA_CHU: Record<string, [number, number]> = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5] };
export const giaChuCents = (model: string, tin: number, tout: number): number => {
  const g = GIA_CHU[model] ?? GIA_CHU[Object.keys(GIA_CHU).find((k) => model.startsWith(k)) ?? ''] ?? [4, 20];
  return (tin * g[0] + tout * g[1]) / 10_000;   // USD/1M token → cents/token = /1e6*100
};
export const giaAnhCents = (model: string): number => MO_HINH_ANH.find((m) => m.key === model)?.gia1k ?? 6.7;
export const giaVideoCents = (model: string, doPhanGiai: DoPhanGiai, giay: number): number => {
  const m = MO_HINH_VIDEO.find((x) => x.key === model);
  return Math.round((m?.giaGiay[doPhanGiai] ?? 10) * giay);
};
export const tien = (cents: number): string => { const d = cents / 100; return `$${d >= 1 ? d.toFixed(2) : d >= 0.1 ? d.toFixed(2) : d.toFixed(3)}`; };

/** Thành phần một cảnh dùng: anchor + biến thể chọn + thiếu gì. Dùng CHUNG cho UI (khoá nút, hiện chip) và máy chủ (chặn sinh). */
export type ThanhPhanCanh = { nv: NhanVat; bt: BienThe | null; anh: string | null; thieu: string[] };
export function thanhPhanCanh(c: Pick<Canh, 'nhan_vat' | 'bien_the'>, nhanVat: NhanVat[]): { ds: ThanhPhanCanh[]; thieu: string[] } {
  const ds = c.nhan_vat.map((id) => nhanVat.find((v) => v.id === id)).filter((v): v is NhanVat => !!v).map((nv) => {
    const bt = (nv.bien_the ?? []).find((b) => c.bien_the.includes(b.id)) ?? null;
    const thieu: string[] = [];
    if (!nv.mo_ta.trim()) thieu.push(`${nv.ten}: chưa tả đặc tính`);
    if (!nv.anh_ref.length) thieu.push(`${nv.ten}: chưa có ảnh gốc`);
    if (bt && !bt.anh_url) thieu.push(`${nv.ten} · ${bt.ten}: biến thể chưa có ảnh`);
    return { nv, bt, anh: bt?.anh_url ?? nv.anh_ref[0] ?? null, thieu };
  });
  return { ds, thieu: ds.flatMap((x) => x.thieu) };
}

/** Nâng cấp video (fal Topaz Precision) — giữ nguyên chuyển động của clip nháp. Giá công khai 10/2026: $0,10/10s ra 720p, $0,20/10s ra 1080p. */
export const NANG_CAP = { model: 'topaz/upscale/video/precision', label: 'Topaz Precision ×2', giaGiayCents: 2 } as const;
