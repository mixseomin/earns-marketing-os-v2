// Pill — universal small label primitive used for status, priority,
// effort, and any "category badge" need. Replaces the inline span-with-
// background-tint pattern that was duplicated across /tests, /roadmap,
// AccountsVault, etc.
//
// Visual: <color>22 background tint + colored text in mono uppercase by default.
// Soft tone is the default (low contrast); use 'solid' for emphasis.

import type { CSSProperties, ReactNode } from 'react';

export type PillTone = 'soft' | 'solid' | 'ghost';
export type PillSize = 'xs' | 'sm' | 'md';

export interface PillProps {
  color: string;            // CSS color (#hex, var(--*), rgba)
  icon?: ReactNode;
  label: ReactNode;
  tone?: PillTone;          // default 'soft'
  size?: PillSize;          // default 'sm'
  uppercase?: boolean;      // default true
  mono?: boolean;           // default true
  title?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const SIZE_PADDING: Record<PillSize, string> = {
  xs: '0 4px',
  sm: '1px 6px',
  md: '2px 8px',
};
const SIZE_FONT: Record<PillSize, number> = { xs: 9, sm: 10, md: 11 };

export function Pill({
  color, icon, label, tone = 'soft', size = 'sm',
  uppercase = true, mono = true, title, style, onClick,
}: PillProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: SIZE_PADDING[size],
    borderRadius: 3,
    fontSize: SIZE_FONT[size],
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
    textTransform: uppercase ? 'uppercase' : 'none',
    letterSpacing: uppercase ? '0.04em' : 'normal',
    fontWeight: 600,
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ...(tone === 'soft'  ? { background: `${color}22`, color }
      : tone === 'solid' ? { background: color, color: 'var(--bg-0)' }
      :                    { color, border: `1px solid ${color}66`, background: 'transparent' }),
    ...style,
  };

  return (
    <span style={baseStyle} title={title} onClick={onClick}>
      {icon != null && <span style={{ fontSize: SIZE_FONT[size] + 1, lineHeight: 1 }}>{icon}</span>}
      <span>{label}</span>
    </span>
  );
}

// ── PriorityPill ───────────────────────────────────────────────
export type Priority = 'critical' | 'high' | 'medium' | 'low';

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: '#f87171', high: '#fbbf24', medium: '#a1a1aa', low: '#6b7280',
};

export function PriorityPill({ priority, size = 'xs' }: { priority: Priority; size?: PillSize }) {
  return <Pill color={PRIORITY_COLOR[priority]} label={priority} size={size} title={`Priority: ${priority}`} />;
}

// ── EffortPill ─────────────────────────────────────────────────
export type Effort = 'XS' | 'S' | 'M' | 'L' | 'XL';

const EFFORT_COLOR: Record<Effort, string> = {
  XS: '#10b981', S: '#10b981', M: '#fbbf24', L: '#fb923c', XL: '#f87171',
};
const EFFORT_LABEL: Record<Effort, string> = {
  XS: 'XS · <1h', S: 'S · 1d', M: 'M · 3d', L: 'L · 1w', XL: 'XL · >1w',
};

export function EffortPill({ effort, size = 'xs' }: { effort: Effort; size?: PillSize }) {
  return <Pill color={EFFORT_COLOR[effort]} label={effort} size={size} mono uppercase={false} title={EFFORT_LABEL[effort]} />;
}

// ── StatusPill ─────────────────────────────────────────────────
// Generic status pill — caller passes the status meta from their context
// (use_cases meta, roadmap meta, account meta — all have {icon, label, color}).
export interface StatusMeta {
  icon: ReactNode;
  label: string;
  color: string;
}

export function StatusPill({ meta, size = 'xs', onClick }: { meta: StatusMeta; size?: PillSize; onClick?: () => void }) {
  return <Pill color={meta.color} icon={meta.icon} label={meta.label} size={size} onClick={onClick} />;
}
