#!/usr/bin/env node
// BỘ NHẬN DIỆN KÊNH ASTROLAS (G2, 03/11/2026) — chụp mọi khung của ve-brand.html bằng Playwright, 0đ.
//   node ve-brand.mjs   →  ra/<khung>.png · ra/chuong.wav · ra/mo-dau-doc.mp4 (Short 9:16) · ra/mo-dau-ngang.mp4 (16:9) · ra/to-duyet-*.png (tờ anh duyệt)
// Chuông mở đầu: tổng hợp bằng ffmpeg (chuông kim loại: hoạ âm C6 + G6 + C7 + hoạ âm lệch 2,76×, tắt dần) — không tải, không bản quyền.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // Playwright cài chung máy (iMac / box) — require tìm cả NODE_PATH
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nenH264 } from '../../../../src/lib/xuong-video/nen-video.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), RA = join(DIR, 'ra'), TAM = join(RA, '.khung');
mkdirSync(RA, { recursive: true });
const URL0 = pathToFileURL(join(DIR, 've-brand.html')).href;
const KHUNG = { 's-intro': [1080, 1920], 's-giua-cc': [1080, 1920], 's-giua-sc': [1080, 1920], 's-vung': [1080, 1920], 's-cuoi': [1080, 1920], 's-bia-cc': [1080, 1920], 's-bia-sc': [1080, 1920],
  'n-intro': [1920, 1080], 'n-giua-cc': [1920, 1080], 'n-giua-sc': [1920, 1080], 'n-cuoi': [1920, 1080], 'n-bia-cc': [1280, 720], 'n-bia-sc': [1280, 720],
  avatar: [800, 800], banner: [2560, 1440], 'bang-mau': [1920, 1080] };

// LOGO + ICON THẬT (anh 03/11/2026: cấm chữ gõ thay logo) → logo/wordmark.png + logo/icon.png. Nguồn theo thứ tự:
//   1. repo site trên máy (ASTROLAS_REPO, mặc định iMac /Users/htuan/Me/GitHub/Astrolas.com) › public/images/logo + public (favicon / apple-touch-icon)
//   2. tải astrolas.com (wordmark-on-dark@2x.png; icon theo <link rel=icon|apple-touch-icon> của trang chủ)
// Không có cả hai → DỪNG (mã 3), không vẽ gì.
const LOGO = join(DIR, 'logo'); mkdirSync(LOGO, { recursive: true });
const SITE = process.env.ASTROLAS_REPO ?? '/Users/htuan/Me/GitHub/Astrolas.com';
const lonNhat = (ds) => ds.filter((f) => existsSync(f)).sort((a, b) => statSync(b).size - statSync(a).size)[0];
const quet = (d, re) => { try { return readdirSync(d).filter((f) => re.test(f)).map((f) => join(d, f)); } catch { return []; } };
async function tai(url, ra) { try { const r = await fetch(url); if (!r.ok) return false; writeFileSync(ra, Buffer.from(await r.arrayBuffer())); return true; } catch { return false; } }
if (!existsSync(join(LOGO, 'wordmark.png'))) {
  const f = lonNhat([join(SITE, 'public/images/logo/wordmark-on-dark@2x.png'), ...quet(join(SITE, 'public/images/logo'), /wordmark.*dark.*\.png$/i)]);
  if (f) copyFileSync(f, join(LOGO, 'wordmark.png')); else await tai('https://astrolas.com/images/logo/wordmark-on-dark@2x.png', join(LOGO, 'wordmark.png'));
}
if (!existsSync(join(LOGO, 'icon.png'))) {
  const f = lonNhat([...quet(join(SITE, 'public/images/logo'), /(icon|mark|symbol).*\.png$/i), ...quet(join(SITE, 'public'), /(apple-touch-icon|android-chrome-512|icon-512|favicon-512).*\.png$/i)]);
  if (f) copyFileSync(f, join(LOGO, 'icon.png'));
  else if (!(await tai('https://astrolas.com/images/logo/icon-512.png', join(LOGO, 'icon.png')))) { const html = await fetch('https://astrolas.com/').then((r) => r.text()).catch(() => '');
    const ds = [...html.matchAll(/<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]*href=["']([^"']+\.png)["']/gi)].map((m) => new URL(m[1], 'https://astrolas.com/').href);
    for (const u of [...ds, 'https://astrolas.com/apple-touch-icon.png']) if (await tai(u, join(LOGO, 'icon.png'))) break; }
}
const thieu = ['wordmark.png', 'icon.png'].filter((f) => !existsSync(join(LOGO, f)));
if (thieu.length) { console.error(`✗ thiếu logo thật: ${thieu.join(', ')} — không có repo site (${SITE}) và không tải được astrolas.com. Dừng, không vẽ chữ thay logo.`); process.exit(3); }

const tr = await chromium.launch();

// ẢNH NỀN THẬT (luật nền lớn = ảnh thật, skill design/stock-photo-apis) → anh/<tên>.jpg + anh/nguon.json (link trang nguồn). Pexels, free thương mại.
const ANH = join(DIR, 'anh'); mkdirSync(ANH, { recursive: true });
const PEXELS = { 'troi': { id: 7925847, trang: 'https://www.pexels.com/photo/starry-sky-during-night-time-7925847/', ghi: 'Dải Ngân Hà — nền mọi khung' },
  'nui': { id: 31001498, trang: 'https://www.pexels.com/photo/starry-night-sky-with-mountain-silhouette-31001498/', ghi: "bóng núi tiền cảnh Tonight's Sky (shot-code/bau-troi-dem.html)" } };   // mọi ảnh Pexels của kênh khai ở đây (nguon.json sinh từ bảng này)
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36' };   // Pexels WAF chặn UA mặc định
for (const [ten, a] of Object.entries(PEXELS)) { const f = join(ANH, `${ten}.jpg`); if (existsSync(f)) continue;
  const r = await fetch(`https://images.pexels.com/photos/${a.id}/pexels-photo-${a.id}.jpeg?auto=compress&w=2560`, { headers: UA }).catch(() => null);
  if (r?.ok) writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
writeFileSync(join(ANH, 'nguon.json'), JSON.stringify(PEXELS, null, 1) + '\n');
const thieuAnh = Object.keys(PEXELS).filter((t) => !existsSync(join(ANH, `${t}.jpg`)));
if (thieuAnh.length) { console.error(`✗ thiếu ảnh nền thật: ${thieuAnh.join(', ')} — không tải được Pexels. Dừng, không vẽ nền trơn.`); await tr.close(); process.exit(3); }

// LÁ SỐ THEME NEBULA THẬT (anh 03/11/2026: hình chart dùng theme Nebula của site; SVG phải nhúng font Hamburg để ký hiệu hành tinh hiện đúng)
// → lich-su/la-so/<slug>.svg do la-so/lay.mjs lấy (vector, phóng không vỡ). Chưa có thì gọi nó; nó dừng thì máy này dừng.
const LA_SO = join(DIR, '../../la-so');
for (const slug of ['steve-jobs']) if (!existsSync(join(LA_SO, `${slug}.svg`))) {
  try { execFileSync(process.execPath, [join(LA_SO, 'lay.mjs'), slug], { stdio: 'inherit' }); } catch { console.error(`✗ không lấy được lá số ${slug}. Dừng.`); await tr.close(); process.exit(3); } }

const page = await tr.newPage();
const chup = async (f, t, ra) => { const [w, h] = KHUNG[f]; await page.setViewportSize({ width: w, height: h });
  await page.goto(`${URL0}?f=${f}${t != null ? `&t=${t}` : ''}`); await page.waitForFunction(() => window.__xong === true || !!window.__loi);
  const loi = await page.evaluate(() => window.__loi); if (loi) throw new Error(`${f}: ${loi}`); await page.screenshot({ path: ra }); };
for (const f of Object.keys(KHUNG)) { await chup(f, null, join(RA, `${f}.png`)); console.log(`✓ ${f}`); }

// CHUÔNG + ĐOẠN MỞ ĐẦU (1,6 s: vòng vàng 0–0,55 s, chữ ký 0,25–0,7 s, khẩu hiệu 0,55–0,9 s, giữ tới 1,6 s; chuông ở 0,08 s)
const chuong = join(RA, 'chuong.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
  "aevalsrc='(1-exp(-400*t))*(0.34*exp(-3.0*t)*sin(2*PI*1046.5*t)+0.20*exp(-2.4*t)*sin(2*PI*1568*t)+0.16*exp(-4.5*t)*sin(2*PI*2093*t)+0.10*exp(-7*t)*sin(2*PI*2888*t)+0.05*exp(-9*t)*sin(2*PI*4186*t))':s=48000:d=1.9",
  '-af', 'adelay=80|80,afade=t=out:st=1.5:d=0.4,aecho=0.6:0.5:120:0.25,volume=13dB,alimiter=limit=0.7', '-ac', '2', chuong]);
for (const [f, ten] of [['s-intro', 'mo-dau-doc'], ['n-intro', 'mo-dau-ngang']]) {
  rmSync(TAM, { recursive: true, force: true }); mkdirSync(TAM, { recursive: true });
  for (let i = 0; i < 48; i++) await chup(f, (i / 30).toFixed(4), join(TAM, `${String(i).padStart(3, '0')}.png`));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(TAM, '%03d.png'), '-i', chuong, ...nenH264({ crf: 18 }),
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
  'to-duyet-short': to('Astrolas · Short dọc 9:16 (1080×1920)', 'Logo + icon thật của astrolas.com · lá số Steve Jobs theme Nebula (SVG vector của astrolas.com/c/steve-jobs, font ký hiệu nhúng) · nền ảnh thật Pexels. Trăng của Sky Calendar còn là minh hoạ tạm (G3 làm paper-lantern).', [
    o('s-intro', '1. Mở đầu (khung cuối) — vòng vàng + chữ ký + chuông, 1,6 s · xem mo-dau-doc.mp4', 420),
    o('s-giua-cc', '2. Giữa video · Chart Chapters — chữ ký góc trái trên + nhãn playlist; phụ đề giữa dưới', 420),
    o('s-giua-sc', '3. Giữa video · Sky Calendar — cùng khung, nhãn xanh trăng', 420),
    o('s-vung', '4. Vùng YouTube đè lên Short (đỏ) — chữ + logo đều nằm ngoài', 420),
    o('s-cuoi', '5. Màn cuối chung — "See your own chart free at astrolas.com"', 420),
    o('s-bia-cc', '6. Ảnh bìa Short · Chart Chapters', 420), o('s-bia-sc', '7. Ảnh bìa Short · Sky Calendar', 420)].join('')),
  'to-duyet-ngang': to('Astrolas · Video ngang 16:9 (1920×1080) + ảnh bìa 1280×720', 'Cùng một khung thương hiệu với Short: chữ ký cùng góc trái trên, nhãn playlist, phụ đề, màn cuối, khuôn ảnh bìa chỉ đổi màu nhãn theo playlist.', [
    o('n-intro', '1. Mở đầu (khung cuối) · xem mo-dau-ngang.mp4', 820), o('n-giua-cc', '2. Giữa video · Chart Chapters', 820), o('n-giua-sc', '3. Giữa video · Sky Calendar', 820),
    o('n-cuoi', '4. Màn cuối 20 s — ô đỏ là chỗ YouTube gắn end screen (video kế · playlist · Đăng ký)', 820),
    o('n-bia-cc', '5. Ảnh bìa · Chart Chapters — góc dưới phải để trống (YouTube đè thời lượng)', 820), o('n-bia-sc', '6. Ảnh bìa · Sky Calendar', 820)].join('')),
  'to-duyet-kenh': to('Astrolas · Trang kênh + bảng màu', 'Ảnh đại diện + banner: nền ảnh thật Pexels (Dải Ngân Hà, nguồn ở anh/nguon.json) dưới lớp navy, icon + wordmark thật của astrolas.com, lá số theme Nebula của site.', [
    o('avatar', '1. Ảnh đại diện 800×800 (YouTube cắt tròn)', 520), o('banner', '2. Banner 2560×1440 — khung đứt = phần điện thoại thấy', 1500),
    o('bang-mau', '3. Bảng màu + chữ + nhãn playlist', 1100)].join('')),
};
for (const [ten, html] of Object.entries(TO)) {
  const f = join(RA, `.${ten}.html`); writeFileSync(f, html);
  await page.setViewportSize({ width: ten === 'to-duyet-short' ? 3240 : 2800, height: 900 }); await page.goto(pathToFileURL(f).href); await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(RA, `${ten}.png`), fullPage: true }); rmSync(f); console.log(`✓ ${ten}.png`);
}
await tr.close();
