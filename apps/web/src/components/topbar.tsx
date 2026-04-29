'use client';

import Link from 'next/link';
import { useT } from '@/lib/lang-context';
import { PROJECTS } from '@/lib/mock/projects';
import type { Mode, Project } from '@/lib/mock/types';

type Tab = 'dashboard' | 'board' | 'squads' | 'tribes' | 'studio' | 'resources';

export function TopBar({
  tab,
  mode,
  currentProject,
  isPortfolio,
}: {
  tab?: Tab;
  mode?: Mode;
  currentProject?: Project;
  isPortfolio: boolean;
}) {
  const t = useT();

  const projectTabs: Array<{ id: Tab; label: string; badge?: string | number }> = [
    { id: 'dashboard', label: t('nav.dashboard', mode?.pageTitle || 'Morning Brief'), badge: '07:42' },
    { id: 'board', label: t('nav.board', mode?.boardTitle || 'Command Board'), badge: mode?.cards?.filter((c) => c.col === 'needs').length ?? 0 },
    { id: 'squads', label: t('nav.squads', 'Squads'), badge: 108 },
    { id: 'tribes', label: t('nav.tribes', 'Tribes'), badge: 5 },
    { id: 'studio', label: t('nav.studio', 'Studio'), badge: 'AI' },
    { id: 'resources', label: t('nav.resources', 'Resources'), badge: 6 },
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
        <span className="badge">{PROJECTS.length}</span>
      </Link>

      {!isPortfolio && currentProject && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', marginRight: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', borderRight: '1px solid var(--line)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontSize: 14 }}>{currentProject.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentProject.name}</span>
          </div>
          <nav className="tabs">
            {projectTabs.map((pt) => (
              <Link
                key={pt.id}
                href={pt.id === 'dashboard' ? `/p/${currentProject.id}` : `/p/${currentProject.id}/${pt.id}`}
                className="tab"
                data-active={tab === pt.id || undefined}
                style={{ textDecoration: 'none' }}
              >
                {pt.label}
                {pt.badge !== undefined && <span className="badge">{pt.badge}</span>}
              </Link>
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
        {isPortfolio ? `${PROJECTS.length} PROJECTS LIVE` : (mode?.livePill || 'LIVE')}
      </div>
    </header>
  );
}
