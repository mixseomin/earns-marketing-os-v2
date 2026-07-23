'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Refresh just the SteamSolo panel: revalidate its cache tag, then re-render this route.
export function RefreshSteamsoloBtn() {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/admin/refresh-steamsolo', { method: 'POST' });
      startTransition(() => router.refresh());
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Refresh SteamSolo stats"
      style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
        padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
        cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ display: 'inline-block', transition: 'transform .4s', transform: busy ? 'rotate(360deg)' : 'none' }}>↻</span>
      {busy ? '…' : 'Refresh'}
    </button>
  );
}
