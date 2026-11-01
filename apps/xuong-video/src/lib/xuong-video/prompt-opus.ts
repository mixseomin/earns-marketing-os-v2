// Kho prompt video Opus 5.5 (github.com/yihui-dev/awesome-opus5-5-videos, MIT) — video làm bằng cách bảo Opus viết hoạt hình thành code
// (Canvas / SVG / Three.js / GSAP…), mỗi mục một prompt tác giả đã đăng. Dữ liệu: scripts/du-lieu/thu-vien/prompt-opus.json, nạp lại bằng
// scripts/nap-prompt-opus.mjs. ~700 KB nên tải lười (import động) — chỉ khi mở mục 🧪 hoặc tìm trong thư viện.
export type PromptOpus = { slug: string; tac_gia: string; bai: string; loai: string; cong_nghe: string[]; ten?: string; prompt: string; mot_phan?: boolean; anh: string | null; xem: string | null; ngay: string };
export type KhoPromptOpus = { nguon: string; giay_phep: string; nap: string; ds: PromptOpus[] };

export const LOAI_OPUS: Record<string, string> = { motion: 'Chuyển động', explainer: 'Giải thích', '3d': 'Cảnh 3D', interactive: 'Game · tương tác' };

let hua: Promise<KhoPromptOpus> | null = null;
export const taiPromptOpus = (): Promise<KhoPromptOpus> => (hua ??= import('../../../scripts/du-lieu/thu-vien/prompt-opus.json').then((m) => (m.default ?? m) as KhoPromptOpus));

/** DẠNG KÊNH đo nhu cầu (scripts/do-dang-kenh.mjs, 02/11/2026): mỗi dạng video dựng được bằng code + số đo YouTube của vài cụm tìm, kèm do_luc —
 *  quá han_ngay thì thư viện báo cũ, chạy lại script (chỉ đo cụm quá hạn). khop = regex lọc prompt Opus làm được dạng đó. */
export type CumDo = { q: string; do_luc?: string; n?: number; trung_vi?: number; top?: { xem: number | null; kenh: string | null; giay: number | null; ten: string; url: string }[] };
export type DangKenh = { id: string; ten: string; mo_ta: string; khop: string; cum: CumDo[] };
/** Cơ hội kênh xếp hạng (anh 02/11/2026 "liệt kê mọi cơ hội, cái top lên đầu") — dang trỏ DangKenh.id để lấy số đo nhu cầu. */
/** Khuôn kịch bản rút từ mổ đối thủ (B1 kế hoạch kênh) — kênh mẫu, dạng video + nhịp, công thức tiêu đề, luật. */
export type KhuonKichBan = { nguon: string; kenh_mau: string[]; dang: { ten: string; nhip: string[] }[]; cong_thuc_tieu_de: string[]; luat: string[] };
export type CoHoi = { hang: number; ten: string; dang: string | null; bang_chung_tien: string; dung_code: string; kiem_tien: string; trang_thai?: string; khuon?: KhuonKichBan };
export type KhoDangKenh = { nguon: string; han_ngay: number; ds: DangKenh[]; co_hoi?: CoHoi[]; co_hoi_luc?: string; mo_hinh_saga?: { tom_tat: string; buoc: string[]; nguon: string } };
let huaDang: Promise<KhoDangKenh> | null = null;
export const taiDangKenh = (): Promise<KhoDangKenh> => (huaDang ??= import('../../../scripts/du-lieu/thu-vien/dang-kenh.json').then((m) => (m.default ?? m) as KhoDangKenh));
/** prompt Opus thuộc một dạng (regex khop trên prompt + tên) */
export const thuocDang = (d: Pick<DangKenh, 'khop'>, x: Pick<PromptOpus, 'prompt' | 'ten'>): boolean => new RegExp(d.khop, 'i').test(`${x.prompt} ${x.ten ?? ''}`);
