// (0đ) Tính lại ĐIỂM CẮT CUỐI cho clip đang dùng của một tập (cat-cuoi.ts) — clip sinh với ảnh thứ 2 có dải nhịp (job request.chuoiCuoi).
// Dùng sau khi đổi cách dò, hoặc clip cũ chưa có cat_cuoi_s.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cat-cuoi.mts <tap_id>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { catCuoiClip } from '../src/lib/xuong-video/sinh-video';
import type { Row } from '../src/lib/xuong-video/doc-db';
const db = getDb()!; const tap = Number(process.argv[2]);
const ds = (await db.execute(sql`SELECT c.id, c.thu_tu, c.video_url, c.keyframe_ket, c.phat_s, j.request->>'khungCuoi' AS chuoi FROM xv_canh c
  JOIN LATERAL (SELECT request FROM xv_job WHERE canh_id = c.id AND loai = 'video' AND output_url = c.video_url ORDER BY id DESC LIMIT 1) j ON true
  WHERE c.tap_id = ${tap} AND c.video_url IS NOT NULL AND (j.request->>'chuoiCuoi')::boolean ORDER BY c.thu_tu`)) as unknown as Row[];
for (const r of ds) {
  const cat = r.keyframe_ket ? await catCuoiClip(String(r.video_url), String(r.chuoi), String(r.keyframe_ket)).catch(() => null) : null;
  await db.execute(sql`UPDATE xv_canh SET cat_cuoi_s = ${cat} WHERE id = ${Number(r.id)}`);
  console.log(`#${r.thu_tu} cắt ${cat ?? '—'}s · phát ${r.phat_s}s${cat != null && Number(r.phat_s) > cat ? '  ⚠ phát dài hơn đoạn dùng được' : ''}`);
}
process.exit(0);
