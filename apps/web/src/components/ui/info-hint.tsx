'use client';

// InfoHint — ẩn mô tả/comment dài, hover hiện NGAY (0ms, CSS thuần, không
// dùng native title). Thay cho các đoạn page-sub / "// chú thích" dài làm
// rối UI. Dùng: <InfoHint>Giải thích…</InfoHint> cạnh tiêu đề/label.

import type { ReactNode } from 'react';
import { IconInfo } from './icons';

export function InfoHint({
  children, size = 13, align = 'left', label,
}: {
  children: ReactNode;
  size?: number;
  align?: 'left' | 'right';
  label?: string;            // a11y: mô tả ngắn cho screen-reader/title fallback
}) {
  return (
    <span className="info-hint" tabIndex={0} role="note" aria-label={label ?? 'Thông tin'}>
      <IconInfo size={size} />
      <span className={`info-hint__pop${align === 'right' ? ' right' : ''}`}>{children}</span>
    </span>
  );
}
