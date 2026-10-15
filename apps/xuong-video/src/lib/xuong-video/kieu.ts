import type { TheLoai, KyThuatShot, Beat } from './dien-anh';
import { boChamCuoi, chiaCum } from './ngat-dong';
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
/** Khổ ẢNH: khổ phim + vuông (ảnh mẫu anchor) + 2:3 (poster) + 4:5 (ảnh QC feed Meta — anh-qc.ts). */
export type TiLeAnh = TiLe | '1:1' | '2:3' | '4:5';
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
  { key: 'fal:bytedance/seedance-2.5/image-to-video', label: 'Seedance 2.5 · fal (ByteDance, ~$0,47/s 720p)', giaGiay: { '720p': 47, '1080p': 116 } },
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

/** Một dòng thoại kiểu kịch bản phim: ai nói · diễn xuất · lời · file giọng (nếu đã sinh). */
/** tre = giây bắt đầu đọc tính từ đầu shot (chép nhịp QC mẫu: giọng vào ở 0,47s); bỏ trống = nối ngay sau dòng trước. */
export type DongThoai = { nhan_vat: string; dien_xuat: string; loi: string; url?: string | null; tre?: number;
  /** url là bản đã GỌN (cắt lặng đầu/cuối, rút quãng ngắt dài) — hau-ky.ts › gonGiong; không gọn lại lần hai. */
  gon?: boolean;
  /** giọng đã đọc file url ("model|voice") — ghi lúc job giọng xong; bản xuất dùng để bắt lời dẫn lẫn giọng. */
  giong?: string;
  /** độ dài file url (giây, đo bằng ffprobe lúc khớp giọng) — máy kiểm tiếng (khop-giong.ts › kiemTieng) đọc, không phải đo lại. */
  dai?: number;
  /** bản LỒNG TIẾNG của dòng theo ngôn ngữ (long-tieng.ts): goc = câu gốc lúc dịch (lệch câu hiện tại = cũ, không dùng), loi = câu dịch,
   *  url = file giọng đọc câu dịch bằng giọng của người nói. */
  dich?: Record<string, { goc: string; loi: string; url?: string | null }> };
/** Ghép dòng thoại thành chuỗi loi_thoai (tương thích chỗ cũ: animatic, tìm người nói). */
export const ghepThoai = (ds: DongThoai[]) => ds.filter((d) => d.loi.trim()).map((d) => `${d.nhan_vat ? `${d.nhan_vat}${d.dien_xuat ? ` (${d.dien_xuat})` : ''}: ` : ''}"${d.loi.trim()}"`).join('\n');
/** Một phân cảnh (scene): nhóm shot cùng phan_doan. Cảm xúc -5..5. */
/** Phân cảnh = một CẢNH của hồ sơ tiền kỳ chuẩn studio (14/10/2026, anh chốt từ Tango & Lint tập 1): ngoài mục tiêu/xung đột, mỗi cảnh mang
 *  phần của đạo diễn (giá trị đổi, điểm xoay, nhịp hành động–phản ứng), sản xuất (hiệu ứng — nhân vật/đạo cụ/bối cảnh rút từ anchor của shot),
 *  color script (ánh sáng + màu, mã thư viện) và nhạc. Bảy tài liệu của tab Hồ sơ đọc từ đây + shot (ho-so.ts). */
export type PhanCanh = { ten: string; beat: string; muc_tieu: string; xung_dot: string; an_y: string; nhip: string; cam_xuc_dau: number; cam_xuc_cuoi: number;
  /** gag của cảnh: gài → bùng, o_shot = shot thứ mấy TRONG cảnh có cú bùng (1-based) */ gag?: { ten: string; gai: string; bung: string; o_shot: number; /** MẠCH truyện nhỏ của gag trong cảnh (A, B…) — cảnh có ≥2 gag phải khai; đổi mạch thì cần NÚT ĐÓNG (nhip-hinh.ts › kiemNutDong) */ mach?: string }[];
  /** cảnh mở series (chuỗi từ thế giới ngoài) — không tính vào độ dài chuẩn của tập */ intro?: boolean;
  noi?: string; luc?: string; gia_tri_doi?: string; diem_xoay?: string; nhip_hd?: string[]; hieu_ung?: string[]; anh_sang?: string; mau?: string; mau_mo_ta?: string; nhac?: string;
  /** đoạn kịch bản (screenplay) của cảnh: hành động / âm / thoại / chuyển cảnh */ kich_ban?: DongKichBan[] };
export type DongKichBan = { loai: 'hd' | 'am' | 'chuyen'; chu: string } | { loai: 'nv'; ten: string; dien: string; loi: string };
export type KinhThanh = {
  phong_cach?: string;          // "3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm" — nối vào đầu mọi prompt ảnh/video
  ti_le?: TiLe;
  do_phan_giai?: DoPhanGiai;
  mo_hinh_anh?: MoHinhAnh;
  mo_hinh_video?: MoHinhVideo;
  mo_hinh_chu?: MoHinhChu;
  /** URL BẢNG TỈ LỆ dàn nhân vật (render 3D trực giao, thước cm — scripts/bo-set/bang-ti-le.sh): gửi kèm keyframe có ≥ 2 nhân vật / đạo cụ */
  bang_ti_le?: string;
  /** Keyframe SỬA TỪ ẢNH 3D (img2img / restyle): ảnh màu 3D là ảnh gốc, model chỉ vẽ lại bề mặt — mặc định bật khi shot có khung màu 3D */
  keyframe_sua_3d?: boolean;
  /** Keyframe HAI BƯỚC: FLUX depth từ độ sâu 3D (khoá góc máy) → sửa nhân dạng bằng ảnh mẫu — mặc định bật khi khung 3D có ảnh độ sâu */
  keyframe_hai_buoc?: boolean;
  ngon_ngu?: string;            // ngôn ngữ lời thoại/phụ đề: 'vi' | 'en'
  the_loai?: TheLoai | '';      // thể loại → thư viện điện ảnh gợi ý kỹ thuật hợp (kinh dị ≠ hài ≠ QC UGC)
  logline?: string;             // một câu: ai, muốn gì, cản trở gì
  chu_de?: string;              // điều bộ phim muốn nói (theme)
  qc?: ThongTinQc;              // phim quảng cáo: sản phẩm/dịch vụ — AI mọi bước dựa vào đây (#1201)
  /** Giọng LỜI DẪN của cả phim — khoá ở lượt sinh giọng lời dẫn đầu tiên, mọi câu sau đọc cùng giọng (10/10/2026: phim #5 lời dẫn
   *  rơi về giọng mặc định George nam trong khi QC mẫu là giọng nữ). Phim có QC mẫu mà chưa chọn → không sinh giọng lời dẫn. */
  giong_dan?: { model: string; voice: string } | null;
  /** KINH THÁNH SERIES (13/10/2026): phim là một series nhiều tập — câu động cơ (mỗi tập cùng kiểu xung đột, tình huống mới) + danh sách
   *  tập với logline từng tập. Claude viết tập mới bám vào đây và không lặp tập cũ; máy chấm kịch bản chặn tập thiếu logline/nhịp (cham-kich-ban.ts). */
  series?: Series | null;
  /** bản lưu trữ (thử xong, không dùng): ẩn khỏi danh sách phim mặc định, không xoá (nhom-phim.ts). */
  luu_tru?: boolean;
  /** nhịp stop-motion: bản xuất giữ mỗi hình hai nhịp (12 hình/giây) — chuyển động AI mượt quá trông như quay stop-motion thật (Tango & Lint) */
  nhip_stop_motion?: boolean;
  /** phim KHÔNG LỜI (kiểu Larva): không thoại; nhân vật chỉ phát âm hiệu riêng; truyện kể bằng hành động + âm thanh (claude.ts › heThong) */
  khong_loi?: boolean;
  /** BẢN ĐỒ KHÔNG GIAN (14/10/2026 — "thiếu đoạn dẫn từ không gian tới nơi xảy ra, như Larva"): các nơi chốn (tên đúng anchor Bối cảnh)
   *  nằm đâu trong thế giới, cạnh nhau thế nào, đường đi từ nơi này sang nơi kia. Tách cảnh dựa vào đây để dựng chuỗi shot dẫn rộng → hẹp
   *  và shot hành trình khi đổi nơi (claude.ts › heThong, luật kể chuyện 12). */
  ban_do?: string;
  /** TEMPLATE (14/10/2026 — anh: "template phải cho phép edit"): phim này là KHUÔN để nhân ra phim khác. Mọi chữ của phim (kinh thánh, anchor,
   *  tập, shot: chữ màn, lời, prompt…) được chứa ô {{ten_o}}; "Tạo phim từ template" chép cả phim rồi điền ô (template.ts). Sửa template =
   *  sửa như phim thường. `o` = nhãn + gợi ý + giá trị mẫu của từng ô (ô nào gõ trong chữ mà chưa khai vẫn hiện, nhãn = tên ô). */
  template?: CauHinhTemplate | null;
  /** phim sinh ra từ template nào, với giá trị ô nào (mã gen cho đo đơn về sau) */
  tu_template?: { id: number; ten: string; gia_tri: Record<string, string>; /** nguồn tham khảo theo ô (tham-khao.ts) */ tham_khao?: Record<string, import('./tham-khao').NguonThamKhao[]>; luc: string } | null;
};
/** nhom: nhóm trong form điền (template.ts › NHOM_O) — thiếu thì máy đoán theo tên ô */
export type OTemplate = { ten: string; goi_y?: string; mau?: string; dai?: boolean; nhom?: string };
/** thu_tu: thứ tự ô trong form — MẢNG vì jsonb không giữ thứ tự khoá của object (o đọc ra bị xáo theo độ dài tên khoá) */
/** MẪU QC THẮNG của template (anh 15/10/2026: "template phải ghi đầy đủ nguồn tham khảo để coi như ví dụ, đính kèm video thực tế"):
 *  QC thật trong kho spy (ma = library_id) — video / ảnh đã lưu lên R2 (scripts/luu-mau-qc.mts), mo_ta = học gì từ nó. */
export type MauQcTemplate = { ma: string; page: string; x: number; ngay: number; link: string; mo_ta: string; video?: string | null; anh?: string | null; to?: string | null; giay?: number };
/** DÒNG → KHUÔN → template (anh 15/10/2026: "kiểu thương hiệu có nhiều template — bố trí lại danh sách" · "kể cả UGC cũng có nhiều khuôn").
 *  Kho xếp theo dòng, trong dòng theo khuôn; khuôn chưa có template vẫn hiện (biết còn thiếu gì). */
export const DONG_TEMPLATE = [
  { key: 'ugc', ten: '📱 UGC — người thật quay điện thoại', mo_ta: 'Như khách thật: cầm máy, ánh sáng nhà, nói thẳng camera. Hợp sản phẩm cần lòng tin.', khuon: [
    { key: 'ke_chuyen', ten: 'Kể chuyện tình huống' }, { key: 'review', ten: 'Review / nói thẳng camera' }, { key: 'demo', ten: 'Demo / tính năng' },
    { key: 'so_sanh', ten: 'So sánh / trước – sau' }, { key: 'uu_dai', ten: 'Ưu đãi mở đầu' }, { key: 'pov', ten: 'POV / thử đồ' },
    { key: 'haul', ten: 'Haul / mở hộp' }, { key: 'phan_hoi', ten: 'Trả lời bình luận' }, { key: 'ngan', ten: 'Nhịp nhanh ≤ 15s' },
  ] },
  { key: 'thuong_hieu', ten: '✨ Thương hiệu — studio, ghép nền, đồ hoạ', mo_ta: 'Hình sạch có chủ đích: sản phẩm / người mẫu trên nền studio, ghép nền, chữ đồ hoạ, cắt theo nhịp nhạc. Hợp sản phẩm cần thấy đẹp, nhiều màu, nhiều nơi dùng.', khuon: [
    { key: 'doi_nen', ten: 'Một dáng, mọi nơi (ghép nền)' }, { key: 'studio', ten: 'Sản phẩm studio + chú thích tính năng' }, { key: 'lookbook', ten: 'Lookbook nhiều màu' },
    { key: 'chu_dong', ten: 'Chữ động (kinetic type)' }, { key: 'chia_doi', ten: 'Chia đôi trước / sau đồ hoạ' }, { key: 'mo_hop', ten: 'Mở hộp tối giản' },
  ] },
  { key: 'anh_that', ten: '🖼 Ảnh thật — không video AI', mo_ta: 'Dựng từ ảnh thật của shop, rẻ và nhanh nhất.', khuon: [{ key: 'slideshow', ten: 'Slideshow ảnh thật' }] },
] as const;
export type DongTemplate = (typeof DONG_TEMPLATE)[number]['key'];
export type CauHinhTemplate = { mo_ta?: string; o?: Record<string, OTemplate>; thu_tu?: string[]; mau_qc?: MauQcTemplate[]; dong?: DongTemplate; khuon?: string };
/** Một tập trong BẢN ĐỒ series (chưa chắc đã có xv_tap): số thứ tự toàn series, mùa, loại, nhân vật, gài/trả (claude.ts › vietMuaPhim). */
export type TapBanDo = { so: number; ten: string; logline: string; mua?: number; loai?: 'phieu_luu' | 'nguon_goc' | 'ket_mua'; nhan_vat?: string[]; boi_canh?: string[]; gai_tra?: string };
export type MuaSeries = { so: number; ten: string; dong_co?: string; ghi_chu?: string };
/** THAM CHIẾU của series (14/10/2026 — anh: "trước khi sinh key phải có hết"): tác phẩm mẫu + chuẩn đo được rút ra từ nó; hồ sơ tập đo theo đây. */
export type ThamChieuSeries = { tac_pham: string; do_dai_s: number; gag_moi_phut: number; rut_ra: string[] };
/** KHUÔN NHẬN DIỆN series: intro dùng chung, thẻ tựa, thẻ kết, câu nhạc chủ đề — tập nào cũng mang. */
export type KhuonSeries = { intro: string; the_tua: string; the_ket: string; nhac_chu_de: string };
export type Series = { tham_chieu?: ThamChieuSeries; khuon?: KhuonSeries; /** tên series — gom các bản (bút chì, sáp màu…) trên danh sách phim */ ten?: string; dong_co: string; khan_gia: string; dinh_dang: string; tap: TapBanDo[];
  /** các mùa (sơ đồ series): tên + động cơ riêng; tập thuộc mùa theo TapBanDo.mua (thiếu = mùa 1) */ mua?: MuaSeries[] };
/** Sơ đồ series: mỗi mùa kèm các tập của nó (tập không ghi mùa = mùa 1). Mùa khai mà chưa có tập vẫn hiện (đang lên ý). */
export function muaSeries(s: Series | null | undefined): (MuaSeries & { tap: TapBanDo[] })[] {
  if (!s) return [];
  const so = [...new Set([...(s.mua ?? []).map((m) => m.so), ...(s.tap ?? []).map((t) => t.mua ?? 1)])].sort((a, b) => a - b);
  return so.map((n) => ({ ...(s.mua?.find((m) => m.so === n) ?? { so: n, ten: `Mùa ${n}` }), tap: (s.tap ?? []).filter((t) => (t.mua ?? 1) === n).sort((a, b) => a.so - b.so) }));
}
/** Thông tin sản phẩm / dịch vụ của phim quảng cáo. */
/** QC MẪU (anh 09/10/2026: "sinh ra một QC gần giống nhất với mẫu này"): một quảng cáo đang bán tốt (của mình hay đối thủ) làm KHUÔN —
 *  Claude tách cảnh bám 1:1 (cùng số shot, cùng giây, cùng vị trí/ý chữ màn, cùng loại shot), chỉ đổi sản phẩm + lợi ích thật.
 *  `shots` = xương sống của mẫu theo thời gian; điền tay hoặc bấm "Phân tích video mẫu" (Claude nhìn khung hình). Dùng cho MỌI sản phẩm. */
export type LoaiShotMau = 'hook' | 'uu_dai' | 'noi_dau' | 'giai_phap' | 'tinh_nang' | 'demo' | 'so_sanh' | 'bang_chung' | 'tran_an' | 'cta' | 'end_card' | 'khac';
export const LOAI_SHOT_MAU: { key: LoaiShotMau; ten: string; mo: string }[] = [
  { key: 'hook', ten: 'Hook', mo: 'giây đầu giữ tay' }, { key: 'uu_dai', ten: 'Ưu đãi', mo: 'giá, giảm, mua 1 tặng…' }, { key: 'noi_dau', ten: 'Nỗi đau', mo: 'vấn đề người xem đang gặp' },
  { key: 'giai_phap', ten: 'Giải pháp', mo: 'sản phẩm xuất hiện' }, { key: 'tinh_nang', ten: 'Tính năng', mo: 'một lợi ích, thấy bằng hình' }, { key: 'demo', ten: 'Demo', mo: 'dùng thử, cận chi tiết' },
  { key: 'so_sanh', ten: 'So sánh', mo: 'trước/sau, hơn hàng thường' }, { key: 'bang_chung', ten: 'Bằng chứng', mo: 'người thật, bình luận, số liệu' }, { key: 'tran_an', ten: 'Trấn an', mo: 'đổi trả, size, bảo hành' },
  { key: 'cta', ten: 'CTA', mo: 'kêu gọi hành động' }, { key: 'end_card', ten: 'End card', mo: 'màn cuối: sản phẩm + ưu đãi + nút' }, { key: 'khac', ten: 'Khác', mo: '' },
];
/** Tên hiện của một phân cảnh: QC dùng mã loại shot (hook, noi_dau, cta…) làm phan_doan → hiện "Hook", "Nỗi đau", "CTA"; phim truyện đặt tên riêng thì giữ nguyên. */
export const tenPhanDoan = (k: string): string => LOAI_SHOT_MAU.find((l) => l.key === k)?.ten ?? k;
export type ShotMau = { giay: number; loai: LoaiShotMau; chu_man: string; hinh: string };
export type MauQc = { nguon: string; video_url: string; chu_bai: string; tieu_de: string; cta: string; ghi_chu: string; shots: ShotMau[] };
export const MAU_TRONG: MauQc = { nguon: '', video_url: '', chu_bai: '', tieu_de: '', cta: '', ghi_chu: '', shots: [] };
export const giayMau = (m: MauQc | null | undefined): number => Math.round((m?.shots ?? []).reduce((a, s) => a + (Number(s.giay) || 0), 0) * 2) / 2;
export const coMau = (q: ThongTinQc | null | undefined): boolean => !!q?.mau?.shots?.length;
/** Vị trí khối chữ màn trên hình khi xuất: trên (1/6 màn, mặc định cũ) · giữa · dưới (≈62%, kiểu QC UGC — mắt đang nhìn người thì đọc được chữ). */
export type ViTriChu = 'tren' | 'giua' | 'duoi';
/** Kiểu chữ màn khi xuất — chép theo QC mẫu (10/10/2026: mẫu Jett chữ xanh viền trắng, số vàng, giữa màn). font = tên họ font trong
 *  assets/fonts (Montserrat Black/ExtraBold) hoặc DejaVu Sans; màu #RRGGBB; nhan = màu riêng cho số, '?', '$', '%'; co = cỡ chữ / bề ngang. */
export type KieuChu = { font?: string; mau?: string; vien?: string; nhan?: string; co?: number; vien_day?: number; ngang?: number;
  /** y = tâm dọc của khối chữ theo tỉ lệ chiều cao (0–1), đè vi_tri_chu; nen = màu băng nền sau chữ (kiểu nhãn "Every senior loves these!"). */
  y?: number; nen?: string;
  /** hiệu ứng vào của MỖI câu chữ màn: 'bat' = nảy lên (pop) · 'dap' = lao vào từ to + mờ rồi đập về cỡ thật (trailer). Trống = hiện thẳng. */
  vao?: '' | 'bat' | 'dap';
  /** tối đa bao nhiêu TỪ mỗi khung chữ: câu dài tự cắt thành cụm hiện lần lượt trong shot (ngat-dong.ts › chiaCum). Trống/0 = cả câu một lượt. */
  tu?: number };
/** ngang = độ rộng chữ % (ASS ScaleX; <100 = chữ hẹp như font QC mẫu). co = cỡ chữ ASS / bề ngang (ASS tính theo chiều cao dòng → chữ nhỏ hơn cùng số px của drawtext). */
export const KIEU_CHU_MAC_DINH = { font: 'DejaVu Sans', mau: '#FFFFFF', vien: '#000000', nhan: '', co: 0.062, vien_day: 0.07, ngang: 100, vao: '' as '' | 'bat' | 'dap' };
/** Gộp kiểu chữ màn: mặc định ← phim ← shot (giá trị rỗng không đè). MỘT hàm cho bản xuất (xuat.ts › tepAss) và ô xem trước (chu-man.tsx).
 *  Phim CHƯA chọn kiểu chữ → chữ trắng trên băng nền tối: viền mỏng chìm hẳn trên nền giấy sáng của phim vẽ (Fox Tales 13/10/2026,
 *  "nền chữ trắng không đọc được"). Phim đã chọn kiểu (QC chép từ mẫu) giữ nguyên kiểu của nó. */
export const NEN_CHU_MAC_DINH = '#000000';
export function gopKieu(phim?: KieuChu | null, shot?: KieuChu | null): typeof KIEU_CHU_MAC_DINH & { y?: number; nen?: string; tu?: number } {
  const sach = (d?: KieuChu | null) => Object.fromEntries(Object.entries(d ?? {}).filter(([, v]) => v !== '' && v != null));
  const p = sach(phim);
  return Object.assign({}, KIEU_CHU_MAC_DINH, Object.keys(p).length ? {} : { nen: NEN_CHU_MAC_DINH }, p, sach(shot));
}
export const VAO_CHU: { key: '' | 'bat' | 'dap'; ten: string }[] = [{ key: '', ten: 'Hiện thẳng' }, { key: 'bat', ten: 'Nảy (pop)' }, { key: 'dap', ten: 'Đập (trailer)' }];
/** Đoạn ASS mở đầu mỗi câu theo hiệu ứng vào — CÙNG thời lượng với CSS xem trước (xv.css › xv-chu-bat / xv-chu-dap). */
export function assVaoChu(vao: string | undefined, ngang: number): string {
  if (vao === 'dap') return `\\fscx${Math.round(ngang * 2.2)}\\fscy220\\blur10\\alpha&H70&\\t(0,140,\\fscx${ngang}\\fscy100\\blur0\\alpha&H00&)`;
  if (vao === 'bat') return `\\fscx${Math.round(ngang * 0.6)}\\fscy60\\t(0,120,\\fscx${Math.round(ngang * 1.08)}\\fscy108)\\t(120,200,\\fscx${ngang}\\fscy100)`;
  return '';
}
export const FONT_CHU: { key: string; ten: string }[] = [{ key: 'DejaVu Sans', ten: 'DejaVu Sans Bold (mặc định)' }, { key: 'Montserrat Black', ten: 'Montserrat Black' }, { key: 'Montserrat ExtraBold', ten: 'Montserrat ExtraBold' }, { key: 'Playfair Display Black', ten: 'Playfair Display Black (serif, thương hiệu Astrolas)' }];
export const VI_TRI_CHU: { key: ViTriChu; ten: string }[] = [{ key: 'tren', ten: 'Trên' }, { key: 'giua', ten: 'Giữa' }, { key: 'duoi', ten: 'Dưới' }];
export type ThongTinQc = {
  ten: string; link: string; diem_noi_bat: string; doi_tuong: string; uu_dai: string; thi_truong: string; anh: string[];
  /** QC mẫu làm khuôn (tuỳ chọn). logo_url = logo chèn góc trên phải khi xuất. vi_tri_chu = chỗ đặt chữ màn. */
  mau?: MauQc; logo_url?: string; vi_tri_chu?: ViTriChu; kieu_chu?: KieuChu;
  /** kiểu CTA đang dùng (thư viện CTA — cta.ts, mau/cta.json) */ cta?: string;
};
export const QC_TRONG: ThongTinQc = { ten: '', link: '', diem_noi_bat: '', doi_tuong: '', uu_dai: '', thi_truong: '', anh: [] };
/** Bài đăng đi kèm video trên Meta/TikTok (văn bản chính · tiêu đề · mô tả · nút) — Claude viết theo QC mẫu, lưu ở tập. */
export type BaiDang = { chu_bai: string; tieu_de: string; mo_ta: string; cta: string; luc: string };
/** Ngôn ngữ lời thoại/chữ màn/bài đăng của phim — MỘT sổ cho form kinh thánh, prompt Claude và nút 🌐 Dịch tập. */
export const NGON_NGU: { value: string; label: string; ten: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', ten: 'tiếng Việt' }, { value: 'en', label: 'English', ten: 'English (US)' }, { value: 'es', label: 'Español', ten: 'Spanish' },
  { value: 'pt', label: 'Português', ten: 'Portuguese (Brazil)' }, { value: 'de', label: 'Deutsch', ten: 'German' }, { value: 'fr', label: 'Français', ten: 'French' }, { value: 'ja', label: '日本語', ten: 'Japanese' },
];
export const tenNgonNgu = (ma?: string): string => NGON_NGU.find((x) => x.value === ma)?.ten ?? ma ?? 'tiếng Việt';
/** Bỏ mọi câu có lời thoại trong ngoặc kép + nhãn ngôn ngữ khỏi prompt video: Claude nhét thoại (đúng ngôn ngữ lúc tách) vào prompt_video,
 *  Veo in nó thành phụ đề giả và đọc sai ngôn ngữ sau khi dịch (thử 2 shot 09/10/2026). Thoại thật ghép lại từ c.thoai ở batDauVideoCanh. */
export function boThoaiTrongPrompt(p: string): string {
  // Tách câu bằng máy trạng thái: dấu chấm TRONG ngoặc kép không kết câu; ngoặc đóng sau một câu đã có dấu chấm thì kết câu ngay
  // ("… pride: "Chưa tới ba lăm đô." Keep both…" → bỏ đúng câu thoại, giữ "Keep both…").
  const cau: string[] = []; let cur = ''; let trong = false; let truoc = '';
  for (const ch of p) {
    cur += ch;
    if (ch === '"' || ch === '“' || ch === '”') {
      trong = !trong;
      if (!trong && /[.!?]/.test(truoc)) { cau.push(cur); cur = ''; }
    } else if (!trong && /[.!?\n]/.test(ch)) { cau.push(cur); cur = ''; }
    truoc = ch;
  }
  if (cur.trim()) cau.push(cur);
  return cau.filter((c) => !/["“”]/.test(c)).join('').replace(/\((?:Vietnamese|English|Spanish|Portuguese|German|French|Japanese|tiếng Việt|tiếng Anh)[^)]*\)/gi, ' ').replace(/\s{2,}/g, ' ').trim();
}
/** Chữ có ký tự riêng của tiếng Việt (ă â đ ê ô ơ ư + dấu thanh)? Dùng để bắt chữ màn/thoại tiếng Việt lọt vào phim ngôn ngữ khác (09/10/2026: phim EN ra chữ VI, keyframe vẫn chạy). */
/** Tiếng Việt khi có (a) chữ RIÊNG của tiếng Việt: ă â đ ê ô ơ ư hoặc nguyên âm mang dấu hỏi / ngã / nặng (kể cả chồng dấu), hoặc (b) một tiếng
 *  ngắn ≤3 chữ cái mang dấu sắc/huyền (bà, cá, là, nhà). Từ mượn trong tiếng Anh có é/á dài hơn (café, résumé, cliché) → không tính:
 *  12/10/2026 bối cảnh "Café" bị chặn oan ở cổng ngôn ngữ. */
const VIET_RIENG = /[ăâđêôơưĂÂĐÊÔƠƯảãạẻẽẹỉĩịỏõọủũụỷỹỵỳẢÃẠẺẼẸỈĨỊỎÕỌỦŨỤỶỸỴỲằắẳẵặầấẩẫậềếểễệồốổỗộờớởỡợừứửữựẰẮẲẴẶẦẤẨẪẬỀẾỂỄỆỒỐỔỖỘỜỚỞỠỢỪỨỬỮỰ]/;
const TIENG_NGAN_DAU = /(^|[^\p{L}])(?=\p{L}{1,3}(?![\p{L}]))\p{L}*[àáèéìíòóùúýÀÁÈÉÌÍÒÓÙÚÝ]/u;
export const coTiengViet = (s: string): boolean => VIET_RIENG.test(s) || TIENG_NGAN_DAU.test(s);
/** Mọi chữ của một shot (nhãn, góc máy, hành động, âm thanh, phân đoạn, trang phục, prompt, chữ màn, thoại kể cả diễn xuất + người nói). */
type ShotChu = Pick<Canh, 'thu_tu' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'canh' | 'goc_may' | 'hanh_dong' | 'am_thanh' | 'phan_doan' | 'trang_phuc' | 'prompt_anh' | 'prompt_video' | 'dan_dung'>>;
/** Chữ của shot ĐI VÀO MODEL hoặc TỚI KHÁN GIẢ: chữ màn, lời + diễn xuất, prompt ảnh/video, trang phục, mô tả âm thanh; hành động chỉ khi
 *  shot chưa có prompt video (lúc đó hành động thay prompt). Nhãn cảnh, góc máy, phân đoạn là ghi chú nội bộ — luật tách cảnh bảo viết tiếng
 *  Việt — không tính (14/10/2026: tập 1 Tango & Lint bị chặn keyframe vì chính những ghi chú đó). */
const chuShot = (c: ShotChu): string => [c.chu_man, c.prompt_video?.trim() ? '' : c.hanh_dong, c.am_thanh, c.trang_phuc, c.prompt_anh, c.prompt_video,
  ...O_DAN_DUNG.filter((o) => o.vaoModel).map((o) => c.dan_dung?.[o.key] ?? ''),
  ...(c.thoai?.length ? c.thoai.flatMap((d) => [d.loi, d.dien_xuat, d.nhan_vat]) : [c.loi_thoai])].filter(Boolean).join(' ');
/** Những shot còn BẤT KỲ chữ tiếng Việt nào khi phim không phải tiếng Việt (phim 'vi' không kiểm: chữ Anh xen là bình thường). */
export const shotLechNgonNgu = (ngonNgu: string | undefined, canh: ShotChu[]): number[] =>
  !ngonNgu || ngonNgu === 'vi' ? [] : canh.filter((c) => coTiengViet(chuShot(c))).map((c) => c.thu_tu);
/** Cổng trước mọi lượt sinh tốn tiền (ảnh/video/giọng): chữ SẼ ĐI VÀO model còn tiếng Việt khi phim không phải tiếng Việt → trả câu lỗi.
 *  09/10/2026: phong cách + mô tả anchor tiếng Việt ghép vào prompt → Veo in phụ đề Việt giả lên clip ($0,40 bỏ đi). */
/** Phong cách phim CHO MODEL ẢNH/VIDEO: bỏ mọi vế nói về chữ/phụ đề/logo/font. Chữ màn do xưởng vẽ lúc xuất; để vế đó vào prompt là bảo
 *  model tự vẽ chữ ("white text with black outline overlaid…" → Veo/Seedream in phụ đề giả, 09/10/2026). Claude vẫn đọc bản đầy đủ. */
export const phongCachHinh = (pc?: string): string =>
  (pc ?? '').split(/(?<=[;.])\s+/).filter((v) => !/\b(text|texts|caption|captions|subtitle|subtitles|overlay|overlaid|logo|font|lettering|typography)\b|chữ|phụ đề|font/i.test(v)).join(' ').replace(/[;,]\s*$/, '').trim();
/** Phong cách VẼ TAY (sáp màu, bút chì, màu nước, phấn, mực…): model video hiểu thành cảnh "có người đang vẽ" — Fox Tales 13/10/2026: bàn tay
 *  cầm bút sáp thò vào khung shot 1. Trả câu cấm gắn vào prompt video; phong cách khác trả ''. */
/** coTay = shot có nhân vật LÀ bàn tay người (anchor tả "human hand", vd Gã khổng lồ của Tango & Lint) → không cấm bàn tay. */
/** STOP-MOTION / miniature thật (Tango & Lint 14/10/2026: keyframe #23 có bàn tay người thò vào; phong cách có chữ "paper" nên trước đây
 *  rơi nhầm vào nhánh tranh vẽ → câu cấm "NO table or desk" giết luôn cái bàn là thế giới của phim). Lỗi kinh điển của stop-motion là tay
 *  người làm hoạt hình lọt khung → chỉ cấm tay/người, không cấm đạo cụ hay mặt bàn. Kiểm TRƯỚC nhánh tranh vẽ. */
const laStopMotion = (pc?: string) => /stop[- ]?motion|claymation|miniature|puppet|tí hon|đất sét/i.test(pc ?? '');
export const camCongCuVe = (pc?: string, coTay = false): string =>
  !coTay && laStopMotion(pc)
    ? 'NO human hands, fingers, arms or people anywhere in the frame — no animator\'s hand reaching in; only the puppet characters and the set.'
    : !coTay && /crayon|pencil|sketch|watercolou?r|chalk|pastel|doodle|scribbl|ink\b|marker|hand-drawn|hand drawn|drawn|paper|sáp|bút chì|màu nước|phấn|vẽ/i.test(pc ?? '')
    ? 'This is an animated illustration: the drawn characters and scenery themselves move. NO human hands, NO crayons, pencils, brushes, scissors, glue or any drawing / crafting tools, NO artist, NO table or desk and NO border of a sheet of paper ever appear in the frame (the frame IS the illustration, not a photo of it); nothing is being drawn or cut on screen.'
    : '';
/** Negative prompt cho model video có ô riêng (Veo / Kling): liệt kê DANH TỪ cần loại, không viết "no …" (hướng dẫn prompt Veo của Google). */
export const laTayNguoi = (nv: { mo_ta: string }[]): boolean => nv.some((v) => /\bhuman hand\b/i.test(v.mo_ta));
export const loaiCongCuVe = (pc?: string, coTay = false): string => (coTay ? '' : laStopMotion(pc) ? 'human hand, fingers, arm, person, animator hand' : camCongCuVe(pc, coTay) ? 'human hand, artist hand, fingers, crayon, pencil, brush, marker, scissors, glue, drawing tool, paper being drawn on, artist' : '');
export function chanChuModel(ngonNgu: string | undefined, o: { phongCach?: string; shot?: Partial<ShotChu>; anchor?: Pick<NhanVat, 'ten' | 'mo_ta'>[] }): string | null {
  if (!ngonNgu || ngonNgu === 'vi') return null;
  const cho: string[] = [];
  if (o.phongCach && coTiengViet(o.phongCach)) cho.push('phong cách phim');
  if (o.shot && coTiengViet(chuShot({ thu_tu: 0, chu_man: '', thoai: [], loi_thoai: '', ...o.shot }))) cho.push(`shot${o.shot.thu_tu ? ` #${o.shot.thu_tu}` : ''}`);
  for (const a of o.anchor ?? []) if (coTiengViet(`${a.ten} ${a.mo_ta}`)) cho.push(`anchor "${a.ten}"`);
  return cho.length ? `Phim ${tenNgonNgu(ngonNgu)} nhưng chữ đi vào model còn tiếng Việt (${cho.slice(0, 5).join(', ')}${cho.length > 5 ? '…' : ''}) — bấm 🌐 Dịch cả phim trước, không sinh để khỏi mất tiền.` : null;
}
export const KINH_THANH_MAC_DINH: Required<KinhThanh> = {
  phong_cach: '', ti_le: '9:16', do_phan_giai: '720p',
  mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: 'veo-3.1-lite-generate-preview', mo_hinh_chu: 'claude-opus-5-5', ngon_ngu: 'vi', the_loai: '', logline: '', chu_de: '', qc: { ten: '', link: '', diem_noi_bat: '', doi_tuong: '', uu_dai: '', thi_truong: '', anh: [] },
  giong_dan: null, series: null, luu_tru: false, nhip_stop_motion: false, khong_loi: false, ban_do: '', template: null, tu_template: null, bang_ti_le: '', keyframe_sua_3d: true, keyframe_hai_buoc: true,
};
export const docKinhThanh = (kt: KinhThanh | null | undefined): Required<KinhThanh> => ({ ...KINH_THANH_MAC_DINH, ...(kt ?? {}) });

export type Phim = {
  id: number; project: string; ten: string; loai: LoaiPhim; mo_ta: string; kinh_thanh: KinhThanh; trang_thai: string;
  so_tap: number; so_nhan_vat: number; so_canh: number; chi_phi_cents: number; updated_at: string;
  /** tóm tắt từng tập cho danh sách phim: số shot · có hình · có clip */
  tap_tom?: { id: number; so: number; ten: string; so_canh: number; so_hinh: number; so_clip: number }[];
  /** keyframe sửa gần nhất của phim — ảnh đại diện trên danh sách khi chưa có poster (nhom-phim.ts › anhDaiDien) */
  anh_dai_dien?: string | null;
  /** ảnh QC (anh-qc.ts) chưa ẩn: số thẻ + bản đang dùng của thẻ đã sinh — danh sách phim hiện cạnh video của cùng sản phẩm */
  so_anh_qc?: number; anh_qc_tom?: { id: number; url: string; ti_le: string }[];
  /** góc bán spy.on.tc phim QC này khai thác (goc-spy.ts, cột riêng — form kinh thánh không ghi đè được) */
  goc_spy?: import('./goc-spy').GocSpy[];
  /** poster đang dùng + mọi bản đã sinh (poster.ts) */
  poster_url?: string | null; poster_uv?: string[];
};
export type BienThe = { id: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string; anh_url: string | null };
/** Claude nhìn ảnh gốc của anchor so với mô tả: lệch chỗ nào (màu, ren, khoá, chữ thương hiệu…) + mô tả viết lại theo ảnh. */
export type DoiChieu = { khop: boolean; lech: string[]; mo_ta_de_xuat: string; luc: string };
/** BỘ SET 3D (bo-set-3d.ts): bối cảnh là DỮ LIỆU toạ độ cm — gốc giữa mép trước, x phải, y vào sâu, z lên. Một set dùng cho nhiều phim của dự án. */
export type KhoiSet = { ten: string; hinh: 'hop' | 'cau' | 'trung' | 'vom' | 'day' | 'non' | 'khan'; /** nón cụt: đỉnh = đáy × dinh (0..1) */ dinh?: number; tam?: number[]; co?: number[]; mau: string; xoay?: number; /** nghiêng quanh trục x của khối (độ, nắp laptop) */ nghieng?: number; sang?: number; diem?: number[][]; ban_kinh?: number };
export type VatSet = (KhoiSet | { ten: string; goc: number[]; xoay?: number; phan: Omit<KhoiSet, 'ten'>[] }) & { anchor?: string; /** mặt nền (mặt bàn, tường, kệ): ở đâu cũng có, không tính là vật chắn tiền cảnh */ nen?: boolean; /** đồ TUỲ CHỌN (laptop lúc có lúc không): chỉ có ở shot khai may_3d.them */ tuy_chon?: boolean; /** tên tiếng Anh gửi mô hình ảnh (tên tiếng Việt như 'Mặt bàn') */ en?: string };
export type BoSet = { id: number; project: string; phim_id: number | null; ten: string; mo_ta: string; du_lieu: { vat: VatSet[]; ghi_chu?: string }; mat_bang_url: string | null; trang_thai: string };
/** Máy ảo + chỗ đứng nhân vật của một shot trong bộ set (cm): đầu vào dựng khung xám. nam = nằm sấp. */
export type May3d = { dat: number[]; nhin: number[]; ong_kinh: number; /** máy do datMayTuDong tính (phía ° quanh chủ thể) — bộ giải trong Blender được phép xoay / nâng / lùi máy cho chủ thể thấy rõ */ tu_dong?: { phia?: number; /** mã đầu vào lúc tính (chỗ đứng + phía + khung + cỡ/góc/ống) — nạp lại mà khớp thì GIỮ máy bộ giải đã tìm */ vao?: string };
  /** CỐ Ý vượt trục (POV chủ quan, cú lật trục có chủ đích): không kiểm trục shot này; shot sau so với shot thường gần nhất */ qua_truc?: boolean;
  /** CHỦ THỂ của khung: phải trong khung + không bị che (mặc định: hai vị trí đầu không 'an') */ khung?: string[]; vi_tri: { ten: string; /** chỗ ở lúc MỞ shot (cm) — khung xám dựng ở đây */ tam: number[]; /** chỗ ở lúc KẾT shot (đi / lăn / bay trong shot); không ghi = đứng yên */ den?: number[];
    /** hướng mặt lúc mở / kết (độ, 0 = nhìn về phía người ngồi −y, 90 = nhìn sang phải +x) — mắt khối 3D quay theo */ huong?: number; huong_den?: number;
    /** TRẠNG THÁI NHÂN VẬT lúc mở / kết (sổ script supervisor — tiếng Anh cho prompt: 'frizzed stiff with static', 'soaking wet'); trống = bình thường.
     *  lienMachTap chặn shot sau mở khác trạng thái shot trước để lại; prompt STATE đè lên ảnh mẫu. */ trang?: string; trang_den?: string;
    /** đang được nhân vật này CẦM (kẹo trong tay Tango): đi theo người cầm, không kiểm chỗ riêng */ cam?: string;
    /** món RỜI KHỎI bộ set sau shot này (bị lấy đi / mang ra ngoài) — không còn tự đặt lại ở các shot sau */ het?: boolean;
    /** (máy tự thêm) đạo cụ ĐỂ LẠI từ shot trước, đặt đúng chỗ cuối cùng nó được thấy — bo-set-3d.ts › mayDayDu */ de_lai?: boolean;
    /** CỐ Ý xuất hiện ở chỗ khác lần cuối thấy (đi ngoài khung) — ghi lý do; chỉ miễn kiểm cho món này */ nhay?: string;
    /** nhân vật này TÁC ĐỘNG lên món nào trong shot (chạm, ấn, chà, cầm lên) — tên vật của set hoặc chỗ đứng khác. Cổng chuỗi chú ý
     *  (bo-set-3d.ts › chuoiChuY): trước đó phải có shot nó NHÌN món đó + shot cho THẤY món đó */ lam?: string;
    /** món đã bị CHIA thành bấy nhiêu mảnh (kẹo bẻ đôi = 2): Blender dựng từng mảnh, đang cầm thì chỉ mảnh của người cầm; một khi đã chia thì
     *  shot sau không được nguyên lại (bo-set-3d.ts › lienMachTap) — và tự mang theo khi món bị để lại (mayDayDu) */ chia?: number;
    /** ĐIỂM tác động trên món đó (cm) khi món lớn (dấu tay ở góc trước đế cắm, không phải tâm đế cắm) — cổng đo hướng nhìn tới điểm này */ lam_o?: number[];
    nam?: boolean; /** dáng lúc KẾT (bẹp / nằm) khác lúc mở — khung màu kết vẽ theo */ nam_den?: boolean; /** kịch bản CỐ Ý cho vật khác che (vd nấp sau chuột) — kiểm không báo bị che */ an?: boolean }[];
  /** CỐ Ý ĐỨT MẠCH ở cú cắt vào shot này (thời gian trôi / dịch chuyển ngoài khung) — ghi lý do; không ghi thì mọi nhân vật phải mở đúng chỗ
   *  lần cuối thấy nó kết (bo-set-3d.ts › lienMachTap) */ nhay?: string;
  /** đồ TUỲ CHỌN của bộ set có mặt ở shot này (vd ['MacBook Pro']) — không khai = vắng */ them?: string[];
  /** đèn bàn BẬT ở khung đầu shot (khung màu: ánh vàng ấm); không khai = tắt, chỉ ánh xanh màn hình */ den_ban?: boolean };
/** Kết quả dựng khung xám (đầu ra): ma = mã đầu vào (set + máy + vị trí + khối) — đầu vào đổi là hết hiệu lực. */
export type KhungXam = { ma: string; /** khung màu GIỮA shot (t = 0,5) — khung khoá thứ ba cho video nhiều khung */ mau_giua?: string; /** mã từng phần đầu vào (ban / set / may / khoi) — biết vì sao khung cũ */ ma_phan?: Record<string, string>; /** ảnh khung để hiện (khung màu nếu có, không thì khung xám) */ xam: string; /** (cũ) bản đồ độ sâu — đã bỏ */ sau?: string; /** KHUNG MÀU (previs có vật liệu + ánh sáng, EEVEE) — ảnh tham chiếu số 1 của keyframe khi có */ mau?: string;
  /** khung màu ở chỗ KẾT (shot có di chuyển / quay) — ảnh số 1 của keyframe kết */ mau_ket?: string;
  /** chuyển động trên màn: chỗ mở → chỗ kết của từng món (0..1, gốc trên-trái) — câu chuyển động cho video sinh từ đây */ di?: { ten: string; tu: number[]; den: number[] }[]; luc: string; kiem: { nhan_vat: string; bat_buoc?: boolean; trong_khung: boolean; cao_khung_pt: number; bi_che_boi: string[] }[];
  /** THẤY GÌ trong khung (dung-set.py › nhin_thay, đo bằng lưới tia): tên vật / nhân vật · % khung · hộp bao [x0,y0,x1,y1] 0..1 gốc trên-trái ·
   *  tien = nằm trước chủ thể (vật chắn tiền cảnh). Lưới gắn nhãn, cổng bắt vật chắn, prompt keyframe gọi tên từng khối. */
  thay?: VatThay[] };
export type VatThay = { ten: string; /** tên tiếng Anh cho prompt (vat.en) — mô hình ảnh không hiểu 'Mặt bàn', 'Tường phải' */ en?: string; /** trạng thái lúc dựng (đã chia mảnh…) — nhãn keyframe nói rõ, không để model vẽ theo ảnh mẫu nguyên vẹn */ trang?: string; pt: number; hop: [number, number, number, number]; tien: boolean };
export type NhanVat = { id: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string;
  /** tiểu sử (nhân vật): nguồn gốc, tính cách, sức mạnh, điểm yếu, mong muốn, nỗi sợ, quan hệ, bí mật — chỉ vào ngữ cảnh viết kịch bản, không vào prompt hình */
  tieu_su?: string;
  /** bộ âm hiệu cố định (phim không lời): âm đặc trưng, vui, sợ… — làm một lần, mọi tập dùng lại */
  am_hieu?: { ten: string; mo_ta: string; url: string }[]; anh_ref: string[]; giong: string; giong_model: string; giong_id: string; giong_mau_url: string | null; doi_chieu?: DoiChieu | null; bien_the?: BienThe[];
  /** bối cảnh: thuộc bộ set nào + vùng (tâm cm) trong set; nhân vật / đạo cụ: khối đại diện 3D (cỡ cm) */ bo_set_id?: number | null; vung?: { tam: number[]; ban_kinh?: number } | null; khoi_3d?: { hinh: KhoiSet['hinh']; co: number[]; mau: string; /** có mắt (nhân vật): khung xám vẽ hai mắt chỉ hướng nhìn */ mat?: boolean; /** phần thêm, toạ độ tương đối đáy giữa khối */ phan?: Omit<KhoiSet, 'ten'>[] } | null };

/** Phim quảng cáo mà chưa khai sản phẩm (mục 0) → lý do chặn; MỘT luật cho nút ở trình duyệt lẫn gác ở máy chủ. */
export function thieuQc(loai: LoaiPhim, kt: KinhThanh | null | undefined): string | false {
  if (loai !== 'quang_cao') return false;
  const q = kt?.qc;
  return !(q?.ten?.trim() || q?.link?.trim() || q?.diem_noi_bat?.trim()) && 'khai sản phẩm/dịch vụ ở mục 0 trước (hoặc dán link rồi bấm Lấy từ link)';
}
/** Độ dài clip model sinh được: 4 / 6 / 8 giây (Veo). Shot phát ngắn hơn thì cắt (phat_s). */
export const lamTronClip = (giay: number): 4 | 6 | 8 => (giay <= 4 ? 4 : giay <= 6 ? 6 : 8);
/** Số giây shot THỰC PHÁT trên timeline / bản dựng: phat_s nếu đã cắt, không thì cả clip. */
export const giayPhat = (c: Pick<Canh, 'phat_s' | 'thoi_luong_s'>): number => (c.phat_s && c.phat_s > 0 ? c.phat_s : c.thoi_luong_s || 4);
/** Clip của shot này kết bằng keyframe shot sau? Cả tập bật nối khung (tap.noi_khung), HOẶC riêng shot chọn chuyển cảnh 'lien_may' (shot sau
 *  tiếp đúng giây cuối, cùng nơi). MỘT luật cho lúc sinh clip (sinh-video.ts), sơ đồ nối/phụ thuộc và tham chiếu keyframe shot sau (sinh-anh.ts). */
export const noiKhungShot = (tapNoiKhung: boolean, c: { ky_thuat?: { chuyen_canh?: string } | null } | null | undefined): boolean =>
  tapNoiKhung || c?.ky_thuat?.chuyen_canh === 'lien_may';
/** Thời lượng mục tiêu mặc định theo loại phim (giây). */
export const thoiLuongMacDinh = (loai: LoaiPhim): number => (loai === 'quang_cao' ? 30 : loai === 'short' ? 40 : 60);
/** Các nhánh hook của tập ('' = thân chung không tính). */
export const cacNhanh = (canh: Pick<Canh, 'nhanh'>[]): string[] => [...new Set(canh.map((c) => c.nhanh).filter(Boolean))].sort();
/** Shot của MỘT bản dựng: thân chung + hook của nhánh đã chọn (không chọn → nhánh đầu). */
export function locNhanh<T extends Pick<Canh, 'nhanh'>>(canh: T[], nhanh?: string | null): T[] {
  const ds = cacNhanh(canh);
  const chon = nhanh && ds.includes(nhanh) ? nhanh : ds[0] ?? '';
  return canh.filter((c) => !c.nhanh || c.nhanh === chon);
}

/** Nhóm biến thể gợi ý theo loại anchor (nhãn hiển thị). */
export const NHOM_BIEN_THE: Record<LoaiNhanVat, { key: string; label: string }[]> = {
  nhan_vat: [{ key: 'bieu_cam', label: 'Biểu cảm' }, { key: 'trang_phuc', label: 'Trang phục' }, { key: 'tu_the', label: 'Tư thế / hành động' }],
  san_pham: [{ key: 'goc_may', label: 'Góc chụp' }, { key: 'ngu_canh', label: 'Ngữ cảnh dùng' }, { key: 'trang_thai', label: 'Trạng thái / màu' }],
  boi_canh: [{ key: 'goc_may', label: 'Góc máy' }, { key: 'thoi_diem', label: 'Thời điểm / thời tiết' }],
  dao_cu: [{ key: 'trang_thai', label: 'Trạng thái' }, { key: 'goc_may', label: 'Góc' }],
  phong_cach: [{ key: 'trang_thai', label: 'Biến tấu' }],
};
export const nhanNhom = (loai: LoaiNhanVat, nhom: string) => NHOM_BIEN_THE[loai]?.find((x) => x.key === nhom)?.label ?? nhom;
/** LỚP PHỦ tự do của tập (như trình dựng video): chữ, ảnh, hình khối đặt theo vị trí + thời gian TUYỆT ĐỐI trên tập (nhánh A).
 *  Toạ độ chuẩn hoá theo khung: x, y = TÂM (0..1), w = bề ngang (phần của rộng khung), h = bề cao (phần của cao khung, chỉ hình khối; ảnh giữ tỉ lệ).
 *  co = cỡ chữ (phần của rộng khung, như chữ màn). Xuất: ảnh phủ bằng ffmpeg, chữ/hình bằng libass — ảnh luôn nằm DƯỚI chữ/hình, chữ màn trên cùng. */
/** hieu_ung = lớp HIỆU ỨNG KHUNG kiểu CapCut (rung, chớp, zoom…) — không có hình, áp lên video + lớp ảnh bên dưới trong khoảng giờ của nó. */
export type LoaiLop = 'chu' | 'anh' | 'hinh' | 'hieu_ung';
export type HieuUngKhung = 'rung' | 'chop' | 'zoom' | 'mo' | 'den_trang' | 'toi_vien' | 'hat' | 'glitch';
export type DangHinh = 'chu_nhat' | 'bo_goc' | 'tron';
export type HieuUngVao = 'khong' | 'mo' | 'pop' | 'truot' | 'nay' | 'go_chu';
export type Lop = {
  id: string; loai: LoaiLop; ten?: string; tu: number; den: number;
  x: number; y: number; w: number; h: number; xoay: number; mo: number; vao: HieuUngVao; ra: 'khong' | 'mo'; an?: boolean;
  chu?: string; font?: string; co?: number; mau?: string; vien?: string; vien_day?: number; nen?: string; nghieng?: boolean;
  url?: string;
  dang?: DangHinh;
  /** lớp hiệu ứng: loại + cường độ 0..1 */
  hu?: HieuUngKhung; cuong?: number;
  /** mã nhóm: các lớp cùng mã là MỘT đối tượng — bấm chọn cả nhóm, dời/đổi cỡ/xoay/xoá cùng nhau; bản xuất vẫn vẽ từng lớp. */
  nhom?: string;
  /** mã nhóm trước khi bấm Bỏ nhóm — để "Gộp lại nhóm cũ" trả đúng nhóm (12/10/2026). */
  nhom_cu?: string;
  /** lớp phủ ảnh CÓ SẢN PHẨM trong hình (người cắt nền cầm sản phẩm, khuôn "Một dáng, mọi nơi") — bộ kiểm QC đếm shot nằm dưới lớp này là có sản phẩm. */
  mang_sp?: boolean;
};
/** Kết quả bước THỬ NGƯỜI XEM LẦN ĐẦU (nguoi-xem.ts): Claude chỉ thấy thứ người xem thấy/nghe, kể lại + chấm hiểu; rồi đối chiếu brief.
 *  `ma` = mã phiên bản của bản người xem lúc thử — kịch bản đổi thì kết quả hết hiệu lực. */
/** Kết quả 🔍 Kiểm khung của MỘT keyframe (khung.ts / kiem-khung.ts): url = keyframe đã kiểm (đổi là hết hiệu lực); duyet_tay = người nhận khung dù máy báo lệch. */
export type KiemKhung = { url: string; dat: boolean; loi: { loai: string; mo_ta: string; sua: string }[]; luc: string; model: string; duyet_tay?: string };
export type ThuNguoiXem = {
  ma: string; luc: string; model: string;
  /** chấm theo tiêu chí QC (claude.ts › NguoiXemQcSchema): hieu.ai = sản phẩm, muon = vấn đề, can = lợi ích, lat = hook, ket = ưu đãi + CTA */
  qc?: boolean;
  ke_lai: string; hieu: { ai: string; muon: string; can: string; lat: string; ket: string };
  diem: number; cho_kho: { shot: number; van_de: string; sua: string }[];
  /** shot rút / gộp / bỏ được mà người xem không mất ý — để tập về độ dài chuẩn series (thiếu ở bản kiểm cũ) */
  cat?: { shot: number; bot_s: number; ly_do: string }[];
  khop: boolean; lech: string; dat: boolean;
  /** mã nội dung TỪNG CẢNH lúc kiểm (nguoi-xem.ts › maTheoCanh) — sửa một cảnh chỉ làm cảnh đó mất hiệu lực, cảnh khác vẫn được tính là đã qua */
  ma_canh?: Record<string, string>;
  /** kết quả KIỂM RIÊNG từng cảnh (phan_doan → kết quả; ma = mã cảnh đó) — rẻ hơn kiểm cả tập khi chỉ sửa một cảnh */
  canh?: Record<string, ThuNguoiXem>;
};
/** Phần cấp TẬP của hồ sơ tiền kỳ (ho-so.ts): thời gian của cả tập, đường đi trong thế giới, motif, cung cảm xúc, chữ màn mở (tên tập). */
export type TapHoSo = { thoi_gian?: string; duong_di?: string; motif?: string; cung?: string;
  /** animatic đã duyệt: keyframe ghép đúng số giây + âm (bản xuất từ keyframe); ma = mã keyframe + giây lúc duyệt — đổi là phải duyệt lại */
  animatic?: { url: string; ma: string; luc: string } | null };
export type Tap = { ho_so?: TapHoSo; id: number; phim_id: number; so: number; ten: string; brief: string; noi_khung: boolean; nhac_url: string | null; nhac_mo_ta: string; nhac_phan_canh: Record<string, string>; beats: Beat[]; phan_canh: PhanCanh[]; kich_ban: string; tom_tat: string; trang_thai: string; video_url: string | null; so_canh: number; thoi_luong_s: number | null; xuat: BanXuat[]; bai_dang: BaiDang | null; lop: Lop[]; thu_nguoi_xem?: ThuNguoiXem | null };
/** Một bản xuất MP4 của tập (mỗi nhánh hook một tệp). */
/** Kho tài sản dùng lại (xv_tai_san): clip/keyframe đạt, nhạc nền, preset giọng, khuôn QC, kiểu chữ thương hiệu. */
/** Khoá THƯƠNG HIỆU của kho tài sản = tên miền shop của phim QC (qc.link, bỏ www) — project của studio là nhãn chung ('studio'), không phải
 *  thương hiệu. Không có link thì dùng project. MỘT luật cho kho, preset giọng, nhạc tự lưu. */
export const thuongHieu = (project: string, kt?: Pick<KinhThanh, 'qc'> | null): string => {
  try { const h = kt?.qc?.link ? new URL(kt.qc.link).hostname.replace(/^www\./, '') : ''; return h || project; } catch { return project; }
};
export type LoaiTaiSan = 'clip' | 'anh' | 'nhac' | 'giong' | 'khuon_qc' | 'kieu_chu';
export const LOAI_TAI_SAN: { key: LoaiTaiSan; ten: string; icon: string }[] = [
  { key: 'clip', ten: 'Clip', icon: '🎞' }, { key: 'anh', ten: 'Keyframe', icon: '🖼' }, { key: 'nhac', ten: 'Nhạc nền', icon: '🎵' },
  { key: 'giong', ten: 'Giọng', icon: '🗣' }, { key: 'khuon_qc', ten: 'Khuôn QC', icon: '🧩' }, { key: 'kieu_chu', ten: 'Kiểu chữ', icon: '🔤' },
];
export type TaiSan = { id: number; loai: LoaiTaiSan; ten: string; url: string | null; thuong_hieu: string; san_pham: string; the: string[]; mo_ta: string;
  so_do: Record<string, unknown> & { keyframe_url?: string | null; ti_le?: string; dai?: number }; du_lieu: Record<string, unknown>;
  nguon: { phim_id?: number; tap_id?: number; canh_id?: number; job_id?: number }; chi_phi_cents: number; so_lan_dung: number; created_at: string };
/** canh_bao = lệch chuẩn máy đo sau xuất (khoảng im, lẫn giọng, thiếu nhạc) — có là bản chưa đạt, studio tô đỏ. */
export type BanXuat = { url: string; nhanh: string; giay: number; luc: string; job?: number; canh_bao?: string[];
  /** bản LỒNG TIẾNG (long-tieng.ts): ngôn ngữ đích + track tiếng M4A tách sẵn để gắn vào video gốc trên YouTube */
  long_tieng?: string; am_url?: string;
  /** bản phụ đề Việt cũ (13/10/2026, đã thay bằng lồng tiếng) — chỉ còn trong dữ liệu, không hiện */
  phu_de?: string };
/** Danh sách bản xuất để hiện: bản CHÍNH (mới nhất trước, tối đa 6) + mỗi ngôn ngữ lồng tiếng chỉ bản MỚI NHẤT — bản cũ hơn đã bị thay
 *  (dữ liệu vẫn giữ). Bản phụ đề cũ không hiện: 13/10/2026 anh mở trúng bản phụ đề dựng trước khi sửa chữ (nằm cạnh bản mới, cùng nhãn). */
export function banHien(xuat: BanXuat[]): { chinh: BanXuat | null; ds: BanXuat[] } {
  const moi = xuat.slice().reverse();
  const chinh = moi.filter((b) => !b.long_tieng && !b.phu_de);
  const daCo = new Set<string>();
  const dich = moi.filter((b) => b.long_tieng && !daCo.has(b.long_tieng) && !!daCo.add(b.long_tieng));
  return { chinh: chinh[0] ?? null, ds: [...dich, ...chinh.slice(0, 6)] };
}
/** THẺ SHOT trước keyframe (14/10/2026 — khuôn shot list / storyboard panel của ngành): những thứ trước đây nhồi chung vào một câu hanh_dong.
 *  bo_cuc · mo · ket · huong viết tiếng Anh (đi vào prompt ảnh + video: sinh-anh.ts › chuanBiKeyframe, sinh-video.ts › promptVideoCanh);
 *  muc_dich · motif là ghi chú dựng (không vào model). Cổng: nhip-hinh.ts › kiemTheShot. */
export type DanDung = {
  /** bố cục 3 lớp: tiền / trung / hậu cảnh, ai bên trái, ai bên phải */ bo_cuc?: string;
  /** trạng thái MỞ shot: vị trí, đồ đang cầm, biến dạng — phải khớp trạng thái kết của shot trước */ mo?: string;
  /** trạng thái KẾT shot */ ket?: string;
  /** hướng nhìn + hướng di chuyển trên màn (giữ trục 180°) */ huong?: string;
  /** khán giả cảm gì từ đầu → cuối shot, shot tồn tại để làm gì */ muc_dich?: string;
  /** motif / cái gài hoặc trả có trong khung */ motif?: string;
  /** DIỄN XUẤT HOẠT HÌNH (tiếng Anh, vào prompt video): lấy đà → hành động → theo đà / phản ứng, nén–giãn, khựng — chất Larva */ dien?: string;
  /** ĐIỂM NHẤN âm–hình của gag: khung nào, tiếng gì đập đúng lúc nào (shot có cú bùng của gag bắt buộc có) */ nhan?: string;
  /** mã shot CỐ ĐỊNH trong hồ sơ viết tay (vd "4.6a") — đồng bộ hồ sơ ↔ studio khớp theo mã này, chèn shot giữa cảnh không làm lệch shot sau */ ma?: string;
};
export const O_DAN_DUNG: { key: keyof DanDung; ten: string; mau: string; vaoModel: boolean }[] = [
  { key: 'bo_cuc', ten: 'Bố cục 3 lớp', mau: 'Foreground: blurred yellow paper corner (left). Mid: Tango, screen-left. Background: the two glowing screens.', vaoModel: true },
  { key: 'mo', ten: 'Trạng thái mở', mau: 'Tango crouched behind the mouse, empty-handed; gummy upright 3 steps to his right.', vaoModel: true },
  { key: 'ket', ten: 'Trạng thái kết', mau: 'Tango face-down on the wood; gummy bouncing away toward the screens.', vaoModel: true },
  { key: 'huong', ten: 'Hướng nhìn · hướng đi', mau: 'Tango looks and moves screen-right; gummy exits frame right.', vaoModel: true },
  { key: 'muc_dich', ten: 'Mục đích cảm xúc', mau: 'Thèm → hụt hẫng buồn cười; khán giả hiểu Tango muốn gì.', vaoModel: false },
  { key: 'motif', ten: 'Motif · gài / trả', mau: 'Viên kẹo đỏ (motif); gài: góc giấy vàng nhìn trộm.', vaoModel: false },
  { key: 'dien', ten: 'Diễn xuất hoạt hình', mau: 'Anticipation: Tango crouches and wiggles. Action: leaps, arms wide. Reaction: freezes mid-air a beat, then drops face-first (squash), strand boings.', vaoModel: true },
  { key: 'nhan', ten: 'Điểm nhấn âm–hình', mau: 'Giây 2,8: kẹo phụt khỏi tay — tiếng "bloop" đúng khung; nhạc ngắt 1 nhịp trước cú ngã.', vaoModel: false },
];
/** Ô thẻ shot BẮT BUỘC trước keyframe (motif + điểm nhấn tuỳ shot — điểm nhấn bắt buộc ở shot có cú bùng của gag, ho-so.ts › kiemHoSo). */
export const O_DAN_DUNG_BAT_BUOC = O_DAN_DUNG.filter((o) => o.key !== 'motif' && o.key !== 'nhan');
export type Canh = {
  id: number; tap_id: number; thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; am_thanh: string; thoai_url: string | null; am_thanh_url: string | null; phan_doan: string; cam_xuc: number; ky_thuat: KyThuatShot; thoai: DongThoai[]; trang_phuc: string;
  /** Giây thực phát (cắt từ đầu clip); null = phát cả clip. chu_man = chữ trên màn. nhanh = '' thân chung | 'A'/'B'/'C' biến thể hook. */
  phat_s: number | null; chu_man: string; nhanh: string;
  /** kiểu chữ màn riêng của shot (đè kieu_chu của phim). */
  kieu_chu: KieuChu;
  /** bản dịch chữ màn theo ngôn ngữ (ban-dich.ts › theoNgonNgu); goc lệch chu_man hiện tại = cũ. */
  chu_man_dich?: Record<string, { goc: string; chu: string }>;
  thoi_luong_s: number; nhan_vat: number[]; bien_the: number[]; prompt_anh: string; prompt_video: string; dang_sinh_anh?: boolean; dang_sinh_am?: boolean; /** ISO lúc sinh xong keyframe / clip đang dùng (dsCanh, #1384) */ keyframe_luc?: string | null; video_luc?: string | null; dang_sinh_giong?: boolean; dang_sinh_sfx?: boolean;
  dan_dung?: DanDung;
  kiem_khung?: KiemKhung | null;
  may_3d?: May3d | null;
  khung_xam?: KhungXam | null;
  /** nguồn của TỪNG tệp (keyframe ứng viên, clip nháp/cuối): url → nhãn ngắn + đủ (cổng · model · model thật · tiền thật) — actions.ts › dsCanh */
  nguon_tep?: Record<string, { ngan: string; day: string }>;
  /** job video đang chạy của shot: cổng · model đang áp dụng (ngan) + các bước dự phòng đã thử (day) */
  video_dang?: { ngan: string; day: string };
  /** nguồn tham khảo của từng câu chữ màn / lời (tham-khao.ts) — QC bắt buộc */ tham_khao?: import('./tham-khao').ThamKhaoCau[];
  keyframe_url: string | null; keyframe_uv: string[];
  /** keyframe KẾT (khung cuối, sinh từ khung màu chỗ kết) — video nhận làm ảnh cuối */ keyframe_ket?: string | null; video_url: string | null; video_cuoi_url: string | null; nguon_video: Record<string, unknown>; video_phien_ban: { url: string; ban: 'nhap' | 'cuoi'; model?: string; job?: number; luc?: string }[]; trang_thai: TrangThaiCanh; loi: string; chi_phi_cents: number;
};
export type Job = {
  id: number; canh_id: number | null; nhan_vat_id: number | null; loai: string; provider: string; model: string;
  trang_thai: string; task_id: string | null; output_url: string | null; chi_phi_cents: number; loi: string; created_at: string;
  phim_id?: number | null; nhan?: string; tokens_in?: number; tokens_out?: number; phim_ten?: string;
  /** nguồn lượt sinh: cổng · model thật · tiền thật · chuỗi dự phòng (cong-ai.ts) */ nguon?: import('./cong-ai').NguonSinh | null;
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
/** Giờ Việt Nam (GMT+7) — MỘT hàm cho mọi màn (luật: chữ nói với anh luôn là giờ VN). giay: kèm giây · chiGio: bỏ ngày. */
export function gioVN(iso: string | Date = new Date(), o: { giay?: boolean; chiGio?: boolean } = {}): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', ...(o.giay ? { second: '2-digit' } : {}), ...(o.chiGio ? {} : { day: '2-digit', month: '2-digit' }) });
}
/** Cảm xúc KHÁN GIẢ (-5..+5) ra chữ — trục âm là khó chịu/đau, trục dương là thích/muốn. Một bảng cho timeline, form shot, lời nhắc Claude. */
export const CAM_XUC_KHAN_GIA: Record<number, string> = {
  [-5]: 'tuyệt vọng', [-4]: 'sợ / ám ảnh', [-3]: 'đau, khó chịu', [-2]: 'bực, lo', [-1]: 'hơi khó chịu', 0: 'trung tính',
  1: 'tò mò', 2: 'thích thú', 3: 'nhẹ nhõm, tin', 4: 'hào hứng, muốn có', 5: 'phấn khích, muốn mua ngay',
};
/** Cùng thang, tiếng Anh — để ĐƯA VÀO prompt ảnh/video (model ảnh/video làm theo tiếng Anh chính xác nhất). */
export const CAM_XUC_EN: Record<number, string> = {
  [-5]: 'despair', [-4]: 'dread', [-3]: 'pain and discomfort', [-2]: 'frustration and worry', [-1]: 'mild unease', 0: 'calm neutrality',
  1: 'curiosity', 2: 'delight', 3: 'relief and trust', 4: 'excitement and desire', 5: 'euphoric must-have excitement',
};
/** Đổi biến thể của MỘT đối tượng trong shot: mỗi đối tượng tối đa 1 biến thể (#1249) — luật chung cho chip trên thẻ shot và form sửa. null = dùng ảnh gốc. */
export function doiBienThe(bienThe: number[], nv: Pick<NhanVat, 'bien_the'>, btId: number | null): number[] {
  const cuaNv = new Set((nv.bien_the ?? []).map((b) => b.id));
  return [...bienThe.filter((id) => !cuaNv.has(id)), ...(btId != null && cuaNv.has(btId) ? [btId] : [])];
}
/** Chuẩn hoá danh sách biến thể: mỗi đối tượng giữ biến thể chọn SAU CÙNG. */
export function motBienTheMoiDoiTuong(bienThe: number[], nvs: Pick<NhanVat, 'bien_the'>[]): number[] {
  let out = bienThe;
  for (const v of nvs) { const cua = out.filter((id) => (v.bien_the ?? []).some((b) => b.id === id)); if (cua.length > 1) out = doiBienThe(out, v, cua[cua.length - 1]!); }
  return out;
}
/** Cảm xúc khán giả MỤC TIÊU mặc định theo loại shot của QC mẫu — dùng khi khung/kịch bản không ghi, để không đường nào ghi 0 hàng loạt. */
export const CAM_XUC_THEO_LOAI: Record<LoaiShotMau, number> = {
  hook: 1, uu_dai: 4, noi_dau: -2, giai_phap: 3, tinh_nang: 2, demo: 3, so_sanh: 3, bang_chung: 3, tran_an: 3, cta: 5, end_card: 5, khac: 0,
};
/** Cảm xúc mục tiêu của một shot = theo loại beat của nó (phan_doan là khoá loại shot QC mẫu: hook, uu_dai, noi_dau…); không phải loại đã biết → null.
 *  lechCamXuc: shot ghi cảm xúc lệch mục tiêu ≥ 3 nấc, hoặc trung tính trong khi mục tiêu không trung tính — chỗ đường cảm xúc "phẳng/tụt" (anh 11/10/2026). */
export const camXucMucTieu = (c: Pick<Canh, 'phan_doan'>): number | null => (c.phan_doan in CAM_XUC_THEO_LOAI ? CAM_XUC_THEO_LOAI[c.phan_doan as LoaiShotMau] : null);
export function lechCamXuc(c: Pick<Canh, 'phan_doan' | 'cam_xuc'>): boolean {
  const m = camXucMucTieu(c); const v = c.cam_xuc ?? 0;
  return m != null && (Math.abs(v - m) >= 3 || (v === 0 && m !== 0));
}
export const tenCamXuc = (v: number): string => CAM_XUC_KHAN_GIA[Math.max(-5, Math.min(5, Math.round(v)))] ?? '';
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

/** Khớp miệng (fal sync-lipsync v2): thay chuyển động môi của clip theo file giọng đã sinh — Veo tự đọc thoại giọng lơ lớ, giọng TTS riêng thì
 *  miệng không khớp (review 09/10/2026). Giá công khai 10/2026: $3/phút video. */
export const KHOP_MIENG = { model: 'fal-ai/sync-lipsync/v2', label: 'Sync Lipsync v2', giaGiayCents: 5 } as const;
/** Nâng cấp video (fal Topaz Precision) — giữ nguyên chuyển động của clip nháp. Giá công khai 10/2026: $0,10/10s ra 720p, $0,20/10s ra 1080p. */
export const NANG_CAP = { model: 'topaz/upscale/video/precision', label: 'Topaz Precision ×2', giaGiayCents: 2 } as const;

/** (dùng chung UI + bản xuất) Chữ màn theo mốc giây trong shot: dòng "@0.9 PAY 1 GET ? PANTS" mở câu mới từ giây 0,9 (QC mẫu đổi chữ ngay trong shot);
 *  dòng thường nối vào câu đang hiện (xuống dòng). Không có "@" → một câu suốt shot. */
/** Chữ trên hình không để dấu chấm cuối câu (anh 12/10/2026) — bỏ ngay ở đây nên bản xuất, xem trước, timeline cùng thấy. */
export function doanChuMan(chu: string, phat: number): { tu: number; den: number; dong: string[] }[] {
  const out: { tu: number; den: number; dong: string[] }[] = [];
  for (const dong of chu.split('\n')) {
    const m = dong.match(/^\s*@(\d+(?:[.,]\d+)?)s?\s+(.*)$/);
    if (m) out.push({ tu: Math.min(phat, Number(m[1]!.replace(',', '.'))), den: phat, dong: [boChamCuoi(m[2]!.trim())] });
    else if (dong.trim()) { if (!out.length) out.push({ tu: 0, den: phat, dong: [] }); out[out.length - 1]!.dong.push(boChamCuoi(dong.trim())); }
  }
  for (let i = 0; i < out.length - 1; i++) out[i]!.den = out[i + 1]!.tu;
  return out.filter((d) => d.den > d.tu && d.dong.length);
}
/** Đoạn chữ HIỆN THẬT trên khung: doanChuMan + cắt cụm ≤ toiDaTu từ (kiểu chữ › tu), thời gian chia theo độ dài cụm. MỘT hàm cho bản xuất
 *  (xuat.ts) và ô xem trước (chu-man.tsx) — xem trên trang đúng nhịp chữ của MP4. */
export function doanHien(chu: string, phat: number, toiDaTu?: number): { tu: number; den: number; dong: string[] }[] {
  const doan = doanChuMan(chu, phat);
  if (!toiDaTu) return doan;
  const out: { tu: number; den: number; dong: string[] }[] = [];
  for (const d of doan) {
    const cum = chiaCum(d.dong.join(' '), toiDaTu);
    if (cum.length === 1) { out.push(d); continue; }
    const tong = cum.reduce((a, c) => a + c.length + 4, 0); let t = d.tu;
    cum.forEach((c, i) => { const den = i === cum.length - 1 ? d.den : Math.round((t + ((d.den - d.tu) * (c.length + 4)) / tong) * 1000) / 1000; out.push({ tu: t, den, dong: [c] }); t = den; });
  }
  return out;
}
/** Chữ màn hiện trên timeline/thẻ shot: chỉ câu cuối (câu đã "lộ hết"), bỏ cú pháp "@giây". */
export const chuManHien = (chu: string): string => { const d = doanChuMan(chu, 999); return d.length ? d[d.length - 1]!.dong.join(' ') : chu.trim(); };
