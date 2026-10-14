#!/usr/bin/env node
// Danh sách màn cho mọi máy đo giao diện (sat-vien.mjs, thang-hang.mjs) — MỘT bản. Trước 12/10/2026 mỗi máy đo giữ một danh sách
// riêng, lệch nhau, màn mới phải nhớ thêm tay vào từng nơi. `--tu-kiem`: mọi route có page.tsx trong src/app phải có ít nhất một màn ở đây.
import fs from 'node:fs';
import path from 'node:path';

export const TRANG = ['/', '/?ngan=nhan-su:tam', '/?ngan=phong:thu-nghiem', '/phong/thu-nghiem', '/phong/sach', `/sach/sach/390f5948-475b-48d4-b1be-5771738e571d`, '/the/1107', '/nhip/kien/kiem-thu', '/nhan-su?ngan=nhip:kien/diem-danh', '/video/sach/halloween-word-search-an', '/day-chuyen/sach/sach/lich', '/nhan-su', '/nhan-su/hung', '/nhan-su/tam',
  '/nhan-su/ky', '/quy-trinh', '/quy-trinh/thu-nghiem/lam-viec', '/nhat-ky', '/luat', '/muc-tieu'];

if ((process.argv[1] || '').endsWith('trang-do.mjs') && process.argv.includes('--tu-kiem')) {
  const APP = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'app');
  const route = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? route(path.join(d, e.name)) : e.name === 'page.tsx' ? [path.relative(APP, d)] : []));
  const mau = (r) => new RegExp(`^/${r.split(path.sep).filter(Boolean).map((p) => (p.startsWith('[...') ? '.+' : p.startsWith('[') ? '[^/]+' : p)).join('/')}$`.replace('^//', '^/'));
  const thieu = route(APP).filter((r) => !TRANG.some((t) => mau(r).test(t.split('?')[0])));
  if (thieu.length) { console.error(`✗ trang-do: màn chưa có trong máy đo giao diện: ${thieu.map((r) => `/${r}`).join(', ')}`); process.exit(1); }
  console.log(`✓ trang-do: ${route(APP).length} route đều có màn đo`); process.exit(0);
}
