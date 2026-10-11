// Sơ đồ nguồn của shot ra terminal (0đ — chỉ đọc): keyframe/clip đang dùng sinh từ job nào, model, giá, cờ "nguồn đã đổi".
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nguon-shot.mts --tap=6   (hoặc --canh=<id>)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { nguonShot } from '../src/lib/xuong-video/nguon-shot';

const so = (k: string) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || 0);
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const ids = so('canh') ? [so('canh')] : ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${so('tap')} ORDER BY thu_tu`)) as unknown as { id: number }[]).map((r) => Number(r.id));
if (!ids.length) { console.error('thiếu --tap=<id> hoặc --canh=<id>'); process.exit(1); }
const cl = (b: { cauLenh: { them: string[]; bot: string[] } | null }) => (b.cauLenh ? ` ~câu lệnh +${b.cauLenh.them.length}/−${b.cauLenh.bot.length}` : '');
const chiTiet = process.argv.includes('--chi-tiet');
for (const id of ids) {
  const d = await nguonShot(db, id); if (!d) continue;
  const k = d.keyframe, v = d.video;
  console.log(`#${d.thu_tu} ${d.canh.slice(0, 40)} · ${d.thamChieu.length} ảnh tham chiếu`
    + ` | kf: ${k ? `job ${k.job} ${k.model} ${k.thamChieuUrl ? `${k.thamChieuUrl.length} ref` : 'ref?'}${k.doi.length ? ` ⚠ ${k.doi.join(' / ')}` : ''}${cl(k)}${!k.doi.length && !k.cauLenh ? ' ✓' : ''}` : d.keyframe_url ? 'không có job' : '—'}`
    + ` | clip: ${v ? `job ${v.job} ${v.model}${v.xuLySau ? ` (+${v.xuLySau})` : ''}${v.doi.length ? ` ⚠ ${v.doi.join(' / ')}` : ''}${cl(v)}${!v.doi.length && !v.cauLenh ? ' ✓' : ''}` : d.video_url ? 'không có job' : '—'}`);
}
process.exit(0);
