'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/lang-context';
import { ProjectSwitcher } from './project-switcher';
import { logoutAction } from '@/lib/actions/auth';
import type { Mode, Project } from '@/lib/mock/types';
import type { CurrentUserInfo } from './app-shell';

export function Sidebar({ mode, currentProjectId, projects, currentUser }: { mode?: Mode; currentProjectId?: string; projects: Project[]; currentUser?: CurrentUserInfo }) {
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

      <SystemNav role={currentUser?.role ?? 'admin'} />

      {currentUser && <UserPanel user={currentUser} />}

      {currentUser?.role === 'admin' && (
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
      )}
    </aside>
  );
}

// User badge + logout button — bottom of sidebar.
function UserPanel({ user }: { user: CurrentUserInfo }) {
  const [, startTransition] = useTransition();
  const handleLogout = () => {
    startTransition(async () => { await logoutAction(); });
  };
  return (
    <div style={{
      margin: '4px 8px', padding: '6px 8px',
      background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 5,
        background: user.role === 'admin' ? 'var(--neon-violet)' : user.role === 'operator' ? 'var(--neon-cyan)' : 'var(--fg-3)',
        color: 'var(--bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 11, flexShrink: 0,
      }}>{user.displayName.charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.displayName}
        </div>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {user.role}{user.specialty ? ` · ${user.specialty}` : ''}
        </div>
      </div>
      <button onClick={handleLogout} title="Logout"
        style={{
          background: 'transparent', border: '1px solid var(--line)',
          borderRadius: 4, padding: '2px 6px', fontSize: 10, color: 'var(--fg-3)',
          cursor: 'pointer',
        }}>↪</button>
    </div>
  );
}

// Compact SYSTEM nav: 3 group rows, hover → float menu sang phải.
// Filter items by user role — operator sees fewer.
type NavItem = { href?: string; icon: string; color: string; label: string; sub: string; soon?: boolean; role?: 'admin' };

function SystemNav({ role = 'admin' }: { role?: 'admin' | 'operator' | 'viewer' }) {
  const groups: Array<{ key: string; label: string; items: NavItem[] }> = [
    {
      key: 'monitor', label: 'Monitor',
      items: [
        { href: '/agents',    icon: '🧠', color: 'var(--neon-violet)', label: 'Agents Admin', sub: 'runs · breakers · solo', role: 'admin' },
        { href: '/inbox',     icon: '📥', color: 'var(--neon-amber)',  label: 'Inbox',        sub: 'human tasks queue' },
        { href: '/scheduler', icon: '⏱',  color: 'var(--neon-lime)',   label: 'Scheduler',    sub: 'cron · timers · config', role: 'admin' },
        { href: '/ai-log',    icon: '🤖', color: 'var(--neon-violet)', label: 'AI Activity',  sub: 'OpenAI · cost · oversight', role: 'admin' },
        { href: '/tests',     icon: '✓',  color: 'var(--neon-lime)',   label: 'Tests',        sub: 'use cases · QA',         role: 'admin' },
        { href: '/roadmap',   icon: '🗺',  color: 'var(--neon-cyan)',   label: 'Roadmap',      sub: 'phases · deps' },
      ],
    },
    {
      key: 'library', label: 'Library',
      items: [
        { href: '/library', icon: '🗂', color: 'var(--neon-cyan)',  label: 'Tools & Skills', sub: 'shared catalog' },
        {                   icon: '⌖',  color: 'var(--neon-amber)', label: 'Playbooks',      sub: 'soon', soon: true },
      ],
    },
    {
      key: 'setup', label: 'Setup',
      items: [
        { href: '/team',          icon: '👥', color: 'var(--neon-lime)',   label: 'Team',             sub: 'members · roles · assignment', role: 'admin' },
        { href: '/settings/api',  icon: '🔑', color: 'var(--neon-amber)',  label: 'API Keys',         sub: 'LLM providers', role: 'admin' },
        { href: '/platforms',     icon: '🌐', color: 'var(--neon-violet)', label: 'Platforms',        sub: 'catalog · 59 entries' },
        { href: '/environments',  icon: '🛰', color: 'var(--neon-cyan)',   label: 'Environments',     sub: 'proxies · profiles', role: 'admin' },
        {                         icon: '⚙',  color: 'var(--neon-cyan)',   label: 'Trust thresholds', sub: 'soon', soon: true },
        { href: '/',              icon: '⊞',  color: 'var(--neon-violet)', label: 'All Projects',     sub: 'portfolio' },
      ],
    },
  ];

  // Filter by role — admin sees all; non-admin skip items marked role==='admin'
  const filteredGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.role || role === 'admin') }))
    .filter((g) => g.items.length > 0);

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
      <SystemGroups groups={filteredGroups} />
    </div>
  );
}

// Container: only ONE popout open at a time across rows.
function SystemGroups({ groups }: { groups: Array<{ key: string; label: string; items: NavItem[] }> }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const requestOpen = (key: string) => { cancelClose(); setOpenKey(key); };
  const requestClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 600);
  };
  return (
    <>
      {groups.map((g) => (
        <SystemGroupRow
          key={g.key}
          group={g}
          isOpen={openKey === g.key}
          onOpen={() => requestOpen(g.key)}
          onClose={requestClose}
        />
      ))}
    </>
  );
}

// Single group row. Hover → float menu fixed-pos sang phải (escape parent clip).
function SystemGroupRow({ group, isOpen, onOpen, onClose }: {
  group: { key: string; label: string; items: NavItem[] };
  isOpen: boolean; onOpen: () => void; onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const activeItem = group.items.find((it) => it.href && pathname === it.href);
  const isGroupActive = !!activeItem;

  const handleEnter = () => {
    if (rowRef.current) {
      const r = rowRef.current.getBoundingClientRect();
      const estH = 28 + group.items.length * 36 + 8;
      const vh = window.innerHeight;
      const top = r.top + estH > vh - 8 ? Math.max(8, r.bottom - estH) : r.top;
      setPos({ top, left: r.right });
    }
    onOpen();
  };
  const open = isOpen;

  const itemRowStyle: React.CSSProperties = {
    cursor: 'pointer', textDecoration: 'none', color: 'inherit',
    padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 10,
  };

  return (
    <div
      ref={rowRef}
      onMouseEnter={handleEnter}
      onMouseLeave={onClose}
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
          onMouseEnter={onOpen}
          onMouseLeave={onClose}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            zIndex: 1000,
            background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
            borderRadius: 7, boxShadow: '0 12px 32px rgba(0,0,0,.6)',
            minWidth: 220, padding: '4px 0',
            // Bridge: overlap + extra left padding để mouse di từ row sang không bị mất hover
            marginLeft: -6,
            paddingLeft: 6,
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
