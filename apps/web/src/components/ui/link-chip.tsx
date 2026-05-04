// LinkChip — small pill-shaped link for inline shortcuts (↗ signup,
// ↗ post page, ↗ profile). Always wrapped via ExternalLink so href.li
// referrer-stripping applies automatically.
//
// Replaces the duplicated ad-hoc <ExternalLink style={{padding, border,
// borderRadius, background, color, fontFamily, fontWeight}}>↗ ...</>
// pattern that was scattered across PlatformInfoCard, AccountsVault row,
// and PlatformsPage card.

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { ExternalLink } from '../external-link';

export type ChipTone = 'accent' | 'neutral' | 'success' | 'warn' | 'danger';
export type ChipSize = 'xs' | 'sm';

const TONE: Record<ChipTone, { bg: string; fg: string; bd: string }> = {
  accent:  { bg: 'var(--accent-soft)',         fg: 'var(--accent)', bd: 'var(--accent-line)' },
  neutral: { bg: 'var(--bg-3)',                fg: 'var(--fg-1)',   bd: 'var(--line)' },
  success: { bg: 'rgba(16,185,129,0.12)',      fg: 'var(--ok)',     bd: 'rgba(16,185,129,0.40)' },
  warn:    { bg: 'rgba(196,106,0,0.12)',       fg: 'var(--warn)',   bd: 'rgba(196,106,0,0.40)' },
  danger:  { bg: 'rgba(198,28,48,0.12)',       fg: 'var(--bad)',    bd: 'rgba(198,28,48,0.40)' },
};

const SIZE: Record<ChipSize, { padding: string; fontSize: number }> = {
  xs: { padding: '1px 5px',  fontSize: 10 },
  sm: { padding: '2px 7px',  fontSize: 11 },
};

export function LinkChip({
  href, children, tone = 'accent', size = 'sm', title, onClick, style,
}: {
  href: string;
  children: ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  title?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  style?: CSSProperties;
}) {
  const t = TONE[tone];
  const s = SIZE[size];
  return (
    <ExternalLink
      href={href}
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 4,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </ExternalLink>
  );
}
