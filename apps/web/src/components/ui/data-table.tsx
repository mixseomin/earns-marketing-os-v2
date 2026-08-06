'use client';

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';

// DataTable — the house pattern for "a LOT of columns without overflowing the layout".
// Lifted from the SEO Sites Overview table (the reference): dense mono cells + optional
// column GROUPS the user can show/hide (so a wide table only paints what's needed) + the
// whole thing scrolls horizontally INSIDE its own container (never blows out page width).
//
// Generic over the row type. You describe columns (+ which group each belongs to); the
// primitive renders the toggle chips, the scroll box, the header/body, and an optional
// totals row. NOT a data-fetching or sorting engine — just the containment + grouping skin.
//
// ponytail: group prefs persist to localStorage (per storageKey). The SEO table mirrors
// them to a cookie for zero-FOUC SSR; add that only if a server-rendered table needs it.

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
  storageKey?: string;                  // persist which groups are shown
  onRowClick?: (row: T, index: number) => void;
  minWidth?: number;                    // table min width before it starts scrolling (default 640)
  rowTitle?: (row: T) => string | undefined;
}

const baseCell: CSSProperties = { padding: '3px 5px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const baseHead: CSSProperties = { ...baseCell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 };

// hex + alpha (8-digit) — matches the SEO table's per-group band shades.
const band = (hex: string | undefined) => (hex ? `${hex}22` : undefined);
const bandSoft = (hex: string | undefined) => (hex ? `${hex}14` : undefined);

export function DataTable<T>({
  rows, columns, getRowKey, groups, storageKey, onRowClick, minWidth = 640, rowTitle,
}: DataTableProps<T>) {
  const groupMeta = new Map((groups ?? []).map((g) => [g.key, g]));
  const defaults = () => Object.fromEntries((groups ?? []).map((g) => [g.key, g.defaultOn ?? true])) as Record<string, boolean>;
  const [shown, setShown] = useState<Record<string, boolean>>(defaults);

  // Restore saved prefs after mount (server + first client paint = defaults → no hydration
  // mismatch; a hidden group may flash for one frame — acceptable, see header note).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setShown((prev) => ({ ...prev, ...JSON.parse(raw) }));  // merge saved onto defaults
    } catch { /* ignore */ }
  }, [storageKey]);

  const toggle = (k: string) =>
    setShown((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ } }
      return next;
    });

  const visible = columns.filter((c) => !c.group || shown[c.group] !== false);
  const hasTotals = visible.some((c) => c.total);

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, rowGap: 4, marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Show:</span>
          {groups.map((g) => {
            const on = shown[g.key] !== false;
            return (
              <button key={g.key} type="button" onClick={() => toggle(g.key)}
                style={{
                  padding: '3px 9px', borderRadius: 4,
                  background: on ? band(g.color) ?? 'var(--bg-2)' : 'transparent',
                  border: `1px solid ${on ? g.color ?? 'var(--line)' : 'transparent'}`,
                  color: on ? g.color ?? 'var(--fg-1)' : 'var(--fg-3)',
                  cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                  textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: on ? 600 : 400,
                }}>
                {on ? '✓ ' : '+ '}{g.label}
              </button>
            );
          })}
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
