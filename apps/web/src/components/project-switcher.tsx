'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MODES } from '@/lib/mock/modes';
import type { Project } from '@/lib/mock/types';
import { projectSearchHaystack, projectTags } from '@/lib/project-tags';

// Known sub-pages under /p/[id]/
const PROJECT_TABS = new Set([
  'board', 'inbox', 'squads', 'tribes', 'resources',
  'publications', 'flow', 'studio', 'settings', 'roadmap',
]);

type HealthBucket = 'healthy' | 'watch' | 'critical';
const healthBucket = (h: number): HealthBucket => (h > 80 ? 'healthy' : h > 65 ? 'watch' : 'critical');
const healthDot = (h: number) => (h > 80 ? 'var(--ok)' : h > 65 ? 'var(--warn)' : 'var(--bad)');

export function ProjectSwitcher({ currentProjectId, projects: PROJECTS }: { currentProjectId?: string; projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | HealthBucket>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'real' | 'demo'>('all');
  const [groupByMode, setGroupByMode] = useState(false);
  const [foldedModes, setFoldedModes] = useState<Set<string>>(new Set());

  const router = useRouter();
  const pathname = usePathname();

  const pathParts = pathname.split('/');
  const currentTab = pathParts[3] && PROJECT_TABS.has(pathParts[3]) ? pathParts[3] : null;
  const navigateTo = (projectId: string) => currentTab ? `/p/${projectId}/${currentTab}` : `/p/${projectId}`;

  const p = currentProjectId ? PROJECTS.find((x) => x.id === currentProjectId) : undefined;
  const mode = p ? MODES[p.mode] : undefined;
  const isPortfolioFallback = !p;

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    PROJECTS.forEach((x) => map.set(x.id, projectSearchHaystack(x)));
    return map;
  }, [PROJECTS]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return PROJECTS.filter((x) => {
      if (healthFilter !== 'all' && healthBucket(x.health) !== healthFilter) return false;
      if (kindFilter === 'real' && x.isDemo) return false;
      if (kindFilter === 'demo' && !x.isDemo) return false;
      if (ql) {
        const hay = haystacks.get(x.id) || '';
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [PROJECTS, q, healthFilter, kindFilter, haystacks]);

  const grouped = useMemo(() => {
    const real = filtered.filter((x) => !x.isDemo);
    const demo = filtered.filter((x) => x.isDemo);

    type Group = { key: string; label: string; items: Project[]; isDemoGroup?: boolean };
    const out: Group[] = [];

    const byMode = (items: Project[]): Group[] => {
      const map = new Map<string, Project[]>();
      items.forEach((proj) => {
        const arr = map.get(proj.mode);
        if (arr) arr.push(proj);
        else map.set(proj.mode, [proj]);
      });
      return Array.from(map.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, items]) => ({ key, label: MODES[key]?.label ?? key, items }));
    };

    if (groupByMode) {
      // real projects split by mode (each gets its own labeled group)
      out.push(...byMode(real));
      // all demos lumped together at the bottom under one DEMO header
      if (demo.length) out.push({ key: '__demo__', label: `DEMO · ${demo.length}`, items: demo, isDemoGroup: true });
    } else {
      // flat real block (no header) + flat demo block (always headered)
      if (real.length) out.push({ key: '', label: '', items: real });
      if (demo.length) out.push({ key: '__demo__', label: `DEMO · ${demo.length}`, items: demo, isDemoGroup: true });
    }
    return out;
  }, [filtered, groupByMode]);

  const chipBase: React.CSSProperties = {
    fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid var(--line)',
    background: 'var(--bg-2)', color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
  };
  const chipActive: React.CSSProperties = { ...chipBase, background: 'var(--accent)', color: 'var(--bg-0)', borderColor: 'var(--accent)', fontWeight: 600 };

  return (
    <div style={{ position: 'relative', padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 7,
        padding: '7px 10px', cursor: 'pointer', color: 'inherit',
      }}>
        <span style={{ fontSize: 18 }}>{isPortfolioFallback ? '⊞' : p!.emoji}</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isPortfolioFallback ? 'All Projects' : p!.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>
            {isPortfolioFallback ? `${PROJECTS.length} projects` : (mode?.label || p!.mode)}
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% - 4px)', left: 10, right: 10,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 9, boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 200,
          overflow: 'hidden', maxHeight: 520, display: 'flex', flexDirection: 'column',
        }}>
          {/* Sticky filter header */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-1)' }}>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 search…"
              autoFocus
              style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 11.5, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setHealthFilter('all')} style={healthFilter === 'all' ? chipActive : chipBase}>all</button>
              <button onClick={() => setHealthFilter('healthy')} style={healthFilter === 'healthy' ? chipActive : chipBase} title="Health > 80%">🟢</button>
              <button onClick={() => setHealthFilter('watch')} style={healthFilter === 'watch' ? chipActive : chipBase} title="Health 65-80%">🟡</button>
              <button onClick={() => setHealthFilter('critical')} style={healthFilter === 'critical' ? chipActive : chipBase} title="Health < 65%">🔴</button>
              <span style={{ width: 1, height: 12, background: 'var(--line)', margin: '0 2px' }} />
              <button onClick={() => setKindFilter(kindFilter === 'real' ? 'all' : 'real')} style={kindFilter === 'real' ? chipActive : chipBase} title="Real projects only">🚀 real</button>
              <button onClick={() => setKindFilter(kindFilter === 'demo' ? 'all' : 'demo')} style={kindFilter === 'demo' ? chipActive : chipBase} title="Demo only">🎨 demo</button>
              <button onClick={() => setGroupByMode((v) => !v)} style={groupByMode ? chipActive : chipBase} title="Group by mode">⊟ mode</button>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)' }}>
                {filtered.length}/{PROJECTS.length}
              </span>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {grouped.map((g) => {
              const isFolded = foldedModes.has(g.key);
              const isDemoGroup = g.isDemoGroup;
              const showHeader = !!g.label;
              return (
                <div key={g.key || 'flat'}>
                  {showHeader && (
                    <div
                      onClick={() => setFoldedModes((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                      style={{
                        padding: '6px 10px 4px',
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        color: isDemoGroup ? 'var(--fg-4)' : 'var(--fg-3)',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: isDemoGroup ? 'var(--bg-3)' : 'var(--bg-2)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        borderTop: isDemoGroup ? '1px dashed var(--line)' : 'none',
                        borderBottom: '1px solid var(--line)',
                      }}
                      title={isDemoGroup ? 'Mock projects for design preview' : undefined}
                    >
                      <span style={{ fontSize: 8 }}>{isFolded ? '▸' : '▾'}</span>
                      {isDemoGroup && <span style={{ fontSize: 10 }}>🎨</span>}
                      {g.label}
                      {!isDemoGroup && <span style={{ color: 'var(--fg-4)', marginLeft: 4 }}>{g.items.length}</span>}
                    </div>
                  )}
                  {!isFolded && g.items.map((proj) => {
                    const m = MODES[proj.mode];
                    const isActive = proj.id === currentProjectId;
                    const tagPreview = projectTags(proj)
                      .filter((t) => t !== proj.mode.toLowerCase())
                      .slice(0, 3)
                      .map((t) => `#${t}`)
                      .join(' ');
                    return (
                      <div key={proj.id} onClick={() => { router.push(navigateTo(proj.id)); setOpen(false); }} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                        background: isActive ? 'var(--accent-soft)' : 'transparent',
                        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                        cursor: 'pointer',
                        opacity: proj.isDemo && !isActive ? 0.55 : 1,
                      }}>
                        <span style={{ fontSize: 15 }}>{proj.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m?.label || proj.mode} · {proj.agents.core + proj.agents.shared}ag
                            {tagPreview && <span style={{ color: 'var(--fg-4)' }}> · {tagPreview}</span>}
                          </div>
                        </div>
                        {proj.alerts > 0 && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bad)', color: '#fff', flexShrink: 0 }}>{proj.alerts}</span>
                        )}
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: healthDot(proj.health), flexShrink: 0, boxShadow: '0 0 4px currentColor' }} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                không khớp filter
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--line)', display: 'flex', gap: 6, background: 'var(--bg-1)' }}>
            <button onClick={() => { router.push('/p/new'); setOpen(false); }} style={{ flex: 1, appearance: 'none', background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>+ New</button>
            <button onClick={() => { router.push('/'); setOpen(false); }} style={{ flex: 1, appearance: 'none', background: 'var(--accent)', color: 'var(--bg-0)', border: 0, borderRadius: 5, padding: '5px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⊞ Portfolio</button>
          </div>
        </div>
      )}
    </div>
  );
}
