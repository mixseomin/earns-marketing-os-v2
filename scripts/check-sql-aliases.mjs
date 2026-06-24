#!/usr/bin/env node
// Guard: raw-SQL column aliases with an uppercase letter MUST be double-quoted.
// Postgres folds an UNQUOTED identifier to lowercase, so `... AS fooBar` comes back as
// key `foobar`; code reading `row['fooBar']` then gets undefined (silent null in the UI).
// This bit the Studio __missingSel column (2026-06-24). Runs in deploy.sh BEFORE build so a
// brand-new change can never reintroduce it regardless of who (or which chat) wrote the code.
//
// Scope: only text INSIDE sql`...` tagged template literals → no false positives on plain strings.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps/web/src', 'packages'];
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p); }
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) scan(p);
  }
}

function scan(file) {
  const src = readFileSync(file, 'utf8');
  // find each sql` ... ` block (naive close on next backtick — good enough for alias scanning)
  const re = /\bsql`/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const end = src.indexOf('`', start);
    if (end === -1) break;
    const block = src.slice(start, end);
    // AS <ident> where ident is UNQUOTED and contains an uppercase letter
    const aliasRe = /\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    let a;
    while ((a = aliasRe.exec(block))) {
      const ident = a[1];
      // quoted alias? the char right before the ident inside the original block run is handled by
      // requiring the captured ident NOT be preceded by a quote — re-check the raw match window.
      const beforeIdx = a.index + a[0].length - ident.length - 1;
      const prevChar = block[beforeIdx];
      if (prevChar === '"') continue;                 // already quoted → safe
      if (!/[A-Z]/.test(ident)) continue;             // all-lowercase → Postgres-safe
      const line = src.slice(0, start + a.index).split('\n').length;
      violations.push(`${file}:${line}  AS ${ident}  → must be  AS "${ident}"`);
    }
  }
}

for (const r of ROOTS) { try { walk(r); } catch { /* root absent */ } }

if (violations.length) {
  console.error('\n✗ Unquoted camelCase SQL aliases (Postgres lowercases them → row read returns null):\n');
  for (const v of violations) console.error('  ' + v);
  console.error('\nFix: double-quote the alias, e.g.  AS "fooBar"  (and ORDER BY "fooBar").\n');
  process.exit(1);
}
console.log('✓ SQL aliases: no unquoted camelCase identifiers');
