#!/usr/bin/env node
/* LUẬT: không tệp nào trong repo được ssh box1 (5.78.65.158) để làm việc MOS2.
 *
 * Vì sao có tệp này. MOS2 (app + DB) chuyển sang box3 167.233.241.16 từ 05/08/2026. box1 vẫn còn bản cũ ở
 * /opt/earns-marketing-os-v2 (mos2-web inactive, thiếu script mới) và vẫn trả lời :3821 qua đường hầm. Hai tháng
 * sau, /tasks-mos2 của repo vẫn `ssh root@5.78.65.158 …/gop-y.sh` → "No such file" → các phiên đọc thành "MOS2
 * chết" (09/10/2026). CLAUDE.md + contexts còn dạy rsync/psql lên box1. Không gì báo, vì lệnh trông đúng.
 *
 * Máy canh: quét mọi tệp git đang theo dõi, đỏ khi một dòng vừa có `5.78.65.158` vừa nhắc MOS2
 * (earns-marketing-os-v2 · mos2_prod · mos2-web · :3821 · gop-y) — trừ dòng tự nói rõ box1 KHÔNG còn chạy MOS2.
 *   node scripts/check-mos2-host.mjs            → kiểm repo
 *   node scripts/check-mos2-host.mjs --tu-kiem  → tự kiểm luật (bắt đúng ca hỏng, tha đúng ca cảnh báo)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BOX1 = /5\.78\.65\.158/;
const MOS2 = /earns-marketing-os-v2|mos2_prod|mos2-web|:3821|gop-y/;
const MIEN = /KHÔNG còn|không còn|NOT MOS2|đồ sót|bản cũ/;   // dòng cảnh báo về box1 — được phép
export const dongSai = (dong) => BOX1.test(dong) && MOS2.test(dong) && !MIEN.test(dong);

if (process.argv.includes('--tu-kiem')) {
  const ca = [
    ['S="ssh root@5.78.65.158 /opt/earns-marketing-os-v2/scripts/gop-y.sh"', true],
    ["ssh root@5.78.65.158 'systemctl status mos2-web'", true],
    ['ssh root@167.233.241.16 /opt/earns-marketing-os-v2/scripts/gop-y.sh', false],
    ['box1 `5.78.65.158` KHÔNG còn chạy MOS2, chỉ còn bản cũ ở /opt/earns-marketing-os-v2', false],
    ["ssh root@5.78.65.158 'node /opt/cgg-report/gsc-review.mjs x'", false],
  ];
  const sai = ca.filter(([d, mong]) => dongSai(d) !== mong);
  if (sai.length) { console.error('check-mos2-host tự kiểm SAI:', sai); process.exit(1); }
  console.log(`check-mos2-host tự kiểm: ${ca.length}/${ca.length} ok`);
  process.exit(0);
}

const tep = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n')
  .filter((f) => f && !f.startsWith('scripts/check-mos2-host.mjs') && /\.(md|mjs|js|ts|tsx|sh|yml|yaml|json|sql)$/.test(f));
const loi = [];
for (const f of tep) {
  let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
  if (!BOX1.test(s)) continue;
  s.split('\n').forEach((d, i) => { if (dongSai(d)) loi.push(`${f}:${i + 1}: ${d.trim().slice(0, 140)}`); });
}
if (loi.length) {
  console.error(`✗ check-mos2-host: ${loi.length} dòng còn ssh box1 cho MOS2 — MOS2 ở box3 167.233.241.16:\n  ${loi.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ check-mos2-host: ${tep.length} tệp, không dòng nào trỏ MOS2 về box1`);
