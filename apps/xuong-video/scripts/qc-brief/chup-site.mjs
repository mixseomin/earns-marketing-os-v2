#!/usr/bin/env node
// CHỤP TRANG THẬT anglebrief.net cho mẫu Site Showreel (qc-brief/showreel.html) — khổ điện thoại 430 css px × 2,5 (ảnh rộng 1075), cả trang, rồi cắt lát bằng ffmpeg.
//   node scripts/qc-brief/chup-site.mjs <tên> <url> [<tên> <url> …]   → /Users/htuan/.cache/qc-brief/site/<tên>.png + in vị trí h1/h2/.hook (css px) để khai "o" của thẻ hook
// Chạy trên iMac (box cấm trình duyệt). Playwright lấy ở courseforge-demo như shot-code/dung.mjs.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(`${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`);
const a = process.argv.slice(2); if (!a.length || a.length % 2) { console.error('dùng: chup-site.mjs <tên> <url> …'); process.exit(2); }
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5 });
for (let i = 0; i < a.length; i += 2) {
  await p.goto(a[i + 1], { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${process.env.HOME}/.cache/qc-brief/site/${a[i]}.png`, fullPage: true });
  console.log(a[i], JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('h1,h2,.hook')].map((e) => ({ y: Math.round(e.getBoundingClientRect().top + scrollY), h: Math.round(e.getBoundingClientRect().height), s: e.innerText.slice(0, 50) })))));
}
await b.close();
