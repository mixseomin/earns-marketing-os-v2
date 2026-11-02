#!/usr/bin/env node
// LẤY LÁ SỐ THẬT từ astrolas.com (03/11/2026, anh: "hình chart dùng theme NEBULA của site" + "SVG thì phải load font hamburg để các icon hành tinh hiện đúng").
//   node lay.mjs <slug> [<slug>…]   →  la-so/<slug>.svg (vector, theme Nebula, font ký hiệu NHÚNG base64) + la-so/<slug>.json (dữ liệu nhà / sao / góc chiếu)
// Nguồn: astrolas.com/c/<slug> — bấm nút 🔮 Nebula của khung lá số, lấy nguyên <svg> site vẽ. Site gắn nhãn từng phần (data-layer / data-house / data-planet /
// data-aspect / data-sign) → shot-code/la-so.html dùng nhãn đó để đưa camera vào đúng nhà / sao / góc chiếu khi kể chuyện. 0đ, chạy iMac (box cấm trình duyệt).
// Font: <style> trong SVG trỏ /fonts/*.ttf của site (HamburgSymbols = ký hiệu hành tinh + cung) → tải từng tệp, thay bằng data: URL. Thiếu font nào → DỪNG (mã 3),
// không ghi SVG ký hiệu hiện thành chữ cái.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;   // như shot-code/dung.mjs
let chromium; try { ({ chromium } = createRequire(import.meta.url)(PW)); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const DIR = dirname(fileURLToPath(import.meta.url)), SITE = 'https://astrolas.com';
const slugs = process.argv.slice(2);
if (!slugs.length) { console.error('dùng: node lay.mjs <slug> … (slug = đường /c/<slug> trên astrolas.com, vd steve-jobs)'); process.exit(2); }
mkdirSync(DIR, { recursive: true });

const fontCache = new Map();
async function nhungFont(svg) {   // mọi url(...) font trong SVG → data: URL
  const urls = [...new Set([...svg.matchAll(/url\((['"]?)([^'")]+\.(?:ttf|woff2?|otf)(?:\?[^'")]*)?)\1\)/g)].map((m) => m[2]))];
  for (const u of urls) {
    const abs = new URL(u, SITE).href;
    if (!fontCache.has(abs)) { const r = await fetch(abs); if (!r.ok) throw new Error(`không tải được font ${abs} (${r.status})`);
      const kieu = abs.match(/\.(ttf|woff2?|otf)/)[1]; fontCache.set(abs, `data:font/${kieu === 'ttf' ? 'ttf' : kieu};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`); }
    svg = svg.split(u).join(fontCache.get(abs));
  }
  if (/url\((['"]?)\/fonts\//.test(svg)) throw new Error('còn font trỏ /fonts/ chưa nhúng');
  return { svg, so: urls.length };
}

const tr = await chromium.launch();
try {
  for (const slug of slugs) {
    const p = await tr.newPage({ viewport: { width: 1400, height: 1100 } });
    await p.goto(`${SITE}/c/${slug}`, { waitUntil: 'networkidle', timeout: 60000 });
    if (!(await p.evaluate(() => { const b = document.querySelector('[data-ccw-theme="nebula"]'); b?.click(); return !!b; }))) throw new Error(`${slug}: không thấy nút theme Nebula`);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const s = document.querySelector('#chart-wheel-natal svg'); if (!s) return null;
      const so = (v) => (v == null ? null : Number(v));
      const tham = JSON.parse(document.querySelector('[data-ccw-params]')?.getAttribute('data-ccw-params') || '{}');
      const vong = [...s.querySelectorAll('circle')].map((c) => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy')), Number(c.getAttribute('r'))]).filter((c) => c[2] > 50).sort((a, b) => b[2] - a[2]);
      return {
        svg: s.outerHTML,
        du_lieu: {
          nguoi: tham, viewBox: s.getAttribute('viewBox'), tam: vong[0] ? [vong[0][0], vong[0][1]] : null, ban_kinh: [...new Set(vong.map((c) => c[2]))],
          lop: [...s.querySelectorAll('[data-layer]')].map((e) => ({ ma: e.dataset.layer, ten: e.dataset.layerLabel, thu_tu: so(e.dataset.stepIndex) })),
          nha: [...s.querySelectorAll('[data-cusp-degree]')].filter((e) => e.dataset.ring === 'natal').map((e) => ({ so: so(e.dataset.house), dinh: so(e.dataset.cuspDegree) })),
          sao: [...s.querySelectorAll('[data-planet]')].filter((e, i, a) => a.findIndex((x) => x.dataset.planet === e.dataset.planet) === i)
            .map((e) => ({ ten: e.dataset.planet, kinh_do: so(e.dataset.longitude), cung: e.dataset.sign, nha: so(e.dataset.house), nghich: e.dataset.retro === 'true' })),
          goc: [...s.querySelectorAll('[data-aspect]')].map((e) => ({ loai: e.dataset.aspect, a: e.dataset.body1, b: e.dataset.body2, lech: so(e.dataset.orb) })),
        },
      };
    });
    await p.close();
    if (!r) throw new Error(`${slug}: không thấy #chart-wheel-natal svg`);
    const { svg, so } = await nhungFont(r.svg.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"(?=[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg")/, ''));
    writeFileSync(join(DIR, `${slug}.svg`), svg);
    writeFileSync(join(DIR, `${slug}.json`), JSON.stringify({ nguon: `${SITE}/c/${slug}`, theme: 'nebula', lay_luc: new Date().toISOString(), ...r.du_lieu }, null, 1) + '\n');
    const d = r.du_lieu;
    console.log(`✓ ${slug}: ${d.sao.length} sao · ${d.nha.length} nhà · ${d.goc.length} góc chiếu · ${d.lop.length} lớp · ${so} font nhúng · ${(svg.length / 1024).toFixed(0)} KB`);
  }
} catch (e) { console.error(`✗ ${e.message}`); await tr.close(); process.exit(3); }
await tr.close();
