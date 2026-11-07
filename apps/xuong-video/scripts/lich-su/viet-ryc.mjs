#!/usr/bin/env node
// MÁY VIẾT "READ YOUR CHART" (G5 kênh Astrolas, 06/11/2026): một mục trên lá số (AC · MC · một hành tinh) × một người hạng AA → một Short 9:16 cho shot-code/la-so.html (khuôn demo mau-read-your-chart.json).
// 0đ, không AI. Cảnh = ảnh TRANG LÁ SỐ THẬT, số liệu đọc từ trang (cong-cu/doc-natal.mjs) · câu giải nghĩa NGUYÊN VĂN blog site (rising-sign-explained, midheaven-vs-ascendant, moon-sign-explained,
// the-10-planets-in-astrology, la-so/y-nghia-nha.json cho đúng nhà) · hook = bộ chọn chung hook-kenh.mjs · bài đăng = mô tả Birth chart của site + link mở thẳng lá số + bài hướng dẫn.
//   node viet-ryc.mjs --muc asc|mc|sun|…|pluto|all --ai <slug>|all
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh } from './chu-man.mjs';
import { tenNgan } from './viet-cap.mjs';
import { docNatal, tepNatal, SAO } from './cong-cu/doc-natal.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { chonHook } from './hook-kenh.mjs';
import { KY, THU, nhanPlaylist } from './viet-chung.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const tg = (p) => relative(SHOT, join(DIR, p)), cauDau = (s, n = 1) => s.split(/(?<=[.!?])\s+/).slice(0, n).join(' '), bo = (s) => s.replace(/[.]$/, '');
const muc = (bai, re) => doc(`la-so/bai/${bai}.json`).muc.find((m) => re.test(m.ten));

/** định nghĩa NGUYÊN VĂN site của từng mục */
export function dinhNghia(ma) {
  if (ma === 'asc') return { ten: 'Ascendant', nhan: 'AC', hoi: "See the number next to AC? Here's what it means.", bai: 'rising-sign-explained', cau: [cauDau(muc('rising-sign-explained', /actually is/i).doan[0])] };
  if (ma === 'mc') return { ten: 'MC', nhan: 'MC', hoi: "See the number next to MC? Here's what it means.", bai: 'midheaven-vs-ascendant', cau: [cauDau(muc('midheaven-vs-ascendant', /^the midheaven$/i).doan[0], 3)] };
  const ten = ma[0].toUpperCase() + ma.slice(1), m = muc('the-10-planets-in-astrology', new RegExp(`\\b${ten}$`));
  return { ten, nhan: KY[ten], hoi: `See the ${ten} row? Here's how to read it.`, bai: ten === 'Moon' ? 'moon-sign-explained' : 'the-10-planets-in-astrology', cau: [...(ten === 'Moon' ? [cauDau(muc('moon-sign-explained', /what the moon sign is/i).doan[0])] : []), cauDau(m.doan[0])] };
}

function vietMot(n, ma, NGHIA) {
  const N = JSON.parse(readFileSync(tepNatal(n.slug), 'utf8')), D = doc(`la-so/${n.slug}.json`), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'start-here'), d = dinhNghia(ma), A = n.ten_ngan ?? tenNgan(n.ten), y = `ryc-${ma}-${n.slug}`;
  const laGoc = !SAO.includes(d.ten), o = laGoc ? N.goc[d.ten] : N.sao[d.ten];
  // cung: từ lá số site (la-so/<người>.json) — trang vẽ ký hiệu bằng phông riêng nên không đọc được chữ cung; độ phút trang phải khớp lá số, lệch thì bỏ
  const kd = laGoc ? D.nha.find((x) => x.so === (d.ten === 'MC' ? 10 : 1)).dinh : D.sao.find((s) => s.ten === d.ten).kinh_do, cung = CUNG[Math.floor(kd / 30) % 12], [dd, pp] = o.do.match(/\d+/g).map(Number);
  // ngưỡng theo độ chính xác của nguồn: sao có kinh độ đủ số lẻ → lệch > 1 phút cung là sai; đỉnh nhà trong la-so/<người>.json làm tròn 0,1° (6 phút) → lệch > 4 phút
  if (Math.abs(dd * 60 + pp - (kd % 30) * 60) > (laGoc ? 4 : 1)) { console.error(`✗ ${y}: trang ${o.do}, lá số ${(kd % 30).toFixed(2)}° — lệch, bỏ tập`); return false; }
  const { hook, chuHook, goc: gocHook } = chonHook('astrolas', 'start-here', y), man = tg(relative(DIR, tepNatal(n.slug)).replace(/\.json$/, '.png')), o2 = (khung) => ({ man, khung });
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: d.nhan, duoi: 'read your chart', dong: [], vi: 'giua' } },
    { nhin: { dung: 1 }, khung: true, chu: d.hoi },
    ...d.cau.map((c) => ({ nhin: o2(d.ten), chu: `“${bo(c)}.”`, nhan: `${A} · ${d.ten}` })),
    { nhin: { troi: 1 }, chu: `${o.do} means ${dd} degrees and ${pp} minutes into ${cung}.`, the: { lon: o.do, duoi: cung, dong: [`${dd} degrees · ${pp} minutes`], vi: 'giua' } },
    { nhin: { troi: 1 }, chu: '30 degrees per sign. 60 minutes per degree.', the: { lon: '30°', duoi: 'per sign', dong: ['1° = 60 minutes'], vi: 'giua' } },
    ...(!laGoc ? [{ nhin: o2(d.ten), chu: `The ${THU(o.nha)} house: “${bo(NGHIA[o.nha])}.”` }] : []),
    { nhin: o2(laGoc ? 'angles' : 'planets'), chu: laGoc ? 'Now you can read every angle.' : 'Now you can read every row.' },
    { nhin: { troi: 1 }, khung: true, chu: 'Read your own chart free at astrolas.com.' },
  ].map((q) => ({ ...q, tu: 0, den: 0 }));
  const tieuDe = `${chuHook} ${A}'s ${d.ten}: how to read it`;
  const tap = tachCanh({ _ghi: `Read Your Chart · ${d.ten} · ${A} — sinh bởi lich-su/viet-ryc.mjs (trang ${N.nguon.slice(0, 50)}…, bài ${d.bai}, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'read-your-chart', playlist_ma: 'start-here', y_tuong: y, tieu_de: tieuDe, goc: gocHook, hook: { qc: hook.id, goc: hook.chu }, nguon_bai: [d.bai],
    dang: dangCongCu('birth', n.slug, {}, `How to read the ${d.ten} in ${n.ten}'s birth chart. Guide: https://astrolas.com/en/blog/${d.bai}`),
    la_so: tg(`la-so/${n.slug}.svg`), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: nhanPlaylist(pl), cau, DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ ${y}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  const ra = join(SHOT, 'tap-astrolas', `${y}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const M = arg('muc'), ai = arg('ai'); if (!M || !ai) { console.error('dùng: --muc <asc|mc|sun|…|all> --ai <slug|all>'); process.exit(2); }
  const dsMuc = M === 'all' ? ['asc', 'mc', ...SAO.map((s) => s.toLowerCase())] : [M], S = doc('la-so/nguoi.json');
  const ng = S.nguoi.filter((x) => !x.khong_dung && S.rodden_dung_nha.includes(x.rodden) && (ai === 'all' || x.slug === ai) && existsSync(join(DIR, `la-so/${x.slug}.json`)));
  const loiDoc = await docNatal(ng.map((x) => x.slug)); for (const l of loiDoc) console.error(`✗ ${l}`);
  const NGHIA = doc('la-so/y-nghia-nha.json').nha; let hong = 0, n = 0;
  for (const x of ng) { if (!existsSync(tepNatal(x.slug))) { hong += dsMuc.length; n += dsMuc.length; continue; } for (const m of dsMuc) { n++; if (!vietMot(x, m, NGHIA)) hong++; } }
  console.log(`${n - hong}/${n} tập đạt (${ng.length} người × ${dsMuc.length} mục)`); process.exit(hong ? 1 : 0);
}
