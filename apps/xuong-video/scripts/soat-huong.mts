// CỔNG HƯỚNG trên keyframe (0đ — soi mặt YuNet + SFace + hướng nhìn, soi-mat.ts): so tâm mặt + phía nhìn đo được với KỲ VỌNG từ sơ đồ cảnh
// (ky_thuat.huong_so — so-do-canh.ts › kyVong). In từng shot ✓ / ✗ kèm số đo. Keyframe trượt → sinh lại TRƯỚC khi tiêu tiền video.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soat-huong.mts <tap_id>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiMatTap } from '../src/lib/xuong-video/soi-mat';
import { loiDoHuong } from '../src/lib/xuong-video/so-do-canh';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const db = getDb()!;
const r = await soiMatTap(db, tap, { tatCa: true, ghi: true }); if (!r.ok) { console.error(r.loi); process.exit(1); }
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
let truot = 0;
for (const c of ds) {
  const kv = c.ky_thuat?.huong_so; if (!kv || !Object.keys(kv).length) continue;
  const ket = c.soi_mat?.url === c.keyframe_url ? c.soi_mat.ket : [];
  const loi = loiDoHuong(kv, ket); const thieu = Object.keys(kv).filter((t) => !ket.some((k) => k.ten === t));
  if (loi.length) truot++;
  console.log(`#${c.thu_tu} ${loi.length ? '✗' : '✓'} ${ket.map((k) => `${k.ten} x=${k.o?.x?.toFixed(2) ?? '?'} nhìn=${k.nhin?.g ?? '?'}°`).join(' · ') || '(không đo được mặt)'}${loi.length ? ` — ${loi.join('; ')}` : ''}${thieu.length ? ` · chưa nhận ra: ${thieu.join(', ')}` : ''}`);
}
console.log(`${truot} keyframe trượt cổng hướng`);
process.exit(0);
