'use client';

// MonthCalendar — reusable month grid. Feed it dated items ({date:'YYYY-MM-DD'}) and it
// drops each into its day cell. `dim` renders an item faded (e.g. scheduled/planned vs
// done). Monday-start. Self-manages the visible month with ◀ ▶ / Today nav.
import { useState, type CSSProperties } from 'react';

export interface CalItem { id: number | string; date: string; label: string; dim?: boolean; color?: string; title?: string; }

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const navBtn: CSSProperties = { fontSize: 12, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };

export function MonthCalendar({ items, onItemClick, initialMonth }: {
  items: CalItem[];
  onItemClick?: (id: number | string) => void;
  initialMonth?: Date;
}) {
  const [cur, setCur] = useState(() => { const d = initialMonth ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const y = cur.getFullYear(), m = cur.getMonth();
  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;       // Monday-start
  const gridStart = new Date(y, m, 1 - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const byDate = new Map<string, CalItem[]>();
  for (const it of items) { (byDate.get(it.date) ?? byDate.set(it.date, []).get(it.date)!).push(it); }
  const todayStr = ymd(new Date());
  const monthLabel = cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => setCur(new Date(y, m - 1, 1))} style={navBtn}>◀</button>
        <div style={{ fontSize: 13, fontWeight: 700, minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</div>
        <button type="button" onClick={() => setCur(new Date(y, m + 1, 1))} style={navBtn}>▶</button>
        <button type="button" onClick={() => { const t = new Date(); setCur(new Date(t.getFullYear(), t.getMonth(), 1)); }} style={{ ...navBtn, marginLeft: 4 }}>Hôm nay</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {WD.map((w) => <div key={w} style={{ fontSize: 10, color: 'var(--fg-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em', paddingBottom: 2 }}>{w}</div>)}
        {days.map((d) => {
          const ds = ymd(d); const inMonth = d.getMonth() === m; const its = byDate.get(ds) || []; const isToday = ds === todayStr;
          return (
            <div key={ds} style={{ minHeight: 78, padding: 4, borderRadius: 6, border: `1px solid ${isToday ? 'var(--neon-cyan)' : 'var(--line)'}`, background: inMonth ? 'var(--bg-1)' : 'transparent', opacity: inMonth ? 1 : 0.4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10.5, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--neon-cyan)' : 'var(--fg-3)', textAlign: 'right' }}>{d.getDate()}</div>
              {its.map((it) => {
                const c = it.color || 'var(--accent)';
                return (
                  <button key={String(it.id) + it.date} type="button" title={it.title || it.label} onClick={() => onItemClick?.(it.id)}
                    style={{ textAlign: 'left', fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 4, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} ${it.dim ? 8 : 20}%, transparent)`, color: c, opacity: it.dim ? 0.6 : 1 }}>
                    {it.dim ? '🗓 ' : ''}{it.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
