'use client';

// StatusFlag — primitive cho boolean state badge.
//
// Reusable cho mọi flag state hiển thị compact (channel skip_for_post,
// account banned, habitat AI-detection, etc.).
//
// 2 size: 'icon' (square icon-only, 16×16, dùng trong row dày) và 'label'
// (icon + text label, dùng standalone hoặc khi cần text rõ).
//
// 4 tone: 'bad' (red — block/banned/forbidden), 'warn' (amber — caution),
// 'ok' (green — confirmed/active), 'info' (blue — neutral marker).
//
// Anti-pattern thay thế: KHÔNG inline style `display:inline-flex; padding:1px 6px;
// background:rgba(...); border:1px solid rgba(...)` mỗi nơi nữa — dùng primitive.

import type { CSSProperties } from 'react';

export type StatusFlagTone = 'bad' | 'warn' | 'ok' | 'info';
export type StatusFlagSize = 'icon' | 'label';

export interface StatusFlagProps {
  icon: string;              // emoji hoặc 1-2 ký tự (vd '🚫', '⚠', '✓', '🤖')
  label?: string;            // text khi size='label'; bỏ qua khi 'icon'
  tone?: StatusFlagTone;     // default 'bad'
  size?: StatusFlagSize;     // default 'icon'
  title?: string;            // tooltip — bắt buộc khi 'icon' để user hiểu nghĩa
  onClick?: () => void;      // optional — click toggle off / mở edit
  style?: CSSProperties;     // override extras (vd marginLeft)
}

const TONE_COLORS: Record<StatusFlagTone, { fg: string; bg: string; border: string }> = {
  bad:  { fg: 'var(--bad)',    bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)' },
  warn: { fg: 'var(--warn)',   bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.4)'  },
  ok:   { fg: 'var(--ok)',     bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.4)'   },
  info: { fg: 'var(--accent)', bg: 'var(--accent-soft)',      border: 'var(--accent-line)'    },
};

export function StatusFlag({
  icon, label, tone = 'bad', size = 'icon', title, onClick, style,
}: StatusFlagProps) {
  const colors = TONE_COLORS[tone];
  const isIcon = size === 'icon';
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isIcon ? 0 : 3,
    background: colors.bg,
    color: colors.fg,
    border: `1px solid ${colors.border}`,
    borderRadius: 3,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    ...(isIcon
      ? { width: 16, height: 16, fontSize: 10 }
      : { padding: '1px 6px', fontSize: 9 }),
    ...style,
  };
  const handler = onClick
    ? (e: React.MouseEvent) => { e.stopPropagation(); onClick(); }
    : undefined;
  return (
    <span title={title} style={baseStyle} onClick={handler}>
      <span>{icon}</span>
      {!isIcon && label && <span>{label}</span>}
    </span>
  );
}
