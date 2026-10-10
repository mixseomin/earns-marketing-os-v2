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

/** Một dòng thoại kiểu kịch bản phim: ai nói · diễn xuất · lời · file giọng (nếu đã sinh). */
/** tre = giây bắt đầu đọc tính từ đầu shot (chép nhịp QC mẫu: giọng vào ở 0,47s); bỏ trống = nối ngay sau dòng trước. */
export type DongThoai = { nhan_vat: string; dien_xuat: string; loi: string; url?: string | null; tre?: number;
  /** giọng đã đọc file url ("model|voice") — ghi lúc job giọng xong; bản xuất dùng để bắt lời dẫn lẫn giọng. */
  giong?: string };
/** Ghép dòng thoại thành chuỗi loi_thoai (tương thích chỗ cũ: animatic, tìm người nói). */
export const ghepThoai = (ds: DongThoai[]) => ds.filter((d) => d.loi.trim()).map((d) => `${d.nhan_vat ? `${d.nhan_vat}${d.dien_xuat ? ` (${d.dien_xuat})` : ''}: ` : ''}"${d.loi.trim()}"`).join('\n');
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
  qc?: ThongTinQc;              // phim quảng cáo: sản phẩm/dịch vụ — AI mọi bước dựa vào đây (#1201)
  /** Giọng LỜI DẪN của cả phim — khoá ở lượt sinh giọng lời dẫn đầu tiên, mọi câu sau đọc cùng giọng (10/10/2026: phim #5 lời dẫn
   *  rơi về giọng mặc định George nam trong khi QC mẫu là giọng nữ). Phim có QC mẫu mà chưa chọn → không sinh giọng lời dẫn. */
  giong_dan?: { model: string; voice: string } | null;
};
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
  y?: number; nen?: string };
/** ngang = độ rộng chữ % (ASS ScaleX; <100 = chữ hẹp như font QC mẫu). co = cỡ chữ ASS / bề ngang (ASS tính theo chiều cao dòng → chữ nhỏ hơn cùng số px của drawtext). */
export const KIEU_CHU_MAC_DINH = { font: 'DejaVu Sans', mau: '#FFFFFF', vien: '#000000', nhan: '', co: 0.062, vien_day: 0.07, ngang: 100 };
export const FONT_CHU: { key: string; ten: string }[] = [{ key: 'DejaVu Sans', ten: 'DejaVu Sans Bold (mặc định)' }, { key: 'Montserrat Black', ten: 'Montserrat Black' }, { key: 'Montserrat ExtraBold', ten: 'Montserrat ExtraBold' }];
export const VI_TRI_CHU: { key: ViTriChu; ten: string }[] = [{ key: 'tren', ten: 'Trên' }, { key: 'giua', ten: 'Giữa' }, { key: 'duoi', ten: 'Dưới' }];
export type ThongTinQc = {
  ten: string; link: string; diem_noi_bat: string; doi_tuong: string; uu_dai: string; thi_truong: string; anh: string[];
  /** QC mẫu làm khuôn (tuỳ chọn). logo_url = logo chèn góc trên phải khi xuất. vi_tri_chu = chỗ đặt chữ màn. */
  mau?: MauQc; logo_url?: string; vi_tri_chu?: ViTriChu; kieu_chu?: KieuChu;
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
export const coTiengViet = (s: string): boolean => /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵÀÁẢÃẠẰẮẲẴẶẦẤẨẪẬÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ]/.test(s);
/** Mọi chữ của một shot (nhãn, góc máy, hành động, âm thanh, phân đoạn, trang phục, prompt, chữ màn, thoại kể cả diễn xuất + người nói). */
type ShotChu = Pick<Canh, 'thu_tu' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'canh' | 'goc_may' | 'hanh_dong' | 'am_thanh' | 'phan_doan' | 'trang_phuc' | 'prompt_anh' | 'prompt_video'>>;
const chuShot = (c: ShotChu): string => [c.chu_man, c.canh, c.goc_may, c.hanh_dong, c.am_thanh, c.phan_doan, c.trang_phuc, c.prompt_anh, c.prompt_video,
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
  giong_dan: null,
};
export const docKinhThanh = (kt: KinhThanh | null | undefined): Required<KinhThanh> => ({ ...KINH_THANH_MAC_DINH, ...(kt ?? {}) });

export type Phim = {
  id: number; project: string; ten: string; loai: LoaiPhim; mo_ta: string; kinh_thanh: KinhThanh; trang_thai: string;
  so_tap: number; so_nhan_vat: number; so_canh: number; chi_phi_cents: number; updated_at: string;
};
export type BienThe = { id: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string; anh_url: string | null };
/** Claude nhìn ảnh gốc của anchor so với mô tả: lệch chỗ nào (màu, ren, khoá, chữ thương hiệu…) + mô tả viết lại theo ảnh. */
export type DoiChieu = { khop: boolean; lech: string[]; mo_ta_de_xuat: string; luc: string };
export type NhanVat = { id: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref: string[]; giong: string; giong_model: string; giong_id: string; giong_mau_url: string | null; doi_chieu?: DoiChieu | null; bien_the?: BienThe[] };

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
export type Tap = { id: number; phim_id: number; so: number; ten: string; brief: string; noi_khung: boolean; nhac_url: string | null; nhac_mo_ta: string; nhac_phan_canh: Record<string, string>; beats: Beat[]; phan_canh: PhanCanh[]; kich_ban: string; tom_tat: string; trang_thai: string; video_url: string | null; so_canh: number; thoi_luong_s: number | null; xuat: BanXuat[]; bai_dang: BaiDang | null };
/** Một bản xuất MP4 của tập (mỗi nhánh hook một tệp). */
/** Kho tài sản dùng lại (xv_tai_san): clip/keyframe đạt, nhạc nền, preset giọng, khuôn QC, kiểu chữ thương hiệu. */
export type LoaiTaiSan = 'clip' | 'anh' | 'nhac' | 'giong' | 'khuon_qc' | 'kieu_chu';
export const LOAI_TAI_SAN: { key: LoaiTaiSan; ten: string; icon: string }[] = [
  { key: 'clip', ten: 'Clip', icon: '🎞' }, { key: 'anh', ten: 'Keyframe', icon: '🖼' }, { key: 'nhac', ten: 'Nhạc nền', icon: '🎵' },
  { key: 'giong', ten: 'Giọng', icon: '🗣' }, { key: 'khuon_qc', ten: 'Khuôn QC', icon: '🧩' }, { key: 'kieu_chu', ten: 'Kiểu chữ', icon: '🔤' },
];
export type TaiSan = { id: number; loai: LoaiTaiSan; ten: string; url: string | null; thuong_hieu: string; san_pham: string; the: string[]; mo_ta: string;
  so_do: Record<string, unknown> & { keyframe_url?: string | null; ti_le?: string; dai?: number }; du_lieu: Record<string, unknown>;
  nguon: { phim_id?: number; tap_id?: number; canh_id?: number; job_id?: number }; chi_phi_cents: number; so_lan_dung: number; created_at: string };
/** canh_bao = lệch chuẩn máy đo sau xuất (khoảng im, lẫn giọng, thiếu nhạc) — có là bản chưa đạt, studio tô đỏ. */
export type BanXuat = { url: string; nhanh: string; giay: number; luc: string; job?: number; canh_bao?: string[] };
export type Canh = {
  id: number; tap_id: number; thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; am_thanh: string; thoai_url: string | null; am_thanh_url: string | null; phan_doan: string; cam_xuc: number; ky_thuat: KyThuatShot; thoai: DongThoai[]; trang_phuc: string;
  /** Giây thực phát (cắt từ đầu clip); null = phát cả clip. chu_man = chữ trên màn. nhanh = '' thân chung | 'A'/'B'/'C' biến thể hook. */
  phat_s: number | null; chu_man: string; nhanh: string;
  /** kiểu chữ màn riêng của shot (đè kieu_chu của phim). */
  kieu_chu: KieuChu;
  thoi_luong_s: number; nhan_vat: number[]; bien_the: number[]; prompt_anh: string; prompt_video: string; dang_sinh_anh?: boolean; dang_sinh_am?: boolean; dang_sinh_giong?: boolean; dang_sinh_sfx?: boolean;
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
export function doanChuMan(chu: string, phat: number): { tu: number; den: number; dong: string[] }[] {
  const out: { tu: number; den: number; dong: string[] }[] = [];
  for (const dong of chu.split('\n')) {
    const m = dong.match(/^\s*@(\d+(?:[.,]\d+)?)s?\s+(.*)$/);
    if (m) out.push({ tu: Math.min(phat, Number(m[1]!.replace(',', '.'))), den: phat, dong: [m[2]!.trim()] });
    else if (dong.trim()) { if (!out.length) out.push({ tu: 0, den: phat, dong: [] }); out[out.length - 1]!.dong.push(dong.trim()); }
  }
  for (let i = 0; i < out.length - 1; i++) out[i]!.den = out[i + 1]!.tu;
  return out.filter((d) => d.den > d.tu && d.dong.length);
}
/** Chữ màn hiện trên timeline/thẻ shot: chỉ câu cuối (câu đã "lộ hết"), bỏ cú pháp "@giây". */
export const chuManHien = (chu: string): string => { const d = doanChuMan(chu, 999); return d.length ? d[d.length - 1]!.dong.join(' ') : chu.trim(); };
