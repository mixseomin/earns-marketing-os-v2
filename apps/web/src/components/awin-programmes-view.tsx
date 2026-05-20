'use client';

import { useMemo, useState } from 'react';
import type { AwinProgramme } from '@/lib/awin/programmes';

type Props = { programmes: AwinProgramme[] };

const STATUS_TONE: Record<string, string> = {
  active: 'var(--ok)',
  pending: 'var(--neon-violet, #a78bfa)',
  paused: 'var(--warn)',
};

export function AwinProgrammesView({ programmes }: Props) {
  const [status, setStatus] = useState<'all' | 'active' | 'pending' | 'paused'>('active');
  const [region, setRegion] = useState<string>('all');
  const [query, setQuery] = useState('');

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const p of programmes) if (p.region) set.add(p.region);
    return Array.from(set).sort();
  }, [programmes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programmes.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (region !== 'all' && p.region !== region) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.vertical?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [programmes, status, region, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: programmes.length, active: 0, pending: 0, paused: 0 };
    for (const p of programmes) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [programmes]);

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', fontWeight: 500 };

  const pill: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', borderRadius: 999, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--bg-1)' };
  const pillActive: React.CSSProperties = { ...pill, background: 'var(--bg-2)', borderColor: 'var(--fg-2)', color: 'var(--fg-1)' };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, margin: 0 }}>
          Awin Programmes
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 12, letterSpacing: '0.06em' }}>
            // {programmes.length} synced from Awin pub 410323
          </small>
        </h1>
        <a href="https://ui.awin.com/awin/publisher/410323/partnerships/explore" target="_blank" rel="noreferrer"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neon-violet, #a78bfa)', textDecoration: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px' }}>
          Open Awin →
        </a>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['active', 'pending', 'paused', 'all'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} style={status === s ? pillActive : pill}>
            {s} <span style={{ color: 'var(--fg-3)', marginLeft: 4 }}>{counts[s] ?? 0}</span>
          </button>
        ))}
        <select value={region} onChange={(e) => setRegion(e.target.value)}
          style={{ background: 'var(--bg-1)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <option value="all">all regions</option>
          {regions.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search name / vertical"
          style={{ background: 'var(--bg-1)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1, minWidth: 200 }} />
      </div>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr><th style={head}></th><th style={head}>Merchant</th><th style={head}>Status</th><th style={head}>Vertical</th><th style={head}>Region</th><th style={head}>Cur</th><th style={head}>Links</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ ...cell, color: 'var(--fg-3)', textAlign: 'center', padding: 24 }}>No programmes match filter.</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id}>
                <td style={cell}>
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain', background: '#fff' }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-2)', fontSize: 11, display: 'grid', placeItems: 'center', color: 'var(--fg-3)' }}>{p.name.charAt(0)}</div>
                  )}
                </td>
                <td style={cell}>
                  <div style={{ fontWeight: 600, color: 'var(--fg-1)' }} title={p.description ?? ''}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>mid {p.mid}{p.validDomains.length > 0 ? ` · ${p.validDomains[0]}` : ''}</div>
                </td>
                <td style={cell}>
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-2)', color: STATUS_TONE[p.status] ?? 'var(--fg-2)', fontSize: 10, fontWeight: 600 }}>
                    {p.status}
                  </span>
                  {p.awinStatus && p.awinStatus !== 'Active' && (
                    <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 2 }}>awin: {p.awinStatus}</div>
                  )}
                </td>
                <td style={cell}>{p.vertical ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                <td style={cell} title={p.regionName ?? ''}>{p.region ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                <td style={cell}>{p.currency ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                <td style={cell}>
                  {p.displayUrl && (
                    <a href={p.displayUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-2)', marginRight: 8 }} title="Merchant site">↗</a>
                  )}
                  {p.affiliateUrl && (
                    <a href={p.affiliateUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-violet, #a78bfa)' }} title="Affiliate deeplink (cread.php)">aff</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
        Sync runs daily at 08:37 +07 via awin-sync-programmes.timer. Notes column stores raw Awin JSON behind <code>[awin-sync] {'{...}'}</code> marker.
      </div>
    </div>
  );
}
