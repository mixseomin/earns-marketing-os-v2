// MÁY DỰNG FFMPEG trong Cloudflare Container (anh 21/10/2026: "mục đích là nhẹ tải, cần thì chạy song song, box3 chỉ gánh ít thôi").
// Nhận MỘT lệnh ffmpeg + tệp đầu vào, chạy, trả tệp ra. Không giữ gì giữa các lượt. Font đóng sẵn ở /fonts (chép từ apps/xuong-video/public/fonts).
//   POST /ffmpeg  { args: [...], files: { "<tên>": "<base64>" }, ra: "<tên tệp ra>" }   — trong args: @DIR@ = thư mục lượt, @FONTS@ = /fonts
//   POST /soi     { url | mp4(base64), giay: [s...], vf: "scale=720:-2", tess: [...] } → { khung: [tsv | null, ...] } — soi chữ lạ trong clip
//                 (apps/xuong-video soi-chu.ts): tải clip MỘT lần, cắt mọi khung + tesseract song song (anh 26/10/2026: nhẹ tải box3)
//   GET  /        → "ok" (Worker kiểm container đã lên)
import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TEN_HOP_LE = /^[\w.-]{1,80}$/;   // tên tệp phẳng, không đường dẫn — chặn ../
const chay = (cmd, args, timeout = 60_000, env) => new Promise((ok) => execFile(cmd, args, { encoding: 'buffer', maxBuffer: 1 << 26, timeout, env }, (e, b) => ok(e ? null : b)));
const THAM_SO = (a) => Array.isArray(a) && a.length <= 20 && a.every((x) => typeof x === 'string' && x.length <= 40 && !x.startsWith('/'));

/** Soi chữ: TSV thô từng giây trong `giay` (null = khung không cắt / không đọc được) — cùng dạng đường tại chỗ của studio. */
async function soi(dir, { url, mp4, giay, vf, tess }) {
  if (!Array.isArray(giay) || !giay.length || giay.length > 40 || !giay.every((t) => Number.isFinite(t) && t >= 0)) throw new Error('giay sai');
  if (typeof vf !== 'string' || !/^[\w:=,.-]{1,60}$/.test(vf) || !THAM_SO(tess)) throw new Error('vf / tess sai');
  const clip = path.join(dir, 'clip.mp4');
  if (mp4) await writeFile(clip, Buffer.from(mp4, 'base64'));
  else if (/^https?:\/\//.test(String(url))) { const r = await fetch(url, { signal: AbortSignal.timeout(60_000) }); if (!r.ok) throw new Error(`tải clip ${r.status}`); await writeFile(clip, Buffer.from(await r.arrayBuffer())); }
  else throw new Error('thiếu url / mp4');
  const env = { ...process.env, OMP_THREAD_LIMIT: '1' };   // nhiều tesseract song song: mỗi cái một luồng
  return Promise.all(giay.map(async (t, i) => {
    const png = path.join(dir, `${i}.png`);
    if (!(await chay('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', clip, '-frames:v', '1', '-vf', vf, png]))) return null;
    const b = await chay('tesseract', [png, 'stdout', ...tess], 60_000, env);
    return b ? b.toString('utf8') : null;
  }));
}

http.createServer(async (req, res) => {
  if (req.method === 'GET') { res.end('ok'); return; }
  if (req.method !== 'POST' || (req.url !== '/ffmpeg' && req.url !== '/soi')) { res.writeHead(404).end(); return; }
  const dir = await mkdtemp(path.join(tmpdir(), 'dung-'));
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    if (req.url === '/soi') {
      const t = Date.now(), khung = await soi(dir, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      res.writeHead(200, { 'content-type': 'application/json', 'x-giay-dung': String((Date.now() - t) / 1000) }).end(JSON.stringify({ khung }));
      return;
    }
    const { args, files = {}, ra } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!Array.isArray(args) || !TEN_HOP_LE.test(String(ra))) throw new Error('thiếu args / tên tệp ra sai');
    for (const [ten, b64] of Object.entries(files)) { if (!TEN_HOP_LE.test(ten)) throw new Error(`tên tệp sai: ${ten}`); await writeFile(path.join(dir, ten), Buffer.from(b64, 'base64')); }
    const thay = args.map((a) => String(a).replaceAll('@DIR@', dir).replaceAll('@FONTS@', '/fonts'));
    const t = Date.now();
    await new Promise((ok, loi) => execFile('ffmpeg', thay, { timeout: 5 * 60_000, maxBuffer: 8 << 20 }, (e, _o, err) => (e ? loi(new Error((err || e.message).trim().split('\n').slice(-3).join(' | '))) : ok())));
    const mp4 = await readFile(path.join(dir, ra));
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'x-giay-dung': String((Date.now() - t) / 1000) }).end(mp4);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(`${req.url === '/soi' ? 'soi' : 'ffmpeg'}: ${e.message}`.slice(0, 2000));
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}).listen(8080, () => console.log('dung-video: nghe cổng 8080'));
