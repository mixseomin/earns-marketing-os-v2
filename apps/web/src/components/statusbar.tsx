import type { Mode, Project } from '@/lib/mock/types';

export function StatusBar({ mode, project, projectCount }: { mode?: Mode; project?: Project; projectCount: number }) {
  const badAlerts = mode?.alerts?.filter((a) => a.tone === 'bad').length ?? 0;
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
      <div className="seg warn">⚠ {badAlerts} alerts</div>
      <div className="grow"></div>
      <div className="seg">v2.5.0 • {projectCount} projects</div>
      <div className="seg">GMT+7 · 07:42:33</div>
    </footer>
  );
}
