#!/usr/bin/env node
// CHỤP TRANG CÔNG CỤ THẬT của astrolas.com cho các series dùng công cụ (04/11/2026, anh: "làm hết các phim demo" — Read Your Chart, Ask the Chart,
// Free in 60 Seconds, This Week in Your Chart). Chụp cả trang khổ điện thoại (540 px × 2 = rộng 1080 px, đúng khổ video) + đo toạ độ từng chỗ cần chỉ →
// shot-code/la-so.html cảnh { man: '<tên>.png', khung: '<mã>' } phóng camera vào đó và khoanh vàng. 0đ, chạy iMac (box cấm trình duyệt).
//   node chup.mjs <spec.json>      spec = [{ ten, url, cho?: ms, bam?: 'chữ nút cần bấm trước', khung: { <mã>: { chu?: 'regex', css?: 'bộ chọn', cha?: số tầng bọc ngoài (khoanh cả thẻ chứa chữ), thua?: px } } }]
//   → cong-cu/<ten>.png + cong-cu/<ten>.json { rong, cao, khung: { <mã>: [x, y, w, h] } } (px ảnh). Không tìm thấy khung nào → DỪNG (mã 3), không đoán chỗ.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
let chromium; try { ({ chromium } = createRequire(import.meta.url)(PW)); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const DIR = dirname(fileURLToPath(import.meta.url)), TL = 2;
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tr = await chromium.launch();
try {
  for (const s of spec) {
    const p = await tr.newPage({ viewport: { width: 540, height: 1100 }, deviceScaleFactor: TL });
    await p.goto(s.url, { waitUntil: 'networkidle', timeout: 90000 });
    await p.evaluate(() => { [...document.querySelectorAll('button, a')].find((e) => /^got it!?$/i.test(e.textContent.trim()))?.click(); });   // banner cookie
    if (s.bam) { await p.evaluate((re) => { [...document.querySelectorAll('button, a, input[type=submit]')].find((e) => new RegExp(re, 'i').test(e.textContent || e.value))?.click(); }, s.bam); await p.waitForLoadState('networkidle'); }
    await p.waitForTimeout(s.cho ?? 2500);
    // ảnh chụp cả trang: thanh điều hướng dưới / nút chat / đầu trang dính (fixed, sticky) lặp lại giữa ảnh → ẩn hết trước khi đo + chụp
    await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const v = getComputedStyle(e).position; if (v === 'fixed' || v === 'sticky') e.style.setProperty('display', 'none', 'important'); } });
    await p.waitForTimeout(300);
    const khung = await p.evaluate((ks) => {
      const ra = {}, loi = [];
      for (const [ma, k] of Object.entries(ks)) {
        let el = null;
        if (k.css) el = document.querySelector(k.css);
        if (!el && k.chu) { const re = new RegExp(k.chu, 'i');   // phần tử NHỎ NHẤT còn hiện mà chữ khớp
          el = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null && re.test(e.innerText || '')).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] || null; }
        if (!el) { loi.push(ma); continue; }
        for (let i = 0; i < (k.cha || 0) && el.parentElement; i++) el = el.parentElement;
        const r = el.getBoundingClientRect(), t = k.thua ?? 8;
        ra[ma] = [r.left - t, r.top + window.scrollY - t, r.width + 2 * t, r.height + 2 * t].map((v) => Math.round(v));
      }
      return { ra, loi };
    }, s.khung || {});
    if (khung.loi.length) throw new Error(`${s.ten}: không tìm thấy khung ${khung.loi.join(', ')}`);
    const f = join(DIR, `${s.ten}.png`); await p.screenshot({ path: f, fullPage: true });
    const cao = await p.evaluate(() => document.documentElement.scrollHeight);
    writeFileSync(join(DIR, `${s.ten}.json`), JSON.stringify({ nguon: s.url, chup_luc: new Date().toISOString(), rong: 540 * TL, cao: cao * TL,
      khung: Object.fromEntries(Object.entries(khung.ra).map(([m, v]) => [m, v.map((x) => x * TL)])) }, null, 1) + '\n');
    console.log(`✓ ${s.ten}: ${Object.keys(khung.ra).length} khung · cao ${cao * TL} px`);
    await p.close();
  }
} catch (e) { console.error(`✗ ${e.message}`); await tr.close(); process.exit(3); }
await tr.close();
