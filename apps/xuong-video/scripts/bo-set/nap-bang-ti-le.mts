// Nhận ảnh BẢNG TỈ LỆ (scripts/bo-set/bang-ti-le.sh render trên iMac) → đẩy kho R2 → ghi xv_phim.kinh_thanh.bang_ti_le. Ảnh cũ thay thế không xoá
// (kho dọn chung lo, cùng luật khung xám). 0đ.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-bang-ti-le.mts --phim=<id> --tep=<png>
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';
const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=').slice(1).join('=');
const phim = Number(gia('phim')); const tep = gia('tep');
if (!phim || !tep) { console.log('cần --phim=<id> --tep=<png>'); process.exit(1); }
const url = await uploadToR2(`xuong-video/bang-ti-le/${phim}-${Date.now()}.png`, readFileSync(tep), 'image/png');
if (!url) { console.log('không đẩy được lên kho'); process.exit(1); }
await getDb()!.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{bang_ti_le}', to_jsonb(${url}::text)), updated_at = now() WHERE id = ${phim}`);
console.log(JSON.stringify({ ok: true, phim, url }));
process.exit(0);
