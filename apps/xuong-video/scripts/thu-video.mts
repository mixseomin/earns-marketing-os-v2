// Sinh THỬ một clip qua đúng adapter fal của app (batDauFal/docFal) từ keyframe cảnh đầu tiên, lưu lên R2, in link.
// Không ghi DB. Tốn ~ $0,3-0,4 (Kling 3.0 Pro 3s). Chạy trên box: cd apps/xuong-video && ../../node_modules/.bin/tsx --conditions react-server scripts/thu-video.mts
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { batDauFal, docFal } from '../src/lib/xuong-video/fal';
import { uploadToR2 } from '../src/lib/r2';
const db = getDb()!;
const r = ((await db.execute(sql`SELECT keyframe_url, prompt_video, hanh_dong FROM xv_canh WHERE keyframe_url IS NOT NULL ORDER BY id LIMIT 1`)) as unknown as Array<Record<string, string>>)[0]!;
const t0 = Date.now();
const kq = await batDauFal('fal-ai/kling-video/v3/pro/image-to-video', { prompt: r.prompt_video || r.hanh_dong, anhDau: r.keyframe_url, giay: 3, tiLe: '16:9' });
if (!kq.ok) { console.log('LOI', kq.loi); process.exit(1); }
for (;;) {
  await new Promise((o) => setTimeout(o, 10_000));
  const d = await docFal(kq.taskId);
  if (!d.done) continue;
  if (!d.ok) { console.log('LOI', d.loi); process.exit(1); }
  const buf = Buffer.from(await (await fetch(d.uri)).arrayBuffer());
  const url = await uploadToR2(`xuong-video/thu/kling-${Date.now()}.mp4`, buf, 'video/mp4');
  console.log('VIDEO', url, Math.round(buf.length / 1024) + 'KB', Math.round((Date.now() - t0) / 1000) + 's');
  process.exit(0);
}
