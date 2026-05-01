'use client';

import Link from 'next/link';
import { useState, useRef, useLayoutEffect } from 'react';
import { useT } from '@/lib/lang-context';
import { ProjectSwitcher } from './project-switcher';
import type { Mode, Project } from '@/lib/mock/types';

export function Sidebar({ mode, currentProjectId, projects }: { mode?: Mode; currentProjectId?: string; projects: Project[] }) {
  const t = useT();
  const [activeSquad, setActiveSquad] = useState<string | null>(null);

  return (
    <aside className="sidebar">
      <ProjectSwitcher currentProjectId={currentProjectId} projects={projects} />

      <div className="side-section" style={{ flex: 1, overflow: 'auto' }}>
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
          </>
        )}
      </div>

      <SystemNav />

      <div className="grow"></div>

      <div className="kill-switch">
        <div className="kill-label">⚠ Emergency control</div>
        <button className="kill-btn">PAUSE ALL AGENTS</button>
        <div className="kill-meta">
          <span>{mode?.killBudget?.cap || 'budget cap'}</span>
          <span>used {mode?.killBudget?.used || '—'}</span>
        </div>
      </div>
    </aside>
  );
}

// Compact, grouped SYSTEM nav. Each group collapsible — sidebar dài thì user thu gọn từng group.
// "soon" items hiện disabled (opacity 0.45) để thấy roadmap nhưng không click được.
//
// Height-lock pattern: measure section height ngay sau lần render đầu (all groups expanded),
// rồi pin `height` tại giá trị đó. Toggle collapse/expand sẽ KHÔNG thay đổi outer height
// → SQUADS section bên trên không bị reflow / scroll position không jiggle.
function SystemNav() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const tog = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  const ref = useRef<HTMLDivElement>(null);
  const [lockedH, setLockedH] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!ref.current || lockedH !== null) return;
    // Render đầu tiên state là all expanded → height tự nhiên = max possible.
    setLockedH(ref.current.offsetHeight);
  }, [lockedH]);

  type NavItem = { href?: string; icon: string; color: string; label: string; sub: string; soon?: boolean };
  const groups: Array<{ key: string; label: string; items: NavItem[] }> = [
    {
      key: 'monitor', label: 'Monitor',
      items: [
        { href: '/agents',  icon: '🧠', color: 'var(--neon-violet)', label: 'Agents Admin',sub: 'runs · breakers · solo' },
        { href: '/inbox',   icon: '📥', color: 'var(--neon-amber)',  label: 'Inbox',       sub: 'human tasks queue' },
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
        { href: '/settings/api', icon: '🔑', color: 'var(--neon-amber)',  label: 'API Keys',         sub: 'LLM providers' },
        {                        icon: '⚙',  color: 'var(--neon-cyan)',   label: 'Trust thresholds', sub: 'soon', soon: true },
        { href: '/',             icon: '⊞',  color: 'var(--neon-violet)', label: 'All Projects',     sub: 'portfolio' },
      ],
    },
  ];

  const itemRowStyle: React.CSSProperties = {
    cursor: 'pointer', textDecoration: 'none', color: 'inherit',
    padding: '4px 8px', minHeight: 28, display: 'flex', alignItems: 'center', gap: 8,
  };

  return (
    <div
      ref={ref}
      className="side-section"
      style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        // Lock height sau first render → collapse/expand không reflow SQUADS bên trên.
        ...(lockedH !== null ? { height: lockedH, flex: '0 0 auto' } : {}),
      }}
    >
      <div className="side-title"><span>SYSTEM</span></div>
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
