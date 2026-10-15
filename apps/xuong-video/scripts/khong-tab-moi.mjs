// Gác luật anh chốt 09/10/2026: bấm link trong studio KHÔNG được mở trang/tab khác — dùng drawer (moNgan) hoặc tải qua linkTai.
// Chạy kèm `npm run typecheck`. Tìm target="_blank" / window.open trong src (trừ chú thích).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const goc = new URL('../src', import.meta.url).pathname;
const tep = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? tep(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : []; });
// NGOẠI LỆ DUY NHẤT: link RA NGOÀI app (spy.on.tc, trang bán…) đi qua ui.tsx › LinkNgoai — đó mới là chỗ được target="_blank" (anh 15/10/2026:
// "link sang spy phải mở tab mới"). Link spy viết bằng <a> trần (cùng tab, mất ngăn đang mở) cũng bị bắt.
const loi = [], loiNgoai = [];
for (const p of tep(goc)) readFileSync(p, 'utf8').split('\n').forEach((dong, i) => {
  const ma = dong.replace(/\/\/.*$/, '');
  const laLinkNgoai = /ui\.tsx$/.test(p) && /\/\/ LinkNgoai\s*$/.test(dong);
  if (!laLinkNgoai && /target=["']_blank["']|window\.open\(/.test(ma)) loi.push(`${p.replace(goc, 'src')}:${i + 1}: ${dong.trim().slice(0, 120)}`);
  if (/<a\b[^>]*href=\{?(linkGocSpy|linkSpSpy)\(|<a\b[^>]*href=["']https?:\/\/spy\.on\.tc/.test(ma)) loiNgoai.push(`${p.replace(goc, 'src')}:${i + 1}: ${dong.trim().slice(0, 120)}`);
});
if (loi.length) { console.error(`✗ ${loi.length} chỗ mở tab mới — dùng moNgan({ loai: 'xem' | 'thu-vien' | 'so-chi-phi' }) hoặc linkTai(url); ra app khác thì <LinkNgoai>:\n${loi.join('\n')}`); process.exit(1); }
if (loiNgoai.length) { console.error(`✗ ${loiNgoai.length} link sang spy.on.tc bằng <a> trần (mở cùng tab, mất ngăn đang làm) — dùng <LinkNgoai>:\n${loiNgoai.join('\n')}`); process.exit(1); }
console.log('✓ không chỗ nào mở tab mới (link ngoài qua LinkNgoai)');
