// ViewToggle — connected segmented control for switching view MODE (List ↔ Calendar,
// Grid ↔ Table, …). One control, one look everywhere: active segment = neon-cyan (matches
// the tab strips). Shared dashboard primitive so pages stop hand-rolling their own toggles.
import type { CSSProperties, ReactNode } from 'react';

export interface ViewOption { value: string; label: ReactNode; title?: string; }

export function ViewToggle({ options, value, onChange, style }: {
  options: ViewOption[];
  value: string;
  onChange: (v: string) => void;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden', ...style }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" title={o.title} onClick={() => onChange(o.value)}
            style={{
              fontSize: 12, fontWeight: on ? 700 : 500, padding: '4px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
              border: 'none', borderLeft: i ? '1px solid var(--line)' : 'none',
              background: on ? 'color-mix(in srgb, var(--neon-cyan) 14%, transparent)' : 'var(--bg-2)',
              color: on ? 'var(--neon-cyan)' : 'var(--fg-2)',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Convenience: the standard List/Calendar pair used by list surfaces.
export const LIST_CALENDAR_VIEWS: ViewOption[] = [
  { value: 'list', label: '☰ List', title: 'Danh sách' },
  { value: 'calendar', label: '📅 Lịch', title: 'Lịch tháng' },
];
