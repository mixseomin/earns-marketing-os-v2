'use client';

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';

// DataTable — the house pattern for "a LOT of columns without overflowing the layout".
// Lifted from the SEO Sites Overview table (the reference): dense mono cells + optional
// column GROUPS the user can show/hide (so a wide table only paints what's needed) + the
// whole thing scrolls horizontally INSIDE its own container (never blows out page width).
//
// Generic over the row type. You describe columns (+ which group each belongs to); the
// primitive renders the ⚙ column-toggle popover, the scroll box, header/body, optional
// totals row. NOT a data-fetching or sorting engine — just the containment + grouping skin.
//
// Persistence: pass `persistKey` → toggles save to localStorage AND a same-named cookie.
// Server components read that cookie and pass `initialShown` so the first paint already
// matches the saved view (no FOUC / no columns flashing then collapsing).

export interface DataColumn<T> {
  key: string;
  group?: string;                       // group key (matches a DataGroup.key). Omit = always shown.
  header: ReactNode;
  title?: string;                       // th tooltip
  align?: 'left' | 'right' | 'center';  // default right (numbers); use 'left' for the label column
  width?: number | string;
  cell: (row: T, index: number) => ReactNode;
  total?: (rows: T[]) => ReactNode;     // if ANY column sets this, a totals row renders
}

export interface DataGroup {
  key: string;
  label: string;
  color?: string;        // 6-digit hex accent (#rrggbb) — tints the chip, header band + column
  defaultOn?: boolean;   // default true
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  groups?: DataGroup[];
  persistKey?: string;                  // localStorage + cookie key for which groups are shown
  initialShown?: Record<string, boolean>; // server-seeded (read the `persistKey` cookie) → no FOUC
  onRowClick?: (row: T, index: number) => void;
  minWidth?: number;                    // table min width before it starts scrolling (default 640)
  rowTitle?: (row: T) => string | undefined;
}

const baseCell: CSSProperties = { padding: '3px 5px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const baseHead: CSSProperties = { ...baseCell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 };

// hex + alpha (8-digit) — matches the SEO table's per-group band shades (header ~0.22, body ~0.06).
const band = (hex: string | undefined) => (hex ? `${hex}38` : undefined);
const bandSoft = (hex: string | undefined) => (hex ? `${hex}0f` : undefined);

export function DataTable<T>({
  rows, columns, getRowKey, groups, persistKey, initialShown, onRowClick, minWidth = 640, rowTitle,
}: DataTableProps<T>) {
  const groupMeta = new Map((groups ?? []).map((g) => [g.key, g]));
  const defaults = () => Object.fromEntries((groups ?? []).map((g) => [g.key, g.defaultOn ?? true])) as Record<string, boolean>;
  const [shown, setShown] = useState<Record<string, boolean>>(() => ({ ...defaults(), ...(initialShown ?? {}) }));

  // If the cookie wasn't seeded server-side, reconcile from localStorage after paint (server +
  // first client paint = defaults → no hydration mismatch; a hidden group may flash one frame).
  useEffect(() => {
    if (!persistKey || (initialShown && Object.keys(initialShown).length > 0)) return;
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) setShown((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, [persistKey, initialShown]);

  const toggle = (k: string) =>
    setShown((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      if (persistKey) {
        try {
          localStorage.setItem(persistKey, JSON.stringify(next));
          document.cookie = `${persistKey}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        } catch { /* ignore */ }
      }
      return next;
    });

  const visible = columns.filter((c) => !c.group || shown[c.group] !== false);
  const hasTotals = visible.some((c) => c.total);
  const onCount = (groups ?? []).filter((g) => shown[g.key] !== false).length;

  const cellStyle = (c: DataColumn<T>, extra?: CSSProperties): CSSProperties => {
    const g = c.group ? groupMeta.get(c.group) : undefined;
    return { ...baseCell, textAlign: c.align ?? 'right', width: c.width, background: bandSoft(g?.color), ...extra };
  };
  const headStyle = (c: DataColumn<T>): CSSProperties => {
    const g = c.group ? groupMeta.get(c.group) : undefined;
    return { ...baseHead, textAlign: c.align ?? 'right', width: c.width, color: g?.color ?? 'var(--fg-3)', background: band(g?.color) };
  };

  return (
    <div data-comp="ui.DataTable">
      {groups && groups.length > 0 && (
        // ⚙ Columns — collapsed by default (YDNI). Native <details> = zero-JS popover; closes on
        // re-click of the summary. Right-aligned so it sits where controls conventionally live.
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <details className="dt-cols" style={{ position: 'relative' }}>
            <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', userSelect: 'none' }}>
              ⚙ Columns <span style={{ color: 'var(--fg-3)' }}>{onCount}/{groups.length}</span>
            </summary>
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150, boxShadow: '0 6px 20px rgba(0,0,0,.35)' }}>
              {groups.map((g) => {
                const on = shown[g.key] !== false;
                return (
                  <button key={g.key} type="button" onClick={() => toggle(g.key)}
                    style={{
                      padding: '4px 9px', borderRadius: 4, textAlign: 'left',
                      background: on ? band(g.color) ?? 'var(--bg-1)' : 'transparent',
                      border: `1px solid ${on ? g.color ?? 'var(--line)' : 'transparent'}`,
                      color: on ? g.color ?? 'var(--fg-1)' : 'var(--fg-3)',
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: on ? 600 : 400,
                    }}>
                    {on ? '✓ ' : '  '}{g.label}
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      )}

      <div className="dt-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', minWidth }}>
          <thead>
            <tr>
              {visible.map((c) => <th key={c.key} style={headStyle(c)} title={c.title}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={getRowKey(row, i)} className="dt-row"
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  title={rowTitle?.(row)}>
                {visible.map((c) => <td key={c.key} style={cellStyle(c)}>{c.cell(row, i)}</td>)}
              </tr>
            ))}
            {hasTotals && (
              <tr style={{ background: 'var(--bg-2)' }}>
                {visible.map((c) => (
                  <td key={c.key} style={cellStyle(c, { fontWeight: 700, color: c.group ? groupMeta.get(c.group)?.color : undefined })}>
                    {c.total ? c.total(rows) : null}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
