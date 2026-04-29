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

      <div className="side-section">
        <div className="side-title"><span>SYSTEM</span></div>
        <Link href="/roadmap" className="squad" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
          <div className="squad-icon" style={{ color: 'var(--neon-cyan)' }}>🗺</div>
          <div className="squad-name"><b>Roadmap</b><span>plan · phases · dependencies</span></div>
        </Link>
        <Link href="/tests" className="squad" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
          <div className="squad-icon" style={{ color: 'var(--neon-lime)' }}>✓</div>
          <div className="squad-name"><b>Tests</b><span>use cases · QA tracker</span></div>
        </Link>
        <div className="squad">
          <div className="squad-icon" style={{ color: 'var(--neon-amber)' }}>⌖</div>
          <div className="squad-name"><b>Playbooks</b><span>42 active</span></div>
        </div>
        <div className="squad">
          <div className="squad-icon" style={{ color: 'var(--neon-cyan)' }}>⚙</div>
          <div className="squad-name"><b>Trust thresholds</b><span>L1–L4 config</span></div>
        </div>
        <Link href="/" className="squad" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
          <div className="squad-icon" style={{ color: 'var(--neon-violet)' }}>⊞</div>
          <div className="squad-name"><b>All Projects</b><span>Portfolio</span></div>
        </Link>
      </div>

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
