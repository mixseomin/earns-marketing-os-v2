#!/usr/bin/env node
// THÊM NGƯỜI NỔI TIẾNG TỰ ĐỘNG cho các mẫu dùng lá số (G8 kênh Astrolas, 08/11/2026 — Chart Chapters chỉ có 7 người AA viết tay, ~8 tập là hết đề).
// 0đ, không AI. Mỗi người: bài "<slug>-birth-chart" có trên astrolas.com (sitemap) mà chưa có trong la-so/nguoi.json →
//   1. Astrotheme (bản sao Astro-Databank, như các dòng viết tay): ngày giờ sinh, nơi sinh, hạng Rodden + nguồn giờ → nguoi.json (mọi hạng; luật dùng hạng ở viet-*)
//   2. toạ độ nơi sinh: Nominatim (OpenStreetMap), một lượt / giây
//   3. chỉ hạng AA: bai.mjs (bài site nguyên văn) → lay.mjs --nguoi (lá số /birth) → doi-chieu.mjs (khớp Swiss Ephemeris ≤ 0,25°) — hỏng bước nào thì gỡ người đó
//      khỏi dùng (khong_dung + lý do), không để lá số sai vào video
//   4. mốc đời: Wikidata (chức vụ + ngày nhậm, giải thưởng + ngày, kết hôn + ngày, tác phẩm + ngày phát hành), chỉ mốc có ngày tới tháng → dai/moc-<slug>.json,
//      mỗi mốc ghi đường dẫn Wikidata làm nguồn. Có tệp mốc viết tay thì giữ nguyên.
//   node la-so/them-nguoi.mjs [--toi-da N (mặc định 3)] [--chi <slug>] [--xem]      · node la-so/them-nguoi.mjs --tu-kiem
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const DIR = dirname(fileURLToPath(import.meta.url)), SO = join(DIR, 'nguoi.json'), UA = { 'user-agent': 'Mozilla/5.0 (Macintosh) astrolas-studio/1.0' };
const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const chu = (h) => h.replace(/&#0?39;/g, "'").replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#0?39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');

/** Trang Astrotheme → { ngay, thang, nam, gio, phut, noi, rodden, nguon_gio, nguoi_gop } hoặc null. Thuần. */
export function docAstrotheme(html) {
  const t = chu(html), b = /Born: \w+, (\w+) (\d+) ?, (\d{4}), (\d+):(\d+) (AM|PM) In: (.+?) (?:Sun|Dominants|Sun:)/.exec(t);
  const r = /\b(AA|A|B|C|DD|XX|X) Reliability Source : (.+?) Contributor : (.+?)(?= Additional information| \$\(| Astrological portrait|$)/.exec(t);
  if (!b || !r) return null;
  const thang = THANG.indexOf(b[1]) + 1; if (!thang) return null;
  let gio = Number(b[4]) % 12; if (b[6] === 'PM') gio += 12;
  // AS / MC Astrotheme in sẵn → đối chiếu lá số dựng ra (sai nơi / giờ thì cung Mọc lệch)
  const doCung = (k) => { const m = new RegExp(`${k}: (\\d+)\\D+(\\d+)\\D+? ?(${CUNG.join('|')})`).exec(t); return m ? CUNG.indexOf(m[3]) * 30 + Number(m[1]) + Number(m[2]) / 60 : null; };
  // nơi: "Concord (CA) (United States)" → "Concord, CA, United States" — giữ mã bang (bỏ thì Nominatim chọn Concord, New Hampshire)
  return { ngay: Number(b[2]), thang, nam: Number(b[3]), gio, phut: Number(b[5]), noi: b[7].replace(/\s*\(([^()]+)\)/g, ', $1').trim(), rodden: r[1], nguon_gio: r[2].trim(), nguoi_gop: r[3].trim(), as: doCung('AS'), mc: doCung('MC') };
}
/** Mốc Wikidata (dòng SPARQL) → mốc tệp dai/moc-*.json. Chỉ ngày tới tháng (precision ≥ 10). Mỗi năm một mốc, ưu tiên chức vụ > giải > kết hôn > tác phẩm, tối đa 8. Thuần. */
export function locMoc(dong, ten) {
  const UU = { position: 0, award: 1, team: 2, spouse: 3, work: 4 }, ho = ten.split(' ').slice(-1)[0];
  const cau = { position: (x) => `${ho} becomes ${x}.`, award: (x) => `${ho} receives the ${x}.`, spouse: (x) => `${ho} marries ${x}.`, team: (x) => `${ho} joins ${x}.`, work: (x) => `${x} is released.` };
  const nhan = { position: 'office', award: 'award', team: 'team', spouse: 'marriage', work: 'release' };
  const ds = dong.filter((d) => Number(d.prec) >= 10 && d.x && !/^Q\d+$/.test(d.x)).map((d) => ({ ...d, ngay: d.t.slice(0, Number(d.prec) >= 11 ? 10 : 7) }))
    .sort((a, b) => UU[a.loai] - UU[b.loai] || a.ngay.localeCompare(b.ngay));
  const nam = new Set(), ra = [];
  for (const d of ds) { const y = d.ngay.slice(0, 4); if (nam.has(y) || ra.length >= 8) continue; nam.add(y);
    ra.push({ nam: Number(y), ngay: d.ngay, nhan: nhan[d.loai], chu: cau[d.loai](d.x), nguon: d.nguon }); }
  return ra.sort((a, b) => a.ngay.localeCompare(b.ngay));
}

if (process.argv.includes('--tu-kiem')) {
  const h = "<p>Born: Friday, June 14 , 1946, 10:54 AM In: Jamaica, Queens, New York (NY) (United States) Sun: 22°56' Gemini AS: 29°59' Leo Moon: 21°12' Sagittarius MC: 24°22' Taurus Dominants</p><b>AA</b> Reliability Source : birth certificate or birth record Contributor : Lois Rodden <script>$(document)</script>";
  assert.deepEqual(docAstrotheme(h), { ngay: 14, thang: 6, nam: 1946, gio: 10, phut: 54, noi: 'Jamaica, Queens, New York, NY, United States', rodden: 'AA', nguon_gio: 'birth certificate or birth record', nguoi_gop: 'Lois Rodden', as: 149 + 59 / 60, mc: 54 + 22 / 60 });
  assert.equal(docAstrotheme(h.replace('Jamaica, Queens, New York (NY)', 'Concord (CA)')).noi, 'Concord, CA, United States');
  assert.equal(docAstrotheme(h.replace('10:54 AM', '7:15 PM')).gio, 19);
  assert.equal(docAstrotheme(h.replace('12', '12').replace('10:54 AM', '12:05 AM')).gio, 0);
  const m = locMoc([{ loai: 'award', x: 'Nobel Prize', t: '1921-11-09T00:00:00Z', prec: '11', nguon: 'w' }, { loai: 'position', x: 'President', t: '1921-01-01T00:00:00Z', prec: '9' },
    { loai: 'spouse', x: 'Mileva', t: '1903-01-06T00:00:00Z', prec: '11' }, { loai: 'work', x: 'Q123', t: '1905-06-01T00:00:00Z', prec: '11' }, { loai: 'award', x: 'Copley Medal', t: '1925-03-01T00:00:00Z', prec: '10' }], 'Albert Einstein');
  assert.deepEqual(m.map((x) => x.ngay), ['1903-01-06', '1921-11-09', '1925-03'], 'bỏ mốc chỉ có năm + nhãn chưa có tên');
  assert.equal(m[1].chu, 'Einstein receives the Nobel Prize.');
  console.log('them-nguoi: tự kiểm đạt'); process.exit(0);
}

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; }, xem = process.argv.includes('--xem');
const SITE = await (await fetch('https://astrolas.com/sitemap.xml', { headers: UA })).text();
const S = JSON.parse(readFileSync(SO, 'utf8')), co = new Set(S.nguoi.map((x) => x.slug));
// bài lá số người: <slug>-birth-chart; bỏ bài chủ đề ("chiron-in-the-birth-chart", "how-to-read-your-birth-chart…", "what-is-a-birth-chart")
const moi = [...new Set([...SITE.matchAll(/\/blog\/([a-z0-9-]+)-birth-chart(?=<|")/g)].map((m) => m[1]))].filter((s) => !co.has(s) && !/(^|-)(in-the|your|what-is-a|how-to|the)$/.test(s) && (!arg('chi') || s === arg('chi')));
console.log(`· site có ${moi.length} bài lá số người chưa vào sổ${moi.length ? `: ${moi.slice(0, 12).join(' ')}${moi.length > 12 ? '…' : ''}` : ''}`);
const ngu = (ms) => new Promise((o) => setTimeout(o, ms)), node = (args) => execFileSync(process.execPath, args, { cwd: DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const tenCua = async (slug) => { const h = await (await fetch(`https://astrolas.com/en/blog/${slug}-birth-chart`, { headers: UA })).text(); return (/<h1[^>]*>([^<]+)</.exec(h)?.[1] ?? '').replace(/&#0?39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/['’]s\b.*$|\s*Birth Chart.*$|:.*$/i, '').trim() || slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '); };

async function mocWikidata(ten) {
  const e = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(ten.replace(/ /g, '_'))}&props=info&format=json&redirects=yes`, { headers: UA })).json();
  const q = Object.keys(e.entities ?? {}).find((k) => /^Q\d+$/.test(k)); if (!q) return { q: null, moc: [] };
  // mỗi loại một truy vấn nhỏ (gộp UNION + nhãn thì Wikidata trả 504 upstream timeout — 08/11/2026), chỉ ngày tới tháng
  const LOAI = [['position', `wd:${q} p:P39 ?st . ?st ps:P39 ?x . ?st pqv:P580 ?tv .`], ['award', `wd:${q} p:P166 ?st . ?st ps:P166 ?x . ?st pqv:P585 ?tv .`],
    // giải thường chỉ ghi năm; lễ trao giải (P805 → lễ có ngày P585) cho ngày thật — Oscar, Grammy…
    ['award', `wd:${q} p:P166 ?st . ?st ps:P166 ?x . ?st pq:P805 ?le . ?le p:P585/psv:P585 ?tv .`],
    ['spouse', `wd:${q} p:P26 ?st . ?st ps:P26 ?x . ?st pqv:P580 ?tv .`], ['team', `wd:${q} p:P54 ?st . ?st ps:P54 ?x . ?st pqv:P580 ?tv .`],
    ['work', `wd:${q} wdt:P800 ?x . ?x p:P577/psv:P577 ?tv .`]];
  const dong = [];
  for (const [loai, mau] of LOAI) {
    const sparql = `SELECT ?xLabel ?t ?prec WHERE { ${mau} ?tv wikibase:timeValue ?t ; wikibase:timePrecision ?prec . FILTER(?prec >= 10) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 40`;
    const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers: { ...UA, accept: 'application/sparql-results+json' } });
    if (!r.ok) throw new Error(`Wikidata ${loai} ${r.status}`);
    for (const b of (await r.json()).results.bindings) dong.push({ loai, x: b.xLabel?.value, t: b.t.value, prec: b.prec.value, nguon: `https://www.wikidata.org/wiki/${q}` });
    await ngu(400);
  }
  return { q, moc: locMoc(dong, ten) };
}

let them = 0; const bao = [];
// BÙ MỐC: người AA dùng được mà chưa có tệp mốc (lượt trước Wikidata hỏng / mới thêm) → dựng lại, mỗi lượt tối đa 10 người
if (!xem) { let n = 0; for (const x of S.nguoi.filter((x) => x.rodden === 'AA' && !x.khong_dung && existsSync(join(DIR, `bai/${x.slug}-birth-chart.json`)) && !existsSync(join(DIR, `../dai/moc-${x.slug}.json`)))) {
  if (n++ >= Number(arg('bu-moc', 10))) break;
  try { const { moc } = await mocWikidata(x.ten); if (moc.length) writeFileSync(join(DIR, `../dai/moc-${x.slug}.json`), JSON.stringify({ ten: x.ten, sinh: `${THANG[x.sinh.thang - 1]} ${x.sinh.ngay}, ${x.sinh.nam}, ${x.sinh.noi}`, nguon: 'Wikidata (la-so/them-nguoi.mjs)', moc }, null, 1) + '\n');
    bao.push(`${moc.length ? '✓' : '·'} mốc ${x.slug}: ${moc.length} mốc Wikidata`); } catch (e) { bao.push(`⚠ mốc ${x.slug}: ${e.message}`); } } }
for (const slug of moi) {
  if (them >= Number(arg('toi-da', 3))) break;
  const ten = await tenCua(slug), at = `https://www.astrotheme.com/astrology/${encodeURIComponent(ten.replace(/ /g, '_'))}`;
  const r = await fetch(at, { headers: UA }), d = r.ok ? docAstrotheme(new TextDecoder('latin1').decode(await r.arrayBuffer())) : null;   // Astrotheme trả ISO-8859-1 (Coyoacán…)
  if (!d) { bao.push(`✗ ${slug} (${ten}): Astrotheme ${r.status} — không đọc được giờ sinh`); S.nguoi.push({ slug, ten, khong_dung: `Astrotheme không đọc được (${at} → ${r.status})`, them_luc: new Date().toISOString().slice(0, 10) }); continue; }
  await ngu(1100);
  const g = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(d.noi)}`, { headers: UA })).json();
  if (!g[0]) { bao.push(`✗ ${slug}: không tìm được toạ độ "${d.noi}"`); S.nguoi.push({ slug, ten, khong_dung: `không tìm được toạ độ ${d.noi}`, them_luc: new Date().toISOString().slice(0, 10) }); continue; }
  const n = { slug, ten, sinh: { ngay: d.ngay, thang: d.thang, nam: d.nam, gio: d.gio, phut: d.phut, noi: d.noi, vi: Math.round(Number(g[0].lat) * 1e4) / 1e4, kinh: Math.round(Number(g[0].lon) * 1e4) / 1e4 },
    utc: null, rodden: d.rodden, nguon: at, ghi: `${d.nguon_gio} · ${d.nguoi_gop} · toạ độ OpenStreetMap · thêm tự động (la-so/them-nguoi.mjs)`, them_luc: new Date().toISOString().slice(0, 10) };
  if (xem) { bao.push(`→ ${slug}: ${d.rodden} · ${d.ngay}/${d.thang}/${d.nam} ${d.gio}:${String(d.phut).padStart(2, '0')} · ${d.noi} (${n.sinh.vi}, ${n.sinh.kinh})`); them++; continue; }
  S.nguoi.push(n); writeFileSync(SO, JSON.stringify(S, null, 1) + '\n');
  if (d.rodden !== 'AA') { bao.push(`· ${slug}: hạng ${d.rodden} — vào sổ, không dựng lá số (chỉ AA dùng nhà / cung Mọc)`); continue; }
  const go = (ly) => { n.khong_dung = ly; writeFileSync(SO, JSON.stringify(S, null, 1) + '\n'); bao.push(`✗ ${slug}: ${ly}`); };
  try { node(['../bai.mjs', `${slug}-birth-chart`].map((x, i) => (i ? x : join(DIR, 'bai.mjs')))); } catch (e) { go(`tải bài site hỏng: ${String(e.stdout || e.message).trim().split('\n').pop()}`); continue; }
  try { node([join(DIR, 'lay.mjs'), '--nguoi', slug]); } catch (e) { go(`lấy lá số /birth hỏng: ${String(e.stderr || e.message).trim().split('\n').pop()}`); continue; }
  { const L = JSON.parse(readFileSync(join(DIR, `${slug}.json`), 'utf8')), lech = (a, b) => Math.abs(((a - b + 540) % 360) - 180), as = L.nha?.[0]?.dinh, mc = L.nha?.[9]?.dinh;
    if (d.as == null || as == null || lech(as, d.as) > 1 || (d.mc != null && lech(mc, d.mc) > 1)) { go(`cung Mọc / MC lệch Astrotheme (lá số ${as?.toFixed(1)}° / ${mc?.toFixed(1)}°, Astrotheme ${d.as?.toFixed(1)}° / ${d.mc?.toFixed(1)}°) — sai nơi hoặc giờ`); continue; } }
  try { node([join(DIR, 'doi-chieu.mjs'), slug]); } catch (e) { go(`lá số lệch Swiss Ephemeris: ${String(e.stdout || e.message).trim().split('\n').slice(-2).join(' · ')}`); continue; }
  const tepMoc = join(DIR, `../dai/moc-${slug}.json`); let soMoc = 0;
  if (!existsSync(tepMoc)) { let moc = []; try { ({ moc } = await mocWikidata(ten)); } catch (e) { bao.push(`⚠ ${slug}: mốc Wikidata hỏng — ${e.message}`); } soMoc = moc.length;
    if (moc.length) writeFileSync(tepMoc, JSON.stringify({ ten, sinh: `${THANG[d.thang - 1]} ${d.ngay}, ${d.nam}, ${d.noi}`, nguon: 'Wikidata (la-so/them-nguoi.mjs)', moc }, null, 1) + '\n'); }
  them++; bao.push(`✓ ${slug}: AA · lá số khớp · bài site · ${soMoc} mốc Wikidata`);
}
// TẬP CHO NGƯỜI MỚI: người AA dùng được (không khong_dung, có lá số + bài site) mà chưa có tệp tập Chart Chapters → chạy các máy viết theo người
// (0đ, không AI): viet-chuong (Chart Chapters), viet-ask (Ask the Chart theo mốc), viet-ryc (Read Your Chart 12 mục). Tệp tập là ứng viên của chay-so-kenh.
if (!xem) { const TAP = join(DIR, '../../shot-code/tap-astrolas'), S2 = JSON.parse(readFileSync(SO, 'utf8'));
  for (const n of S2.nguoi.filter((x) => x.rodden === 'AA' && !x.khong_dung && existsSync(join(DIR, `${x.slug}.json`)) && existsSync(join(DIR, `bai/${x.slug}-birth-chart.json`)) && !existsSync(join(TAP, `cc-${x.slug}.json`)))) {
    const kq = [['viet-chuong.mjs', '--ai', n.slug], ['viet-ask.mjs', '--ai', n.slug], ['viet-ryc.mjs', '--muc', 'all', '--ai', n.slug]].map((l) => {
      try { execFileSync(process.execPath, [join(DIR, '..', l[0]), ...l.slice(1)], { cwd: join(DIR, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15 * 60_000 }); return `${l[0]} ✓`; }
      catch (e) { return `${l[0]} ✗ ${String(e.stderr || e.stdout || e.message).trim().split('\n').pop().slice(0, 160)}`; } });
    bao.push(`${kq.some((x) => x.includes('✗')) ? '⚠' : '✓'} tập cho ${n.slug}: ${kq.join(' · ')}`); } }
for (const l of bao) console.log(l);
console.log(`them-nguoi: ${xem ? 'đọc được' : 'thêm'} ${them} người${xem ? ` (${bao.filter((l) => / AA · /.test(l)).length} hạng AA)` : ' AA dùng được'}`);
process.exit(0);
