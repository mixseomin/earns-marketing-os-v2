// KEYFRAME QWEN TRÊN MÁY THUÊ (anh 17/11/2026 "sinh ảnh 3 bản trên vast" → "làm thành rule chuẩn hoá"): Qwen-Image-Edit-2511 (scripts/h3/chay-anh.py) nhận
// TỐI ĐA 3 ảnh và đọc câu lệnh theo nghĩa đen. Đo trên phim #3071 shot #19: câu lệnh nano-banana ("EDIT Image 1 … RE-TEXTURING, giữ y Image 1") → Qwen giữ nguyên
// hình nhân khối đỏ của bản 3D (3/3 bản hỏng); câu lệnh "ảnh 1 chỉ là bố cục, THAY hình nhân bằng người ở ảnh 2, vẽ theo nét ảnh 3" → 3/3 bản đúng nhân vật.
// Hàm này KHÔNG viết câu mới: lấy đúng các khối studio đã dựng cho keyframe (sinh-anh.ts › chuanBiKeyframe → khoi.mot_buoc: máy, bố trí, hướng, chỗ đứng,
// khung, ngoài khung, người, cảm xúc…) rồi (1) thay khối mở đầu bằng câu kiểu Qwen, (2) chọn 3 ảnh: khung 3D · nhân vật chính · ảnh chuẩn bối cảnh,
// (3) đánh số lại "Image N", câu nhắc tới ảnh không gửi thì bỏ phần trỏ ảnh (giữ chữ mô tả).
// da-tra-he-thong: đã đọc sinh-anh.ts (chuanBiKeyframe, khuôn mot_buoc), prompt-khoi.ts (Khoi, ghep) — dùng lại khối, chỉ thêm lớp chuyển cho Qwen.
import { ghep, type Khoi } from './prompt-khoi';

export type VaiAnh = { url: string; nhan: string };
/** Khối giữ lại cho Qwen (thứ tự đọc): khối nano-banana riêng (anh_dich, anh_set, khong_them, phong_cach) thay bằng câu kiểu Qwen. */
const GIU: readonly string[] = ['may', 'bo_tri', 'so_nguoi', 'huong', 'dien', 'khung', 'ngoai_khung', 'trang_thai', 'nguoi', 'cam_xuc', 'bieu_cam', 'cam_chu'];
export const QWEN_TOI_DA_ANH = 3;

/** Chọn ảnh cho Qwen: [khung 3D (vai đầu), nhân vật chính (🧍 đầu tiên), ảnh chuẩn bối cảnh 🏠 — thiếu thì nhân vật / đồ kế tiếp]. Trả chỉ số cũ (0-based). */
export function chonAnhQwen(vai: VaiAnh[]): number[] {
  const ds = [0];
  const nguoi = vai.findIndex((v, i) => i > 0 && v.nhan.startsWith('🧍'));
  if (nguoi > 0) ds.push(nguoi);
  const set = vai.findIndex((v) => v.nhan.startsWith('🏠'));
  if (set > 0) ds.push(set);
  for (let i = 1; ds.length < QWEN_TOI_DA_ANH && i < vai.length; i++) if (!ds.includes(i)) ds.push(i);
  return ds.slice(0, QWEN_TOI_DA_ANH);
}

/** Đánh số lại "Image N" (1-based cũ) theo ảnh giữ; ảnh bỏ: "looks exactly like Image N:" / "(Image N)" / "Image N =" … bỏ phần trỏ, giữ mô tả. */
export function doiSoAnh(chu: string, giu: number[]): string {
  const moi = new Map(giu.map((cu, i) => [cu + 1, i + 1]));
  return chu
    .replace(/,?\s*(?:looks exactly like|exactly as in|as in|see|matching|like)\s+Image (\d+)\s*:?/gi, (m, n: string) => (moi.has(Number(n)) ? m.replace(/Image \d+/, `image ${moi.get(Number(n))}`) : ':'))
    .replace(/\(\s*Image (\d+)\s*\)/gi, (m, n: string) => (moi.has(Number(n)) ? `(image ${moi.get(Number(n))})` : ''))
    .replace(/\bImage (\d+)\b/g, (m, n: string) => (moi.has(Number(n)) ? `image ${moi.get(Number(n))}` : 'the reference'))
    .replace(/:\s*:/g, ':').replace(/\s{2,}/g, ' ');
}

/** Câu lệnh + ảnh cho Qwen từ khối keyframe của studio. phongCach = câu phong cách phim (khối phong_cach của nano, bỏ "Photo look:"). */
export function promptQwen(o: { khoi: Khoi[]; vai: VaiAnh[] }): { prompt: string; anh: string[]; vai: VaiAnh[] } {
  const giu = chonAnhQwen(o.vai);
  const coNguoi = giu.length > 1 && o.vai[giu[1]!]!.nhan.startsWith('🧍');
  const coSet = giu.some((i) => o.vai[i]!.nhan.startsWith('🏠'));
  const soSet = giu.findIndex((i) => o.vai[i]!.nhan.startsWith('🏠')) + 1;
  const pc = (o.khoi.find((k) => k.ma === 'phong_cach')?.chu ?? '').replace(/^Photo look:\s*/i, '').replace(/\s*Keep Image 1's light direction and colours\.?/i, '').trim();
  const dau = [
    'Image 1 is only a rough 3D LAYOUT (grey blocks and smooth stand-in shapes, red block mannequins for people).',
    `Redraw it as ONE finished frame${pc ? ` — ${pc.replace(/[.\s]+$/, '')}` : ''}${coSet ? `, in exactly the drawing style, colours and light of image ${soSet}` : ''}.`,
    "Keep image 1's camera, framing and the place, size and pose of everything in it.",
    `REPLACE every block figure and stand-in shape completely with the real person or object${coNguoi ? ' (the main person looks exactly like image 2)' : ''} — no blocks, mannequins or 3D shapes may remain in the picture.`,
  ].join(' ');
  const than = o.khoi.filter((k) => GIU.includes(k.ma) && k.chu).map((k) => ({ ...k, chu: doiSoAnh(k.chu, giu) }));
  return { prompt: `${dau} ${ghep(than)}`.trim(), anh: giu.map((i) => o.vai[i]!.url), vai: giu.map((i) => o.vai[i]!) };
}
