// Gác "TOKEN RƠI" (01/11/2026: số #N trên danh sách Shots gần như vô hình vì var(--fg) — token không khai): mọi var(--x) KHÔNG có giá trị dự phòng
// trong src phải trỏ vào token có khai — ở :root (src/app/xv.css) hoặc được gán lúc chạy qua style ('--x': …). Token không có = trình duyệt bỏ cả
// thuộc tính, màu rơi về mặc định (mờ / mất), không lỗi nào kêu. Chạy kèm `npm run typecheck`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const goc = new URL('../src', import.meta.url).pathname;
const tep = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? tep(p) : /\.(tsx|ts|css)$/.test(f) ? [p] : []; });
const ds = tep(goc).map((p) => ({ p, s: readFileSync(p, 'utf8') }));
const khai = new Set();
for (const { s } of ds) {
  for (const m of s.matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/gm)) khai.add(m[1]);            // khai trong CSS
  for (const m of s.matchAll(/['"](--[a-z0-9-]+)['"]\s*:/g)) khai.add(m[1]);                  // gán lúc chạy: style={{ '--x': … }}
  for (const m of s.matchAll(/setProperty\(\s*['"](--[a-z0-9-]+)['"]/g)) khai.add(m[1]);      // el.style.setProperty('--x', …)
}
const loi = [];
for (const { p, s } of ds) s.split('\n').forEach((dong, i) => {
  for (const m of dong.matchAll(/var\((--[a-z0-9-]+)\s*(,)?/g)) if (!m[2] && !khai.has(m[1])) loi.push(`${p.replace(goc, 'src')}:${i + 1}: ${m[1]}`);
});
if (loi.length) { console.error(`✗ ${loi.length} chỗ dùng token CSS không khai (khai ở :root của src/app/xv.css, hoặc thêm giá trị dự phòng var(--x, …)):\n${loi.join('\n')}`); process.exit(1); }
console.log('✓ mọi var(--token) đều có khai');
