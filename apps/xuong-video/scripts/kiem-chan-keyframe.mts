// LÝ DO CHẶN KEYFRAME cả tập — đúng hàm nút Sinh (sinh-anh.ts › lyChanKeyframe), gom theo lý do. 0đ, chỉ đọc.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-chan-keyframe.mts <tap_id>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { lyChanKeyframe } from '../src/lib/xuong-video/sinh-anh';
const db = getDb()!; const tapId = Number(process.argv[2]);
const ids = (await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as { id: number; thu_tu: number }[];
const dem = new Map<string, number[]>(); let chan = 0;
for (const r of ids) { const g = await lyChanKeyframe(db, Number(r.id)); if (g?.chan.length) chan++; for (const c of g?.chan ?? []) { const k = c.replace(/#\d+/g, '#N'); (dem.get(k) ?? dem.set(k, []).get(k)!).push(Math.round(Number(r.thu_tu))); } }
for (const [k, v] of dem) console.log(`[${v.length} shot: ${v.join(',')}] ${k.slice(0, 300)}`);
console.log(`— ${chan}/${ids.length} shot bị chặn keyframe`);
process.exit(0);
