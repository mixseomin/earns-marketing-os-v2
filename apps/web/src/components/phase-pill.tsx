'use client';

// PhasePill — chip phase chung. Centralize PHASE_COLOR + PHASE_LABEL render
// để mọi nơi cùng style; sửa 1 chỗ → mọi nơi cập nhật.
//
// Use cases:
//   <PhasePill phase="warm-up" />                                  // chip cơ bản (uppercase mono, dot=hint)
//   <PhasePill phase="value" current />                            // current=true → dot glow
//   <PhasePill phase="seed" size="sm" />                           // size sm cho list dense
//   <PhasePill phase="bridge" variant="outlined" />                // outlined (filled mặc định)
//   <PhasePill phase="direct" current title={multilineTooltip} />
//
// 4 modes nhau: full chip / outlined ring / current+dot / static-text only.

import type { CSSProperties } from 'react';
import { PHASE_COLOR, PHASE_LABEL, type Phase } from '@/lib/phase-plan';

export interface PhasePillProps {
  phase: Phase;
  /** Có active dot phía trước (current phase). */
  current?: boolean;
  size?: 'sm' | 'md';
  /** 'filled' (default): nền nhạt + viền. 'outlined': chỉ viền, transparent.
   *  'text': chỉ text màu phase, không bg/border (cho inline trong sentence). */
  variant?: 'filled' | 'outlined' | 'text';
  title?: string;
  /** Wrap div onClick — opt-in cho clickable pill. */
  onClick?: () => void;
  /** Override label nếu cần (vd "+1 → Warm-up" trong notification). */
  labelOverride?: string;
}

const SIZE: Record<NonNullable<PhasePillProps['size']>, {
  padX: number; padY: number; font: number; dotSize: number; gap: number;
}> = {
  sm: { padX: 6, padY: 1, font: 9,  dotSize: 5, gap: 4 },
  md: { padX: 8, padY: 2, font: 10, dotSize: 6, gap: 5 },
};

export function PhasePill({
  phase, current = false, size = 'md', variant = 'filled', title, onClick, labelOverride,
}: PhasePillProps) {
  const color = PHASE_COLOR[phase];
  const label = labelOverride ?? PHASE_LABEL[phase];
  const sz = SIZE[size];

  const baseStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: sz.gap,
    padding: variant === 'text' ? 0 : `${sz.padY}px ${sz.padX}px`,
    fontSize: sz.font, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.04em',
    fontFamily: 'var(--font-mono)',
    color,
    borderRadius: 3,
    background: variant === 'filled' ? `${color}22` : 'transparent',
    border: variant === 'text' ? 'none' : `1px solid ${color}${variant === 'outlined' ? '88' : '66'}`,
    cursor: onClick ? 'pointer' : title ? 'help' : 'default',
    whiteSpace: 'nowrap',
  };

  return (
    <span style={baseStyle} title={title} onClick={onClick}>
      {current && (
        <span style={{
          width: sz.dotSize, height: sz.dotSize, borderRadius: sz.dotSize,
          background: color, boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  );
}
