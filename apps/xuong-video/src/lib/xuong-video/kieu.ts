import type { TheLoai, KyThuatShot, Beat } from './dien-anh';
import type { ApKhuon } from './khuon-chuoi';
import { boChamCuoi, chiaCum } from './ngat-dong';
// Xưởng video AI — kiểu dữ liệu + bảng model/giá. File THƯỜNG (không 'use server'), client lẫn server import được.
// Giá: ai.google.dev/gemini-api/docs/pricing đọc 08/10/2026 (Veo 3.1 Lite 720p $0,05/giây; Nano Banana 2.1 1K $0,0336/ảnh).
// Sora 2 API của OpenAI đã đóng 24/09/2026 → video chỉ còn Google; chữ dùng Claude.

export type LoaiPhim = 'short' | 'phim' | 'quang_cao' | 'may_dung';
export const LOAI_PHIM: { key: LoaiPhim; label: string; mo_ta: string }[] = [
  { key: 'short', label: 'Short video', mo_ta: 'Reels / TikTok / Shorts 15-60s, một tập' },
  { key: 'phim', label: 'Phim ngắn', mo_ta: 'Nhiều tập, tuyến nhân vật đồng nhất cả bộ' },
  { key: 'quang_cao', label: 'Creative quảng cáo', mo_ta: 'Video sản phẩm 15-30s cho Meta/TikTok' },
  { key: 'may_dung', label: 'Máy Dựng', mo_ta: 'Dựng bằng máy theo khuôn (đố chữ Front Porch…), không AI — keyframe / clip / bản xuất 0đ' },
];

export type LoaiNhanVat = 'nhan_vat' | 'san_pham' | 'boi_canh' | 'dao_cu' | 'phong_cach' | 'cau_kien';
/** ic = biểu tượng của loại đối tượng — MỘT chỗ khai cho timeline, bảng đối tượng × shot… */
export const LOAI_NHAN_VAT: { key: LoaiNhanVat; label: string; ic: string }[] = [
  { key: 'nhan_vat', label: 'Nhân vật', ic: '🧍' },
  { key: 'san_pham', label: 'Sản phẩm', ic: '📦' },
  { key: 'boi_canh', label: 'Bối cảnh', ic: '🏠' },
  { key: 'dao_cu', label: 'Đạo cụ', ic: '🧸' },
  { key: 'cau_kien', label: 'Cấu kiện', ic: '🪟' },
  { key: 'phong_cach', label: 'Phong cách', ic: '🎨' },
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
/** Model video KHÔNG dùng cho quảng cáo (anh 16/10/2026: Pika khung khoá "thiếu cảm xúc" — chỉ biến hình giữa hai khung, người không diễn;
 *  Grok qua ShopAIKey tự in phụ đề giả lên hình dù prompt cấm — #54 shot 6 / 9 "Look at that fit!" đè thẻ kết).
 *  Một luật cho ô chọn model (mo-hinh-ui.tsx › luaChonVideo), chuỗi tự chọn rẻ nhất (cong-ai.ts › chuoiVideo) và cửa sinh clip máy chủ (sinh-video.ts). */
/** Chữ có dấu tiếng Việt. */
export const laTiengViet = (t: string): boolean => /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(t);
/** Mô tả tiếng Việt của shot (#1397): trường riêng, không có thì hanh_dong nếu nó đã là tiếng Việt (tách cảnh viết tiếng Việt), không thì rỗng.
 *  MỘT chỗ cho lưới, thẻ shot và cổng kiểm thiếu. */
/** Câu hành động THẬT gửi model video: prompt_video riêng nếu có, không thì hành động của shot — mọi cổng soát câu (sản phẩm, cấm cười, cận cảnh, lint) đọc qua đây. */
export const cauVideo = (c: Pick<Canh, 'hanh_dong'> & { prompt_video?: string | null }): string => (c.prompt_video ?? '').trim() || c.hanh_dong;
export const moTaVi = (c: Pick<Canh, 'hanh_dong' | 'hanh_dong_vi'>): string => c.hanh_dong_vi?.trim() || (laTiengViet(c.hanh_dong) ? c.hanh_dong.trim() : '');
/** Kết quả máy soi clip (soi-clip.ts). */
export type SoiClip = { url: string; luc: string; loi: string[]; do: { mau: number[]; chu: string[]; /** điểm giống ảnh mẫu theo nhân vật, từng khung chấm được (soi-mat.ts › soiMatClip) */ mat?: Record<string, { giay: number; giong: number }[]>; /** lỗi biến dạng đã xác nhận (soi-bien-dang.ts) */ bien_dang?: { khung: number; loai: string; mo_ta: string }[]; /** lỗi NHẸ (chỉ thấy khi dừng hình) — không chặn, hiện để người duyệt xem */ canh_bao?: string[] }; bo_qua?: boolean };
/** Lỗi soi còn hiệu lực của shot: soi đúng clip đang dùng, có lỗi, chưa ai bỏ qua. */
export const loiSoiClip = (c: Pick<Canh, 'video_url' | 'video_cuoi_url' | 'soi_clip'>): string[] => { const u = c.video_cuoi_url || c.video_url; const k = c.soi_clip; return u && k && k.url === u && !k.bo_qua ? k.loi : []; };
// 17/10/2026: anh mở lại Grok cho QC người thật — phụ đề giả Grok tự in giờ do máy soi bắt (soi-clip.ts: chữ lạ tesseract + soi biến dạng 'chữ tự in') và vòng tự sửa sinh lại.
export const MO_HINH_KHONG_QC: readonly string[] = ['fal:fal-ai/pika/v2.2/pikaframes'];
export const hopQc = (key: string, laQc: boolean): boolean => !(laQc && MO_HINH_KHONG_QC.includes(key));
export const MO_HINH_VIDEO = [
  { key: 'veo-3.1-lite-generate-preview', label: 'Veo 3.1 Lite (rẻ nhất: $0,40 / 8s 720p)', giaGiay: { '720p': 5, '1080p': 8 } },
  { key: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast ($0,80 / 8s 720p)', giaGiay: { '720p': 10, '1080p': 12 } },
  { key: 'veo-3.1-generate-preview', label: 'Veo 3.1 Quality ($3,20 / 8s)', giaGiay: { '720p': 40, '1080p': 40 } },
  // fal.ai (khoá FAL_KEY) — giá ước theo bảng giá công khai 10/2026, tiền thật xem ở fal.ai/dashboard/usage.
  { key: 'fal:fal-ai/kling-video/v3/pro/image-to-video', label: 'Kling 3.0 Pro · fal (giữ nhân vật tốt, có tiếng, ~$0,14/s)', giaGiay: { '720p': 14, '1080p': 14 } },
  // Pikaframes: dựng chuyển động GIỮA các keyframe (khung đầu → khung giữa → khung kết, 2–5 khung, ≤ 25s) — cần shot có keyframe kết. Không có trong
  // danh mục fal tải về (cắt 100 model đầu mỗi nhóm) nên khai tay ở đây. Giá fal: $0,04/s 720p, $0,06/s 1080p, tối thiểu 5 giây; không tiếng.
  { key: 'fal:fal-ai/pika/v2.2/pikaframes', label: 'Pikaframes · fal (chuyển động giữa nhiều keyframe, $0,04/s, tối thiểu 5s, không tiếng)', giaGiay: { '720p': 4, '1080p': 6 } },
  // Hai model nhận chuyển động 3D (anh 16/10/2026: "còn AI nào khác cho gửi nhiều khung hình"): H3 Max nhận THẲNG clip diễn Blender (khung_xam.dien) —
  // máy, đường đi, nhịp, số vật giữ theo clip; FLUX 3 ghim tới 10 khung khoá vào đúng số khung (24 khung/giây). Cả hai tối thiểu 5 giây.
  { key: 'fal:minimax/h3-max/3d-to-video', label: 'H3 Max 3D→Video · fal (nhận clip diễn Blender, ~$0,08/s 768p, tối thiểu 5s)', giaGiay: { '720p': 8, '1080p': 16 } },
  { key: 'fal:blackforestlabs/flux-3/keyframes-to-video/draft', label: 'FLUX 3 Keyframes nháp · fal (≤10 khung khoá ghim theo khung, $0,06/s, tối thiểu 5s)', giaGiay: { '720p': 6, '1080p': 6 } },
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
 *  color script (ánh sáng + màu, mã thư viện) và nhạc. Bảy tài liệu của nút 📋 Hồ sơ của tập đọc từ đây + shot (ho-so.ts). */
export type PhanCanh = { ten: string; beat: string; muc_tieu: string; xung_dot: string; an_y: string; nhip: string; cam_xuc_dau: number; cam_xuc_cuoi: number;
  /** gag của cảnh: gài → bùng, o_shot = shot thứ mấy TRONG cảnh có cú bùng (1-based) */ gag?: { ten: string; gai: string; bung: string; o_shot: number; /** MẠCH truyện nhỏ của gag trong cảnh (A, B…) — cảnh có ≥2 gag phải khai; đổi mạch thì cần NÚT ĐÓNG (nhip-hinh.ts › kiemNutDong) */ mach?: string }[];
  /** cảnh mở series (chuỗi từ thế giới ngoài) — không tính vào độ dài chuẩn của tập */ intro?: boolean;
  /** NGÀY TRUYỆN (script supervisor: N1 = đêm thứ nhất, D2 = ngày thứ hai…) — sang ngày khác thì sổ liền mạch reset cả trạng thái cơ thể
   *  (ướt / xù / bẩn), quần áo, chỗ, dáng; trống = cùng ngày cảnh trước */ ngay?: string;
  /** cảnh tiếp LIỀN thời gian cảnh trước? false = cảnh mới (thời gian nhảy / nơi khác hẳn) → reset chỗ đứng, hướng, dáng, đồ đang cầm (trạng thái
   *  cơ thể giữ tới khi đổi ngày truyện); trống = liền mạch (bo-set-3d.ts › lienMachTap) */ lien_truoc?: boolean;
  noi?: string; luc?: string; gia_tri_doi?: string; diem_xoay?: string; nhip_hd?: string[]; hieu_ung?: string[]; anh_sang?: string; mau?: string; mau_mo_ta?: string; nhac?: string;
  /** đoạn kịch bản (screenplay) của cảnh: hành động / âm / thoại / chuyển cảnh */ kich_ban?: DongKichBan[] };
export type DongKichBan = { loai: 'hd' | 'am' | 'chuyen'; chu: string } | { loai: 'nv'; ten: string; dien: string; loi: string };
export type KinhThanh = {
  /** Phim thể loại 'may_dung' (may-dung.ts): mẫu + đề + chữ đăng; nền = ảnh AI theo chủ đề (null = dải màu bìa). Nguồn đề: puzzle-books day-studio.mjs. */
  may_dung?: { mau: import('./may-dung-mau').MauMayDung; du_an: string; slug: string; chu_de: string; de: import('./may-dung-do-chu').DeMotDung;
    dang: { title?: string; description?: string; link?: string; book?: string; words?: string[] }; nen_url?: string | null; nen_prompt?: string | null } | null;
  phong_cach?: string;          // "3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm" — nối vào đầu mọi prompt ảnh/video
  /** CHẤT LIỆU HÌNH (anh 16/10/2026 "phải tách thể loại film ra"): người thật / hoạt hình — quyết định cổng soi mặt + sổ bề ngoài; '' = tự nhận từ phong_cach (chatLieuPhim) */
  chat_lieu?: '' | 'nguoi_that' | 'hoat_hinh';
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
  /** GÓI THỂ LOẠI đang chọn (goi-the-loai.ts) — khung beat, cung khán giả, luật nhấn cho tách cảnh; '' = chưa chọn */ goi?: string;
  the_loai?: TheLoai | '';      // thể loại → thư viện điện ảnh gợi ý kỹ thuật hợp (kinh dị ≠ hài ≠ QC UGC)
  logline?: string;             // một câu: ai, muốn gì, cản trở gì
  chu_de?: string;              // điều bộ phim muốn nói (theme)
  qc?: ThongTinQc;              // phim quảng cáo: sản phẩm/dịch vụ — AI mọi bước dựa vào đây (#1201)
  /** Giọng LỜI DẪN của cả phim — khoá ở lượt sinh giọng lời dẫn đầu tiên, mọi câu sau đọc cùng giọng (10/10/2026: phim #5 lời dẫn
   *  rơi về giọng mặc định George nam trong khi QC mẫu là giọng nữ). Phim có QC mẫu mà chưa chọn → không sinh giọng lời dẫn. */
  giong_dan?: { model: string; voice: string } | null;
  /** NGƯỜI KỂ: tên anchor kể chuyện — lời dẫn đọc bằng giọng riêng của anchor này (sinh-giong.ts), đứng trước giọng preset thương hiệu. */
  nguoi_ke?: string;
  /** MURCH QC (qc-cam-xuc.ts): bật thì shot có người phải có kế hoạch biểu cảm liền mạch, keyframe + clip phải soát đạt trước video / xuất. */
  cam_xuc_qc?: boolean;
  /** KINH THÁNH SERIES (13/10/2026): phim là một series nhiều tập — câu động cơ (mỗi tập cùng kiểu xung đột, tình huống mới) + danh sách
   *  tập với logline từng tập. Claude viết tập mới bám vào đây và không lặp tập cũ; máy chấm kịch bản chặn tập thiếu logline/nhịp (cham-kich-ban.ts). */
  series?: Series | null;
  /** bản lưu trữ (thử xong, không dùng): ẩn khỏi danh sách phim mặc định, không xoá (nhom-phim.ts). */
  luu_tru?: boolean;
  /** nhịp stop-motion: bản xuất giữ mỗi hình hai nhịp (12 hình/giây) — chuyển động AI mượt quá trông như quay stop-motion thật (Tango & Lint) */
  nhip_stop_motion?: boolean;
  /** PHỤ ĐỀ CHÁY CỨNG mọi câu thoại nhân vật (phim dọc kiểu ReelShort: tham-khao/reelshort.md) — xuat.ts › phuDe */
  phu_de?: boolean;
  /** TÔNG MÀU CHUNG cả phim cho bản xuất (key nhóm 'mau' thư viện dien-anh.ts: teal_cam, am, lanh…) — look.ts; trống = không áp */
  look?: string;
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
export type TapBanDo = { so: number; ten: string; logline: string; mua?: number; loai?: 'phieu_luu' | 'nguon_goc' | 'ket_mua'; nhan_vat?: string[]; boi_canh?: string[]; gai_tra?: string;
  /** sự kiện của từng TUYẾN TRUYỆN trong tập này (khoá = TuyenTruyen.ma) — bảng tuyến, tab 📖 Phim › Tuyến truyện */ su_kien?: Record<string, string> };
/** TUYẾN TRUYỆN (bảng tuyến của phòng biên kịch): A = tuyến chính, B/C = tuyến phụ. Sự kiện từng tập ở TapBanDo.su_kien[ma]. */
export type TuyenTruyen = { ma: string; ten: string; /** vai ngành của tuyến (khung-tuyen.ts › VaiTuyen.vai) — bảng tuyến so với khung theo dạng phim */ vai?: string };
/** SỔ GÀI / TRẢ (setup – payoff, script editor giữ): chi tiết gieo ở tập `gieo`, trả ở tập `tra` (null = còn treo). Luật: tuyen-truyen.ts. */
export type GaiTra = { id: string; chi_tiet: string; gieo: number; tra: number | null;
  /** CỐ Ý để mở (chưa trả có chủ đích): móc sang tập sau / mùa sau — không tính là treo, tập cuối mùa không bị chặn vì nó */ mo?: 'tap_sau' | 'mua_sau' };
export type MuaSeries = { so: number; ten: string; dong_co?: string; ghi_chu?: string };
/** THAM CHIẾU của series (14/10/2026 — anh: "trước khi sinh key phải có hết"): tác phẩm mẫu + chuẩn đo được rút ra từ nó; hồ sơ tập đo theo đây. */
export type ThamChieuSeries = { tac_pham: string; do_dai_s: number; gag_moi_phut: number; rut_ra: string[] };
/** KHUÔN NHẬN DIỆN series: intro dùng chung, thẻ tựa, thẻ kết, câu nhạc chủ đề — tập nào cũng mang. */
export type KhuonSeries = { intro: string; the_tua: string; the_ket: string; nhac_chu_de: string };
export type Series = { tham_chieu?: ThamChieuSeries; khuon?: KhuonSeries; /** tên series — gom các bản (bút chì, sáp màu…) trên danh sách phim */ ten?: string; dong_co: string; khan_gia: string; dinh_dang: string; tap: TapBanDo[];
  /** các mùa (sơ đồ series): tên + động cơ riêng; tập thuộc mùa theo TapBanDo.mua (thiếu = mùa 1) */ mua?: MuaSeries[];
  tuyen?: TuyenTruyen[]; so_gai_tra?: GaiTra[] };
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
 *  Phim CHƯA chọn kiểu chữ → chữ trắng VIỀN ĐEN DÀY, không băng nền (anh 25/10/2026, kể chuyện Step Back: "dùng chữ có viền đen chứ không dùng nền đen,
 *  như vậy mất hết hình video"). Viền dày VIEN_DAY_MAC_DINH vẫn đọc được trên nền giấy sáng của phim vẽ (lý do cũ dùng băng nền: viền mỏng 0,07 chìm —
 *  Fox Tales 13/10/2026). Phim đã chọn kiểu (QC chép từ mẫu, kể cả kiểu có nền) giữ nguyên kiểu của nó. */
export const VIEN_DAY_MAC_DINH = 0.12;
export function gopKieu(phim?: KieuChu | null, shot?: KieuChu | null): typeof KIEU_CHU_MAC_DINH & { y?: number; nen?: string; tu?: number } {
  const sach = (d?: KieuChu | null) => Object.fromEntries(Object.entries(d ?? {}).filter(([, v]) => v !== '' && v != null));
  const p = sach(phim);
  return Object.assign({}, KIEU_CHU_MAC_DINH, Object.keys(p).length ? {} : { vien_day: VIEN_DAY_MAC_DINH }, p, sach(shot));
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
/** Ngôn ngữ dùng dấu sắc/huyền trên từ ngắn (es: más, sí, tú, él · pt · fr · it) → luật (b) bắt nhầm (19/10/2026 phim ES "Votos destrozados":
 *  "Toca Más información" bị coi là tiếng Việt, cổng chặn cả giọng). Với các ngôn ngữ này chỉ xét chữ RIÊNG của tiếng Việt. */
const DAU_LATIN = new Set(['es', 'pt', 'fr', 'it', 'ca']);
export const coTiengVietTheo = (ngonNgu: string | undefined, s: string): boolean => (DAU_LATIN.has(String(ngonNgu ?? '').slice(0, 2).toLowerCase()) ? VIET_RIENG.test(s) : coTiengViet(s));
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
  if (o.phongCach && coTiengVietTheo(ngonNgu, o.phongCach)) cho.push('phong cách phim');
  if (o.shot && coTiengVietTheo(ngonNgu, chuShot({ thu_tu: 0, chu_man: '', thoai: [], loi_thoai: '', ...o.shot }))) cho.push(`shot${o.shot.thu_tu ? ` #${o.shot.thu_tu}` : ''}`);
  for (const a of o.anchor ?? []) if (coTiengVietTheo(ngonNgu, `${a.ten} ${a.mo_ta}`)) cho.push(`anchor "${a.ten}"`);
  return cho.length ? `Phim ${tenNgonNgu(ngonNgu)} nhưng chữ đi vào model còn tiếng Việt (${cho.slice(0, 5).join(', ')}${cho.length > 5 ? '…' : ''}) — bấm 🌐 Dịch cả phim trước, không sinh để khỏi mất tiền.` : null;
}
export const KINH_THANH_MAC_DINH: Required<KinhThanh> = {
  phong_cach: '', chat_lieu: '', ti_le: '9:16', do_phan_giai: '720p',
  mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: 'veo-3.1-lite-generate-preview', mo_hinh_chu: 'claude-opus-5-5', ngon_ngu: 'vi', the_loai: '', goi: '', logline: '', chu_de: '', qc: { ten: '', link: '', diem_noi_bat: '', doi_tuong: '', uu_dai: '', thi_truong: '', anh: [] },
  may_dung: null, giong_dan: null, nguoi_ke: '', cam_xuc_qc: false, series: null, luu_tru: false, nhip_stop_motion: false, phu_de: false, look: '', khong_loi: false, ban_do: '', template: null, tu_template: null, bang_ti_le: '', keyframe_sua_3d: true, keyframe_hai_buoc: true,
};
/** Chất liệu hình của phim: khai tay trong kinh thánh, không thì đọc chữ phong cách. Không đoán được → 'hoat_hinh' an toàn (không bật cổng soi mặt
 *  trên phim chưa rõ) — phim người thật nào phong cách không nói rõ thì chọn tay. */
export function chatLieuPhim(kt: Pick<KinhThanh, 'chat_lieu' | 'phong_cach'> | null | undefined): 'nguoi_that' | 'hoat_hinh' {
  if (kt?.chat_lieu) return kt.chat_lieu;
  const p = (kt?.phong_cach ?? '').toLowerCase();
  if (/(animat|cartoon|pixar|anime|stop[- ]?motion|claymation|clay|hoạt hình|2d|3d (render|style)|cel[- ]shad|illustrat|felt|puppet)/.test(p)) return 'hoat_hinh';
  return /(live[- ]action|photo ?real|real (people|person)|người thật|ugc|documentary|shot on (an )?iphone|phone (camera|video)|creator|talking to camera)/.test(p) ? 'nguoi_that' : 'hoat_hinh';
}
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
export type BienThe = { id: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string; anh_url: string | null;
  /** look theo TẬP: mảng số tập (xv_tap.so) biến thể này dùng; rỗng/thiếu = mọi tập (bang-trang-phuc theo tập, lookMang bộ mặc định) */ dung_tap?: number[] | null };
/** Claude nhìn ảnh gốc của anchor so với mô tả: lệch chỗ nào (màu, ren, khoá, chữ thương hiệu…) + mô tả viết lại theo ảnh. */
export type DoiChieu = { khop: boolean; lech: string[]; mo_ta_de_xuat: string; luc: string };
/** BỘ SET 3D (bo-set-3d.ts): bối cảnh là DỮ LIỆU toạ độ cm — gốc giữa mép trước, x phải, y vào sâu, z lên. Một set dùng cho nhiều phim của dự án. */
/** DÁNG NGƯỜI (anh 19/10/2026): một ô cho hình khối 3D (scripts/bo-set/mesh/nguoi.py › THAN_HINH — macro MakeHuman) lẫn chữ prompt (THAN_EN).
 *  thon = nữ thon thả · gon = gọn, săn · vua = trung bình · beo = béo · gay = gầy gò · vam = vạm vỡ. Không khai → theo giới + tuổi (thanMacDinh). */
export type Than = 'thon' | 'gon' | 'vua' | 'beo' | 'gay' | 'vam';
export const THAN_EN: Record<Than, string> = { thon: 'slim, slender build', gon: 'lean, fit build', vua: 'average build', beo: 'heavyset, overweight build with a full round belly', gay: 'very thin, gaunt build', vam: 'muscular, broad-shouldered build' };
export const TEN_THAN: Record<Than, string> = { thon: 'Thon thả', gon: 'Gọn, săn', vua: 'Trung bình', beo: 'Béo', gay: 'Gầy gò', vam: 'Vạm vỡ' };
/** Phải khớp nguoi.py › than_mac_dinh. */
export const thanMacDinh = (gioi?: string, tuoi?: number): Than => { const t = tuoi ?? 30; return gioi === 'nu' && t < 45 ? 'thon' : gioi === 'nam' && t < 40 ? 'gon' : 'vua'; };
export type KhoiSet = { ten: string; /** đạo cụ: KHUÔN có hình thật (scripts/bo-set/mesh/dao-cu.py — ly · dien_thoai · ho_so · the_deo · thung · but) thay khối trơn, đúng co; anh = link ảnh mẫu dán mặt in (chữ trên bìa, mặt thẻ) */ dao_cu?: string; anh?: string; /** dáng người (Than) — hình khối 3D + chữ prompt cùng đọc */ than?: Than; /** người (hinh 'nguoi'): giới + tuổi cho thân người thật MPFB (mesh/nguoi.py › nguoi_mpfb) */ gioi?: 'nam' | 'nu'; tuoi?: number; /** người thật MPFB: kiểu tóc (gói tài sản: long01 · ponytail01 · bob01 · short02 …), màu tóc, bộ đồ (female_elegantsuit01 …; nhiều món 'áo+quần', món 'tên:#màu' giữ màu riêng; theo trang phục: { tên trang phục: đồ, '': mặc định } — gói cộng đồng cai-mpfb.sh) — mesh/nguoi.py › mac_do */ toc?: string; mau_toc?: string; do?: string | Record<string, string>; /** người thật: DA 3D SINH TỪ ẢNH đã rig (link da.blend — scripts/bo-set/nguoi-3d/gan-rig.py) thay thân MPFB khi dựng; da mặc sẵn đồ nên có thể theo trang phục: { tên trang phục: link } (cả người), { dau: link } (CHỈ ĐẦU — mặt + tóc từ da, thân + đồ MPFB theo khoi_3d.do của bộ đang mặc); đổi link = mã khối đổi → shot có người này dựng lại */ da_3d?: string | Record<string, string>; /** 'nguoi' = ma-nơ-canh người có khớp (phim người thật, co[2] = chiều cao cm) — scripts/bo-set/mesh/nguoi.py */ hinh: 'coc' | 'hop' | 'cau' | 'trung' | 'vom' | 'day' | 'non' | 'khan' | 'nguoi' | 'vong'; /** vòng đeo (vòng tay, chuỗi hạt, nhẫn): xuyến trục đứng, ngoài co[0] × co[1], dày co[2]; số hạt (chuỗi hạt) */ hat?: number; /** ma-nơ-canh: tư thế (ngồi = ghế cao ~ cẳng chân, tay đặt trước) + màu áo (mau = da) — người phụ / quần chúng của bộ set */ tu_the?: 'dung' | 'ngoi'; ao?: string; /** nón cụt: đỉnh = đáy × dinh (0..1) */ dinh?: number; tam?: number[]; co?: number[]; mau: string; xoay?: number; /** nghiêng quanh trục x của khối (độ, nắp laptop) */ nghieng?: number; sang?: number; diem?: number[][]; ban_kinh?: number };
export type VatSet = (KhoiSet | { ten: string; goc: number[]; xoay?: number; phan: Omit<KhoiSet, 'ten'>[] }) & { anchor?: string; /** mặt nền (mặt bàn, tường, kệ): ở đâu cũng có, không tính là vật chắn tiền cảnh */ nen?: boolean; /** KÍNH (cửa / vách kính): khung màu vẽ trong suốt, tia đo nhìn xuyên — người sau kính là thấy (dung-set.py › KINH) */ kinh?: boolean; /** đồ TUỲ CHỌN (laptop lúc có lúc không): chỉ có ở shot khai may_3d.them */ tuy_chon?: boolean; /** đồ tuỳ chọn là TRẠNG THÁI KHÁC của một / vài đồ set (cửa đôi MỞ thay cửa đóng + mảng tường khoét lỗ): shot khai them món này thì đồ tên này ẩn */ thay_cho?: string | string[]; /** tên tiếng Anh gửi mô hình ảnh (tên tiếng Việt như 'Mặt bàn') */ en?: string; /** mô hình đồ đạc THẬT (mã Poly Haven, tai-san/mo-hinh/<mã>) thay khối khi dựng Blender — dung-set.py › mo_hinh_that; en phải tả đúng mô hình */ mau_3d?: string };
/** ĐỒ SET ĐANG HIỆN của một shot: đồ thường + đồ tuỳ chọn shot khai them, trừ đồ bị một món tuỳ chọn đang hiện THAY (thay_cho). MỘT luật cho
 *  khung Blender (dung-set.py › dat_tuy_chon), xem trước three, kiểm đủ đạo cụ và bộ kiểm AI. */
/** KÍNH (cửa / vách kính): vật khai kinh, hoặc tên tiếng Anh là glass wall/door/partition/panel — CÙNG luật dung-set.py › LA_KINH. Khung màu vẽ trong
 *  suốt, tia đo nhìn xuyên; nhìn qua kính là cố ý nên cổng không tính kính là vật lấp / chắn khung (tổng tài 2.0b–c: máy sau cửa kính bị báo lấp 100%). */
export const laKinh = (v: { kinh?: boolean; en?: string }): boolean => !!v.kinh || /\bglass (wall|door|partition|panel)s?\b/i.test(v.en ?? '');

export const vatHien = <V extends Pick<VatSet, 'ten' | 'tuy_chon' | 'thay_cho'>>(vat: V[], them: Iterable<string> | null | undefined): V[] => {
  const t = new Set(them ?? []); const bo = new Set(vat.filter((v) => v.tuy_chon && v.thay_cho && t.has(v.ten)).flatMap((v) => (Array.isArray(v.thay_cho) ? v.thay_cho : [v.thay_cho!])));
  return vat.filter((v) => (!v.tuy_chon || t.has(v.ten)) && !bo.has(v.ten));
};
/** TÊN ĐỒ SET "CÓ MẶT" trong một shot (chữ thường): đồ đang hiện + anchor của chúng + đồ bị món tuỳ chọn đang bật THAY (cửa đóng khi shot bật "cửa mở": vẫn là
 *  cái cửa đó, ở trạng thái khác — thẻ {Thang máy 1} / đối tượng cùng tên không được coi là thiếu). Dùng cho cổng thiếu đồ (bo-set-3d.ts › thieuTrongSet) và
 *  cổng thẻ (kiem-ai-3d.ts › theSai). */
export const tenCoMat = (vat: Pick<VatSet, 'ten' | 'tuy_chon' | 'thay_cho' | 'anchor'>[], them: Iterable<string> | null | undefined): Set<string> => {
  const t = new Set(them ?? []);
  const thay = vat.filter((v) => v.tuy_chon && v.thay_cho && t.has(v.ten)).flatMap((v) => (Array.isArray(v.thay_cho) ? v.thay_cho : [v.thay_cho!]));
  return new Set([...vatHien(vat, them).flatMap((v) => [v.ten, v.anchor ?? '']), ...thay].map((x) => x.trim().toLowerCase()).filter(Boolean));
};
export type BoSet = { id: number; project: string; phim_id: number | null; ten: string; mo_ta: string; du_lieu: { vat: VatSet[]; ghi_chu?: string }; mat_bang_url: string | null; trang_thai: string };
/** Máy ảo + chỗ đứng nhân vật của một shot trong bộ set (cm): đầu vào dựng khung xám. nam = nằm sấp. */
export type May3d = { dat: number[]; nhin: number[]; ong_kinh: number; /** máy do datMayTuDong tính (phía ° quanh chủ thể) — bộ giải trong Blender được phép xoay / nâng / lùi máy cho chủ thể thấy rõ */ tu_dong?: { phia?: number; /** mã đầu vào lúc tính (chỗ đứng + phía + khung + cỡ/góc/ống) — nạp lại mà khớp thì GIỮ máy bộ giải đã tìm */ vao?: string };
  /** CỐ Ý vượt trục (POV chủ quan, cú lật trục có chủ đích): không kiểm trục shot này; shot sau so với shot thường gần nhất */ qua_truc?: boolean;
  /** máy chạy (ky_thuat.chuyen_dong) NHẮM vào ai: zoom / lia / theo / trượt bám tên này; trống = chủ thể đầu (duong-may.ts) */ nham?: string;
  /** CHUYỂN CHỦ THỂ (chuyen_dong 'chuyen_chu_the'): máy rời chủ thể mở, DỪNG trên người / vật này lúc kết; trống = chủ thể thứ hai của khung */ chuyen_toi?: string;
  /** CHỦ THỂ của khung: phải trong khung + không bị che (mặc định: hai vị trí đầu không 'an') */ khung?: string[]; vi_tri: { ten: string; /** chỗ ở lúc MỞ shot (cm) — khung xám dựng ở đây */ tam: number[]; /** chỗ ở lúc KẾT shot (đi / lăn / bay trong shot); không ghi = đứng yên */ den?: number[];
    /** hướng mặt lúc mở / kết (độ, 0 = nhìn về phía người ngồi −y, 90 = nhìn sang phải +x) — mắt khối 3D quay theo */ huong?: number; huong_den?: number;
    /** TRẠNG THÁI NHÂN VẬT lúc mở / kết (sổ script supervisor — tiếng Anh cho prompt: 'frizzed stiff with static', 'soaking wet'); trống = bình thường.
     *  lienMachTap chặn shot sau mở khác trạng thái shot trước để lại; prompt STATE đè lên ảnh mẫu. */ trang?: string; trang_den?: string;
    /** SỔ NGƯỜI (phim người thật — bo-set-3d.ts › SO_NGUOI): bề ngoài lúc mở / kết, tiếng Anh cho prompt. Không khai = chưa biết (hookup lấy từ shot
     *  trước); '' ở _den = bỏ ra (cởi áo khoác, tháo nhẫn). Giữ tới khi sang ngày truyện khác — riêng vet (vết thương, băng, sẹo) không tự hết. */
    trang_phuc?: string; trang_phuc_den?: string; toc?: string; toc_den?: string; trang_diem?: string; trang_diem_den?: string; do_deo?: string; do_deo_den?: string; vet?: string; vet_den?: string;
    /** đang được nhân vật này CẦM (kẹo trong tay Tango): đi theo người cầm, không kiểm chỗ riêng */ cam?: string;
    /** ĐỒ NGHIÊNG / LẬT lúc mở / kết (độ quanh trục ngang — ly lật giữa không trung #17); không khai = đứng thẳng */ nghieng?: number; nghieng_den?: number;
    /** CHẤT LỎNG ĐỔ RA từ vật đựng đang nghiêng (tên tiếng Anh, vd 'black coffee') + màu — dung-set.py › tran_ dựng dòng giọt ở khung mở (#17) */ tran?: string; tran_mau?: string;
    /** ĐỒ TREO lủng lẳng dưới tay người cầm (cm dây, vd thẻ đeo đung đưa #11) + màu dây — dung-set.py › gan_tay */ treo?: number; treo_mau?: string;
    /** món đang ĐEO (đi kèm cam = người đeo): khớp rig nơi nó nằm — 'cotay_t' / 'cotay_p' (cổ tay trái / phải nhân vật), 'co', 'nguc'. Không khai = cầm
     *  trong lòng bàn tay (dung-set.py › tay_cam) — tập 122 #22: chuỗi hạt cổ tay trái bị nhét vào lòng bàn tay phải */ deo?: string;
    /** CÁCH THÁO món đang đeo khi nó rời người đeo trong shot (mã thao-do.ts › CACH_THAO: giat_dut_khoa / nhac_qua_dau / mo_khoa / tuot). Không khai = mặc định
     *  theo nơi đeo + động tác người lấy; không suy ra được thì cổng chặn — #132 #15 thẻ bị kéo xuyên qua đầu Hạ */ thao?: string;
    /** ĐỘNG TÁC DIỄN trong shot (thư viện dung-set.py › DONG_TAC): 'ten@a-b' (a, b = phần thời lượng 0..1), vd 'phong3@0.05-0.3', 'toc_ru@0.5'.
     *  Chớp mắt + chúi tới khi đi là tự động */ dien?: string[];
    /** món RỜI KHỎI bộ set sau shot này (bị lấy đi / mang ra ngoài) — không còn tự đặt lại ở các shot sau */ het?: boolean;
    /** (máy tự thêm) chỗ / hướng / dáng / trạng thái mở NỐI từ kết của shot số này (hookup — bo-set-3d.ts › noiHookup) */ noi_tu?: number;
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
export type KhungXam = { ma: string; /** 'song' = đo trên 3D sống (do-3d-song.ts, không render — chỉ để chấm); không có = Blender dựng (có ảnh độ sâu / màu cho keyframe) */ nguon?: 'song'; /** LỚP GHÉP shot ≥ 2 người (dung-set.py › ve_lop): độ sâu nền không người + độ sâu riêng từng người, xa = cm tới máy (ghép xa trước) */ lop?: { nen: string; nguoi: { ten: string; sau: string; xa: number }[] }; /** XUYÊN NHAU ở khung mở (dung-set.py › do_lun): "<món> xuyên vào <vật> <cm> cm" — cổng chặn keyframe */ xuyen?: string[]; /** khung xương OpenPose người trong khung mở (dung-set.py › ve_xuong) — bước 1 keyframe điều khiển độ sâu + dáng */ xuong?: string; /** MẶT NẠ 3D (dung-set.py › ve_mat_na): 'nd:<vật>' tấm ảnh chuẩn (+ 4 góc p trên khung ↔ uv trên ảnh) · 'ng:<tên>' thân người — ghép đè / sửa vùng */ mat_na?: Record<string, { url: string; goc?: { p: number[]; uv: number[] | null }[] }>; /** MÓN ĐỘNG (dung-set.py › ve_mat_na dong): mặt nạ từng người 'ngd:<tên>' / đạo cụ 'vat:<tên>' ở khung mở / kết / giữa. kết / giữa chỉ có khi MÁY CHỈ XOAY TẠI CHỖ (đứng yên hoặc lia theo người) —
   *  ảnh kết / giữa chép nền từ keyframe mở, AI chỉ vẽ trong hợp các mặt nạ (ghep-vung.ts › ghepNenKet) */ dong?: { mo: Record<string, string>; ket?: Record<string, string>; giua?: Record<string, string>; /** 4 góc khung kết / giữa (trên-trái, trên-phải, dưới-phải, dưới-trái) đặt trên khung MỞ, x y 0..1 — máy xoay tại chỗ (đúng) hoặc dời chỗ (tia trúng bộ set, gần đúng) */ ket_goc?: number[][]; giua_goc?: number[][]; /** máy DỜI CHỖ ở kết / giữa (đẩy máy, dolly) — đồng phẳng chỉ gần đúng, đòi ảnh đầu khớp bố cục 3D; xoay / zoom tại chỗ thì đúng tuyệt đối */ ket_doi_cho?: boolean; giua_doi_cho?: boolean }; /** khung màu GIỮA shot (t = 0,5) — khung khoá thứ ba cho video nhiều khung */ mau_giua?: string; /** các khung khoá GIỮA của bản diễn Blender (t = ¼ · ½ · ¾, dung-set.py XV_DIEN) — thắng mau_giua; video nhiều khung nhận đủ */ giua?: string[]; /** clip diễn Blender cả shot (mp4, 0đ) */ dien?: string; /** mã từng phần đầu vào (ban / set / may / khoi) — biết vì sao khung cũ */ ma_phan?: Record<string, string>; /** ảnh khung để hiện (khung màu nếu có, không thì khung xám) */ xam: string; /** (cũ) bản đồ độ sâu — đã bỏ */ sau?: string; /** KHUNG MÀU (previs có vật liệu + ánh sáng, EEVEE) — ảnh tham chiếu số 1 của keyframe khi có */ mau?: string;
  /** khung màu ở chỗ KẾT — từ BAN_DUNG 82 mọi shot đều có (storyboard đầu → kết); ảnh số 1 của keyframe kết */ mau_ket?: string;
  /** shot thật sự ĐỔI khung trong clip (người đi / quay, cú máy liền mạch) → cần keyframe KẾT (tốn tiền). false = khung kết chỉ để xem. Khung cũ không có trường này: có mau_ket là đổi. */ ket_dong?: boolean;
  /** chuyển động trên màn: chỗ mở → chỗ kết của từng món (0..1, gốc trên-trái) — câu chuyển động cho video sinh từ đây */ di?: { ten: string; tu: number[]; den: number[] }[]; luc: string; kiem: { nhan_vat: string; bat_buoc?: boolean; trong_khung: boolean; cao_khung_pt: number; bi_che_boi: string[]; /** hộp bao trên màn (0..1, gốc trên-trái, gồm phần bị che) */ khung?: number[]; /** dáng TỰA (chống bàn) ở khung mở mà điểm chạm cách mặt đỡ bấy nhiêu cm (dung-set.py › tua_hong) */ tua_hong?: number }[];
  /** THẤY GÌ trong khung (dung-set.py › nhin_thay, đo bằng lưới tia): tên vật / nhân vật · % khung · hộp bao [x0,y0,x1,y1] 0..1 gốc trên-trái ·
   *  tien = nằm trước chủ thể (vật chắn tiền cảnh). Lưới gắn nhãn, cổng bắt vật chắn, prompt keyframe gọi tên từng khối. */
  thay?: VatThay[] };
export type VatThay = { ten: string; /** khối là NGƯỜI (nhân vật / người phụ của set) — prompt đếm số người */ nguoi?: boolean; /** tên tiếng Anh cho prompt (vat.en) — mô hình ảnh không hiểu 'Mặt bàn', 'Tường phải' */ en?: string; /** trạng thái lúc dựng (đã chia mảnh…) — nhãn keyframe nói rõ, không để model vẽ theo ảnh mẫu nguyên vẹn */ trang?: string; pt: number; hop: [number, number, number, number]; tien: boolean };
export type GiongThu = { model: string; voice: string; url: string; cau: string; luc: string };
export type NhanVat = { id: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string;
  /** tiểu sử (nhân vật): nguồn gốc, tính cách, sức mạnh, điểm yếu, mong muốn, nỗi sợ, quan hệ, bí mật — chỉ vào ngữ cảnh viết kịch bản, không vào prompt hình */
  tieu_su?: string;
  /** bộ âm hiệu cố định (phim không lời): âm đặc trưng, vui, sợ… — làm một lần, mọi tập dùng lại */
  am_hieu?: { ten: string; mo_ta: string; url: string }[]; /** LoRA mặt nhân vật (scripts/lora/hoc-lora.mts) — keyframe vẽ một lượt độ sâu 3D + LoRA */ lora?: { url: string; trigger: string; bo_hoc?: string; so_anh?: number; luc?: string } | null; anh_ref: string[]; /** ảnh SÁT MẶT máy cắt từ ảnh mẫu (soi-mat.ts › damBaoAnhMat) — phim người thật kèm vào lượt sinh để giữ đúng mặt */ anh_mat?: { tu: string; url: string[]; /** góc quay đầu đo trên từng ảnh (độ, + = quay sang PHẢI màn; soi-mat.py › nhin_mat) — sửa hướng nhìn chọn ảnh quay đúng phía */ dau?: (number | null)[] } | null; giong: string; giong_model: string; giong_id: string; giong_mau_url: string | null;
  /** GIỌNG ĐÃ THỬ (casting): mỗi lượt thử / nghe thử một dòng — chọn lại trên thẻ nhân vật không phải sinh lại; model = khoá như giong_model */
  giong_thu?: GiongThu[]; doi_chieu?: DoiChieu | null; bien_the?: BienThe[];
  /** CÂY BỘ BỐI CẢNH: cấu kiện / đồ vật thuộc về anchor cha nào (bối cảnh hoặc đạo cụ cùng phim) — null = gốc, hiện độc lập */ thuoc_id?: number | null;
  /** bối cảnh: thuộc bộ set nào + vùng (tâm cm) trong set; nhân vật / đạo cụ: khối đại diện 3D (cỡ cm) */ bo_set_id?: number | null; vung?: { tam: number[]; ban_kinh?: number } | null; khoi_3d?: { hinh: KhoiSet['hinh']; co: number[]; mau: string; /** có mắt (nhân vật): khung xám vẽ hai mắt chỉ hướng nhìn */ mat?: boolean; /** người: DÁNG NGHỈ tính cách (mã TU_THE_NGUOI, vd ['dung_doi_chan', 'tay_tui']) — dựng 3D tự chồng khi đứng yên (dung-set.py › dien_hl) */ dang?: string[]; /** phần thêm, toạ độ tương đối đáy giữa khối */ phan?: Omit<KhoiSet, 'ten'>[] } | null };

/** Phim quảng cáo mà chưa khai sản phẩm (mục 0) → lý do chặn; MỘT luật cho nút ở trình duyệt lẫn gác ở máy chủ. */
export function thieuQc(loai: LoaiPhim, kt: KinhThanh | null | undefined): string | false {
  if (loai !== 'quang_cao') return false;
  const q = kt?.qc;
  return !(q?.ten?.trim() || q?.link?.trim() || q?.diem_noi_bat?.trim()) && 'khai sản phẩm/dịch vụ ở mục 0 trước (hoặc dán link rồi bấm Lấy từ link)';
}
/** Độ dài clip model sinh được: 4 / 6 / 8 giây (Veo). Shot phát ngắn hơn thì cắt (phat_s). */
export const lamTronClip = (giay: number): 4 | 6 | 8 => (giay <= 4 ? 4 : giay <= 6 ? 6 : 8);
/** Số giây shot THỰC PHÁT trên timeline / bản dựng: phat_s nếu đã cắt, không thì cả clip. */
/** Giây phát của shot. Clip có ĐIỂM CẮT CUỐI (ảnh thứ 2 có dải nhịp — cat-cuoi.ts) thì không phát quá điểm đó: sau nó là đoạn hoà tan ra dải nhịp. */
export const giayPhat = (c: Pick<Canh, 'phat_s' | 'thoi_luong_s'> & { cat_cuoi_s?: number | null }): number => {
  const g = c.phat_s && c.phat_s > 0 ? c.phat_s : c.thoi_luong_s || 4;
  return c.cat_cuoi_s && c.cat_cuoi_s > 0 ? Math.min(g, c.cat_cuoi_s) : g;
};
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
  // Thiết kế sản xuất: mọi khía cạnh bề ngoài của nhân vật (SO_NGUOI) đều là một NHÓM biến thể có ảnh mẫu riêng — tạo hình chuẩn bị sẵn như đạo cụ.
  nhan_vat: [{ key: 'bieu_cam', label: 'Biểu cảm' }, { key: 'trang_phuc', label: 'Trang phục' }, { key: 'toc', label: 'Đầu tóc' }, { key: 'trang_diem', label: 'Trang điểm' }, { key: 'do_deo', label: 'Kính / phụ kiện' }, { key: 'vet', label: 'Vết / dấu trên người' }, { key: 'trang', label: 'Trạng thái cơ thể' }, { key: 'tu_the', label: 'Tư thế / hành động' }],
  san_pham: [{ key: 'goc_may', label: 'Góc chụp' }, { key: 'ngu_canh', label: 'Ngữ cảnh dùng' }, { key: 'trang_thai', label: 'Trạng thái / màu' }],
  boi_canh: [{ key: 'goc_may', label: 'Góc máy' }, { key: 'thoi_diem', label: 'Thời điểm / thời tiết' }],
  dao_cu: [{ key: 'trang_thai', label: 'Trạng thái' }, { key: 'goc_may', label: 'Góc' }],
  phong_cach: [{ key: 'trang_thai', label: 'Biến tấu' }],
  cau_kien: [{ key: 'goc_may', label: 'Góc' }, { key: 'vat_lieu', label: 'Vật liệu / màu' }],
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
/** SOI MẶT (soi-mat.ts): mặt trong keyframe so với ảnh mẫu nhân vật. ket: nhân vật có ảnh mẫu mặt người; giong null = không thấy mặt trong khung (quay lưng, qua vai) —
 *  không phải lệch. dat = mọi mặt thấy được đều giống ảnh mẫu (cosine SFace ≥ 0,363). url = keyframe đã soi. */
export type TayDo = 'cao' | 'giua' | 'thap' | null;
export type SoiMat = { url: string; luc: string; mat: number; ket: { ten: string; giong: number | null; dat: boolean; /** mặt giống ảnh mẫu đạt ngưỡng — gán TIN được (không phải mặt người khác gán nhầm) */ tin?: boolean; /** TƯ THẾ tay theo giải phẫu (soi-mat.py › tu_the): cao trên vai · giua · thap buông ngang hông */ tay?: { phai?: TayDo; trai?: TayDo }; /** hộp mặt chuẩn hoá [x, y, w, h] 0..1 */ hop?: number[]; /** phía sáng trên mặt −1..1 (+ = sáng từ phải màn) */ sang?: number; /** mặt quá nhỏ để chấm (< 64 px) — không chặn */ nho?: boolean; /** mặt quay nghiêng nhiều — bộ so mặt không tin được, không chặn */ nghieng?: boolean; /** tâm mặt theo phần khung 0..1 */ o?: { x: number; y: number }; /** HƯỚNG NHÌN đo trên ảnh (soi-mat.py › nhin_mat): g = độ ngang (+ = phải màn), dau = quay đầu, mat = lệch con ngươi, doc = ngẩng; can = phía phải nhìn theo 3D (+1 phải / −1 trái màn, bo-set-3d.ts › canNhin) */ nhin?: { g: number; dau: number; mat: number; doc: number; /** nét mặt đo (blendshapes 0..1): ha = há miệng, cuoi, nhiu = nhíu mày, mim = mím môi */ net?: { ha: number; cuoi: number; nhiu: number; mim: number }; can?: 1 | -1; /** phía cần nhìn lấy theo cặp shot (khung.ts › canTheoCap): thu_tu shot đối đáp */ tu?: number } }[]; dat: boolean; duyet_tay?: string; loi?: string };
/** Điểm prompt của shot (kiem-prompt.ts, ghi bởi diem-prompt.ts): 100 − tổng phạt; lỗi phạt ≥ 20 chặn sinh. */
export type DiemPrompt = { diem: number; diem_keyframe: number; diem_video: number; loi: { buoc: string; ma: string; phat: number; chu: string }[]; luc: string };
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
/** khuon_chuoi = các lần áp khuôn chuỗi shot trong tập (khuon-chuoi.ts, xv_tap.khuon_chuoi) — làn 🧭 Khuôn trên timeline. */
/** khan_gia = ý đồ khán giả theo đoạn shot (khan-gia.ts, xv_tap.khan_gia) — làn 🎭 trên timeline. */
/** Phân cảnh vẽ của một cảnh (xv_tap.phan_canh_ve — scripts/bang-gom.mts): tổng quan → chi tiết. phac = tờ phác bố trí máy vẽ từ sơ đồ (0đ) · t1 = thumbnail cả cảnh (AI) · khoi = bảng khối vẽ lại chi tiết. */
export type PhanCanhVe = { phan_doan: string; phac?: string; t1?: string; khoi?: { tu: number; den: number; url: string }[]; luc: string };
export type Tap = { /** nguồn không gian 2D theo cảnh (khong-gian.ts) — phim không 3D */ khong_gian?: import('./khong-gian').KhongGianTap; phan_canh_ve?: PhanCanhVe[]; khuon_chuoi?: ApKhuon[]; khan_gia?: import('./khan-gia').YDoKhanGia[]; ho_so?: TapHoSo; id: number; phim_id: number; so: number; ten: string; brief: string; noi_khung: boolean; nhac_url: string | null; nhac_mo_ta: string; nhac_phan_canh: Record<string, string>; beats: Beat[]; phan_canh: PhanCanh[]; kich_ban: string; tom_tat: string; trang_thai: string; video_url: string | null; so_canh: number; thoi_luong_s: number | null; xuat: BanXuat[]; bai_dang: BaiDang | null; lop: Lop[]; thu_nguoi_xem?: ThuNguoiXem | null };
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
  /** trạng thái KẾT shot — đuôi shot gieo CỚ cho cắt sang shot sau (ánh mắt / tiếng / động tác) */ ket?: string;
  /** khung GIỮA (động tác khó đọc — #353 #7 cú giật) — tiếng Anh cho prompt */ giua?: string;
  /** câu tả tiếng Việt từng khung cho storyboard đọc như truyện (đầu / giữa / cuối) */ mo_vi?: string; giua_vi?: string; ket_vi?: string;
  /** câu hướng ở khung CUỐI (sơ đồ cảnh — so-do-canh.ts › cauHuong trên trạng thái kết) */ huong_ket?: string;
  /** CỚ CẮT sang shot sau (noi-nhip.ts): nhin · tieng · dong_tac · phan_ung */ noi?: 'nhin' | 'tieng' | 'dong_tac' | 'phan_ung';
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
  { key: 'dien', ten: 'Diễn xuất (lấy đà · hành động · phản ứng)', mau: 'Anticipation: Tango crouches and wiggles. Action: leaps, arms wide. Reaction: freezes mid-air a beat, then drops face-first (squash), strand boings.', vaoModel: true },
  { key: 'nhan', ten: 'Điểm nhấn âm–hình', mau: 'Giây 2,8: kẹo phụt khỏi tay — tiếng "bloop" đúng khung; nhạc ngắt 1 nhịp trước cú ngã.', vaoModel: false },
];
/** Ô thẻ shot BẮT BUỘC trước keyframe (motif + điểm nhấn tuỳ shot — điểm nhấn bắt buộc ở shot có cú bùng của gag, ho-so.ts › kiemHoSo). */
export const O_DAN_DUNG_BAT_BUOC = O_DAN_DUNG.filter((o) => o.key !== 'motif' && o.key !== 'nhan');
// 🧩 CON BÓC TÁCH KHUNG — thành phần THẬT đọc được từ một keyframe (boc-tach-khung.ts). Mỗi đối tượng: đặc điểm + vị trí TƯƠNG ĐỐI (cạnh ai/vật gì).
export type NguoiKhung = { ai: string; dac_diem: string; vi_tri: string; ao: string; toc: string; trang_suc: string; bieu_cam: string; huong_nhin: string; dang: string; do_cam: string;
  /** 🧬 lá nguyên tử enum (mức 2) — máy đọc ảnh điền theo từ khóa chuẩn, để chấm SO BẰNG; cũ không có thì bỏ qua. */ vi_tri_man?: string; huong_man?: string; toc_kieu?: string };
export type DoKhung = { ten: string; dac_diem: string; trang_thai: string; vi_tri: string;
  /** 🧬 lá nguyên tử enum: ai giữ (tên nhân vật / "không ai"), cách giữ, vị trí màn. */ nguoi_giu?: string; cach_giu?: string; vi_tri_man?: string };
export type BocTachKhung = { boi_canh: string; vat_co_dinh: string[]; anh_sang: string; khung_hinh: string; goc_may: string; bo_cuc: string; nguoi: NguoiKhung[]; dao_cu: DoKhung[]; chu_tren_hinh: string; ghi_chu: string };
// ⚖️ Một dòng đối chiếu dự kiến ↔ bóc-từ-ảnh (doi-chieu-khung.ts). muc: khớp | gần | lệch | thiếu (dự kiến có, ảnh không) | thừa (ảnh có, dự kiến không).
export type DongDoiChieu = { thanh_phan: string; du_kien: string; thuc_te: string; muc: 'khớp' | 'gần' | 'lệch' | 'thiếu' | 'thừa'; ghi_chu: string };
export type BocTachCanh = { dau?: BocTachKhung; cuoi?: BocTachKhung; doi_chieu?: { dau?: DongDoiChieu[]; cuoi?: DongDoiChieu[] }; luc_boc: string; tren: { dau: string | null; cuoi: string | null } };

export type Canh = {
  id: number; tap_id: number; thu_tu: number; canh: string; goc_may: string; hanh_dong: string; /** mô tả tiếng Việt của hành động (#1397) — đọc qua moTaVi */ hanh_dong_vi: string; loi_thoai: string; am_thanh: string; thoai_url: string | null; am_thanh_url: string | null; phan_doan: string; cam_xuc: number; ky_thuat: KyThuatShot; thoai: DongThoai[]; trang_phuc: string;
  /** Giây thực phát (cắt từ đầu clip); null = phát cả clip. chu_man = chữ trên màn. nhanh = '' thân chung | 'A'/'B'/'C' biến thể hook. */
  phat_s: number | null; chu_man: string; nhanh: string;
  /** kiểu chữ màn riêng của shot (đè kieu_chu của phim). */
  kieu_chu: KieuChu;
  /** bản dịch chữ màn theo ngôn ngữ (ban-dich.ts › theoNgonNgu); goc lệch chu_man hiện tại = cũ. */
  chu_man_dich?: Record<string, { goc: string; chu: string }>;
  thoi_luong_s: number; nhan_vat: number[]; bien_the: number[]; prompt_anh: string; prompt_video: string; dang_sinh_anh?: boolean; dang_sinh_am?: boolean; /** ISO lúc sinh xong keyframe / clip đang dùng (dsCanh, #1384) */ keyframe_luc?: string | null; video_luc?: string | null; dang_sinh_giong?: boolean; dang_sinh_sfx?: boolean;
  dan_dung?: DanDung;
  kiem_khung?: KiemKhung | null; /** điểm prompt (diem-prompt.ts) */ diem_prompt?: DiemPrompt | null;
  soi_mat?: SoiMat | null;
  /** 🧩 Con bóc tách (boc-tach-khung.ts): thành phần THẬT bóc ra từ keyframe đã sinh (đầu/cuối) — để đối chiếu với dự kiến. */ boc_tach?: BocTachCanh | null;
  /** máy soi clip (soi-clip.ts) — chỉ áp khi url trùng clip đang dùng */ soi_clip?: SoiClip | null;
  /** MURCH QC (qc-cam-xuc.ts): kế hoạch biểu cảm từng nhân vật (đầu → cuối, cấm) · khung đầu = khung cuối clip shot trước · kết quả soát thật */
  bieu_cam?: import('./qc-cam-xuc').BieuCamNv[]; noi_lien?: boolean; soat?: import('./qc-cam-xuc').SoatShot | null;
  may_3d?: May3d | null;
  khung_xam?: KhungXam | null;
  /** nguồn của TỪNG tệp (keyframe ứng viên, clip nháp/cuối): url → nhãn ngắn + đủ (cổng · model · model thật · tiền thật) — actions.ts › dsCanh */
  nguon_tep?: Record<string, { ngan: string; day: string }>;
  /** job video đang chạy của shot: cổng · model đang áp dụng (ngan) + các bước dự phòng đã thử (day) */
  video_dang?: { ngan: string; day: string };
  /** nguồn tham khảo của từng câu chữ màn / lời (tham-khao.ts) — QC bắt buộc */ tham_khao?: import('./tham-khao').ThamKhaoCau[];
  keyframe_url: string | null; keyframe_uv: string[];
  /** keyframe KẾT (khung cuối, sinh từ khung màu chỗ kết) — video nhận làm ảnh cuối */ keyframe_ket?: string | null; /** keyframe GIỮA (khung 3D giữa clip) — ô giữa dải nhịp của ảnh thứ 2 */ keyframe_giua?: string | null; /** giây cắt cuối clip (trước lúc dải nhịp hiện) */ cat_cuoi_s?: number | null; video_url: string | null; video_cuoi_url: string | null; nguon_video: Record<string, unknown>; video_phien_ban: { url: string; ban: 'nhap' | 'cuoi'; model?: string; job?: number; luc?: string }[]; trang_thai: TrangThaiCanh; loi: string; chi_phi_cents: number;
};
export type Job = {
  id: number; canh_id: number | null; nhan_vat_id: number | null; loai: string; provider: string; model: string;
  trang_thai: string; task_id: string | null; output_url: string | null; chi_phi_cents: number; loi: string; created_at: string;
  phim_id?: number | null; nhan?: string; tokens_in?: number; tokens_out?: number; phim_ten?: string;
  /** nguồn lượt sinh: cổng · model thật · tiền thật · chuỗi dự phòng (cong-ai.ts) */ nguon?: import('./cong-ai').NguonSinh | null;
};

/** Giá Claude (USD / 1M token in/out, docs Anthropic 09/2026) → cents. */
const GIA_CHU: Record<string, [number, number]> = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5],
  // máy soi biến dạng clip (soi-bien-dang.ts) — giá niêm yết Gemini API, USD / 1M token (token suy nghĩ tính vào out); 3.8 Flash: giá khởi điểm
  // tới 31/12/2026, từ 01/01/2027 là [1.5, 7.5] (ai.google.dev/gemini-api/docs/pricing, tra 17/10/2026)
  'gemini-3.8-flash': [0.75, 3.75], 'gemini-3.5-flash-lite': [0.3, 2.5], 'gemini-3.1-pro-preview': [2, 12],
  // Claude qua đại lý ShopAIKey: credit $1 = 3.250₫ thật (≈ 1/8 giá đô) → giá gốc × 0,125 (claude.ts › goiClaude)
  'shopaikey:claude-sonnet-5-5': [0.25, 1.25], 'shopaikey:claude-opus-5-5': [0.5, 2.5],
  // Claude qua ckey.vn (đường CHÍNH từ 20/10/2026, claude.ts › client): ckey báo tiền thật mỗi lượt (ghiTienChu dùng số đó); bảng này chỉ để ƯỚC trước
  // khi chạy — lấy mức cao của 3 lượt đo 19/10/2026 (3–12₫ / 1k token, 26.000₫ ≈ $1) để giá trên nút không thấp hơn thật
  'ckey:claude-opus-5-5': [0.46, 0.46], 'ckey:claude-sonnet-5-5': [0.4, 0.4], 'ckey:claude-haiku-4-5': [0.15, 0.15] };
/** Cộng token của nhiều lượt chữ; vnd (tiền thật ckey báo) chỉ giữ khi MỌI lượt có — thiếu một lượt thì cả cụm ước theo token (ghiTienChu). */
export const congTk = (...ts: { in: number; out: number; vnd?: number }[]): { in: number; out: number; vnd?: number } => {
  const t = { in: ts.reduce((a, x) => a + x.in, 0), out: ts.reduce((a, x) => a + x.out, 0) };
  return ts.length && ts.every((x) => x.vnd != null) ? { ...t, vnd: ts.reduce((a, x) => a + x.vnd!, 0) } : t;
};
/** Giá ƯỚC trước khi chạy một lượt Claude theo đường sẽ đi (ckey trước — claude.ts › client); model không có trên ckey thì giá trực tiếp. */
export const giaChuUoc = (model: string, tin: number, tout: number): number => giaChuCents(GIA_CHU[`ckey:${model}`] ? `ckey:${model}` : model, tin, tout);
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
/** Anchor còn THIẾU gì để làm tham chiếu — MỘT luật cho cổng shot (thanhPhanCanh) và báo cáo chuẩn bị (phan-ra-thuan.ts › baoCaoChuanBi).
 *  Bối cảnh có bộ set 3D: khung xám / khung đẹp của set LÀ ảnh tham chiếu (sinh-anh.ts bỏ ảnh bối cảnh khỏi tham chiếu khi có khung xám;
 *  sinh-anh-phim --anchor cũng không sinh ảnh cho nó) — đòi thêm ảnh gốc là chặn oan (tập 122, 17/10/2026: 3 bối cảnh chặn cả 20 shot). */
export function thieuAnchor(nv: Pick<NhanVat, 'mo_ta' | 'anh_ref' | 'loai' | 'bo_set_id'>): ('chưa tả đặc tính' | 'chưa có ảnh gốc')[] {
  const t: ('chưa tả đặc tính' | 'chưa có ảnh gốc')[] = [];
  if (!nv.mo_ta.trim()) t.push('chưa tả đặc tính');
  if (!nv.anh_ref.length && !(nv.loai === 'boi_canh' && nv.bo_set_id)) t.push('chưa có ảnh gốc');
  return t;
}
export function thanhPhanCanh(c: Pick<Canh, 'nhan_vat' | 'bien_the'>, nhanVat: NhanVat[]): { ds: ThanhPhanCanh[]; thieu: string[] } {
  const ds = c.nhan_vat.map((id) => nhanVat.find((v) => v.id === id)).filter((v): v is NhanVat => !!v).map((nv) => {
    // MỌI biến thể của anchor gắn ở shot (phục trang + từng phụ kiện + từng vết…) đều phải có ảnh — trước đây chỉ kiểm món đầu, đồng hồ/kính thiếu ảnh lọt cổng
    const bts = (nv.bien_the ?? []).filter((b) => c.bien_the.includes(b.id));
    const bt = bts[0] ?? null;
    const thieu = [...thieuAnchor(nv).map((x) => `${nv.ten}: ${x}`), ...bts.filter((b) => !b.anh_url).map((b) => `${nv.ten} · ${b.ten}: biến thể chưa có ảnh`)];
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
