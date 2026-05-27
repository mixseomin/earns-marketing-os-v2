'use client';

// 🧵 Threads đã engage — group cards theo parent_url trong 1 brief.
// User feedback: "1 parent có thể nhận nhiều comments theo thời gian (re-post
// sau khi bị ghosted, A/B model khác nhau, team multi-seed). Plan để xử lý."
//
// Section trong BriefEditModal hiển thị:
//   - List unique parent_url, mỗi row = parent title + status badges
//     (✅ N live · 👻 N ghosted · 🗑 N removed · 📝 N draft)
//   - Click expand → list attempts: account · postedAt · lifecycle badge ·
//     insights chip · postUrl link · "Mark lifecycle" dropdown
//
// Server actions (KHÔNG qua REST endpoint):
//   - listEngagedThreadsForBrief(briefId): summary list
//   - listEngagementsByParentUrl(projectId, parentUrl): detail expand
//   - updateCardLifecycle: mark manual
//
// Filter chip: tất cả / có-ghosted-or-removed / chỉ-live.

import { useState, useEffect, useTransition } from 'react';
import {
  listEngagedThreadsForBrief,
  listEngagementsByParentUrl,
  updateCardLifecycle,
  type EngagementAttempt,
  type ParentEngagementSummary,
} from '@/lib/actions/brief-posts';
import { wrapExternalUrl } from '@/lib/external-url';

interface ThreadRow {
  parentUrl: string;
  parentTitle: string | null;
  attemptCount: number;
  postedCount: number;
  liveCount: number;
  ghostedCount: number;
  removedCount: number;
  lastAttemptAt: string | null;
}

const LIFECYCLE_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  live: { icon: '✅', label: 'Live', color: 'var(--ok)', bg: 'rgba(74,222,128,.15)' },
  ghosted: { icon: '👻', label: 'Ghosted', color: '#a78bfa', bg: 'rgba(167,139,250,.15)' },
  'removed-by-mod': { icon: '🗑', label: 'Mod removed', color: 'var(--bad)', bg: 'rgba(248,113,113,.15)' },
  'self-deleted': { icon: '🗑', label: 'Self deleted', color: 'var(--fg-3)', bg: 'var(--bg-2)' },
  'low-engagement': { icon: '💤', label: 'Low engage', color: 'var(--warn)', bg: 'rgba(251,191,36,.15)' },
};

const VALID_LIFECYCLES = [
  null,
  'live',
  'ghosted',
  'removed-by-mod',
  'self-deleted',
  'low-engagement',
] as const;

function formatAgo(iso: string | null): string {
  if (!iso) return '?';
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000) return 'vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return `${Math.floor(diff / 86_400_000)}d`;
  } catch { return '?'; }
}

function formatStat(n: number | null): string {
  if (n == null) return '?';
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n / 1000) + 'k';
}

export function EngagedThreadsSection({ briefId, bumpKey = 0 }: {
  briefId: number;
  bumpKey?: number;
}) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [filter, setFilter] = useState<'all' | 'problems' | 'live'>('all');
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listEngagedThreadsForBrief(briefId).then((rows) => {
      if (cancelled) return;
      setThreads(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [briefId, bumpKey]);

  if (loading) {
    return (
      <div style={{ padding: 6, fontSize: 11, color: 'var(--fg-4)' }}>
        Đang tải threads engaged…
      </div>
    );
  }
  if (threads.length === 0) return null;

  const filtered = threads.filter((t) => {
    if (filter === 'problems') return t.ghostedCount > 0 || t.removedCount > 0;
    if (filter === 'live') return t.liveCount > 0;
    return true;
  });

  return (
    <div style={{
      marginBottom: 6, background: 'var(--bg-1)',
      border: '1px solid rgba(96,165,250,.3)', borderLeft: '3px solid #60a5fa',
      borderRadius: 5,
    }}>
      <button type="button" onClick={() => setCollapsed((v) => !v)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: 6,
                padding: '7px 10px', background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--fg-1)', textAlign: 'left',
              }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{collapsed ? '▸' : '▾'}</span>
        <span style={{ fontWeight: 700, color: '#60a5fa' }}>🧵 Threads đã engage</span>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          background: 'rgba(96,165,250,.15)', color: '#60a5fa',
          border: '1px solid rgba(96,165,250,.4)', padding: '1px 6px',
          borderRadius: 999,
        }}>{threads.length}</span>
        {!collapsed && (
          <span style={{ flex: 1, textAlign: 'right', fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
            Click parent → xem attempts
          </span>
        )}
      </button>

      {!collapsed && (
        <div style={{ padding: '0 8px 8px' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Tất cả ({threads.length})</FilterChip>
            <FilterChip
              active={filter === 'problems'}
              onClick={() => setFilter('problems')}
              color="var(--warn)"
            >
              👻 Ghosted/Removed ({threads.filter((t) => t.ghostedCount > 0 || t.removedCount > 0).length})
            </FilterChip>
            <FilterChip
              active={filter === 'live'}
              onClick={() => setFilter('live')}
              color="var(--ok)"
            >
              ✅ Có live ({threads.filter((t) => t.liveCount > 0).length})
            </FilterChip>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.map((t) => (
              <ThreadRowItem key={t.parentUrl}
                             thread={t}
                             expanded={expandedParent === t.parentUrl}
                             onToggle={() => setExpandedParent(expandedParent === t.parentUrl ? null : t.parentUrl)} />
            ))}
            {filtered.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--fg-4)', padding: 6, textAlign: 'center' }}>
                Không có thread khớp filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, color = 'var(--accent)', children }: {
  active: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
            style={{
              padding: '2px 8px', fontSize: 10.5, fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: active ? color : 'var(--bg-2)',
              color: active ? '#fff' : 'var(--fg-2)',
              border: `1px solid ${active ? color : 'var(--line)'}`,
              borderRadius: 999, cursor: 'pointer',
            }}>
      {children}
    </button>
  );
}

function ThreadRowItem({ thread, expanded, onToggle }: {
  thread: ThreadRow; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 4,
    }}>
      <button type="button" onClick={onToggle}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                gap: 8, width: '100%', padding: '6px 8px',
                background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
                color: 'var(--fg-1)', fontSize: 12, alignItems: 'center',
              }}>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{expanded ? '▾' : '▸'}</span>
        <span style={{
          fontWeight: 600, color: 'var(--fg-0)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          minWidth: 0,
        }}
              title={thread.parentTitle || thread.parentUrl}>
          {thread.parentTitle || thread.parentUrl}
        </span>
        <span style={{
          display: 'inline-flex', gap: 4, alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        }}>
          {thread.liveCount > 0 && (
            <Badge color="var(--ok)" bg="rgba(74,222,128,.13)">✅ {thread.liveCount}</Badge>
          )}
          {thread.ghostedCount > 0 && (
            <Badge color="#a78bfa" bg="rgba(167,139,250,.13)">👻 {thread.ghostedCount}</Badge>
          )}
          {thread.removedCount > 0 && (
            <Badge color="var(--bad)" bg="rgba(248,113,113,.13)">🗑 {thread.removedCount}</Badge>
          )}
          {thread.attemptCount > thread.postedCount && (
            <Badge color="var(--fg-3)" bg="var(--bg-1)">📝 {thread.attemptCount - thread.postedCount}</Badge>
          )}
          <Badge color="var(--fg-3)" bg="var(--bg-1)">×{thread.attemptCount}</Badge>
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {formatAgo(thread.lastAttemptAt)}
        </span>
      </button>
      {expanded && (
        <AttemptsDetail parentUrl={thread.parentUrl} />
      )}
    </div>
  );
}

function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{
      padding: '0 5px', background: bg, color,
      border: `1px solid ${color}`, borderRadius: 999,
    }}>
      {children}
    </span>
  );
}

function AttemptsDetail({ parentUrl }: { parentUrl: string }) {
  const [summary, setSummary] = useState<ParentEngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string>('');
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    // Lấy projectId từ URL (`/p/<projectId>/seeding`)
    const m = location.pathname.match(/^\/p\/([^/]+)\//);
    const pid = m?.[1] ?? '';
    setProjectId(pid);
    if (!pid) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    listEngagementsByParentUrl(pid, parentUrl).then((s) => {
      if (cancelled) return;
      setSummary(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [parentUrl]);

  const markLifecycle = (cardId: number, lifecycle: typeof VALID_LIFECYCLES[number]) => {
    setPendingId(cardId);
    startTransition(async () => {
      await updateCardLifecycle(cardId, lifecycle);
      // Re-fetch summary
      const s = await listEngagementsByParentUrl(projectId, parentUrl);
      setSummary(s);
      setPendingId(null);
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '6px 10px 10px', fontSize: 11, color: 'var(--fg-4)' }}>
        Đang tải attempts…
      </div>
    );
  }
  if (!summary || summary.attempts.length === 0) {
    return (
      <div style={{ padding: '6px 10px 10px', fontSize: 11, color: 'var(--fg-4)' }}>
        Không có attempt nào.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--fg-4)', marginBottom: 2 }}>
        {summary.totalAttempts} attempts · {summary.accountsEngaged.length} accounts: {summary.accountsEngaged.map((h) => `@${h}`).join(', ')}
      </div>
      {summary.attempts.map((a) => (
        <AttemptRow key={a.id} attempt={a}
                    onMark={markLifecycle}
                    pending={pendingId === a.id} />
      ))}
    </div>
  );
}

function AttemptRow({ attempt, onMark, pending }: {
  attempt: EngagementAttempt;
  onMark: (cardId: number, lifecycle: typeof VALID_LIFECYCLES[number]) => void;
  pending: boolean;
}) {
  const lc = attempt.postLifecycle ? LIFECYCLE_META[attempt.postLifecycle] : null;
  const isArchived = !!attempt.archivedAt;
  const isPosted = !!attempt.postUrl;
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto auto auto auto',
      gap: 6, alignItems: 'center',
      padding: '5px 7px',
      background: isArchived ? 'rgba(248,113,113,.05)' : 'var(--bg-1)',
      border: `1px solid ${isArchived ? 'rgba(248,113,113,.2)' : 'var(--line)'}`,
      borderRadius: 4,
      opacity: isArchived ? 0.7 : 1,
    }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
        #{attempt.id}
      </span>
      <span style={{
        fontSize: 11, color: 'var(--fg-2)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        minWidth: 0,
      }}
            title={attempt.bodyTarget}>
        {attempt.accountHandle && (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            @{attempt.accountHandle}
          </span>
        )}
        {' '}
        {attempt.bodyTarget.slice(0, 80) || '(no body)'}
      </span>
      {lc ? (
        <Badge color={lc.color} bg={lc.bg}>
          {lc.icon} {lc.label}
        </Badge>
      ) : isPosted ? (
        <Badge color="var(--fg-3)" bg="var(--bg-2)">? unknown</Badge>
      ) : (
        <Badge color="var(--fg-4)" bg="var(--bg-2)">📝 draft</Badge>
      )}
      {attempt.insightsViewsCount != null && (
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: '#60a5fa',
          padding: '0 5px', background: 'rgba(96,165,250,.13)',
          border: '1px solid rgba(96,165,250,.4)', borderRadius: 999,
        }}
              title={`Views: ${attempt.insightsViewsCount} · Score: ${attempt.insightsScore ?? '?'} · Upvote: ${attempt.insightsUpvoteRatio != null ? Math.round(attempt.insightsUpvoteRatio * 100) + '%' : '?'}`}>
          👁 {formatStat(attempt.insightsViewsCount)}
        </span>
      )}
      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        {formatAgo(attempt.postedAt) || formatAgo(attempt.createdAt)}
      </span>
      <span style={{ display: 'inline-flex', gap: 3, position: 'relative' }}>
        {isPosted && (
          <a href={wrapExternalUrl(attempt.postUrl!)} target="_blank" rel="noopener noreferrer"
             title={`Mở comment\n${attempt.postUrl}`}
             style={{
               padding: '2px 6px', fontSize: 10, color: 'var(--ok)',
               background: 'var(--bg-2)', border: '1px solid var(--line)',
               borderRadius: 3, textDecoration: 'none',
             }}>↗</a>
        )}
        {isPosted && (
          <button type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  disabled={pending}
                  title="Mark lifecycle (live/ghosted/removed/...)"
                  style={{
                    padding: '2px 6px', fontSize: 10,
                    background: pickerOpen ? 'var(--accent)' : 'var(--bg-2)',
                    color: pickerOpen ? '#fff' : 'var(--fg-2)',
                    border: '1px solid var(--line)', borderRadius: 3,
                    cursor: pending ? 'wait' : 'pointer',
                  }}>
            {pending ? '⟳' : '✏'}
          </button>
        )}
        {pickerOpen && (
          <LifecyclePicker
            current={attempt.postLifecycle}
            onPick={(lc) => { setPickerOpen(false); onMark(attempt.id, lc); }}
            onClose={() => setPickerOpen(false)} />
        )}
      </span>
    </div>
  );
}

function LifecyclePicker({ current, onPick, onClose }: {
  current: string | null;
  onPick: (lc: typeof VALID_LIFECYCLES[number]) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose}
           style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 2,
        minWidth: 160, background: 'var(--bg-1)',
        border: '1px solid var(--line-2)', borderRadius: 5,
        boxShadow: '0 8px 24px rgba(0,0,0,.4)', padding: 3,
        zIndex: 1001, fontSize: 11,
      }}>
        {VALID_LIFECYCLES.map((lc) => {
          const meta = lc ? LIFECYCLE_META[lc] : null;
          const isCur = current === lc;
          return (
            <button key={lc ?? 'none'} type="button" onClick={() => onPick(lc)}
                    style={{
                      display: 'flex', width: '100%', alignItems: 'center',
                      gap: 6, padding: '4px 8px',
                      background: isCur ? 'var(--accent-soft)' : 'transparent',
                      color: isCur ? 'var(--accent)' : 'var(--fg-1)',
                      border: 'none', borderRadius: 3, cursor: 'pointer',
                      textAlign: 'left', fontSize: 11,
                      fontWeight: isCur ? 700 : 400,
                    }}>
              {meta ? `${meta.icon} ${meta.label}` : '— Clear (unknown)'}
              {isCur && <span style={{ marginLeft: 'auto', fontSize: 9 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
