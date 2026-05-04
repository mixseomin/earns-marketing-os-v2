// CTACard — large prominent call-to-action box with left accent stripe,
// title + subtitle, and trailing arrow. Used for "Tạo account trên X",
// "Mở dashboard", "Xem warmup checklist", etc.
//
// Renders as <ExternalLink> so href.li referrer-stripping applies for
// external destinations; internal paths (/p/...) pass through plain.

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { ExternalLink } from '../external-link';

export type CTATone = 'accent' | 'success' | 'warn' | 'danger';

const TONE: Record<CTATone, string> = {
  accent:  'var(--accent)',
  success: 'var(--ok)',
  warn:    'var(--warn)',
  danger:  'var(--bad)',
};

export function CTACard({
  href, title, subtitle, tone = 'accent', icon = '↗', trailing = '↗',
  onClick, style,
}: {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: CTATone;
  icon?: ReactNode;             // leading glyph next to title (default ↗)
  trailing?: ReactNode;         // right-side glyph (default ↗); pass null to hide
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  style?: CSSProperties;
}) {
  const accent = TONE[tone];
  return (
    <ExternalLink
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 7,
        background: 'var(--bg-2)',
        borderLeft: `3px solid ${accent}`,
        border: '1px solid var(--line)',
        color: 'var(--fg-0)',
        fontWeight: 600,
        fontSize: 13,
        textDecoration: 'none',
        ...style,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span>
          {icon != null && <span style={{ color: accent, marginRight: 4 }}>{icon}</span>}
          {title}
        </span>
        {subtitle != null && (
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 400 }}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing != null && (
        <span style={{ fontSize: 16, color: accent, flexShrink: 0 }}>{trailing}</span>
      )}
    </ExternalLink>
  );
}
