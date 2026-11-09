import type { ReactNode, CSSProperties } from 'react';

// SimpleTable — the house look for a SMALL/narrow display table (top-N lists, breakdowns).
// Unlike DataTable (wide, column-groups, horizontal-scroll containment for data-heavy grids),
// this is just consistent compact cells with a header — no toggle, no negative-margin scroll
// box that would fight a table embedded in a narrow grid cell. Server-compatible (no hooks),
// so a server component can pass `cell` functions directly (no client wrapper needed).

export interface SimpleColumn<T> {
  key: string;
  header: ReactNode;
  title?: string;                        // th tooltip
  align?: 'left' | 'right' | 'center';   // default left
  width?: number | string;
  cell: (row: T, index: number) => ReactNode;
}

const thBase: CSSProperties = { padding: '6px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const tdBase: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--line)', verticalAlign: 'top' };

export function SimpleTable<T>({ rows, columns, getRowKey, hideHeader, rowStyle, renderExpanded }: {
  rows: T[];
  columns: SimpleColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  hideHeader?: boolean;               // for ranked lists that never had a header row
  /** Tô cả dòng theo trạng thái (như conditional formatting của sheet) — chỉ dùng cho tín hiệu thật, không trang trí. */
  rowStyle?: (row: T, index: number) => CSSProperties | undefined;
  /** Trả nội dung ≠ null → thêm một dòng full-width ngay dưới dòng đó (bảng con, chi tiết mở tại chỗ). */
  renderExpanded?: (row: T, index: number) => ReactNode;
}) {
  return (
    <div data-comp="ui.SimpleTable" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {!hideHeader && (
          <thead>
            <tr>{columns.map((c) => <th key={c.key} title={c.title} style={{ ...thBase, textAlign: c.align ?? 'left', width: c.width }}>{c.header}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => {
            const extra = renderExpanded?.(row, i);
            const rs = rowStyle?.(row, i);
            return [
              <tr key={getRowKey(row, i)} style={rs}>
                {columns.map((c) => <td key={c.key} style={{ ...tdBase, textAlign: c.align ?? 'left', width: c.width }}>{c.cell(row, i)}</td>)}
              </tr>,
              extra != null && extra !== false ? (
                <tr key={getRowKey(row, i) + ':x'}><td colSpan={columns.length} style={{ ...tdBase, padding: '4px 8px 12px 28px', background: 'var(--bg-2, transparent)' }}>{extra}</td></tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
