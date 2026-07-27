'use client';
import { useCallback, useEffect, useState } from 'react';
import { CoursesBrowser } from './courses-browser';

interface Item {
  id: number; project_id: string; title: string; instructions: string;
  screenshot_url: string | null; prep_payload: {
    targetType?: string; targetUrl?: string; dimension?: string; assignedTo?: string;
    reporter?: string; thread?: Array<{ by: string; kind: string; action?: string; note: string; at: string }>;
  }; status: string; claimed_by: string | null; notes: string | null; created_at: string;
}

const STATUSES = ['pending', 'in_progress', 'done', 'rejected'] as const;
const badge: Record<string, string> = { pending: '#ffb03c', in_progress: '#38bdf8', done: '#10b981', rejected: '#ff4d5e' };

export function ReviewQueue({ reviewer }: { reviewer: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<Record<number, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tab, setTab] = useState<'queue' | 'courses'>('queue');

  const load = useCallback(async () => {
    const qs = statusFilter === 'open' ? '' : `?status=${statusFilter}`;
    const r = await fetch('/api/review' + qs, { cache: 'no-store' });
    const j = await r.json();
    let list: Item[] = j.items || [];
    if (statusFilter === 'open') list = list.filter((x) => x.status === 'pending' || x.status === 'in_progress');
    setItems(list);
  }, [statusFilter]);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const act = async (id: number, action: string) => {
    setBusy(id);
    await fetch(`/api/review/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: note[id] || '', feedback: note[id] || '' }),
    });
    setNote((n) => ({ ...n, [id]: '' }));
    setBusy(null);
    load();
  };

  const mediaUrl = (u: string) => (u.startsWith('http') || u.startsWith('/') ? u : '/' + u);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--fg-0)', padding: '20px', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>🔍 Review</h1>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>reviewer: {reviewer}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setTab('queue')} className="btn" style={{ fontSize: 12.5, padding: '6px 12px', opacity: tab === 'queue' ? 1 : 0.5 }}>Queue</button>
            <button onClick={() => setTab('courses')} className="btn" style={{ fontSize: 12.5, padding: '6px 12px', opacity: tab === 'courses' ? 1 : 0.5 }}>Courses</button>
          </div>
        </div>

        {tab === 'courses' && <CoursesBrowser />}

        {tab === 'queue' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['open', ...STATUSES] as string[]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className="btn"
                style={{ fontSize: 12, padding: '5px 10px', opacity: statusFilter === s ? 1 : 0.55 }}>{s}</button>
            ))}
          </div>
        )}

        {tab === 'queue' && items.length === 0 && <div style={{ color: 'var(--fg-3)', padding: 30, textAlign: 'center' }}>No review items.</div>}

        {tab === 'queue' && items.map((it) => (
          <div key={it.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 12, background: 'var(--bg-1)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: badge[it.status] || 'var(--fg-3)', border: `1px solid ${badge[it.status] || 'var(--line)'}`, borderRadius: 4, padding: '1px 7px' }}>{it.status}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{it.project_id}</span>
              {it.prep_payload?.dimension && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>· {it.prep_payload.dimension}</span>}
              {it.prep_payload?.assignedTo === 'ai' && <span style={{ fontSize: 11, color: '#a78bfa' }}>· 🤖 AI</span>}
              <b style={{ fontSize: 14 }}>{it.title}</b>
              {it.prep_payload?.targetUrl && <a href={it.prep_payload.targetUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--neon-cyan, #38bdf8)', marginLeft: 'auto' }}>open target ↗</a>}
            </div>
            {it.instructions && <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{it.instructions}</div>}
            {it.screenshot_url && (
              <img src={mediaUrl(it.screenshot_url)} alt="" onClick={() => setLightbox(mediaUrl(it.screenshot_url!))}
                style={{ maxWidth: 320, borderRadius: 6, border: '1px solid var(--line)', cursor: 'zoom-in', display: 'block', marginBottom: 8 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            {it.prep_payload?.thread && it.prep_payload.thread.length > 0 && (
              <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 10, margin: '8px 0', fontSize: 12 }}>
                {it.prep_payload.thread.map((t, i) => (
                  <div key={i} style={{ color: 'var(--fg-2)', marginBottom: 3 }}>
                    <b>{t.by}</b> {t.kind === 'machine' ? '🤖' : ''} <span style={{ color: 'var(--fg-3)' }}>{t.action}</span>: {t.note}
                  </div>
                ))}
              </div>
            )}
            {it.status !== 'done' && it.status !== 'rejected' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <input value={note[it.id] || ''} onChange={(e) => setNote((n) => ({ ...n, [it.id]: e.target.value }))}
                  placeholder="comment / resolution note…" style={{ flex: 1, minWidth: 180, padding: '6px 9px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)' }} />
                {it.status === 'pending' && <button className="btn" disabled={busy === it.id} onClick={() => act(it.id, 'claim')} style={{ fontSize: 12 }}>Claim</button>}
                <button className="btn" disabled={busy === it.id} onClick={() => act(it.id, 'comment')} style={{ fontSize: 12 }}>Comment</button>
                <button className="btn primary" disabled={busy === it.id} onClick={() => act(it.id, 'resolve')} style={{ fontSize: 12 }}>Resolve</button>
                <button className="btn" disabled={busy === it.id} onClick={() => act(it.id, 'reject')} style={{ fontSize: 12, color: '#ff4d5e' }}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out', zIndex: 100 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '96vw', maxHeight: '96vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
