// QUÉT CẢ PHIM tìm shot PHẢI TÁCH NHỊP (tach-nhip.ts › canTachNhip — cùng luật bộ kiểm 3D chặn keyframe). 0đ, chỉ đọc.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tach-nhip-phim.mts --phim=132
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { canTachNhip } from '../src/lib/xuong-video/tach-nhip';
import type { Row } from '../src/lib/xuong-video/doc-db';
import type { ViTriDo } from '../src/lib/xuong-video/thao-do';

const phim = Number(process.argv.find((a) => a.startsWith('--phim='))?.split('=')[1]);
if (!phim) { console.error('thiếu --phim=<id>'); process.exit(1); }
const db = getDb()!;
const nguoi = new Set(((await db.execute(sql`SELECT ten FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'nhan_vat'`)) as unknown as Row[]).map((r) => String(r.ten)));
const shots = (await db.execute(sql`SELECT t.so AS tap, c.thu_tu, c.hanh_dong, c.ky_thuat->>'co_canh' AS co, c.may_3d FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id
  WHERE t.phim_id = ${phim} AND coalesce(c.nhanh, '') IN ('', 'A') ORDER BY t.so, c.thu_tu`)) as unknown as Row[];
let n = 0, coMay = 0;
for (const s of shots) {
  const vt = ((s.may_3d as { vi_tri?: ViTriDo[] } | null)?.vi_tri ?? []); if (vt.length) coMay++;
  const ly = canTachNhip({ co_canh: s.co ? String(s.co) : undefined, vi_tri: vt, chuyen_toi: (s.may_3d as { chuyen_toi?: string } | null)?.chuyen_toi }, (t) => nguoi.has(t));
  if (!ly.length) continue; n++;
  console.log(`tập ${s.tap} #${s.thu_tu} [${s.co ?? '?'}] ${String(s.hanh_dong).slice(0, 90)}`);
  for (const l of ly) console.log(`   → ${l}`);
}
console.log(`\n${shots.length} shot (${coMay} có máy 3D) · ${n} shot cần tách`);
process.exit(0);
