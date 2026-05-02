'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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

// Compact SYSTEM nav: 3 group rows, hover → float menu sang phải.
// Sidebar focus 100% vào project SQUADS, system items vẫn truy cập 1 hover.
type NavItem = { href?: string; icon: string; color: string; label: string; sub: string; soon?: boolean };

function SystemNav() {
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

  return (
    <div
      className="side-section"
      style={{
        display: 'flex', flexDirection: 'column', gap: 1,
        flex: '0 0 auto',
        borderTop: '1px solid var(--line)',
        paddingTop: 4, paddingBottom: 4,
      }}
    >
      <div className="side-title" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 10px 4px' }}>
        <span>SYSTEM</span>
        <span style={{ fontSize: 8.5, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>· hover</span>
      </div>
      {groups.map((g) => <SystemGroupRow key={g.key} group={g} />)}
    </div>
  );
}

// Single group row. Hover → float menu fixed-pos sang phải (escape parent clip).
function SystemGroupRow({ group }: { group: { key: string; label: string; items: NavItem[] } }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const pathname = usePathname();

  // Group is "active" if any of its items matches current pathname
  const activeItem = group.items.find((it) => it.href && pathname === it.href);
  const isGroupActive = !!activeItem;

  const cancelClose = () => {
    if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => { cancelClose(); closeTimer.current = window.setTimeout(() => setOpen(false), 250); };
  const openNow = () => {
    cancelClose();
    if (rowRef.current) {
      const r = rowRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right });
    }
    setOpen(true);
  };

  // Close popout if pathname changes (clicked a link inside it)
  useEffect(() => { setOpen(false); }, [pathname]);

  const itemRowStyle: React.CSSProperties = {
    cursor: 'pointer', textDecoration: 'none', color: 'inherit',
    padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 10,
  };

  return (
    <div
      ref={rowRef}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', cursor: 'default', userSelect: 'none',
        fontSize: 11,
        color: (open || isGroupActive) ? 'var(--fg-0)' : 'var(--fg-2)',
        background: (open || isGroupActive) ? 'var(--bg-2)' : 'transparent',
        borderLeft: `2px solid ${isGroupActive ? 'var(--accent)' : open ? 'rgba(0,229,255,0.4)' : 'transparent'}`,
        transition: 'background 0.15s, color 0.15s',
      }}>
        <span style={{ fontWeight: isGroupActive ? 600 : 500 }}>{group.label}</span>
        {activeItem && (
          <span style={{ fontSize: 12, lineHeight: 1, color: activeItem.color, marginLeft: 2 }}>{activeItem.icon}</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>{group.items.length}</span>
        <span style={{ fontSize: 8, opacity: 0.5 }}>▸</span>
      </div>
      {open && pos && (
        <div
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            zIndex: 1000,
            background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
            borderRadius: 7, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
            minWidth: 220, padding: '4px 0',
            marginLeft: 4,
          }}
        >
          <div style={{ padding: '4px 12px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--line)' }}>
            {group.label}
          </div>
          {group.items.map((it) => {
            const isActive = it.href && pathname === it.href;
            const inner = (
              <>
                <div style={{ fontSize: 14, color: it.color, width: 18, textAlign: 'center', flexShrink: 0 }}>{it.icon}</div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--fg-1)' }}>{it.label}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{it.sub}</span>
                </div>
                {isActive && <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>● here</span>}
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
              <Link
                key={it.label} href={it.href!}
                style={{
                  ...itemRowStyle,
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
