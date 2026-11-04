#!/usr/bin/env node
// BÀI BLOG CỦA SITE làm nguồn chữ (05/11/2026, luật "diễn giải phải là chữ của astrolas.com"): bài lá số người nổi tiếng (<slug>-birth-chart), bài sao ở nhà,
// bài giải thích (rising-sign-explained, synastry-explained, annual-profections…) → la-so/bai/<slug>.json NGUYÊN VĂN theo mục. nguon-site.mjs gom vào kho chữ của tập.
//   node bai.mjs <slug> [slug…]      (slug = phần sau /en/blog/)  · 0đ, fetch
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tachBai } from './cung-cap.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)); mkdirSync(join(DIR, 'bai'), { recursive: true }); let hong = 0;
for (const s of process.argv.slice(2)) {
  const url = `https://astrolas.com/en/blog/${s}`, r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) astrolas-studio' } }), b = r.ok ? tachBai(await r.text()) : null;
  if (!b || !b.muc.length) { console.log(`✗ ${s}: ${r.status}${b ? ' · bài không có mục' : ''}`); hong++; continue; }
  writeFileSync(join(DIR, 'bai', `${s}.json`), JSON.stringify({ url, lay_luc: new Date().toISOString().slice(0, 10), ...b }, null, 1) + '\n');
  console.log(`✓ ${s}: ${b.muc.length} mục · ${[...b.mo, ...b.muc.flatMap((m) => m.doan)].join(' ').split(' ').length} chữ`);
}
process.exit(hong ? 1 : 0);
