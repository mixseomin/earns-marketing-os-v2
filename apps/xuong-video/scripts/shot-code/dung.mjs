#!/usr/bin/env node
// Quay SHOT CODE ra MP4 (01/11/2026; máy gọi qua scripts/shot-code/may.mts): mở trang HTML có window.__seek(t), chụp từng khung bằng Chromium cục bộ, đẩy thẳng vào ffmpeg. 0đ.
// Chạy trên iMac (box cấm trình duyệt). Playwright lấy ở courseforge-demo như ~/bin/do-man (đặt DO_MAN_PW để trỏ chỗ khác).
//   node dung.mjs --trang scam-or-real.html --cau cau.json --ra ra.mp4 [--song N] [--doan doan.json --kho thư-mục] [--tieng ban-cu.mp4] [--fps 30] [--rong 1080 --cao 1920] [--khung 0,7.3,14.5 --khung-ra x.jpg]
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

// GPU THẬT (Metal) trên Mac: đo 02/11/2026 trang bản đồ 53 → 16 ms/khung (headless mặc định vẽ canvas bằng CPU qua SwiftShader)
const GPU = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : [];
const b = await chromium.launch({ args: ['--allow-file-access-from-files', ...GPU] });
const p = await b.newPage({ viewport: { width: Number(arg('rong', 1080)), height: Number(arg('cao', 1920)) } });
await p.goto(pathToFileURL(resolve(arg('trang'))).href);
await p.evaluate(async (c) => { window.CAU = c; await window.__dung(); }, cau);
await p.waitForFunction(() => { const e = document.getElementById('nen'); if (!e) return true; const u = getComputedStyle(e).backgroundImage.slice(5, -2); const i = new Image(); i.src = u; return i.complete; });   // trang không có #nen tự chờ ảnh trong __dung

const chup = async (t) => { await p.evaluate((x) => window.__seek(x), t); return nenVideo ? p.screenshot({ timeout: 180_000, type: 'png', omitBackground: true }) : p.screenshot({ timeout: 180_000, type: 'jpeg', quality: 92 }); };
if (arg('khung')) {   // chỉ chụp vài khung để soát nhanh → ghép một tờ
  const ts = arg('khung').split(',').map(Number), out = arg('khung-ra');
  if (out.endsWith('/')) {   // --khung-ra thư-mục/ → mỗi khung một tệp k-<i>.jpg cỡ thật (Ngọc soi hình trước khi dựng cả tập — lich-su/xet-truoc.mts)
    const fs = await import('node:fs'); fs.mkdirSync(out, { recursive: true });
    for (const [i, t] of ts.entries()) fs.writeFileSync(`${out}k-${i}.jpg`, await chup(t));
    await b.close(); console.log(out); process.exit(0);
  }
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', '-', '-vf', `scale=${Number(arg('rong', 1080)) > Number(arg('cao', 1920)) ? 640 : 360}:-1,tile=${Math.min(ts.length, 4)}x${Math.ceil(ts.length / 4)}`, '-frames:v', '1', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const t of ts) ff.stdin.write(await chup(t));
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); console.log(out); process.exit(0);
}
const n = Math.round(cau.DAI * fps), bd = Date.now();
// bản TRUNG GIAN (lam-tap nén lại bản phát hành crf 23): Mac mã hoá bằng phần cứng VideoToolbox, máy khác libx264 — libx264 medium là chỗ nghẽn khi khung đã nhanh
const x264 = process.platform === 'darwin' ? ['-c:v', 'h264_videotoolbox', '-b:v', '16M', '-pix_fmt', 'yuv420p', '-allow_sw', '1'] : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-threads', '2'];
const DAU_MA = (await import('node:crypto')).createHash('md5').update(`${x264.join(' ')}|${fps}|${arg('rong', 1080)}x${arg('cao', 1920)}`).digest('hex').slice(0, 6);
// ---------- DỰNG SONG SONG + DÙNG LẠI ĐOẠN (02/11/2026, anh: "tăng tốc độ dựng"): trang là hàm thuần của t → chia khung thành ĐOẠN (cảnh, --doan), mỗi đoạn một
// tệp mp4 riêng do N trang Chromium dựng cùng lúc (--song, mặc định 2: đo 02/11 trên iMac GPU — 2 trang 18 ms/khung, 4 trang 27 ms vì chung một GPU), rồi ghép không mã hoá lại. --kho <thư mục>: đoạn có khoá trùng lần trước thì
// dùng lại — chỉ sau khi dựng lại khung đầu + cuối của đoạn và so khớp từng byte với lần trước (bắt cả phụ thuộc ngầm mà khoá không thấy).
// Nền video (--nen-video) / ghép tiếng (--tieng) vẫn đi đường một trang như cũ.
if (!nenVideo && !tieng) {
  const { cpus } = await import('node:os'), { createHash } = await import('node:crypto'), fs = await import('node:fs'), { join } = await import('node:path');
  const song = Math.max(1, Number(arg('song', 2))), kho = arg('kho'), tam = `${ra}.doan`;
  fs.rmSync(tam, { recursive: true, force: true }); fs.mkdirSync(tam, { recursive: true }); if (kho) fs.mkdirSync(kho, { recursive: true });
  // đoạn: theo --doan [{bd, kt, khoa}] (giây) — không có thì chia đều theo số trang
  const ds = arg('doan') ? JSON.parse(readFileSync(arg('doan'), 'utf8')).map((d) => ({ f0: Math.round(d.bd * fps), khoa: d.khoa }))
    : Array.from({ length: song }, (_, i) => ({ f0: Math.round((i * n) / song), khoa: null }));
  const doan = ds.map((d, i) => ({ ...d, i, f1: i + 1 < ds.length ? ds[i + 1].f0 : n })).filter((d) => d.f1 > d.f0);
  const sha = (b) => createHash('sha1').update(b).digest('hex');
  const trang = [p, ...(await Promise.all(Array.from({ length: Math.min(song, doan.length) - 1 }, async () => {
    const q = await b.newPage({ viewport: { width: Number(arg('rong', 1080)), height: Number(arg('cao', 1920)) } });
    await q.goto(pathToFileURL(resolve(arg('trang'))).href); await q.evaluate(async (c) => { window.CAU = c; await window.__dung(); }, cau); return q; })))];
  // trang tự xuất khung từ canvas (window.__khung → JPEG base64) thì lấy thẳng, khỏi chụp màn hình qua bộ ghép lớp (nhanh hơn)
  const coKhung = await p.evaluate(() => typeof window.__khung === 'function');
  const chupO = async (q, t) => { if (coKhung) return Buffer.from(await q.evaluate((x) => { window.__seek(x); return window.__khung(); }, t), 'base64');
    await q.evaluate((x) => window.__seek(x), t); return q.screenshot({ timeout: 180_000, type: 'jpeg', quality: 92 }); };
  let dungLai = 0, daDung = 0;
  const lam = async (q, d) => {
    // khoá kho có DẤU BỘ MÃ HOÁ (03/11/2026: đoạn libx264 của lượt cũ ghép chung đoạn VideoToolbox → luồng H.264 hỏng 'Invalid NAL unit size') — đổi bộ mã / tham số là đoạn cũ không bao giờ được dùng lại
    const tep = join(tam, `${String(d.i).padStart(4, '0')}.mp4`), kTep = kho && d.khoa ? join(kho, `${d.khoa}-${d.f1 - d.f0}-${DAU_MA}`) : null;
    if (kTep && fs.existsSync(`${kTep}.mp4`) && fs.existsSync(`${kTep}.json`)) {
      const cu = JSON.parse(fs.readFileSync(`${kTep}.json`, 'utf8')), dau = sha(await chupO(q, d.f0 / fps)), cuoi = sha(await chupO(q, (d.f1 - 1) / fps));
      if (cu.dau === dau && cu.cuoi === cuoi) { fs.copyFileSync(`${kTep}.mp4`, tep); dungLai++; return; }
    }
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...x264, tep], { stdio: ['pipe', 'inherit', 'inherit'] });
    let dau = null, cuoi = null;
    for (let f = d.f0; f < d.f1; f++) { const anh = await chupO(q, f / fps); if (f === d.f0) dau = sha(anh); if (f === d.f1 - 1) cuoi = sha(anh);
      if (!ff.stdin.write(anh)) await new Promise((r) => ff.stdin.once('drain', r)); daDung++; if (daDung % 300 === 0) console.log(`khung ${daDung} dựng mới · ${dungLai} đoạn dùng lại`); }
    ff.stdin.end(); const ma = await new Promise((r) => ff.on('close', r)); if (ma) throw new Error(`ffmpeg đoạn ${d.i} hỏng (${ma})`);
    if (kTep) { fs.copyFileSync(tep, `${kTep}.mp4`); fs.writeFileSync(`${kTep}.json`, JSON.stringify({ dau, cuoi })); }
  };
  const hang = [...doan].sort((a, b_) => (b_.f1 - b_.f0) - (a.f1 - a.f0));   // đoạn dài trước → các trang xong gần cùng lúc
  await Promise.all(trang.map(async (q) => { for (let d; (d = hang.shift());) await lam(q, d); }));
  const ds_ = join(tam, 'ds.txt'); fs.writeFileSync(ds_, doan.map((d) => `file '${join(tam, `${String(d.i).padStart(4, '0')}.mp4`)}'`).join('\n'));
  const r = await new Promise((res) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', ds_, '-c', 'copy', '-movflags', '+faststart', ra], { stdio: 'inherit' }).on('close', res));
  if (r) throw new Error('ghép đoạn hỏng');
  // GIẢI MÃ THỬ TOÀN BỘ trước khi trả (03/11/2026: video hỏng NAL lọt tới Studio + máy đăng) — có lỗi giải mã là dừng, không đưa đi
  const loiGiai = await new Promise((res) => { let e = ''; const g = spawn('ffmpeg', ['-v', 'error', '-i', ra, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); g.stderr.on('data', (x) => { e += x; }); g.on('close', () => res(e.trim())); });
  if (loiGiai) throw new Error(`video ghép ra bị lỗi giải mã (${loiGiai.split('\n').length} dòng): ${loiGiai.split('\n')[0]}`);
  fs.rmSync(tam, { recursive: true, force: true }); await b.close();
  console.log(`${ra} · ${n} khung · ${doan.length} đoạn (${dungLai} dùng lại) · ${trang.length} trang · ${((Date.now() - bd) / 1000).toFixed(0)}s`); process.exit(0);
}
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
