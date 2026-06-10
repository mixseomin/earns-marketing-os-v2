import Link from 'next/link';
import { SHARED_POOL } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import { SeoSitesPanel } from './seo-sites-panel';
import { AwinDailyPanel } from './awin-daily-panel';
import { PortfolioGrid } from './portfolio-grid';

export function PortfolioView({ projects: PROJECTS }: { projects: Project[] }) {
  const totalAgents = PROJECTS.reduce((s, p) => s + p.agents.core, 0) + SHARED_POOL.total;
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budget, 0);
  const avgHealth = PROJECTS.length > 0 ? Math.round(PROJECTS.reduce((s, p) => s + p.health, 0) / PROJECTS.length) : 0;
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
          <Link href="/p/new" style={{ appearance: 'none', background: 'var(--accent)', color: 'var(--bg-0)', border: 0, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>+ New Project</Link>
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

      {/* SEO Sites Overview — GSC live data for monitored sites */}
      <SeoSitesPanel />

      {/* Awin Daily Route — reminder to run the apply-extension batch */}
      <AwinDailyPanel />

      <PortfolioGrid projects={PROJECTS} totalBudget={totalBudget} />
    </div>
  );
}
