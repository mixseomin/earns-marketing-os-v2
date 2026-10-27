#!/usr/bin/env node
// Gác: history.replaceState/pushState trong app KHÔNG được truyền history.state (anh 27/10/2026 "deploy là page nhảy về trang trước, sửa 10000 lần").
// Next ≥ 14.1 vá hai hàm này: state mang dấu __NA của Next (chính là window.history.state) → Next coi là lệnh nội bộ, BỎ QUA đồng bộ URL
// → bộ định tuyến giữ URL lúc mở trang → sau deploy lượt router.refresh tải cứng theo URL CŨ. Đúng: truyền null (Next tự chép state nội bộ).
// Chạy trong deploy (GHA + deploy.sh) trước build. Tự kiểm: node scripts/check-replace-state.mjs --tu-kiem
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const SAI = /\b(?:replaceState|pushState)\(\s*(?:window\.)?history\.state\s*,/;
if (process.argv.includes('--tu-kiem')) {
  const ok = [`history.replaceState(history.state, '', u)`, `window.history.pushState(window.history.state,'',x)`].every((s) => SAI.test(s))
    && ![`history.replaceState(null, '', u)`, `originalReplaceState(data, _u, url)`].some((s) => SAI.test(s));
  console.log(ok ? 'tự kiểm đạt' : 'tự kiểm HỎNG'); process.exit(ok ? 0 : 1);
}
const loi = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.next') walk(p); }
  else if (/\.(tsx?|mts|js)$/.test(p)) readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (SAI.test(l)) loi.push(`${p}:${i + 1}`); }); } };
for (const r of ['apps/web/src', 'packages']) walk(r);
if (loi.length) { console.error(`✗ replaceState/pushState truyền history.state (Next bỏ qua đồng bộ URL → deploy nhảy trang) — đổi thành null:\n  ${loi.join('\n  ')}`); process.exit(1); }
console.log('✓ replaceState guard: sạch');
