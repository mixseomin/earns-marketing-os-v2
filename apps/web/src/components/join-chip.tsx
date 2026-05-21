'use client';

// JoinChip — chip nhỏ hiển thị join status của 1 brief, dùng trong header
// modal/list để LUÔN VISIBLE (banner ở body có thể scroll out of view).
//
// Vấn đề trước fix 2026-05-22 #2: JoinStatusBanner ở modal-body khi joined =
// "ĐÃ JOIN" 1 dòng nhỏ — user mở phase tab xa không thấy → tưởng MOS2 không
// track join state. Giờ chip hiện ở HEADER cạnh habitat chip, click mở
// JoinStatusBanner popover.

import { memo } from 'react';
import {
  JOIN_STATUS_LABEL, JOIN_STATUS_COLOR, JOIN_STATUS_ICON,
  type JoinStatus,
} from '@/lib/join-status';

export interface JoinChipProps {
  joinStatus: JoinStatus;
  joinedAt: string | null;
  onClick?: () => void;
}

function JoinChipImpl({ joinStatus, joinedAt, onClick }: JoinChipProps) {
  const color = JOIN_STATUS_COLOR[joinStatus];
  const icon = JOIN_STATUS_ICON[joinStatus];
  const label = JOIN_STATUS_LABEL[joinStatus];
  const isJoined = joinStatus === 'joined';

  // Tooltip giải thích semantics — quan trọng vì user dễ confuse với
  // account.status hoặc currentPhase. Spell out 3-tầng model.
  const tooltip = isJoined
    ? `✓ Account đã trong community này${joinedAt ? ` (từ ${new Date(joinedAt).toLocaleDateString('vi-VN')})` : ''}.\n` +
      `Đây là tầng MEMBERSHIP per-habitat (KHÁC account.status global).\n` +
      `Click để sửa (đã rời / bị kick / cập nhật ghi chú).`
    : `${label}: Account CHƯA trong community này → seed sẽ FAIL.\n` +
      `Tầng MEMBERSHIP per-habitat (KHÁC account.status).\n` +
      `Click để cập nhật → joined / pending / rejected.`;

  // Joined = compact green chip. Không joined = nổi bật warning.
  if (isJoined) {
    return (
      <button type="button" onClick={onClick} title={tooltip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '1px 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)',
                fontWeight: 700, color, background: color + '1a',
                border: `1px solid ${color}55`, borderRadius: 3,
                cursor: onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
        {icon} đã join
      </button>
    );
  }

  // Chưa joined / pending / rejected / kicked / left → loud chip.
  return (
    <button type="button" onClick={onClick} title={tooltip}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
              fontWeight: 700, color: '#0d1117', background: color,
              border: `1px solid ${color}`, borderRadius: 3,
              cursor: onClick ? 'pointer' : 'default',
              textTransform: 'uppercase', letterSpacing: '.04em',
              animation: joinStatus === 'not_joined' ? 'pulseWarn 2s ease-in-out infinite' : undefined,
            }}>
      {icon} {label}
    </button>
  );
}

export const JoinChip = memo(JoinChipImpl);
JoinChip.displayName = 'JoinChip';
