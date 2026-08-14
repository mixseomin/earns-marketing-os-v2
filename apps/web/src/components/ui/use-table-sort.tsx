'use client';

// useTableSort — THE one sort engine for every house table (DataTable + hand-rolled <table>s).
// Multi-column, client-side, persistable. Extracted so we DON'T reimplement sort per table.
//  • plain click a column → sort by JUST it, cycling none → asc → desc → none.
//  • Shift+click → add/cycle it as an EXTRA tie-breaker (keeps the columns already sorted).
//  • null/undefined always sort LAST (both directions). number = numeric, string = localeCompare numeric-aware.
//  • persistKey → thứ tự sống qua F5 bằng cookie `tbl.<persistKey>` (server đọc sẵn → không nháy).
// Usage in a hand-rolled table:
//   const COLS = [{ key: 'name', sortValue: (r) => r.name }, { key: 'clicks', sortValue: (r) => r.clicks }];
//   const s = useTableSort(rows, COLS, 'accounts');
//   <th onClick={s.thProps('name').onClick} style={{ cursor: 'pointer', userSelect: 'none' }}>Name <SortArrow spec={s.thProps('name')} /></th>
//   {s.sorted.map(...)}
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTablePref, writeTablePref } from './table-prefs';
import { readShallowParam, writeShallowParam } from '@/lib/url-shallow';

export type SortDir = 'asc' | 'desc';
export type SortSpec = { key: string; dir: SortDir };
export interface SortableCol<T> { key: string; sortValue?: (row: T) => string | number | null | undefined }
export type ThSort = { idx: number; dir: SortDir | null; count: number; onClick: (e: { shiftKey: boolean }) => void };

const nextDir = (c: SortDir | undefined): SortDir | null => (c === undefined ? 'asc' : c === 'asc' ? 'desc' : null);

// Sort ⇄ URL: dạng gọn `key.dir,key.dir` (key cột = định danh, dir ∈ asc/desc). lastIndexOf('.') để
// dir luôn là phần sau dấu chấm cuối. Lọc bỏ cột lạ/dir sai → URL bịa tay không làm vỡ.
const encodeSort = (s: SortSpec[]) => s.map((x) => `${x.key}.${x.dir}`).join(',');
const decodeSort = (raw: string, valid: Set<string>): SortSpec[] =>
  raw.split(',').map((p) => { const i = p.lastIndexOf('.'); return { key: p.slice(0, i), dir: p.slice(i + 1) as SortDir }; })
     .filter((x) => (x.dir === 'asc' || x.dir === 'desc') && valid.has(x.key));

export function useTableSort<T>(rows: T[], columns: SortableCol<T>[], persistKey?: string) {
  const storeKey = persistKey ? `${persistKey}::sort` : undefined;
  const urlKey = persistKey ? `${persistKey}.sort` : undefined;   // sort sống qua F5 + share qua link
  // Thứ tự lưu nằm trong cookie `tbl.<key>` mà app/layout đọc SẴN trên server → server và client
  // render cùng một thứ tự ngay từ đầu, không còn cảnh bảng vẽ xong rồi mới nhảy sang thứ tự đã lưu.
  const pref = useTablePref(persistKey);
  const [sort, setSort] = useState<SortSpec[]>(() => pref.s ?? []);
  // Còn lại: link người khác gửi (có `.sort` trên URL), và di trú localStorage của máy cũ.
  useEffect(() => {
    const fromUrl = urlKey ? readShallowParam(urlKey) : null;
    if (fromUrl) { const s = decodeSort(fromUrl, new Set(columns.map((c) => c.key))); if (s.length) { setSort(s); return; } }
    if (!pref.s && storeKey) { try { const raw = localStorage.getItem(storeKey); if (raw) { const s = JSON.parse(raw); setSort(s); writeTablePref(persistKey, { s }); } } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, urlKey]);
  const apply = (next: SortSpec[]) => {
    setSort(next);
    if (urlKey) writeShallowParam(urlKey, next.length ? encodeSort(next) : null);
    if (storeKey) { try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ } }
    writeTablePref(persistKey, { s: next });
  };
  const toggle = (key: string, additive: boolean) => {
    if (additive) {                                   // Shift+click: cycle THIS col in the chain, keep rest
      const nd = nextDir(sort.find((s) => s.key === key)?.dir);
      const rest = sort.filter((s) => s.key !== key);
      apply(nd ? [...rest, { key, dir: nd }] : rest);
    } else {                                          // plain click: collapse to this col alone (3-state cycle)
      const solo = sort.length === 1 && sort[0]!.key === key;
      const nd = solo ? nextDir(sort[0]!.dir) : 'asc';
      apply(nd ? [{ key, dir: nd }] : []);
    }
  };
  const sorted = useMemo(() => {
    if (!sort.length) return rows;
    const specs: { dir: SortDir; sv: (row: T) => string | number | null | undefined }[] = [];
    for (const s of sort) { const sv = columns.find((c) => c.key === s.key)?.sortValue; if (sv) specs.push({ dir: s.dir, sv }); }
    if (!specs.length) return rows;
    return [...rows].sort((a, b) => {
      for (const { dir, sv } of specs) {
        const av = sv(a), bv = sv(b);
        if (av == null && bv == null) continue;
        if (av == null) return 1;                     // null/undefined luôn xuống cuối, KHÔNG lật theo chiều
        if (bv == null) return -1;
        const base = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
        if (base !== 0) return dir === 'asc' ? base : -base;   // hoà ở cột này → xét cột ưu tiên kế
      }
      return 0;
    });
  }, [rows, columns, sort]);
  // Header helper: everything a <th> needs to be a sort control (priority idx, current dir, click).
  const thProps = (key: string): ThSort => {
    const idx = sort.findIndex((s) => s.key === key);
    return { idx, dir: idx >= 0 ? sort[idx]!.dir : null, count: sort.length, onClick: (e) => toggle(key, e.shiftKey) };
  };
  return { sort, sorted, toggle, thProps };
}

// SortArrow — the shared sort indicator. ▲asc/▼desc (accent) when active; ▾ (dim) = "sortable, click me".
// When >1 column is sorted, shows the priority number (1 = primary). Pass a `thProps(key)` result.
const arrowWrap: CSSProperties = { marginLeft: 4, fontSize: 9, verticalAlign: 'middle', whiteSpace: 'nowrap' };
export function SortArrow({ spec }: { spec: ThSort }) {
  const active = spec.idx >= 0;
  return (
    <span aria-hidden style={{ ...arrowWrap, color: active ? 'var(--accent)' : 'var(--fg-4)' }}>
      {active ? (spec.dir === 'asc' ? '▲' : '▼') : '▾'}
      {active && spec.count > 1 && <span style={{ fontSize: 8, marginLeft: 1, fontWeight: 700 }}>{spec.idx + 1}</span>}
    </span>
  );
}
