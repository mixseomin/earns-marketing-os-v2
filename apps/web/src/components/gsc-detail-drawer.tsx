'use client';

import { useEffect, useState } from 'react';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';

type Q = { query: string; clicks: number; impressions: number; position: number; ctr?: number };

interface Props {
  domain: string;
  points: GscDailyPoint[];
  onClose: () => void;
  /** GA4 interaction events (7d) per event name, for the breakdown section. */
  interactions?: Record<string, number> | null;
}

type Range = 7 | 30 | 90;

export function GscDetailDrawer({ domain, points, onClose, interactions }: Props) {
  const [range, setRange] = useState<Range>(30);
  const [queries, setQueries] = useState<{ google: Q[]; bing: Q[] } | null>(null);
  const [qLoading, setQLoading] = useState(true);
  const [tab, setTab] = useState<'google' | 'bing'>('google');

  useEffect(() => {
    let alive = true;
    setQLoading(true);
    fetch(`/api/seo/queries?domain=${encodeURIComponent(domain)}&days=${range}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setQueries({ google: j.google || [], bing: j.bing || [] }); })
      .catch(() => { if (alive) setQueries({ google: [], bing: [] }); })
      .finally(() => { if (alive) setQLoading(false); });
    return () => { alive = false; };
  }, [domain, range]);

  const filtered = points.slice(-range);
  const totalClicks = filtered.reduce((s, p) => s + p.clicks, 0);
  const totalImps = filtered.reduce((s, p) => s + p.impressions, 0);
  const avgPos = filtered.length
    ? filtered.reduce((s, p) => s + p.position * p.impressions, 0) / Math.max(1, totalImps)
    : 0;
  const ctr = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;

  return (
    <div
      onClick={onClose}
      className="gsc-drawer-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="gsc-drawer-body"
        style={{
          width: 'min(820px, 100%)',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-strong)',
          borderRadius: 10,
          padding: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, fontFamily: 'var(--font-sans)', margin: '0 0 4px', fontWeight: 600 }}>
              GSC · {domain}
            </h2>
            <small style={{ color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              last {filtered.length} days · ends {filtered[filtered.length - 1]?.date ?? '—'}
            </small>
          </div>
          <button onClick={onClose} style={btnStyle}>✕</button>
        </div>

        {/* Range tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                ...btnStyle,
                background: range === r ? 'var(--accent)' : 'var(--bg-2)',
                color: range === r ? 'var(--bg-0)' : 'var(--fg-1)',
                fontWeight: range === r ? 700 : 400,
              }}
            >
              {r}d
            </button>
          ))}
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <Kpi label="Impressions" value={totalImps.toLocaleString()} accent="var(--neon-cyan)" />
          <Kpi label="Clicks" value={totalClicks.toLocaleString()} accent="var(--ok)" />
          <Kpi label="CTR" value={`${ctr.toFixed(2)}%`} />
          <Kpi label="Avg position" value={avgPos > 0 ? avgPos.toFixed(1) : '—'} />
        </div>

        {/* Main chart */}
        <MultiLineChart points={filtered} />

        <div style={{ marginTop: 12, color: 'var(--fg-4)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          impressions (cyan) · clicks (lime) · position right-axis (amber, lower=better)
        </div>

        {/* Interactions breakdown (GA4 custom events, 7d) */}
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 13, fontFamily: 'var(--font-sans)', margin: '0 0 10px', fontWeight: 600 }}>
            Interactions <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 11, fontFamily: 'var(--font-mono)' }}>· GA4 events · last 7d</span>
          </h3>
          {interactions && Object.keys(interactions).length > 0 ? (() => {
            const entries = Object.entries(interactions).sort((a, b) => b[1] - a[1]);
            const max = entries[0]?.[1] ?? 1;
            const sum = entries.reduce((s, [, n]) => s + n, 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.map(([name, n]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <span style={{ width: 160, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>{name}</span>
                    <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 3, height: 14 }}>
                      <div style={{ width: `${(n / max) * 100}%`, background: '#ec4899', height: '100%', borderRadius: 3, minWidth: 2 }} />
                    </div>
                    <span style={{ width: 60, textAlign: 'right', color: 'var(--fg-1)', fontWeight: 600 }}>{n.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ marginTop: 4, color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  total {sum.toLocaleString()}
                </div>
              </div>
            );
          })() : (
            <div style={{ color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              No interaction events in the last 7 days (site not instrumented, or no activity yet).
            </div>
          )}
        </div>

        {/* Top queries */}
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontFamily: 'var(--font-sans)', margin: 0, fontWeight: 600 }}>Top queries</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['google', 'bing'] as const).map((t) => {
                const n = queries?.[t]?.length ?? 0;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      ...btnStyle,
                      background: tab === t ? 'var(--accent)' : 'var(--bg-2)',
                      color: tab === t ? 'var(--bg-0)' : 'var(--fg-1)',
                      fontWeight: tab === t ? 700 : 400,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t} {n > 0 && <span style={{ opacity: 0.7, marginLeft: 4 }}>{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <QueryTable rows={queries?.[tab] ?? []} loading={qLoading} source={tab} />
        </div>
      </div>
    </div>
  );
}

function QueryTable({ rows, loading, source }: { rows: Q[]; loading: boolean; source: 'google' | 'bing' }) {
  if (loading) return <div style={{ color: 'var(--fg-3)', fontSize: 11, padding: 16, textAlign: 'center' }}>loading…</div>;
  if (!rows.length) return (
    <div style={{ color: 'var(--fg-3)', fontSize: 11, padding: 16, textAlign: 'center' }}>
      no query data yet {source === 'bing' ? '— Bing needs ~2 weeks of data per site' : ''}
    </div>
  );
  const head: React.CSSProperties = { fontSize: 9, color: 'var(--fg-3)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, padding: '4px 8px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-mono)' };
  const cell: React.CSSProperties = { fontSize: 11, padding: '4px 8px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-mono)' };
  return (
    <div style={{ maxHeight: 360, overflowY: 'auto', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Query</th>
            <th style={head}>Impr</th>
            <th style={head}>Clicks</th>
            <th style={head}>CTR</th>
            <th style={head}>Pos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.query}>
              <td style={{ ...cell, textAlign: 'left', color: 'var(--fg-1)' }}>{r.query}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{r.impressions.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'right', color: r.clicks > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{r.clicks}</td>
              <td style={{ ...cell, textAlign: 'right', color: 'var(--fg-2)' }}>
                {r.ctr != null ? (r.ctr * 100).toFixed(1) + '%' : (r.impressions ? ((r.clicks / r.impressions) * 100).toFixed(1) + '%' : '—')}
              </td>
              <td style={{ ...cell, textAlign: 'right', color: r.position > 0 && r.position < 20 ? 'var(--ok)' : 'var(--fg-2)' }}>{r.position?.toFixed(1) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6,
  padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
  color: 'var(--fg-1)',
};

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', color: accent || 'var(--fg-1)', marginTop: 2, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function MultiLineChart({ points }: { points: GscDailyPoint[] }) {
  const W = 760, H = 220, padL = 36, padR = 38, padT = 8, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  if (points.length < 2) return <div style={{ color: 'var(--fg-3)', fontSize: 11, padding: 30, textAlign: 'center' }}>Not enough data yet — need ≥ 2 days.</div>;

  const imps = points.map((p) => p.impressions);
  const clicks = points.map((p) => p.clicks);
  const positions = points.map((p) => p.position);

  const impMax = Math.max(...imps, 1);
  const posMax = Math.max(...positions, 1);
  const posMin = Math.min(...positions);

  const xOf = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const yLeft = (v: number, max: number) => padT + innerH - (v / max) * innerH;
  const yRight = (v: number) => padT + ((v - posMin) / Math.max(0.1, posMax - posMin)) * innerH;

  const pathImps = imps.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yLeft(v, impMax).toFixed(1)}`).join(' ');
  const pathClicks = clicks.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yLeft(v, impMax).toFixed(1)}`).join(' ');
  const pathPos = positions.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yRight(v).toFixed(1)}`).join(' ');

  // X-axis date ticks: ~6 ticks max
  const tickStep = Math.max(1, Math.floor(points.length / 6));
  const xTicks = points.filter((_, i) => i % tickStep === 0 || i === points.length - 1);

  // Y-axis grid (left, impressions)
  const yGrid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
      {/* grid */}
      {yGrid.map((g, i) => {
        const y = padT + innerH * (1 - g);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={padL - 6} y={y + 3} fontSize="9" fill="var(--fg-3)" textAnchor="end" fontFamily="var(--font-mono)">
              {Math.round(impMax * g).toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* x ticks */}
      {xTicks.map((p, idx) => {
        const i = points.indexOf(p);
        const x = xOf(i);
        const short = p.date.slice(5); // MM-DD
        return (
          <text key={idx} x={x} y={H - padB + 14} fontSize="9" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--font-mono)">
            {short}
          </text>
        );
      })}

      {/* lines */}
      <path d={pathImps} fill="none" stroke="var(--neon-cyan)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={pathClicks} fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={pathPos} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 2" />

      {/* right-axis label for position (top/bottom) */}
      <text x={W - padR + 4} y={padT + 8} fontSize="9" fill="var(--accent)" fontFamily="var(--font-mono)">
        pos {posMax.toFixed(0)}
      </text>
      <text x={W - padR + 4} y={H - padB - 2} fontSize="9" fill="var(--accent)" fontFamily="var(--font-mono)">
        pos {posMin.toFixed(0)}
      </text>
    </svg>
  );
}
