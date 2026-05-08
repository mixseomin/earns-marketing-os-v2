'use client';
import type { Mode, Project } from '@/lib/mock/types';
import { useTweaks } from './tweaks';

export function StatusBar({ mode, project, projectCount }: { mode?: Mode; project?: Project; projectCount: number }) {
  const badAlerts = mode?.alerts?.filter((a) => a.tone === 'bad').length ?? 0;
  const totalAlerts = mode?.alerts?.length ?? 0;
  const { tweaks, setTweak } = useTweaks();
  return (
    <footer className="statusbar">
      {project && (
        <div className="seg">
          <span style={{ fontSize: 13 }}>{project.emoji}</span>
          <b style={{ color: 'var(--fg-0)' }}>{project.name}</b>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>{mode?.label}</span>
        </div>
      )}
      <div className="seg"><span className="ok">●</span> NOMINAL</div>
      <div className="seg">CPU <b>34%</b></div>
      {mode && (
        <>
          <div className="seg">{mode.statusbar?.spend} <b>{mode.statusbar?.spendVal}</b> / {mode.statusbar?.spendCap}</div>
          <div className="seg">Tasks/min <b>{mode.statusbar?.tasksMin}</b></div>
        </>
      )}
      <button type="button"
              onClick={() => setTweak('showRightbar', !tweaks.showRightbar)}
              title={tweaks.showRightbar ? 'Click để ẩn Alerts/Activity column' : 'Click để hiện Alerts/Activity column'}
              className="seg"
              style={{
                appearance: 'none', cursor: 'pointer',
                background: tweaks.showRightbar ? 'var(--accent-soft)' : 'transparent',
                color: badAlerts > 0 ? 'var(--warn)' : 'var(--fg-2)',
                border: '1px solid ' + (tweaks.showRightbar ? 'var(--accent-line)' : 'transparent'),
                animation: badAlerts > 0 && !tweaks.showRightbar ? 'pulse-text 1.5s ease-in-out infinite' : undefined,
                font: 'inherit',
              }}>
        {badAlerts > 0 ? '⚠' : '·'} {totalAlerts} alerts {tweaks.showRightbar ? '◀' : '▶'}
      </button>
      <div className="grow"></div>
      <div className="seg">v2.5.0 • {projectCount} projects</div>
      <div className="seg">GMT+7 · 07:42:33</div>
    </footer>
  );
}
