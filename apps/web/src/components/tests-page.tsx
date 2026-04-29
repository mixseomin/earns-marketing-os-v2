'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { UseCaseRow, UseCaseStatus } from '@/lib/data';
import { markUseCase, addFeedback, clearStatus } from '@/lib/actions/use-cases';
import { Pill, PriorityPill, StatsStrip, EmptyState, type Priority, type StatCard } from './ui';

const STATUS_META: Record<UseCaseStatus, { label: string; icon: string; color: string }> = {
  pending:     { label: 'Pending',   icon: '⚪', color: 'var(--fg-3)' },
  wip:         { label: 'WIP',       icon: '🟡', color: '#fbbf24' },
  pass:        { label: 'Pass',      icon: '🟢', color: '#10b981' },
  fail:        { label: 'Fail',      icon: '🔴', color: '#f87171' },
  'needs-fix': { label: 'Needs fix', icon: '🔧', color: '#f97316' },
  blocked:     { label: 'Blocked',   icon: '🚫', color: '#9ca3af' },
  skip:        { label: 'Skip',      icon: '⏭',  color: '#6b7280' },
};

// Order: untouched first, in-flight middle, terminal last. needs-fix between
// fail and blocked because it requires AI re-work before re-test.
const STATUS_ORDER: UseCaseStatus[] = ['pending', 'wip', 'pass', 'fail', 'needs-fix', 'blocked', 'skip'];

const REPO = 'mixseomin/earns-marketing-os-v2';

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  const now = Date.now();
  const dt = new Date(d).getTime();
  const min = Math.floor((now - dt) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString();
}

export function TestsPage({ cases }: { cases: UseCaseRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filterStatus, setFilterStatus] = useState<UseCaseStatus | 'all'>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [feedbackEditing, setFeedbackEditing] = useState<UseCaseRow | null>(null);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((s) => {
      const n = new Set(s);
      if (n.has(groupKey)) n.delete(groupKey); else n.add(groupKey);
      return n;
    });
  };

  // Counters by status
  const counts = useMemo(() => {
    const total = cases.length;
    const byStatus: Record<UseCaseStatus, number> = { pending: 0, wip: 0, pass: 0, fail: 0, 'needs-fix': 0, blocked: 0, skip: 0 };
    for (const c of cases) byStatus[c.status] += 1;
    return { total, byStatus };
  }, [cases]);

  // Group cases by groupKey (preserve order via sortOrder)
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; cases: UseCaseRow[] }>();
    const filtered = cases.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterGroup !== 'all' && c.groupKey !== filterGroup) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.title.toLowerCase().includes(q) &&
            !c.slug.toLowerCase().includes(q) &&
            !c.tags.some((t) => t.toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    });
    for (const c of filtered) {
      if (!groups.has(c.groupKey)) groups.set(c.groupKey, { label: c.groupLabel, cases: [] });
      groups.get(c.groupKey)!.cases.push(c);
    }
    return Array.from(groups.entries()).map(([key, val]) => ({ key, ...val }));
  }, [cases, filterStatus, filterGroup, search]);

  const allGroups = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of cases) set.set(c.groupKey, c.groupLabel);
    return Array.from(set.entries()).map(([k, v]) => ({ key: k, label: v }));
  }, [cases]);

  const toggleExpand = (slug: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug); else n.add(slug);
      return n;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(cases.map((c) => c.slug)));
    setCollapsedGroups(new Set()); // open all groups too
  };
  const collapseAll = () => {
    setExpanded(new Set());
    // collapse all groups too — user expects "collapse all" to fully fold the page
    setCollapsedGroups(new Set(Array.from(new Set(cases.map((c) => c.groupKey)))));
  };

  const handleMark = (slug: string, status: UseCaseStatus) => {
    startTransition(async () => {
      const res = await markUseCase(slug, status);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  };

  const handleClear = (slug: string) => {
    startTransition(async () => {
      await clearStatus(slug);
      router.refresh();
    });
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            ✓ Tests
            <small>// USE CASE REGISTRY · {counts.total} total</small>
          </h1>
          <p className="page-sub">
            Tự động cập nhật từ seed file <code style={{ background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 3 }}>packages/db/src/seed-data/use-cases.ts</code> — mỗi feature ship sẽ thêm cases vào đây. Test xong, mark status để track progress.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={expandAll}>Expand all</button>
          <button className="btn" onClick={collapseAll}>Collapse all</button>
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
          <span key={s} className="chip" data-active={filterStatus === s || undefined}
                onClick={() => setFilterStatus(s)}>
            {STATUS_META[s].icon} {STATUS_META[s].label}
          </span>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
        <span className="chip" data-active={filterGroup === 'all' || undefined} onClick={() => setFilterGroup('all')}>All groups</span>
        {allGroups.map((g) => (
          <span key={g.key} className="chip" data-active={filterGroup === g.key || undefined}
                onClick={() => setFilterGroup(g.key)}>
            G{g.key}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <input
          placeholder="Search title, slug, tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 200 }}
        />
      </div>

      {/* Groups */}
      {grouped.length === 0 ? (
        <EmptyState icon="🔍" title="Không có case nào match filter" compact />
      ) : (
        grouped.map((g) => {
          const passCount = g.cases.filter((c) => c.status === 'pass').length;
          const needsFixCount = g.cases.filter((c) => c.status === 'needs-fix').length;
          const failCount = g.cases.filter((c) => c.status === 'fail').length;
          const isGroupCollapsed = collapsedGroups.has(g.key);
          return (
            <div key={g.key} style={{ marginBottom: 20 }}>
              <div onClick={() => toggleGroup(g.key)}
                   style={{
                     display: 'flex', alignItems: 'center', gap: 8,
                     marginBottom: isGroupCollapsed ? 0 : 8,
                     paddingBottom: 4, borderBottom: '1px solid var(--line)',
                     cursor: 'pointer', userSelect: 'none',
                   }}
                   title={isGroupCollapsed ? 'Click to expand group' : 'Click to collapse group'}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)', width: 14, textAlign: 'center' }}>
                  {isGroupCollapsed ? '▸' : '▾'}
                </span>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{g.label}</h2>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  {passCount}/{g.cases.length} pass
                </span>
                {needsFixCount > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(249,115,22,.15)', color: '#f97316', fontFamily: 'var(--font-mono)' }}>
                    🔧 {needsFixCount}
                  </span>
                )}
                {failCount > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(248,113,113,.15)', color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                    🔴 {failCount}
                  </span>
                )}
              </div>

              {!isGroupCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.cases.map((c) => {
                  const isOpen = expanded.has(c.slug);
                  const meta = STATUS_META[c.status];
                  return (
                    <div key={c.slug}
                         className="panel"
                         style={{ borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                           onClick={() => toggleExpand(c.slug)}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
                              {c.slug}
                            </span>
                            <PriorityPill priority={c.priority as Priority} />
                            {c.shippedIn && c.shippedIn !== 'WIP' && (
                              <a href={`https://github.com/${REPO}/commit/${c.shippedIn}`}
                                 target="_blank" rel="noopener noreferrer"
                                 onClick={(e) => e.stopPropagation()}
                                 style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textDecoration: 'none' }}>
                                #{c.shippedIn}
                              </a>
                            )}
                            {c.tags.slice(0, 3).map((t) => (
                              <span key={t} style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>#{t}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500, marginTop: 2 }}>
                            {c.title}
                          </div>
                          {c.lastTestedAt && (
                            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              {meta.icon} {meta.label} · {fmtDate(c.lastTestedAt)}
                              {c.statusNote && <span style={{ color: meta.color, marginLeft: 6 }}>"{c.statusNote}"</span>}
                            </div>
                          )}
                          {c.status === 'needs-fix' && c.fixedIn && c.fixedAt && (
                            <div style={{
                              marginTop: 4, padding: '3px 8px', borderRadius: 4,
                              background: 'rgba(56,189,248,.12)',
                              border: '1px solid rgba(56,189,248,.4)',
                              color: '#38bdf8',
                              fontSize: 11, fontFamily: 'var(--font-mono)',
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              animation: 'pulse-cyan 2s ease-in-out infinite',
                            }}>
                              <span>🔄 Fix shipped {fmtDate(c.fixedAt)}</span>
                              <a href={`https://github.com/${REPO}/commit/${c.fixedIn}`}
                                 target="_blank" rel="noopener noreferrer"
                                 onClick={(e) => e.stopPropagation()}
                                 style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                                #{c.fixedIn}
                              </a>
                              <span style={{ color: 'var(--fg-2)' }}>· please re-test</span>
                              {c.fixNote && <span style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>— {c.fixNote}</span>}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{isOpen ? '▾' : '▸'}</span>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--line)' }}>
                          {c.featureRef && (
                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--fg-3)' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feature:</span> {c.featureRef}
                            </div>
                          )}

                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Steps</div>
                            <ol style={{ margin: 0, paddingLeft: 22, fontSize: 12, color: 'var(--fg-1)' }}>
                              {c.steps.map((s) => (
                                <li key={s.n} style={{ marginBottom: 3 }}>
                                  {s.action}
                                  {s.url && (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                                       style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                                      ↗ {s.url}
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Expected</div>
                            <div style={{ fontSize: 12, color: 'var(--fg-1)', whiteSpace: 'pre-line' }}>{c.expected}</div>
                          </div>

                          {c.feedback && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Feedback</div>
                              <div style={{ fontSize: 12, color: 'var(--fg-1)', background: 'var(--bg-2)', padding: 8, borderRadius: 5, whiteSpace: 'pre-wrap' }}>{c.feedback}</div>
                            </div>
                          )}

                          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn" onClick={() => handleMark(c.slug, 'pass')} style={{ background: 'rgba(16,185,129,.1)', borderColor: 'rgba(16,185,129,.4)', color: '#10b981' }}>🟢 Pass</button>
                            <button className="btn" onClick={() => handleMark(c.slug, 'fail')} style={{ background: 'rgba(248,113,113,.1)', borderColor: 'rgba(248,113,113,.4)', color: '#f87171' }}>🔴 Fail</button>
                            <button className="btn" onClick={() => handleMark(c.slug, 'needs-fix')} style={{ background: 'rgba(249,115,22,.1)', borderColor: 'rgba(249,115,22,.4)', color: '#f97316' }}>🔧 Needs fix</button>
                            <button className="btn" onClick={() => handleMark(c.slug, 'wip')}>🟡 WIP</button>
                            <button className="btn" onClick={() => handleMark(c.slug, 'blocked')}>🚫 Blocked</button>
                            <button className="btn" onClick={() => handleMark(c.slug, 'skip')}>⏭ Skip</button>
                            <button className="btn ghost" onClick={() => handleClear(c.slug)}>↺ Reset</button>
                            <span style={{ flex: 1 }} />
                            <button className="btn" onClick={() => setFeedbackEditing(c)} style={c.feedback ? { background: 'rgba(249,115,22,.1)', borderColor: 'rgba(249,115,22,.4)' } : undefined}>
                              📝 Feedback{c.feedback ? ' · edit' : ''}
                            </button>
                          </div>
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

      {feedbackEditing && (
        <FeedbackModal useCase={feedbackEditing} onClose={() => setFeedbackEditing(null)} />
      )}
    </div>
  );
}

function FeedbackModal({ useCase, onClose }: { useCase: UseCaseRow; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(useCase.feedback ?? '');
  const [markFix, setMarkFix] = useState(true);
  const [saving, setSaving] = useState(false);

  const trimmed = text.trim();
  const willMarkFix = markFix && trimmed.length > 0;

  const handleSave = () => {
    setSaving(true);
    startTransition(async () => {
      const res = await addFeedback(useCase.slug, text, markFix);
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
            <div className="id-line">{useCase.slug}</div>
            <h2>Feedback · {useCase.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mô tả vấn đề chi tiết — screenshot URL, browser, edge case, expected vs actual. AI sẽ dùng đoạn này làm task spec để fix."
            style={{
              width: '100%', minHeight: 200, resize: 'vertical',
              padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)',
              borderRadius: 6, color: 'var(--fg-0)', fontSize: 13,
              fontFamily: 'var(--font-mono)', lineHeight: 1.5, outline: 'none',
            }}
          />

          <label style={{
            marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: 10, borderRadius: 6,
            background: willMarkFix ? 'rgba(249,115,22,.08)' : 'var(--bg-2)',
            border: `1px solid ${willMarkFix ? 'rgba(249,115,22,.4)' : 'var(--line)'}`,
            cursor: trimmed.length > 0 ? 'pointer' : 'default',
            opacity: trimmed.length > 0 ? 1 : 0.5,
          }}>
            <input
              type="checkbox"
              checked={markFix}
              disabled={trimmed.length === 0}
              onChange={(e) => setMarkFix(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
              <div style={{ fontWeight: 600, color: willMarkFix ? '#f97316' : 'var(--fg-1)' }}>
                🔧 Mark as "needs-fix"
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                Khi tick: status chuyển sang <code>needs-fix</code>, AI sẽ scan các case này và dùng feedback ở trên làm task spec để fix. Untick nếu chỉ thêm note context (giữ status hiện tại).
              </div>
            </div>
          </label>
        </div>
        <div className="modal-foot">
          <div className="meta">
            {text.length} chars
            {willMarkFix && <span style={{ color: '#f97316', marginLeft: 8 }}>· will mark 🔧 needs-fix</span>}
          </div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : willMarkFix ? 'Save & mark needs-fix' : 'Save feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
