'use client';

import { useState, useTransition } from 'react';
import { assignAccountProject } from '@/lib/actions/unmapped';
import type { UnmappedAccountRow } from '@/lib/data';

type ProjOpt = { id: string; name: string; emoji?: string | null };

export function UnmappedPage({ accounts, projects }: { accounts: UnmappedAccountRow[]; projects: ProjOpt[] }) {
  const [rows, setRows] = useState(accounts);
  const [sel, setSel] = useState<Record<number, string>>(() => {
    const first = projects[0]?.id ?? '';
    return Object.fromEntries(accounts.map((a) => [a.id, first]));
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string>('');
  const [, startTransition] = useTransition();

  const assign = (id: number) => {
    const pid = sel[id];
    if (!pid) { setErr('Chọn project trước'); return; }
    setBusy(id); setErr('');
    startTransition(async () => {
      const r = await assignAccountProject(id, pid);
      setBusy(null);
      if (r.ok) setRows((prev) => prev.filter((a) => a.id !== id));
      else setErr(r.error || 'Lỗi gán project');
    });
  };

  return (
    <div style={{ padding: 20, maxWidth: 880 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>⚠ Unmapped accounts</h1>
      <p style={{ color: 'var(--fg-3)', fontSize: 13, margin: '0 0 16px' }}>
        Account đã detect nhưng <b>chưa thuộc project nào</b> (thiếu junction) → vô hình trên dashboard, seeding bị khóa. Gán project để kích hoạt.
      </p>

      {err && <div style={{ color: 'var(--warn, #fbbf24)', fontSize: 13, marginBottom: 10 }}>{err}</div>}

      {rows.length === 0 ? (
        <div style={{ color: 'var(--fg-4)', fontSize: 14, padding: '24px 0' }}>✅ Không có account mồ côi — tất cả đã map project.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-1)' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', minWidth: 70 }}>{a.platformKey}</span>
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 120 }}>{a.handle ? `@${a.handle}` : <em style={{ color: 'var(--fg-4)' }}>(no handle)</em>}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', padding: '2px 7px', border: '1px solid var(--line)', borderRadius: 10 }}>{a.status || 'todo'}</span>
              <select
                value={sel[a.id] ?? ''}
                onChange={(e) => setSel((s) => ({ ...s, [a.id]: e.target.value }))}
                style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--line)', minWidth: 160 }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{(p.emoji ? p.emoji + ' ' : '') + (p.name || p.id)}</option>
                ))}
              </select>
              <button
                onClick={() => assign(a.id)}
                disabled={busy === a.id}
                style={{ fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--neon-lime, #84cc16)', color: '#0a0a0a', opacity: busy === a.id ? 0.6 : 1 }}
              >
                {busy === a.id ? '⏳ Assigning…' : 'Assign'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
