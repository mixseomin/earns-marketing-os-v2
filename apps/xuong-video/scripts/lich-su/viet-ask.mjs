#!/usr/bin/env node
// MÁY VIẾT "ASK THE CHART" (G5 kênh Astrolas, 05/11/2026): một người hạng AA + một mốc đời có nguồn → một Short 9:16 cho shot-code/la-so.html,
// cảnh là ẢNH TRANG CÔNG CỤ THẬT Annual Profections của năm đó (cong-cu/doc-ap.mjs đọc + chụp, 0đ, iMac). Đúng khuôn demo đã duyệt (mau-ask-the-chart.json).
// Số liệu (tuổi · nhà của năm · cung · chủ năm · nhà của chủ năm) và chữ diễn giải (nghĩa nhà, Theme của chủ năm) đều là chữ TRANG CÔNG CỤ cho đúng người /
// năm đó; câu cơ chế là câu nguyên văn bài annual-profections-explained; mốc đời từ sổ mốc (dai/moc-<người>.json · la-so/cap.json, Wikipedia).
// Mốc của sổ cặp → playlist Love & Compatibility (hook QC spy góc Tình yêu), mốc đời riêng → Career & Big Decisions (hook góc Sự nghiệp).
// Tuổi trang báo phải bằng tuổi tính từ ngày sinh sổ người, không thì bỏ mốc. Mốc chỉ có năm (không tháng) bỏ: không biết rơi vào năm Profection nào.
//   node viet-ask.mjs --ai steve-jobs | all  [--nam 1985] [--kho-hook kho.json] [--hook-moi] [--xem]   · --xem = chỉ liệt kê mốc dùng được
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh } from './chu-man.mjs';
import { tenNgan } from './viet-cap.mjs';
import { docAp, tepAp } from './cong-cu/doc-ap.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { chonHook } from './hook-kenh.mjs';
import { THANG, THU, ngayChu, nhanPlaylist } from './viet-chung.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const tg = (p) => relative(SHOT, join(DIR, p));

/** mốc dùng được của một người: sổ mốc đời riêng (dai/moc-<slug>.json) + mốc các cặp có người đó (la-so/cap.json), bỏ trùng chữ, cần có tháng.
 *  Mỗi mốc → năm Profection chứa nó (năm của sinh nhật gần nhất trước mốc) + tuổi tính từ ngày sinh sổ người. Thuần. */
export function mocCua(n) {
  const ds = [], co = new Set(), sn = [n.sinh.thang, n.sinh.ngay];
  // mốc qua đời không làm Ask the Chart: câu kết là lời mời "hỏi lá số của bạn" ngay sau tin mất — lệch giọng
  const them = (m, nguon, pl, cap) => { if (!m.ngay || m.ngay.length < 7 || co.has(m.chu) || /\b(dies|died|death)\b/i.test(m.chu)) return; co.add(m.chu);
    const [y, mo, d = 15] = m.ngay.split('-').map(Number), truoc = mo < sn[0] || (mo === sn[0] && d < sn[1]), nam = truoc ? y - 1 : y;
    // ngày sinh nhật đúng tháng mốc chỉ có tháng → không biết trước hay sau sinh nhật: bỏ
    if (m.ngay.length === 7 && mo === sn[0]) return;
    ds.push({ ...m, nguon_moc: nguon, playlist: pl, cap, nam, tuoi: nam - n.sinh.nam }); };
  if (existsSync(join(DIR, `dai/moc-${n.slug}.json`))) for (const m of doc(`dai/moc-${n.slug}.json`).moc) them(m, `dai/moc-${n.slug}.json`, 'career');
  for (const c of doc('la-so/cap.json').cap.filter((x) => x.a === n.slug || x.b === n.slug)) for (const m of c.moc ?? []) them(m, `la-so/hop/${c.ma}.json`, c.rel === 'partner' ? 'career' : 'love-compatibility', c.ma);
  return ds.sort((a, b) => a.ngay.localeCompare(b.ngay));
}

/** một tập = một người × một NĂM Profection; các mốc cùng năm (William 2010: cầu hôn · đính hôn · cưới) kể nối nhau trong cùng tập, không đẻ 3 tập gần y nhau */
function vietMot(n, ms) {
  const m = ms[0], ap = JSON.parse(readFileSync(tepAp(n.slug, m.nam), 'utf8')), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === m.playlist);
  if (ap.tuoi !== m.tuoi) { console.error(`✗ ${n.slug} ${m.nam}: trang báo tuổi ${ap.tuoi}, sổ người tính ${m.tuoi} — bỏ năm`); return false; }
  const A = n.ten_ngan ?? tenNgan(n.ten), ma = `ask-${n.slug}-${m.nam}`;
  const { hook, chuHook, goc: gocHook } = chonHook('astrolas', m.playlist, ma);
  const man = tg(relative(DIR, tepAp(n.slug, m.nam)).replace(/\.json$/, '.png')), o = (khung) => ({ man, ...(khung ? { khung } : {}) });
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: '?', duoi: `${A} · ${m.nam}`, dong: [], vi: 'giua' } },
    { nhin: o(), chu: 'Open Annual Profections. Enter a birth date.', nhan: 'astrolas.com · Annual Profections' },
    { nhin: o('tuoi'), chu: `${A}, ${m.nam}: age ${ap.tuoi}.` },
    { nhin: o('banh'), chu: '“Each year of your life activates one house of your chart.”' },
    { nhin: o('nha'), chu: `The ${THU(ap.nha)} house: “${ap.nghia_nha.replace(/[.]$/, '')}.”` },
    { nhin: o('chu-nam'), chu: `Lord of the year: ${ap.chu_nam}, in the ${THU(ap.nha_chu)} house.` },
    { nhin: o('chu-de'), chu: `“${ap.chu_de.replace(/[.]$/, '')}.”` },
    ...ms.map((m) => (m.tranh ? { nhin: { tranh: tg(join('dai', m.tranh)), kieu: 'trai' }, chu: `${m.ngay.slice(0, 4)}: ${m.chu}`, nhan: `${m.ngay.slice(0, 4)}${m.noi ? ` · ${m.noi}` : ''}` }
      : { nhin: { troi: 1 }, chu: m.chu, the: { lon: m.ngay.slice(0, 4), duoi: ngayChu(m.ngay), dong: [], vi: 'giua' } })),
    { nhin: { troi: 1 }, khung: true, chu: 'See your own year free at astrolas.com.' },
  ];
  const tieuDe = `${chuHook} ${A}'s year in Annual Profections`;   // không số trong tiêu đề: luật hook cấm thêm con số không có trong QC gốc
  const tap = tachCanh({ _ghi: `Ask the Chart · ${A} ${m.nam} — sinh bởi lich-su/viet-ask.mjs (trang ${ap.nguon.slice(0, 50)}…, ${ms.length} mốc ${[...new Set(ms.map((x) => x.nguon_moc))].join(' + ')}, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'ask-the-chart', playlist_ma: m.playlist, y_tuong: ma, tieu_de: tieuDe, goc: gocHook, hook: { qc: hook.id, goc: hook.chu },
    nguon_moc: [...new Set(ms.map((x) => x.nguon_moc))], nguon_cong_cu: [relative(DIR, tepAp(n.slug, m.nam))],
    dang: dangCongCu('annual-profections', n.slug, { year_target: m.nam }, `${n.ten}, ${m.nam}: what Annual Profections shows for age ${ap.tuoi}.`),
    la_so: tg(`la-so/${n.slug}.svg`), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'),
    playlist: nhanPlaylist(pl), cau: cau.map((q) => ({ ...q, tu: 0, den: 0 })), DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ ${ma}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  const ra = join(SHOT, 'tap-astrolas', `${ma}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · ${ms.length} mốc · tuổi ${ap.tuoi} · nhà ${ap.nha} ${ap.cung} · ${ap.chu_nam} H${ap.nha_chu} · ${tap.DAI}s`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ai = arg('ai'); if (!ai) { console.error('dùng: --ai <slug | all> [--xem]'); process.exit(2); }
  const S = doc('la-so/nguoi.json'), ng = S.nguoi.filter((x) => !x.khong_dung && S.rodden_dung_nha.includes(x.rodden) && (ai === 'all' || x.slug === ai) && existsSync(join(DIR, `la-so/${x.slug}.svg`)));
  if (!ng.length) { console.error(`không có người hạng ${S.rodden_dung_nha.join('/')} có lá số: ${ai}`); process.exit(2); }
  const viec = ng.flatMap((n) => mocCua(n).filter((m) => !arg('nam') || m.nam === Number(arg('nam'))).map((m) => ({ n, m })));   // --nam: đúng một năm (chay-so-kenh.mjs) — tập năm khác của người đó hỏng không kéo tập này
  if (process.argv.includes('--xem')) { for (const { n, m } of viec) console.log(`${n.slug.padEnd(18)} ${m.ngay.padEnd(10)} năm ${m.nam} tuổi ${String(m.tuoi).padStart(2)} · ${m.playlist.padEnd(18)} ${m.chu.slice(0, 60)}`); console.log(`${viec.length} mốc`); process.exit(0); }
  const loiDoc = await docAp([...new Map(viec.map(({ n, m }) => [`${n.slug}-${m.nam}`, { slug: n.slug, nam: m.nam }])).values()]);
  for (const l of loiDoc) console.error(`✗ ${l}`);
  const nam = [...Map.groupBy(viec, ({ n, m }) => `${n.slug}-${m.nam}`).values()].map((g) => ({ n: g[0].n, ms: g.map((x) => x.m) }));
  let hong = 0; for (const { n, ms } of nam) if (!existsSync(tepAp(n.slug, ms[0].nam)) || !vietMot(n, ms)) hong++;
  console.log(`${nam.length - hong}/${nam.length} tập (người × năm) đạt · ${viec.length} mốc`); process.exit(hong ? 1 : 0);
}
