// Soi BIẾN DẠNG cho clip (soi-bien-dang.ts — Gemini Flash nhìn ảnh ghép 12 khung, ~$0.001/clip, ghi tiền xv_job). Dùng để hiệu chỉnh trên clip
// đã biết lỗi / đã biết tốt, hoặc soi riêng một clip. Clip mới tự soi lúc nhận (soi-clip.ts).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soi-bien-dang.mts <url.mp4> [<url.mp4> …] --sp-phim=<phim_id>
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiBienDang } from '../src/lib/xuong-video/soi-bien-dang';

const db = getDb()!;
const phim = Number((process.argv.find((a) => a.startsWith('--sp-phim=')) ?? '').split('=')[1] || 0) || null;
const sp = phim ? ((await db.execute(sql`SELECT mo_ta FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'san_pham' ORDER BY id LIMIT 1`)) as unknown as { mo_ta: string }[])[0]?.mo_ta ?? '' : '';
let tong = 0;
for (const url of process.argv.slice(2).filter((a) => a.startsWith('http'))) {
  const dai = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url]).toString().trim());
  const k = await soiBienDang(db, { url, dai, sp, phimId: phim });
  if (!k) { console.log(`?  ${url.split('/').pop()} — không soi được`); continue; }
  tong += k.cents;
  console.log(`${k.loi.length ? '✗' : '✓'}  ${url.split('/').pop()} · ${dai.toFixed(1)}s · ${k.cents.toFixed(3)}¢${k.loi.map((x) => `\n     ${x}`).join('')}`);
}
console.log(`tổng ${tong.toFixed(3)}¢`);
process.exit(0);
