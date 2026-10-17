// Soi BIẾN DẠNG cho clip (soi-bien-dang.ts — Gemini 3.8 Flash nhìn ảnh ghép 12 khung, ghi tiền xv_job). Dùng để hiệu chỉnh trên clip
// đã biết lỗi / đã biết tốt, hoặc soi riêng một clip. Clip mới tự soi lúc nhận (soi-clip.ts).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soi-bien-dang.mts <url.mp4> [<url.mp4> …] --sp-phim=<phim_id>
//     … scripts/soi-bien-dang.mts --canh=<id>,<id> [--url=<clip cũ của MỘT shot>]   (clip đang dùng + ý đồ shot + sản phẩm của phim)
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiBienDang, yDoShot } from '../src/lib/xuong-video/soi-bien-dang';

const db = getDb()!;
const phim = Number((process.argv.find((a) => a.startsWith('--sp-phim=')) ?? '').split('=')[1] || 0) || null;
const sp = phim ? ((await db.execute(sql`SELECT mo_ta FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'san_pham' ORDER BY id LIMIT 1`)) as unknown as { mo_ta: string }[])[0]?.mo_ta ?? '' : '';
const canh = (process.argv.find((a) => a.startsWith('--canh=')) ?? '').slice(7).split(',').map(Number).filter(Boolean);
const urlEp = (process.argv.find((a) => a.startsWith('--url=')) ?? '').slice(6);
type Viec = { url: string; yDo: string; sp: string; phim: number | null };
const viec: Viec[] = process.argv.slice(2).filter((a) => a.startsWith('http')).map((url) => ({ url, yDo: '', sp, phim }));
for (const id of canh) {
  const r = ((await db.execute(sql`SELECT c.video_url, c.video_cuoi_url, c.prompt_video, c.prompt_anh, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${id}`)) as unknown as Record<string, unknown>[])[0];
  if (!r) continue;
  const p = Number(r.phim_id);
  const spP = ((await db.execute(sql`SELECT mo_ta FROM xv_nhan_vat WHERE phim_id = ${p} AND loai = 'san_pham' ORDER BY id LIMIT 1`)) as unknown as { mo_ta: string }[])[0]?.mo_ta ?? '';
  viec.push({ url: urlEp || String(r.video_cuoi_url || r.video_url), yDo: yDoShot(String(r.prompt_video ?? ''), String(r.prompt_anh ?? ''), spP), sp: spP, phim: p });
}
let tong = 0;
for (const { url, yDo, sp, phim } of viec) {
  const dai = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url]).toString().trim());
  const k = await soiBienDang(db, { url, dai, sp, yDo, phimId: phim });
  if (!k) { console.log(`?  ${url.split('/').pop()} — không soi được`); continue; }
  tong += k.cents;
  console.log(`${k.loi.length ? '✗' : '✓'}  ${url.split('/').pop()} · ${dai.toFixed(1)}s · ${k.cents.toFixed(3)}¢${k.loi.map((x) => `\n     ${x}`).join('')}`);
}
console.log(`tổng ${tong.toFixed(3)}¢`);
process.exit(0);
