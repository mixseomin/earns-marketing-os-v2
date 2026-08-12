import { loadAwarenessFunnel } from '@/lib/projects/awareness-funnel';
import { Panel } from './ui/panel';
import { StatsStrip } from './ui/stats-strip';
import { AwarenessFunnelTable } from './awareness-funnel-table';

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
      <Panel title="Awareness Funnel — cities.gg">
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>Bidvertiser pull pending — cron runs daily 06:00 UTC.</p>
      </Panel>
    );
  }

  const sparkSpend = s.daily.map(d => d.paid_spend_usd);
  const sparkVisits = s.daily.map(d => d.paid_visits);

  return (
    <Panel
      title="Awareness Funnel — cities.gg"
      subtitle={`Bidvertiser daily · last data ${s.last_day_date || '—'}`}
    >

      <StatsStrip minColWidth={160} cards={[
        { key: 'spend7', label: 'Spend 7d', value: fmtUsd(s.spend_7d_usd), sub: `${fmtNum(s.paid_visits_7d)} visits` },
        { key: 'spend30', label: 'Spend 30d', value: fmtUsd(s.spend_30d_usd), sub: `${fmtNum(s.paid_visits_30d)} visits` },
        { key: 'ga4paid', label: 'GA4 Paid (7d)', value: fmtNum(s.ga4_paid_7d), sub: s.paid_visits_7d > 0 && s.ga4_paid_7d ? `${((s.ga4_paid_7d / s.paid_visits_7d) * 100).toFixed(0)}% tracked` : '—' },
        { key: 'ga4direct', label: 'GA4 Direct (7d)', value: fmtNum(s.ga4_direct_7d), sub: 'organic spillover' },
        { key: 'viral', label: 'Viral ratio', value: s.viral_ratio_7d !== null ? s.viral_ratio_7d.toFixed(2) : '—', sub: 'Direct ÷ Paid', color: 'var(--accent)' },
        { key: 'live', label: 'Live now', value: s.realtime_30min !== null ? `${s.realtime_30min}` : '—', sub: `${s.realtime_5min ?? '—'} in last 5m` },
      ]} />

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
            <StatsStrip minColWidth={150} cards={groups.map(g => {
              const n = eng[g.key] ?? 0;
              const isNew = g.key.startsWith('endcard') || g.key.startsWith('pwa');
              return { key: g.key, label: <>{g.label}{isNew && <span style={{ marginLeft: 4, color: 'var(--neon-amber)' }}>•new</span>}</>, value: n.toLocaleString(), sub: rate(n) };
            })} />
          );
        })()}
      </div>

      <details>
        <summary style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 6 }}>
          Top countries (7d) — {s.top_countries_7d.length}
        </summary>
        <AwarenessFunnelTable rows={s.top_countries_7d} />
      </details>
    </Panel>
  );
}

