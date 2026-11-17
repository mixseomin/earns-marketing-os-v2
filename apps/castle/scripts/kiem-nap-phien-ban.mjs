#!/usr/bin/env node
// KIỂM NẠP THEO DẤU PHIÊN BẢN: trang castle nạp mã qua danh sách TEP trong mỗi trang HTML (./x.js?v=<ETag>) để vượt bộ đệm Cloudflare (zone on.tc
// giữ .js 30 ngày). Mô-đun được import mà KHÔNG có trong TEP thì nạp trần → người xem nhận bản cũ hàng tuần (17/11/2026: anhquanh.js mới, sửa
// lớp chồng lên không tới tay). Lệnh này đi đệ quy từ tệp gốc của mỗi trang, mọi import './x.js' phải nằm trong TEP của trang đó → thiếu thì thoát 1.
// Chạy cùng kiem-chu-thich (scripts/chung.mjs gọi trước mọi lượt đo / kiểm; trọng tài máy cũng qua đó).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TRANG = { 'neuschwanstein.html': 'ns.js', 'index.html': 'main.js' };
let loi = 0;
for (const [html, goc] of Object.entries(TRANG)) {
  const m = readFileSync(join(PUB, html), 'utf8').match(/const TEP = \[([^\]]*)\]/);
  if (!m) { console.error(`✗ ${html}: không thấy danh sách TEP`); loi++; continue; }
  const tep = new Set([...m[1].matchAll(/'([\w-]+\.js)'/g)].map((x) => x[1])), da = new Set(), cho = [goc];
  while (cho.length) {
    const f = cho.pop(); if (da.has(f) || !existsSync(join(PUB, f))) continue; da.add(f);
    for (const x of readFileSync(join(PUB, f), 'utf8').matchAll(/(?:from\s+|import\s*\(\s*)'\.\/([\w-]+\.js)'/g)) cho.push(x[1]);
  }
  const thieu = [...da].filter((f) => !tep.has(f));
  if (thieu.length) { console.error(`✗ ${html}: mô-đun được nạp nhưng thiếu trong TEP (nạp trần → bản cũ trong bộ đệm Cloudflare): ${thieu.join(', ')}`); loi++; }
}
if (loi) process.exit(1);
console.log(`✓ mọi mô-đun castle nạp theo dấu phiên bản (${Object.keys(TRANG).join(', ')})`);
