'use client';

import { useState } from 'react';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';

interface Props {
  domain: string;
  points: GscDailyPoint[];
  onClose: () => void;
}

type Range = 7 | 30 | 90;

export function GscDetailDrawer({ domain, points, onClose }: Props) {
  const [range, setRange] = useState<Range>(30);

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
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
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
      </div>
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
