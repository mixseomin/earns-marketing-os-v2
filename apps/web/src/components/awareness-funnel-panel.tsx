import { loadAwarenessFunnel } from '@/lib/projects/awareness-funnel';

function fmtUsd(n: number): string {
  if (n === 0) return '$0';
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '0';
  return n.toLocaleString();
}

function Sparkline({ values, color = 'var(--accent)', height = 28 }: { values: number[]; color?: string; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export async function AwarenessFunnelPanel() {
  const s = await loadAwarenessFunnel('cities.gg');
  if (!s) {
    return (
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Awareness Funnel — cities.gg</h2>
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>Bidvertiser pull pending — cron runs daily 06:00 UTC.</p>
      </div>
    );
  }

  const sparkSpend = s.daily.map(d => d.paid_spend_usd);
  const sparkVisits = s.daily.map(d => d.paid_visits);

  const cellHead: React.CSSProperties = { padding: '6px 10px', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)', textAlign: 'right', fontWeight: 500 };
  const cell: React.CSSProperties = { padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', textAlign: 'right' };

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: 0 }}>
          Awareness Funnel — cities.gg
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 10, letterSpacing: '0.06em' }}>
            // Bidvertiser daily · last data {s.last_day_date || '—'}
          </small>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiCard label="Spend 7d" value={fmtUsd(s.spend_7d_usd)} sub={`${fmtNum(s.paid_visits_7d)} visits`} />
        <KpiCard label="Spend 30d" value={fmtUsd(s.spend_30d_usd)} sub={`${fmtNum(s.paid_visits_30d)} visits`} />
        <KpiCard label="GA4 Paid (7d)" value={fmtNum(s.ga4_paid_7d)} sub={s.paid_visits_7d > 0 && s.ga4_paid_7d ? `${((s.ga4_paid_7d / s.paid_visits_7d) * 100).toFixed(0)}% tracked` : '—'} />
        <KpiCard label="GA4 Direct (7d)" value={fmtNum(s.ga4_direct_7d)} sub="organic spillover" />
        <KpiCard label="Viral ratio" value={s.viral_ratio_7d !== null ? s.viral_ratio_7d.toFixed(2) : '—'} sub="Direct ÷ Paid" highlight />
        <KpiCard label="Live now" value={s.realtime_30min !== null ? `${s.realtime_30min}` : '—'} sub={`${s.realtime_5min ?? '—'} in last 5m`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Spend / day · 30d</div>
          <Sparkline values={sparkSpend} color="var(--accent)" height={36} />
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Visits / day · 30d</div>
          <Sparkline values={sparkVisits} color="var(--ok)" height={36} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Engagement events (7d) · src cgg_events
        </div>
        {(() => {
          const eng = s.engagement_7d;
          const totalSessions = s.ga4_paid_7d ?? s.paid_visits_7d;
          const rate = (n: number) => totalSessions > 0 ? `${((n / totalSessions) * 100).toFixed(2)}%` : '—';
          const groups: Array<{ key: string; label: string }> = [
            { key: 'like',        label: 'Like' },
            { key: 'share',       label: 'Share' },
            { key: 'endcard_shown',    label: 'End-card shown' },
            { key: 'endcard_pick',     label: 'End-card pick' },
            { key: 'endcard_autonav',  label: 'End-card auto-nav' },
            { key: 'endcard_stay',     label: 'End-card stay' },
            { key: 'endcard_dismiss_esc',     label: 'End-card esc' },
            { key: 'endcard_dismiss_outside', label: 'End-card outside' },
            { key: 'pwa_prompt_shown',   label: 'PWA prompt shown' },
            { key: 'pwa_install_accept', label: 'PWA install ✓' },
            { key: 'pwa_install_dismiss',label: 'PWA dismiss' },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {groups.map(g => {
                const n = eng[g.key] ?? 0;
                const isNew = g.key.startsWith('endcard') || g.key.startsWith('pwa');
                return (
                  <div key={g.key} style={{
                    background: n > 0 ? 'var(--bg-2)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--line)',
                    borderRadius: 6, padding: '8px 10px',
                    opacity: n > 0 ? 1 : 0.55,
                  }}>
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                      {g.label}{isNew && <span style={{ marginLeft: 4, color: 'var(--neon-amber)' }}>•new</span>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                      {n.toLocaleString()}
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 6 }}>
                        {rate(n)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <details>
        <summary style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 6 }}>
          Top countries (7d) — {s.top_countries_7d.length}
        </summary>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
          <thead>
            <tr>
              <th style={{ ...cellHead, textAlign: 'left' }}>Country</th>
              <th style={cellHead}>Visits</th>
              <th style={cellHead}>Spend</th>
              <th style={cellHead}>CPC</th>
            </tr>
          </thead>
          <tbody>
            {s.top_countries_7d.map(c => (
              <tr key={c.country}>
                <td style={{ ...cell, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{c.country}</td>
                <td style={cell}>{fmtNum(c.visits)}</td>
                <td style={cell}>{fmtUsd(c.spend_usd)}</td>
                <td style={cell}>${c.cpc_usd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(59,130,246,0.08)' : 'var(--bg-2)',
      border: `1px solid ${highlight ? 'rgba(59,130,246,0.3)' : 'var(--line)'}`,
      borderRadius: 6, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? 'var(--accent)' : 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
