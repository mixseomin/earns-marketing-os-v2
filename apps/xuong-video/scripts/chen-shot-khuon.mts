// Chèn shot cho bước khuôn đang THIẾU (tach-shot.ts › chenShotKhuonDb) — 0đ, shot mới chưa có hình. Tuỳ chọn ghi đè ky_thuat / nhân vật của shot mới.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/chen-shot-khuon.mts <tapId> <apIdx> <buoc> "<hành động>" ['{"co_canh":"cu"}'] [nhanVatId,…]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chenShotKhuonDb } from '../src/lib/xuong-video/tach-shot';

const [tapId, apIdx, buoc] = process.argv.slice(2, 5).map(Number);
const moTa = process.argv[5] ?? ''; const kt = process.argv[6] ? JSON.parse(process.argv[6]) as Record<string, unknown> : null;
const nv = process.argv[7] ? process.argv[7].split(',').map(Number) : null;
const db = getDb()!;
const r = await chenShotKhuonDb(db, tapId!, apIdx!, buoc!, moTa, 'claude');
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
if (kt) await db.execute(sql`UPDATE xv_canh SET ky_thuat = ky_thuat || ${JSON.stringify(kt)}::jsonb WHERE id = ${r.id}`);
if (nv) await db.execute(sql`UPDATE xv_canh SET nhan_vat = ${JSON.stringify(nv)}::jsonb, bien_the = '[]'::jsonb WHERE id = ${r.id}`);
const c = ((await db.execute(sql`SELECT id, thu_tu, phan_doan, hanh_dong, ky_thuat, nhan_vat FROM xv_canh WHERE id = ${r.id}`)) as unknown as Record<string, unknown>[])[0];
console.log('✓ chèn shot', JSON.stringify(c));
process.exit(0);
