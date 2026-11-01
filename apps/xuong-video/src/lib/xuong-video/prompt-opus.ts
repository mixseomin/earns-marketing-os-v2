// Kho prompt video Opus 5.5 (github.com/yihui-dev/awesome-opus5-5-videos, MIT) — video làm bằng cách bảo Opus viết hoạt hình thành code
// (Canvas / SVG / Three.js / GSAP…), mỗi mục một prompt tác giả đã đăng. Dữ liệu: scripts/du-lieu/thu-vien/prompt-opus.json, nạp lại bằng
// scripts/nap-prompt-opus.mjs. ~700 KB nên tải lười (import động) — chỉ khi mở mục 🧪 hoặc tìm trong thư viện.
export type PromptOpus = { slug: string; tac_gia: string; bai: string; loai: string; cong_nghe: string[]; ten?: string; prompt: string; mot_phan?: boolean; anh: string | null; xem: string | null; ngay: string };
export type KhoPromptOpus = { nguon: string; giay_phep: string; nap: string; ds: PromptOpus[] };

export const LOAI_OPUS: Record<string, string> = { motion: 'Chuyển động', explainer: 'Giải thích', '3d': 'Cảnh 3D', interactive: 'Game · tương tác' };

let hua: Promise<KhoPromptOpus> | null = null;
export const taiPromptOpus = (): Promise<KhoPromptOpus> => (hua ??= import('../../../scripts/du-lieu/thu-vien/prompt-opus.json').then((m) => (m.default ?? m) as KhoPromptOpus));
