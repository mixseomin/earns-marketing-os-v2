'use client';

// list-view — the shared toolbar + pagination for "vault list" pages (offers, communities,
// contacts, budget, media, servers, …). Before this, every list page hand-rolled its own filter
// chips (`chip()`), search `<input>` and rendered the ENTIRE array with no pagination — patched,
// inconsistent, and slow/unscrollable at scale. These primitives standardise:
//   - usePaged     — client-side pagination (slice + page state, auto-clamped on filter change)
//   - Pager        — neutral prev/next + "51–100 / 320" (renders nothing when there's 1 page)
//   - ListToolbar  — the filter row shell (chips/selects left, search right)
//   - FilterChips  — single-select chip group with counts (wraps Segmented → YDNI single-accent)
//   - SearchInput  — the one neutral search box
// COLOUR: everything here is neutral by default (YDNI colour discipline). The ONLY accent is the
// active filter chip. Pagination/search/toolbar are chrome → grey. Don't paint them.

import { useState, useMemo, type ReactNode, type CSSProperties } from 'react';
import { Segmented } from './segmented';

// ── usePaged ─────────────────────────────────────────────────────────────────────────────────
// Slice `items` into pages. `page` is auto-clamped into range, so when a filter shrinks the list
// below the current page you fall back to the last valid page instead of an empty screen — no
// per-caller "reset to page 1" boilerplate. Returns the current page's slice + nav state.
export function usePaged<T>(items: T[], pageSize = 50, initialPage = 0) {
  // initialPage seeds the FIRST render only (useState) — used for deep-links that must land on the
  // page holding a specific row (e.g. ?focus=<handle>), so the target isn't paginated off page 1.
  const [page, setPage] = useState(initialPage);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, setPage, pageCount, pageItems, total: items.length, pageSize };
}

// ── Pager ────────────────────────────────────────────────────────────────────────────────────
const navBtn = (disabled: boolean): CSSProperties => ({
  padding: '2px 9px', fontSize: 13, lineHeight: 1.4, borderRadius: 6,
  border: '1px solid var(--line)', background: 'var(--bg-2)',
  color: disabled ? 'var(--fg-4)' : 'var(--fg-2)', cursor: disabled ? 'default' : 'pointer',
});

export function Pager({ page, pageCount, total, pageSize, onPage }: {
  page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;   // YDNI: no chrome when it all fits on one page
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div data-comp="ui.Pager" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>
      <span>{from}–{to} / {total}</span>
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} style={navBtn(page === 0)} title="Trang trước">‹</button>
      <span>{page + 1}/{pageCount}</span>
      <button type="button" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} style={navBtn(page >= pageCount - 1)} title="Trang sau">›</button>
    </div>
  );
}

// ── SearchInput ──────────────────────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Tìm…', width = 200, autoFocus = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number; autoFocus?: boolean;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', left: 8, fontSize: 12, color: 'var(--fg-4)', pointerEvents: 'none' }}>🔍</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off"
        autoFocus={autoFocus}
        style={{ padding: '5px 9px 5px 26px', fontSize: 12, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-1)', width, outline: 'none' }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} title="Xoá tìm kiếm"
          style={{ position: 'absolute', right: 6, background: 'transparent', border: 'none', color: 'var(--fg-4)', cursor: 'pointer', fontSize: 12, padding: 2 }}>✕</button>
      )}
    </div>
  );
}

// ── ListToolbar ──────────────────────────────────────────────────────────────────────────────
// One row: filter controls (chips/selects) on the left, search pushed to the right. Pass the
// search props to render the standard box; omit them for a filter-only bar.
export function ListToolbar({ children, search, onSearch, searchPlaceholder, searchAutoFocus, right }: {
  children?: ReactNode;
  search?: string; onSearch?: (v: string) => void; searchPlaceholder?: string;
  /** Focus the search box on mount — for deep-links that arrive with a query pre-filled. */
  searchAutoFocus?: boolean;
  right?: ReactNode;
}) {
  return (
    <div data-comp="ui.ListToolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      {children}
      <span style={{ flex: 1, minWidth: 12 }} />
      {right}
      {onSearch && <SearchInput value={search ?? ''} onChange={onSearch} placeholder={searchPlaceholder} autoFocus={searchAutoFocus} />}
    </div>
  );
}

// ── FilterChips ──────────────────────────────────────────────────────────────────────────────
// Chip group with a count on each option — the standard "all / awin / cj / …" filter.
// Wraps Segmented so the active chip is the screen's ONE accent and the rest stay neutral (YDNI).
// `counts` is optional; when given, each chip shows `label n`.
//
// Chọn NHIỀU: truyền `values` + `onToggle` thay cho `value` + `onChange` (mảng rỗng = không lọc).
export interface ChipOption<T extends string> { value: T; label: string; title?: string }
type ChipMode<T> =
  | { value: T; onChange: (v: T) => void; values?: never; onToggle?: never }
  | { values: T[]; onToggle: (v: T[]) => void; value?: never; onChange?: never };

export function FilterChips<T extends string>({ options, value, onChange, values, onToggle, counts }: {
  options: ChipOption<T>[]; counts?: Partial<Record<T, number>>;
} & ChipMode<T>) {
  // Chuyển tiếp nguyên chế độ xuống Segmented — union hai bên khớp nhau nên không có đường nào
  // lọt xuống với "không cặp nào".
  const mode = (values ? { values, onToggle: onToggle! } : { value: value!, onChange: onChange! }) as ChipMode<T>;
  return (
    <Segmented
      {...mode}
      options={options.map((o) => ({
        value: o.value,
        title: o.title,   // hover explanation per chip (Segmented renders it) — don't drop tooltips on migrate
        label: counts && counts[o.value] != null ? `${o.label} ${counts[o.value]}` : o.label,
      }))}
    />
  );
}
