#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — lịch ESPN (API công khai, không khoá) → tran.mjs/lam.mjs có sẵn → tai-len.mts / may-dung.mts / cham-dang.mjs có sẵn trên box3.
// MÁY DỰNG TRẬN BÓNG ORBIBALL TỰ ĐỘNG (anh 28/11/2026 "lên plan sx và đăng định kỳ… trận MU, đội nhiều fan, derby, siêu kinh điển, giải lớn" → chọn (b): gắn vào
// lượt 10 phút dang-lien-tuc.mjs của iMac, một lần mỗi ngày, không tiến trình mới). Một vòng:
//   1. lịch 14 ngày tới của 6 giải (ESPN) → chấm độ hot: MU 100 · derby / siêu kinh điển 90 · cúp C1 lớn gặp lớn 85 · lớn gặp lớn 70 (dựng khi ≥ 60)
//   2. xếp ngày đăng theo trần kênh (YouTube 1/2/3 bài mỗi ngày theo tuổi kênh, cặp ngang + reel tính một): từ 48 giờ trước giờ bóng lăn tới 3 giờ trước, ưu tiên ngày sát trận
//      → dang.dang_tu / dang.dang_den (máy đăng puzzle-books nhip-an-toan › trongHan giữ cửa)
//   3. trận có ngày đăng ≤ mai mà chưa có trong sổ → dựng bản ngang + reel (lam.mjs, hạt điểm kịch tính cao nhất trong 1-200), khung soát, ảnh bìa ảnh thật Pexels
//      → tải lên img.on.tc → nạp máy orbiball (hook spy trong kenh-orbiball/hook.json) → xuất → Phòng Nội dung chấm (cty cham-dang.mjs) → máy đăng tự lấy khi tới ngày.
//   node dung-tran.mjs --xem                 in lịch + ngày đăng đã xếp, không dựng
//   node dung-tran.mjs --tu-dong [--toi-da 2]  dựng + nạp các trận tới hạn (dang-lien-tuc gọi)
//   node dung-tran.mjs --espn <id> [--ngay YYYY-MM-DD]   dựng đúng một trận ESPN (ép ngày đăng nếu cần)
//   node dung-tran.mjs --tu-kiem             tự kiểm phần chấm + xếp ngày
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, openSync, closeSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layDoiHinh, chonXi } from './doi-hinh.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), KENH = join(DIR, 'kenh-orbiball');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BOX = 'root@167.233.241.16', MAY = 'orbiball', NGAY_DAU = '2026-11-28';   // ngày kênh đăng bài đầu (tuổi kênh → trần)
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer', ESPN_BXH = 'https://site.api.espn.com/apis/v2/sports/soccer';
const GIAI = { 'eng.1': 'Premier League', 'esp.1': 'LaLiga', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1', 'uefa.champions': 'Champions League' };
const LON = new Set(['Manchester United', 'Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Tottenham Hotspur', 'Newcastle United', 'Real Madrid', 'Barcelona', 'Atlético Madrid',
  'Bayern Munich', 'Borussia Dortmund', 'Paris Saint-Germain', 'Internazionale', 'AC Milan', 'Juventus', 'Napoli', 'AS Roma']);
const DERBY = [['Arsenal', 'Tottenham Hotspur'], ['Manchester United', 'Manchester City'], ['Liverpool', 'Everton'], ['Liverpool', 'Manchester United'], ['Real Madrid', 'Barcelona'],
  ['Real Madrid', 'Atlético Madrid'], ['AC Milan', 'Internazionale'], ['Internazionale', 'Juventus'], ['AS Roma', 'Lazio'], ['Bayern Munich', 'Borussia Dortmund'],
  ['Paris Saint-Germain', 'Marseille'], ['Arsenal', 'Chelsea'], ['Chelsea', 'Tottenham Hotspur'], ['Newcastle United', 'Sunderland']];
const NGUONG = 60;
const BS = JSON.parse(readFileSync(join(KENH, 'doi.json'), 'utf8')), HOOK = JSON.parse(readFileSync(join(KENH, 'hook.json'), 'utf8'));

const vnNgay = (t) => new Date(t + 7 * 3600_000).toISOString().slice(0, 10);
const vnGio = (t) => new Date(t + 7 * 3600_000).toISOString().slice(11, 16);
const congNgay = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10);
const ngayGiua = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);

/** Độ hot của một trận (tên đội theo displayName ESPN). */
export function diemTran(nha, khach, giai) {
  const co = (x) => nha === x || khach === x, lon = [nha, khach].filter((x) => LON.has(x)).length;
  if (co('Manchester United')) return 100;
  if (DERBY.some(([a, b]) => co(a) && co(b))) return 90;
  if (giai === 'uefa.champions' && lon === 2) return 85;
  if (lon === 2) return 70;
  if (giai === 'uefa.champions' && lon === 1) return 40;
  return 0;
}
/** Trần bài/ngày của kênh YouTube theo tuổi (nhip-an-toan: <14 ngày 1, <28 ngày 2, còn lại 3). */
export const tranNgay = (ngay) => { const tuoi = ngayGiua(NGAY_DAU, ngay); return tuoi < 14 ? 1 : tuoi < 28 ? 2 : 3; };
/** Ngày VN có thể đăng trước trận: khung đăng 00:00–10:00 và 19:00–24:00 giờ VN, sau `tu` (ms) và trước giờ bóng lăn − 3 giờ. */
export function ngayDangDuoc(ko, tu) {
  const den = ko - 3 * 3600_000, ra = [];
  for (let d = vnNgay(Math.max(tu, ko - 48 * 3600_000)); d <= vnNgay(den); d = congNgay(d, 1)) {
    const goc = Date.parse(d + 'T00:00:00+07:00'), khung = [[goc, goc + 10 * 3600_000], [goc + 19 * 3600_000, goc + 24 * 3600_000]];
    if (khung.some(([a, b]) => Math.max(a, tu) < Math.min(b, den))) ra.push(d);
  }
  return ra;
}
/** Xếp ngày đăng: trận hot trước, mỗi trận lấy ngày sát giờ bóng lăn nhất còn chỗ trong trần. dung = Map ngày → số bài đã chiếm. */
export function xepNgay(tran, dung, tu) {
  const ds = [...tran].sort((a, b) => b.diem - a.diem || a.ko - b.ko), chiem = new Map(dung);
  for (const t of ds) {
    if (t.ngay) continue;   // đã nằm trong sổ
    const d = ngayDangDuoc(t.ko, tu).reverse().find((x) => (chiem.get(x) ?? 0) < tranNgay(x));
    if (d) { t.ngay = d; chiem.set(d, (chiem.get(d) ?? 0) + 1); }
  }
  return ds;
}

async function json(url) { const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }
const doiTu = (c) => ({ id: c.team.id, ten: c.team.displayName, ngan: c.team.shortDisplayName, ma: c.team.abbreviation, mau: c.team.color, mau2: c.team.alternateColor, form: c.form ?? '' });
/** Lịch 6 giải × n ngày tới (ESPN trả mỗi lần một ngày). */
async function layLich(n = 14) {
  const hom = vnNgay(Date.now()), viec = [];
  for (const g of Object.keys(GIAI)) for (let i = 0; i < n; i++) viec.push([g, congNgay(hom, i).replace(/-/g, '')]);
  const ra = new Map();
  for (let i = 0; i < viec.length; i += 12) await Promise.all(viec.slice(i, i + 12).map(async ([g, d]) => {
    try {
      for (const e of (await json(`${ESPN}/${g}/scoreboard?dates=${d}`)).events ?? []) {
        const c = e.competitions?.[0], nha = c?.competitors?.find((x) => x.homeAway === 'home'), khach = c?.competitors?.find((x) => x.homeAway === 'away');
        if (!nha || !khach || e.status?.type?.state !== 'pre') continue;
        const t = { id: e.id, giai: g, ko: Date.parse(e.date), san: c.venue?.fullName ?? null, nha: doiTu(nha), khach: doiTu(khach) };
        t.diem = diemTran(t.nha.ten, t.khach.ten, g); ra.set(e.id, t);
      }
    } catch (e) { console.warn(`⚠ ESPN ${g} ${d}: ${e.message}`); }
  }));
  return [...ra.values()];
}
const slugGoc = (t) => `${BS[t.nha.ten]?.ma ?? t.nha.ma}-${BS[t.khach.ten]?.ma ?? t.khach.ma}-${vnNgay(t.ko)}`.toLowerCase();   // doi.json ma: mã slug khi mã ESPN mơ hồ (MU = MAN)

const ssh = (lenh, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', BOX, lenh], { encoding: 'utf8', input, maxBuffer: 64 << 20, timeout: 20 * 60_000 });
const ENV = 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a';
const TSX = 'cd apps/xuong-video && env NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx';
/** Sổ máy orbiball trên box3: slug → { ngay đăng/đã đăng } (bản reel bỏ qua — cặp tính một bài). */
function laySo() {
  const ra = ssh(`${ENV}; psql "$DATABASE_URL" -tAc "select v.slug, coalesce(v.da_dang->'youtube'->>'ngay', v.dang->>'dang_tu', to_char(v.created_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD')) from xv_may_video v join xv_may m on m.id=v.may_id where m.ma='${MAY}' and not coalesce(v.luu_tru,false)"`);
  return ra.trim().split('\n').filter(Boolean).map((l) => l.split('|')).filter(([s]) => !s.endsWith('-reel')).map(([slug, ngay]) => ({ slug, ngay }));
}

// ---------- dựng một trận ----------
const hex = (x) => (x ? '#' + String(x).replace('#', '').padStart(6, '0') : null);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const sang = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const xa = (a, b) => Math.hypot(...rgb(a).map((x, i) => x - rgb(b)[i]));
async function timWiki(ten) {
  const j = await json(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(ten + ' football club')}`);
  const tt = j.query?.search?.[0]?.title; if (!tt) return null;
  return { trang: tt.replace(/ /g, '_'), khung: `Template:${tt.replace(/ /g, '_')}_squad` };
}
async function doiCua(t, nha, san) {
  const bs = BS[t.ten] ?? {}, mau = bs.mau ?? [hex(t.mau) ?? '#444444', hex(t.mau2) ?? '#ffffff'];
  const wiki = bs.wiki ?? (await timWiki(t.ten).catch(() => null));
  let cauthu = null;
  if (wiki) try { cauthu = await layDoiHinh(wiki); chonXi(cauthu); } catch (e) { console.warn(`⚠ ${t.ten}: đội hình Wikipedia hỏng (${e.message.slice(0, 120)}) → bi chỉ mang số áo`); cauthu = null; }
  return { ten: t.ten, ngan: t.ma, kieu: bs.kieu ?? 'tron', mau, chu: sang(mau[0]) > 0.62 ? '#111111' : '#ffffff', tm: nha ? ['#1fa34a', '#0b3d1c'] : ['#f2c200', '#3a2f00'], wiki, ...(nha && san ? { san } : {}), ...(cauthu ? { cauthu } : {}), _biet: bs.biet };
}
async function bangXepHang(giai) {
  if (giai === 'uefa.champions') return new Map();
  try {
    const j = await json(`${ESPN_BXH}/${giai}/standings`), ra = new Map();
    for (const e of j.children?.[0]?.standings?.entries ?? []) {
      const s = (k) => e.stats?.find((x) => x.name === k)?.displayValue;
      ra.set(e.team.displayName, { hang: s('rank'), diem: s('points'), hs: s('pointDifferential') });
    }
    return ra;
  } catch (e) { console.warn(`⚠ bảng xếp hạng ${giai}: ${e.message}`); return new Map(); }
}
const thu = (n) => { const m = n % 100; return n + (m >= 11 && m <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'); };
// Ảnh nền thật: Pexels thử lần lượt 5 cụm (bắt đầu từ cụm theo slug), mỗi cụm chọn ảnh theo số ảnh THẬT trả về; Pexels hỏng / rỗng / giới hạn
// → Pixabay cùng cụm. Cả hai hỏng mới throw (vòng 28/11/2026: Pexels trả rỗng một lần lẻ làm hỏng cả trận Everton–Liverpool).
async function pexels(slug, dir) {
  const skill = readFileSync(`${process.env.HOME}/.claude/skills/design/stock-photo-apis/SKILL.md`, 'utf8');
  const kPx = skill.match(/\| Pexels \| `([^`]+)`/)?.[1], kPb = skill.match(/\| Pixabay \| `([^`]+)`/)?.[1];
  if (!kPx && !kPb) throw new Error('không thấy khoá Pexels / Pixabay trong skill stock-photo-apis');
  const h = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), CUM = ['football stadium night', 'soccer stadium crowd', 'football pitch grass', 'soccer stadium floodlights', 'football fans stadium'];
  const UA = { 'user-agent': 'Mozilla/5.0' }, loi = [];
  const lay = async (url, opt) => { const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(30_000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; };
  for (let i = 0; i < CUM.length; i++) {
    const q = CUM[(h + i) % CUM.length];
    if (kPx) try {
      const ds = (await (await lay(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`, { headers: { Authorization: kPx, ...UA } })).json()).photos ?? [];
      if (ds.length) {
        const p = ds[(h >> 3) % ds.length];
        writeFileSync(join(dir, 'nen.jpg'), Buffer.from(await (await lay(p.src.large2x, { headers: UA })).arrayBuffer()));
        return { trang: p.url, nen: p.src.original + '?auto=compress&cs=tinysrgb&w=1920' };
      }
      loi.push(`Pexels "${q}": rỗng`);
    } catch (e) { loi.push(`Pexels "${q}": ${e.message}`); }
    if (kPb) try {
      const ds = (await (await lay(`https://pixabay.com/api/?key=${kPb}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&per_page=20&safesearch=true`, { headers: UA })).json()).hits ?? [];
      if (ds.length) {
        const p = ds[(h >> 3) % ds.length];
        writeFileSync(join(dir, 'nen.jpg'), Buffer.from(await (await lay(p.largeImageURL, { headers: UA })).arrayBuffer()));
        return { trang: p.pageURL, nen: p.largeImageURL };
      }
      loi.push(`Pixabay "${q}": rỗng`);
    } catch (e) { loi.push(`Pixabay "${q}": ${e.message}`); }
  }
  throw new Error(`không lấy được ảnh nền thật: ${loi.slice(0, 4).join(' · ')}`);
}
const giayCua = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
const chup = (mp4, t, ra) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-q:v', '3', ra]);
function veBia(dir, ten, { d1, vs, d2, mau1, khung }) {
  const co = (s) => (s.length <= 9 ? 96 : s.length <= 13 ? 78 : 60);
  const html = readFileSync(join(KENH, 'thumb.html'), 'utf8').replace('{{NEN}}', 'nen.jpg').replace('{{KHUNG}}', khung).replace('{{D1}}', d1).replace('{{VS}}', vs).replace('{{D2}}', d2)
    .replace('{{MAU1}}', mau1).replace('{{CO1}}', co(d1)).replace('{{CO2}}', co(d2));
  writeFileSync(join(dir, `${ten}.html`), html);
  execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,720', '--virtual-time-budget=4000', `--screenshot=${join(dir, ten + '.png')}`, `file://${join(dir, ten + '.html')}`], { stdio: 'ignore', timeout: 60_000 });
  execFileSync('magick', [join(dir, ten + '.png'), '-quality', '90', join(dir, ten + '.jpg')]);
  return `${ten}.jpg`;
}

async function dungTran(t, ngayDang) {
  const goc = slugGoc(t), dir = join(process.env.HOME, '.cache', 'dung-tran', goc), giaiTen = GIAI[t.giai];
  mkdirSync(dir, { recursive: true });
  const [nha, khach] = await Promise.all([doiCua(t.nha, true, t.san), doiCua(t.khach, false)]);
  if (xa(nha.mau[0], khach.mau[0]) < 110) khach.mau = xa(nha.mau[0], khach.mau[1]) >= 110 ? [khach.mau[1], khach.mau[0]] : ['#ffffff', '#111111'];   // trùng màu áo → đội khách mặc áo phụ
  khach.chu = sang(khach.mau[0]) > 0.62 ? '#111111' : '#ffffff';
  const H = t.nha.ngan, A = t.khach.ngan, bH = nha._biet ?? H.toUpperCase(), bA = khach._biet ?? A.toUpperCase(); delete nha._biet; delete khach._biet;
  const doi = { tieu_de: `${H.toUpperCase()} vs ${A.toUpperCase()}`, phu_de: [giaiTen, t.san].filter(Boolean).join(' · '), nguon: `ESPN (lịch) + Wikipedia (đội hình), lấy ${vnNgay(Date.now())}`, doi: [nha, khach] };
  writeFileSync(join(dir, 'doi.json'), JSON.stringify(doi, null, 2));
  const dai = 1 + ([...goc].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 11) % 50) * 200;   // dải hạt riêng mỗi trận → không hai trận cùng một kịch bản
  console.log(`▶ dựng ${H} vs ${A} (${giaiTen}, ${vnGio(t.ko)} ${vnNgay(t.ko)} giờ VN) → ${dir}`);
  const ra = execFileSync('node', [join(DIR, 'lam.mjs'), '--luat', 'tran', '--doi', join(dir, 'doi.json'), '--do', `${dai}-${dai + 199}`, '--top', '1', '--ra', dir], { cwd: DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20, timeout: 40 * 60_000 });
  const m = ra.match(/✓ seed (\d+) · \d+ s · (\d+)-(\d+) · điểm/); if (!m) throw new Error(`lam.mjs không in dòng ✓: ${ra.slice(-300)}`);
  const [seed, a, b] = [m[1], m[2], m[3]], slug = `${goc}-s${seed}`;
  const NG = join(dir, `tran-${seed}.mp4`), RL = join(dir, `tran-${seed}-reel.mp4`), gN = giayCua(NG), gR = giayCua(RL);
  const tep = [`tran-${seed}.mp4`, `tran-${seed}-reel.mp4`];
  for (const [mp4, g, k] of [[NG, gN, 'n'], [RL, gR, 'r']]) [0.1, 0.45, 0.97].forEach((x, i) => { chup(mp4, +(g * x).toFixed(2), join(dir, `k${k}${i}.jpg`)); tep.push(`k${k}${i}.jpg`); });
  execFileSync('magick', [join(dir, 'kn1.jpg'), '-crop', '800x500+560+290', '+repage', '-resize', '1120x700', join(dir, 'cat-n.jpg')]);
  execFileSync('magick', [join(dir, 'kr1.jpg'), '-crop', '800x500+140+710', '+repage', '-resize', '1120x700', join(dir, 'cat-r.jpg')]);
  const anh = await pexels(slug, dir), mau1 = sang(nha.mau[0]) < 0.12 ? '#ffffff' : nha.mau[0];
  const san = (t.san ?? 'THE STADIUM').toUpperCase();
  const chuN = { d1: bH, vs: 'OR', d2: bA }, chuR = { d1: 'WHO WINS', vs: 'AT', d2: san };
  tep.push(veBia(dir, 'bia-n', { ...chuN, mau1, khung: 'cat-n.jpg' }), veBia(dir, 'bia-r', { ...chuR, mau1, khung: 'cat-r.jpg' }));

  // tải lên img.on.tc (box3)
  const xa_ = `/tmp/dung-tran/${slug}`;
  ssh(`mkdir -p ${xa_}`);
  execFileSync('scp', ['-q', ...tep.map((f) => join(dir, f)), `${BOX}:${xa_}/`], { timeout: 20 * 60_000 });
  const len = ssh(`${ENV}; cd apps/xuong-video; for f in ${tep.join(' ')}; do ( u=$(env NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tai-len.mts ${xa_}/$f ${MAY} 2>&1 | tail -1); echo "$f $u" ) & done; wait`);
  const url = Object.fromEntries(len.trim().split('\n').map((l) => l.split(' ')).filter(([, u]) => /^https:\/\/img\.on\.tc\//.test(u ?? '')));
  for (let lan = 0; lan < 2; lan++) for (const f of tep.filter((x) => !url[x])) {
    const u = ssh(`${ENV}; cd apps/xuong-video; env NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tai-len.mts ${xa_}/${f} ${MAY} 2>&1 | tail -1`).trim();
    if (/^https:\/\/img\.on\.tc\//.test(u)) url[f] = u;
  }
  const thieu = tep.filter((f) => !url[f]); if (thieu.length) throw new Error(`tải lên hỏng sau 3 lần: ${thieu.join(', ')} — ${len.slice(-300)}`);
  ssh(`rm -rf ${xa_}`);

  // chữ bài đăng (tiếng Anh, chỉ sự thật lấy từ ESPN / Wikipedia)
  const bxh = await bangXepHang(t.giai), ko = new Date(t.ko);
  const ngayEn = ko.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), gioUtc = ko.toISOString().slice(11, 16);
  const dong = (x, ten) => { const r = bxh.get(ten); return r?.hang ? `${x} ${thu(Number(r.hang))} (${r.diem} pts, GD ${r.hs})` : null; };
  const bang = [dong(H, t.nha.ten), dong(A, t.khach.ten)].filter(Boolean);
  const form = (x, f) => (f ? `- ${x} recent form: ${f.split('').join(' ')}` : null);
  const coTen = !!(nha.cauthu && khach.cauthu);
  const moTa = [
    `${H} host ${A}${t.san ? ` at ${t.san}` : ''} on ${ngayEn} (kick-off ${gioUtc} UTC), ${giaiTen}. Before the real game, we let physics play it: 22 marbles, one circular pitch, a full 90 minutes. Final score in the simulation: ${H} ${a}-${b} ${A}.`,
    '',
    'Match facts',
    `- Competition: ${giaiTen}`,
    ...(t.san ? [`- Venue: ${t.san}`] : []),
    `- Kick-off: ${ngayEn}, ${gioUtc} UTC`,
    ...(bang.length === 2 ? [`- Table before kick-off: ${bang.join(', ')}`] : []),
    ...[form(H, t.nha.form), form(A, t.khach.form)].filter(Boolean),
    '',
    `How it works: ${coTen ? 'every marble carries a real squad name and shirt number' : 'every marble carries a shirt number'}. Nothing is scripted and the score is never edited: the result comes only from collisions and the random seed (trial ${seed}).${coTen ? " Starting XI here is picked by shirt number, not the manager's actual line-up." : ''}`,
    '',
    'Would your team survive? Drop your real score prediction in the comments.',
    '',
    `Sources: fixture, venue, table and form from ESPN${coTen ? '; squads from Wikipedia' : ''} (checked ${ngayEn.replace(/^\w+, /, '').replace(/ \d{4}$/, '')} ${vnNgay(Date.now()).slice(0, 4)}).`,
    `This is a fan-made physics simulation. Not affiliated with ${t.giai === 'uefa.champions' ? 'UEFA' : `the ${giaiTen}`} or either club.`,
    '',
    `#MarbleFootball #${H.replace(/[^A-Za-z0-9]/g, '')} #${A.replace(/[^A-Za-z0-9]/g, '')}`,
  ].join('\n');
  const { tieu_de: tdN, ...hookN } = HOOK.ngang, { tieu_de: tdR, ...hookR } = HOOK.reel;
  const daDung = new Set(ssh(`${ENV}; psql "$DATABASE_URL" -tAc "select dang->>'title' from xv_may_video where dang->>'title' is not null"`).split('\n').map((x) => x.trim()));
  const tieuDe = (mau) => { const t0 = mau.replace('{H}', H).replace('{A}', A); if (!daDung.has(t0)) return t0; const t1 = `${t0} (${ko.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })})`; return daDung.has(t1) ? `${t1} #${seed}` : t1; };
  if (!(gR > 10 && gR <= 59.5)) throw new Error(`reel ${gR.toFixed(1)} s ngoài 10–59,5 s: YouTube không xếp vào Shorts (lam.mjs phải cắt highlight)`);
  const han = { dang_tu: ngayDang, dang_den: vnNgay(t.ko - 3 * 3600_000) };
  const de = (mp4, g, k, bia, chu, duoi) => ({ loai: 'video-ngoai', video_url: url[mp4], giay: +g.toFixed(2), khung: [0, 1, 2].map((i) => url[`k${k}${i}.jpg`]), soat: [],
    thumb: { url: url[bia], chu: `${chu.d1} ${chu.vs} ${chu.d2} ?`, nguon: anh.trang }, tom_tat: `${H} ${a}-${b} ${A}, marble physics simulation, seed ${seed}${duoi}` });
  const chuDe = `${H} vs ${A}, ${giaiTen}, ${vnNgay(t.ko).split('-').reverse().join('/')}`;
  const nap = [
    { slug, chu_de: chuDe, mau: 'video-ngoai', nen_url: anh.nen, de: de(`tran-${seed}.mp4`, gN, 'n', 'bia-n.jpg', chuN, ''),
      dang: { title: tieuDe(tdN), description: moTa, link: null, loai: 'thuong', playlist_ten: 'Marble Football', goc: HOOK.goc, hook: hookN, ...han } },
    { slug: `${slug}-reel`, chu_de: `${chuDe} (reel dọc)`, mau: 'video-ngoai', nen_url: anh.nen, de: de(`tran-${seed}-reel.mp4`, gR, 'r', 'bia-r.jpg', chuR, ', vertical 1080x1920'),
      dang: { title: tieuDe(tdR), description: moTa.replace('\n\nMatch facts', ' Short: every goal of the simulated 90 minutes, then the final whistle.\n\nMatch facts'), link: null, loai: 'thuong', playlist_ten: 'Marble Football', goc: HOOK.goc, hook: hookR, ...han } },
  ];
  writeFileSync(join(dir, 'nap.json'), JSON.stringify(nap, null, 1));
  const T = `${TSX} scripts/may-dung.mts --may ${MAY}`;
  console.log(ssh(`${ENV}; ${T} --nap`, JSON.stringify(nap)).trim().split('\n').pop());
  ssh(`${ENV}; ${T} --xuat ${slug} >/dev/null && ${T} --xuat ${slug}-reel >/dev/null; cd /opt/cty && node worker/cham-dang.mjs --chay >/dev/null 2>&1; true`);
  const kq = ssh(`${ENV}; psql "$DATABASE_URL" -tAc "select slug, cham->>'ket', cham->>'diem', coalesce(cham->>'chan_cung','') from xv_may_video where slug in ('${slug}','${slug}-reel') order by slug"`).trim();
  const ket = Object.fromEntries(kq.split('\n').map((l) => l.split('|')).map(([s_, k, d, c]) => [s_, { k, d, c }]));
  console.log(`  ${H} ${a}-${b} ${A} · đăng ${han.dang_tu} → ${han.dang_den} · chấm: ${kq.replace(/\n/g, ' ; ')}`);
  const xau = [slug, `${slug}-reel`].filter((x) => ket[x]?.k !== 'DUYET');
  if (xau.length) throw new Error(`Phòng Nội dung chưa duyệt ${xau.map((x) => `${x}=${ket[x]?.k ?? 'chưa chấm'} ${ket[x]?.c ?? ''}`).join(' · ')}`);
  for (const f of readdirSync(dir)) if (!/\.json$/.test(f)) rmSync(join(dir, f), { force: true });   // iMac đầy ổ: bản dựng đã nằm img.on.tc, giữ doi/nap.json
  console.log(`✓ ${MAY} dung-tran ${slug} → ${url[`tran-${seed}.mp4`]}`);
  return { slug, kq };
}

// ---------- chạy ----------
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.equal(diemTran('Arsenal', 'Manchester United', 'eng.1'), 100); t.equal(diemTran('Everton', 'Liverpool', 'eng.1'), 90); t.equal(diemTran('Arsenal', 'Manchester City', 'eng.1'), 70);
  t.equal(diemTran('Bayern Munich', 'Arsenal', 'uefa.champions'), 85); t.equal(diemTran('Brentford', 'Fulham', 'eng.1'), 0);
  t.equal(tranNgay('2026-11-29'), 1); t.equal(tranNgay('2026-12-12'), 2); t.equal(tranNgay('2026-12-26'), 3);
  const ko = Date.parse('2026-11-29T12:00:00Z'), luc = Date.parse('2026-11-28T07:00:00Z');   // bóng lăn 19:00 29/11 VN, giờ 14:00 28/11 VN
  t.deepEqual(ngayDangDuoc(ko, luc), ['2026-11-28', '2026-11-29'], 'tối 28 + sáng 29');
  t.deepEqual(ngayDangDuoc(ko, Date.parse('2026-11-29T04:00:00Z')), [], '11:00 ngày đá, trận 19:00 → hết khung');
  const ds = xepNgay([{ id: 'a', diem: 70, ko }, { id: 'b', diem: 90, ko }], new Map([['2026-11-28', 1]]), luc);
  t.equal(ds.find((x) => x.id === 'b').ngay, '2026-11-29'); t.equal(ds.find((x) => x.id === 'a').ngay, undefined, 'trần 1 bài/ngày → trận kém hot rớt');
  console.log('dung-tran: tự kiểm ok'); process.exit(0);
}

const KHOA = join(process.env.HOME, '.cache', 'dung-tran.khoa'); mkdirSync(dirname(KHOA), { recursive: true });
// Khoá ghi pid: lượt bị giết (timeout, Ctrl-C) không chạy được 'exit' nên để khoá lại — 28/11/2026 khoá mồ côi 14:14 làm vòng ghi "ok" cả ngày mà không dựng gì.
// Pid chết → lấy lại khoá. Khoá thật sự bận → thoát 75 (thử lại sau), KHÔNG thoát 0: dang-lien-tuc coi mã 0 là đã xong việc trong ngày.
const giuKhoa = () => { const fd = openSync(KHOA, 'wx'); writeSync(fd, String(process.pid)); closeSync(fd); };
const conSong = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
if (!process.argv.includes('--xem')) try { giuKhoa(); } catch {
  const pid = Number(readFileSync(KHOA, 'utf8').trim()), tre = Date.now() - statSync(KHOA).mtimeMs;
  if (pid && conSong(pid) && tre < 120 * 60_000) { console.log(`· ${MAY} dung-tran: lượt dựng khác đang chạy (pid ${pid}) — thử lại lượt sau`); process.exit(75); }
  console.log(`· ${MAY} dung-tran: gỡ khoá mồ côi (${pid ? `pid ${pid} đã chết` : 'không có pid'}, ${Math.round(tre / 60_000)} phút)`); unlinkSync(KHOA); giuKhoa();
}
if (!process.argv.includes('--xem')) process.on('exit', () => { try { unlinkSync(KHOA); } catch { /* đã gỡ */ } });
const thieuCu = ['ffmpeg', 'ffprobe', 'magick', 'ssh', 'scp'].filter((c) => { try { execFileSync('which', [c], { stdio: 'ignore' }); return false; } catch { return true; } });
if (!existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) thieuCu.push('Google Chrome');
if (!existsSync(join(DIR, 'node_modules', 'matter-js'))) try { execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: DIR, stdio: 'ignore', timeout: 10 * 60_000 }); } catch { thieuCu.push('node_modules (npm ci hỏng)'); }   // máy mới clone repo
if (thieuCu.length) { console.log(`✗ ${MAY} dung-tran: thiếu công cụ ${thieuCu.join(', ')}`); process.exit(1); }
const bay = Date.now(), homNay = vnNgay(bay), mai = congNgay(homNay, 1);
const so = laySo(), daCo = (t) => so.find((x) => x.slug.startsWith(slugGoc(t) + '-s'));
const dung = new Map(); for (const x of so) dung.set(x.ngay, (dung.get(x.ngay) ?? 0) + 1);
let lich = await layLich();
if (!lich.length) { console.log(`✗ ${MAY} dung-tran: ESPN không trả trận nào trong 14 ngày của 6 giải — API đổi dạng hoặc bị chặn`); process.exit(1); }
// bài đã nạp mà chấm dở (lượt trước đứt giữa chừng) → chấm lại, chưa DUYET thì kêu
const dangDo = ssh(`${ENV}; psql "$DATABASE_URL" -tAc "select v.slug||'|'||coalesce(v.cham->>'ket','') from xv_may_video v join xv_may m on m.id=v.may_id where m.ma='${MAY}' and not coalesce(v.luu_tru,false) and v.da_dang->'youtube' is null and coalesce(v.cham->>'ket','')<>'DUYET'"`).trim();
if (dangDo && !process.argv.includes('--xem')) {
  ssh(`cd /opt/cty && node worker/cham-dang.mjs --chay >/dev/null 2>&1; true`);
  console.log(`✗ ${MAY} dung-tran: bài chưa duyệt trong sổ: ${dangDo.replace(/\n/g, ' ; ')} (đã chấm lại)`);
}
if (arg('espn')) {
  const t = lich.find((x) => x.id === arg('espn')); if (!t) { console.error(`không thấy trận ESPN ${arg('espn')} trong 14 ngày tới`); process.exit(1); }
  if (daCo(t)) { console.log(`· ${slugGoc(t)} đã có trong sổ (${daCo(t).slug})`); process.exit(0); }
  const d = arg('ngay') ?? ngayDangDuoc(t.ko, bay + 30 * 60_000).reverse().find((x) => (dung.get(x) ?? 0) < tranNgay(x));
  if (!d) { console.error('trận này không còn ngày đăng nào trong trần — thêm --ngay YYYY-MM-DD để ép'); process.exit(1); }
  await dungTran(t, d); process.exit(0);
}
lich = lich.filter((t) => t.diem >= NGUONG);
for (const t of lich) { const c = daCo(t); if (c) t.ngay = c.ngay, t.daCo = c.slug; }
xepNgay(lich, dung, bay + 40 * 60_000);
for (const t of lich.sort((a, b) => a.ko - b.ko)) console.log(`  ${t.daCo ? 'có' : t.ngay ? '->' : '--'} ${String(t.diem).padStart(3)} ${t.nha.ten} vs ${t.khach.ten} (${GIAI[t.giai]}) · bóng lăn ${vnGio(t.ko)} ${vnNgay(t.ko)} VN · ${t.daCo ? `đã có ${t.daCo}` : t.ngay ? `đăng ${t.ngay}` : 'hết chỗ trong trần'}`);
if (process.argv.includes('--xem')) process.exit(0);
const toi = lich.filter((t) => !t.daCo && t.ngay && t.ngay <= mai).sort((a, b) => a.ngay.localeCompare(b.ngay) || b.diem - a.diem).slice(0, Number(arg('toi-da', 2)));
if (!toi.length) { console.log(`· ${MAY} dung-tran: không trận nào tới hạn dựng (ngày đăng ≤ mai)`); process.exit(0); }
let hong = 0;
for (const t of toi) try { await dungTran(t, t.ngay); } catch (e) { hong++; console.log(`✗ ${MAY} dung-tran: ${slugGoc(t)} ${String(e.message).split('\n')[0].slice(0, 280)}`); }
process.exit(hong ? 1 : 0);
