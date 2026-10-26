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

import { type ReactNode } from 'react';
import { urlVoiParam } from '@/lib/url-mo-tab';
import { Segmented } from './segmented';

// usePaged + Pager nằm ở gói dùng chung @mos2/bang (DataTable của mọi app dùng chung) — xuất lại để chỗ gọi cũ giữ nguyên.
export { usePaged, Pager } from '@mos2/bang/phan-trang';

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
// `counts` is optional; when given, the count goes into the chip's hover (title) — chip label is the name only (luật nhãn không mang số).
//
// Chọn NHIỀU: truyền `values` + `onToggle` thay cho `value` + `onChange` (mảng rỗng = không lọc).
export interface ChipOption<T extends string> { value: T; label: string; title?: string; icon?: ReactNode }   // icon: favicon / glyph trước chữ (YDNI trực quan trước chữ) — không nhét emoji vào label
type ChipMode<T> =
  | { value: T; onChange: (v: T) => void; values?: never; onToggle?: never }
  | { values: T[]; onToggle: (v: T[]) => void; value?: never; onChange?: never };

export function FilterChips<T extends string>({ options, value, onChange, values, onToggle, counts, urlKey, allValue = 'all', hrefFor }: {
  options: ChipOption<T>[]; counts?: Partial<Record<T, number>>;
  /** Tên param URL của bộ lọc này → ⌘/Ctrl-click (hay chuột giữa) một chip mở TAB MỚI với URL đã áp chip đó.
   *  Giá trị bằng `allValue` thì xoá param (URL sạch). Bộ lọc nào có key trong URL đều nên khai — luật "mọi state trong URL". */
  urlKey?: string;
  allValue?: string;
  /** Tự dựng URL (khi param không phải 1-1 với value). Thắng `urlKey`. */
  hrefFor?: (value: T) => string | null | undefined;
} & ChipMode<T>) {
  // Chuyển tiếp nguyên chế độ xuống Segmented — union hai bên khớp nhau nên không có đường nào
  // lọt xuống với "không cặp nào".
  const mode = (values ? { values, onToggle: onToggle! } : { value: value!, onChange: onChange! }) as ChipMode<T>;
  const href = hrefFor ?? (urlKey ? (v: T) => urlVoiParam(urlKey, v === allValue ? '' : v) : undefined);
  return (
    <Segmented
      {...mode}
      hrefFor={href}
      options={options.map((o) => ({
        value: o.value,
        // NHÃN CHIP KHÔNG MANG SỐ (luật anh 16/10/2026, nhắc lại 26/10/2026 "tiêu đề mà viết hết cả tên ra"): chip chỉ ghi tên, số đếm vào hover
        title: [counts && counts[o.value] != null ? `${counts[o.value]}` : null, o.title].filter(Boolean).join(' · ') || undefined,
        label: o.icon ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{o.icon}{o.label}</span> : o.label,
      }))}
    />
  );
}
