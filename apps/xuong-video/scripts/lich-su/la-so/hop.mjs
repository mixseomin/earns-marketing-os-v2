#!/usr/bin/env node
// SYNASTRY hai người (anh 05/11/2026: "Synastry rất quan trọng phải khai thác triệt để"): lấy từ công cụ astrolas.com/synastry-chart theo giờ sinh trong la-so/nguoi.json
//   node hop.mjs <slug-a> <slug-b> [--rel romantic|partner]   ·   node hop.mjs --cap <mã cặp> | (bỏ trống = mọi cặp trong la-so/cap.json)
//   → la-so/hop/<a>--<b>.json  (góc chiếu chéo + điểm từng trục + lời giải nguyên văn của site + cờ DÙNG ĐƯỢC theo hạng Rodden)
//   → la-so/hop/<a>--<b>.svg   (bánh xe đôi, theme Nebula, font ký hiệu nhúng) · <a>--<b>.composite.svg (lá số hợp, nếu site vẽ)
// Luật dùng (giống nhà / Profection): góc chiếu chạm cung Mọc / MC / nhà của ai thì người đó phải hạng trong rodden_dung_nha (AA);
// chạm Trăng thì người đó phải có giờ sinh (AA / A / B — Trăng đi ~0,5°/giờ); hành tinh còn lại chỉ cần ngày sinh. Không đạt → giữ trong tệp, dung=false + lý do.
// Trình duyệt chạy iMac (box cấm trình duyệt), 0đ.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nhungFont } from './font.mjs';

const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
let chromium; try { ({ chromium } = createRequire(import.meta.url)(PW)); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const DIR = dirname(fileURLToPath(import.meta.url)), SITE = 'https://astrolas.com/synastry-chart';
const SO = JSON.parse(readFileSync(join(DIR, 'nguoi.json'), 'utf8')), DUNG_NHA = SO.rodden_dung_nha ?? ['AA'], CO_GIO = ['AA', 'A', 'B'];
const CAP = existsSync(join(DIR, 'cap.json')) ? JSON.parse(readFileSync(join(DIR, 'cap.json'), 'utf8')).cap ?? [] : [];
const GOC_NHA = new Set(['Ascendant', 'MC', 'Descendant', 'IC', 'Vertex']);
/** góc chiếu THẾ HỆ: hai sao chậm (Uranus / Neptune / Pluto) — cả lứa sinh cùng vài năm đều có, site cũng ghi "usually shares a generational wave" → không làm tiêu đề tập */
const CHAM = new Set(['Uranus', 'Neptune', 'Pluto']), theHe = (a, b) => CHAM.has(a) && CHAM.has(b);

/** cờ dùng được cho một góc chiếu: thân thể của A / B + hạng Rodden từng người. Thuần (tự kiểm cuối tệp). */
export function dungDuoc(than, nguoi) {
  if (nguoi.khong_dung) return { dung: false, vi: `${nguoi.ten}: ${nguoi.khong_dung}` };
  if (GOC_NHA.has(than.ten)) { if (!DUNG_NHA.includes(nguoi.rodden)) return { dung: false, vi: `${than.ten} của ${nguoi.ten} cần giờ sinh hạng ${DUNG_NHA.join('/')} (đang ${nguoi.rodden})` }; }
  if (than.ten === 'Moon' && !CO_GIO.includes(nguoi.rodden)) return { dung: false, vi: `Trăng của ${nguoi.ten} cần giờ sinh (đang ${nguoi.rodden})` };
  return { dung: true };
}
/** "1°05'" → 65 phút cung (so độ lệch; parseFloat bỏ mất phần phút) */
export const phut = (l) => { const m = /(\d+)°\s*(\d+)?/.exec(l ?? ''); return m ? +m[1] * 60 + +(m[2] ?? 0) : Infinity; };
const xet = (a, b, A, B) => { const x = dungDuoc(a, A), y = dungDuoc(b, B); return !x.dung ? x : !y.dung ? y : { dung: true }; };

async function lay(tr, A, B, rel) {
  const s = A.sinh, t = B.sinh;
  // không có giờ sinh (hạng X): site nhận giờ trưa + unknown_time — Trăng / cung Mọc / nhà của người đó đã bị cờ dung chặn
  const gio = (x, hau) => (x.gio == null ? { [`hour${hau}`]: 12, [`minute${hau}`]: 0, [`unknown_time${hau}`]: 'on' } : { [`hour${hau}`]: x.gio, [`minute${hau}`]: x.phut });
  const u = `${SITE}?` + new URLSearchParams({ name: A.ten, day: s.ngay, month: s.thang, year: s.nam, ...gio(s, ''), location: s.noi, lat: s.vi, lng: s.kinh,
    name2: B.ten, day2: t.ngay, month2: t.thang, year2: t.nam, ...gio(t, '2'), location2: t.noi, lat2: t.vi, lng2: t.kinh, rel_type: rel === 'partnership' ? 'partner' : rel });   // site: romantic (Romance / Attraction / Challenges / Sexual conflict) · partner (Empathy / Harmony / Teamwork / Challenges)
  const p = await tr.newPage({ viewport: { width: 1400, height: 1100 } });
  await p.goto(u, { waitUntil: 'networkidle', timeout: 90000 });
  await p.evaluate(() => document.querySelectorAll('[data-ccw-theme="nebula"]').forEach((b) => b.click())); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const chu = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const svg = (id) => document.querySelector(`#${id} svg`)?.outerHTML ?? null;
    const luoi = [...document.querySelectorAll('td.asp-cell')].filter((td) => td.dataset.aspect)
      .map((td) => ({ a: td.dataset.row, b: td.dataset.col, goc: td.dataset.aspect, lech: Number(td.dataset.orb), tran: Number(td.dataset.orbitLimit), xa: td.dataset.sep === '1' }));
    const diem = [...document.querySelectorAll('.syn-score__card')].map((c) => ({ truc: c.dataset.axis, ten: chu(c.querySelector('.syn-score__name')), mo_ta: chu(c.querySelector('.syn-score__desc')),
      diem: Number(chu(c.querySelector('.syn-score__num'))), so_goc: Number(chu(c.querySelector('summary')).match(/\d+/)?.[0] ?? 0) }));
    const giai = [...document.querySelectorAll('.syn-interp-item')].filter((it) => it.dataset.noData === '0').map((it) => {
      const than = [...it.querySelectorAll('[data-entity-key]')].map((e) => e.dataset.entityKey);   // đúng hai: sao của A rồi sao của B (cùng tên được — Neptune × Neptune)
      const nha = [...it.querySelectorAll('.sa-house-info')].map((e) => Number(chu(e).replace(/\D/g, '')) || null);
      const tt = it.querySelector('[title*="°)"]')?.getAttribute('title') ?? '', d = it.querySelector('.aspect-interp-item__desc');
      return { tam: it.dataset.mood, a: than[0], b: than[1], nha_a: nha[0] ?? null, nha_b: nha[1] ?? null, goc: tt.split(' (')[0], lech: tt.match(/orb ([^,]+)/)?.[1]?.trim() ?? null,
        tieu_de: chu(d?.querySelector('b')), chu: chu(d) };
    });
    return { vong: svg('sr-wheel-container'), hop: svg('syn-composite-wheel-container'), luoi, diem, giai };
  });
  await p.close();
  return { url: u, ...r };
}

function tuKiem() {
  const loi = [], AA = { ten: 'A', rodden: 'AA' }, DD = { ten: 'D', rodden: 'DD' }, Bh = { ten: 'B', rodden: 'B' };
  if (!dungDuoc({ ten: 'Venus' }, DD).dung) loi.push('Kim tinh của người hạng DD vẫn dùng được (chỉ cần ngày sinh)');
  if (dungDuoc({ ten: 'Moon' }, DD).dung) loi.push('Trăng của người hạng DD phải bị chặn');
  if (phut("1°05'") !== 65 || phut("0°20'") >= phut("1°00'")) loi.push('đọc độ lệch sai');
  if (!dungDuoc({ ten: 'Moon' }, Bh).dung) loi.push('Trăng của người hạng B dùng được');
  if (dungDuoc({ ten: 'Ascendant' }, Bh).dung || !dungDuoc({ ten: 'Ascendant' }, AA).dung) loi.push('cung Mọc chỉ cho hạng AA');
  return loi;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const loiTk = tuKiem(); if (loiTk.length) { console.error(`✗ tự kiểm synastry:\n${loiTk.map((l) => `   · ${l}`).join('\n')}`); process.exit(1); }
  console.log('✓ tự kiểm: hành tinh chỉ cần ngày · Trăng cần giờ (AA/A/B) · cung Mọc / MC chỉ AA');
  if (process.argv.includes('--tu-kiem')) process.exit(0);
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
  const tu = process.argv.slice(2).filter((x, i, a) => !x.startsWith('--') && !a[i - 1]?.startsWith('--'));
  const viec = tu.length === 2 ? [{ ma: `${tu[0]}--${tu[1]}`, a: tu[0], b: tu[1], rel: arg('rel') ?? 'romantic' }] : CAP.filter((c) => !arg('cap') || c.ma === arg('cap'));
  if (!viec.length) { console.error('không có cặp nào (la-so/cap.json trống, hoặc --cap sai mã)'); process.exit(2); }
  mkdirSync(join(DIR, 'hop'), { recursive: true }); const tr = await chromium.launch(); let hong = 0;
  try {
    for (const c of viec) {
      const A = SO.nguoi.find((n) => n.slug === c.a), B = SO.nguoi.find((n) => n.slug === c.b);
      if (!A || !B) { console.log(`✗ ${c.ma}: thiếu ${!A ? c.a : c.b} trong la-so/nguoi.json`); hong++; continue; }
      const r = await lay(tr, A, B, c.rel);
      if (!r.vong || !r.luoi.length) { console.log(`✗ ${c.ma}: trang không có bánh xe đôi / lưới góc chiếu (site đổi khuôn?)`); hong++; continue; }
      const sach = (x) => x.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"(?=[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg")/, '');
      writeFileSync(join(DIR, 'hop', `${c.ma}.svg`), (await nhungFont(sach(r.vong))).svg);
      if (r.hop) writeFileSync(join(DIR, 'hop', `${c.ma}.composite.svg`), (await nhungFont(sach(r.hop))).svg);
      const giai = r.giai.map((g) => ({ ...g, ...xet({ ten: g.a }, { ten: g.b }, A, B), the_he: theHe(g.a, g.b) })), luoi = r.luoi.map((g) => ({ ...g, ...xet({ ten: g.a }, { ten: g.b }, A, B), the_he: theHe(g.a, g.b) }));
      writeFileSync(join(DIR, 'hop', `${c.ma}.json`), JSON.stringify({ ma: c.ma, a: { slug: A.slug, ten: A.ten, rodden: A.rodden }, b: { slug: B.slug, ten: B.ten, rodden: B.rodden }, rel: c.rel,
        nguon: r.url, lay_luc: new Date().toISOString().slice(0, 10), diem: r.diem, luoi, giai, moc: c.moc ?? [] }, null, 1) + '\n');
      const d = giai.filter((g) => g.dung && !g.the_he), chot = [...d].sort((x, y) => phut(x.lech) - phut(y.lech))[0];
      console.log(`✓ ${c.ma}: ${r.luoi.length} góc chiếu · ${giai.length} lời giải (${d.length} dùng được, bỏ góc thế hệ) · ${r.diem.map((x) => `${x.ten} ${x.diem}`).join(' · ')}${chot ? ` · khít nhất: ${chot.a} ${chot.goc} ${chot.b} ${chot.lech}` : ''}`);
    }
  } finally { await tr.close(); }
  process.exit(hong ? 1 : 0);
}
