'use client';

// AccountReadinessChip — chip ở brief modal header thể hiện tầng 1 (account
// global status). Song song JoinChip cho membership tầng 2.
//
// Bug 2026-05-22: brief 11 có account=todo nhưng modal trông như account
// active (chip cũ nhỏ font-9, dễ miss). Giờ:
//   - account=active → KHÔNG render (mặc định OK, header sạch)
//   - account∈ready-ish (warming/limited) → chip warning vàng
//   - account∈dead (todo/creating/blocked/banned/dormant/defunct) → chip pulse đỏ
//
// Click chip → mở Account modal (onOpenAccount). Khác với JoinChip (click → scroll
// banner trong cùng modal): account fix ở modal khác hoàn toàn.

import { memo } from 'react';
import { accountStatusMeta } from '@/lib/status-meta';

export interface AccountReadinessChipProps {
  accountStatus: string;
  blockReason?: string | null;
  onClick?: () => void;
}

function AccountReadinessChipImpl({ accountStatus, blockReason, onClick }: AccountReadinessChipProps) {
  // Active = happy path, không render (header gọn).
  if (!accountStatus || accountStatus === 'active') return null;

  const meta = accountStatusMeta(accountStatus);
  const isDead = ['todo', 'creating', 'blocked', 'banned', 'dormant', 'defunct'].includes(accountStatus);
  const reasonSuffix = blockReason ? ` — ${blockReason}` : '';

  const tooltip =
    `Account tầng 1 (GLOBAL): ${meta.label} — ${meta.hint ?? ''}${reasonSuffix}\n` +
    `Đây là trạng thái account trên platform, KHÁC join community (tầng 2 — chip Join).\n` +
    (isDead
      ? 'Account chưa tồn tại / đã hỏng → KHÔNG thể tạo bài, đăng bài, hay join community. Click để mở Account modal fix.'
      : 'Account có thể dùng cảnh giác. Click để mở Account modal.');

  if (isDead) {
    // Loud chip — pulse, solid background đỏ/xám, font lớn rõ.
    return (
      <button type="button" onClick={onClick} title={tooltip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
                fontWeight: 700, color: '#0d1117', background: meta.color,
                border: `1px solid ${meta.color}`, borderRadius: 3,
                cursor: onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '.04em',
                animation: 'pulseWarn 2s ease-in-out infinite',
              }}>
        {meta.icon} {meta.label}
      </button>
    );
  }

  // Warming / limited = warning nhẹ (vẫn cảnh báo nhưng không pulse).
  return (
    <button type="button" onClick={onClick} title={tooltip}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 7px', fontSize: 9.5, fontFamily: 'var(--font-mono)',
              fontWeight: 700, color: meta.color, background: meta.color + '1a',
              border: `1px solid ${meta.color}66`, borderRadius: 3,
              cursor: onClick ? 'pointer' : 'default',
              textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
      {meta.icon} {meta.label}
    </button>
  );
}

export const AccountReadinessChip = memo(AccountReadinessChipImpl);
AccountReadinessChip.displayName = 'AccountReadinessChip';
