// DỰNG CẢNH TỪ VIDEO TỪNG SHOT (quy trình làm mới, bước cuối — 0đ, ffmpeg). Mỗi shot lấy tệp đầu tiên có trong thư mục khung theo thứ tự:
// noi-<N>c.mp4 · noi-<N>.mp4 (thoại khớp môi, giữ tiếng) · clip-<N>.mp4 (khoá đầu + cuối) · tinh-<N>.mp4 (shot tĩnh) · vx-<N>.mp4 (VideoExpress qua br, vx-lay.mts — có tiếng native) · so-<N>.mp4 (video-tu-khung).
// Cắt đúng giây phát (shot thoại: trọn câu), bỏ 0,2 giây đầu clip Vidu (khung đứng yên), phụ đề cháy cứng (thoại + lời kể), lời kể từ <bảng>.am.json,
// tiếng hiệu ứng theo trường sfx (public/sfx), loá trắng kết cảnh.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dung-tu-video.mts \
//     --bang=scripts/so-do/thang-may-356.json --khung=/tmp/khung-356 --ra=/tmp/thang-may-356.mp4
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tepBang = gia('bang')!, thu = gia('khung')!, ra = gia('ra') ?? '/tmp/canh.mp4';
if (!tepBang || !thu) { console.error('cần --bang --khung'); process.exit(1); }
type S = { so: number; giay: number; thoai?: string; ke?: string; sfx?: string; dien?: string };
const b = JSON.parse(readFileSync(tepBang, 'utf8')) as { shot: S[] };
const nho: Record<string, string> = existsSync(`${tepBang}.am.json`) ? JSON.parse(readFileSync(`${tepBang}.am.json`, 'utf8')) : {};
const tam = `${thu}/dung`; mkdirSync(tam, { recursive: true });
const FONT = new URL('./font/DejaVuSans-Bold.ttf', import.meta.url).pathname;
const sh = (args: string[]) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const dai = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const coTieng = (f: string) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f]).toString().trim() !== '';
const tai = (u: string, f: string) => { if (!existsSync(f)) execFileSync('curl', ['-sfL', '-o', f, u]); return f; };
const ngat = (t: string, n = 26) => { const o: string[] = []; let d = ''; for (const w of t.split(/\s+/)) { if ((d + ' ' + w).trim().length > n) { o.push(d); d = w; } else d = `${d} ${w}`.trim(); } if (d) o.push(d); return o; };

const doan: string[] = []; const keTren: { tu: number; f: string }[] = []; let moc = 0;
for (const [i, s] of b.shot.entries()) {
  const tep = [`noi-${s.so}c`, `noi-${s.so}`, `clip-${s.so}`, `tinh-${s.so}`, `vx-${s.so}`, `so-${s.so}`].map((x) => `${thu}/${x}.mp4`).find(existsSync);
  if (!tep) { console.log(`#${s.so}: thiếu video — bỏ`); continue; }
  const thoai = /\/noi-/.test(tep), dTep = dai(tep);
  const vao = thoai || /\/(tinh|clip)-/.test(tep) ? 0 : Math.min(0.2, Math.max(0, dTep - s.giay));
  // độ dài làm tròn ĐÚNG số khung (24/giây) — hình và tiếng cùng một con số; tiếng 48 kHz = đúng 2.000 mẫu / khung (44,1 kHz lẻ 1.837,5)
  let d = Math.round((thoai ? dTep : Math.min(s.giay, dTep - vao)) * 24) / 24;
  const cuoi = i === b.shot.length - 1;
  const sub = s.thoai ?? (s.ke ? s.ke.replace(/\s*\(nháp\)\s*$/, '') : '');
  const ve = ngat(sub).map((t, k, a) => `drawtext=fontfile=${FONT}:text='${t.replace(/[':\\]/g, (c) => `\\${c}`)}':fontcolor=white:fontsize=40:borderw=4:bordercolor=black:x=(w-tw)/2:y=h*0.80-${(a.length - 1 - k) * 50}`).join(',');
  const loa = cuoi ? `,fade=t=out:st=${Math.max(0, d - 0.45).toFixed(2)}:d=0.45:color=white` : '';
  const v = `${tam}/v-${s.so}.mp4`;
  sh(['-ss', vao.toFixed(2), '-t', d.toFixed(2), '-i', tep, '-vf', `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24,tpad=stop_mode=clone:stop_duration=2${ve ? `,${ve}` : ''}${loa},format=yuv420p`, '-t', d.toFixed(4), '-an', v]);   // clip nguồn ngắn hơn d → giữ khung cuối cho đủ (hình = tiếng)
  d = Math.round(dai(v) * 24) / 24;   // độ dài THẬT của đoạn hình vừa dựng — tiếng lấy đúng con số này (clip nguồn ngắn hơn thì hình đã giữ khung cuối)
  // tiếng: thoại (giữ tiếng clip) + lời kể + hiệu ứng, trên nền lặng đúng d giây
  const vaoTieng: string[] = []; const loc: string[] = [];
  if (thoai && coTieng(tep)) { vaoTieng.push('-ss', vao.toFixed(2), '-t', d.toFixed(2), '-i', tep); loc.push(`[${loc.length + 1}:a]anull`); }   // nhánh trơn phải có tên bộ lọc
  // LỜI KỂ không cắt theo shot (câu kể dài hơn shot thì tràn sang shot sau — L-cut): ghi mốc giây, trộn lên dòng thời gian chung ở cuối
  const ke = s.ke ? nho[s.ke.replace(/\s*\(nháp\)\s*$/, '')] : null; if (ke) keTren.push({ tu: moc + 0.1, f: tai(ke, `${tam}/ke-${s.so}.mp3`) });
  const sfx = s.sfx ? new URL(`../public/sfx/${s.sfx}.mp3`, import.meta.url).pathname : null; if (sfx && existsSync(sfx)) { vaoTieng.push('-i', sfx); loc.push(`[${loc.length + 1}:a]volume=0.5`); }
  const a = `${tam}/a-${s.so}.wav`;
  const fc = loc.map((x, k) => `${x}[t${k}];`).join('') + `[0:a]${loc.map((_, k) => `[t${k}]`).join('')}amix=inputs=${loc.length + 1}:duration=first:normalize=0[a]`;
  sh(['-f', 'lavfi', '-t', d.toFixed(4), '-i', 'anullsrc=r=48000:cl=stereo', ...vaoTieng, '-filter_complex', fc, '-map', '[a]', '-t', d.toFixed(4), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', a]);   // MỌI đoạn cùng định dạng — khác kênh / kiểu mẫu thì nối kiểu chép đếm sai độ dài (mất 5,1 giây, 27/10/2026)
  doan.push(`${v}|${a}`); moc += d;
  console.log(`#${s.so} ${d.toFixed(2)}s ← ${tep.split('/').pop()}`);
}
// NỐI: hình nối riêng (đã cùng mã), tiếng nối riêng ở dạng PCM (wav — không có khung đệm đầu như AAC) rồi mới ghép một lần. 27/10/2026: mỗi đoạn mã AAC riêng
// rồi nối → mỗi đoạn thêm vài chục ms đệm, 29 đoạn trôi ~1,6 giây → giọng đè sang shot người khác, miệng không khớp tiếng.
writeFileSync(`${tam}/v.txt`, doan.map((x) => `file '${x.split('|')[0]}'`).join('\n')); writeFileSync(`${tam}/a.txt`, doan.map((x) => `file '${x.split('|')[1]}'`).join('\n'));
sh(['-f', 'concat', '-safe', '0', '-i', `${tam}/v.txt`, '-c', 'copy', `${tam}/hinh.mp4`]);
sh(['-f', 'concat', '-safe', '0', '-i', `${tam}/a.txt`, '-c', 'copy', `${tam}/tieng.wav`]);
const tieng = keTren.length ? `${tam}/tieng-ke.wav` : `${tam}/tieng.wav`;
if (keTren.length) sh(['-i', `${tam}/tieng.wav`, ...keTren.flatMap((k) => ['-i', k.f]), '-filter_complex', `${keTren.map((k, j) => `[${j + 1}:a]aresample=48000,adelay=${Math.round(k.tu * 1000)}|${Math.round(k.tu * 1000)}[k${j}];`).join('')}[0:a]${keTren.map((_, j) => `[k${j}]`).join('')}amix=inputs=${keTren.length + 1}:duration=first:normalize=0[a]`, '-map', '[a]', tieng]);
sh(['-i', `${tam}/hinh.mp4`, '-i', tieng, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '19', '-c:a', 'aac', '-movflags', '+faststart', ra]);
// TỰ KIỂM: tiếng và hình phải dài bằng nhau (lệch > 1 khung = có đoạn trôi)
const lech = Math.abs(dai(`${tam}/tieng.wav`) - dai(`${tam}/hinh.mp4`)); console.log(`lệch tiếng/hình: ${(lech * 1000).toFixed(0)} ms${lech > 1 / 24 ? ' ⚠ QUÁ 1 KHUNG' : ''} · tổng mốc ${moc.toFixed(2)}s`);
console.log(ra, `${dai(ra).toFixed(1)}s`, `${doan.length} shot`);
