'use client';

// ConfirmDeleteButton — destructive action với 2-click confirm + visual armed
// state. Wrapper around useConfirmDelete hook. Replaces inline pattern
// `{confirmDelete ? { animation: 'pulseDanger 1s ...' } : undefined}` in 9+
// files (brief-edit-modal, accounts-vault, habitat-form-modal, etc.).
//
// Usage:
//   <ConfirmDeleteButton onDelete={handleDelete} disabled={busy}
//                        labelIdle="🗑 Xoá brief" labelArmed="⚠ Click lần nữa" />
//
// CSS keyframe `pulseDanger` should be defined in globals.css. Fallback inline.

import type { CSSProperties, ReactNode } from 'react';
import { useConfirmDelete } from '@/lib/use-confirm-delete';

export interface ConfirmDeleteButtonProps {
  onDelete: () => void;
  disabled?: boolean;
  /** Default '🗑 Delete' */
  labelIdle?: ReactNode;
  /** Default '⚠ Click again to confirm' */
  labelArmed?: ReactNode;
  /** Default 4000 ms */
  windowMs?: number;
  /** Tooltip text. Auto split for idle/armed if string contains ' / ' */
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** Disable visual pulse (for compact contexts) */
  noPulse?: boolean;
}

export function ConfirmDeleteButton({
  onDelete, disabled,
  labelIdle = '🗑 Delete',
  labelArmed = '⚠ Click again to confirm',
  windowMs, title, className, style, noPulse,
}: ConfirmDeleteButtonProps) {
  const del = useConfirmDelete(onDelete, windowMs);

  const [tIdle, tArmed] = title?.split(' / ') ?? [];

  return (
    <button
      type="button"
      className={className ?? 'btn danger'}
      onClick={del.trigger}
      disabled={disabled}
      title={del.confirming ? (tArmed || 'Click again to confirm permanent deletion') : (tIdle || title || 'Delete')}
      style={{
        ...(del.confirming && !noPulse
          ? { animation: 'pulseDanger 1s ease-in-out infinite' }
          : undefined),
        ...style,
      }}>
      {del.confirming ? labelArmed : labelIdle}
    </button>
  );
}
