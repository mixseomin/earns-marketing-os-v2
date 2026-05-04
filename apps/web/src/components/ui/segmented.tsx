// Segmented — small segmented control for picking 1-of-N short options
// (snippet variant 1/2/3/4, alt variants, view modes). Lower-density
// alternative to a tab strip; used inside cards/modals.

import type { CSSProperties, ReactNode } from 'react';

export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string | number>({
  options, value, onChange, size = 'sm', style,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'xs' | 'sm';
  style?: CSSProperties;
}) {
  const padding = size === 'xs' ? '1px 6px' : '2px 7px';
  const fontSize = size === 'xs' ? 9 : 10;
  return (
    <span style={{ display: 'inline-flex', gap: 3, ...style }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.value)}
            style={{
              padding,
              fontSize,
              fontFamily: 'var(--font-mono)',
              fontWeight: active ? 700 : 500,
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--fg-2)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'var(--line)'}`,
              borderRadius: 4,
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </span>
  );
}
