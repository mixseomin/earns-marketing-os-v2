#!/usr/bin/env node
// Lưới: TAB CẤP TRANG phải lên MENU (anh chốt 01/10/2026). Tab ghi URL = <Tabs … hrefFor=…>; file nào dựng thanh tab như thế mà
// không đọc sổ apps/web/src/lib/tab-trang.ts (tabCua / hrefTab / TAB_TRANG) là đang gõ tay nhãn tab — sidebar không biết tab đó
// tồn tại, menu thiếu mục. Chạy ở GHA + deploy.sh trước build, nên chat nào thêm trang mới cũng không lọt.
// Tự kiểm: node scripts/check-tab-trang.mjs --tu-kiem
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/web/src';
const DOC_SO = /\b(tabCua|hrefTab|TAB_TRANG)\b|lib\/tab-trang/;

export function vietPham(src) {
  // <Tabs …> tới dấu đóng thẻ đầu tiên chứa hrefFor= → thanh tab ghi URL
  const the = src.match(/<Tabs\b[\s\S]*?\/>/g) ?? [];
  return the.some((t) => /\bhrefFor=/.test(t)) && !DOC_SO.test(src);
}

if (process.argv.includes('--tu-kiem')) {
  const sai = `<Tabs value={t} onChange={setT} hrefFor={(k) => '/x?tab=' + k} items={[{ key: 'a', label: 'A' }]} />`;
  const dung = `import { tabCua } from '@/lib/tab-trang';\n<Tabs value={t} onChange={setT} hrefFor={(k) => hrefTab('/x', k)} items={tabCua('/x')} />`;
  const noiBo = `<Tabs value={t} onChange={setT} items={[{ key: 'a', label: 'A' }]} />`;
  if (!vietPham(sai) || vietPham(dung) || vietPham(noiBo)) { console.error('✗ tu-kiem check-tab-trang hỏng'); process.exit(1); }
  console.log('check-tab-trang: tu-kiem 3/3 ok');
  process.exit(0);
}

const loi = [];
(function di(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.next') di(p); }
    else if (p.endsWith('.tsx') && vietPham(readFileSync(p, 'utf8'))) loi.push(p);
  }
})(ROOT);
if (loi.length) {
  console.error('✗ Tab cấp trang (<Tabs hrefFor>) không khai trong apps/web/src/lib/tab-trang.ts — menu sẽ thiếu mục:');
  for (const f of loi) console.error('   ' + f);
  console.error('  → thêm trang vào TAB_TRANG, dựng items bằng tabCua(), link bằng hrefTab(). Sidebar tự sinh mục con.');
  process.exit(1);
}
console.log('✓ check-tab-trang: mọi tab cấp trang đều nằm trong sổ menu');
