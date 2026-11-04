#!/usr/bin/env node
// SINH TẬP "TONIGHT'S SKY" (mẫu dài 16:9, kênh YouTube Astrolas, 04/11/2026): thành phố + ngày → CAU cho shot-code/bau-troi-dem.html, kèm chú thích TỰ TÍNH
// (Trăng / hành tinh mọc, lặn; trời tối hẳn). Một lệnh một tập, chạy hàng loạt theo lịch được (mỗi đêm × mỗi thành phố). 0đ: không gọi AI.
//   node sinh-dem.mjs --noi london --ngay 2026-11-20 [--tu 18 --den 24] [--dai 120] [--huong 180] [--ra tap.json]
//     --tu / --den: giờ địa phương (den > 24 = qua nửa đêm) · --dai: số giây phim (toc tự suy) · --huong: phương vị giữa khung (180 = nhìn hướng nam)
//   Quay:  node shot-code/dung.mjs --trang shot-code/bau-troi-dem.html --cau <tap.json> --ra <ra.mp4> --rong 1920 --cao 1080
import { writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../../shot-code');
await import(join(SHOT, 'bau-troi-tinh.js')); const B = globalThis.BauTroi;
const NOI = {   // thành phố: vĩ độ, kinh độ, múi giờ IANA (lệch giờ lấy theo đúng đêm đó, có giờ mùa hè)
  london: ['London', 51.5074, -0.1278, 'Europe/London'], 'new-york': ['New York', 40.7128, -74.006, 'America/New_York'],
  'los-angeles': ['Los Angeles', 34.0522, -118.2437, 'America/Los_Angeles'], sydney: ['Sydney', -33.8688, 151.2093, 'Australia/Sydney'],
  tokyo: ['Tokyo', 35.6762, 139.6503, 'Asia/Tokyo'], paris: ['Paris', 48.8566, 2.3522, 'Europe/Paris'], madrid: ['Madrid', 40.4168, -3.7038, 'Europe/Madrid'],
  'mexico-city': ['Mexico City', 19.4326, -99.1332, 'America/Mexico_City'], toronto: ['Toronto', 43.6532, -79.3832, 'America/Toronto'],
};
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const ma = arg('noi'), ngay = arg('ngay');
if (!NOI[ma] || !/^\d{4}-\d{2}-\d{2}$/.test(ngay || '')) { console.error(`dùng: --noi <${Object.keys(NOI).join('|')}> --ngay YYYY-MM-DD`); process.exit(2); }
const [ten, vi, kinh, tz] = NOI[ma], tu = Number(arg('tu', 18)), den = Number(arg('den', 24)), dai = Number(arg('dai', 120)), huong = Number(arg('huong', 180));
const lech = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ms) / 3600e3; };
const [y, m, d] = ngay.split('-').map(Number), goc = Date.UTC(y, m - 1, d, 12), lg = Math.round(lech(goc) * 4) / 4;
const bd = Date.UTC(y, m - 1, d, tu) - lg * 3600e3, kt = Date.UTC(y, m - 1, d, den) - lg * 3600e3, toc = (kt - bd) / 1000 / dai;

// sự kiện trong đêm: dò mỗi 2 phút trời, độ cao đổi dấu → mọc / lặn; Mặt Trời qua −18° → trời tối hẳn
const R = Math.PI / 180, SU = [['Moon', 'The Moon'], ['Mercury', 'Mercury'], ['Venus', 'Venus'], ['Mars', 'Mars'], ['Jupiter', 'Jupiter'], ['Saturn', 'Saturn']];
const huongChu = (az) => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(az / R / 45) % 8];
const gioDP = (ms) => { const t = new Date(ms + lg * 3600e3); return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`; };
const su = []; let truoc = null;
for (let ms = bd; ms <= kt; ms += 120e3) {
  const nay = Object.fromEntries([...SU.map(([k]) => [k, B.doCao(ms, k, vi, kinh)]), ['Sun', B.doCao(ms, 'Sun', vi, kinh)]]);
  if (truoc) { for (const [k, nhan] of SU) { const [a0] = truoc[k], [a1, az] = nay[k];
      if (a0 < 0 && a1 >= 0) su.push({ ms, chu: `${nhan} rises in the ${huongChu(az)}`, nhan: gioDP(ms) });
      if (a0 >= 0 && a1 < 0) su.push({ ms, chu: `${nhan} sets in the ${huongChu(az)}`, nhan: gioDP(ms) }); }
    if (truoc.Sun[0] >= -18 * R && nay.Sun[0] < -18 * R) su.push({ ms, chu: 'Full darkness: the faintest stars appear', nhan: gioDP(ms) }); }
  truoc = nay;
}
const cau = [{ tu: 0, den: 6, chu: `Tonight's sky over ${ten}`, nhan: `${ngay} · ${gioDP(bd)}–${gioDP(kt)}` }];
// 7 giây cuối luôn dành cho câu kết (sổ kênh bắt buộc trỏ về astrolas.com) — sự kiện rơi vào đó thì bỏ
for (const s of su) { const t = (s.ms - bd) / 1000 / toc; if (t - (cau.at(-1).den) < 1 || t + 6 > dai - 7) continue; cau.push({ tu: +t.toFixed(2), den: +(t + 6).toFixed(2), chu: s.chu, nhan: s.nhan }); }
cau.push({ tu: +(dai - 7).toFixed(2), den: dai, chu: 'See your own sky free at astrolas.com', nhan: "astrolas.com · Today's sky" });

const ra = arg('ra', join(SHOT, `dem-${ma}-${ngay}.json`)), tuongDoi = (p) => relative(dirname(ra), p);
const CAU = { _ghi: `Tonight's Sky ${ten} ${ngay} — sinh bởi lich-su/dai/sinh-dem.mjs`, kenh: 'astrolas', mau: 'tonights-sky', playlist_ma: 'tonights-sky', y_tuong: `ts-${ma}-${ngay}`, DAI: dai, toc: +toc.toFixed(3), huong,
  noi: { ten, vi, kinh, lech_gio: lg }, bat_dau_utc: new Date(bd).toISOString(),
  sao: tuongDoi(join(SHOT, 'du-lieu-sao/sao.json')), nen_nui: tuongDoi(join(DIR, '../brand/astrolas/anh/nui.jpg')), logo: tuongDoi(join(DIR, '../brand/astrolas/logo/wordmark.png')),
  playlist: { ten: "Tonight's Sky", mau: '#9FB8FF', ic: '✦' }, cau };
// máy gác sổ kênh: tập phải đúng mẫu / playlist / ý tưởng trong lich-su/so-kenh.json — sai thì không ghi
const { docSo, kiemTap } = await import(join(DIR, '../kiem-so-kenh.mjs')), loiSo = kiemTap(CAU, docSo().astrolas, 'astrolas');
if (loiSo.length) { console.error(`✗ tập trái sổ kênh:\n${loiSo.map((l) => `   · ${l}`).join('\n')}`); process.exit(3); }
writeFileSync(ra, JSON.stringify(CAU, null, 1) + '\n');
console.log(`✓ ${ra} · ${ten} ${ngay} ${gioDP(bd)}–${gioDP(kt)} (UTC${lg >= 0 ? '+' : ''}${lg}) · ${dai}s phim, ×${Math.round(toc)} · ${su.length} sự kiện`);
for (const c of cau) console.log(`   ${String(c.tu).padStart(6)}s  ${c.nhan}  ${c.chu}`);
