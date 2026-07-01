// StatusSegmented — pick 1-of-N workflow states. Only the SELECTED segment lights up
// (filled with its status color, bold, dark text); the rest stay muted grey so the
// current state is unmistakable. Shared dashboard primitive for any lifecycle picker
// (backlink per-site status, account status, …) — avoids the "every button glows, can't
// tell which is active" trap of separately-outlined colored buttons.

import type { CSSProperties } from 'react';

export interface StatusOption { value: string; label: string; color: string; }

export function StatusSegmented({ options, value, onChange, disabled, size = 'sm', style }: {
  options: StatusOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}) {
  const pad = size === 'md' ? '5px 13px' : '4px 10px';
  const fs = size === 'md' ? 11.5 : 11;
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-2)', ...style }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)} title={o.label}
            style={{
              padding: pad, fontSize: fs, fontWeight: on ? 800 : 500, cursor: disabled ? 'default' : 'pointer',
              border: 'none', borderLeft: i ? '1px solid var(--line)' : 'none',
              background: on ? o.color : 'transparent', color: on ? '#0b0f17' : 'var(--fg-3)',
              transition: 'background .12s, color .12s', whiteSpace: 'nowrap',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
