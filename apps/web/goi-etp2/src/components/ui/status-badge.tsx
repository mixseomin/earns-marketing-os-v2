// StatusBadge — thin wrapper around Pill that takes a StatusInfo from
// /lib/status-meta.ts. Lets callers write:
//
//   <StatusBadge meta={accountStatusMeta(status)} />
//
// instead of repeating Pill props inline. Title (tooltip) auto-falls
// back to meta.hint if not overridden.
//
// Use this for any "show status with consistent style" need. For
// non-status badges (tags, categories), use <Pill> directly.

import { Pill, type PillSize, type PillTone } from './pill';
import type { StatusInfo } from '@/lib/status-meta';

export interface StatusBadgeProps {
  meta: StatusInfo;
  size?: PillSize;
  tone?: PillTone;
  /** Override meta.hint */
  title?: string;
  /** Render only icon, hide label. Useful when label is shown elsewhere */
  iconOnly?: boolean;
  /** Click handler — turns badge into button */
  onClick?: () => void;
}

export function StatusBadge({
  meta, size = 'xs', tone = 'soft', title, iconOnly, onClick,
}: StatusBadgeProps) {
  return (
    <Pill
      color={meta.color}
      icon={meta.icon}
      label={iconOnly ? '' : meta.label}
      size={size}
      tone={tone}
      title={title ?? meta.hint}
      onClick={onClick}
    />
  );
}
