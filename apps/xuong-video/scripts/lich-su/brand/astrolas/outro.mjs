#!/usr/bin/env node
// DỰNG OUTRO LOGO (05/11/2026): outro.html → ra/outro-doc.mp4 (Short 9:16, 1 s) + ra/outro-ngang.mp4 (video dài 16:9, 3 s), 30 khung/giây, có tiếng;
// + MỘT BỘ MỖI PLAYLIST ra/outro-<khung>-<playlist>.mp4, nền = ảnh nền playlist (so-kenh › playlist.nen) — anh 06/11/2026 "nền outro cũng đổi được mà?"
// (vút nhẹ lúc hạt hút vào + chuông ra/chuong.wav đúng lúc logo bật). 0đ, iMac (box cấm trình duyệt). long-tieng.mjs nối vào cuối mọi tập (so-kenh › <kênh>.outro).
//   node outro.mjs [--chi doc|ngang] [--pl <playlist> | --pl all]   (không --pl = bộ nền navy của site)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), RA = join(DIR, 'ra'), TAM = join(RA, '.outro');
const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
const { chromium } = createRequire(import.meta.url)(PW), chi = process.argv.includes('--chi') ? process.argv[process.argv.indexOf('--chi') + 1] : null;
if (!existsSync(join(RA, 'chuong.wav'))) { console.error('✗ thiếu ra/chuong.wav — chạy ve-brand.mjs trước'); process.exit(3); }
const tr = await chromium.launch(), page = await tr.newPage(), PL = process.argv.includes('--pl') ? process.argv[process.argv.indexOf('--pl') + 1] : null;
const SO = JSON.parse((await import('node:fs')).readFileSync(join(DIR, '../../so-kenh.json'), 'utf8')).astrolas.playlist;
const bo = PL ? SO.filter((p) => p.nen && (PL === 'all' || p.ma === PL)).map((p) => ({ pl: p.ma, nen: p.nen.replace(/^brand\/astrolas\//, '') })) : [{ pl: null, nen: null }];
for (const { pl, nen } of bo) for (const [khung, dai, w, h] of [['doc', 1, 1080, 1920], ['ngang', 3, 1920, 1080]].filter(([k]) => !chi || k === chi)) {
  const ten = `outro-${khung}${pl ? `-${pl}` : ''}`;
  rmSync(TAM, { recursive: true, force: true }); mkdirSync(TAM, { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${pathToFileURL(join(DIR, 'outro.html')).href}?khung=${khung}&dai=${dai}${nen ? `&nen=${encodeURIComponent(nen)}` : ''}`); await page.waitForFunction(() => window.__xong === true || !!window.__loi);
  const loi = await page.evaluate(() => window.__loi); if (loi) { console.error(`✗ ${loi}`); process.exit(3); }
  for (let i = 0; i < dai * 30; i++) { await page.evaluate((t) => window.__ve(t), i / 30); await page.screenshot({ path: join(TAM, `${String(i).padStart(3, '0')}.png`) }); }
  const bat = dai > 1.5 ? 0.51 : 0.32;   // giây logo bật (outro.html: u 0,32 × nhịp 1,6 bản dài)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(TAM, '%03d.png'), '-i', join(RA, 'chuong.wav'),
    '-f', 'lavfi', '-t', String(dai), '-i', `anoisesrc=c=pink:a=0.5:d=${dai}`,
    '-filter_complex', `[2:a]highpass=f=900,lowpass=f=7000,volume=0.35,afade=t=in:d=${(bat * 0.9).toFixed(2)},afade=t=out:st=${(bat * 0.9).toFixed(2)}:d=0.12[vut];` +
      `[1:a]adelay=${Math.round((bat - 0.08) * 1000)}|${Math.round((bat - 0.08) * 1000)},volume=0.9[ch];[vut][ch]amix=inputs=2:duration=first:normalize=0,afade=t=out:st=${dai - 0.25}:d=0.25,loudnorm=I=-14:TP=-1.5,aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-t', String(dai), join(RA, `${ten}.mp4`)]);
  console.log(`✓ ra/${ten}.mp4 · ${dai}s`);
}
rmSync(TAM, { recursive: true, force: true }); await tr.close();
