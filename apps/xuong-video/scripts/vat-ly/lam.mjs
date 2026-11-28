// Dựng trọn video mô phỏng vật lý cho một hoặc nhiều hạt giống: ghi → hình (dung.mjs) → tiếng (tieng.mjs) → ghép → tờ khung. 0₫, chạy iMac.
// tra-repo-ok: điều phối dán keo các bước có sẵn trong thư mục này + shot-code/dung.mjs.
//   node lam.mjs --seed 80,90,73 --ra <thư-mục> [--song 6]
//   node lam.mjs --luat tran --doi tran-doi.json --seed 168 --ra <thư-mục>   (trận bóng hai đội)
//   (không --seed: tự chọn 3 hạt điểm cao nhất trong --do 1-200)
//   trận bóng (--luat tran) MẶC ĐỊNH dựng cả bản dọc 1080×1920 (<ten>-<seed>-reel.mp4 + to-<seed>-reel.jpg, cùng tiếng) — anh 28/11/2026 "luôn đăng 2 loại cùng lúc";
//   nạp bản dọc với dang.cap = slug bản ngang → máy đăng (puzzle-books nhip-an-toan › capCua) lên hai bản cùng lượt. --chi-ngang: bỏ bản dọc · --chi-reel: chỉ bản dọc · --reel: ép bản dọc
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moPhong, cham, LUAT } from './mo-phong.mjs';
import { tongHop } from './tieng.mjs';
import { tran, chamTran, LUAT_TRAN } from './tran.mjs';
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = dirname(fileURLToPath(import.meta.url));
const ra = arg('ra'); if (!ra) { console.error('thiếu --ra <thư-mục>'); process.exit(1); }
mkdirSync(ra, { recursive: true });
const song = arg('song', '2');
const TRAN = arg('luat') === 'tran', DOI = TRAN ? JSON.parse(readFileSync(arg('doi', join(DIR, 'tran-doi.json')), 'utf8')) : null;
const ghiLai = (s) => (TRAN ? tran(s, DOI, LUAT_TRAN) : moPhong(s, LUAT));
const diem = (g) => (TRAN ? chamTran(g) : cham(g));
const TRANG = TRAN ? 'tran.html' : 'vat-ly.html', TEN = TRAN ? 'tran' : 'vat-ly';
const CHI_REEL = process.argv.includes('--chi-reel'), REEL = CHI_REEL || process.argv.includes('--reel') || (TRAN && !process.argv.includes('--chi-ngang'));
if (REEL && !TRAN) { console.error('--reel hiện chỉ có khuôn cho --luat tran (vat-ly.html chưa có bố cục dọc)'); process.exit(1); }
// khuôn: [đuôi tên, rộng, cao]
const KHUON = [...(CHI_REEL ? [] : [['', 1920, 1080]]), ...(REEL ? [['-reel', 1080, 1920]] : [])];

let seeds = arg('seed')?.split(',').map(Number);
if (!seeds) {
  const [a, b] = arg('do', '1-200').split('-').map(Number), ds = [];
  for (let s = a; s <= b; s++) { const g = ghiLai(s); ds.push({ s, d: diem(g).diem }); }
  seeds = ds.sort((x, y) => y.d - x.d).slice(0, Number(arg('top', 3))).map((x) => x.s);
}

for (const s of seeds) {
  const t0 = Date.now();
  const g = ghiLai(s);
  if (g.xuyen) console.warn(`⚠ seed ${s}: ${g.xuyen} lần bóng xuyên tường`);
  const ghi = join(ra, `ghi-${s}.json`), tieng = join(ra, `tieng-${s}.wav`);
  writeFileSync(ghi, JSON.stringify(g));
  writeFileSync(tieng, tongHop(g));
  // trận bóng: chụp đúng các khoảnh khắc đáng soát (đá phạt, thẻ, phạt đền, phát lại, GOAL, bù giờ, nghỉ giữa hiệp, hết trận)
  const ev = (k, f = () => true) => g.suKien.find((e) => e.k === k && f(e));
  const mocTran = TRAN && [1.5, ev('loi', (e) => e.kieu === 'fk')?.t + 1.3, ev('the')?.t + 0.6, ev('tim')?.t, ev('ban')?.t + 0.7, (ev('replay')?.t ?? 0) + (ev('replay')?.dai ?? 0) / 2, ev('them')?.t + 1, ev('coi', (e) => e.loai === 'hiep')?.t + 2, ev('varDong')?.t + ev('varDong')?.dai * 0.8, ev('varKq')?.t + 0.8, ev('dau')?.t + 0.8, ev('cang')?.t + 1, ev('thay')?.t + 1, g.ketThuc.t + 1.2, g.ketThuc.t + 4.5].filter((x) => Number.isFinite(x)).map((x) => +x.toFixed(2));
  const moc = mocTran || [1.5, 4, 0.15, 0.35, 0.55, 0.7, 0.85, 0.95].map((x) => (x < 1 ? +(g.ketThuc.t * x).toFixed(1) : x)).concat([+(g.ketThuc.t - 1).toFixed(1), +(g.DAI - 2).toFixed(1)]);
  const raDs = [];
  for (const [duoi, rong, cao] of KHUON) {
    const hinh = join(ra, `hinh-${s}${duoi}.mp4`), mp4 = join(ra, `${TEN}-${s}${duoi}.mp4`), co = ['--rong', String(rong), '--cao', String(cao)];
    execFileSync('node', [join(DIR, '../shot-code/dung.mjs'), '--trang', TRANG, '--cau', ghi, '--ra', hinh, ...co, '--song', song], { cwd: DIR, stdio: 'inherit' });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', hinh, '-i', tieng, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', mp4]);
    execFileSync('node', [join(DIR, '../shot-code/dung.mjs'), '--trang', TRANG, '--cau', ghi, ...co, '--khung', moc.join(','), '--khung-ra', join(ra, `to-${s}${duoi}.jpg`)], { cwd: DIR, stdio: 'ignore' });
    rmSync(hinh); raDs.push(mp4);
  }
  rmSync(tieng); rmSync(ghi);
  const c = diem(g);
  console.log(`✓ seed ${s} · ${g.DAI.toFixed(0)} s · ${c.thang ?? c.tiSo} · điểm ${c.diem} · ${((Date.now() - t0) / 1000).toFixed(0)} s dựng → ${raDs.join(' + ')}`);
}
