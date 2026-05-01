'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/lang-context';
import type { Mode, Project } from '@/lib/mock/types';

type Tab = 'dashboard' | 'board' | 'squads' | 'tribes' | 'studio' | 'resources' | 'settings';

interface SubItem { label: string; href: string; icon?: string }

function DropdownTab({
  label, href, badge, active, subItems,
}: {
  label: string; href: string; badge?: string | number; active?: boolean;
  subItems?: SubItem[];
}) {
  const [open, setOpen] = useState(false);
  if (!subItems?.length) {
    return (
      <Link href={href} className="tab" data-active={active || undefined} style={{ textDecoration: 'none' }}>
        {label}{badge !== undefined && <span className="badge">{badge}</span>}
      </Link>
    );
  }
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href={href} className="tab" data-active={active || undefined}
        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{badge !== undefined && <span className="badge">{badge}</span>}
        <span style={{ fontSize: 7, opacity: 0.5, marginLeft: 1 }}>▾</span>
      </Link>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 300,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 7, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          minWidth: 160, padding: '4px 0', marginTop: 2,
        }}>
          {subItems.map((s) => (
            <Link key={s.href} href={s.href} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', textDecoration: 'none',
              color: 'var(--fg-1)', fontSize: 12, whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {s.icon && <span style={{ fontSize: 14 }}>{s.icon}</span>}
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  tab,
  mode,
  currentProject,
  isPortfolio,
  projectCount,
}: {
  tab?: Tab;
  mode?: Mode;
  currentProject?: Project;
  isPortfolio: boolean;
  projectCount: number;
}) {
  const t = useT();

  const totalAgents = (mode?.squads ?? []).reduce((s, sq) => s + (sq.agents ?? 0), 0);
  const needsCount = mode?.cards?.filter((c) => c.col === 'needs').length ?? 0;

  const pid = currentProject?.id ?? '';
  const projectTabs: Array<{ id: Tab; label: string; badge?: string | number; subItems?: SubItem[] }> = [
    { id: 'dashboard', label: t('nav.dashboard', mode?.pageTitle || 'Morning Brief') },
    {
      id: 'board', label: t('nav.board', mode?.boardTitle || 'Command Board'),
      badge: needsCount > 0 ? needsCount : undefined,
      subItems: [
        { label: 'Command Board', href: `/p/${pid}/board`, icon: '📋' },
        { label: 'Inbox',         href: `/p/${pid}/inbox`, icon: '📥' },
      ],
    },
    {
      id: 'squads', label: t('nav.squads', 'Squads'),
      badge: totalAgents > 0 ? totalAgents : undefined,
      subItems: [
        { label: 'Squads',       href: `/p/${pid}/squads`, icon: '🤖' },
        { label: 'Tribes',       href: `/p/${pid}/tribes`, icon: '🏕' },
        { label: 'Flow Diagram', href: `/p/${pid}/flow`,   icon: '🗺' },
      ],
    },
    { id: 'studio', label: t('nav.studio', 'Studio') },
    {
      id: 'resources', label: t('nav.resources', 'Resources'),
      subItems: [
        { label: 'Resources',    href: `/p/${pid}/resources`,    icon: '🗄' },
        { label: 'Publications', href: `/p/${pid}/publications`, icon: '📡' },
        { label: 'Knowledge',    href: `/p/${pid}/resources?vault=knowledge`, icon: '🧠' },
      ],
    },
    { id: 'settings', label: '⚙' },
  ];

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"></div>
        MOS <small>// MARKETING OS</small>
      </div>

      <Link
        href="/"
        className="tab"
        data-active={isPortfolio || undefined}
        style={{ borderRight: '1px solid var(--line)', paddingRight: 16, marginRight: 4, textDecoration: 'none' }}
      >
        ⊞ {t('nav.portfolio', 'Portfolio')}
        <span className="badge">{projectCount}</span>
      </Link>

      {/* Show project tabs whenever currentProject set — kể cả khi isPortfolio
          (page Library/Agents/AI Log/etc đọc lastProject từ cookie). Cho user
          shortcut quay về Board / Tribes / Studio mà không phải qua sidebar. */}
      {currentProject && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', marginRight: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', borderRight: '1px solid var(--line)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontSize: 14 }}>{currentProject.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentProject.name}</span>
          </div>
          <nav className="tabs">
            {projectTabs.map((pt) => (
              <DropdownTab
                key={pt.id}
                href={pt.id === 'dashboard' ? `/p/${currentProject.id}` : `/p/${currentProject.id}/${pt.id}`}
                label={pt.label}
                badge={pt.badge}
                active={!isPortfolio && tab === pt.id}
                subItems={pt.subItems}
              />
            ))}
          </nav>
        </>
      )}

      <div className="topbar-spacer"></div>
      <div className="topbar-search">
        <span>⌕</span>
        <input placeholder={t('common.search', 'Search agents, cards, projects…')} />
        <span className="kbd">⌘K</span>
      </div>
      <div className="live-pill">
        <span className="dot"></span>
        {isPortfolio ? `${projectCount} PROJECTS LIVE` : (totalAgents > 0 ? (mode?.livePill || 'LIVE') : 'BLANK SLATE')}
      </div>
    </header>
  );
}
