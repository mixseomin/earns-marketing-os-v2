// THỬ PROMPT CỤM QUA VIDEOEXPRESS ($0, tài khoản đã mua) — nửa iMac của scripts/cum-thu.mts. Mỗi biến thể một clip cùng khung đầu (keyframe shot đầu đoạn)
// + khung cuối (khung kết / keyframe shot cuối — first_last_frame neo người vào sau, vd Vivian ở #3), prompt giữ NGUYÊN (enhance tắt) để so đúng cách viết.
// Gửi song song (VideoExpress cho ≤ 5 render cùng lúc), đợi render (~4 phút), tải về, đẩy lên box → cum-thu.mts --gan (R2 + ky_thuat.cum_thu), tờ khung để soát.
//   cd ~/Me/GitHub/earns-marketing-os-v2/apps/xuong-video && node scripts/videoexpress.mjs mo && \
//     ../../node_modules/.bin/tsx scripts/vx-cum.mts --tap=356 --tu=2 --den=3 [--bien=gop,tach]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { napKhung, guiShot, getMedia, catId, trenApp, ngu } from './vx-br.mts';

const BOX = 'root@167.233.241.16';
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const doan = `--tap=${gia('tap')} --tu=${gia('tu')} --den=${gia('den')}`;
const dsBien = (gia('bien') ?? 'gop').split(',');
const boxTsx = (args: string) => execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cum-thu.mts ${args}`], { encoding: 'utf8', timeout: 300e3 }).trim();
if (!trenApp()) { console.error('chưa ở trong app VideoExpress — chạy: node scripts/videoexpress.mjs mo'); process.exit(1); }

const k = JSON.parse(boxTsx(doan).split('\n').pop()!) as { ten: string; dau: string | null; cuoi: string | null; bien: Record<string, string> };
if (!k.dau) { console.error(`${k.ten}: shot đầu chưa có keyframe`); process.exit(1); }
const thu = join(tmpdir(), `vx-cum-${gia('tap')}-${gia('tu')}-${gia('den')}`); mkdirSync(thu, { recursive: true });
const tai = (url: string, f: string) => { execFileSync('curl', ['-sSL', '-o', f, url], { timeout: 120e3 }); return f; };
const catDefault = catId('default');
const mDau = await napKhung(tai(k.dau, join(thu, 'dau.png')), catDefault);
const mCuoi = k.cuoi ? await napKhung(tai(k.cuoi, join(thu, 'cuoi.png')), catDefault) : 0;
if (!mDau) { console.error('nạp khung đầu hỏng'); process.exit(1); }

const gui: Record<string, string> = {};
for (const b of dsBien) {
  const p = k.bien[b]; if (!p) { console.log(`  ! không có biến thể '${b}'`); continue; }
  const uuid = guiShot(mDau, p, false, mCuoi ?? 0); if (!uuid) continue;
  gui[b] = uuid; console.log(`${k.ten} ${b}: gửi ${uuid.slice(0, 8)} (${p.length} ký tự)`);
}
const catVideo = catId('my_ai_videos'); const xong = new Set<string>();
for (let lan = 0; lan < 60 && xong.size < Object.keys(gui).length; lan++) {
  await ngu(20e3);
  const ds = getMedia(catVideo, 60).results;
  for (const [b, uuid] of Object.entries(gui)) {
    if (xong.has(b)) continue;
    const it = ds.find((x) => x.uuid === uuid); if (!it || it.isPending || !it.mediaPath) continue;
    const f = tai(it.mediaPath, join(thu, `${b}.mp4`));
    execFileSync('scp', ['-q', f, `${BOX}:/tmp/vx-cum-${b}.mp4`]);
    console.log(boxTsx(`${doan} --gan=${b}:/tmp/vx-cum-${b}.mp4 --nguon=vx`).split('\n').pop());
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', f, '-vf', 'fps=3,scale=180:-1,tile=6x3', '-frames:v', '1', join(thu, `to-${b}.jpg`)]);
    console.log(`  tờ khung: ${join(thu, `to-${b}.jpg`)} · ${(it.duration / 1000).toFixed(1)}s`);
    xong.add(b);
  }
}
for (const b of Object.keys(gui)) if (!xong.has(b)) console.log(`${k.ten} ${b}: chưa render xong sau 20 phút — chạy lại sẽ gửi lượt mới`);
process.exit(0);
