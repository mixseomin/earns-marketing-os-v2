#!/usr/bin/env node
// Quay SHOT CODE ra MP4 (01/11/2026; máy gọi qua scripts/shot-code/may.mts): mở trang HTML có window.__seek(t), chụp từng khung bằng Chromium cục bộ, đẩy thẳng vào ffmpeg. 0đ.
// Chạy trên iMac (box cấm trình duyệt). Playwright lấy ở courseforge-demo như ~/bin/do-man (đặt DO_MAN_PW để trỏ chỗ khác).
//   node dung.mjs --trang scam-or-real.html --cau cau.json --ra ra.mp4 [--tieng ban-cu.mp4] [--fps 30] [--rong 1080 --cao 1920] [--khung 0,7.3,14.5 --khung-ra x.jpg]
// cau.json = window.CAU của trang (đề + mốc giây + ảnh nền). --tieng: lấy track tiếng của bản cũ (cùng mốc giây) để so cạnh nhau.
// --nen-video clip.mp4: chụp PNG nền TRONG (trang khai CAU.trong) rồi ghép lớp lên clip nền đó (khuôn anime: nền sống do video AI, vật đi xa là lớp); fps theo clip nền.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
const { chromium } = createRequire(import.meta.url)(PW);
const cau = JSON.parse(readFileSync(arg('cau'), 'utf8')), fps = Number(arg('fps', 30)), ra = arg('ra'), tieng = arg('tieng'), nenVideo = arg('nen-video');

const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: Number(arg('rong', 1080)), height: Number(arg('cao', 1920)) } });
await p.goto(pathToFileURL(resolve(arg('trang'))).href);
await p.evaluate(async (c) => { window.CAU = c; await window.__dung(); }, cau);
await p.waitForFunction(() => { const e = document.getElementById('nen'); if (!e) return true; const u = getComputedStyle(e).backgroundImage.slice(5, -2); const i = new Image(); i.src = u; return i.complete; });   // trang không có #nen tự chờ ảnh trong __dung

const chup = async (t) => { await p.evaluate((x) => window.__seek(x), t); return nenVideo ? p.screenshot({ type: 'png', omitBackground: true }) : p.screenshot({ type: 'jpeg', quality: 92 }); };
if (arg('khung')) {   // chỉ chụp vài khung để soát nhanh → ghép một tờ
  const ts = arg('khung').split(',').map(Number), out = arg('khung-ra');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', '-', '-vf', `scale=${Number(arg('rong', 1080)) > Number(arg('cao', 1920)) ? 640 : 360}:-1,tile=${Math.min(ts.length, 4)}x${Math.ceil(ts.length / 4)}`, '-frames:v', '1', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const t of ts) ff.stdin.write(await chup(t));
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); console.log(out); process.exit(0);
}
const n = Math.round(cau.DAI * fps), bd = Date.now();
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', nenVideo ? 'png' : 'mjpeg', '-i', '-',
  ...(nenVideo ? ['-i', nenVideo, '-filter_complex', `[1:v]scale=${Number(arg('rong', 1080))}:${Number(arg('cao', 1920))}:force_original_aspect_ratio=increase,crop=${Number(arg('rong', 1080))}:${Number(arg('cao', 1920))},fps=${fps}[n];[n][0:v]overlay=0:0:shortest=1[v]`, '-map', '[v]', '-map', '1:a?', '-c:a', 'aac'] : []),
  ...(tieng ? ['-i', tieng, '-map', '0:v', '-map', '1:a?', '-c:a', 'copy', '-shortest'] : []),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', ra], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < n; i++) {
  if (!ff.stdin.write(await chup(i / fps))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`khung ${i}/${n}`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
console.log(`${ra} · ${n} khung · ${((Date.now() - bd) / 1000).toFixed(0)}s`);
