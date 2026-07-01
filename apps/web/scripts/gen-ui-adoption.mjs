// Adoption count cho Design System: đếm số file .tsx (ngoài components/ui) dùng mỗi primitive
// như JSX tag (<Name ...). Ghi ui-adoption.json → panel import. Regenerate: node scripts/gen-ui-adoption.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const idx = readFileSync(join(root, 'components/ui/index.ts'), 'utf8');
const names = [...idx.matchAll(/export\s*\{([^}]*)\}/g)]
  .flatMap((m) => m[1].split(','))
  .map((s) => s.trim())
  .filter((s) => /^[A-Z][A-Za-z0-9]+$/.test(s));   // PascalCase value exports (bỏ `type X`, lowercase helpers)
const comps = [...new Set(names)];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!p.includes(join('components', 'ui'))) walk(p, acc); }
    else if (e.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}
const files = walk(root).map((f) => readFileSync(f, 'utf8'));
const count = {};
for (const c of comps) {
  const re = new RegExp(`<${c}[\\s/>]`);
  count[c] = files.filter((src) => re.test(src)).length;
}
writeFileSync(join(root, 'components/architecture/ui-adoption.json'), JSON.stringify(count) + '\n');
console.log('ui-adoption written:', count);
