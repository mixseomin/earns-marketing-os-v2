'use client';

// HabitatKindChip — chip hiển thị kind của habitat (subreddit/discord/fb-group/...).
// Centralize glyph + label trong lib/habitat-kind-meta.ts.

import type { CSSProperties } from 'react';
import { getHabitatKindLabel, getHabitatKindGlyph } from '@/lib/habitat-kind-meta';

export interface HabitatKindChipProps {
  kind: string | null | undefined;
  size?: 'sm' | 'md';
  /** Hiện glyph [r/] / [D] / ... trước label. */
  showGlyph?: boolean;
  /** Hiện label "Subreddit"/"Discord"/... (default true). */
  showLabel?: boolean;
  title?: string;
}

export function HabitatKindChip({
  kind, size = 'md', showGlyph = false, showLabel = true, title,
}: HabitatKindChipProps) {
  const label = getHabitatKindLabel(kind);
  const glyph = getHabitatKindGlyph(kind);
  const sz = size === 'sm'
    ? { padX: 5, padY: 1, font: 9 }
    : { padX: 7, padY: 2, font: 10 };
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: `${sz.padY}px ${sz.padX}px`, fontSize: sz.font, fontWeight: 700,
    fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 3, textTransform: 'uppercase', letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style} title={title ?? label}>
      {showGlyph && <span style={{ color: 'var(--fg-4)' }}>{glyph}</span>}
      {showLabel && <span>{label}</span>}
    </span>
  );
}
