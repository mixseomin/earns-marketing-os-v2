#!/usr/bin/env node
// TẢI ĐƯỜNG ĐI + CẦU THANG OSM quanh lâu đài (Overpass): highway=* (đường ô tô, lối đi bộ, bậc thang steps, đường mòn) trong bán kính R quanh tâm.
// Ghi public/du-lieu/<lâu>-duong.json { tam, duong: [{ id, loai, mat (surface OSM: asphalt / sett / gravel… — duong.js chọn vật liệu theo nó), rong, bac (số bậc nếu có), cau (bridge), ham (tunnel), v: [[x, z]] }] } — toạ độ cảnh (mét, x đông, z nam).
//   node apps/castle/scripts/tai-duong.mjs --lau neuschwanstein [bán kính m = 450]
// tra-repo-ok: gọi Overpass trực tiếp (vài chục dòng), không cần thư viện.
import { readFileSync, writeFileSync } from 'node:fs';
import { du, doiSo } from './chung.mjs';
const D = JSON.parse(readFileSync(du('').replace(/-\.json$/, '.json'), 'utf8')), [la0, lo0] = D.tam, R = +(doiSo[0] || 450);
const q = `[out:json][timeout:60];way(around:${R},${la0},${lo0})[highway];(._;>;);out body;`;
let r; for (let t = 0; t < 4; t++) { r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'User-Agent': 'castle-lau-dai-that/1.0' } }); if (r.ok) break; console.log('Overpass', r.status, '— thử lại'); await new Promise((ok) => setTimeout(ok, 8000 * (t + 1))); }
if (!r.ok) { console.error('Overpass lỗi', r.status); process.exit(1); }
const j = await r.json(), nut = new Map(j.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
const M = 111320, MX = M * Math.cos(la0 * Math.PI / 180), ra = (n) => [+((n.lon - lo0) * MX).toFixed(2), +(-(n.lat - la0) * M).toFixed(2)];
const RONG = { primary: 7, secondary: 6.5, tertiary: 6, unclassified: 5, residential: 5, service: 4.5, track: 3.5, footway: 2.5, path: 1.8, pedestrian: 4, steps: 2.5, cycleway: 2.5, living_street: 4.5 };
const duong = j.elements.filter((e) => e.type === 'way').map((w) => {
  const t = w.tags || {}, v = w.nodes.map((id) => nut.get(id)).filter(Boolean).map(ra);
  return { id: 'way/' + w.id, loai: t.highway, ten: t.name || '', mat: t.surface || '', rong: +(t.width || RONG[t.highway] || 3), bac: t.step_count ? +t.step_count : null, cau: t.bridge === 'yes', ham: t.tunnel === 'yes', tang: t.layer ? +t.layer : 0, v };
}).filter((d) => d.v.length >= 2);
writeFileSync(du('duong'), JSON.stringify({ ghi_chu: 'đường + cầu thang OSM (© OpenStreetMap contributors, ODbL) quanh lâu đài, toạ độ cảnh — scripts/tai-duong.mjs', tam: D.tam, duong }) + '\n');
const dem = {}; for (const d of duong) dem[d.loai] = (dem[d.loai] || 0) + 1;
console.log(`${duong.length} đường → ${du('duong')}`, JSON.stringify(dem));
