// CHỮ TRONG SƠ ĐỒ PHÒNG không đè nhau, không tràn khỏi ô (anh 12/10/2026: "sơ đồ phòng chữ đang đè lên nhau"). Sơ đồ vẽ tay
// (cong-ty/so-do/*.svg) đặt chữ theo ước lượng bề rộng — phông thật của trang rộng hơn là chữ lòi ra khỏi ô, đè lên chữ ô bên.
// Đo trên TRANG THẬT (đúng phông app): mỗi phòng có so_do → /phong/<id>, tab Sơ đồ, đọc khung chữ (getBBox theo hệ toạ độ SVG):
//   (1) hai dòng chữ chồng nhau > 2 đơn vị · (2) chữ nằm trong một ô (rect nhỏ nhất chứa tâm chữ) mà lòi ra ngoài ô > 1 đơn vị.
//   node scripts/chu-so-do.mjs <base> <phiên> [phòng…]    — exit 1 khi có chỗ sai.
import fs from 'node:fs';
import path from 'node:path';
import { parseFm } from './fm.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const [base, tok, ...chi] = process.argv.slice(2);
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'cong-ty', 'phong');
const phongs = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => [f.slice(0, -3), parseFm(fs.readFileSync(path.join(DIR, f), 'utf8')).fm.so_do])
  .filter(([id, sd]) => sd && (!chi.length || chi.includes(id)));
const b = await chromium.launch({ channel: 'chrome' }); let sai = 0;
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addCookies([{ name: 'mos2-session', value: tok, url: base }]);
for (const [id] of phongs) {
  const p = await ctx.newPage(); await p.goto(`${base}/phong/${id}`, { waitUntil: 'networkidle' });
  const tab = p.locator('[role=tab]', { hasText: 'Sơ đồ' }); if (await tab.count()) await tab.first().click();
  await p.evaluate(() => document.fonts.ready);
  const loi = await p.evaluate(() => {
    const svg = [...document.querySelectorAll('figure.cty-so-do svg, .cty-so-do svg')].find((s) => s.getBoundingClientRect().width > 0); if (!svg) return ['không thấy sơ đồ'];
    const hop = (e) => { const r = e.getBBox(); return { x: r.x, y: r.y, x2: r.x + r.width, y2: r.y + r.height }; };
    const chu = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => ({ t: t.textContent.trim().slice(0, 40), ...hop(t) }));
    const o = [...svg.querySelectorAll('rect')].map(hop).filter((r) => r.x2 - r.x < 860);   // bỏ khung ngoài cùng (viền phòng)
    const ra = [];
    for (let i = 0; i < chu.length; i++) for (let j = i + 1; j < chu.length; j++) {
      const a = chu[i], c = chu[j]; const w = Math.min(a.x2, c.x2) - Math.max(a.x, c.x), h = Math.min(a.y2, c.y2) - Math.max(a.y, c.y);
      if (w > 2 && h > 2) ra.push(`đè: "${a.t}" × "${c.t}"`);
    }
    for (const a of chu) {
      const cx = (a.x + a.x2) / 2, cy = (a.y + a.y2) / 2;
      const r = o.filter((r) => cx > r.x && cx < r.x2 && cy > r.y && cy < r.y2).sort((m, n) => (m.x2 - m.x) * (m.y2 - m.y) - (n.x2 - n.x) * (n.y2 - n.y))[0];
      if (r && (a.x < r.x - 1 || a.x2 > r.x2 + 1 || a.y < r.y - 1 || a.y2 > r.y2 + 1)) ra.push(`tràn ô: "${a.t}" (${Math.round(Math.max(r.x - a.x, a.x2 - r.x2, r.y - a.y, a.y2 - r.y2))} đơn vị)`);
    }
    return ra;
  });
  sai += loi.length; console.log(`${loi.length ? '✗' : '✓'} ${id}: ${loi.length ? `${loi.length} chỗ\n    ${(process.env.DU ? loi : loi.slice(0, 12)).join('\n    ')}${loi.length > 12 ? `\n    … +${loi.length - 12}` : ''}` : 'chữ không đè, không tràn ô'}`);
  await p.close();
}
await b.close(); console.log(sai ? `✗ sơ đồ phòng: ${sai} chỗ chữ đè / tràn` : '✓ sơ đồ phòng: chữ không đè, không tràn ô'); process.exit(sai ? 1 : 0);
