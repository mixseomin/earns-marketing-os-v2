#!/usr/bin/env node
// MÁY VIẾT "CHART VS CHART" (G5 kênh Astrolas, 05/11/2026): một cặp trong sổ cặp (la-so/cap.json) → một Short 9:16 cho shot-code/la-so.html (bánh xe đôi).
// 0đ, không AI. Mọi chữ có nguồn:
//   góc chiếu chéo + tiêu đề lời giải NGUYÊN VĂN công cụ Synastry của site (la-so/hop/<cặp>.json — hop.mjs): chỉ góc dùng được theo hạng giờ sinh, có sao cá nhân,
//     không phải góc thế hệ, góc chính trước góc phụ, khít nhất trước; bỏ tiêu đề site bị dính tên người ở đầu câu ("Brad Pitt smooth flow of…" — lỗi trang site)
//   điểm từng trục của site (cảnh diem) · mốc đầu / mốc cuối của sổ cặp (Wikipedia) · hook = dòng đầu QC spy góc của playlist
//   romantic → playlist Love & Compatibility · partner → Career & Big Decisions. Bài đăng = mô tả Synastry của site + link mở thẳng hai lá số.
//   node viet-cap.mjs --cap brad-pitt--angelina-jolie [--goc-hook gh.json] [--ra <tệp>]   · --cap all = đủ sổ cặp
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh } from './chu-man.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook, sachHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { hookGon, hookNgan } from './chu-man.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const CA_NHAN = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Ascendant', 'MC']), CHINH = ['Conjunction', 'Opposition', 'Square', 'Trine', 'Sextile'];
/** tên gọi ngắn trên màn: bỏ tước hiệu + phần sau dấu phẩy / ngoặc ("King Charles III" → "Charles", "Diana, Princess of Wales" → "Diana", "Kanye West (Ye)" → "Kanye West") */
export const tenNgan = (t) => t.split(/[,(]/)[0].trim().replace(/^(King|Queen|Prince|Princess|Sir|Dame)\s+/i, '').replace(/\s+(I{1,3}|IV|V|VI{0,3})$/, '').trim();
const KYS = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Ascendant: 'AC', MC: 'MC' };
const phut = (l) => { const m = /(\d+)°\s*(\d+)?/.exec(l ?? ''); return m ? +m[1] * 60 + +(m[2] ?? 0) : 1e9; };
const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ngayChu = (d) => { const [y, m, n] = d.split('-').map(Number); return n ? `${THANG[m - 1]} ${n}, ${y}` : m ? `${THANG[m - 1]} ${y}` : String(y); };

function layHook(goc) {
  const f = arg('goc-hook'); if (f) return JSON.parse(readFileSync(f, 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 240s ../../node_modules/.bin/tsx scripts/may-dung.mts --may astrolas --goc-hook --goc ${goc}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"goc"'));
  if (!dong) { console.error(`✗ không lấy được hook spy góc ${goc}`); process.exit(3); }
  return JSON.parse(dong);
}

/** góc chiếu đáng kể: dùng được, có sao cá nhân, không thế hệ, tiêu đề site sạch — góc chính trước, khít trước. Thuần. */
export function chonGoc(h) {
  const sach = (g) => g.dung && !g.the_he && (CA_NHAN.has(g.a) || CA_NHAN.has(g.b)) && g.tieu_de && ![h.a.ten, h.b.ten].some((t) => g.tieu_de.startsWith(t));
  return h.giai.filter(sach).sort((x, y) => Number(!CHINH.includes(x.goc)) - Number(!CHINH.includes(y.goc)) || phut(x.lech) - phut(y.lech));
}

function vietMot(c, ghTheo, ra) {
  const h = doc(`la-so/hop/${c.ma}.json`), so = docSo().astrolas, plMa = c.rel === 'partner' ? 'career' : 'love-compatibility', pl = so.playlist.find((p) => p.ma === plMa);
  const gh = ghTheo(pl.goc_spy?.[0]?.id ?? 4314), gocs = chonGoc(h).slice(0, 2), NG = doc('la-so/nguoi.json').nguoi, ngan = (x) => NG.find((n) => n.slug === x.slug)?.ten_ngan ?? tenNgan(x.ten), A = ngan(h.a), B = ngan(h.b);   // sổ người › ten_ngan (JFK, Jackie…) thắng
  if (gocs.length < 2) { console.error(`✗ ${c.ma}: chưa đủ 2 góc chiếu dùng được (${gocs.length})`); return false; }
  const moc = [...(c.moc ?? [])].sort((x, y) => x.ngay.localeCompare(y.ngay)), dau = moc[0], cuoi = moc.at(-1);
  const hs = hookGon(gh.hooks.filter((x) => !/\d/.test(x.chu) && !/retrograde/i.test(x.chu))), hook = hs[[...c.ma].reduce((s, ch) => s + ch.charCodeAt(0), 0) % hs.length] ?? gh.hooks[0];
  const chuHook = hookNgan(hook.chu);
  const goc = (g) => ({ nhin: { cheo: [`person-a:${g.a}`, `person-b:${g.b}`] }, nhan: `${KYS[g.a] ?? ''} ${A}'s ${g.a} · ${g.goc.toLowerCase()} · ${KYS[g.b] ?? ''} ${B}'s ${g.b} · ${g.lech}`,
    chu: `${A}'s ${g.a}, ${g.goc.toLowerCase()}, ${B}'s ${g.b}:<br>“${g.tieu_de.replace(/[.]$/, '')}.”` });
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: `${A.split(' ')[0]} × ${B.split(' ')[0]}`, duoi: 'two charts, one wheel', dong: [], vi: 'giua' } },
    ...(dau ? [{ nhin: { troi: 1 }, chu: dau.chu, the: { lon: dau.ngay.slice(0, 4), duoi: ngayChu(dau.ngay), dong: [], vi: 'giua' } }] : []),
    { nhin: { toan: 1 }, chu: 'Both birth charts,<br>one wheel.', nhan: `${A} · ${B}` },
    goc(gocs[0]), goc(gocs[1]),
    { nhin: { diem: 1 }, chu: `${h.diem.map((d) => `${d.ten} ${d.diem}`).slice(0, 2).join('. ')}.` },
    ...(cuoi && cuoi !== dau ? [{ nhin: { troi: 1 }, chu: cuoi.chu, the: { lon: cuoi.ngay.slice(0, 4), duoi: ngayChu(cuoi.ngay), dong: [], vi: 'giua' } }] : []),
    { nhin: { troi: 1 }, khung: true, chu: 'Compare any two charts<br>free at astrolas.com.' },
  ].map((x, i) => ({ ...x, tu: +(i * 4.4).toFixed(2), den: +((i + 1) * 4.4).toFixed(2) }));
  const tieuDe = `${chuHook} ${A} and ${B}: their charts compared`, tg = (p) => relative(SHOT, p);
  const tap = tachCanh({   // mỗi khung một ý ngắn (chu-man.mjs)
    _ghi: `Chart vs Chart · ${A} × ${B} — sinh bởi lich-su/viet-cap.mjs (synastry site ${h.nguon.slice(0, 60)}…, mốc la-so/cap.json, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'chart-vs-chart', playlist_ma: plMa, y_tuong: `cvc-${c.ma}`, tieu_de: tieuDe, goc: gh.goc, hook: { qc: hook.id, goc: hook.chu },
    dang: dangCongCu('synastry-chart', [c.a, c.b], { rel_type: c.rel }, `${h.a.ten} and ${h.b.ten}: both birth charts compared with the Synastry tool.`),
    la_so: tg(join(DIR, `la-so/hop/${c.ma}.svg`)), nen: tg(join(DIR, pl.nen))   /* nền theo playlist (so-kenh › playlist.nen) */, logo: tg(join(DIR, 'brand/astrolas/logo/wordmark.png')),
    playlist: { ten: pl.ten, mau: plMa === 'career' ? '#E6B800' : '#FF8FB1', ic: plMa === 'career' ? '♄' : '♡' }, DAI: cau.at(-1).den, cau });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ ${c.ma}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · ${gocs.map((g) => `${g.a} ${g.goc} ${g.b} ${g.lech}`).join(' + ')}`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ma = arg('cap'); if (!ma) { console.error('dùng: --cap <a--b | all>'); process.exit(2); }
  const ds = doc('la-so/cap.json').cap.filter((x) => ma === 'all' || x.ma === ma); if (!ds.length) { console.error(`không có cặp ${ma}`); process.exit(2); }
  const nho = new Map(), ghTheo = (g) => { if (!nho.has(g)) nho.set(g, layHook(g)); return nho.get(g); };
  let hong = 0; for (const c of ds) if (!vietMot(c, ghTheo, arg('ra', join(SHOT, 'tap-astrolas', `cvc-${c.ma}.json`)))) hong++;
  console.log(`${ds.length - hong}/${ds.length} cặp đạt`); process.exit(hong ? 1 : 0);
}
