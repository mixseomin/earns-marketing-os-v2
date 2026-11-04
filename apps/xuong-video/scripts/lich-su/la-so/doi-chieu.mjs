#!/usr/bin/env node
// ĐỐI CHIẾU bộ tính thiên văn của studio (shot-code/bau-troi-tinh.js) với Swiss Ephemeris của astrolas.com qua các lá số đã lấy (la-so/<slug>.json, lay.mjs).
// G4 kênh Astrolas (04/11/2026): video tự tính ngày / vị trí chỉ được tin khi bộ tính khớp site. Lần đầu: 3 lá số, lệch tối đa 0,06° (Trăng), hành tinh < 0,03°.
//   node doi-chieu.mjs [slug …]      (bỏ trống = mọi lá số trong thư mục) · lệch > NGUONG độ → mã 1
// Múi giờ lúc sinh: lá số site không ghi số → thử lệch giờ −12…+14 (bước 15 phút), chọn lệch cho Trăng gần site nhất (Trăng đi ~0,5°/giờ nên chọn được đúng).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), NGUONG = 0.25;
await import(join(DIR, '../../shot-code/bau-troi-tinh.js')); const B = globalThis.BauTroi;
const lech = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const ds = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(DIR).filter((f) => f.endsWith('.json') && !['nguoi.json', 'y-nghia-nha.json'].includes(f)).map((f) => f.slice(0, -5));
let hong = 0;
for (const s of ds) {
  const d = JSON.parse(readFileSync(join(DIR, `${s}.json`), 'utf8')), n = d.nguoi, sao = (p) => d.sao.find((x) => x.ten === p)?.kinh_do;
  if (!n?.year || sao('Moon') == null) { console.log(`- ${s}: không phải lá số (bỏ qua)`); continue; }
  const goc = Date.UTC(+n.year, +n.month - 1, +n.day, +n.hour, +n.minute);
  let tot = null; for (let q = -48; q <= 56; q++) { const ms = goc - q * 900e3, e = lech(B.kinhDo(ms).Moon, sao('Moon')); if (!tot || e < tot.e) tot = { q, ms, e }; }
  const k = B.kinhDo(tot.ms), dong = [], max = { p: '', e: 0 };
  for (const p of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) { const e = lech(k[p], sao(p)); dong.push(`${p} ${e.toFixed(2)}°`); if (e > max.e) Object.assign(max, { p, e }); }
  const eA = lech(B.cungMoc(tot.ms, +n.lat, +n.lng), d.nha.find((x) => x.so === 1).dinh); dong.push(`ASC ${eA.toFixed(2)}°`); if (eA > max.e) Object.assign(max, { p: 'ASC', e: eA });
  // múi giờ site áp so với giờ UTC tính tay trong sổ người (lá số lấy bằng lay.mjs --nguoi): lệch = site đổi giờ địa phương sai (múi giờ lịch sử, LMT…)
  let tz = ''; if (d.utc_sinh) { const lechPhut = Math.round((tot.ms - Date.parse(d.utc_sinh)) / 60e3); tz = Math.abs(lechPhut) <= 15 ? ' · múi giờ khớp sổ' : ` · ✗ múi giờ site lệch sổ ${lechPhut} phút`; if (Math.abs(lechPhut) > 15) hong++; }
  const dat = max.e <= NGUONG; if (!dat) hong++;
  console.log(`${dat && !tz.includes('✗') ? '✓' : '✗'} ${s.padEnd(18)} ${d.rodden ? `[${d.rodden}] ` : ''}UTC${tot.q >= 0 ? '+' : ''}${tot.q / 4} · ${dong.join(' · ')} · lệch lớn nhất ${max.p} ${max.e.toFixed(2)}°${tz}`);
}
process.exit(hong ? 1 : 0);
