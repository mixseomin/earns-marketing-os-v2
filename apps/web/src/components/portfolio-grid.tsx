'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MODES } from '@/lib/mock/modes';
import type { Project } from '@/lib/mock/types';

const healthColor = (h: number) => (h > 80 ? 'var(--ok)' : h > 65 ? 'var(--warn)' : 'var(--bad)');
const healthBucket = (h: number): 'healthy' | 'watch' | 'critical' => (h > 80 ? 'healthy' : h > 65 ? 'watch' : 'critical');

type SortKey = 'health' | 'name' | 'budget' | 'alerts';
type GroupKey = 'flat' | 'mode' | 'health' | 'kind';
type ViewKey = 'card' | 'compact';

const BUCKET_LABEL = { healthy: '🟢 Healthy >80%', watch: '🟡 Watching 65-80%', critical: '🔴 Critical <65%' };

export function PortfolioGrid({ projects: PROJECTS, totalBudget }: { projects: Project[]; totalBudget: number }) {
  const [q, setQ] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'watch' | 'critical'>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'real' | 'demo'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('health');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<GroupKey>('flat');
  const [view, setView] = useState<ViewKey>('card');

  const allModes = useMemo(() => Array.from(new Set(PROJECTS.map((p) => p.mode))).sort(), [PROJECTS]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return PROJECTS.filter((p) => {
      if (modeFilter !== 'all' && p.mode !== modeFilter) return false;
      if (healthFilter !== 'all' && healthBucket(p.health) !== healthFilter) return false;
      if (kindFilter === 'real' && p.isDemo) return false;
      if (kindFilter === 'demo' && !p.isDemo) return false;
      if (ql) {
        const hay = `${p.name} ${p.id} ${p.website ?? ''} ${p.oneLiner ?? ''}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [PROJECTS, q, modeFilter, healthFilter, kindFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'budget') return (a.budget - b.budget) * dir;
      if (sortBy === 'alerts') return (a.alerts - b.alerts) * dir;
      return (a.health - b.health) * dir;
    });
    return list;
  }, [filtered, sortBy, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === 'flat') return [{ key: 'all', label: '', items: sorted }];
    if (groupBy === 'mode') {
      const map = new Map<string, Project[]>();
      sorted.forEach((p) => {
        const arr = map.get(p.mode);
        if (arr) arr.push(p);
        else map.set(p.mode, [p]);
      });
      return Array.from(map.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, items]) => ({ key, label: MODES[key]?.label ?? key, items }));
    }
    if (groupBy === 'health') {
      const buckets: Record<'healthy' | 'watch' | 'critical', Project[]> = { healthy: [], watch: [], critical: [] };
      sorted.forEach((p) => buckets[healthBucket(p.health)].push(p));
      return (['healthy', 'watch', 'critical'] as const)
        .filter((k) => buckets[k].length > 0)
        .map((k) => ({ key: k, label: BUCKET_LABEL[k], items: buckets[k] }));
    }
    // kind
    const real = sorted.filter((p) => !p.isDemo);
    const demo = sorted.filter((p) => p.isDemo);
    return [
      ...(real.length ? [{ key: 'real', label: '🚀 Real', items: real }] : []),
      ...(demo.length ? [{ key: 'demo', label: '🎨 Demo', items: demo }] : []),
    ];
  }, [sorted, groupBy]);

  const chipBase: React.CSSProperties = {
    fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--line)',
    background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em', whiteSpace: 'nowrap',
  };
  const chipActive: React.CSSProperties = { ...chipBase, background: 'var(--accent)', color: 'var(--bg-0)', borderColor: 'var(--accent)', fontWeight: 600 };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 search name / website / oneliner…"
            style={{ flex: '1 1 220px', minWidth: 200, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 12, outline: 'none' }}
          />
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {sorted.length}/{PROJECTS.length}
          </span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button onClick={() => setView('card')} style={view === 'card' ? chipActive : chipBase} title="Card view (2-col grid)">▦ card</button>
            <button onClick={() => setView('compact')} style={view === 'compact' ? chipActive : chipBase} title="Compact dense table">≡ compact</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Health</span>
          {(['all', 'healthy', 'watch', 'critical'] as const).map((k) => (
            <button key={k} onClick={() => setHealthFilter(k)} style={healthFilter === k ? chipActive : chipBase}>
              {k === 'all' ? 'all' : k === 'healthy' ? '🟢 healthy' : k === 'watch' ? '🟡 watch' : '🔴 critical'}
            </button>
          ))}
          <span style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }} />
          <span style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Kind</span>
          {(['all', 'real', 'demo'] as const).map((k) => (
            <button key={k} onClick={() => setKindFilter(k)} style={kindFilter === k ? chipActive : chipBase}>{k}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Mode</span>
          <button onClick={() => setModeFilter('all')} style={modeFilter === 'all' ? chipActive : chipBase}>all</button>
          {allModes.map((m) => (
            <button key={m} onClick={() => setModeFilter(m)} style={modeFilter === m ? chipActive : chipBase}>{MODES[m]?.label ?? m}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Group</span>
          {(['flat', 'mode', 'health', 'kind'] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)} style={groupBy === g ? chipActive : chipBase}>{g}</button>
          ))}
          <span style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }} />
          <span style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>Sort</span>
          {(['health', 'name', 'budget', 'alerts'] as const).map((s) => (
            <button key={s} onClick={() => { if (sortBy === s) setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); else setSortBy(s); }} style={sortBy === s ? chipActive : chipBase}>
              {s}{sortBy === s ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 16 }}>
          {g.label && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 8px', borderBottom: '1px solid var(--line)', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{g.label}</span>
              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{g.items.length}</span>
            </div>
          )}
          {view === 'card' ? <CardGrid items={g.items} totalBudget={totalBudget} /> : <CompactList items={g.items} />}
        </div>
      ))}

      {sorted.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          không project nào khớp filter — reset chips bên trên
        </div>
      )}
    </div>
  );
}

function CardGrid({ items, totalBudget }: { items: Project[]; totalBudget: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
      {items.map((p) => {
        const mode = MODES[p.mode];
        const hc = healthColor(p.health);
        const utilization = Math.round((p.agents.core / Math.max(1, p.agents.core + p.agents.shared)) * 100);
        return (
          <Link key={p.id} href={`/p/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: 'var(--bg-1)', border: `1px solid ${p.health < 75 ? 'rgba(255,176,60,.25)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 22 }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-0)' }}>{p.name}{p.isDemo && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', background: 'var(--bg-3)', color: 'var(--fg-3)', borderRadius: 3, fontWeight: 400 }}>DEMO</span>}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>{mode?.label ?? p.mode} · {p.agents.core} core + {p.agents.shared} shared</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: hc, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: hc, boxShadow: `0 0 6px ${hc}` }} />
                    {p.health}%
                  </div>
                  {p.alerts > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: 'var(--bad)', color: '#fff' }}>⚠ {p.alerts}</span>
                  )}
                </div>
              </div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Cell label="Revenue" v={p.revenue} sub={p.kpi} subColor="var(--ok)" />
                <Cell label="Budget" v={p.budget > 0 ? `${p.budget}tr` : '—'} bar={Math.min(100, (p.budget / Math.max(1, totalBudget)) * 100 * 5)} barColor={p.color} />
                <Cell label="Agents" v={String(p.agents.core)} subText={`+${p.agents.shared}`} bar={utilization} barColor={p.color} />
              </div>
              <div style={{ height: 3, background: 'var(--bg-3)' }}>
                <div style={{ height: '100%', width: `${p.health}%`, background: hc }} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Cell({ label, v, sub, subColor, subText, bar, barColor }: { label: string; v: string; sub?: string; subColor?: string; subText?: string; bar?: number; barColor?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', fontVariantNumeric: 'tabular-nums' }}>{v}{subText && <small style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 4 }}>{subText}</small>}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: subColor ?? 'var(--fg-3)' }}>{sub}</div>}
      {bar !== undefined && (
        <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${bar}%`, background: barColor ?? 'var(--accent)' }} />
        </div>
      )}
    </div>
  );
}

function CompactList({ items }: { items: Project[] }) {
  const cell: React.CSSProperties = { padding: '6px 8px', fontSize: 11.5, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, textAlign: 'right', background: 'var(--bg-2)' };
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Project</th>
            <th style={head}>Mode</th>
            <th style={head}>Health</th>
            <th style={head}>Revenue</th>
            <th style={head}>Budget</th>
            <th style={head}>Agents</th>
            <th style={head}>Alerts</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const hc = healthColor(p.health);
            const mode = MODES[p.mode];
            return (
              <tr key={p.id}>
                <td style={{ ...cell, textAlign: 'left' }}>
                  <Link href={`/p/${p.id}`} style={{ color: 'var(--fg-1)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{p.emoji}</span>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    {p.isDemo && <span style={{ fontSize: 8.5, padding: '1px 4px', background: 'var(--bg-3)', color: 'var(--fg-3)', borderRadius: 3 }}>DEMO</span>}
                  </Link>
                </td>
                <td style={{ ...cell, color: 'var(--fg-3)', textAlign: 'right' }}>{mode?.label ?? p.mode}</td>
                <td style={{ ...cell, color: hc, fontWeight: 600, textAlign: 'right' }}>{p.health}%</td>
                <td style={{ ...cell, color: 'var(--fg-0)', textAlign: 'right' }}>{p.revenue}</td>
                <td style={{ ...cell, color: 'var(--fg-2)', textAlign: 'right' }}>{p.budget > 0 ? `${p.budget}tr` : '—'}</td>
                <td style={{ ...cell, color: 'var(--fg-2)', textAlign: 'right' }}>{p.agents.core}<small style={{ color: 'var(--fg-4)' }}> +{p.agents.shared}</small></td>
                <td style={{ ...cell, textAlign: 'right' }}>{p.alerts > 0 ? <span style={{ color: 'var(--bad)' }}>⚠ {p.alerts}</span> : <span style={{ color: 'var(--fg-4)' }}>0</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
