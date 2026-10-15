// Xuất chính thức một tập từ máy chủ — cùng lõi với nút ⬇ Xuất (xuat-tap.ts): cổng người xem + cổng tiếng, job, ghi bản xuất, cờ đỏ (tiếng lạ, nền đứt…).
// 0đ (ffmpeg). Dùng khi máy tự xuất lại sau khi đổi luật dựng, không phải nhờ anh bấm.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/xuat-tap.mts <tap_id> [nhanh]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { batDauXuatTap } from '../src/lib/xuong-video/xuat-tap';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';

const tapId = Number(process.argv[2]); const nhanh = process.argv[3] || null;
if (!tapId) { console.error('thiếu tap_id'); process.exit(1); }
const db = getDb()!;
const canh = ((await db.execute(sql`SELECT c.* FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`)) as unknown as Row[]).map(mapCanh);
const r = await batDauXuatTap(db, tapId, canh, nhanh);
if (!r.ok) { console.error(r.loi); process.exit(1); }
const kq = await r.chay();
if (kq.loi) { console.error(`job ${r.job}: ${kq.loi}`); process.exit(1); }
const j = ((await db.execute(sql`SELECT output_url, loi FROM xv_job WHERE id = ${r.job}`)) as unknown as Row[])[0];
console.log(JSON.stringify({ job: r.job, url: j?.output_url, co_do: j?.loi || 'không' }));
process.exit(0);
