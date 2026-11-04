#!/usr/bin/env node
// LỊCH SỰ KIỆN TRỜI tới phút (G4 kênh Astrolas, 04/11/2026): trăng mới / tròn, sao đổi cung (Mặt Trời → Thổ tinh), sao đứng lại đổi chiều (Thuỷ → Thổ).
// Nguồn chủ đề cho mẫu "This Week in Your Chart" + "Sky Calendar": mos2 › Kênh nội dung › 💡 Hàng chờ hiện các sự kiện sắp tới (ý tưởng tự sinh, mã tw-…).
// Bộ tính: shot-code/bau-troi-tinh.js (khớp Swiss Ephemeris của astrolas.com ≤ 0,06°, la-so/doi-chieu.mjs). Dò mỗi giờ, chia đôi tới 1 phút. 0đ.
//   node lich-troi.mjs [--tu 2026-11-01] [--den 2027-12-31]     → lich-su/lich-troi.json (commit để mos2 đọc) · --tu-kiem: chỉ chạy tự kiểm
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
await import(join(DIR, '../shot-code/bau-troi-tinh.js')); const B = globalThis.BauTroi;
const H = 3600e3, PHUT = 60e3, CUNG = B.CUNG;
const lech = (a) => ((a % 360) + 540) % 360 - 180;   // chênh góc về (−180, 180]
const elong = (ms) => { const k = B.kinhDo(ms); return B.chuan(k.Moon - k.Sun); };
const toc = (ms, sao) => lech(B.kinhDo(ms + 1800e3)[sao] - B.kinhDo(ms - 1800e3)[sao]);   // độ / giờ quanh ms
/** chia đôi khoảng [a, b] tới 1 phút: f(a) và f(b) khác dấu */
function chiaDoi(f, a, b) { let fa = f(a); while (b - a > PHUT) { const m = (a + b) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; } return Math.round((a + b) / 2 / PHUT) * PHUT; }

export function lapLich(tu, den) {
  const su = [], CUNG_SAO = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'], DUNG = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  let truoc = null;
  for (let ms = tu; ms <= den; ms += H) {
    const k = B.kinhDo(ms), e = B.chuan(k.Moon - k.Sun), nay = { k, e, v: Object.fromEntries(DUNG.map((s) => [s, toc(ms, s)])) };
    if (truoc) {
      // trăng mới: elongation đi qua 0 (360 → 0) · trăng tròn: đi qua 180
      if (truoc.e > 300 && e < 60) su.push({ loai: 'trang_moi', ms: chiaDoi((t) => lech(elong(t)), ms - H, ms) });
      if (truoc.e < 180 && e >= 180) su.push({ loai: 'trang_tron', ms: chiaDoi((t) => elong(t) - 180, ms - H, ms) });
      for (const s of CUNG_SAO) { const c0 = Math.floor(B.chuan(truoc.k[s]) / 30), c1 = Math.floor(B.chuan(k[s]) / 30);
        if (c0 !== c1) { const bien = (toc(ms, s) >= 0 ? c1 : c0) * 30, t = chiaDoi((x) => lech(B.kinhDo(x)[s] - bien), ms - H, ms);
          su.push({ loai: 'vao_cung', sao: s, cung: CUNG[c1], nghich: toc(t, s) < 0, ms: t }); } }
      for (const s of DUNG) if (Math.sign(truoc.v[s]) !== Math.sign(nay.v[s]) && truoc.v[s] !== 0) {
        const t = chiaDoi((x) => toc(x, s), ms - H, ms); su.push({ loai: nay.v[s] < 0 ? 'nghich_hanh' : 'di_thuan', sao: s, cung: CUNG[Math.floor(B.chuan(B.kinhDo(t)[s]) / 30)], ms: t }); }
    }
    truoc = nay;
  }
  const SAO_EN = { Sun: 'The Sun', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn' };
  return su.sort((a, b) => a.ms - b.ms).map((x) => {
    const ngay = new Date(x.ms).toISOString().slice(0, 10), cung = x.cung ?? CUNG[Math.floor(B.chuan(B.kinhDo(x.ms).Moon) / 30)];
    const chu = { trang_moi: `New Moon in ${cung}`, trang_tron: `Full Moon in ${cung}`, vao_cung: x.sao === 'Sun' ? `${cung} season begins` : `${SAO_EN[x.sao]} enters ${cung}${x.nghich ? ' (retrograde)' : ''}`,
      nghich_hanh: `${SAO_EN[x.sao]} turns retrograde in ${cung}`, di_thuan: `${SAO_EN[x.sao]} turns direct in ${cung}` }[x.loai];
    return { ma: `tw-${x.loai.replace('_', '-')}${x.sao ? `-${x.sao.toLowerCase()}` : ''}-${cung.toLowerCase()}-${ngay}`, loai: x.loai, sao: x.sao ?? 'Moon', cung, utc: new Date(x.ms).toISOString().slice(0, 16) + 'Z', chu };
  });
}

// TỰ KIỂM: mốc đã biết (USNO / NASA) — trăng tròn 25/01/2024 17:54 UTC, trăng mới 09/02/2024 22:59 UTC (±10 phút);
// Sao Thuỷ nghịch hành 24/10/2026 (quảng cáo spy nhóm #9 "Retrograde Starts Oct 24") — đúng ngày
function tuKiem() {
  const loi = [], gan = (su, loai, iso, phut) => { const t = Date.parse(iso), x = su.find((s) => s.loai === loai && Math.abs(Date.parse(s.utc) - t) < 2 * 86400e3);
    if (!x) loi.push(`không thấy ${loai} quanh ${iso}`); else if (Math.abs(Date.parse(x.utc) - t) > phut * PHUT) loi.push(`${loai} ${x.utc} lệch ${Math.round(Math.abs(Date.parse(x.utc) - t) / PHUT)} phút so với ${iso}`); };
  const a = lapLich(Date.UTC(2024, 0, 20), Date.UTC(2024, 1, 15)); gan(a, 'trang_tron', '2024-01-25T17:54Z', 10); gan(a, 'trang_moi', '2024-02-09T22:59Z', 10);
  const b = lapLich(Date.UTC(2026, 9, 20), Date.UTC(2026, 10, 30));
  if (!b.some((s) => s.loai === 'nghich_hanh' && s.sao === 'Mercury' && s.utc.startsWith('2026-10-24'))) loi.push('Sao Thuỷ nghịch hành không rơi vào 24/10/2026');
  if (!b.some((s) => s.loai === 'trang_moi' && s.utc.startsWith('2026-11-09'))) loi.push('trăng mới không rơi vào 09/11/2026');
  return loi;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const loi = tuKiem(); if (loi.length) { console.error(`✗ tự kiểm lịch trời:\n${loi.map((l) => `   · ${l}`).join('\n')}`); process.exit(1); }
  console.log('✓ tự kiểm: trăng tròn / trăng mới 2024 trong ±10 phút · Sao Thuỷ nghịch hành 24/10/2026 · trăng mới 09/11/2026');
  if (process.argv.includes('--tu-kiem')) process.exit(0);
  const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
  const tu = arg('tu', '2026-11-01'), den = arg('den', '2027-12-31'), su = lapLich(Date.parse(`${tu}T00:00Z`), Date.parse(`${den}T23:59Z`));
  writeFileSync(join(DIR, 'lich-troi.json'), JSON.stringify({ _ghi: 'Lịch sự kiện trời (sinh bởi lich-su/lich-troi.mjs — đừng sửa tay, chạy lại lệnh). Giờ UTC; mos2 hiện giờ VN.', tu, den, tinh_luc: new Date().toISOString().slice(0, 10), su_kien: su }, null, 1) + '\n');
  const dem = su.reduce((o, s) => ({ ...o, [s.loai]: (o[s.loai] ?? 0) + 1 }), {});
  console.log(`✓ lich-troi.json · ${tu} → ${den} · ${su.length} sự kiện · ${Object.entries(dem).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  for (const s of su.slice(0, 12)) console.log(`   ${s.utc}  ${s.chu}`);
}
