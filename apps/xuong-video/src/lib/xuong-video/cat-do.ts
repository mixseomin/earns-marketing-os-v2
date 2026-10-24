// CẮT ĐỒ VẬT TỪ KHUNG THẬT → ảnh tham chiếu (luat-dung.ts › vang_mat_do, ép bằng HÌNH thay vì chữ — anh 25/10/2026: chữ "nắm dây thẻ đứt" không ép được
// model, nhưng ảnh món đồ đúng trạng thái từ shot liền trước thì ép được). Gemini Flash trả hộp bao (box_2d 0–1000) của món đồ trên khung → sharp cắt có lề
// → tải lên kho → URL làm "Image N = the <prop> exactly as it looks now". ~0,2¢ / lần (ghi tiền như lượt chữ). Không thấy món → null (không bịa).
import 'server-only';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { ghiTienChu, type Db } from './doc-db';
import { uploadToR2 } from '../r2';

export async function catDo(db: Db, phimId: number | null, anhUrl: string, tenEn: string, moTa = ''): Promise<{ url: string; hop: number[] } | null> {
  const b = Buffer.from(await (await fetch(anhUrl)).arrayBuffer());
  const schema = { type: 'OBJECT', properties: { co: { type: 'BOOLEAN' }, box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } } }, required: ['co'] };
  const r = await goiGeminiJson<{ co: boolean; box_2d?: number[] }>([{ text: `Find ${tenEn}${moTa ? ` (${moTa})` : ''} in this film frame. If clearly visible, return co=true and its bounding box as box_2d = [ymin, xmin, ymax, xmax] on a 0–1000 scale. If not visible, co=false.` }, { inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }], schema, 'MEDIA_RESOLUTION_MEDIUM');
  if (!r) return null; await ghiTienChu(db, phimId, 'cắt đồ vật (hộp bao)', MO_HINH_BD, r.tk, 'google');
  const bx = r.data.box_2d; if (!r.data.co || !bx || bx.length !== 4) return null;
  const meta = await sharp(b).metadata(); const W = meta.width ?? 0, H = meta.height ?? 0; if (!W || !H) return null;
  const [y0, x0, y1, x1] = bx.map((v) => Math.max(0, Math.min(1000, v)) / 1000) as [number, number, number, number];
  const le = 0.15; const L = Math.max(0, Math.floor((x0 - (x1 - x0) * le) * W)), T = Math.max(0, Math.floor((y0 - (y1 - y0) * le) * H)), R = Math.min(W, Math.ceil((x1 + (x1 - x0) * le) * W)), B = Math.min(H, Math.ceil((y1 + (y1 - y0) * le) * H));
  if (R - L < 24 || B - T < 24) return null;
  const out = await sharp(b).extract({ left: L, top: T, width: R - L, height: B - T }).resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: false }).jpeg({ quality: 92 }).toBuffer();
  const url = await uploadToR2(`xuong-video/do/${randomUUID()}.jpg`, out, 'image/jpeg'); return url ? { url, hop: [L / W, T / H, (R - L) / W, (B - T) / H] } : null;
}
