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

// Account state có 3 mức semantically khác nhau — UI khác nhau:
//   "never-created"   = todo/creating: account CHƯA TỒN TẠI trên platform. Action
//                       = TẠO MỚI. Màu xanh dương (info, task-to-do, không phải
//                       error). Icon ➕. Wording "Cần tạo account trước".
//   "platform-broken" = blocked/banned/dormant/defunct: account đã tạo nhưng đã
//                       hỏng. Action = APPEAL / SWAP. Màu đỏ pulse (error nặng).
//   "needs-attention" = warming/limited: account active nhưng cần cảnh giác.
//                       Màu vàng warm (warning nhẹ, không pulse).
type AccountTier = 'never-created' | 'platform-broken' | 'needs-attention' | 'ready';

function tierOf(status: string): AccountTier {
  if (status === 'todo' || status === 'creating') return 'never-created';
  if (status === 'blocked' || status === 'banned'
    || status === 'dormant' || status === 'defunct') return 'platform-broken';
  if (status === 'warming' || status === 'limited') return 'needs-attention';
  return 'ready';
}

function AccountReadinessChipImpl({ accountStatus, blockReason, onClick }: AccountReadinessChipProps) {
  // Active = happy path, không render (header gọn).
  if (!accountStatus || accountStatus === 'active') return null;

  const meta = accountStatusMeta(accountStatus);
  const tier = tierOf(accountStatus);
  const reasonSuffix = blockReason ? ` — ${blockReason}` : '';

  // ── 1. NEVER-CREATED: todo/creating ─────────────────────────────────
  // Account chưa được tạo trên platform → đây là task TO-DO, không phải
  // lỗi. Màu xanh dương (info). Icon ➕. Hướng dẫn "Cần tạo".
  if (tier === 'never-created') {
    const isCreating = accountStatus === 'creating';
    const wording = isCreating ? 'Đang tạo' : 'Cần tạo';
    const tooltip =
      `Account tầng 1 (GLOBAL): ${wording} account trên platform.\n` +
      (isCreating
        ? 'Đang trong quá trình đăng ký (verify email/KYC/2FA...). Hoàn tất bước cuối → đổi status sang "active".'
        : 'Account CHƯA tồn tại trên platform. Phải lên platform → đăng ký → ghi credential vào Account modal.') +
      '\n\nClick để mở Account modal (signup link + form điền credential).';
    return (
      <button type="button" onClick={onClick} title={tooltip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 9px', fontSize: 10, fontFamily: 'var(--font-mono)',
                fontWeight: 700, color: '#fff', background: '#3b82f6',
                border: '1px solid #2563eb', borderRadius: 3,
                cursor: onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '.04em',
                // Pulse nhẹ vì task chưa làm — gentle attention, không alarming.
                animation: 'pulseInfo 2.4s ease-in-out infinite',
              }}>
        ➕ {wording} acc
      </button>
    );
  }

  // ── 2. PLATFORM-BROKEN: blocked/banned/dormant/defunct ──────────────
  // Account đã tạo nhưng platform khoá / đã chết. Đỏ pulse alarming.
  if (tier === 'platform-broken') {
    const tooltip =
      `Account tầng 1 (GLOBAL): ${meta.label}${reasonSuffix}\n${meta.hint ?? ''}\n\n` +
      'Account đã tạo nhưng platform đã khoá / kick. Action: appeal mod hoặc swap sang account khác.\n' +
      'Click mở Account modal để xem chi tiết block_reason + lịch sử.';
    return (
      <button type="button" onClick={onClick} title={tooltip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
                fontWeight: 700, color: '#0d1117', background: meta.color,
                border: `1px solid ${meta.color}`, borderRadius: 3,
                cursor: onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '.04em',
                animation: 'pulseDanger 1.4s ease-in-out infinite',
              }}>
        {meta.icon} {meta.label}
      </button>
    );
  }

  // ── 3. NEEDS-ATTENTION: warming/limited ─────────────────────────────
  // Account vẫn dùng được nhưng cảnh giác. Vàng nhẹ, không pulse.
  const tooltip =
    `Account tầng 1 (GLOBAL): ${meta.label} — ${meta.hint ?? ''}${reasonSuffix}\n` +
    'Account dùng được nhưng cần thận trọng. Click để xem chi tiết.';
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
