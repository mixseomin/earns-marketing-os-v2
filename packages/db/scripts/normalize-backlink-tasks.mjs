#!/usr/bin/env node
// Phase-1 normalize (deterministic, content-preserving): make the meta-line format uniform across
// every existing backlink task — a final "Link:"/"Link đặt ở:" placement summary that lacks the 📍
// marker gets it, so the Steps renderer shows it in the emoji gutter (25/62 → uniform). It does NOT
// rewrite wording, fill placeholders, or split — those risk cross-project garbage. Deeper reshape of
// genuinely-thin instructions is the on-demand AI ✨ Chuẩn hoá (catalog-backed).
//   node normalize-backlink-tasks.mjs <tasks.json>  >  normalize.sql
import { readFileSync } from 'node:fs';

const tasks = JSON.parse(readFileSync(process.argv[2], 'utf8'));

function normalizeFormat(text) {
  if (!text) return text;
  return text.split('\n').map((line) => {
    const s = line.trimStart();
    if (/^Link( đặt ở)?\s*:/i.test(s) && !line.includes('📍')) return line.replace(/^(\s*)/, '$1📍 ');
    return line;
  }).join('\n');
}

const D = '$blnrm$';
function lit(v) { const s = String(v); if (s.includes(D)) throw new Error('delim in content'); return `${D}${s}${D}`; }

let sql = 'BEGIN;\n';
let changed = 0;
for (const t of tasks) {
  const orig = t.instructions;
  if (!orig) continue;
  const next = normalizeFormat(orig);
  if (next === orig) continue;
  sql += `UPDATE human_tasks SET instructions=${lit(next)}, updated_at=now() WHERE id=${t.id} AND platform_key='backlink';\n`;
  changed++;
}
sql += 'COMMIT;\n';
process.stdout.write(sql);
console.error(`format touch-ups: ${changed} / ${tasks.length}`);
