#!/usr/bin/env node
// BỘ NHẬN DIỆN KÊNH ASTROLAS (G2, 03/11/2026) — chụp mọi khung của ve-brand.html bằng Playwright, 0đ.
//   node ve-brand.mjs   →  ra/<khung>.png · ra/chuong.wav · ra/mo-dau-doc.mp4 (Short 9:16) · ra/mo-dau-ngang.mp4 (16:9) · ra/to-duyet-*.png (tờ anh duyệt)
// Chuông mở đầu: tổng hợp bằng ffmpeg (chuông kim loại: hoạ âm C6 + G6 + C7 + hoạ âm lệch 2,76×, tắt dần) — không tải, không bản quyền.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // Playwright cài chung máy (iMac / box) — require tìm cả NODE_PATH
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), RA = join(DIR, 'ra'), TAM = join(RA, '.khung');
mkdirSync(RA, { recursive: true });
const URL0 = pathToFileURL(join(DIR, 've-brand.html')).href;
const KHUNG = { 's-intro': [1080, 1920], 's-giua-cc': [1080, 1920], 's-giua-sc': [1080, 1920], 's-vung': [1080, 1920], 's-cuoi': [1080, 1920], 's-bia-cc': [1080, 1920], 's-bia-sc': [1080, 1920],
  'n-intro': [1920, 1080], 'n-giua-cc': [1920, 1080], 'n-giua-sc': [1920, 1080], 'n-cuoi': [1920, 1080], 'n-bia-cc': [1280, 720], 'n-bia-sc': [1280, 720],
  avatar: [800, 800], banner: [2560, 1440], 'bang-mau': [1920, 1080] };

const tr = await chromium.launch();
const page = await tr.newPage();
const chup = async (f, t, ra) => { const [w, h] = KHUNG[f]; await page.setViewportSize({ width: w, height: h });
  await page.goto(`${URL0}?f=${f}${t != null ? `&t=${t}` : ''}`); await page.waitForFunction(() => window.__xong === true); await page.screenshot({ path: ra }); };
for (const f of Object.keys(KHUNG)) { await chup(f, null, join(RA, `${f}.png`)); console.log(`✓ ${f}`); }

// CHUÔNG + ĐOẠN MỞ ĐẦU (1,6 s: vòng vàng 0–0,55 s, chữ ký 0,25–0,7 s, khẩu hiệu 0,55–0,9 s, giữ tới 1,6 s; chuông ở 0,08 s)
const chuong = join(RA, 'chuong.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
  "aevalsrc='(1-exp(-400*t))*(0.34*exp(-3.0*t)*sin(2*PI*1046.5*t)+0.20*exp(-2.4*t)*sin(2*PI*1568*t)+0.16*exp(-4.5*t)*sin(2*PI*2093*t)+0.10*exp(-7*t)*sin(2*PI*2888*t)+0.05*exp(-9*t)*sin(2*PI*4186*t))':s=48000:d=1.9",
  '-af', 'adelay=80|80,afade=t=out:st=1.5:d=0.4,aecho=0.6:0.5:120:0.25,volume=13dB,alimiter=limit=0.7', '-ac', '2', chuong]);
for (const [f, ten] of [['s-intro', 'mo-dau-doc'], ['n-intro', 'mo-dau-ngang']]) {
  rmSync(TAM, { recursive: true, force: true }); mkdirSync(TAM, { recursive: true });
  for (let i = 0; i < 48; i++) await chup(f, (i / 30).toFixed(4), join(TAM, `${String(i).padStart(3, '0')}.png`));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(TAM, '%03d.png'), '-i', chuong, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', join(RA, `${ten}.mp4`)]);
  console.log(`✓ ${ten}.mp4`);
}
rmSync(TAM, { recursive: true, force: true });

// TỜ DUYỆT: ba tờ — Short dọc · Video ngang · Kênh (ảnh đại diện, banner, bảng màu)
const o = (f, ghi, w) => `<figure style="margin:0;width:${w}px"><img src="${f}.png" style="width:100%;display:block;border-radius:10px;box-shadow:0 0 0 2px #2a3b57"><figcaption>${ghi}</figcaption></figure>`;
const to = (tieu, phu, the) => `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#060d18;color:#e8edf5;font:500 22px Inter,sans-serif;padding:48px}
  h1{font:800 44px Inter;margin:0 0 6px}p.p{color:#9fb0c8;margin:0 0 34px;font-size:22px;max-width:2600px}figcaption{margin-top:12px;color:#c9d4e3;font-size:21px;line-height:1.35}
  .g{display:flex;flex-wrap:wrap;gap:40px 34px;align-items:flex-start}</style><h1>${tieu}</h1><p class="p">${phu}</p><div class="g">${the}</div>`;
const TO = {
  'to-duyet-short': to('Astrolas · Short dọc 9:16 (1080×1920)', 'Logo đang là CHỮ GÕ TẠM (Playfair Black) — bản thật thay bằng wordmark của astrolas.com. Hình bánh xe lá số / trăng là MINH HOẠ TẠM, hình thật là theme G3 (engraving / paper-lantern).', [
    o('s-intro', '① Mở đầu (khung cuối) — vòng vàng + chữ ký + chuông, 1,6 s · xem mo-dau-doc.mp4', 420),
    o('s-giua-cc', '② Giữa video · Chart Chapters — chữ ký góc trái trên + nhãn playlist; phụ đề giữa dưới', 420),
    o('s-giua-sc', '③ Giữa video · Sky Calendar — cùng khung, nhãn xanh trăng', 420),
    o('s-vung', '④ Vùng YouTube đè lên Short (đỏ) — chữ + logo đều nằm ngoài', 420),
    o('s-cuoi', '⑤ Màn cuối chung — "See your own chart free at astrolas.com"', 420),
    o('s-bia-cc', '⑥ Ảnh bìa Short · Chart Chapters', 420), o('s-bia-sc', '⑦ Ảnh bìa Short · Sky Calendar', 420)].join('')),
  'to-duyet-ngang': to('Astrolas · Video ngang 16:9 (1920×1080) + ảnh bìa 1280×720', 'Cùng một khung thương hiệu với Short: chữ ký cùng góc trái trên, nhãn playlist, phụ đề, màn cuối, khuôn ảnh bìa chỉ đổi màu nhãn theo playlist.', [
    o('n-intro', '① Mở đầu (khung cuối) · xem mo-dau-ngang.mp4', 820), o('n-giua-cc', '② Giữa video · Chart Chapters', 820), o('n-giua-sc', '③ Giữa video · Sky Calendar', 820),
    o('n-cuoi', '④ Màn cuối 20 s — ô đỏ là chỗ YouTube gắn end screen (video kế · playlist · Đăng ký)', 820),
    o('n-bia-cc', '⑤ Ảnh bìa · Chart Chapters — góc dưới phải để trống (YouTube đè thời lượng)', 820), o('n-bia-sc', '⑥ Ảnh bìa · Sky Calendar', 820)].join('')),
  'to-duyet-kenh': to('Astrolas · Trang kênh + bảng màu', 'Ảnh đại diện + banner: nền đang VẼ CODE — theo luật cũ của anh, bản thật dùng ẢNH THẬT free (Pexels), máy cloud bị chặn Pexels nên chưa lấy được.', [
    o('avatar', '① Ảnh đại diện 800×800 (YouTube cắt tròn)', 520), o('banner', '② Banner 2560×1440 — khung đứt = phần điện thoại thấy', 1500),
    o('bang-mau', '③ Bảng màu + chữ + nhãn playlist', 1100)].join('')),
};
for (const [ten, html] of Object.entries(TO)) {
  const f = join(RA, `.${ten}.html`); writeFileSync(f, html);
  await page.setViewportSize({ width: ten === 'to-duyet-short' ? 3240 : 2800, height: 900 }); await page.goto(pathToFileURL(f).href); await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(RA, `${ten}.png`), fullPage: true }); rmSync(f); console.log(`✓ ${ten}.png`);
}
await tr.close();
