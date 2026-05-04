import type { Mode, Kpi } from '@/lib/mock/types';
import { Sparkline, RevenueChart, HourBars } from './charts';
import { ResourceStrip } from './resource-strip';
import type { Project } from '@/lib/mock/types';
import { AISuggestionsPanel } from './ai-suggestions-panel';

const HOUR_DATA = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, '0')}h`,
  value: [3, 2, 2, 1, 1, 2, 4, 8, 12, 14, 16, 14, 13, 15, 18, 22, 25, 28, 24, 20, 16, 12, 8, 5][i] ?? 0,
  now: i === 7,
}));

function KPICell({ k }: { k: Kpi }) {
  return (
    <div className="kpi" data-tone={k.primary ? 'primary' : ''}>
      <div className="kpi-label"><span>{k.label}</span><span className="mono">{k.unit}</span></div>
      <div className="kpi-val">{k.val}{k.suffix && <small>{k.suffix}</small>}</div>
      <div className={`kpi-delta ${k.tone || 'flat'}`}>
        {k.tone === 'up' ? '▲ ' : k.tone === 'down' ? '▼ ' : ''}{k.delta}
      </div>
      <div className="kpi-spark"><Sparkline data={k.spark ?? []} color={k.color} /></div>
    </div>
  );
}

export function Dashboard({ mode, project }: { mode: Mode; project?: Project }) {
  const m = mode;
  const revData = (m.revData ?? []).map((d) => ({ ...d, rev: d.rev * 1_000_000, target: d.target * 1_000_000 }));
  // Demo projects (project.isDemo===true): render full mock dashboard cho design preview.
  // Real projects: render only DB data — mock KPIs/chart/suggestions/topList ẩn,
  // hiện EmptyState để user không bị mislead.
  const isDemo = project?.isDemo === true;
  const isBlank = !isDemo;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {m.pageTitle}
            <small>// 29 APR 2026 • T2 • 07:42 GMT+7 • {m.label.toUpperCase()}</small>
          </h1>
          <p className="page-sub">{isBlank ? 'Blank slate — bắt đầu thêm squads, cards, alerts qua UI để dashboard có dữ liệu.' : m.pageSub}</p>
        </div>
        <div className="page-actions">
          <button className="btn"><span>⟲</span> Refresh</button>
          <button className="btn"><span>📥</span> Export</button>
          <button className="btn primary"><span>›</span> Đi tới {m.boardTitle}</button>
        </div>
      </div>

      {m.kpis.length > 0 && (
        <div className="kpi-grid">
          {m.kpis.map((k, i) => <KPICell key={i} k={k} />)}
        </div>
      )}

      {/* ResourceStrip: demos giữ mock, real projects show DB counts (Accounts/Contacts/Knowledge). */}
      <ResourceStrip projectId={project?.id} isDemo={isDemo} />

      {m.revChart && revData.length > 0 && (
        <div className="row r-2">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title"><span className="dot"></span>{m.revChart.title} <small>{m.revChart.sub}</small></div>
              <div className="flex gap-2 center">
                <span className="chip" data-active="true">7D</span>
                <span className="chip">14D</span>
                <span className="chip">30D</span>
                <span className="chip">QTD</span>
              </div>
            </div>
            <div className="panel-body">
              <div className="chart"><RevenueChart data={revData} /></div>
              <div className="flex gap-3 center" style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 2, background: 'var(--accent)' }}></span>
                  Actual
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 0, borderTop: '1px dashed var(--fg-3)' }}></span>
                  Target
                </span>
                <span className="grow"></span>
                <span>{m.revChart.footMTD}</span><span>•</span>
                <span>{m.revChart.footGoal}</span><span>•</span>
                <span style={{ color: 'var(--ok)' }}>{m.revChart.footPace}</span>
              </div>
            </div>
          </div>
          {m.suggestions && m.suggestions.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="dot" style={{ background: 'var(--neon-violet)', boxShadow: '0 0 6px var(--neon-violet)' }}></span>
                  AI Suggestions <small>// xếp theo impact</small>
                </div>
                <span className="chip">{m.suggestions.length}</span>
              </div>
              <div className="panel-body dense">
                <div className="sugg-list">
                  {m.suggestions.map((s, i) => (
                    <div key={i} className="sugg">
                      <div className="sugg-icon">{s.icon}</div>
                      <div className="sugg-body">
                        <div className="sugg-title">{s.title}</div>
                        <div className="sugg-meta">{s.meta} • <span style={{ color: 'var(--accent)' }}>{s.agent}</span></div>
                      </div>
                      <div className="sugg-actions">
                        <button className="btn primary">Approve</button>
                        <button className="btn">…</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isBlank && (
      <div className="row r-23">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <span className="dot" style={{ background: 'var(--neon-amber)', boxShadow: '0 0 6px var(--neon-amber)' }}></span>
              Hourly throughput <small>// activity/hour</small>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>NOW 07h</div>
          </div>
          <div className="panel-body">
            <div className="chart" style={{ height: 140 }}><HourBars data={HOUR_DATA} /></div>
            <div className="flex gap-3" style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              <span>Peak: <b style={{ color: 'var(--fg-0)' }}>17h (28)</b></span><span>•</span>
              <span>Today: <b style={{ color: 'var(--fg-0)' }}>87 actions</b></span><span>•</span>
              <span style={{ color: 'var(--ok)' }}>Pace +14% vs 7d avg</span>
            </div>
          </div>
        </div>
        {m.topList && m.topList.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="dot" style={{ background: 'var(--neon-lime)', boxShadow: '0 0 6px var(--neon-lime)' }}></span>
                {m.topListTitle} <small>{m.topListSub}</small>
              </div>
              <button className="chip">View all ›</button>
            </div>
            <div className="panel-body dense">
              <div className="tlist">
                <div className="tlist-row" style={{ background: 'var(--bg-2)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 12px' }}>
                  {(m.topListCols ?? []).map((c, i) => (
                    <span key={i} style={{ textAlign: i === 0 || i === 1 ? 'left' : 'right' }}>{c}</span>
                  ))}
                </div>
                {m.topList.map((w) => (
                  <div key={w.rank} className="tlist-row">
                    <div className="tlist-rank">{String(w.rank).padStart(2, '0')}</div>
                    <div className="tlist-title">
                      <b>{w.title}</b>
                      <span>{w.niche}</span>
                    </div>
                    <div className="tlist-num ok">{w.a}</div>
                    <div className="tlist-num">{w.b}</div>
                    <div className="tlist-bar"><span style={{ width: `${w.bar * 100}%` }}></span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {!isBlank && (
      <div className="row">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <span className="dot" style={{ background: 'var(--neon-cyan)' }}></span>
              Squad Health <small>// {m.squads.length} squads • {m.label}</small>
            </div>
            <div className="flex gap-2">
              <span className="chip" data-active="true">All</span>
              <span className="chip">Live only</span>
              <span className="chip">⚠ Warnings</span>
            </div>
          </div>
          <div className="panel-body">
            <div className="squad-grid">
              {m.squads.map((s) => {
                const utilization = Math.round((s.active / s.agents) * 100);
                const healthColors = {
                  ok:   { bg: 'rgba(182,255,60,.08)',  fg: 'var(--ok)',   border: 'rgba(182,255,60,.3)' },
                  warn: { bg: 'rgba(255,176,60,.1)',   fg: 'var(--warn)', border: 'rgba(255,176,60,.3)' },
                  bad:  { bg: 'rgba(255,77,94,.12)',   fg: 'var(--bad)',  border: 'rgba(255,77,94,.3)' },
                } as const;
                const hc = healthColors[s.health];
                return (
                  <div key={s.id} className="squad-card">
                    <div className="squad-card-head">
                      <div className="squad-card-icon" style={{ borderColor: s.color, color: s.color }}>{s.icon}</div>
                      <div className="squad-card-name">
                        <b>{s.name}</b>
                        <span>{s.vi}</span>
                      </div>
                      <span className="grow"></span>
                      <span className="tag" style={{ background: hc.bg, color: hc.fg, borderColor: hc.border }}>
                        {s.health.toUpperCase()}
                      </span>
                    </div>
                    <div className="squad-card-stats">
                      <div className="squad-stat"><span>Active</span><b>{s.active}/{s.agents}</b></div>
                      <div className="squad-stat"><span>Tasks/h</span><b>{Math.round(s.active * 4.2)}</b></div>
                      <div className="squad-stat"><span>Util</span><b className={utilization > 90 ? 'warn' : 'ok'}>{utilization}%</b></div>
                    </div>
                    <div className="squad-card-bar">
                      <span style={{ width: `${utilization}%`, background: s.color }}></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {isBlank && project && project.id !== 'cities-gg' && (
        <div className="row r-2" style={{ marginTop: 16 }}>
          <AISuggestionsPanel projectId={project.id} />
          <div className="panel">
            <div className="panel-body" style={{ padding: 32, textAlign: 'center', color: 'var(--fg-2)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
              <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Real project · {project.name}</h2>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                Cards: {m.cards.length} · Squads: {m.squads.length} · Alerts: {m.alerts.length}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-3)' }}>
                AI Suggestions panel ↗ đang chạy gpt-4o-mini với context từ project.
                {' '}KPI grid + Revenue chart + Top Winners cần revenue_events table — phase tới.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
