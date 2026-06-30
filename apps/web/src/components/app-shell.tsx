'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakSlider } from './tweaks';
import { useLang } from '@/lib/lang-context';
import { ThemeApplier } from './theme-applier';
import { TopBar } from './topbar';
import { Sidebar } from './sidebar';
import { RightBar } from './rightbar';
import { StatusBar } from './statusbar';
import { ImpersonatePanel } from './impersonate-panel';
import { VisibilityWatcher } from './visibility-watcher';
import type { Mode, Project } from '@/lib/mock/types';
import type { VisibilityConfig } from '@/lib/visibility';

type Tab = 'dashboard' | 'board' | 'squads' | 'tribes' | 'scenes' | 'outreach' | 'backlinks' | 'pillars' | 'seeding' | 'studio' | 'resources' | 'settings' | 'plans';

export interface CurrentUserInfo {
  id: number;
  displayName: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  specialty?: string;
}

export function AppShell({
  children,
  mode,
  project,
  projects,
  tab,
  isPortfolio = false,
  currentUser,
  impersonate,
  configVersion,
}: {
  children: ReactNode;
  mode?: Mode;
  project?: Project;
  projects: Project[];
  tab?: Tab;
  isPortfolio?: boolean;
  currentUser?: CurrentUserInfo | null;
  impersonate?: { targetUserId: number; targetName: string; targetRole: string; config: VisibilityConfig } | null;
  configVersion?: number;
}) {
  const { tweaks, setTweak } = useTweaks();
  const { setLang } = useLang();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const screenLabel = isPortfolio ? 'portfolio' : project ? `${project.id}-${tab ?? 'dashboard'}` : 'shell';

  // Close mobile sidebar on route change
  useEffect(() => { setMobileNavOpen(false); }, [project?.id, tab, isPortfolio]);

  // Persist last-viewed project ID. Portfolio routes (Library, AI Log, Roadmap, Tests,
  // Settings/API) đọc cookie này để giữ context project đang chọn cho Sidebar /
  // ProjectSwitcher — tránh fallback về project đầu tiên (Aff-VN) khi user click
  // "Library" từ /p/orit/.
  useEffect(() => {
    if (project?.id && !isPortfolio) {
      document.cookie = `mos2_last_project_id=${encodeURIComponent(project.id)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }
  }, [project?.id, isPortfolio]);

  return (
    <>
      {impersonate && (
        <ImpersonatePanel
          targetUserId={impersonate.targetUserId}
          targetName={impersonate.targetName}
          targetRole={impersonate.targetRole}
          initialConfig={impersonate.config}
        />
      )}
      {configVersion !== undefined && <VisibilityWatcher initialVersion={configVersion} />}
      <ThemeApplier modeAccent={mode?.accent} />
      <div className="app"
           data-sidebar={tweaks.showSidebar ? 'shown' : 'hidden'}
           data-rightbar={tweaks.showRightbar ? 'shown' : 'hidden'}
           data-anim={tweaks.animation ? 'on' : 'off'}
           data-mobile-nav={mobileNavOpen ? 'open' : 'closed'}
        style={impersonate ? { paddingTop: 44 } : undefined}>
        <TopBar tab={tab} mode={mode} currentProject={project} isPortfolio={isPortfolio} projectCount={projects.length} currentUser={currentUser ?? undefined} onMobileMenuClick={() => setMobileNavOpen(v => !v)} />
        {(tweaks.showSidebar || mobileNavOpen) && <Sidebar mode={mode} currentProjectId={project?.id} projects={projects} currentUser={currentUser ?? undefined} onMobileNavigate={() => setMobileNavOpen(false)} />}
        {mobileNavOpen && <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
        <main className="main" data-screen-label={screenLabel}>{children}</main>
        {(currentUser?.role ?? 'admin') === 'admin' && (
          <RightBar mode={mode} projectId={project?.id}
                    visible={tweaks.showRightbar}
                    onAutoShow={() => setTweak('showRightbar', true)} />
        )}
        {(currentUser?.role ?? 'admin') === 'admin' && <StatusBar mode={mode} project={project} projectCount={projects.length} />}

        <TweaksPanel>
          <TweakSection label="Language" />
          <TweakRadio<'vi' | 'en'>
            label="Ngôn ngữ / Language"
            value={tweaks.lang}
            options={['vi', 'en']}
            onChange={(v) => { setTweak('lang', v); setLang(v); }}
          />
          <TweakSection label="Appearance" />
          <TweakRadio<'dark' | 'light'>
            label="Theme"
            value={tweaks.theme}
            options={['dark', 'light']}
            onChange={(v) => setTweak('theme', v)}
          />
          <TweakSelect<'auto' | 'blue' | 'cyan' | 'lime' | 'amber' | 'violet' | 'pink'>
            label="Accent"
            value={tweaks.accent}
            options={['auto', 'blue', 'cyan', 'lime', 'amber', 'violet', 'pink']}
            onChange={(v) => setTweak('accent', v)}
          />
          <TweakSection label="Layout" />
          <TweakToggle label="Show sidebar" value={tweaks.showSidebar} onChange={(v) => setTweak('showSidebar', v)} />
          <TweakToggle label="Show alerts column (auto on new alert)" value={tweaks.showRightbar} onChange={(v) => setTweak('showRightbar', v)} />
          <TweakSlider label="Kanban columns" value={tweaks.columnCount} min={3} max={5} step={1} onChange={(v) => setTweak('columnCount', v)} />
          <TweakSection label="Motion" />
          <TweakToggle label="Real-time animation" value={tweaks.animation} onChange={(v) => setTweak('animation', v)} />
          <TweakToggle label="Live polling (alerts/feed 30s)" value={tweaks.livePolling} onChange={(v) => setTweak('livePolling', v)} />
        </TweaksPanel>
      </div>
    </>
  );
}
