// Soi lại clip của một tập (soi-clip.ts: chữ lạ model tự in + sản phẩm còn trong khung) — 0đ (ffmpeg + tesseract trên máy chủ).
// Clip mới sinh đã tự soi lúc nhận; script dùng cho clip cũ hoặc sau khi đổi luật soi.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soi-clip.mts <tap_id> [--canh=id,id]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiClipCanh } from '../src/lib/xuong-video/soi-clip';
import type { Row } from '../src/lib/xuong-video/doc-db';

const tapId = Number(process.argv[2]);
const chi = (process.argv.find((a) => a.startsWith('--canh=')) ?? '').slice(7).split(',').map(Number).filter(Boolean);
if (!tapId) { console.error('thiếu tap_id'); process.exit(1); }
const db = getDb()!;
const ds = (await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tapId} AND (video_url IS NOT NULL OR video_cuoi_url IS NOT NULL) ORDER BY thu_tu, id`)) as unknown as Row[];
for (const r of ds.filter((x) => !chi.length || chi.includes(Number(x.id)))) {
  const kq = await soiClipCanh(db, Number(r.id));
  console.log(`#${r.thu_tu} (id ${r.id}): ${!kq ? 'không đọc được clip' : kq.loi.length ? `LỖI — ${kq.loi.join(' | ')}` : 'đạt'}${kq?.do.mau.length ? ` · màu sp ${kq.do.mau.join(' ')}` : ''}`);
}
process.exit(0);
