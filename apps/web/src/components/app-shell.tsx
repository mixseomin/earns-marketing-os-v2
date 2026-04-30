'use client';

import { type ReactNode, useEffect } from 'react';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakSlider } from './tweaks';
import { useLang } from '@/lib/lang-context';
import { ThemeApplier } from './theme-applier';
import { TopBar } from './topbar';
import { Sidebar } from './sidebar';
import { RightBar } from './rightbar';
import { StatusBar } from './statusbar';
import type { Mode, Project } from '@/lib/mock/types';

type Tab = 'dashboard' | 'board' | 'squads' | 'tribes' | 'studio' | 'resources' | 'settings';

export function AppShell({
  children,
  mode,
  project,
  projects,
  tab,
  isPortfolio = false,
}: {
  children: ReactNode;
  mode?: Mode;
  project?: Project;
  projects: Project[];
  tab?: Tab;
  isPortfolio?: boolean;
}) {
  const { tweaks, setTweak } = useTweaks();
  const { setLang } = useLang();
  const screenLabel = isPortfolio ? 'portfolio' : project ? `${project.id}-${tab ?? 'dashboard'}` : 'shell';

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
      <ThemeApplier modeAccent={mode?.accent} />
      <div className="app" data-sidebar={tweaks.showSidebar ? 'shown' : 'hidden'} data-anim={tweaks.animation ? 'on' : 'off'}>
        <TopBar tab={tab} mode={mode} currentProject={project} isPortfolio={isPortfolio} projectCount={projects.length} />
        {tweaks.showSidebar && <Sidebar mode={mode} currentProjectId={project?.id} projects={projects} />}
        <main className="main" data-screen-label={screenLabel}>{children}</main>
        <RightBar mode={mode} projectId={project?.id} />
        <StatusBar mode={mode} project={project} projectCount={projects.length} />

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
          <TweakSelect<'auto' | 'cyan' | 'lime' | 'amber' | 'violet' | 'pink'>
            label="Accent"
            value={tweaks.accent}
            options={['auto', 'cyan', 'lime', 'amber', 'violet', 'pink']}
            onChange={(v) => setTweak('accent', v)}
          />
          <TweakSection label="Layout" />
          <TweakToggle label="Show sidebar" value={tweaks.showSidebar} onChange={(v) => setTweak('showSidebar', v)} />
          <TweakSlider label="Kanban columns" value={tweaks.columnCount} min={3} max={5} step={1} onChange={(v) => setTweak('columnCount', v)} />
          <TweakSection label="Motion" />
          <TweakToggle label="Real-time animation" value={tweaks.animation} onChange={(v) => setTweak('animation', v)} />
          <TweakToggle label="Live polling (alerts/feed 30s)" value={tweaks.livePolling} onChange={(v) => setTweak('livePolling', v)} />
        </TweaksPanel>
      </div>
    </>
  );
}
