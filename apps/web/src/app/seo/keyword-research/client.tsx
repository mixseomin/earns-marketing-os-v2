'use client';

import { useState } from 'react';

type Result = {
  query: string;
  avg_exact_3mo: number;
  avg_broad_3mo: number;
  history: Array<{ month: string; exact: number; broad: number }>;
  related: Array<{ query: string; impressions: number; broad: number }>;
};

export function KeywordResearchClient() {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('us');
  const [language, setLanguage] = useState('en-US');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/bing/keyword?q=${encodeURIComponent(q)}&country=${country}&language=${language}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      setData(j);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally { setLoading(false); }
  }

  const max = data?.history.length ? Math.max(...data.history.map((p) => p.broad)) : 0;
  const sparkW = 600, sparkH = 80;

  return (
    <div>
      <form onSubmit={run} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="enter keyword — e.g. 'forex trading'"
          autoFocus autoComplete="off"
          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 13 }}
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ padding: '8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 12 }}>
          <option value="us">US</option><option value="gb">UK</option><option value="ca">CA</option><option value="au">AU</option><option value="de">DE</option><option value="vn">VN</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: '8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 12 }}>
          <option value="en-US">en-US</option><option value="en-GB">en-GB</option><option value="vi-VN">vi-VN</option>
        </select>
        <button type="submit" disabled={loading} style={{ padding: '8px 18px', border: 0, borderRadius: 6, background: 'var(--accent)', color: 'var(--bg-0)', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {err && <div style={{ padding: 12, background: 'var(--bg-1)', border: '1px solid var(--bad)', borderRadius: 6, color: 'var(--bad)', fontSize: 12, marginBottom: 16 }}>Error: {err}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { lbl: '3mo avg exact', val: data.avg_exact_3mo.toLocaleString(), tone: 'var(--neon-lime)' },
              { lbl: '3mo avg broad', val: data.avg_broad_3mo.toLocaleString(), tone: 'var(--accent)' },
              { lbl: 'data months', val: String(data.history.length), tone: 'var(--neon-amber)' },
              { lbl: 'related queries', val: String(data.related.length), tone: 'var(--neon-violet)' },
            ].map((k) => (
              <div key={k.lbl} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.lbl}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.tone, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
              </div>
            ))}
          </div>

          {data.history.length > 0 && (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
                Monthly trend — &ldquo;{data.query}&rdquo;
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 10 }}>// broad impressions, last {data.history.length} months</small>
              </h2>
              <svg viewBox={`0 0 ${sparkW} ${sparkH}`} width="100%" height={sparkH} style={{ display: 'block' }}>
                {data.history.map((p, i) => {
                  const x = (i / Math.max(1, data.history.length - 1)) * sparkW;
                  const y = sparkH - (max ? (p.broad / max) * (sparkH - 4) : 0) - 2;
                  return <circle key={i} cx={x} cy={y} r={2} fill="var(--accent)" />;
                })}
                {data.history.length > 1 && (
                  <polyline
                    points={data.history.map((p, i) => {
                      const x = (i / (data.history.length - 1)) * sparkW;
                      const y = sparkH - (max ? (p.broad / max) * (sparkH - 4) : 0) - 2;
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.6}
                  />
                )}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', marginTop: 4 }}>
                <span>{data.history[0]?.month}</span>
                <span>peak: {max.toLocaleString()}</span>
                <span>{data.history[data.history.length - 1]?.month}</span>
              </div>
            </div>
          )}

          {data.related.length > 0 && (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
                Related queries
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 10 }}>// click to drill in</small>
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Query</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Impressions</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Broad</th>
                  </tr>
                </thead>
                <tbody>
                  {data.related.slice(0, 50).map((r) => (
                    <tr key={r.query} onClick={() => { setQ(r.query); }} style={{ cursor: 'pointer' }}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', color: 'var(--fg-1)' }}>{r.query}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: 'var(--fg-2)' }}>{r.impressions.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: 'var(--fg-2)' }}>{r.broad.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
