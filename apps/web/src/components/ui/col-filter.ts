// Per-column filter — MySQL/Adminer-style operators evaluated CLIENT-SIDE against a column's
// `sortValue` (its logical value). Text ops coerce to string (case-insensitive); comparison ops try
// numeric first, else locale compare. `SQL` from Adminer is dropped (can't eval SQL in the browser).
// Used by ui/DataTable's per-column search popup. Pure — see matchColFilter self-check (col-filter
// verified with tsx at build time; no test runner wired in this app).

export const COL_FILTER_OPS = [
  '=', '!=', '<', '>', '<=', '>=',
  'LIKE', 'LIKE %%', 'NOT LIKE', 'REGEXP', 'NOT REGEXP',
  'IN', 'NOT IN', 'FIND_IN_SET', 'IS NULL', 'IS NOT NULL',
] as const;
export type ColFilterOp = (typeof COL_FILTER_OPS)[number];

export const isNullaryOp = (op: string) => op === 'IS NULL' || op === 'IS NOT NULL';   // no value input
const NEGATIONS = new Set(['!=', 'NOT LIKE', 'NOT REGEXP', 'NOT IN']);

// SQL LIKE pattern → anchored, case-insensitive RegExp. % = any run, _ = any single char.
const likeRe = (pattern: string): RegExp => {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');   // escape regex metachars first (% and _ aren't metas → survive)
  return new RegExp('^' + esc.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
};

const asNum = (x: unknown): number | null => {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const s = String(x).trim().replace(/,/g, '');   // "1,024" → 1024
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// True if `raw` (a column's sortValue) passes `op`/`val`. Invalid regex → false (never throws).
export function matchColFilter(raw: string | number | null | undefined, op: string, val: string): boolean {
  const isNull = raw == null || raw === '';
  if (op === 'IS NULL') return isNull;
  if (op === 'IS NOT NULL') return !isNull;
  // Empty value only matches negations (a positive filter on nothing = show nothing for that row).
  if (isNull) return NEGATIONS.has(op);

  const s = String(raw);
  const sl = s.toLowerCase();
  const v = val.trim();
  const vl = v.toLowerCase();

  switch (op) {
    case '=': { const a = asNum(raw), b = asNum(v); return a != null && b != null ? a === b : sl === vl; }
    case '!=': { const a = asNum(raw), b = asNum(v); return a != null && b != null ? a !== b : sl !== vl; }
    case '<': case '>': case '<=': case '>=': {
      const a = asNum(raw), b = asNum(v);
      const cmp = a != null && b != null ? (a < b ? -1 : a > b ? 1 : 0)
        : s.localeCompare(v, undefined, { numeric: true, sensitivity: 'base' });
      return op === '<' ? cmp < 0 : op === '>' ? cmp > 0 : op === '<=' ? cmp <= 0 : cmp >= 0;
    }
    case 'LIKE': { try { return likeRe(v).test(s); } catch { return false; } }
    case 'NOT LIKE': { try { return !likeRe(v).test(s); } catch { return false; } }
    case 'LIKE %%': return sl.includes(vl);   // Adminer's %%… = contains
    case 'REGEXP': { try { return new RegExp(v, 'i').test(s); } catch { return false; } }
    case 'NOT REGEXP': { try { return !new RegExp(v, 'i').test(s); } catch { return false; } }
    case 'IN': return v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).includes(sl);
    case 'NOT IN': return !v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).includes(sl);
    case 'FIND_IN_SET': return sl.split(',').map((x) => x.trim()).includes(vl);   // raw is the set, val a member
    default: return true;
  }
}
