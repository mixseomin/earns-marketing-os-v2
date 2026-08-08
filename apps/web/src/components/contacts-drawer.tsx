'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { localDay } from '@/lib/local-day';
import { useTableSort, SortArrow, type SortableCol } from './ui/use-table-sort';

interface Contact { email: string; name: string; createdAt: string | null; excluded: boolean; unsubbed: boolean }
interface Data { total: number | null; offset: number; pageSize: number; contacts: Contact[]; source: string }

const mono: CSSProperties = { fontFamily: 'var(--font-mono)' };
const CONTACT_COLS: SortableCol<Contact>[] = [
  { key: 'email', sortValue: (c) => c.email.toLowerCase() },
  { key: 'joined', sortValue: (c) => c.createdAt },
  { key: 'status', sortValue: (c) => (c.unsubbed ? 'unsub' : c.excluded ? 'excluded' : 'active') },
];

// The actual contacts behind a site's Subs number. Paginated; search filters the loaded page.
export function ContactsDrawer({ domain, onClose }: { domain: string; onClose: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (off: number) => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/seo-sites/contacts?domain=${encodeURIComponent(domain)}&offset=${off}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'failed'); return; }
      setD(j);
    } catch { setErr('network error'); } finally { setLoading(false); }
  }, [domain]);
  useEffect(() => { load(offset); }, [load, offset]);

  const shown = (d?.contacts || []).filter((c) => !q || c.email.toLowerCase().includes(q.toLowerCase()));
  const s = useTableSort(shown, CONTACT_COLS, 'contacts');
  const total = d?.total ?? 0;
  const page = Math.floor(offset / (d?.pageSize || 50)) + 1;
  const pages = Math.max(1, Math.ceil(total / (d?.pageSize || 50)));

  const th: CSSProperties = { textAlign: 'left', padding: '5px 8px', color: 'var(--fg-3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg-2)' };
  const td: CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--line)', fontSize: 11.5 };
  const navBtn = (disabled: boolean): CSSProperties => ({ ...mono, fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: disabled ? 'var(--fg-3)' : 'var(--fg-1)', cursor: disabled ? 'default' : 'pointer' });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,94vw)', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', borderLeft: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>👥 {domain}</div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{total != null ? `${total.toLocaleString()} contacts` : ''} · {d?.source || ''}</div>
          </div>
          <button onClick={onClose} style={{ ...mono, fontSize: 14, border: 'none', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter this page by email…" spellCheck={false}
            style={{ ...mono, fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', width: '100%' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {err && <div style={{ padding: 16, fontSize: 12, color: '#d16b6b' }}>{err}</div>}
          {loading && !d && <div style={{ padding: 16, fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>}
          {d && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('email').onClick}>Email <SortArrow spec={s.thProps('email')} /></th>
                <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('joined').onClick}>Joined <SortArrow spec={s.thProps('joined')} /></th>
                <th style={{ ...th, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('status').onClick}>Status <SortArrow spec={s.thProps('status')} /></th>
              </tr></thead>
              <tbody>
                {s.sorted.map((c) => (
                  <tr key={c.email}>
                    <td style={{ ...td, ...mono }}>{c.email}</td>
                    <td style={{ ...td, ...mono, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{c.createdAt ? localDay(c.createdAt) : '—'}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {c.unsubbed ? <span style={{ ...mono, fontSize: 9, color: '#d16b6b' }}>unsub</span>
                        : c.excluded ? <span style={{ ...mono, fontSize: 9, color: '#e0a94a' }}>excluded</span>
                          : <span style={{ ...mono, fontSize: 9, color: '#5ac47e' }}>active</span>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={3} style={{ ...td, color: 'var(--fg-3)', textAlign: 'center' }}>No match on this page.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--line)' }}>
          <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>page {page} / {pages}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - (d?.pageSize || 50)))} style={navBtn(offset === 0 || loading)}>← prev</button>
            <button disabled={page >= pages || loading} onClick={() => setOffset(offset + (d?.pageSize || 50))} style={navBtn(page >= pages || loading)}>next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
