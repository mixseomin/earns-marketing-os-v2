'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import { useT } from '@/lib/lang-context';
import type { Mode, Project } from '@/lib/mock/types';

type Tab = 'dashboard' | 'board' | 'squads' | 'tribes' | 'pillars' | 'seeding' | 'studio' | 'resources' | 'settings' | 'plans';

interface SubItem { label: string; href: string; icon?: string }

function DropdownTab({
  label, href, badge, active, subItems,
}: {
  label: string; href: string; badge?: string | number; active?: boolean;
  subItems?: SubItem[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  // Snappy 250ms — đủ tolerate mouse đi chéo qua bridge, không "đợi tết"
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 250);
  };
  const openNow = () => { cancelClose(); setOpen(true); };

  if (!subItems?.length) {
    return (
      <Link href={href} className="tab" data-active={active || undefined} style={{ textDecoration: 'none' }}>
        {label}{badge !== undefined && <span className="badge">{badge}</span>}
      </Link>
    );
  }
  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <Link href={href} className="tab" data-active={(active || open) || undefined}
        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{badge !== undefined && <span className="badge">{badge}</span>}
        <span style={{ fontSize: 7, opacity: 0.5, marginLeft: 1, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </Link>
      {open && (
        <>
          {/* Invisible bridge — full width của tab, kéo dài 12px xuống dưới
              để mouse di từ tab → menu không rời hover zone. */}
          <div
            aria-hidden
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, height: 12,
              zIndex: 299,
            }}
            onMouseEnter={openNow}
          />
          <div
            onMouseEnter={openNow}
            onMouseLeave={scheduleClose}
            style={{
              position: 'absolute',
              // Anchor right để dropdown tabs (Studio/Resources) ở phía phải nav
              // không tràn ra khỏi viewport.
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 300,
              background: 'var(--bg-1)',
              border: '1px solid var(--line-strong)',
              borderRadius: 8,
              boxShadow: '0 12px 32px rgba(0,0,0,.5)',
              minWidth: 200,
              padding: '6px 0',
              animation: 'menuFadeIn .12s ease-out',
            }}
          >
            {subItems.map((s) => (
              <Link key={s.href} href={s.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', textDecoration: 'none',
                color: 'var(--fg-1)', fontSize: 12.5, whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {s.icon && <span style={{ fontSize: 14, width: 16, display: 'inline-flex', justifyContent: 'center' }}>{s.icon}</span>}
                {s.label}
              </Link>
            ))}
          </div>
          <style>{`
            @keyframes menuFadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </>
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
  currentUser,
  onMobileMenuClick,
}: {
  tab?: Tab;
  mode?: Mode;
  currentProject?: Project;
  isPortfolio: boolean;
  projectCount: number;
  currentUser?: { role: 'admin' | 'operator' | 'viewer' };
  onMobileMenuClick?: () => void;
}) {
  const t = useT();

  const totalAgents = (mode?.squads ?? []).reduce((s, sq) => s + (sq.agents ?? 0), 0);
  const needsCount = mode?.cards?.filter((c) => c.col === 'needs').length ?? 0;

  const pid = currentProject?.id ?? '';
  const isOperator = currentUser?.role === 'operator' || currentUser?.role === 'viewer';

  const allProjectTabs: Array<{ id: Tab; label: string; badge?: string | number; subItems?: SubItem[]; adminOnly?: boolean }> = [
    { id: 'dashboard', label: t('nav.dashboard', mode?.pageTitle || 'Morning Brief'), adminOnly: true },
    {
      id: 'board', label: t('nav.board', mode?.boardTitle || 'Command Board'),
      badge: needsCount > 0 ? needsCount : undefined,
      subItems: isOperator
        ? [{ label: 'Inbox', href: `/p/${pid}/inbox`, icon: '📥' }]
        : [
            { label: 'Command Board', href: `/p/${pid}/board`, icon: '📋' },
            { label: 'Inbox',         href: `/p/${pid}/inbox`, icon: '📥' },
          ],
    },
    {
      id: 'squads', label: t('nav.squads', 'Squads'),
      badge: totalAgents > 0 ? totalAgents : undefined,
      adminOnly: true,
      subItems: [
        { label: 'Squads',       href: `/p/${pid}/squads`,  icon: '🤖' },
        { label: 'Tribes',       href: `/p/${pid}/tribes`,  icon: '🏕' },
        { label: 'Trụ cột',      href: `/p/${pid}/pillars`, icon: '📚' },
        { label: 'Seeding',      href: `/p/${pid}/seeding`, icon: '⏱' },
        { label: 'Flow Diagram', href: `/p/${pid}/flow`,    icon: '🗺' },
        { label: 'Team',         href: `/p/${pid}/team`,   icon: '👥' },
      ],
    },
    { id: 'studio', label: t('nav.studio', 'Studio'), adminOnly: true },
    {
      id: 'plans', label: t('nav.plans', 'Kế hoạch'), adminOnly: true,
      subItems: [
        { label: 'Tất cả kế hoạch', href: `/p/${pid}/plans`, icon: '🎯' },
      ],
    },
    {
      id: 'resources', label: t('nav.resources', 'Resources'),
      subItems: isOperator
        ? [
            { label: 'Accounts', href: `/p/${pid}/resources?vault=accounts`, icon: '🔐' },
          ]
        : [
            { label: 'Overview',     href: `/p/${pid}/resources`,                  icon: '🗄' },
            { label: 'Accounts',     href: `/p/${pid}/resources?vault=accounts`,   icon: '🔐' },
            { label: 'Media',        href: `/p/${pid}/resources?vault=media`,      icon: '🎬' },
            { label: 'Contacts',     href: `/p/${pid}/resources?vault=contacts`,   icon: '📇' },
            { label: 'Infra',        href: `/p/${pid}/resources?vault=infra`,      icon: '🌐' },
            { label: 'Budget',       href: `/p/${pid}/resources?vault=budget`,     icon: '💰' },
            { label: 'Knowledge',    href: `/p/${pid}/resources?vault=knowledge`,  icon: '🧠' },
            { label: 'Publications', href: `/p/${pid}/publications`,               icon: '📡' },
          ],
    },
    { id: 'settings', label: '⚙', adminOnly: true },
  ];

  const projectTabs = isOperator
    ? allProjectTabs.filter((pt) => !pt.adminOnly)
    : allProjectTabs;

  return (
    <header className="topbar">
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={onMobileMenuClick}
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <Link href="/" className="brand" title="MOS — về trang chủ (portfolio)"
            style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="brand-mark"></div>
        MOS <small>// MARKETING OS</small>
      </Link>

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
      {!isOperator && (
        <div className="topbar-search">
          <span>⌕</span>
          <input placeholder={t('common.search', 'Search agents, cards, projects…')} />
          <span className="kbd">⌘K</span>
        </div>
      )}
      {!isOperator && (
        <div className="live-pill">
          <span className="dot"></span>
          {isPortfolio ? `${projectCount} PROJECTS LIVE` : (totalAgents > 0 ? (mode?.livePill || 'LIVE') : 'BLANK SLATE')}
        </div>
      )}
    </header>
  );
}
