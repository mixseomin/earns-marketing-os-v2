'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshGscBtn() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setMsg('Refreshing GSC + AdSense + GA4 + Bing…');
    try {
      const r = await fetch('/api/admin/refresh-gsc', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) {
        setMsg(data.error || 'Failed');
        setBusy(false);
        return;
      }
      const okCount = (data.results || []).filter((x: { ok: boolean }) => x.ok).length;
      const total = (data.results || []).length;
      setMsg(`✓ ${okCount}/${total} sources · ${data.updated_at ? new Date(data.updated_at).toLocaleTimeString() : 'done'}`);
      startTransition(() => router.refresh());
      setTimeout(() => setMsg(null), 6000);
    } catch (e) {
      setMsg(`Lỗi: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {msg && (
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: msg.startsWith('✓') ? 'var(--ok)' : 'var(--fg-3)' }}>
          {msg}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title="Force-pull tất cả: GSC + Bing + AdSense + GA4 views + GA4 realtime"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-1)',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ display: 'inline-block', transition: 'transform .4s', transform: busy ? 'rotate(360deg)' : 'none' }}>↻</span>
        {busy ? 'Refreshing…' : 'Refresh All'}
      </button>
    </div>
  );
}
