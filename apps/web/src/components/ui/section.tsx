'use client';

// Section — collapsible section with header (title + chevron + optional badges
// + optional right-side actions) and body. Replaces ad-hoc expand/collapse
// patterns scattered in seeding-cockpit / accounts-vault / inbox-page / etc.
//
// Two modes:
//   1. Self-managed open state (default): pass `defaultOpen` only
//   2. Controlled: pass both `open` + `onToggle`
//
// Use for: "Issues", "Audit log", "Advanced settings", "Pre-deployment", any
// "header + collapsible body" pattern. NOT for navigation tabs (use Segmented).

import { useState, type ReactNode, type CSSProperties } from 'react';
import { IconChevron } from './icons';

export interface SectionProps {
  title: ReactNode;
  /** Optional right-aligned content in header (e.g. count badge, action buttons) */
  headerRight?: ReactNode;
  /** Optional subtitle/description shown under title when expanded */
  subtitle?: ReactNode;
  /** Controlled: pass both. Uncontrolled: omit and use defaultOpen. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** Color accent on chevron / left border (e.g. status-driven) */
  accent?: string;
  /** Disable collapse (always-open header) */
  static?: boolean;
  /** Body padding. Default '8px 0 12px' */
  bodyPadding?: string | number;
  /** Style on wrapper */
  style?: CSSProperties;
  /** Style on body wrapper */
  bodyStyle?: CSSProperties;
  children: ReactNode;
}

export function Section({
  title, headerRight, subtitle, open: openProp, onToggle, defaultOpen = true,
  accent, static: isStatic, bodyPadding, style, bodyStyle, children,
}: SectionProps) {
  const [openSelf, setOpenSelf] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openSelf;

  const toggle = () => {
    if (isStatic) return;
    const next = !open;
    if (isControlled) onToggle?.(next);
    else setOpenSelf(next);
    if (isControlled && onToggle) {/* user-managed */}
  };

  return (
    <div style={{
      borderLeft: accent ? `2px solid ${accent}` : undefined,
      paddingLeft: accent ? 10 : 0,
      ...style,
    }}>
      <div onClick={toggle}
           style={{
             display: 'flex', alignItems: 'center', gap: 8,
             cursor: isStatic ? 'default' : 'pointer',
             userSelect: 'none',
             padding: '4px 0',
           }}>
        {!isStatic && (
          <IconChevron size={12}
            style={{
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 120ms ease',
              color: accent ?? 'var(--fg-3)',
              flexShrink: 0,
            }} />
        )}
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>
          {title}
        </div>
        {headerRight && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {headerRight}
          </div>
        )}
      </div>
      {open && subtitle && (
        <div style={{ marginLeft: isStatic ? 0 : 20, fontSize: 10.5, color: 'var(--fg-4)', marginBottom: 4 }}>
          {subtitle}
        </div>
      )}
      {open && (
        <div style={{ padding: bodyPadding ?? '8px 0 12px', ...bodyStyle }}>{children}</div>
      )}
    </div>
  );
}
