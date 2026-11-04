// QUAY CLIP TỪ TRANG CODE (shader / canvas) → MP4, không mô hình AI nào. Trang chỉ cần: <canvas id="c"> + window.ve(t) vẽ đúng khung tại giây t
// (vẽ theo thời gian, không theo requestAnimationFrame → khung nào cũng đúng, máy chậm không làm lệch nhịp). Chạy CỤC BỘ trên iMac (Chromium của
// Playwright, GPU Metal) — cấm chạy trình duyệt trên máy chủ.
//   node vu-tru/quay.mjs vu-tru/ho-den.html --giay=10 [--w=1080 --h=1920 --fps=30 --ra=vu-tru/ra/ho-den.mp4 --anh=nen.jpg --khung=2,5,8]
// --anh: ảnh nền truyền vào trang (window.ANH) · --them=k=v&k2=v2: tham số riêng của trang · --khung: chỉ chụp PNG tại các giây đó (soát nhanh, không ra video)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DO_MAN_PW ?? `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`);
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const trang = resolve(process.argv[2]);
const W = Number(arg('w', 1080)), H = Number(arg('h', 1920)), FPS = Number(arg('fps', 30)), giay = Number(arg('giay', 10));
const ten = basename(trang, '.html');
const ra = resolve(arg('ra', `${dirname(trang)}/ra/${ten}.mp4`));
mkdirSync(dirname(ra), { recursive: true });

const br = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await br.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => m.type() === 'error' && console.error('trang:', m.text()));
const anh = arg('anh');
await page.goto(`${pathToFileURL(trang)}?w=${W}&h=${H}${anh ? `&anh=${encodeURIComponent(pathToFileURL(resolve(anh)).href)}` : ''}${arg('them') ? `&${arg('them')}` : ''}`);   // --them=sau=0 → tham số riêng của trang
await page.waitForFunction(() => window.SAN_SANG === true, null, { timeout: 30000 });
console.log('GPU:', await page.evaluate(() => window.GPU ?? '?'));

/** một khung JPEG (base64) tại giây t */
const chup = (t, kieu = 'image/jpeg') => page.evaluate(([t, kieu]) => { window.ve(t); return document.getElementById('c').toDataURL(kieu, 0.93).split(',')[1]; }, [t, kieu]);

const khung = arg('khung');
if (khung) {
  for (const t of khung.split(',').map(Number)) { const p = ra.replace(/\.mp4$/, `-${t}s.png`); writeFileSync(p, Buffer.from(await chup(t, 'image/png'), 'base64')); console.log(p); }
} else {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ra], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(giay * FPS), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = Buffer.from(await chup(i / FPS), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % FPS === 0) process.stdout.write(`\r${i}/${n} khung · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error(`ffmpeg ${c}`)) : r())));
  console.log(`\n${ra} · ${n} khung · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await br.close();
