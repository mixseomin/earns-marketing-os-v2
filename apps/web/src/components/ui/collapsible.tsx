'use client';

import { useState, type ReactNode } from 'react';

// Collapsible section — header chứa title + badge + hint (muted text bên
// phải), body ẩn/hiện theo defaultOpen. Open/close KHÔNG persist — reset
// mỗi lần parent remount. Dùng trong form modals (accounts, habitat,
// brief) để gom subsection (notes / warmup checklist / image specs).
export function Collapsible({
  title, badge, defaultOpen = false, children, hint, marginTop = 10,
}: {
  title: ReactNode;
  badge?: ReactNode;
  hint?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  marginTop?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fg-1)', fontSize: 12, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--fg-3)', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {badge}
        <span style={{ flex: 1 }} />
        {hint && <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{hint}</span>}
      </button>
      {open && <div style={{ padding: '4px 12px 12px', borderTop: '1px solid var(--line)' }}>{children}</div>}
    </div>
  );
}
