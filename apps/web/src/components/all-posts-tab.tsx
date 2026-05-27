'use client';

// Tab "Tất cả bài đăng" trong /seeding cockpit — danh sách FULL cross-brief
// + filters mạnh (lifecycle, platform, habitat, account, brief, content type,
// time range, AI-detection, threshold min-views/score/replies) + sort.
//
// Khác RecentPostedSection (collapse trong queue view, fixed 7d/50 cards):
//   - filter bar đa chiều
//   - sort theo metrics
//   - pagination (offset + limit)
//   - facet count realtime
//
// State giữ trong React; có thể sync URL sau (?days=, ?lc=, etc.) — chưa làm
// để tránh xung đột với queue filter (issueFilter, q, statusFilter) cùng page.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { wrapExternalUrl } from '@/lib/external-url';
import {
  listAllPostedCards,
  type AllPostedCard,
  type AllPostedFilters,
  type AllPostedResult,
  type PostedFilterOptions,
  type PostedSortKey,
} from '@/lib/actions/brief-posts';
import { serializeSeedingTabUrl } from '@/lib/posts-tab-url';
import { prefetchBriefModal } from '@/lib/brief-modal-cache';

interface Props {
  projectId: string;
  options: PostedFilterOptions;
  initial: AllPostedResult;
  initialFilters: AllPostedFilters;
  onOpenBrief: (briefId: number, cardId?: number) => void;
}

const LIFECYCLE_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  live:             { icon: '✅', label: 'Live',          color: 'var(--ok)',   bg: 'rgba(74,222,128,.15)' },
  ghosted:          { icon: '👻', label: 'Ghosted',       color: '#a78bfa',     bg: 'rgba(167,139,250,.15)' },
  'removed-by-mod': { icon: '🗑', label: 'Mod removed',   color: 'var(--bad)',  bg: 'rgba(248,113,113,.15)' },
  'self-deleted':   { icon: '🗑', label: 'Self deleted',  color: 'var(--fg-3)', bg: 'var(--bg-3)' },
  'low-engagement': { icon: '💤', label: 'Low engage',    color: 'var(--warn)', bg: 'rgba(251,191,36,.15)' },
  _none:            { icon: '⏳', label: 'Chưa đánh dấu', color: 'var(--fg-4)', bg: 'var(--bg-2)' },
};

const SORT_OPTIONS: Array<{ value: PostedSortKey; label: string }> = [
  { value: 'posted_desc',  label: 'Mới nhất' },
  { value: 'posted_asc',   label: 'Cũ nhất' },
  { value: 'views_desc',   label: 'Views ↓' },
  { value: 'score_desc',   label: 'Score ↓' },
  { value: 'replies_desc', label: 'Replies ↓' },
  { value: 'ratio_desc',   label: 'Upvote ratio ↓' },
];

const TIME_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: 1,    label: '24h' },
  { value: 7,    label: '7d' },
  { value: 30,   label: '30d' },
  { value: 90,   label: '90d' },
  { value: null, label: 'Tất cả' },
];

function formatStatShort(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'vừa xong';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return `${Math.floor(diff / (30 * 86_400_000))}mo`;
}

export function AllPostsTab({ projectId, options, initial, initialFilters, onOpenBrief }: Props) {
  const [filters, setFilters] = useState<AllPostedFilters>(initialFilters);
  const [data, setData] = useState<AllPostedResult>(initial);
  const [pending, startTransition] = useTransition();

  // Fetch khi filter đổi (skip lần đầu — dùng initial).
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const [firstRun, setFirstRun] = useState(true);
  useEffect(() => {
    if (firstRun) { setFirstRun(false); return; }
    startTransition(async () => {
      const next = await listAllPostedCards(projectId, filters);
      setData(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Sync filters → URL (replaceState, không reload server). Giữ ?st=posts vì
  // cockpit đã set. F5 → server đọc params + render lại với filter chuẩn.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = serializeSeedingTabUrl('posts', filters);
    // Giữ params khác ngoài scope tab (vd ?m=brief&mId=...) — merge.
    const cur = new URLSearchParams(window.location.search);
    const preserved = ['m', 'mId', 'bfc', 'bfp', 'acct', 'acctId', 'hab', 'habId'];
    for (const k of preserved) {
      const v = cur.get(k);
      if (v != null) qs.set(k, v);
    }
    const next = qs.toString();
    const url = `${window.location.pathname}${next ? '?' + next : ''}`;
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Refresh button — re-fetch list HIỆN TẠI (không reset filter). Hay dùng
  // sau khi ext scrape commentstats xong, muốn thấy metrics mới ngay.
  function refresh() {
    startTransition(async () => {
      const next = await listAllPostedCards(projectId, filters);
      setData(next);
    });
  }

  const totalAll = useMemo(() => {
    return Object.values(data.facets.lifecycleCounts).reduce((s, n) => s + n, 0);
  }, [data.facets.lifecycleCounts]);

  function setF(patch: Partial<AllPostedFilters>) {
    setFilters((prev) => ({ ...prev, offset: 0, ...patch }));
  }

  function toggleArr<T>(key: keyof AllPostedFilters, val: T) {
    setFilters((prev) => {
      const cur = (prev[key] as T[] | undefined) ?? [];
      const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
      return { ...prev, offset: 0, [key]: next.length > 0 ? next : undefined };
    });
  }

  const rows = data.rows;
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(data.total / limit));

  const hasAnyFilter = useMemo(() => Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 :
    (v != null && v !== false && v !== 'posted_desc' && v !== 7 && v !== 50 && v !== 0)
  ), [filters]);
  const [moreOpen, setMoreOpen] = useState(() =>
    !!(filters.habitatIds || filters.accountIds || filters.briefIds ||
       filters.contentTypes || filters.minViews != null || filters.minScore != null ||
       filters.minReplies != null || filters.aiDetectionOnly)
  );

  return (
    <div style={{ marginTop: 4 }}>
      {/* Toolbar: counts + time + sort + refresh + reset + more-toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '6px 10px', background: 'var(--bg-1)',
                    border: '1px solid var(--line)', borderRadius: 6, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: 'var(--fg-0)', fontSize: 13 }}>
          {pending ? '…' : data.total}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>/ {totalAll}</span>

        <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 2px' }} />

        {/* Time chip inline */}
        {TIME_OPTIONS.map((t) => {
          const on = (filters.days ?? 7) === t.value;
          return (
            <Chip key={t.label} on={on} onClick={() => setF({ days: t.value })}>
              {t.label}
            </Chip>
          );
        })}

        <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 2px' }} />

        <select value={filters.sort ?? 'posted_desc'}
                onChange={(e) => setF({ sort: e.target.value as PostedSortKey })}
                title="Sắp xếp"
                style={{ padding: '3px 8px', fontSize: 11, background: 'var(--bg-2)',
                         border: '1px solid var(--line)', borderRadius: 4,
                         color: 'var(--fg-0)', cursor: 'pointer' }}>
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <span style={{ flex: 1 }} />

        <button type="button" onClick={refresh} disabled={pending}
                title="Refresh — tải lại danh sách (dùng sau khi ext scrape metrics xong)"
                style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-mono)',
                         background: 'var(--bg-2)', border: '1px solid var(--line)',
                         color: 'var(--fg-1)', borderRadius: 4, cursor: 'pointer',
                         opacity: pending ? 0.5 : 1 }}>
          {pending ? '⟳ Đang tải…' : '⟳ Refresh'}
        </button>

        <button type="button" onClick={() => setMoreOpen((v) => !v)}
                title={moreOpen ? 'Thu gọn filter chi tiết' : 'Mở filter chi tiết (habitat/account/brief/threshold)'}
                style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-mono)',
                         background: moreOpen ? 'var(--accent-soft)' : 'var(--bg-2)',
                         border: `1px solid ${moreOpen ? 'var(--accent)' : 'var(--line)'}`,
                         color: moreOpen ? 'var(--accent)' : 'var(--fg-1)',
                         borderRadius: 4, cursor: 'pointer' }}>
          {moreOpen ? '▾ Bộ lọc' : '▸ Bộ lọc'}
        </button>

        <FilterReset
          active={hasAnyFilter}
          onReset={() => setFilters({
            days: 7, hideRemoved: true, sort: 'posted_desc', limit: 50, offset: 0,
          })}
        />
      </div>

      {/* Chip row: lifecycle + platform + content type + AI toggle — 1 hàng dense */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
                    padding: '4px 8px', marginBottom: 6 }}>
        {Object.entries(LIFECYCLE_META).map(([key, m]) => {
          const count = data.facets.lifecycleCounts[key] ?? 0;
          if (count === 0 && !(filters.lifecycles?.includes(key))) return null;
          const on = filters.lifecycles?.includes(key) ?? false;
          return (
            <Chip key={key} on={on}
                  onClick={() => toggleArr<string>('lifecycles', key)}
                  color={m.color} bg={m.bg}>
              {m.icon} {m.label} <small style={{ opacity: .8 }}>{count}</small>
            </Chip>
          );
        })}
        <Chip on={filters.hideRemoved !== false}
              onClick={() => setF({ hideRemoved: filters.hideRemoved === false })}
              title="Ẩn removed-by-mod + self-deleted khi chip lifecycle chưa chọn">
          🙈 Hide removed
        </Chip>

        {options.platforms.length > 1 && (
          <span style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 3px' }} />
        )}
        {options.platforms.length > 1 && options.platforms.map((p) => {
          const on = filters.platformKeys?.includes(p.key) ?? false;
          return (
            <Chip key={p.key} on={on}
                  onClick={() => toggleArr<string>('platformKeys', p.key)}>
              {p.label} <small style={{ opacity: .7 }}>{p.count}</small>
            </Chip>
          );
        })}

        <Chip on={filters.aiDetectionOnly === true}
              onClick={() => setF({ aiDetectionOnly: !filters.aiDetectionOnly })}
              title="Chỉ habitats có cơ chế detect AI content">
          🤖 AI-detect
        </Chip>
      </div>

      {/* Advanced filter — habitat/account/brief multi-select + content type + threshold.
          Mặc định collapse, mở khi click '▸ Bộ lọc' hoặc auto-mở nếu có filter active. */}
      {moreOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      padding: '6px 10px', background: 'var(--bg-1)',
                      border: '1px solid var(--line)', borderRadius: 6, marginBottom: 6 }}>
          <MultiSelect label="Habitat"
                       options={options.habitats.map((h) => ({
                         value: h.id, label: `${h.name}${h.aiDetection ? ' 🤖' : ''}`, count: h.count,
                       }))}
                       selected={filters.habitatIds ?? []}
                       onChange={(ids) => setF({ habitatIds: ids.length > 0 ? ids : undefined })} />
          <MultiSelect label="Account"
                       options={options.accounts.map((a) => ({
                         value: a.id, label: `@${a.handle}`, count: a.count,
                       }))}
                       selected={filters.accountIds ?? []}
                       onChange={(ids) => setF({ accountIds: ids.length > 0 ? ids : undefined })} />
          <MultiSelect label="Brief"
                       options={options.briefs.map((b) => ({
                         value: b.id, label: `${b.ref} · ${b.title}`, count: b.count,
                       }))}
                       selected={filters.briefIds ?? []}
                       onChange={(ids) => setF({ briefIds: ids.length > 0 ? ids : undefined })} />

          {options.contentTypes.length > 1 && (
            <MultiSelect label="Type"
                         options={options.contentTypes.map((c, i) => ({
                           value: i, label: c.key, count: c.count,
                         }))}
                         selected={(filters.contentTypes ?? []).map((k) =>
                           options.contentTypes.findIndex((c) => c.key === k)
                         ).filter((i) => i >= 0)}
                         onChange={(idxs) => setF({
                           contentTypes: idxs.length > 0
                             ? idxs.map((i) => options.contentTypes[i]?.key).filter((k): k is string => !!k)
                             : undefined,
                         })} />
          )}

          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
                         marginLeft: 4 }}>min:</span>
          <NumberInput placeholder="views" value={filters.minViews}
                       onChange={(v) => setF({ minViews: v })} />
          <NumberInput placeholder="score" value={filters.minScore}
                       onChange={(v) => setF({ minScore: v })} />
          <NumberInput placeholder="replies" value={filters.minReplies}
                       onChange={(v) => setF({ minReplies: v })} />
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-4)',
                      background: 'var(--bg-1)', border: '1px solid var(--line)',
                      borderRadius: 6 }}>
          {pending ? '⏳ Đang lọc…' : '🔍 Không có bài match filter'}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)',
                      borderRadius: 6, overflow: 'hidden', opacity: pending ? 0.6 : 1,
                      transition: 'opacity .15s' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12,
                          tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 22 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 30 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left',
                           color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase',
                           fontFamily: 'var(--font-mono)' }}>
                <th style={th()} />
                <th style={th()}>Habitat / Account / Title</th>
                <th style={th()}>Lifecycle</th>
                <th style={th()}>Metrics</th>
                <th style={th()}>Ago</th>
                <th style={th()} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => <Row key={c.id} c={c} projectId={projectId} onOpenBrief={onOpenBrief} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
                      gap: 8, marginTop: 10 }}>
          <button onClick={() => setFilters((p) => ({ ...p, offset: Math.max(0, (p.offset ?? 0) - limit) }))}
                  disabled={offset === 0 || pending}
                  style={btnStyle()}>
            ← Trước
          </button>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Trang {page} / {totalPages} · {data.total} bài
          </span>
          <button onClick={() => setFilters((p) => ({ ...p, offset: (p.offset ?? 0) + limit }))}
                  disabled={offset + limit >= data.total || pending}
                  style={btnStyle()}>
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────
// Build link để update metrics: Reddit → commentstats page (ext tự scrape +
// POST insights khi user mở), platform khác → post_url (manual review).
function buildMetricsRefreshUrl(c: AllPostedCard): string {
  if (c.platformKey === 'reddit' && c.postUrl) {
    // Reddit comment URL: .../comments/<post>/<slug>/<thingId>/
    const m = c.postUrl.match(/\/([a-z0-9]{4,12})\/?(?:\?|$)/i);
    const thingId = m?.[1];
    if (thingId) return `https://www.reddit.com/commentstats/t1_${thingId}`;
  }
  return c.postUrl;
}

function Row({ c, projectId, onOpenBrief }: {
  c: AllPostedCard;
  projectId: string;
  onOpenBrief: (briefId: number, cardId?: number) => void;
}) {
  const v = c.insightsViewsCount;
  const r = c.insightsUpvoteRatio;
  const s = c.insightsScore;
  const rp = c.insightsReplyCount;
  const hasStats = v != null || r != null || s != null || rp != null;
  const lc = c.postLifecycle ?? '_none';
  const m = LIFECYCLE_META[lc] ?? LIFECYCLE_META._none!;
  const refreshUrl = buildMetricsRefreshUrl(c);
  const isReddit = c.platformKey === 'reddit';
  const refreshTitle = isReddit
    ? 'Mở Reddit commentstats — ext sẽ tự scrape & cập nhật metrics khi page load'
    : 'Mở bài trên platform để review metrics thủ công';

  const openBrief = () => { if (c.briefId != null) onOpenBrief(c.briefId, c.id); };

  return (
    <tr style={{ borderTop: '1px solid var(--line)' }}
        onMouseEnter={() => { if (c.briefId != null) prefetchBriefModal(projectId, c.briefId); }}>
      <td style={td()}>
        {c.platformKey ? (
          <img src={`https://cdn.simpleicons.org/${c.platformKey}/d4d4d8`}
               alt={c.platformLabel} width={14} height={14} />
        ) : <span style={{ width: 14, height: 14, display: 'inline-block',
                            background: 'var(--bg-3)', borderRadius: 3 }} />}
      </td>
      <td style={td()}>
        <button type="button" onClick={openBrief} disabled={c.briefId == null}
                style={{ background: 'none', border: 'none', padding: 0, cursor: c.briefId ? 'pointer' : 'default',
                         color: 'var(--fg-1)', textAlign: 'left', width: '100%',
                         display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: 'var(--fg-0)', whiteSpace: 'nowrap' }}>
              {c.habitatName || '(orphan)'}
            </span>
            {c.accountHandle && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
                @{c.accountHandle}
              </span>
            )}
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)',
                           background: 'var(--bg-3)', color: 'var(--fg-3)',
                           padding: '0 4px', borderRadius: 2 }}>{c.contentType}</span>
            {c.aiContentDetection && (
              <span title="Habitat có cơ chế AI detection — bài phải qua anti-AI prompt"
                    style={{ fontSize: 9, fontFamily: 'var(--font-mono)',
                             background: 'rgba(167,139,250,.15)', color: '#a78bfa',
                             border: '1px solid #a78bfa', padding: '0 5px', borderRadius: 999 }}>
                🤖
              </span>
            )}
            {c.parentAttemptCount > 1 && (
              <span title={`Thread engaged ${c.parentAttemptCount} lần`}
                    style={{ fontSize: 9, fontFamily: 'var(--font-mono)',
                             background: 'rgba(96,165,250,.15)', color: '#60a5fa',
                             border: '1px solid rgba(96,165,250,.4)',
                             padding: '0 5px', borderRadius: 999, fontWeight: 700 }}>
                🧵 ×{c.parentAttemptCount}
              </span>
            )}
          </div>
          <div style={{ color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', maxWidth: '100%' }}>
            {c.title || c.bodyTarget || '(no content)'}
          </div>
        </button>
      </td>
      <td style={td()}>
        {lc === '_none' && c.postUrl ? (
          <a href={wrapExternalUrl(c.postUrl)} target="_blank" rel="noopener noreferrer"
             onClick={(e) => e.stopPropagation()}
             title={`Chưa đánh dấu — click mở bài để ext auto-detect lifecycle (live/removed/deleted)`}
             style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                      background: m.bg, color: m.color, border: `1px dashed ${m.color}`,
                      padding: '1px 7px', borderRadius: 999, fontWeight: 700,
                      whiteSpace: 'nowrap', textDecoration: 'none',
                      cursor: 'pointer', display: 'inline-flex',
                      alignItems: 'center', gap: 3 }}>
            {m.icon} {m.label} <span style={{ opacity: 0.6, fontSize: 9 }}>↗</span>
          </a>
        ) : (
          <span title={`Lifecycle: ${m.label}`}
                style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                         background: m.bg, color: m.color, border: `1px solid ${m.color}`,
                         padding: '1px 7px', borderRadius: 999, fontWeight: 700,
                         whiteSpace: 'nowrap' }}>
            {m.icon} {m.label}
          </span>
        )}
      </td>
      <td style={td()}>
        <a href={wrapExternalUrl(refreshUrl)} target="_blank" rel="noopener noreferrer"
           onClick={(e) => e.stopPropagation()} title={refreshTitle}
           style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 6px', fontSize: 10, fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: hasStats ? '#60a5fa' : 'var(--fg-4)',
                    background: 'transparent', border: '1px solid transparent',
                    borderRadius: 3, textDecoration: 'none',
                    transition: 'background .1s, border-color .1s' }}
           onMouseEnter={(e) => {
             e.currentTarget.style.background = 'var(--bg-2)';
             e.currentTarget.style.borderColor = 'var(--line)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.background = 'transparent';
             e.currentTarget.style.borderColor = 'transparent';
           }}>
          {hasStats ? (
            <>
              {v != null && <span title={`${v.toLocaleString()} views`}>👁 {formatStatShort(v)}</span>}
              {s != null && <span title={`Score ${s}`}>↑ {formatStatShort(s)}</span>}
              {rp != null && <span title={`${rp} replies`}>💬 {rp}</span>}
              {r != null && <span title={`Upvote ratio ${Math.round(r * 100)}%`}>{Math.round(r * 100)}%</span>}
              <span style={{ opacity: 0.5, fontSize: 9 }}>↻</span>
            </>
          ) : (
            <span style={{ fontStyle: 'italic' }}>
              chưa sync {isReddit ? '— click để fetch' : '— click mở bài'}
            </span>
          )}
        </a>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {timeAgo(c.postedAt)}
        </span>
      </td>
      <td style={td()}>
        <a href={wrapExternalUrl(c.postUrl)} target="_blank" rel="noopener noreferrer"
           onClick={(e) => e.stopPropagation()} title="Mở bài trên platform"
           style={{ fontSize: 11, color: 'var(--ok)', textDecoration: 'none',
                    padding: '1px 5px', background: 'var(--bg-2)',
                    border: '1px solid var(--line)', borderRadius: 3 }}>↗</a>
      </td>
    </tr>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────
function Chip({ on, dim, onClick, children, color, bg, title }: {
  on: boolean; dim?: boolean; onClick: () => void; children: React.ReactNode;
  color?: string; bg?: string; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
            style={{ padding: '2px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                     fontWeight: 700, borderRadius: 999, cursor: 'pointer',
                     background: on ? (color ?? 'var(--accent)') : (bg ?? 'var(--bg-2)'),
                     color: on ? '#fff' : (color ?? 'var(--fg-2)'),
                     border: `1px solid ${on ? (color ?? 'var(--accent)') : 'var(--line)'}`,
                     opacity: dim ? 0.45 : 1 }}>
      {children}
    </button>
  );
}

function NumberInput({ value, onChange, placeholder }: {
  value: number | null | undefined; onChange: (v: number | null) => void; placeholder: string;
}) {
  return (
    <input type="number" min={0} placeholder={placeholder}
           value={value ?? ''}
           onChange={(e) => {
             const v = e.target.value.trim();
             onChange(v === '' ? null : Math.max(0, Number(v)));
           }}
           style={{ width: 70, padding: '2px 6px', fontSize: 11,
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    borderRadius: 4, color: 'var(--fg-0)' }} />
  );
}

function MultiSelect<T extends number>({ label, options, selected, onChange }: {
  label: string;
  options: Array<{ value: T; label: string; count: number }>;
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtered = options;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        {label}:
      </span>
      <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
                style={{ padding: '2px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                         fontWeight: 700, borderRadius: 999, cursor: 'pointer',
                         background: selected.length > 0 ? 'var(--accent)' : 'var(--bg-2)',
                         color: selected.length > 0 ? '#fff' : 'var(--fg-2)',
                         border: `1px solid ${selected.length > 0 ? 'var(--accent)' : 'var(--line)'}` }}>
          {selected.length === 0 ? `Tất cả (${options.length}) ▾` : `${selected.length} đã chọn ▾`}
        </button>
        {open && (
          <>
            <div onClick={() => setOpen(false)}
                 style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
                          background: 'var(--bg-1)', border: '1px solid var(--line)',
                          borderRadius: 5, padding: 6, minWidth: 220, maxWidth: 320,
                          maxHeight: 320, overflow: 'auto', zIndex: 51,
                          boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
              {selected.length > 0 && (
                <button onClick={() => onChange([])}
                        style={{ display: 'block', width: '100%', textAlign: 'left',
                                 padding: '4px 6px', fontSize: 10.5, background: 'transparent',
                                 border: 'none', cursor: 'pointer', color: 'var(--bad)',
                                 fontFamily: 'var(--font-mono)' }}>
                  ✕ Bỏ tất cả
                </button>
              )}
              {filtered.length === 0 && (
                <div style={{ padding: 8, fontSize: 11, color: 'var(--fg-4)' }}>Không có lựa chọn</div>
              )}
              {filtered.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button key={String(o.value)} type="button"
                          onClick={() => {
                            const next = on ? selected.filter((x) => x !== o.value) : [...selected, o.value];
                            onChange(next);
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between',
                                   alignItems: 'center', width: '100%', textAlign: 'left',
                                   padding: '4px 6px', fontSize: 11, gap: 8,
                                   background: on ? 'var(--accent-soft)' : 'transparent',
                                   border: 'none', cursor: 'pointer', color: 'var(--fg-1)',
                                   borderRadius: 3 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                                   minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ width: 11, height: 11, border: '1px solid var(--line)',
                                     borderRadius: 2, background: on ? 'var(--accent)' : 'transparent',
                                     display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.label}
                      </span>
                    </span>
                    <span style={{ fontSize: 9.5, color: 'var(--fg-4)',
                                   fontFamily: 'var(--font-mono)' }}>{o.count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterReset({ active, onReset }: { active: boolean; onReset: () => void }) {
  if (!active) return null;
  return (
    <button onClick={onReset}
            style={{ padding: '3px 10px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                     background: 'transparent', border: '1px solid var(--bad)',
                     color: 'var(--bad)', borderRadius: 4, cursor: 'pointer' }}>
      ✕ Reset filter
    </button>
  );
}

function th(): React.CSSProperties {
  return { padding: '6px 8px', fontWeight: 600 };
}
function td(): React.CSSProperties {
  return { padding: '6px 8px', verticalAlign: 'middle' };
}
function btnStyle(): React.CSSProperties {
  return {
    padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
    background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
    color: 'var(--fg-1)', cursor: 'pointer',
  };
}
