// Inline SVG icons (Lucide-style stroke icons). currentColor = follows
// surrounding text color. Use sparingly — emoji is fine for stuff that
// doesn't need precise sizing.

import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  title?: string;
}

const baseProps = (size: number, color: string | undefined, sw: number, style: CSSProperties | undefined) => ({
  width: size, height: size,
  viewBox: '0 0 24 24', fill: 'none',
  stroke: color ?? 'currentColor', strokeWidth: sw,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'text-bottom', flexShrink: 0, ...style },
  'aria-hidden': true,
});

// Globe — software platform (Reddit, Facebook, phpBB, etc).
export function IconPlatform({ size = 14, color, strokeWidth = 1.8, style, title }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth, style)}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20" />
      <path d="M12 2a14.5 14.5 0 0 1 0 20" />
      <path d="M2 12h20" />
    </svg>
  );
}

// Users / pin — concrete community / group / habitat (Lyso, r/astrology, FB group).
export function IconCommunity({ size = 14, color, strokeWidth = 1.8, style, title }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth, style)}>
      {title && <title>{title}</title>}
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  );
}
