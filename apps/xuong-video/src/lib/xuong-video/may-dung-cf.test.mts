import assert from 'node:assert';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { doiDuongDan, dungFfmpeg } from './may-dung-cf';

// đổi đường dẫn: cả tham số trần lẫn giữa chuỗi filter
assert.deepEqual(doiDuongDan(['-i', '/tmp/x-1/nen.jpg', '-vf', 'ass=/tmp/x-1/de.ass:fontsdir=/opt/f', '/tmp/x-1/ra.mp4'], '/tmp/x-1', '/opt/f'),
  ['-i', '@DIR@/nen.jpg', '-vf', 'ass=@DIR@/de.ass:fontsdir=@FONTS@', '@DIR@/ra.mp4']);

const thuMuc = await mkdtemp(path.join(tmpdir(), 'cf-test-')), ra = path.join(thuMuc, 'ra.mp4');
await writeFile(path.join(thuMuc, 'de.ass'), 'phu de'); await writeFile(path.join(thuMuc, 'nen.jpg'), 'anh');
let nhan: { args: string[]; files: Record<string, string>; ra: string } | null = null, khoaNhan = '';
const sv = http.createServer(async (req, res) => { const c: Buffer[] = []; for await (const x of req) c.push(x as Buffer); nhan = JSON.parse(Buffer.concat(c).toString()); khoaNhan = String(req.headers['x-dung-khoa']);
  if (nhan!.args.includes('LOI')) { res.writeHead(500).end('ffmpeg: hỏng'); return; } res.writeHead(200, { 'x-giay-dung': '7.5' }).end(Buffer.alloc(20_000, 1)); });
await new Promise<void>((ok) => sv.listen(0, ok));
process.env.DUNG_CF_URL = `http://127.0.0.1:${(sv.address() as { port: number }).port}`; process.env.DUNG_CF_KHOA = 'k';
const dem = { taiCho: 0 }, soTaiCho = (): number => dem.taiCho; const chayTaiCho = async () => { dem.taiCho++; await writeFile(ra, 'tai cho'); };

const a = await dungFfmpeg(['-i', `${thuMuc}/nen.jpg`, ra], { thuMuc, fontsDir: '/f', ra, chayTaiCho });
assert.ok(a.noi === 'cloudflare' && a.giay === 7.5 && soTaiCho() === 0, 'cloudflare dựng → không chạy tại chỗ');
assert.deepEqual(Object.keys(nhan!.files).sort(), ['de.ass', 'nen.jpg'], 'gửi đủ tệp đầu vào, không gửi tệp ra');
assert.ok(nhan!.args[1] === '@DIR@/nen.jpg' && nhan!.ra === 'ra.mp4' && khoaNhan === 'k');
assert.equal((await readFile(ra)).length, 20_000, 'MP4 trả về ghi đúng chỗ');

const b = await dungFfmpeg(['LOI', ra], { thuMuc, fontsDir: '/f', ra, chayTaiCho });
assert.ok(b.noi === 'box3' && soTaiCho() === 1 && /500/.test(b.loiCf!), 'cloudflare lỗi → dựng tại box3, giữ lý do');

delete process.env.DUNG_CF_URL;
const c = await dungFfmpeg(['-x', ra], { thuMuc, fontsDir: '/f', ra, chayTaiCho });
assert.ok(c.noi === 'box3' && soTaiCho() === 2, 'không cấu hình → tại chỗ như cũ');
sv.close(); await rm(thuMuc, { recursive: true });
console.log('✓ may-dung-cf: đổi đường dẫn · gửi đầu vào + nhận MP4 · lỗi → dựng tại box3 · không cấu hình → tại chỗ');
