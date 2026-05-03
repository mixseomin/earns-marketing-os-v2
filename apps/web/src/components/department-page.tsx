'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { DepartmentEntry, DepartmentHuman, DepartmentAgent } from '@/lib/actions/department';
import type { Project } from '@/lib/mock/types';

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'var(--ok)' },
  running:  { label: 'Running',  color: 'var(--ok)' },
  queued:   { label: 'Queued',   color: 'var(--neon-cyan)' },
  idle:     { label: 'Idle',     color: 'var(--fg-3)' },
  offline:  { label: 'Offline',  color: 'var(--fg-4)' },
  paused:   { label: 'Paused',   color: 'var(--warn)' },
  inactive: { label: 'Inactive', color: 'var(--bad)' },
};

const SPECIALTY_ICON: Record<string, string> = {
  founder: '👑', 'marketing-lead': '🎯', writer: '✍️', community: '💬',
  designer: '🎨', video: '🎬', outreach: '🤝', analytics: '📊', ops: '⚙', other: '👤',
};

function fmtRel(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function DepartmentPage({ entries, projects, filterProject }: {
  entries: DepartmentEntry[];
  projects: Project[];
  filterProject: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [showIdle, setShowIdle] = useState(false);

  const setProject = (id: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (!id) {
      // "All" → explicit ?all=1 (override the auto-default-to-last-project)
      next.delete('project');
      next.set('all', '1');
    } else {
      next.set('project', id);
      next.delete('all');
    }
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  const humans = entries.filter((e): e is DepartmentHuman => e.kind === 'human');
  const agents = entries.filter((e): e is DepartmentAgent => e.kind === 'agent');

  const sortByStatus = <T extends DepartmentEntry>(arr: T[]) => {
    const order = ['active', 'running', 'queued', 'idle', 'paused', 'offline', 'inactive'];
    return [...arr].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  };

  // Split: "doing something" (active/running/queued) vs idle/offline/paused/inactive
  const isBusy = (e: DepartmentEntry) =>
    e.status === 'active' || e.status === 'running' || e.status === 'queued';
  const busyHumans  = humans.filter(isBusy);
  const idleHumans  = humans.filter((h) => !isBusy(h));
  const busyAgents  = agents.filter(isBusy);
  const idleAgents  = agents.filter((a) => !isBusy(a));

  const counts = useMemo(() => ({
    activeHumans: humans.filter((h) => h.status === 'active').length,
    idleHumans: humans.filter((h) => h.status === 'idle').length,
    runningAgents: agents.filter((a) => a.status === 'running').length,
    queuedAgents: agents.filter((a) => a.status === 'queued').length,
  }), [humans, agents]);

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🏢 Department
            <small>// {humans.length} humans · {agents.length} AI agents</small>
          </h1>
          <p className="page-sub">
            Tổng quan đội — ai đang làm gì, AI agent nào đang chạy. Auto-refresh khi reload.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <StatPill label="🟢 Humans active"  value={counts.activeHumans}  color="var(--ok)" />
        <StatPill label="🟡 Humans idle"    value={counts.idleHumans}    color="var(--fg-3)" />
        <StatPill label="⚡ Agents running" value={counts.runningAgents} color="var(--ok)" />
        <StatPill label="◷ Agents queued"   value={counts.queuedAgents}  color="var(--neon-cyan)" />
      </div>

      {/* Project filter */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project filter:</span>
        <button onClick={() => setProject(null)}
          style={{ padding: '3px 8px', fontSize: 11,
            background: !filterProject ? 'var(--accent-soft)' : 'transparent',
            border: `1px solid ${!filterProject ? 'var(--accent)' : 'var(--line)'}`,
            color: !filterProject ? 'var(--accent)' : 'var(--fg-2)',
            borderRadius: 4, cursor: 'pointer' }}>
          All
        </button>
        {projects.map((p) => (
          <button key={p.id} onClick={() => setProject(p.id)}
            style={{ padding: '3px 8px', fontSize: 11,
              background: filterProject === p.id ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${filterProject === p.id ? 'var(--accent)' : 'var(--line)'}`,
              color: filterProject === p.id ? 'var(--accent)' : 'var(--fg-2)',
              borderRadius: 4, cursor: 'pointer' }}>
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      {/* Active humans */}
      {busyHumans.length > 0 && (
        <>
          <div className="modal-section-title">👤 Humans active ({busyHumans.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, marginBottom: 12 }}>
            {sortByStatus(busyHumans).map((h) => <HumanCard key={`h${h.userId}`} h={h} />)}
          </div>
        </>
      )}

      {/* Active agents */}
      {busyAgents.length > 0 && (
        <>
          <div className="modal-section-title">🤖 AI Agents active ({busyAgents.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, marginBottom: 12 }}>
            {sortByStatus(busyAgents).map((a) => <AgentCard key={`a${a.squadId}`} a={a} />)}
          </div>
        </>
      )}

      {busyHumans.length === 0 && busyAgents.length === 0 && (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, marginBottom: 12 }}>
          🌙 Không ai đang làm gì cả{filterProject ? ` trong project ${filterProject}` : ''}
        </div>
      )}

      {/* Idle pool — collapsed by default */}
      {(idleHumans.length > 0 || idleAgents.length > 0) && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowIdle((s) => !s)}
            style={{
              width: '100%', padding: '6px 10px',
              background: 'var(--bg-2)', border: '1px dashed var(--line)',
              borderRadius: 6, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>{showIdle ? '▾' : '▸'}</span>
            <span>Idle pool</span>
            <span style={{ color: 'var(--fg-4)' }}>· {idleHumans.length} humans · {idleAgents.length} agents</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 9 }}>{showIdle ? 'collapse' : 'expand'}</span>
          </button>
          {showIdle && (
            <div style={{ marginTop: 6 }}>
              {idleHumans.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4, marginBottom: 8 }}>
                  {sortByStatus(idleHumans).map((h) => <HumanCardCompact key={`h${h.userId}`} h={h} />)}
                </div>
              )}
              {idleAgents.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
                  {sortByStatus(idleAgents).map((a) => <AgentCardCompact key={`a${a.squadId}`} a={a} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '5px 10px', borderRadius: 5,
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
    }}>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function HumanCard({ h }: { h: DepartmentHuman }) {
  const sm = STATUS_META[h.status] ?? STATUS_META.idle!;
  const icon = SPECIALTY_ICON[h.specialty] ?? '👤';
  return (
    <div className="panel" style={{ padding: '10px 12px', borderLeft: `3px solid ${sm.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>{h.displayName}</div>
          <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{h.specialty} · {h.role}</div>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: sm.color, padding: '1px 6px', border: `1px solid ${sm.color}`, borderRadius: 3 }}>
          ● {sm.label}
        </span>
      </div>
      {h.currentTaskTitle && (
        <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ⏳ <b>Đang làm:</b> {h.currentTaskTitle}
          {h.currentTaskProjectId && <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 9.5, marginLeft: 4 }}>· {h.currentTaskProjectId}</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        <span>📥 {h.pendingTasks} pending</span>
        <span>⏳ {h.inProgressTasks} active</span>
        <span style={{ marginLeft: 'auto' }}>🔓 {fmtRel(h.lastSeen)}</span>
      </div>
    </div>
  );
}

function AgentCard({ a }: { a: DepartmentAgent }) {
  const sm = STATUS_META[a.status] ?? STATUS_META.idle!;
  return (
    <div className="panel" style={{ padding: '10px 12px', borderLeft: `3px solid ${sm.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{a.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>{a.squadName}</div>
          <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{a.squadKey} · L{a.trustLevel} · {a.model}</div>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: sm.color, padding: '1px 6px', border: `1px solid ${sm.color}`, borderRadius: 3 }}>
          ⚡ {sm.label}
        </span>
      </div>
      {a.recentRunCardTitle && (
        <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.status === 'running' ? '⚡' : '↳'} {a.recentRunCardTitle}
          {a.recentRunStatus && <span style={{ color: 'var(--fg-3)', fontSize: 9.5, marginLeft: 4 }}>· {a.recentRunStatus}</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        <Link href={`/p/${a.projectId}/flow`} style={{ color: 'var(--neon-cyan)', textDecoration: 'none' }}>{a.projectId} ↗</Link>
        <span>📋 {a.pendingCardsCount} cards</span>
        <span>⚡ {a.runningCount} running</span>
        <span style={{ marginLeft: 'auto' }}>{fmtRel(a.lastRunAt)}</span>
      </div>
    </div>
  );
}

// ── Compact variants for idle pool (1-line summary) ──────────────
function HumanCardCompact({ h }: { h: DepartmentHuman }) {
  const sm = STATUS_META[h.status] ?? STATUS_META.idle!;
  const icon = SPECIALTY_ICON[h.specialty] ?? '👤';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', background: 'var(--bg-1)',
      border: '1px solid var(--line)', borderLeft: `2px solid ${sm.color}`,
      borderRadius: 4, fontSize: 11,
    }}>
      <span>{icon}</span>
      <span style={{ flex: 1, fontWeight: 600, color: 'var(--fg-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{h.displayName}</span>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{h.specialty}</span>
      <span style={{ fontSize: 9, color: sm.color, fontFamily: 'var(--font-mono)' }}>● {sm.label}</span>
      <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{fmtRel(h.lastSeen)}</span>
    </div>
  );
}

function AgentCardCompact({ a }: { a: DepartmentAgent }) {
  const sm = STATUS_META[a.status] ?? STATUS_META.idle!;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', background: 'var(--bg-1)',
      border: '1px solid var(--line)', borderLeft: `2px solid ${sm.color}`,
      borderRadius: 4, fontSize: 11,
    }}>
      <span>{a.icon}</span>
      <span style={{ flex: 1, fontWeight: 600, color: 'var(--fg-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.squadName}</span>
      <Link href={`/p/${a.projectId}/flow`} style={{ fontSize: 9, color: 'var(--neon-cyan)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>{a.projectId}</Link>
      <span style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>L{a.trustLevel}</span>
      <span style={{ fontSize: 9, color: sm.color, fontFamily: 'var(--font-mono)' }}>● {sm.label}</span>
    </div>
  );
}
