#!/usr/bin/env node
// MỐC ZODIACAL RELEASING (G4 kênh Astrolas, 05/11/2026): kỳ L1 + L2 của người nổi tiếng lấy từ công cụ site astrolas.com/tools/zodiacal-releasing
// (cùng giờ sinh trong la-so/nguoi.json), tự tính lại bằng shot-code/bau-troi-tinh.js để đối chiếu → la-so/zr/<slug>.json.
// Video "Chart Chapters" dài / Short ghép mốc đời (dai/moc-<slug>.json) với kỳ đang chạy: kyTai(zr, '1985-09-17') → L1 Sagittarius · L2 … · đỉnh / nhảy cung.
//   node zr.mjs [slug …]      (bỏ trống = mọi người dùng được nhà trong sổ) · --tu-kiem: chỉ tự kiểm phần tính
// Chỉ người hạng trong rodden_dung_nha (AA): Lot đi theo cung Mọc, giờ sinh lệch 4 phút là Lot lệch 1° — cùng luật với nhà / Profection.
// Lấy bằng fetch (trang trả sẵn HTML cây L1/L2, không cần trình duyệt), 0đ. Site và bộ tính lệch → mã 1, không ghi tệp.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), SITE = 'https://astrolas.com/tools/zodiacal-releasing';
await import(join(DIR, '../../shot-code/bau-troi-tinh.js')); const B = globalThis.BauTroi, CUNG = B.CUNG;
/** năm nhỏ của chủ cung (Valens): kỳ L1 = số năm × 360 ngày, L2 = số tháng × 30 ngày */
const NAM_NHO = { Aries: 15, Taurus: 8, Gemini: 20, Cancer: 25, Leo: 19, Virgo: 20, Libra: 8, Scorpio: 15, Sagittarius: 12, Capricorn: 27, Aquarius: 30, Pisces: 12 };
const NGAY = 86400e3;

/** Lot of Spirit / Fortune: ban ngày (Mặt Trời trên đường chân trời) Spirit = ASC + Mặt Trời − Trăng, Fortune ngược lại; ban đêm đảo. */
export function lot(ms, vi, kinh) {
  const k = B.kinhDo(ms), asc = B.cungMoc(ms, vi, kinh), ngay = B.chuan(k.Sun - asc) >= 180;
  const spirit = B.chuan(asc + (ngay ? k.Sun - k.Moon : k.Moon - k.Sun)), fortune = B.chuan(asc + (ngay ? k.Moon - k.Sun : k.Sun - k.Moon));
  return { ngay, spirit, fortune, asc };
}
/** Chia kỳ L1 (từ cung của Lot) và L2 (trong mỗi L1, bắt đầu từ cung của L1; mỗi lần L2 sắp quay về đúng cung L1 mà L1 chưa hết thì NHẢY sang cung đối diện —
 *  loosing of the bond; L1 dài như Capricorn / Aquarius nhảy được hai lần, như công cụ site). */
export function chiaKy(cungLot, tuMs, denMs) {
  const ra = []; let t = tuMs, c1 = CUNG.indexOf(cungLot);
  while (t < denMs) {
    const dai1 = NAM_NHO[CUNG[c1]] * 360 * NGAY, het1 = t + dai1; ra.push({ cap: 1, cung: CUNG[c1], tu: t, den: het1, nhay: false });
    let t2 = t, c2 = c1, dau = true, nhay = false;
    while (t2 < het1) {
      if (!dau && c2 === c1) { c2 = (c1 + 6) % 12; nhay = true; }
      const den2 = Math.min(het1, t2 + NAM_NHO[CUNG[c2]] * 30 * NGAY); ra.push({ cap: 2, cung: CUNG[c2], tu: t2, den: den2, nhay });
      t2 = den2; c2 = (c2 + 1) % 12; dau = false; nhay = false;
    }
    t = het1; c1 = (c1 + 1) % 12;
  }
  return ra;
}
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const dmyIso = (s) => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; };

/** Kỳ đang chạy tại một ngày (ISO): { l1, l2 } — để kịch bản nói "1985: L1 Sagittarius, L2 Gemini (nhảy cung)". */
export function kyTai(zr, ngay, lotTen = 'spirit') {
  const ds = zr.lot[lotTen] ?? []; const tim = (cap) => ds.find((k) => k.cap === cap && k.tu <= ngay && ngay < k.den) ?? null;
  return { l1: tim(1), l2: tim(2) };
}

async function laySite(n, lotTen) {
  const s = n.sinh, u = `${SITE}?` + new URLSearchParams({ name: n.ten, day: s.ngay, month: s.thang, year: s.nam, hour: s.gio, minute: s.phut, location: s.noi, lat: s.vi, lng: s.kinh, lot: lotTen });
  const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) astrolas-studio' } }); if (!r.ok) throw new Error(`${n.slug} ${lotTen}: site trả ${r.status}`);
  const h = await r.text(), dem = /Lot of \w+ · (Day|Night) chart/.exec(h)?.[1];
  const ky = [...h.matchAll(/<button[^>]*zr-analyze-btn[^>]*>/gs)].map((m) => Object.fromEntries([...m[0].matchAll(/data-([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])))
    .filter((b) => b.level === '1' || b.level === '2')
    .map((b) => ({ cap: +b.level, cung: b.sign, tu: dmyIso(b.start), den: dmyIso(b.end), tuoi: [+b['start-age'], +b['end-age']], nha: +b.house, dinh: b.peak === '1', nhay: b.lb === '1', bao_truoc: b.foreshadow === '1' }));
  if (!ky.length) throw new Error(`${n.slug} ${lotTen}: trang không có cây kỳ (site đổi khuôn?)`);
  return { url: u, ban_ngay: dem ? dem === 'Day' : null, ky };
}

/** đối chiếu: cung + ngày bắt đầu từng kỳ của site với bộ tính (±2 ngày: site làm tròn theo giờ địa phương) */
function doiChieu(n, lotTen, site) {
  const ms = Date.parse(n.utc), L = lot(ms, n.sinh.vi, n.sinh.kinh), cung = CUNG[Math.floor(L[lotTen] / 30)], loi = [];
  if (site.ban_ngay != null && site.ban_ngay !== L.ngay) loi.push(`site ghi lá số ${site.ban_ngay ? 'ban ngày' : 'ban đêm'}, bộ tính ra ngược lại`);
  if (site.ky[0].cung !== cung) loi.push(`Lot of ${lotTen}: site ${site.ky[0].cung}, bộ tính ${cung} (${L[lotTen].toFixed(2)}°)`);
  const tinh = chiaKy(site.ky[0].cung, ms, Date.parse(`${site.ky.at(-1).den}T00:00Z`) + NGAY);
  for (const k of site.ky) { const t = tinh.find((x) => x.cap === k.cap && Math.abs(x.tu - Date.parse(`${k.tu}T00:00Z`)) <= 2 * NGAY);
    if (!t) loi.push(`L${k.cap} ${k.cung} từ ${k.tu}: bộ tính không có kỳ bắt đầu ngày này`); else if (t.cung !== k.cung) loi.push(`L${k.cap} từ ${k.tu}: site ${k.cung}, bộ tính ${t.cung}`);
    else if (t.nhay !== k.nhay) loi.push(`L${k.cap} ${k.cung} từ ${k.tu}: site ${k.nhay ? 'có' : 'không'} nhảy cung, bộ tính ngược lại`); }
  return { loi, lotDo: +L[lotTen].toFixed(2) };
}

function tuKiem() {
  const loi = [], k = chiaKy('Libra', Date.UTC(2000, 0, 1), Date.UTC(2040, 0, 1)), l1 = k.filter((x) => x.cap === 1);
  if (l1.map((x) => x.cung).join() !== 'Libra,Scorpio,Sagittarius,Capricorn') loi.push(`L1 sai thứ tự: ${l1.map((x) => x.cung)}`);
  if (Math.round((l1[0].den - l1[0].tu) / NGAY) !== 2880) loi.push('L1 Libra phải 2.880 ngày (8 × 360)');
  // Capricorn 27 năm = 9.720 ngày; L2 đi đủ 12 cung = 211 tháng × 30 = 6.330 ngày < 9.720 → phải nhảy sang Cancer (đối diện Capricorn)
  const cap = l1[3], l2 = k.filter((x) => x.cap === 2 && x.tu >= cap.tu && x.tu < cap.den), j = l2.findIndex((x) => x.nhay);
  if (j !== 12 || l2[j].cung !== 'Cancer') loi.push(`L2 trong Capricorn phải nhảy sang Cancer ở kỳ thứ 13 (được ${j} ${l2[j]?.cung})`);
  // nhảy lần hai: Cancer → … → Sagittarius rồi lại sắp tới Capricorn → nhảy Cancer lần nữa (mốc đối chiếu: Madonna, L1 Capricorn 2031–2058 trên site)
  if (l2.filter((x) => x.nhay).length !== 2) loi.push(`L2 trong Capricorn phải nhảy 2 lần (được ${l2.filter((x) => x.nhay).length})`);
  return loi;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const loiTk = tuKiem(); if (loiTk.length) { console.error(`✗ tự kiểm ZR:\n${loiTk.map((l) => `   · ${l}`).join('\n')}`); process.exit(1); }
  console.log('✓ tự kiểm: thứ tự L1 · 360 ngày / năm · L2 nhảy cung đối diện mỗi lần sắp về cung L1');
  if (process.argv.includes('--tu-kiem')) process.exit(0);
  const SO = JSON.parse(readFileSync(join(DIR, 'nguoi.json'), 'utf8')), dung = SO.rodden_dung_nha ?? ['AA'];
  const chon = process.argv.slice(2).filter((a) => !a.startsWith('--')), ds = SO.nguoi.filter((n) => (chon.length ? chon.includes(n.slug) : true));
  mkdirSync(join(DIR, 'zr'), { recursive: true }); let hong = 0;
  for (const n of ds) {
    if (n.khong_dung || !dung.includes(n.rodden)) { console.log(`- ${n.slug}: hạng ${n.rodden}${n.khong_dung ? ' (đánh dấu không dùng)' : ''} — Lot theo cung Mọc, không dùng ZR`); if (chon.length) hong++; continue; }
    const ra = { ten: n.ten, rodden: n.rodden, nguon: SITE, lay_luc: new Date().toISOString().slice(0, 10), lot: {}, lot_do: {}, ban_ngay: null }; const loi = [];
    for (const lt of ['spirit', 'fortune']) { const s = await laySite(n, lt), d = doiChieu(n, lt, s);
      loi.push(...d.loi.map((x) => `${lt}: ${x}`)); ra.lot[lt] = s.ky; ra.lot_do[lt] = d.lotDo; ra.ban_ngay = s.ban_ngay; }
    if (loi.length) { hong++; console.log(`✗ ${n.slug}:\n${loi.slice(0, 8).map((l) => `   · ${l}`).join('\n')}`); continue; }
    writeFileSync(join(DIR, 'zr', `${n.slug}.json`), JSON.stringify(ra, null, 1) + '\n');
    const l1 = ra.lot.spirit.filter((k) => k.cap === 1).map((k) => `${k.cung}${k.dinh ? '★' : ''} ${k.tu.slice(0, 4)}`).join(' → ');
    console.log(`✓ ${n.slug.padEnd(18)} ${ra.ban_ngay ? 'ngày' : 'đêm'} · Spirit ${ra.lot.spirit[0].cung} · ${ra.lot.spirit.length + ra.lot.fortune.length} kỳ khớp bộ tính · L1: ${l1}`);
  }
  process.exit(hong ? 1 : 0);
}
