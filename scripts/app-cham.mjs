#!/usr/bin/env node
// App <thư mục> có bị lượt đổi này CHẠM không? — đọc danh sách tệp đổi từ stdin (một tệp mỗi dòng, hoặc "__HET__" = coi như chạm hết).
// Chạm = tệp nằm trong chính app, trong một packages/* mà package.json của app phụ thuộc (@mos2/*), hoặc package-lock.json.
// Thay cho các danh sách thư mục gõ tay ở GHA deploy.yml + deploy.sh: 18/10/2026 sửa @mos2/bang (bảng dùng chung) mà studio không
// build lại vì danh sách gõ tay chỉ có packages/(db|gop-y) — thêm package mới là phải nhớ sửa N chỗ. Giờ phụ thuộc đọc từ package.json.
//   git diff --name-only A B | node scripts/app-cham.mjs apps/xuong-video [--tru apps/cty/cong-ty/]   → exit 0 = chạm, 1 = không
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const goc = new URL('..', import.meta.url).pathname;
const [app, ...rest] = process.argv.slice(2);
if (!app) { console.error('dùng: app-cham.mjs apps/<app> [--tru <tiền tố>]'); process.exit(2); }
const tru = rest[0] === '--tru' ? rest[1] : undefined;

const goi = JSON.parse(readFileSync(join(goc, app, 'package.json'), 'utf8'));
const can = new Set(Object.keys({ ...goi.dependencies, ...goi.devDependencies }).filter((k) => k.startsWith('@mos2/')));
const tienTo = [`${app.replace(/\/$/, '')}/`, 'package-lock.json'];
for (const d of readdirSync(join(goc, 'packages'))) {
  const p = join(goc, 'packages', d, 'package.json');
  if (existsSync(p) && can.has(JSON.parse(readFileSync(p, 'utf8')).name)) tienTo.push(`packages/${d}/`);
}

const tep = readFileSync(0, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
const cham = tep.includes('__HET__') || tep.some((f) => (!tru || !f.startsWith(tru)) && tienTo.some((t) => f === t || f.startsWith(t)));
process.exit(cham ? 0 : 1);
