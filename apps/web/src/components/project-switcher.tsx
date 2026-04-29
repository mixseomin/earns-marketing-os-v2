'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PROJECTS } from '@/lib/mock/projects';
import { MODES } from '@/lib/mock/modes';

export function ProjectSwitcher({ currentProjectId }: { currentProjectId?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const p = PROJECTS.find((x) => x.id === currentProjectId) || PROJECTS[0]!;
  const mode = MODES[p.mode];

  return (
    <div style={{ position: 'relative', padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 7,
        padding: '7px 10px', cursor: 'pointer', color: 'inherit',
      }}>
        <span style={{ fontSize: 18 }}>{p.emoji}</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>{mode?.label || p.mode}</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% - 4px)', left: 10, right: 10,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 9, boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 200,
          overflow: 'hidden', maxHeight: 380, overflowY: 'auto',
        }}>
          <div style={{ padding: '7px 10px 5px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--line)' }}>
            Projects ({PROJECTS.length})
          </div>
          {PROJECTS.map((proj) => {
            const m = MODES[proj.mode];
            const isActive = proj.id === currentProjectId;
            return (
              <div key={proj.id} onClick={() => { router.push(`/p/${proj.id}`); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: 16 }}>{proj.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>{m?.label || proj.mode} · {proj.agents.core + proj.agents.shared} ag</div>
                </div>
                {proj.alerts > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bad)', color: '#fff', flexShrink: 0 }}>{proj.alerts}</span>
                )}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: proj.health > 80 ? 'var(--ok)' : proj.health > 65 ? 'var(--warn)' : 'var(--bad)', flexShrink: 0, boxShadow: '0 0 5px currentColor' }}></div>
              </div>
            );
          })}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--line)', display: 'flex', gap: 6 }}>
            <button style={{ flex: 1, appearance: 'none', background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>+ New Project</button>
            <button onClick={() => { router.push('/'); setOpen(false); }} style={{ flex: 1, appearance: 'none', background: 'var(--accent)', color: 'var(--bg-0)', border: 0, borderRadius: 5, padding: '5px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⊞ Portfolio</button>
          </div>
        </div>
      )}
    </div>
  );
}
