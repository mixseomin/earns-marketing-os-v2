// StatsStrip — the house stat tile / count-card grid. Clickable count cards at the
// top of /tests, /roadmap (status filtering), and display-only stat tiles inside
// dashboard panels (spend/visits/joined/…). One primitive so every stat tile matches.

import type { ReactNode } from 'react';

export interface StatCard {
  key: string;
  label: ReactNode;        // 'Pass' / '🟢 Pass' — shown small + uppercase
  value: ReactNode;        // number or '—'
  color?: string;          // value colour (default fg-1)
  sub?: ReactNode;         // optional small line under the value (e.g. "540 visits")
  active?: boolean;        // currently selected filter (hex `color` only)
  onClick?: () => void;
  title?: string;
}

// columns = fixed N-up grid; minColWidth = responsive auto-fit (wraps on narrow screens).
export function StatsStrip({ cards, columns, minColWidth }: { cards: StatCard[]; columns?: number; minColWidth?: number }) {
  const gridTemplateColumns = minColWidth
    ? `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`
    : `repeat(${columns ?? cards.length}, 1fr)`;
  return (
    <div data-comp="ui.StatsStrip" style={{ display: 'grid', gridTemplateColumns, gap: 6, marginBottom: 12 }}>
      {cards.map((c) => (
        <div
          key={c.key}
          onClick={c.onClick}
          title={c.title}
          style={{
            padding: '8px 10px',
            background: 'var(--bg-1)',
            border: `1px solid ${c.active && c.color ? c.color + '66' : 'var(--line)'}`,
            borderRadius: 6,
            cursor: c.onClick ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'border-color .12s',
          }}
        >
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {c.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.color ?? 'var(--fg-1)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {c.value}
          </div>
          {c.sub != null && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
