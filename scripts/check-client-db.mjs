#!/usr/bin/env node
// Lưới: file 'use client' KHÔNG được kéo (trực tiếp hay gián tiếp) module chạy máy chủ — @mos2/db, postgres, fs. Next chỉ báo lúc
// `next build` (~1-2 phút, trên GHA) — 01/10/2026 màn hồ sơ /shop import @mos2/shop/ho-so (kèm hàm ghi DB) làm gãy bản dựng.
// Lần theo import CÓ GIÁ TRỊ (bỏ `import type`), dừng ở ranh 'use server' (server action gọi qua mạng, hợp lệ). Vài giây, chạy trước build.
// Tự kiểm: node scripts/check-client-db.mjs --tu-kiem
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const CAM = /^(@mos2\/db|postgres|fs|node:fs|node:child_process|child_process|next\/headers)$/;
const SHOP = JSON.parse(readFileSync('packages/shop/package.json', 'utf8')).exports;
const DB_PKG = 'packages/db/src';

function giaiDuong(tu, spec, app) {
  let goc = null;
  if (spec.startsWith('.')) goc = resolve(dirname(tu), spec);
  else if (spec.startsWith('@/')) goc = resolve(`apps/${app}/src`, spec.slice(2));
  else if (spec === '@mos2/shop' || spec.startsWith('@mos2/shop/')) {
    const k = spec === '@mos2/shop' ? '.' : `./${spec.slice('@mos2/shop/'.length)}`;
    return SHOP[k] ? resolve('packages/shop', SHOP[k]) : null;
  } else return null;   // gói ngoài khác: không lần
  for (const d of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (existsSync(goc + d) && statSync(goc + d).isFile()) return goc + d;
  return null;
}

/** Các import có giá trị trong một mã nguồn (bỏ `import type …` và `export type … from`). */
export function importGiaTri(src) {
  const ra = [];
  for (const m of src.matchAll(/^\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    if (m[2]) continue;
    const ve = m[3].trim();
    if (/^\{[^}]*\}$/.test(ve) && ve.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean).every((x) => x.startsWith('type '))) continue;
    ra.push(m[4]);
  }
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) ra.push(m[1]);
  return ra;
}

function timDuong(file, app, thay = new Set(), vet = []) {
  if (thay.has(file)) return null;
  thay.add(file);
  const src = readFileSync(file, 'utf8');
  if (vet.length && /^\s*['"]use server['"]/.test(src)) return null;
  for (const spec of importGiaTri(src)) {
    if (CAM.test(spec)) return [...vet, file, spec];
    const f = giaiDuong(file, spec, app);
    if (!f || f.includes(DB_PKG)) { if (f) return [...vet, file, spec]; continue; }
    const r = timDuong(f, app, thay, [...vet, file]);
    if (r) return r;
  }
  return null;
}

if (process.argv.includes('--tu-kiem')) {
  const t = (s) => importGiaTri(s).join(',');
  const ok = t(`import type { A } from './a';\nimport { type B } from './b';\nimport { c, type D } from './c';\nexport type { E } from './e';\nimport x from '@mos2/db';`) === './c,@mos2/db';
  if (!ok) { console.error('✗ tu-kiem check-client-db hỏng:', t(`import type { A } from './a';\nimport { type B } from './b';\nimport { c, type D } from './c';\nimport x from '@mos2/db';`)); process.exit(1); }
  console.log('check-client-db: tu-kiem ok');
  process.exit(0);
}

const loi = [];
for (const app of ['web', 'store']) {
  (function di(d) {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.next') di(p); continue; }
      if (!/\.tsx?$/.test(p)) continue;
      if (!/^\s*['"]use client['"]/.test(readFileSync(p, 'utf8'))) continue;
      const r = timDuong(resolve(p), app);
      if (r) loi.push(r.map((x) => x.replace(process.cwd() + '/', '')).join('\n      → '));
    }
  })(`apps/${app}/src`);
}
if (loi.length) {
  console.error(`✗ check-client-db: ${loi.length} file 'use client' kéo module máy chủ (DB/fs) — next build sẽ gãy:`);
  for (const l of loi) console.error('   ' + l);
  console.error('  → tách phần thuần (hằng/kiểu) ra file riêng không import DB; client chỉ import phần thuần hoặc `import type`.');
  process.exit(1);
}
console.log("✓ check-client-db: không file 'use client' nào kéo DB/fs");
