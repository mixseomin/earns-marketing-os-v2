#!/usr/bin/env node
// MÁY VIẾT "CHART CHAPTERS" SHORT (G5 kênh Astrolas, 06/11/2026): một người hạng AA → một Short 9:16 cho shot-code/la-so.html (khuôn demo la-so-mau.json).
// 0đ, không AI. Mốc đời = sổ mốc có nguồn (dai/moc-<người>.json · la-so/cap.json, Wikipedia — chung viet-ask.mjs › mocCua), ảnh mốc = ảnh thật Wikipedia của trang
// của chính người đó (anh-wiki.mjs, công cộng / CC, CC BY ghi tác giả trong bài đăng; mốc có tranh vẽ sẵn thì dùng tranh) · lời lá số = câu diễn giải NGUYÊN VĂN trong bài
// "<người>-birth-chart" của blog site (la-so/bai/), camera vào đúng sao mục đó nói, tên mục của site làm nhãn · hook = dòng đầu QC spy góc Hiểu bản thân.
//   node viet-chuong.mjs --ai angelina-jolie | all  [--goc-hook gh.json] [--xem]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh, hookGon, hookNgan } from './chu-man.mjs';
import { tenNgan } from './viet-cap.mjs';
import { mocCua } from './viet-ask.mjs';
import { layAnhWiki, ghiTacGia } from './anh-wiki.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ngayChu = (d) => { const [y, m, n] = d.split('-').map(Number); return n ? `${THANG[m - 1]} ${n}, ${y}` : `${THANG[m - 1]} ${y}`; };
const SAO = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'], tg = (p) => relative(SHOT, join(DIR, p));
const ANH = join(DIR, 'la-so/anh-nguoi.json');

function layHook(goc) {
  const f = arg('goc-hook'); if (f) return JSON.parse(readFileSync(f, 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 240s ../../node_modules/.bin/tsx scripts/may-dung.mts --may astrolas --goc-hook --goc ${goc}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"goc"'));
  if (!dong) { console.error(`✗ không lấy được hook spy góc ${goc}`); process.exit(3); }
  return JSON.parse(dong);
}

/** mục lá số của bài site: tên mục (dữ liệu) + câu DIỄN GIẢI đầu tiên ("The library reads…") + sao đầu tiên tên mục nhắc. Bỏ mục tổng kết / hỏi đáp. Thuần. */
export function mucLaSo(bai) {
  return bai.muc.filter((m) => !/adds up|questions people ask|what the chart/i.test(m.ten)).map((m) => {
    const cau = m.doan.join(' ').split(/(?<=[.!?])\s+/), giai = cau.find((c) => /\blibrary\b|\breads\b/i.test(c) && c.length <= 260 && !/:\W*$/.test(c));   // câu dừng ở ":" là câu dẫn tới trích dẫn kế — đứng một mình thành cụt
    return { ten: m.ten, giai, sao: SAO.find((s) => new RegExp(`\\b${s}\\b`).test(m.ten)) };
  }).filter((m) => m.giai);
}

function vietMot(n, gh, anhKho) {
  const bai = doc(`la-so/bai/${n.slug}-birth-chart.json`), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'know-yourself'), D = doc(`la-so/${n.slug}.json`);
  const A = n.ten_ngan ?? tenNgan(n.ten), muc = mucLaSo(bai).filter((m) => !m.sao || D.sao.some((s) => s.ten === m.sao)).slice(0, 2), moc = mocCua(n);
  if (muc.length < 2 || moc.length < 2) { console.error(`✗ cc-${n.slug}: cần 2 mục lá số có câu diễn giải + 2 mốc (có ${muc.length} / ${moc.length})`); return false; }
  const ds = moc.length > 2 ? [moc[0], moc[Math.floor(moc.length / 2)], moc.at(-1)] : moc, anh = anhKho[`cc-${n.slug}`] ?? [];
  const hs = hookGon(gh.hooks.filter((h) => !/\d/.test(h.chu) && !/retrograde/i.test(h.chu))), hook = hs[[...n.slug].reduce((s, c) => s + c.charCodeAt(0), 0) % hs.length] ?? gh.hooks[0], chuHook = hookNgan(hook.chu);
  const canhMoc = (m, i) => { const t = m.tranh ? join('dai', m.tranh) : anh[i % Math.max(1, anh.length)]?.tep, nhan = `${m.ngay.slice(0, 4)}${m.noi ? ` · ${m.noi}` : ''}`;
    return t && existsSync(join(DIR, t)) ? { nhin: { tranh: tg(t), kieu: ['day', 'trai', 'lui'][i % 3] }, chu: `${m.ngay.slice(0, 4)}. ${m.chu}`, nhan } : { nhin: { troi: 1 }, chu: m.chu, the: { lon: m.ngay.slice(0, 4), duoi: ngayChu(m.ngay), dong: [], vi: 'giua' } }; };
  const canhLaSo = (x) => ({ nhin: x.sao ? { sao: x.sao } : { toan: 1 }, chu: `“${x.giai.replace(/[.]$/, '')}.”`, nhan: x.ten });
  const s = n.sinh, cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: A.split(' ')[0], duoi: 'a life in chapters', dong: [], vi: 'giua' } },
    { nhin: { dung: 1 }, chu: `${A}, born ${THANG[s.thang - 1]} ${s.ngay}, ${s.nam}.` },
    canhMoc(ds[0], 0), canhLaSo(muc[0]), canhMoc(ds[1], 1), canhLaSo(muc[1]), ...(ds[2] ? [canhMoc(ds[2], 2)] : []),
    { nhin: { toan: 1 }, khung: true, chu: 'Every life moves in chapters. Find yours free at astrolas.com.' },
  ].map((q) => ({ ...q, tu: 0, den: 0 }));
  const tieuDe = `${chuHook} ${A}: a life in chapters`, tac = ghiTacGia(anh);
  const tap = tachCanh({ _ghi: `Chart Chapters · ${A} — sinh bởi lich-su/viet-chuong.mjs (bài site ${bai.url}, mốc ${[...new Set(ds.map((m) => m.nguon_moc))].join(' + ')}, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'chart-chapters', playlist_ma: 'know-yourself', y_tuong: `cc-${n.slug}`, tieu_de: tieuDe, goc: gh.goc, hook: { qc: hook.id, goc: hook.chu },
    nguon_moc: [...new Set(ds.map((m) => m.nguon_moc))], nguon_bai: [`${n.slug}-birth-chart`],
    dang: dangCongCu('birth', n.slug, {}, `${n.ten}'s life in chapters, with the birth chart. Full reading: ${bai.url}${tac.length ? `\nImages: ${tac.join('; ')}` : ''}`),
    la_so: tg(`la-so/${n.slug}.svg`), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: { ten: pl.ten, mau: '#8EC5FF', ic: '☉' }, cau, DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ cc-${n.slug}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  const ra = join(SHOT, 'tap-astrolas', `cc-${n.slug}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · ${tap.cau.length} câu · ${tap.DAI}s · ${muc.map((m) => m.sao ?? '—').join(' + ')} · ${anh.length} ảnh`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ai = arg('ai'); if (!ai) { console.error('dùng: --ai <slug | all>'); process.exit(2); }
  const S = doc('la-so/nguoi.json'), ng = S.nguoi.filter((x) => !x.khong_dung && S.rodden_dung_nha.includes(x.rodden) && (ai === 'all' || x.slug === ai)
    && existsSync(join(DIR, `la-so/${x.slug}.json`)) && existsSync(join(DIR, `la-so/bai/${x.slug}-birth-chart.json`)));
  if (process.argv.includes('--xem')) { for (const n of ng) console.log(`${n.slug.padEnd(18)} ${mocCua(n).length} mốc · ${mucLaSo(doc(`la-so/bai/${n.slug}-birth-chart.json`)).map((m) => m.sao ?? m.ten.slice(0, 20)).join(', ')}`); process.exit(0); }
  // ảnh thật của trang nguồn mốc (một lần mỗi người, nhớ ở la-so/anh-nguoi.json)
  const kho = existsSync(ANH) ? JSON.parse(readFileSync(ANH, 'utf8')) : {};
  // ảnh CHÍNH NGƯỜI ĐÓ: trang Wikipedia của người (tên sổ người, theo chuyển hướng) — trang nguồn mốc đôi là trang người kia (tập Jolie ra ảnh Brad Pitt, 06/11/2026)
  for (const n of ng) if (!kho[`cc-${n.slug}`]) { kho[`cc-${n.slug}`] = await layAnhWiki([n.wiki ?? n.ten], { ma: `cc-${n.slug}`, toiDa: 3 }); writeFileSync(ANH, JSON.stringify(kho, null, 1) + '\n'); }
  const gh = layHook(docSo().astrolas.playlist.find((p) => p.ma === 'know-yourself')?.goc_spy?.[0]?.id ?? 4313);
  let hong = 0; for (const n of ng) if (!vietMot(n, gh, kho)) hong++;
  console.log(`${ng.length - hong}/${ng.length} người đạt`); process.exit(hong ? 1 : 0);
}
