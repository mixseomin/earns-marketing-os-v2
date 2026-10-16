'use client';
// Phân trang dùng chung (gói @mos2/bang): usePaged + Pager — tách khỏi apps/web list-view để DataTable dùng được ở mọi app.
import { useState, useMemo, type CSSProperties } from 'react';

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

