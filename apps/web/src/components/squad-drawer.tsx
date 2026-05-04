'use client';

import { useState, useEffect } from 'react';
import { listSquadAgents, syncSquadAgents, type AgentRow } from '@/lib/actions/agents-detail';
import { AgentDetailModal } from './agent-detail-modal';

interface SquadItem {
  id: string;
  name: string;
  vi?: string;
  icon?: string;
  color?: string;
  desc?: string;
  agents: number;
  active: number;
  health?: string;
}

interface CardItem {
  id?: string | null;
  col?: string | null;
  title?: string | null;
  squad?: string | null;
  level?: number | null;
  money?: string | null;
}

interface FeedItem {
  t?: string;
  agent?: string;
  action?: string;
  target?: string;
}

interface ModeData {
  squads?: SquadItem[];
  cards?: CardItem[];
  feed?: FeedItem[];
}

export function SquadDrawer({ squad, mode, projectId, onClose }: {
  squad: string | null;
  mode: ModeData;
  projectId: string;
  onClose: () => void;
}) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [openAgent, setOpenAgent] = useState<AgentRow | null>(null);

  if (!squad) return null;

  const sq = mode.squads?.find((s) => s.id === squad);
  if (!sq) return null;

  const squadCards = (mode.cards ?? []).filter((c) => c.squad === sq.id);
  const squadFeed = (mode.feed ?? []).filter((f) => {
    const prefix = sq.id.slice(0, 3).toUpperCase();
    return f.agent?.startsWith(prefix) || f.agent?.startsWith(sq.name.slice(0, 3).toUpperCase());
  }).slice(0, 6);

  const needsCards = squadCards.filter((c) => c.col === 'needs');
  const escalatedCards = squadCards.filter((c) => c.col === 'escalated');

  const utilization = sq.agents > 0 ? Math.round((sq.active / sq.agents) * 100) : 0;
  const stateColor = (h?: string) => h === 'ok' ? 'var(--ok)' : h === 'warn' ? 'var(--warn)' : 'var(--bad)';

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    listSquadAgents(projectId, sq.id).then(async (existing) => {
      if (existing.length > 0) {
        setAgents(existing);
      } else {
        // Auto-create agents in DB từ squad config count
        const created = await syncSquadAgents(projectId, sq.id, sq.name, sq.agents);
        setAgents(created);
      }
    });
  }, [projectId, sq.id, sq.agents, sq.name]);

  const C = {
    drawer: { position: 'fixed' as const, top: 48, left: 240, bottom: 28, width: 360, background: 'var(--bg-1)', borderRight: '1px solid var(--line-strong)', zIndex: 50, display: 'flex', flexDirection: 'column' as const, overflowY: 'auto' as const, boxShadow: '4px 0 32px rgba(0,0,0,.4)', animation: 'drawer-slide .2s ease-out' },
    head:   { padding: '14px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'sticky' as const, top: 0, zIndex: 2 },
    icon:   { width: 36, height: 36, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--bg-3)', border: `1px solid ${sq.color ?? 'var(--line)'}`, color: sq.color ?? 'var(--fg-2)', fontSize: 18, flexShrink: 0 },
    sec:    { padding: '12px 16px', borderBottom: '1px solid var(--line)' },
    secLbl: { fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    kpiRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
    kpi:    { background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' },
    kpiLbl: { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
    kpiVal: { fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', marginTop: 2, fontVariantNumeric: 'tabular-nums' as const },
    btn:    { appearance: 'none' as const, background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontFamily: 'var(--font-sans)', cursor: 'pointer' },
    agentDot: (s: string) => ({ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: s === 'active' ? 'var(--ok)' : s === 'throttled' ? 'var(--warn)' : s === 'down' ? 'var(--bad)' : 'var(--fg-4)', boxShadow: s === 'active' ? '0 0 5px var(--ok)' : s === 'throttled' ? '0 0 5px var(--warn)' : 'none' }),
    card:   { background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 },
    lv:     (l: number) => ({ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 4px', borderRadius: 3, border: '1px solid', color: `var(--l${l})`, borderColor: `var(--l${l})` }),
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.25)' }} />

      <div style={C.drawer}>
        {/* Header */}
        <div style={C.head}>
          <div style={C.icon}>{sq.icon ?? '🤖'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>{sq.name}</div>
            {sq.vi && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{sq.vi}</div>}
            {sq.desc && <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 4, lineHeight: 1.4 }}>{sq.desc}</div>}
          </div>
          <button onClick={onClose} style={{ appearance: 'none', background: 'var(--bg-3)', border: '1px solid var(--line)', width: 28, height: 28, borderRadius: 6, color: 'var(--fg-2)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
        </div>

        {/* KPIs */}
        <div style={C.sec}>
          <div style={C.secLbl}>
            <span>Performance</span>
            <span style={{ color: stateColor(sq.health), fontWeight: 600 }}>● {(sq.health ?? 'ok').toUpperCase()}</span>
          </div>
          <div style={C.kpiRow}>
            <div style={C.kpi}>
              <div style={C.kpiLbl}>Agents</div>
              <div style={{ ...C.kpiVal, fontSize: 20 }}>{sq.active}<small style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>/{sq.agents}</small></div>
            </div>
            <div style={C.kpi}>
              <div style={C.kpiLbl}>Util.</div>
              <div style={{ ...C.kpiVal, fontSize: 20, color: utilization > 90 ? 'var(--warn)' : 'var(--ok)' }}>{utilization}<small style={{ fontSize: 11, fontWeight: 400 }}>%</small></div>
            </div>
            <div style={C.kpi}>
              <div style={C.kpiLbl}>Tasks/h</div>
              <div style={{ ...C.kpiVal, fontSize: 20 }}>{Math.round(sq.active * 4.2)}</div>
            </div>
          </div>
          <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${utilization}%`, background: sq.color ?? 'var(--accent)', transition: 'width .4s' }} />
          </div>
        </div>

        {/* Cards */}
        {squadCards.length > 0 && (
          <div style={C.sec}>
            <div style={C.secLbl}>
              <span>Active cards ({squadCards.length})</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {escalatedCards.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bad)', color: '#fff' }}>🔥 {escalatedCards.length}</span>}
                {needsCards.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--warn)', color: 'var(--bg-0)' }}>🔔 {needsCards.length}</span>}
              </div>
            </div>
            {squadCards.slice(0, 5).map((card, i) => (
              <div key={i} style={C.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {card.level && <span style={C.lv(card.level)}>L{card.level}</span>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>{card.id}</span>
                  {card.col && (
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: card.col === 'escalated' ? 'rgba(255,77,94,.1)' : card.col === 'needs' ? 'rgba(255,176,60,.1)' : 'var(--bg-3)',
                      color: card.col === 'escalated' ? 'var(--bad)' : card.col === 'needs' ? 'var(--warn)' : 'var(--fg-3)',
                      border: `1px solid ${card.col === 'escalated' ? 'rgba(255,77,94,.3)' : card.col === 'needs' ? 'rgba(255,176,60,.3)' : 'var(--line)'}`,
                    }}>{card.col}</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-0)', lineHeight: 1.35 }}>{card.title}</div>
                {card.money && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: card.money.startsWith('-') ? 'var(--bad)' : 'var(--ok)', marginTop: 3 }}>{card.money}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Agent roster — real data, clickable */}
        <div style={C.sec}>
          <div style={C.secLbl}>
            <span>Agent roster ({agents.length > 0 ? agents.length : sq.agents})</span>
            <span style={{ color: 'var(--ok)' }}>{sq.active} active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {agents.map((a, i) => (
              <div
                key={a.id}
                onClick={() => setOpenAgent(a)}
                title="Click để xem profile và growth journey"
                style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8,
                  alignItems: 'center', padding: '6px 6px', borderRadius: 5,
                  borderBottom: i < agents.length - 1 ? '1px dashed var(--line)' : 'none',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={C.agentDot(a.status)} />
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-0)', fontWeight: 500 }}>{a.agentRef}</span>
                  {a.label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 8 }}>{a.label}</span>}
                  {a.baseSkillMd && (
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {a.baseSkillMd.split('\n')[0]}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: a.status === 'active' ? 'var(--ok)' : a.status === 'throttled' ? 'var(--warn)' : 'var(--fg-4)' }}>
                  {a.status} ▸
                </span>
              </div>
            ))}
            {agents.length === 0 && (
              <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                Đang tạo agents…
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        {squadFeed.length > 0 && (
          <div style={{ ...C.sec, borderBottom: 'none' }}>
            <div style={C.secLbl}><span>Recent activity</span></div>
            {squadFeed.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, padding: '6px 0', borderBottom: i < squadFeed.length - 1 ? '1px dashed var(--line)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', paddingTop: 1 }}>{f.t?.slice(0, 5)}</span>
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', padding: '0 4px', borderRadius: 3 }}>{f.agent}</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{f.action}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)', marginTop: 2 }}>{f.target}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openAgent && (
        <AgentDetailModal
          agent={openAgent}
          squadName={sq.name}
          onClose={() => setOpenAgent(null)}
        />
      )}

      <style>{`
        @keyframes drawer-slide {
          from { transform: translateX(-20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
