// Gác luật anh 17/10/2026 (#1404 "Luôn phải dùng select2"): mọi ô chọn trong studio là components/chon.tsx › Chon (tìm được, nhóm, mô tả khi rê).
// <select> thô của trình duyệt không tìm được và lệch giao diện — trước đây còn 11 chỗ, kể cả một bản sao `function Chon` bọc <select> trong kho-concept-ui.
// Chạy kèm `npm run typecheck`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const goc = new URL('../src', import.meta.url).pathname;
const tep = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? tep(p) : /\.(tsx|jsx)$/.test(f) ? [p] : []; });
const loi = [];
for (const p of tep(goc)) readFileSync(p, 'utf8').split('\n').forEach((dong, i) => {
  const ma = dong.replace(/\/\/.*$/, '');
  if (/<select\b/.test(ma) || (/^\s*(export\s+)?function\s+Chon\b/.test(ma) && !/components\/chon\.tsx$/.test(p))) loi.push(`${p.replace(goc, 'src')}:${i + 1}: ${dong.trim().slice(0, 120)}`);
});
if (loi.length) { console.error(`✗ ${loi.length} ô chọn không qua Chon (components/chon.tsx) — dùng <Chon options={…} /> (nho / nut / multi khi cần):\n${loi.join('\n')}`); process.exit(1); }
console.log('✓ mọi ô chọn đi qua Chon');
