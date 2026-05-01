'use client';

import Link from 'next/link';
import { useT } from '@/lib/lang-context';
import type { Mode, Project } from '@/lib/mock/types';

type Tab = 'dashboard' | 'board' | 'squads' | 'tribes' | 'studio' | 'resources' | 'settings';

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

  const projectTabs: Array<{ id: Tab; label: string; badge?: string | number }> = [
    { id: 'dashboard', label: t('nav.dashboard', mode?.pageTitle || 'Morning Brief') },
    { id: 'board', label: t('nav.board', mode?.boardTitle || 'Command Board'), badge: needsCount > 0 ? needsCount : undefined },
    { id: 'squads', label: t('nav.squads', 'Squads'), badge: totalAgents > 0 ? totalAgents : undefined },
    { id: 'tribes', label: t('nav.tribes', 'Tribes') },
    { id: 'studio', label: t('nav.studio', 'Studio') },
    { id: 'resources', label: t('nav.resources', 'Resources') },
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
              <Link
                key={pt.id}
                href={pt.id === 'dashboard' ? `/p/${currentProject.id}` : `/p/${currentProject.id}/${pt.id}`}
                className="tab"
                data-active={!isPortfolio && tab === pt.id || undefined}
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
        {isPortfolio ? `${projectCount} PROJECTS LIVE` : (totalAgents > 0 ? (mode?.livePill || 'LIVE') : 'BLANK SLATE')}
      </div>
    </header>
  );
}
