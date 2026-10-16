// MÁY TỰ CHẤM CLIP cả tập (cham-may.ts) — 0đ, CPU box3. Clip mới sinh đã tự chấm; script này để chấm lại (đổi ngưỡng, clip cũ).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cham-may.mts <tap_id> [--shot=1,2]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chamMayShots } from '../src/lib/xuong-video/cham-may';
import type { Row } from '../src/lib/xuong-video/doc-db';

const tapId = Number(process.argv[2]);
if (!tapId) { console.error('thiếu tap_id'); process.exit(1); }
const db = getDb()!;
const so = (process.argv.find((a) => a.startsWith('--shot=')) ?? '').slice(7);
const ids = so ? ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu = ANY(${`{${so}}`}::int[])`)) as unknown as Row[]).map((r) => Number(r.id)) : undefined;
const t0 = Date.now();
const kq = await chamMayShots(db, tapId, ids);
for (const k of kq) console.log(`#${k.thu_tu} ${k.ket === 'dat' ? '✓ đạt' : k.ket === 'can_mat' ? '◐ cần mắt' : '✗ trượt'}${k.loi.length ? ` — ${k.loi.join(' · ')}` : ''}`);
console.log(`${kq.length} clip · ${((Date.now() - t0) / 1000).toFixed(0)}s · 0đ`);
process.exit(0);
