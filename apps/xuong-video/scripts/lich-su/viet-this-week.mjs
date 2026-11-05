#!/usr/bin/env node
// MÁY VIẾT "THIS WEEK IN YOUR CHART" (G5 kênh Astrolas, 05/11/2026): một sự kiện trời (lich-troi.json) × một cung Mọc → một Short 9:16 cho shot-code/la-so.html.
// 0đ, KHÔNG gọi AI: mọi chữ chiêm tinh là câu NGUYÊN VĂN site lấy từ kho (luật nguồn — nguon-site.mjs), dữ liệu sự kiện từ lịch trời tính tới phút,
// câu hook = dòng đầu QC spy chạy lâu của góc Thời điểm (playlist timing › goc_spy, may-dung --goc-hook --goc), bài đăng = dangCongCu. Máy gác kiemTap chặn trước khi ghi.
//   node viet-this-week.mjs --su tw-nghich-hanh-mercury-scorpio-2026-10-24 --moc Leo [--goc-hook gh.json] [--ra <tệp>]   · --moc all = đủ 12 cung Mọc
// Chọn câu theo loại sự kiện:
//   trăng mới / tròn → new-moon-and-full-moon-in-your-houses (câu mở + dòng theo nhà)        sao chậm vào cung → <sao>-transit-<n>th-house (tựa + câu đầu)
//   Mercury nghịch / thuận → mercury-retrograde-what-actually-happens                         Venus / Mars → venus-retrograde-and-mars-retrograde
//   Mộc / Thổ nghịch / thuận → transits-explained › The three passes                          Mặt Trời / sao nhanh đổi cung → transits-explained › Fast…
//   nghĩa nhà khi bài không có dòng riêng → la-so/y-nghia-nha.json (đúng nhà)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const KYC = Object.fromEntries(CUNG.map((c, i) => [c, '♈♉♊♋♌♍♎♏♐♑♒♓'[i] + '︎']));
const KYS = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };
const THU = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const bai = (s) => doc(`la-so/bai/${s}.json`), muc = (b, ten) => b.muc.find((m) => m.ten === ten)?.doan ?? [];
const cauDau = (p) => (p ?? '').split(/(?<=[.!?])\s+/)[0];
const CHAM = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

/** câu giải thích sự kiện + câu theo nhà (chữ site) + bài dùng — thuần trên kho bài đã lấy */
export function chuSuKien(su, nha) {
  const yN = doc('la-so/y-nghia-nha.json').nha[String(nha)], o = { bai: [], cong_cu: 'transit' };
  if (su.loai === 'trang_moi' || su.loai === 'trang_tron') {
    const b = bai('new-moon-and-full-moon-in-your-houses'), moi = su.loai === 'trang_moi';
    o.giai = cauDau(muc(b, moi ? "New Moon: beginnings you can't see yet" : 'Full Moon: what comes into view')[0]);
    o.nha = (muc(b, moi ? 'New Moon by house' : 'Full Moon by house').find((x) => x.startsWith(`${THU(nha)}:`)) ?? '').replace(/^\d+(st|nd|rd|th):\s*/, '') || yN;
    o.bai.push('new-moon-and-full-moon-in-your-houses'); o.cong_cu = 'lunation-analyzer';
  } else if (su.loai === 'vao_cung' && CHAM.includes(su.sao) && existsSync(join(DIR, `la-so/bai/${su.sao.toLowerCase()}-transit-${THU(nha)}-house.json`))) {
    const s = `${su.sao.toLowerCase()}-transit-${THU(nha)}-house`, b = bai(s);
    o.giai = b.tieu_de; o.nha = cauDau(b.muc[0]?.doan[0]); o.bai.push(s);
  } else if (su.loai === 'nghich_hanh' || su.loai === 'di_thuan') {
    const nghich = su.loai === 'nghich_hanh';
    if (su.sao === 'Mercury') { o.giai = nghich ? 'Three times a year, for about three weeks each, Mercury appears to move backwards' : 'The retrograde stations (the moments it appears to stop and reverse) are the sensitive points';
      o.them = nghich ? 're-viewing, re-visiting, re-considering, re-pairing' : null; o.bai.push('mercury-retrograde-what-actually-happens'); }
    else if (su.sao === 'Venus' || su.sao === 'Mars') { o.giai = 'Venus and Mars go retrograde far less often, and that rarity is exactly why they matter more when they do.'; o.bai.push('venus-retrograde-and-mars-retrograde'); }
    else { o.giai = nghich ? 'Outer planets go retrograde, which means most of their transits happen three times: direct, then retrograde, then direct again.' : 'First pass: the issue appears. Second: you revisit and often go deeper. Third: resolution.'; o.bai.push('transits-explained'); }
    o.nha = yN;
  } else {   // Mặt Trời / sao nhanh đổi cung
    o.giai = su.sao === 'Mars' ? 'Mars transits last a few days and bring energy or friction to whatever they touch.' : 'A transiting planet is also moving through your houses. Its house tells you where the theme is showing up.';
    o.nha = yN; o.bai.push('transits-explained');
  }
  return o;
}

/** hook QC spy của góc Thời điểm (box3, 0đ) — sự kiện nghịch hành ưu tiên hook nói về retrograde, còn lại xoay vòng theo cung Mọc */
function layHook(goc) {
  if (arg('goc-hook')) return JSON.parse(readFileSync(arg('goc-hook'), 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 240s ../../node_modules/.bin/tsx scripts/may-dung.mts --may astrolas --goc-hook --goc ${goc}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"goc"'));   // lệnh in JSON rồi giữ kết nối DB tới hết trần — lấy dòng JSON, không chờ mã thoát
  if (!dong) { console.error(`✗ không lấy được hook spy góc ${goc}:\n${(r.stderr ?? '').slice(-400)}`); process.exit(3); }
  return JSON.parse(dong);
}

function vietMot(su, moc, gh, ra) {
  const iR = CUNG.indexOf(moc), iS = CUNG.indexOf(su.cung), nha = ((iS - iR + 12) % 12) + 1, c = chuSuKien(su, nha);
  const d = new Date(su.utc), ngay = `${THANG[d.getUTCMonth()]} ${d.getUTCDate()}`, gio = su.utc.slice(11, 16);
  const nghich = /retrograde/i.test(su.chu), hs = gh.hooks.filter((h) => !/\d/.test(h.chu));   // (xoay bên dưới dùng hookGon: ưu tiên hook gọn một khung)
  const xoay = hookGon(hs.filter((h) => !/retrograde/i.test(h.chu))), hook = (nghich && hs.find((h) => /retrograde/i.test(h.chu))) || xoay[(iR + iS) % xoay.length] || hs[0] || gh.hooks[0];   // hook nói về nghịch hành chỉ cho sự kiện nghịch hành
  const chuHook = hookNgan(hook.chu);
  const so = docSo(), so_ = so.astrolas, pl = so_.playlist.find((p) => p.ma === 'timing');
  const tg = (p) => relative(SHOT, p),   // đường tính từ thư mục trang dựng (dung.mjs mở shot-code/la-so.html), không từ chỗ đặt tệp tập
    dung = (cung) => (cung === moc ? { toan: 1 } : { cap_cung: [moc, cung] });
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: `${KYC[moc]} ${moc}`, duoi: 'rising', dong: [], vi: 'giua' } },
    { nhin: dung(su.cung), chu: `${su.chu}:<br>${ngay}.`, nhan: `${ngay} · ${gio} UTC`, the: { lon: `${KYS[su.sao] ?? ''} ${KYC[su.cung]}`, duoi: su.chu, dong: [], vi: 'giua' } },
    { nhin: dung(su.cung), chu: `“${c.giai.replace(/[.]$/, '')}.”` },
    { nhin: dung(su.cung), chu: `Counted from ${moc} rising,<br>${su.cung} is your ${THU(nha)} house:`, the: { lon: THU(nha), duoi: `house · ${moc} rising`, dong: [`“${c.nha.replace(/[.]$/, '')}.”`], vi: 'giua' } },
    ...(c.them ? [{ nhin: { troi: 1 }, chu: `“${c.them}”` }] : []),
    { nhin: { troi: 1 }, khung: true, chu: 'See where it lands in your chart<br>free at astrolas.com.' },
  ].map((q, i, a) => ({ ...q, tu: i * 4.2, den: (i + 1) * 4.2 }));
  const tieuDe = `${chuHook} ${moc} rising: ${su.chu}`;
  const tap = tachCanh({   // mỗi khung một ý ngắn (chu-man.mjs)
   
    _ghi: `This Week · ${su.chu} × ${moc} rising — sinh bởi lich-su/viet-this-week.mjs (chữ site nguyên văn, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'this-week', playlist_ma: 'timing', y_tuong: su.ma, tieu_de: tieuDe,
    goc: gh.goc, hook: { qc: hook.id, goc: hook.chu }, nguon_bai: c.bai,
    dang: dangCongCu(c.cong_cu, null, {}, `${su.chu} (${ngay}, ${gio} UTC): what it means for ${moc} rising.${c.bai.length ? ` Read more: ${c.bai.map((b) => `https://astrolas.com/en/blog/${b}`).join(' ')}` : ''}`),
    la_so: tg(join(DIR, 'la-so/steve-jobs.svg')), chi_vong: true,
    nen: tg(join(DIR, pl.nen))   /* nền theo playlist (so-kenh › playlist.nen) */, logo: tg(join(DIR, 'brand/astrolas/logo/wordmark.png')),
    playlist: { ten: pl.ten, mau: '#7FD18B', ic: '☽' }, DAI: cau.at(-1).den, cau });
  const loi = [...kiemTap(tap, so_, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ ${su.ma} × ${moc}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${ra.replace(SHOT + '/', '')} · ${THU(nha)} house · hook "${chuHook.slice(0, 50)}"`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ma = arg('su'), moc = arg('moc'); if (!ma || !moc) { console.error('dùng: --su <mã sự kiện lich-troi> --moc <Cung | all>'); process.exit(2); }
  const su = doc('lich-troi.json').su_kien.find((x) => x.ma === ma); if (!su) { console.error(`không có sự kiện ${ma} trong lich-troi.json`); process.exit(2); }
  const so = docSo().astrolas, goc = so.playlist.find((p) => p.ma === 'timing')?.goc_spy?.[0]?.id ?? 4316, gh = layHook(goc);
  const ds = moc === 'all' ? CUNG : [moc]; let hong = 0;
  for (const m of ds) if (!vietMot(su, m, gh, arg('ra', join(SHOT, 'tap-astrolas', `${su.ma}-${m.toLowerCase()}.json`)))) hong++;
  process.exit(hong ? 1 : 0);
}
