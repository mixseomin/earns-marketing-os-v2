#!/usr/bin/env node
// CHỤP MÔ HÌNH ĐÚNG CAMERA CÁC ẢNH SO (du-lieu/<lâu>-anh.json có camera) — đầu vào cho scripts/kiem-vien.py (so đường viền trời).
// Chạy trên iMac: node apps/castle/scripts/chup-so-anh.mjs <thư mục ra>. Tự mở máy chủ tĩnh cổng 18777, ảnh 3D tắt, rừng ẩn.
// tra-repo-ok: công cụ nội bộ của cảnh, gọi hàm có sẵn trong trang (__ns.moSo).
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const GOC = join(dirname(fileURLToPath(import.meta.url)), '..'), PUB = join(GOC, 'public'), RA = process.argv[2] || '/tmp/chup-so-anh';
mkdirSync(RA, { recursive: true });
const PW = process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const LOAI = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream' };
const may = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': LOAI[extname(f)] || 'application/octet-stream' }).end(readFileSync(f)); });
await new Promise((ok, loi) => may.once('error', loi).listen(18777, '127.0.0.1', ok)).catch((e) => { console.error('cổng 18777 đang bận:', e.code); process.exit(1); });
const { chromium } = await import(PW);
const b = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }); const pg = await b.newPage({ viewport: { width: 1920, height: 1440 } });
await pg.addInitScript(() => { try { localStorage.setItem('ns-anh3d', '0'); localStorage.setItem('ns-dau-thu', '1'); } catch {} });
await pg.goto('http://127.0.0.1:18777/neuschwanstein.html'); await pg.waitForFunction(() => window.__ns?.tt, null, { timeout: 180000 });
const ds = await pg.evaluate(() => window.__ns.ANH.map((a, i) => ({ i, tep: a.tep, coCam: !!a.camera })));
const ra = [];
for (const a of ds.filter((a) => a.coCam)) {
  const k = await pg.evaluate((i) => { const n = window.__ns; n.moSo(i); 
    for (const id of ['so', 'dau', 'nguon', 'bd', 'nut']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } document.getElementById('so-anh').style.opacity = 0;
    const r = n.renderer.domElement.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }, a.i);
  await pg.waitForTimeout(2500);
  const tep = join(RA, `mo-hinh-${a.i}.png`); await pg.screenshot({ path: tep, clip: k }); ra.push({ i: a.i, anh: join(PUB, 'du-lieu', a.tep), moHinh: tep });
}
writeFileSync(join(RA, 'ds.json'), JSON.stringify(ra)); console.log(JSON.stringify(ra));
await b.close(); may.close();
