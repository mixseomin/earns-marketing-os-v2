import assert from 'node:assert';
import http from 'node:http';
import { docChuKhung, motLuc, LENH_TESS, VF_KHUNG } from './soi-chu';

// máy dựng giả: /soi trả TSV từng khung; url chứa "loi" → 500, "dang" → sai dạng
let nhan: { url?: string; giay: number[]; vf: string; tess: string[] } | null = null, khoaNhan = '', duong = '';
const sv = http.createServer(async (req, res) => { const c: Buffer[] = []; for await (const x of req) c.push(x as Buffer); nhan = JSON.parse(Buffer.concat(c).toString()); khoaNhan = String(req.headers['x-dung-khoa']); duong = String(req.url);
  if (nhan!.url!.includes('loi')) { res.writeHead(500).end('soi: hỏng'); return; }
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ khung: nhan!.url!.includes('dang') ? ['x'] : nhan!.giay.map((t, i) => (i === 1 ? null : `tsv ${t}`)) })); });
await new Promise<void>((ok) => sv.listen(0, ok));
process.env.DUNG_CF_URL = `http://127.0.0.1:${(sv.address() as { port: number }).port}/`; process.env.DUNG_CF_KHOA = 'k';
const giay = [0.1, 1.2, 2.4];

const a = await docChuKhung('https://img.on.tc/a.mp4', giay);
assert.ok(a.noi === 'cloudflare' && duong === '/soi' && khoaNhan === 'k', 'cloudflare trước, đúng đường + khoá');
assert.deepEqual(a.tsv, ['tsv 0.1', null, 'tsv 2.4'], 'TSV từng khung, null giữ chỗ khung hỏng');
assert.ok(nhan!.url === 'https://img.on.tc/a.mp4' && nhan!.vf === VF_KHUNG && nhan!.tess.join(' ') === LENH_TESS.join(' '), 'gửi url (không gửi tệp) + đúng tham số tesseract');

// cloudflare lỗi / trả sai dạng → tại box3 (url giả không đọc được → mọi khung null), cùng độ dài mảng
const b = await docChuKhung('https://img.on.tc/loi.mp4', giay);
assert.ok(b.noi === 'box3' && /500/.test(b.loiCf!) && b.tsv.length === 3, 'cloudflare 500 → tại box3, giữ lý do');
const c = await docChuKhung('https://img.on.tc/dang.mp4', giay);
assert.ok(c.noi === 'box3' && /sai dạng/.test(c.loiCf!), 'cloudflare trả sai số khung → tại box3');
delete process.env.DUNG_CF_URL;
assert.equal((await docChuKhung('https://img.on.tc/a.mp4', [0.1])).noi, 'box3', 'không cấu hình → tại chỗ');

// tại chỗ: mỗi lúc MỘT việc
let dang = 0, dinh = 0;
await Promise.all([1, 2, 3, 4].map(() => motLuc(async () => { dang++; dinh = Math.max(dinh, dang); await new Promise((r) => setTimeout(r, 20)); dang--; })));
assert.equal(dinh, 1, 'tesseract tại chỗ chạy từng cái một');
await motLuc(async () => { throw new Error('x'); }).catch(() => {}); await motLuc(async () => 1);   // một lượt lỗi không kẹt hàng
sv.close();
console.log('✓ soi-chu: cloudflare trước (url + tham số) · 500 / sai dạng / không cấu hình → tại box3 · tại chỗ một tesseract một lúc');
