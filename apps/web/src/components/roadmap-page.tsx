'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RoadmapRow, RoadmapStatus } from '@/lib/data';
import { markRoadmapItem, addRoadmapNote } from '@/lib/actions/roadmap';
import { PriorityPill, EffortPill, StatsStrip, EmptyState, type Priority, type Effort, type StatCard } from './ui';

const STATUS_META: Record<RoadmapStatus, { label: string; icon: string; color: string }> = {
  backlog:       { label: 'Backlog',     icon: '⚪', color: 'var(--fg-3)' },
  planned:       { label: 'Planned',     icon: '📋', color: '#60a5fa' },
  'in-progress': { label: 'In progress', icon: '🟡', color: '#fbbf24' },
  review:        { label: 'Review',      icon: '👁',  color: '#a78bfa' },
  done:          { label: 'Done',        icon: '✅', color: '#10b981' },
  blocked:       { label: 'Blocked',     icon: '🚫', color: '#9ca3af' },
  dropped:       { label: 'Dropped',     icon: '🗑',  color: '#6b7280' },
};

const STATUS_ORDER: RoadmapStatus[] = ['backlog', 'planned', 'in-progress', 'review', 'done', 'blocked', 'dropped'];

const CATEGORY_ICON: Record<string, string> = {
  feature: '✨', fix: '🔧', refactor: '♻️', infra: '🏗', idea: '💡',
};

const REPO = 'mixseomin/earns-marketing-os-v2';

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function fmtRelative(d: Date | null): string {
  if (!d) return '—';
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function RoadmapPage({ items }: { items: RoadmapRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filterStatus, setFilterStatus] = useState<RoadmapStatus | 'all'>('all');
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [notesEditing, setNotesEditing] = useState<RoadmapRow | null>(null);

  const toggleItem = (slug: string) => {
    setExpandedItems((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug); else n.add(slug);
      return n;
    });
  };

  const counts = useMemo(() => {
    const total = items.length;
    const byStatus: Record<RoadmapStatus, number> = { backlog: 0, planned: 0, 'in-progress': 0, review: 0, done: 0, blocked: 0, dropped: 0 };
    for (const r of items) byStatus[r.status] += 1;
    return { total, byStatus };
  }, [items]);

  // Group by phase, preserving sortOrder.
  const grouped = useMemo(() => {
    const groups = new Map<string, RoadmapRow[]>();
    const filtered = items.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPhase !== 'all' && r.phase !== filterPhase) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) &&
            !r.slug.toLowerCase().includes(q) &&
            !r.description.toLowerCase().includes(q) &&
            !r.tags.some((t) => t.toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    });
    for (const r of filtered) {
      if (!groups.has(r.phase)) groups.set(r.phase, []);
      groups.get(r.phase)!.push(r);
    }
    // Sort phases DESCENDING (newest first) — chưa-làm-trước. Numeric phases
    // theo số giảm dần (P12 → P11 → ... → P0); non-numeric như 'backlog' xuống
    // cuối. Issue trước: text sort 'asc' đặt '10' trước '2'.
    const phaseRank = (k: string): number => {
      const n = Number(k);
      return Number.isFinite(n) ? n : -1;  // backlog = -1, đẩy xuống cuối
    };
    return Array.from(groups.entries())
      .sort((a, b) => phaseRank(b[0]) - phaseRank(a[0]));
  }, [items, filterStatus, filterPhase, search]);

  const allPhases = useMemo(() => {
    const phases = Array.from(new Set(items.map((r) => r.phase)));
    const phaseRank = (k: string): number => {
      const n = Number(k);
      return Number.isFinite(n) ? n : -1;
    };
    return phases.sort((a, b) => phaseRank(b) - phaseRank(a));
  }, [items]);

  const togglePhase = (phase: string) => {
    setCollapsedPhases((s) => {
      const n = new Set(s);
      if (n.has(phase)) n.delete(phase); else n.add(phase);
      return n;
    });
  };

  const handleMark = (slug: string, status: RoadmapStatus) => {
    startTransition(async () => {
      const res = await markRoadmapItem(slug, status);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  };

  const phaseLabel = (key: string) => key === 'backlog' ? 'Backlog / Ideas' : `Phase ${key}`;

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🗺 Roadmap
            <small>// {counts.total} items · {counts.byStatus.done} done · {counts.byStatus['in-progress']} active · {counts.byStatus.backlog + counts.byStatus.planned} ahead</small>
          </h1>
          <p className="page-sub">
            Spec từ <code style={{ background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 3 }}>packages/db/src/seed-data/roadmap.ts</code>. Linked với <Link href="/tests" style={{ color: 'var(--accent)' }}>/tests</Link> qua use_case_slugs để verify "done = pass rate".
          </p>
        </div>
      </div>

      <StatsStrip
        cards={[
          { key: 'total', label: 'Total', value: counts.total, color: 'var(--fg-0)' },
          ...STATUS_ORDER.map<StatCard>((s) => ({
            key: s,
            label: <>{STATUS_META[s].icon} {STATUS_META[s].label}</>,
            value: counts.byStatus[s],
            color: STATUS_META[s].color,
            active: filterStatus === s,
            onClick: () => setFilterStatus(filterStatus === s ? 'all' : s),
          })),
        ]}
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="chip" data-active={filterStatus === 'all' || undefined} onClick={() => setFilterStatus('all')}>All status</span>
        {STATUS_ORDER.map((s) => (
          <span key={s} className="chip" data-active={filterStatus === s || undefined} onClick={() => setFilterStatus(s)}>
            {STATUS_META[s].icon} {STATUS_META[s].label}
          </span>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
        <span className="chip" data-active={filterPhase === 'all' || undefined} onClick={() => setFilterPhase('all')}>All phases</span>
        {allPhases.map((p) => (
          <span key={p} className="chip" data-active={filterPhase === p || undefined} onClick={() => setFilterPhase(p)}>
            {phaseLabel(p)}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <input
          placeholder="Search title, slug, tag, description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 220 }}
        />
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon="🔍" title="Không có item nào match filter" compact />
      ) : (
        grouped.map(([phase, list]) => {
          const doneCount = list.filter((r) => r.status === 'done').length;
          const isCollapsed = collapsedPhases.has(phase);
          return (
            <div key={phase} style={{ marginBottom: 20 }}>
              <div onClick={() => togglePhase(phase)}
                   style={{
                     display: 'flex', alignItems: 'center', gap: 8, marginBottom: isCollapsed ? 0 : 8,
                     paddingBottom: 4, borderBottom: '1px solid var(--line)',
                     cursor: 'pointer', userSelect: 'none',
                   }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)', width: 14, textAlign: 'center' }}>
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{phaseLabel(phase)}</h2>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  {doneCount}/{list.length} done
                </span>
                <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
                  <div style={{ height: '100%', width: `${list.length ? (doneCount / list.length) * 100 : 0}%`, background: '#10b981' }} />
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {list.map((item) => {
                    const meta = STATUS_META[item.status];
                    const isDone = item.status === 'done';
                    const isBacklog = item.status === 'backlog' || item.status === 'planned';
                    const isDropped = item.status === 'dropped';
                    const hasFailingTests = item.linkedTests.needsFix > 0 || item.linkedTests.fail > 0;
                    const isAttention = item.status === 'in-progress' || item.status === 'review'
                      || item.status === 'blocked' || hasFailingTests
                      || (isDone && item.linkedTests.total > 0 && item.linkedTests.pass < item.linkedTests.total);
                    const isExpanded = expandedItems.has(item.slug);

                    // Visual hierarchy: spotlight active/attention items, mute everything else.
                    const rowOpacity = isDropped ? 0.45 : isBacklog ? 0.7 : 1;
                    const borderColor = isAttention ? meta.color : 'var(--line)';
                    const titleColor = isAttention ? 'var(--fg-0)' : 'var(--fg-1)';

                    return (
                      <div key={item.slug} className="panel"
                           style={{
                             borderLeft: `2px solid ${borderColor}`,
                             opacity: rowOpacity,
                             cursor: 'pointer',
                           }}
                           onClick={(e) => {
                             // Don't toggle when clicking interactive elements inside.
                             const tag = (e.target as HTMLElement).tagName;
                             if (tag === 'A' || tag === 'BUTTON' || (e.target as HTMLElement).closest('button, a')) return;
                             toggleItem(item.slug);
                           }}>
                        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, flexShrink: 0, opacity: isAttention ? 1 : 0.55 }}>{meta.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: titleColor, fontWeight: 600 }}>{item.title}</span>
                              {/* Pills only for attention rows */}
                              {isAttention && (
                                <>
                                  <PriorityPill priority={item.priority as Priority} />
                                  <EffortPill effort={item.effort as Effort} />
                                </>
                              )}
                              {item.shippedIn && (
                                <a href={`https://github.com/${REPO}/commit/${item.shippedIn}`}
                                   target="_blank" rel="noopener noreferrer"
                                   onClick={(e) => e.stopPropagation()}
                                   style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textDecoration: 'none' }}>
                                  #{item.shippedIn}
                                </a>
                              )}
                              {/* Right-aligned trailing meta */}
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                                {isDone && item.doneAt ? `✓ ${fmtRelative(item.doneAt)}` :
                                 item.startedAt ? `started ${fmtRelative(item.startedAt)}` :
                                 meta.label.toLowerCase()}
                              </span>
                              {/* Linked tests pill — only show when has linked tests AND there's a signal */}
                              {item.linkedTests.total > 0 && (hasFailingTests || (isDone && item.linkedTests.pass < item.linkedTests.total)) && (
                                <Link href="/tests" onClick={(e) => e.stopPropagation()}
                                      title={`${item.linkedTests.pass}/${item.linkedTests.total} pass · ${item.linkedTests.needsFix} needs-fix · ${item.linkedTests.fail} fail`}
                                      style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: hasFailingTests ? 'rgba(249,115,22,.12)' : 'rgba(255,176,60,.1)', color: hasFailingTests ? '#f97316' : 'var(--warn)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                                  🧪 {item.linkedTests.pass}/{item.linkedTests.total}
                                  {item.linkedTests.needsFix > 0 && ` · 🔧${item.linkedTests.needsFix}`}
                                </Link>
                              )}
                            </div>

                            {/* Description shown only for attention rows OR when expanded */}
                            {(isAttention || isExpanded) && item.description && (
                              <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 3, lineHeight: 1.4 }}>
                                {item.description}
                              </div>
                            )}

                            {isExpanded && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                                <span>{CATEGORY_ICON[item.category] || '•'} {item.category}</span>
                                {item.featureRef && <span>📦 {item.featureRef}</span>}
                                {item.dependsOn.length > 0 && (
                                  <span title="Depends on">↳ {item.dependsOn.map((d) => d.replace(/^phase-\d+-/, '')).join(', ')}</span>
                                )}
                                {item.tags.slice(0, 4).map((t) => <span key={t}>#{t}</span>)}
                                {/* Always show full linked tests info when expanded */}
                                {item.linkedTests.total > 0 && (
                                  <span>🧪 {item.linkedTests.pass}/{item.linkedTests.total} pass</span>
                                )}
                              </div>
                            )}

                            {item.notes && isExpanded && (
                              <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-2)', borderRadius: 5, fontSize: 11.5, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>
                                {item.notes}
                              </div>
                            )}
                          </div>
                          {/* Expand chevron — quiet visual cue */}
                          <span style={{ fontSize: 10, color: 'var(--fg-4)', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
                        </div>

                        {/* Action row — only when expanded */}
                        {isExpanded && (
                          <div style={{ padding: '6px 14px', borderTop: '1px solid var(--line)', display: 'flex', gap: 5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                            {item.status !== 'planned'    && <button className="btn" onClick={() => handleMark(item.slug, 'planned')} style={{ fontSize: 10, padding: '3px 8px' }}>📋 Plan</button>}
                            {item.status !== 'in-progress' && <button className="btn" onClick={() => handleMark(item.slug, 'in-progress')} style={{ fontSize: 10, padding: '3px 8px' }}>🟡 Start</button>}
                            {item.status !== 'review'     && <button className="btn" onClick={() => handleMark(item.slug, 'review')} style={{ fontSize: 10, padding: '3px 8px' }}>👁 Review</button>}
                            {item.status !== 'done'       && <button className="btn" onClick={() => handleMark(item.slug, 'done')} style={{ fontSize: 10, padding: '3px 8px', background: 'rgba(16,185,129,.1)', borderColor: 'rgba(16,185,129,.4)', color: '#10b981' }}>✅ Done</button>}
                            {item.status !== 'blocked'    && <button className="btn" onClick={() => handleMark(item.slug, 'blocked')} style={{ fontSize: 10, padding: '3px 8px' }}>🚫 Block</button>}
                            {item.status !== 'dropped'    && <button className="btn" onClick={() => handleMark(item.slug, 'dropped')} style={{ fontSize: 10, padding: '3px 8px' }}>🗑 Drop</button>}
                            {item.status !== 'backlog'    && <button className="btn ghost" onClick={() => handleMark(item.slug, 'backlog')} style={{ fontSize: 10, padding: '3px 8px' }}>↺ Backlog</button>}
                            <span style={{ flex: 1 }} />
                            <button className="btn" onClick={() => setNotesEditing(item)} style={{ fontSize: 10, padding: '3px 8px', ...(item.notes ? { background: 'rgba(56,189,248,.1)', borderColor: 'rgba(56,189,248,.4)' } : {}) }}>
                              📝 Notes{item.notes ? ' · edit' : ''}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {notesEditing && <NotesModal item={notesEditing} onClose={() => setNotesEditing(null)} />}
    </div>
  );
}

function NotesModal({ item, onClose }: { item: RoadmapRow; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(item.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    startTransition(async () => {
      const res = await addRoadmapNote(item.slug, text);
      setSaving(false);
      if (!res.ok) { alert(res.error); return; }
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{item.slug}</div>
            <h2>Notes · {item.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Decisions, links, blockers, refs…"
            style={{
              width: '100%', minHeight: 200, resize: 'vertical', padding: 10,
              background: 'var(--bg-2)', border: '1px solid var(--line)',
              borderRadius: 6, color: 'var(--fg-0)', fontSize: 13,
              fontFamily: 'var(--font-mono)', lineHeight: 1.5, outline: 'none',
            }}
          />
        </div>
        <div className="modal-foot">
          <div className="meta">{text.length} chars</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save notes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
