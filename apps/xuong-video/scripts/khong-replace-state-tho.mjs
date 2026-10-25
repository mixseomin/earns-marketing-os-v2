// Gác lỗi "lúc nào cũng về tab đầu" (anh 25/10/2026): ghi URL bằng history.replaceState(window.history.state, …) mang cờ __NA của Next → router
// bỏ qua, lần gọi máy chủ kế tiếp Next ghi lại URL cũ, ?tab= / ?sbx= / ?m= mất. Mọi chỗ ghi tham số URL đi qua src/lib/ghi-url.ts › ghiThamSoUrl.
// Chạy kèm `npm run typecheck`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const goc = new URL('../src', import.meta.url).pathname;
const CHO_PHEP = [/lib\/ghi-url\.ts$/, /lib\/xuong-video\/ho-so\.ts$/];   // ho-so.ts: trang HTML tĩnh xuất ra ngoài, không có router Next
const tep = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? tep(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : []; });
const loi = [];
for (const p of tep(goc)) {
  if (CHO_PHEP.some((r) => r.test(p))) continue;
  readFileSync(p, 'utf8').split('\n').forEach((dong, i) => {
    const ma = dong.replace(/\/\/.*$/, '');
    if (/history\.(replaceState|pushState)\s*\(/.test(ma)) loi.push(`${p.replace(goc, 'src')}:${i + 1}: ${dong.trim().slice(0, 120)}`);
  });
}
if (loi.length) { console.error(`✗ ${loi.length} chỗ ghi history trực tiếp — dùng ghiThamSoUrl (src/lib/ghi-url.ts), không thì router Next ghi đè URL ở lần gọi máy chủ kế:\n${loi.join('\n')}`); process.exit(1); }
console.log('✓ mọi chỗ ghi URL đi qua ghiThamSoUrl');
