#!/usr/bin/env node
// SINH TẬP "CHART CHAPTERS" BẢN DÀI 16:9 (kênh YouTube Astrolas, 04/11/2026): một người + các mốc đời → CAU cho shot-code/la-so.html khổ ngang.
// Máy tự tính tuổi, cung Profection (cung trọn từ cung Mọc của lá số site) và nhà kích hoạt của từng mốc; câu kể chỉ nêu số liệu tính được + chữ mốc người nhập.
// 0đ (không gọi AI). Tranh minh hoạ tuỳ chọn: tranh vẽ sẵn bằng lich-su/tranh-sinh.mts (~110₫/cảnh) đặt theo năm.
//   node sinh-chuong.mjs --slug steve-jobs --moc moc.json [--ra tap.json]
//   moc.json = { ten: "Steve Jobs", sinh: "February 24, 1955, 7:15 PM, San Francisco", den: 2011,
//                moc: [{ nam: 1976, ngay?: "1976-04-01" (nên có: tuổi tính đúng theo ngày sinh), nhan: "Apple", chu: "In a garage in Los Altos, he and Steve Wozniak build their first computer.", tranh?: "<đường ảnh>", noi?: "Los Altos, California" }] }
//   Lá số: lich-su/la-so/<slug>.svg + .json (la-so/lay.mjs lấy từ astrolas.com/c/<slug>; chưa có thì chạy lệnh đó trước).
//   Quay:  node shot-code/dung.mjs --trang shot-code/la-so.html --cau <tap.json> --ra <ra.mp4> --rong 1920 --cao 1080
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../../shot-code'), LA_SO = join(DIR, '../la-so');
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const slug = arg('slug'), tepMoc = arg('moc');
if (!slug || !tepMoc) { console.error('dùng: --slug <người> --moc <moc.json>'); process.exit(2); }
if (!existsSync(join(LA_SO, `${slug}.json`))) { console.error(`✗ chưa có lá số ${slug}: chạy node lich-su/la-so/lay.mjs ${slug}`); process.exit(3); }
const D = JSON.parse(readFileSync(join(LA_SO, `${slug}.json`), 'utf8')), M = JSON.parse(readFileSync(tepMoc, 'utf8'));
const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// NGHĨA NHÀ: nguyên văn của astrolas.com (la-so/y-nghia-nha.json, hệ cổ điển) — 3 ý đầu của câu site; không tự đặt nghĩa nhà (04/11/2026 bản tự đặt
// "6th house: work and health" lệch site "Illness, injuries, hardship…")
const NHA_SITE = JSON.parse(readFileSync(join(LA_SO, 'y-nghia-nha.json'), 'utf8')).nha;
const NHA = Array.from({ length: 12 }, (_, i) => { const y = NHA_SITE[String(i + 1)].replace(/\.$/, '').split(/,\s*(?![^()]*\))/).slice(0, 3).join(', '); return y[0].toLowerCase() + y.slice(1); });
const THU = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const moc = Math.floor((D.nha.find((x) => x.so === 1)?.dinh ?? NaN) / 30); if (Number.isNaN(moc)) { console.error('✗ lá số thiếu đỉnh nhà 1'); process.exit(3); }
const namSinh = Number(D.nguoi.year), den = Number(M.den ?? namSinh + 80);
// TUỔI tại mốc tính theo ngày sinh trong lá số (day / month) và ngày của mốc — năm trừ năm sai một tuổi với người sinh cuối năm (Taylor Swift 13/12:
// album đầu 24/10/2006 là 16 tuổi, không phải 17). Mốc chỉ có năm → lấy 01/07 và cảnh báo.
const tuoiTai = (m) => { if (m.tuoi != null) return m.tuoi; if (!m.ngay) console.warn(`⚠ mốc ${m.nam} thiếu ngay → tạm lấy 01/07/${m.nam}, tuổi có thể lệch 1`);
  const [y, mo, d] = (m.ngay || `${m.nam}-07-01`).split('-').map(Number), bm = Number(D.nguoi.month), bd = Number(D.nguoi.day);
  return y - namSinh - (mo < bm || (mo === bm && d < bd) ? 1 : 0); };
const doi = (dang) => ({ doi: { tu: namSinh, den, dang, moc: M.moc.map((m) => ({ nam: m.nam, chu: m.nhan })) } });
const ra = arg('ra', join(SHOT, `dai-chuong-${slug}.json`)), tg = (p) => relative(dirname(ra), p);
const cau = [];
const them = (dai, nhin, chu, nhan) => { const tu = cau.length ? cau.at(-1).den : 0; cau.push({ tu: +tu.toFixed(2), den: +(tu + dai).toFixed(2), nhin, chu, ...(nhan ? { nhan } : {}) }); };
them(5.0, { dung: 1 }, `This is the sky at the moment ${M.ten} was born: ${M.sinh}.`);
them(5.4, doi(namSinh), 'Astrologers kept an old clock for a life. Each birthday, the year moves one sign around the chart.', 'Annual Profections');
let truocCung = null;
for (const m of M.moc) {
  const tuoi = tuoiTai(m), c = (moc + tuoi) % 12, nha = (tuoi % 12) + 1, lap = truocCung === c;
  if (m.tranh) them(4.8, { tranh: tg(join(dirname(tepMoc), m.tranh)), kieu: ['day', 'trai', 'lui', 'phai'][cau.length % 4] }, `${m.nam}. ${m.chu}`, `${m.nam}${m.noi ? ` · ${m.noi}` : ''}`);
  them(5.2, doi(m.nam), `${m.nam}, age ${tuoi}: ${lap ? `${CUNG[c]} again` : `${/^[AEIOU]/.test(CUNG[c]) ? 'an' : 'a'} ${CUNG[c]} year`}. Counted from ${CUNG[moc]} rising, that's the ${THU(nha)} house: ${NHA[nha - 1]}.`);
  if (!m.tranh) them(4.4, doi(m.nam), m.chu, m.nhan);
  truocCung = c;
}
them(4.4, { toan: 1 }, 'Find your own chapters free at astrolas.com.', 'astrolas.com · Annual Profections');
const CAU = { _ghi: `Chart Chapters dài · ${M.ten} — sinh bởi lich-su/dai/sinh-chuong.mjs từ ${tepMoc}`, kenh: 'astrolas', mau: 'chart-chapters-dai', playlist_ma: 'chart-chapters', y_tuong: `ccd-${slug}`, khung: 'ngang', DAI: cau.at(-1).den,
  la_so: tg(join(LA_SO, `${slug}.svg`)), nen: tg(join(DIR, '../brand/astrolas/anh/troi.jpg')), logo: tg(join(DIR, '../brand/astrolas/logo/wordmark.png')),
  playlist: { ten: 'Chart Chapters', mau: '#E6B800', ic: '☉' }, cau };
// máy gác sổ kênh (lich-su/so-kenh.json): sai mẫu / playlist / ý tưởng / câu kết thì không ghi
const { docSo, kiemTap } = await import(join(DIR, '../kiem-so-kenh.mjs')), loiSo = kiemTap(CAU, docSo().astrolas, 'astrolas');
if (loiSo.length) { console.error(`✗ tập trái sổ kênh:\n${loiSo.map((l) => `   · ${l}`).join('\n')}`); process.exit(3); }
writeFileSync(ra, JSON.stringify(CAU, null, 1) + '\n');
console.log(`✓ ${ra} · ${M.ten} · ${M.moc.length} mốc · ${CAU.DAI}s`);
for (const c of cau) console.log(`   ${String(c.tu).padStart(6)}s  ${Object.keys(c.nhin)[0].padEnd(5)}  ${c.chu}`);
