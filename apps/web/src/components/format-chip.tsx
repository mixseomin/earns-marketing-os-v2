'use client';

// FormatChip — chip content_type (text/image/video/link/thread/poll/carousel/
// story/doc). Centralize formatMeta + formatColors render thay vì inline
// mỗi nơi.

import type { CSSProperties } from 'react';
import { formatMeta, formatColors } from '@/lib/content-formats';
import { FormatIcon } from './ui';

export interface FormatChipProps {
  contentType: string;
  size?: 'sm' | 'md';
  /** Hiện icon trước label (default true). */
  showIcon?: boolean;
  /** Hiện label (default true). False = icon-only. */
  showLabel?: boolean;
  title?: string;
  onClick?: () => void;
  /** 'filled' (default): bg-soft + border. 'text': chỉ icon+text màu format. */
  variant?: 'filled' | 'text';
}

export function FormatChip({
  contentType, size = 'md', showIcon = true, showLabel = true,
  title, onClick, variant = 'filled',
}: FormatChipProps) {
  const meta = formatMeta(contentType);
  const col = formatColors(contentType);
  const sz = size === 'sm'
    ? { padX: 5, padY: 1, font: 9,  icon: 10 }
    : { padX: 7, padY: 2, font: 10, icon: 12 };
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: variant === 'text' ? 0 : `${sz.padY}px ${sz.padX}px`,
    fontSize: sz.font, fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: col.fg,
    background: variant === 'filled' ? col.bg : 'transparent',
    border: variant === 'filled' ? `1px solid ${col.border}` : 'none',
    borderRadius: 3,
    cursor: onClick ? 'pointer' : title ? 'help' : 'default',
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style} title={title ?? meta.label} onClick={onClick}>
      {showIcon && <FormatIcon kind={contentType} size={sz.icon} />}
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
