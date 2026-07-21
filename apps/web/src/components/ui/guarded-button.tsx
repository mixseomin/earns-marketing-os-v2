'use client';

// GuardedButton — the house standard for an action button that must NOT fire until its precondition holds.
// Pass `reason` = why it's blocked (empty/falsy = allowed). When blocked it disables itself, dims, and shows
// the reason on hover — instead of a bare `disabled` (no explanation) or a silent onClick no-op / toast.
// Use for every send/submit/save/mark-done button: <GuardedButton reason={!body.trim() ? 'Nhập nội dung trước' : ''}>.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function GuardedButton({ reason, disabled, title, onClick, children, style, ...rest }: {
  reason?: string | false | null;   // truthy = blocked; the text becomes the hover explanation
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const why = reason && String(reason).trim() ? String(reason) : '';
  const blocked = !!disabled || !!why;
  return (
    <button
      {...rest}
      type={rest.type || 'button'}
      onClick={blocked ? undefined : onClick}
      disabled={blocked}
      aria-disabled={blocked}
      title={why || title}
      style={{ ...style, ...(blocked ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
    >
      {children}
    </button>
  );
}
