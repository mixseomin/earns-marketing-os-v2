// MÁY DỰNG FFMPEG trong Cloudflare Container (anh 21/10/2026: "mục đích là nhẹ tải, cần thì chạy song song, box3 chỉ gánh ít thôi").
// Nhận MỘT lệnh ffmpeg + tệp đầu vào, chạy, trả tệp ra. Không giữ gì giữa các lượt. Font đóng sẵn ở /fonts (chép từ apps/xuong-video/public/fonts).
//   POST /ffmpeg  { args: [...], files: { "<tên>": "<base64>" }, ra: "<tên tệp ra>" }   — trong args: @DIR@ = thư mục lượt, @FONTS@ = /fonts
//   GET  /        → "ok" (Worker kiểm container đã lên)
import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TEN_HOP_LE = /^[\w.-]{1,80}$/;   // tên tệp phẳng, không đường dẫn — chặn ../

http.createServer(async (req, res) => {
  if (req.method === 'GET') { res.end('ok'); return; }
  if (req.method !== 'POST' || req.url !== '/ffmpeg') { res.writeHead(404).end(); return; }
  const dir = await mkdtemp(path.join(tmpdir(), 'dung-'));
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const { args, files = {}, ra } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!Array.isArray(args) || !TEN_HOP_LE.test(String(ra))) throw new Error('thiếu args / tên tệp ra sai');
    for (const [ten, b64] of Object.entries(files)) { if (!TEN_HOP_LE.test(ten)) throw new Error(`tên tệp sai: ${ten}`); await writeFile(path.join(dir, ten), Buffer.from(b64, 'base64')); }
    const thay = args.map((a) => String(a).replaceAll('@DIR@', dir).replaceAll('@FONTS@', '/fonts'));
    const t = Date.now();
    await new Promise((ok, loi) => execFile('ffmpeg', thay, { timeout: 5 * 60_000, maxBuffer: 8 << 20 }, (e, _o, err) => (e ? loi(new Error((err || e.message).trim().split('\n').slice(-3).join(' | '))) : ok())));
    const mp4 = await readFile(path.join(dir, ra));
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'x-giay-dung': String((Date.now() - t) / 1000) }).end(mp4);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(`ffmpeg: ${e.message}`.slice(0, 2000));
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}).listen(8080, () => console.log('dung-video: nghe cổng 8080'));
