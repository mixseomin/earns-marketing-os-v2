// StatsStrip — clickable count cards in a horizontal grid. Used at the top
// of /tests, /roadmap, etc. for status filtering at a glance.

import type { ReactNode } from 'react';

export interface StatCard {
  key: string;
  label: ReactNode;        // 'Pass' or '🟢 Pass'
  value: ReactNode;        // number or '—'
  color: string;           // CSS color for the value
  active?: boolean;        // currently selected filter
  onClick?: () => void;
  title?: string;
}

export function StatsStrip({ cards, columns }: { cards: StatCard[]; columns?: number }) {
  const cols = columns ?? cards.length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, marginBottom: 12 }}>
      {cards.map((c) => (
        <div
          key={c.key}
          onClick={c.onClick}
          title={c.title}
          style={{
            padding: '8px 10px',
            background: 'var(--bg-1)',
            border: `1px solid ${c.active ? c.color + '66' : 'var(--line)'}`,
            borderRadius: 6,
            cursor: c.onClick ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'border-color .12s',
          }}
        >
          <div style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {c.label}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: c.color, marginTop: 2,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
