#!/usr/bin/env node
// MÁY VIẾT "LOVE STORY IN TWO CHARTS" (G5 kênh Astrolas, 05/11/2026): một cặp tình cảm trong sổ cặp (la-so/cap.json) → một video dài 16:9 cho shot-code/la-so.html.
// 0đ, không AI. Đi theo MỐC ĐỜI của cặp (Wikipedia, sổ cặp); giữa các mốc: bánh xe đôi · 2 góc chiếu chéo khít nhất dùng được (tiêu đề lời giải Synastry của site,
// chonGoc của viet-cap.mjs) · điểm từng trục của site; mốc nào người hạng AA đang ở kỳ Peak Period / Loosing of the Bond của Zodiacal Releasing (la-so/zr, công cụ site)
// thì thêm thẻ kỳ ZR. Hook = dòng đầu QC spy góc Tình yêu; bài đăng = Synastry của site mở thẳng hai lá số + link Zodiacal Releasing.
//   node viet-love-story.mjs --cap brad-pitt--angelina-jolie [--goc-hook gh.json] [--ra <tệp>]   · --cap all = mọi cặp romantic có ≥ 3 mốc
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh, hookGon, hookNgan } from './chu-man.mjs';
import { chonGoc, tenNgan } from './viet-cap.mjs';
import { kyTai } from './la-so/zr.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ngayChu = (d) => { const [y, m, n] = d.split('-').map(Number); return n ? `${THANG[m - 1]} ${n}, ${y}` : m ? `${THANG[m - 1]} ${y}` : String(y); };
const KYS = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Ascendant: 'AC', MC: 'MC' };

function layHook(goc) {
  const f = arg('goc-hook'); if (f) return JSON.parse(readFileSync(f, 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 240s ../../node_modules/.bin/tsx scripts/may-dung.mts --may astrolas --goc-hook --goc ${goc}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"goc"'));
  if (!dong) { console.error(`✗ không lấy được hook spy góc ${goc}`); process.exit(3); }
  return JSON.parse(dong);
}

/** kỳ ZR đáng kể của một người hạng AA tại một mốc: L2 rồi L1, Spirit rồi Fortune — chỉ Peak Period / Loosing of the Bond (nhãn của công cụ site) */
function zrMoc(slug, ngay) {
  if (!existsSync(join(DIR, `la-so/zr/${slug}.json`))) return null;
  const zr = doc(`la-so/zr/${slug}.json`), n = ngay.length === 7 ? `${ngay}-15` : ngay.length === 4 ? `${ngay}-07-01` : ngay;
  for (const lot of ['spirit', 'fortune']) { const k = kyTai(zr, n, lot);
    for (const [cap, ky] of [[2, k.l2], [1, k.l1]]) if (ky?.dinh || ky?.nhay) return { lot: lot === 'spirit' ? 'Spirit' : 'Fortune', cap, cung: ky.cung, nhan: ky.nhay ? 'Loosing of the Bond' : 'Peak Period' }; }
  return null;
}

function vietMot(c, gh, ra) {
  const h = doc(`la-so/hop/${c.ma}.json`), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'love-compatibility'), NG = doc('la-so/nguoi.json').nguoi;
  const ngan = (x) => NG.find((n) => n.slug === x.slug)?.ten_ngan ?? tenNgan(x.ten), A = ngan(h.a), B = ngan(h.b), gocs = chonGoc(h).slice(0, 2);
  const moc = [...(c.moc ?? [])].sort((x, y) => x.ngay.localeCompare(y.ngay)); if (moc.length < 3 || gocs.length < 2) { console.error(`✗ ${c.ma}: cần ≥ 3 mốc + 2 góc chiếu (có ${moc.length} / ${gocs.length})`); return false; }
  const hs = hookGon(gh.hooks.filter((x) => !/\d/.test(x.chu) && !/retrograde/i.test(x.chu))), hook = hs[[...c.ma].reduce((s, ch) => s + ch.charCodeAt(0), 0) % hs.length] ?? gh.hooks[0], chuHook = hookNgan(hook.chu);
  const goc = (g) => ({ nhin: { cheo: [`person-a:${g.a}`, `person-b:${g.b}`] }, nhan: `${KYS[g.a] ?? ''} ${A}'s ${g.a} · ${g.goc.toLowerCase()} · ${KYS[g.b] ?? ''} ${B}'s ${g.b} · ${g.lech}`,
    chu: `${A}'s ${g.a}, ${g.goc.toLowerCase()}, ${B}'s ${g.b}: “${g.tieu_de.replace(/[.]$/, '')}.”` });
  const giua = [{ nhin: { toan: 1 }, chu: 'Both birth charts, one wheel.', nhan: `${A} · ${B}` }, goc(gocs[0]), goc(gocs[1]), { nhin: { diem: 1 }, chu: `The Synastry tool scores it: ${h.diem.map((d) => `${d.ten} ${d.diem}`).slice(0, 2).join(', ')}.` }];
  const cau = [{ nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: `${A.split(' ')[0]} & ${B.split(' ')[0]}`, duoi: 'a story in two charts', dong: [], vi: 'tren' } }];
  // thẻ ZR: tối đa 2 mỗi video (Loosing of the Bond, rồi đỉnh cấp 1, rồi đỉnh cấp 2) — kỳ đỉnh rơi vào 4 / 12 cung nên gần mốc nào cũng có, nhiều thẻ thành lặp
  const ungVien = moc.flatMap((m) => [h.a, h.b].map((p) => ({ m, p, z: zrMoc(p.slug, m.ngay) }))).filter((x) => x.z)
    .sort((x, y) => (x.z.nhan === 'Loosing of the Bond' ? 0 : x.z.cap === 1 ? 1 : 2) - (y.z.nhan === 'Loosing of the Bond' ? 0 : y.z.cap === 1 ? 1 : 2)).slice(0, 2);
  moc.forEach((m, i) => {
    cau.push({ nhin: { troi: 1 }, chu: m.chu, the: { lon: m.ngay.slice(0, 4), duoi: ngayChu(m.ngay), dong: [], vi: 'tren' } });
    for (const { p, z } of ungVien.filter((x) => x.m === m)) {
      cau.push({ nhin: { troi: 1 }, chu: `${ngan(p)}'s chart that year: Lot of ${z.lot}, level ${z.cap}, ${z.cung}: a ${z.nhan}.`, the: { lon: `${z.cung} ★`, duoi: `Zodiacal Releasing · ${m.ngay.slice(0, 4)}`, dong: [`Lot of ${z.lot} · level ${z.cap}`, z.nhan], vi: 'tren' } }); }
    if (i === 0) cau.push(...giua);
  });
  cau.push({ nhin: { troi: 1 }, khung: true, chu: 'Compare any two charts free at astrolas.com.' });
  const tieuDe = `${chuHook} ${A} and ${B}: a love story in two charts`, tg = (p) => relative(SHOT, join(DIR, p));
  const tap = tachCanh({ _ghi: `Love Story in Two Charts · ${A} & ${B} — sinh bởi lich-su/viet-love-story.mjs (mốc la-so/cap.json, synastry + ZR của site, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'love-story-charts', playlist_ma: 'love-compatibility', y_tuong: `ls-${c.ma}`, khung: 'ngang', tieu_de: tieuDe, goc: gh.goc, hook: { qc: hook.id, goc: hook.chu },
    dang: dangCongCu('synastry-chart', [c.a, c.b], { rel_type: 'romantic' }, `${h.a.ten} and ${h.b.ten}: the relationship, year by year, with both birth charts. Zodiacal Releasing: https://astrolas.com/tools/zodiacal-releasing`),
    la_so: tg(`la-so/hop/${c.ma}.svg`), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: { ten: pl.ten, mau: '#FF8FB1', ic: '♡' },
    cau: cau.map((q) => ({ ...q, tu: 0, den: 0 })), DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ ${c.ma}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · ${tap.cau.length} câu · ${tap.DAI}s · ZR ${tap.cau.filter((q) => /Zodiacal/.test(q.the?.duoi ?? '')).length} thẻ`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ma = arg('cap'); if (!ma) { console.error('dùng: --cap <a--b | all>'); process.exit(2); }
  const ds = doc('la-so/cap.json').cap.filter((x) => x.rel === 'romantic' && (ma === 'all' || x.ma === ma) && (ma !== 'all' || (x.moc?.length ?? 0) >= 3));
  const gh = layHook(docSo().astrolas.playlist.find((p) => p.ma === 'love-compatibility')?.goc_spy?.[0]?.id ?? 4314);
  let hong = 0; for (const c of ds) if (!vietMot(c, gh, arg('ra', join(SHOT, 'tap-astrolas', `ls-${c.ma}.json`)))) hong++;
  console.log(`${ds.length - hong}/${ds.length} cặp đạt`); process.exit(hong ? 1 : 0);
}
