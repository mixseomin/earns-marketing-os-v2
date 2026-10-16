// KHUNG ĐẦU = KHUNG CUỐI CLIP SHOT TRƯỚC (Murch QC, 16/10/2026 — Jett #61: #1 kết ông đứng nhăn đau, #2 sinh độc lập mở bằng ông ngồi cười).
// Shot khai `noi_lien` (qc-cam-xuc.ts): trước khi sinh video, lấy khung cuối clip đang dùng của shot liền trước (cùng tập, cùng nhánh) làm keyframe.
// Tên tệp R2 theo hash của clip nguồn → cùng clip thì không tách lại; clip trước đổi thì khung đầu đổi theo.
import 'server-only';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { uploadToR2 } from '../r2';
import type { Db, Row } from './doc-db';

const chay = (args: string[]) => new Promise<Buffer | null>((ok) => execFile('ffmpeg', args, { encoding: 'buffer', maxBuffer: 1 << 26, timeout: 60_000 }, (e, b) => ok(e ? null : (b as Buffer))));

/** Khung cuối của clip (JPEG, cỡ gốc) → R2. null = tách không được. */
export async function khungCuoiClip(clipUrl: string, canhId: number): Promise<string | null> {
  const ma = createHash('sha1').update(clipUrl).digest('hex').slice(0, 12);
  const b = await chay(['-v', 'error', '-sseof', '-0.08', '-i', clipUrl, '-frames:v', '1', '-q:v', '2', '-f', 'image2', '-vcodec', 'mjpeg', 'pipe:1']);
  if (!b?.length) return null;
  return uploadToR2(`xuong-video/keyframe/noi-${canhId}-${ma}.jpg`, b, 'image/jpeg');
}

/** Shot nối liền: đặt keyframe = khung cuối clip shot trước (nếu chưa đúng). Trả câu lỗi khi shot trước chưa có clip. */
export async function noiKhungTuClipTruoc(db: Db, c: { id: number; tap_id: number; thu_tu: number; nhanh: string; keyframe_url: string | null }): Promise<string | null> {
  const t = ((await db.execute(sql`SELECT id, coalesce(video_cuoi_url, video_url) AS clip FROM xv_canh WHERE tap_id = ${c.tap_id} AND thu_tu = ${c.thu_tu - 1} AND (nhanh = ${c.nhanh} OR nhanh = '') ORDER BY (nhanh = ${c.nhanh}) DESC LIMIT 1`)) as unknown as Row[])[0];
  const clip = t?.clip ? String(t.clip) : '';
  if (!clip) return `shot nối liền mà shot #${c.thu_tu - 1} chưa có clip — sinh clip shot trước trước`;
  const ma = createHash('sha1').update(clip).digest('hex').slice(0, 12);
  if (c.keyframe_url?.includes(`/noi-${c.id}-${ma}.jpg`)) return null;
  const url = await khungCuoiClip(clip, c.id);
  if (!url) return `không tách được khung cuối clip shot #${c.thu_tu - 1}`;
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${url}, keyframe_uv = keyframe_uv || ${JSON.stringify([url])}::jsonb, keyframe_ket = NULL, updated_at = now() WHERE id = ${c.id}`);
  return null;
}
