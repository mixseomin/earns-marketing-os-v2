'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/lang-context';
import { ProjectSwitcher } from './project-switcher';
import type { Mode, Project } from '@/lib/mock/types';

export function Sidebar({ mode, currentProjectId, projects }: { mode?: Mode; currentProjectId?: string; projects: Project[] }) {
  const t = useT();
  const [activeSquad, setActiveSquad] = useState<string | null>(null);

  return (
    <aside className="sidebar">
      <ProjectSwitcher currentProjectId={currentProjectId} projects={projects} />

      <div className="side-section" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div className="side-title">
          <span>SQUADS · {mode?.label?.toUpperCase() ?? '—'}</span>
          <span className="count mono">{mode?.squads?.length ?? 0} / {(mode?.squads ?? []).reduce((s, sq) => s + (sq.agents ?? 0), 0)}ag</span>
        </div>
        {mode?.squads?.map((s) => (
          <div
            key={s.id}
            className="squad"
            data-active={activeSquad === s.id || undefined}
            onClick={() => setActiveSquad(activeSquad === s.id ? null : s.id)}
          >
            <div className="squad-icon" style={{ borderColor: s.color, color: s.color }}>{s.icon}</div>
            <div className="squad-name">
              <b>{s.name}</b>
              <span>{s.active}/{s.agents} • {s.vi}</span>
            </div>
            <div className="squad-stats">
              <span className="pulse" data-state={s.health}></span>
            </div>
          </div>
        ))}
        {currentProjectId && (
          <>
            <Link href={`/p/${currentProjectId}/tribes`} className="squad" style={{ borderTop: '1px dashed rgba(127,127,127,.15)', marginTop: 4, paddingTop: 8, textDecoration: 'none', color: 'inherit' }}>
              <div className="squad-icon" style={{ borderColor: 'var(--fg-3)', color: 'var(--fg-2)' }}>◍</div>
              <div className="squad-name"><b>{t('nav.tribes', 'Tribes')}</b><span>audience clusters</span></div>
              <div className="squad-stats"><span className="pulse" data-state="ok"></span></div>
            </Link>
            <Link href={`/p/${currentProjectId}/resources`} className="squad" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="squad-icon" style={{ borderColor: 'var(--fg-3)', color: 'var(--fg-2)' }}>🗂</div>
              <div className="squad-name"><b>{t('nav.resources', 'Resources')}</b><span>kho hậu cần</span></div>
              <div className="squad-stats"><span className="pulse" data-state="ok"></span></div>
            </Link>
            <Link href={`/p/${currentProjectId}/publications`} className="squad" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="squad-icon" style={{ borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }}>📡</div>
              <div className="squad-name"><b>Publications</b><span>monitor · engage</span></div>
              <div className="squad-stats"><span className="pulse" data-state="ok"></span></div>
            </Link>
            <Link href={`/p/${currentProjectId}/flow`} className="squad" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="squad-icon" style={{ borderColor: 'var(--neon-violet)', color: 'var(--neon-violet)' }}>🗺</div>
              <div className="squad-name"><b>Flow</b><span>diagram · architecture</span></div>
              <div className="squad-stats"><span className="pulse" data-state="ok"></span></div>
            </Link>
          </>
        )}
      </div>

      <SystemNav />

      <button
        className="kill-btn"
        title={`⚠ Emergency — pause all agents${mode?.killBudget?.cap ? ` · cap ${mode.killBudget.cap}, used ${mode.killBudget.used ?? '—'}` : ''}`}
        style={{
          margin: 8, padding: '6px 10px', fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        ⚠ <span>Pause all agents</span>
      </button>
    </aside>
  );
}

// Compact, grouped SYSTEM nav. Default ALL collapsed → sidebar primary focus là project SQUADS.
// User expand group nào cần dùng. Group expanded có max-height + scroll bên trong, không đẩy SQUADS lên.
function SystemNav() {
  // Default: tất cả collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ monitor: true, library: true, setup: true });
  const tog = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  type NavItem = { href?: string; icon: string; color: string; label: string; sub: string; soon?: boolean };
  const groups: Array<{ key: string; label: string; items: NavItem[] }> = [
    {
      key: 'monitor', label: 'Monitor',
      items: [
        { href: '/agents',  icon: '🧠', color: 'var(--neon-violet)', label: 'Agents Admin',sub: 'runs · breakers · solo' },
        { href: '/inbox',   icon: '📥', color: 'var(--neon-amber)',  label: 'Inbox',       sub: 'human tasks queue' },
        { href: '/scheduler', icon: '⏱', color: 'var(--neon-lime)', label: 'Scheduler',   sub: 'cron · timers · config' },
        { href: '/ai-log',  icon: '🤖', color: 'var(--neon-violet)', label: 'AI Activity', sub: 'OpenAI · cost · oversight' },
        { href: '/tests',   icon: '✓',  color: 'var(--neon-lime)',   label: 'Tests',       sub: 'use cases · QA' },
        { href: '/roadmap', icon: '🗺', color: 'var(--neon-cyan)',   label: 'Roadmap',     sub: 'phases · deps' },
      ],
    },
    {
      key: 'library', label: 'Library',
      items: [
        { href: '/library', icon: '🗂', color: 'var(--neon-cyan)',  label: 'Tools & Skills', sub: 'shared catalog' },
        {                   icon: '⌖', color: 'var(--neon-amber)', label: 'Playbooks',      sub: 'soon', soon: true },
      ],
    },
    {
      key: 'setup', label: 'Setup',
      items: [
        { href: '/settings/api',  icon: '🔑', color: 'var(--neon-amber)',  label: 'API Keys',         sub: 'LLM providers' },
        { href: '/environments',  icon: '🛰', color: 'var(--neon-cyan)',   label: 'Environments',     sub: 'proxies · profiles' },
        {                         icon: '⚙',  color: 'var(--neon-cyan)',   label: 'Trust thresholds', sub: 'soon', soon: true },
        { href: '/',              icon: '⊞',  color: 'var(--neon-violet)', label: 'All Projects',     sub: 'portfolio' },
      ],
    },
  ];

  const itemRowStyle: React.CSSProperties = {
    cursor: 'pointer', textDecoration: 'none', color: 'inherit',
    padding: '4px 8px', minHeight: 28, display: 'flex', alignItems: 'center', gap: 8,
  };

  return (
    <div
      className="side-section"
      style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        flex: '0 0 auto',
        maxHeight: '40vh',
        overflowY: 'auto',
        borderTop: '1px solid var(--line)',
        paddingTop: 4,
      }}
    >
      <div className="side-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>SYSTEM</span>
        <span style={{ fontSize: 8.5, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>· click group để mở</span>
      </div>
      {groups.map((g) => {
        const isCollapsed = collapsed[g.key] === true;
        return (
          <div key={g.key} style={{ marginTop: 2 }}>
            <div
              onClick={() => tog(g.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '2px 8px', cursor: 'pointer', userSelect: 'none',
                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >
              <span style={{ fontSize: 8 }}>{isCollapsed ? '▸' : '▾'}</span>
              <span>{g.label}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ fontSize: 8.5, opacity: 0.6 }}>{g.items.length}</span>
            </div>
            {!isCollapsed && g.items.map((it) => {
              const inner = (
                <>
                  <div style={{ fontSize: 14, color: it.color, width: 18, textAlign: 'center', lineHeight: 1, flexShrink: 0 }}>{it.icon}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{it.sub}</span>
                  </div>
                </>
              );
              if (it.soon) {
                return (
                  <div key={it.label} style={{ ...itemRowStyle, opacity: 0.45, cursor: 'not-allowed' }} title="Sắp ra">
                    {inner}
                  </div>
                );
              }
              return (
                <Link key={it.label} href={it.href!} style={itemRowStyle}>
                  {inner}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
