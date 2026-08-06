import type { ReactNode, CSSProperties } from 'react';

// Panel — the house dashboard CARD. The look (dark card + hairline border + a
// title with a `// mono` subtitle + right-aligned actions) was hand-rolled in
// ~50 places (bg-1 / border line / radius 8 / padding 16 / marginBottom 16).
// This is the single source. Extracted verbatim from the SEO Sites Overview
// panel — the reference the standard was lifted from (that file stays untouched).
//
// Server-compatible on purpose (no 'use client', no hooks/handlers): most panels
// that use it are async server components. Actions/children can still be client.
export function Panel({
  title,
  subtitle,
  actions,
  children,
  pad = 16,
  className,
  style,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;        // shown as `// {subtitle}` in mono fg-3, inside the title line
  actions?: ReactNode;         // right side of the header row
  children: ReactNode;
  pad?: number | string;       // override padding (rare); default 16 = --s-4
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      data-comp="ui.Panel"
      className={className}
      style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: pad, marginBottom: 16, ...style }}
    >
      {(title != null || actions != null) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {title != null && (
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: 0 }}>
              {title}
              {subtitle != null && (
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 10, letterSpacing: '0.06em' }}>// {subtitle}</small>
              )}
            </h2>
          )}
          {actions != null && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
