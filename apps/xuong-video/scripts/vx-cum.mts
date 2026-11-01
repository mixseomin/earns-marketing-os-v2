// THỬ PROMPT CỤM QUA VIDEOEXPRESS ($0, tài khoản đã mua) — nửa iMac của scripts/cum-thu.mts. Mỗi biến thể một clip cùng khung đầu (keyframe shot đầu đoạn)
// + khung cuối (khung kết / keyframe shot cuối — first_last_frame neo người vào sau, vd Vivian ở #3), prompt giữ NGUYÊN (enhance tắt) để so đúng cách viết.
// Gửi song song (VideoExpress cho ≤ 5 render cùng lúc), đợi render (~4 phút), tải về, đẩy lên box → cum-thu.mts --gan (R2 + ky_thuat.cum_thu), tờ khung để soát.
//   cd ~/Me/GitHub/earns-marketing-os-v2/apps/xuong-video && node scripts/videoexpress.mjs mo && \
//     ../../node_modules/.bin/tsx scripts/vx-cum.mts --tap=356 --tu=2 --den=3 [--bien=gop,tach] [--lan=3] [--mat=<url ảnh mặt>]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { napKhung, guiShot, getMedia, catId, trenApp, ngu } from './vx-br.mts';
import { moPhien } from './videoexpress.mjs';

const BOX = 'root@167.233.241.16';
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const doan = `--tap=${gia('tap')} --tu=${gia('tu')} --den=${gia('den')}${gia('cuoi') ? ` --cuoi=${gia('cuoi')}` : ''}`;   // --cuoi=khong: không khung cuối (cum-thu.mts)
// --lan=N: mỗi biến thể N lượt cùng prompt (model ngẫu nhiên — một lượt không đủ kết luận; nhãn gop-1, gop-2…)
const lan = Math.max(1, Number(gia('lan') || 1));
// --ten=X: nhãn lượt thử (lưu ky_thuat.cum_thu.X-1…) — biến thể prompt vẫn theo --bien; không đè clip thử cũ
const tenThu = gia('ten');
const dsBien = (gia('bien') ?? 'gop').split(',').flatMap((b) => (lan > 1 ? Array.from({ length: lan }, (_, j) => `${tenThu ?? b}-${j + 1}~${b}`) : [`${tenThu ?? b}~${b}`]));
const boxTsx = (args: string) => execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cum-thu.mts ${args}`], { encoding: 'utf8', timeout: 300e3 }).trim();
if (!trenApp()) await moPhien();   // phiên rụng / tab rời app → tự mở lại (videoexpress.mjs), không bắt chạy tay

const k = JSON.parse(boxTsx(doan).split('\n').pop()!) as { ten: string; dau: string | null; cuoi: string | null; mat: string | null; bien: Record<string, string> };
if (!k.dau) { console.error(`${k.ten}: shot đầu chưa có keyframe`); process.exit(1); }
const thu = join(tmpdir(), `vx-cum-${gia('tap')}-${gia('tu')}-${gia('den')}`); mkdirSync(thu, { recursive: true });
const tai = (url: string, f: string) => { execFileSync('curl', ['-sSL', '-o', f, url], { timeout: 120e3 }); return f; };
const catDefault = catId('default');
const layTiep = !!gia('uuid');
const mDau = layTiep ? 1 : await napKhung(tai(k.dau, join(thu, 'dau.png')), catDefault);
const mCuoi = !layTiep && k.cuoi ? await napKhung(tai(k.cuoi, join(thu, 'cuoi.png')), catDefault) : 0;
// --mat=<url ảnh mặt>: neo mặt (faceSwap) — xem vx-br.mts › guiShot
// mặc định: ảnh sát mặt người chính (cum-thu.mts › mat); --mat=khong để tắt
const urlMat = gia('mat') === 'khong' ? null : gia('mat') ?? k.mat;
const mMat = !layTiep && urlMat ? await napKhung(tai(urlMat, join(thu, 'mat.png')), catDefault) : 0;
if (urlMat) console.log(`neo mặt: ${urlMat}`);
if (!mDau) { console.error('nạp khung đầu hỏng'); process.exit(1); }

// --uuid=gop-1:abcd…,gop-2:… : LẤY TIẾP các job đã gửi (lần trước chết giữa chừng) — không gửi lại
const gui: Record<string, string> = Object.fromEntries((gia('uuid') ?? '').split(',').filter(Boolean).map((x) => [x.slice(0, x.indexOf(':')), x.slice(x.indexOf(':') + 1)]));
for (const b of Object.keys(gui).length ? [] : dsBien) {
  const [nhanB, bienB] = b.split('~') as [string, string];
  const p = k.bien[bienB]; if (!p) { console.log(`  ! không có biến thể '${bienB}'`); continue; }
  const uuid = guiShot(mDau, p, false, mCuoi ?? 0, mMat ?? 0); if (!uuid) continue;
  gui[nhanB] = uuid; console.log(`${k.ten} ${nhanB}: gửi ${uuid} (${p.length} ký tự) — lấy tiếp: --uuid=${nhanB}:${uuid}`);
}
const catVideo = catId('my_ai_videos'); const xong = new Set<string>();
for (let lan = 0; lan < 60 && xong.size < Object.keys(gui).length; lan++) {
  await ngu(20e3);
  let ds; try { ds = getMedia(catVideo, 60).results; }
  catch { console.log('  ! tab rời app VideoExpress — mở lại phiên rồi chờ tiếp'); await moPhien(); continue; }   // 01/11/2026: tab bị đổi giữa lúc chờ → chết, mất 3 job
  for (const [b, uuid] of Object.entries(gui)) {
    if (xong.has(b)) continue;
    const it = ds.find((x) => x.uuid.startsWith(uuid));   // nhận cả tiền tố uuid (log cũ in 8 ký tự)
    if (!it || it.isPending || !/^https?:\/\//.test(String(it.mediaPath ?? ''))) continue;   // 'completed' mà CDN chưa đẩy file → mediaPath null / chuỗi "null"
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
