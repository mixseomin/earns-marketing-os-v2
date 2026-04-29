import Link from 'next/link';
import { PROJECTS, SHARED_POOL } from '@/lib/mock/projects';
import { MODES } from '@/lib/mock/modes';

const healthColor = (h: number) => (h > 80 ? 'var(--ok)' : h > 65 ? 'var(--warn)' : 'var(--bad)');

export function PortfolioView() {
  const totalAgents = PROJECTS.reduce((s, p) => s + p.agents.core, 0) + SHARED_POOL.total;
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budget, 0);
  const avgHealth = Math.round(PROJECTS.reduce((s, p) => s + p.health, 0) / PROJECTS.length);
  const totalAlerts = PROJECTS.reduce((s, p) => s + p.alerts, 0);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            Portfolio
            <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 400, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>// {PROJECTS.length} PROJECTS · {totalAgents} AGENTS · MISSION OS</small>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', margin: '4px 0 0' }}>Tổng quan hoạt động của tất cả dự án. Click vào project để drill-down.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ appearance: 'none', background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>⟲ Sync all</button>
          <button style={{ appearance: 'none', background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📥 Export report</button>
          <button style={{ appearance: 'none', background: 'var(--accent)', color: 'var(--bg-0)', border: 0, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ New Project</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { lbl: 'Total Projects', val: PROJECTS.length, delta: '3 modes running', color: 'var(--accent)' },
          { lbl: 'Total Agents', val: totalAgents, delta: `${SHARED_POOL.available} shared avail.`, color: 'var(--neon-lime)' },
          { lbl: 'Avg Health', val: `${avgHealth}%`, delta: '3 projects warn', color: avgHealth > 80 ? 'var(--ok)' : 'var(--warn)' },
          { lbl: 'Daily Budget', val: `${totalBudget}tr`, delta: 'across projects', color: 'var(--neon-amber)' },
          { lbl: 'Open Alerts', val: totalAlerts, delta: 'need attention', color: 'var(--bad)' },
        ].map((k) => (
          <div key={k.lbl} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.lbl}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', flexShrink: 0 }}>
          🤖 AGENT POOL <span style={{ color: 'var(--fg-4)' }}>// hybrid model</span>
        </div>
        <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          {PROJECTS.map((p) => {
            const pct = (p.agents.core / totalAgents) * 100;
            return <div key={p.id} style={{ width: `${pct}%`, height: '100%', background: p.color, opacity: 0.8 }} title={`${p.name}: ${p.agents.core} core`}></div>;
          })}
          <div style={{ flex: 1, background: 'var(--neon-violet)', opacity: 0.5 }} title={`Shared pool: ${SHARED_POOL.total}`}></div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', flexShrink: 0 }}>
          {SHARED_POOL.available} <span style={{ color: 'var(--ok)' }}>avail</span> · {SHARED_POOL.busy} busy · {SHARED_POOL.total} shared pool
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {PROJECTS.map((p) => {
          const mode = MODES[p.mode];
          const h = p.health;
          const hc = healthColor(h);
          const utilization = Math.round((p.agents.core / (p.agents.core + p.agents.shared)) * 100);
          return (
            <Link key={p.id} href={`/p/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ background: 'var(--bg-1)', border: `1px solid ${h < 75 ? 'rgba(255,176,60,.25)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 22 }}>{p.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-0)' }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>{mode?.label || p.mode} · {p.agents.core} core + {p.agents.shared} shared</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: hc, fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: hc, boxShadow: `0 0 6px ${hc}` }}></span>
                      {h}%
                    </div>
                    {p.alerts > 0 && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: 'var(--bad)', color: '#fff' }}>⚠ {p.alerts} alerts</span>
                    )}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue / KPI</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', fontVariantNumeric: 'tabular-nums' }}>{p.revenue}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ok)' }}>{p.kpi}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget / day</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>{p.budget > 0 ? `${p.budget}tr` : '—'}</div>
                    <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (p.budget / totalBudget) * 100 * 5)}%`, background: p.color }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Agents</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>{p.agents.core} <small style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>+{p.agents.shared}</small></div>
                    <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${utilization}%`, background: p.color }}></div>
                    </div>
                  </div>
                </div>
                <div style={{ height: 3, background: 'var(--bg-3)' }}>
                  <div style={{ height: '100%', width: `${h}%`, background: hc }}></div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }}></span>
            Health Score Comparison
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.04em', fontWeight: 400 }}>// tất cả projects</span>
          </div>
        </div>
        <div style={{ padding: 14 }}>
          {PROJECTS.map((p, i) => {
            const hc = healthColor(p.health);
            return (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 50px', gap: 10, alignItems: 'center', padding: '5px 0', borderBottom: i < PROJECTS.length - 1 ? '1px dashed var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{p.emoji}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.health}%`, background: hc, transition: 'width .3s' }}></div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: hc, textAlign: 'right' }}>{p.health}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
