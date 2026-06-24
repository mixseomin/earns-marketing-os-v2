#!/usr/bin/env node
// Guard: behavioral-canon single-source invariants. Stops the 3 P0 drift classes
// (2026-06-25) from recurring in a brand-new chat that doesn't know the rule. Runs in
// deploy.sh BEFORE build, like check-sql-aliases.mjs. The cross-runtime ext literals
// (earns-dashboard) can't be reached from this repo's CI, so this guards the BACKEND
// invariants that actually bit us; the human surface = Architecture Studio "Canon" view.
// Rule home: lib/canon/index.ts + decisions/2026-06-25-crew-behavioral-registry-xentity.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const violations = [];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p); }
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) files.push(p);
  }
}
try { walk('apps/web/src'); } catch { /* root absent */ }

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  // (1) Platform-key slug in account routes MUST go through canonPlatformKey().
  //     The x/twitter row-split: ext wrote platform_key='x' while stats query 'twitter'
  //     → account_not_found, stats never update.
  if (file.includes('app/api/ext/accounts/')) {
    lines.forEach((ln, i) => {
      if (/replace\(\/\[\^a-z0-9\]\+\/g/.test(ln) && !/canonPlatformKey/.test(ln)) {
        violations.push(`${file}:${i + 1}  platform slug without canonPlatformKey() → x/twitter row-split. Wrap: canonPlatformKey(<slug>).`);
      }
    });
  }

  // (2) selector_overrides has ONE write path: lib/actions/habitat-selectors.ts (setOverride/
  //     setMap). A raw INSERT elsewhere skips canonField + FIELD_ALIASES + CSS adopt guard →
  //     duplicate rows for one element (the selectors/set bypass).
  if (!file.endsWith('lib/actions/habitat-selectors.ts') && /INSERT\s+INTO\s+selector_overrides/i.test(src)) {
    const i = lines.findIndex((l) => /INSERT\s+INTO\s+selector_overrides/i.test(l));
    violations.push(`${file}:${i + 1}  raw INSERT INTO selector_overrides → use setOverride()/setMap() (canonField + adopt guard).`);
  }
}

if (violations.length) {
  console.error('\n✗ Behavioral-canon guard — single-source violated:\n');
  for (const v of violations) console.error('  ' + v);
  console.error('\nRule: lib/canon/index.ts + decisions/2026-06-25-crew-behavioral-registry-xentity.md.\n');
  process.exit(1);
}
console.log('✓ Behavioral-canon: account slugs canon-wrapped + selector_overrides single write-path');
