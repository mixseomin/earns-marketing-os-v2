// Spinner — inline mini-spinner for in-place pending states (checkboxes,
// buttons, table cells). Uses @keyframes spin defined in globals.css.

import type { CSSProperties } from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md';

const SIZE: Record<SpinnerSize, number> = { xs: 10, sm: 12, md: 16 };
const BORDER: Record<SpinnerSize, number> = { xs: 1.5, sm: 2, md: 2 };

export function Spinner({
  size = 'sm',
  color = 'var(--accent)',
  trackColor = 'var(--line)',
  label = 'loading',
  style,
}: {
  size?: SpinnerSize;
  color?: string;
  trackColor?: string;
  label?: string;
  style?: CSSProperties;
}) {
  const px = SIZE[size];
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        border: `${BORDER[size]}px solid ${trackColor}`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        ...style,
      }}
    />
  );
}
