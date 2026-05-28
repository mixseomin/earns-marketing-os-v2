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

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { wrapExternalUrl } from '@/lib/external-url';
import {
  listAllPostedCards,
  updateCardLifecycle,
  listCostVersions,
  type AllPostedCard,
  type AllPostedFilters,
  type AllPostedResult,
  type PostedFilterOptions,
  type PostedSortKey,
  type CostBreakdown,
} from '@/lib/actions/brief-posts';
import { serializeSeedingTabUrl } from '@/lib/posts-tab-url';
import { prefetchBriefModal } from '@/lib/brief-modal-cache';
import { AccountKindIcon } from './account-kind-icon';
import {
  loadPresets, addPreset, removePreset,
  type PostsTabPreset,
} from '@/lib/posts-tab-presets';

interface Props {
  projectId: string;
  options: PostedFilterOptions;
  initial: AllPostedResult;
  initialFilters: AllPostedFilters;
  onOpenBrief: (briefId: number, cardId?: number, phase?: string | null) => void;
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
  { value: 'score_desc',   label: 'Upvote ↓' },
  { value: 'replies_desc', label: 'Replies ↓' },
  { value: 'ratio_desc',   label: 'Upvote ratio ↓' },
  { value: 'cost_desc',    label: 'Cost ↓' },
  { value: 'cost_asc',     label: 'Cost ↑' },
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

  // Auto-refresh khi tab seeding visible trở lại sau khi user đi mở Reddit
  // commentstats / comment URL ở tab khác. Workflow thường gặp: click row
  // mở Reddit → ext scrape POST insights → quay lại tab MOS2. Trước phải
  // bấm ⟳ Refresh tay; giờ auto khi thấy tab hidden ≥15s rồi visible lại.
  // Threshold 15s tránh refresh thừa khi user switch nhanh giữa tab.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const wasHiddenFor = hiddenAt != null ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (wasHiddenFor >= 15_000) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

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

  // Filter presets (localStorage per-project).
  const [presets, setPresets] = useState<PostsTabPreset[]>([]);
  useEffect(() => { setPresets(loadPresets(projectId)); }, [projectId]);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  function applyPreset(p: PostsTabPreset) {
    setFilters({ ...p.filters, offset: 0 });
  }
  function doSavePreset() {
    if (!presetName.trim()) return;
    const p = addPreset(projectId, presetName, filters);
    setPresets((prev) => [...prev, p]);
    setPresetName('');
    setSavePromptOpen(false);
  }
  function doRemovePreset(id: string) {
    removePreset(projectId, id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }
  const [moreOpen, setMoreOpen] = useState(() =>
    !!(filters.habitatIds || filters.accountIds || filters.briefIds ||
       filters.contentTypes || filters.minViews != null || filters.minScore != null ||
       filters.minReplies != null || filters.aiDetectionOnly || filters.ownership ||
       filters.accountKind)
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

        {hasAnyFilter && (
          <button type="button" onClick={() => setSavePromptOpen(true)}
                  title="Save bộ filter hiện tại thành preset (localStorage)"
                  style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-mono)',
                           background: 'var(--bg-2)', border: '1px solid var(--line)',
                           color: 'var(--fg-2)', borderRadius: 4, cursor: 'pointer' }}>
            💾 Save preset
          </button>
        )}

        <FilterReset
          active={hasAnyFilter}
          onReset={() => setFilters({
            days: 7, hideRemoved: true, sort: 'posted_desc', limit: 50, offset: 0,
          })}
        />
      </div>

      {/* Preset row — 1 hàng chip để 1-click apply bộ filter đã save. Ẩn khi
          không có preset nào. Save button kế bên Reset/Bộ lọc trên toolbar. */}
      {(presets.length > 0 || savePromptOpen) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      padding: '4px 8px', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
            preset:
          </span>
          {presets.map((p) => (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center',
                                       background: 'var(--bg-2)', border: '1px solid var(--line)',
                                       borderRadius: 999, overflow: 'hidden' }}>
              <button type="button" onClick={() => applyPreset(p)}
                      title={`Apply preset: ${p.name}`}
                      style={{ padding: '2px 9px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                               fontWeight: 700, background: 'transparent', border: 'none',
                               color: 'var(--fg-1)', cursor: 'pointer' }}>
                {p.icon ? `${p.icon} ` : ''}{p.name}
              </button>
              <button type="button" onClick={() => doRemovePreset(p.id)}
                      title="Xoá preset"
                      style={{ padding: '2px 6px 2px 2px', fontSize: 10, background: 'transparent',
                               border: 'none', borderLeft: '1px solid var(--line)',
                               color: 'var(--fg-4)', cursor: 'pointer' }}>
                ✕
              </button>
            </span>
          ))}
          {savePromptOpen && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input autoFocus type="text" placeholder="Tên preset (vd: Top AI 30d)"
                     value={presetName}
                     onChange={(e) => setPresetName(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') { e.preventDefault(); doSavePreset(); }
                       if (e.key === 'Escape') { setSavePromptOpen(false); setPresetName(''); }
                     }}
                     style={{ width: 180, padding: '2px 7px', fontSize: 11,
                              background: 'var(--bg-2)', border: '1px solid var(--accent)',
                              borderRadius: 4, color: 'var(--fg-0)' }} />
              <button type="button" onClick={doSavePreset} disabled={!presetName.trim()}
                      style={{ padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                               background: 'var(--accent)', color: '#fff',
                               border: 'none', borderRadius: 4,
                               cursor: presetName.trim() ? 'pointer' : 'not-allowed',
                               opacity: presetName.trim() ? 1 : 0.5 }}>
                Save
              </button>
              <button type="button" onClick={() => { setSavePromptOpen(false); setPresetName(''); }}
                      style={{ padding: '2px 6px', fontSize: 11, background: 'transparent',
                               border: 'none', color: 'var(--fg-4)', cursor: 'pointer' }}>
                ✕
              </button>
            </span>
          )}
        </div>
      )}

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

        <Chip on={filters.ownership === 'own'}
              onClick={() => setF({
                ownership: filters.ownership === 'own' ? undefined : 'own',
              })}
              title="Chỉ habitats brand mình quản lý">
          👑 Own
        </Chip>
        <Chip on={filters.ownership === 'external'}
              onClick={() => setF({
                ownership: filters.ownership === 'external' ? undefined : 'external',
              })}
              title="Chỉ external communities (không own brand)">
          🌍 External
        </Chip>

        <Chip on={filters.accountKind === 'bot'}
              onClick={() => setF({
                accountKind: filters.accountKind === 'bot' ? undefined : 'bot',
              })}
              title="Chỉ bot account (Discord/Slack bot, auto-post API)">
          🤖 Bot
        </Chip>
        <Chip on={filters.accountKind === 'user'}
              onClick={() => setF({
                accountKind: filters.accountKind === 'user' ? undefined : 'user',
              })}
              title="Chỉ user account (manual login, cần warming + persona)">
          👤 User
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
          <ThresholdInput label="👁 views" value={filters.minViews}
                          onChange={(v) => setF({ minViews: v })} />
          <ThresholdInput label="↑ upvote" value={filters.minScore}
                          onChange={(v) => setF({ minScore: v })} />
          <ThresholdInput label="💬 replies" value={filters.minReplies}
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
              <col style={{ width: 110 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 30 }} />
            </colgroup>
            <thead>
              {/* Hàng 1: label + sort */}
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left',
                           color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase',
                           fontFamily: 'var(--font-mono)' }}>
                <th style={th()} />
                <th style={th()}>Habitat / Account / Title</th>
                <th style={{ ...th(), textAlign: 'center' }}>Lifecycle</th>
                <SortableHeader label="👁 Views" sortKey="views_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })} />
                <SortableHeader label="↑ Upvote" sortKey="score_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })} />
                <SortableHeader label="💬 Reply" sortKey="replies_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })} />
                <SortableHeader label="% Ratio" sortKey="ratio_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })} />
                <SortableHeader label="💰 Cost" sortKey="cost_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })}
                                altKey="cost_asc" />
                <SortableHeader label="⏱ Gen" sortKey="duration_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })}
                                altKey="duration_asc" />
                <SortableHeader label="Ago" sortKey="posted_desc"
                                current={filters.sort ?? 'posted_desc'}
                                onSort={(s) => setF({ sort: s })}
                                altKey="posted_asc" />
                <th style={th()} />
              </tr>
              {/* Hàng 2: filter inline per-column */}
              <tr style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--line)',
                           textAlign: 'left' }}>
                <th style={thFilter()} />
                <th style={thFilter()}>
                  <ColumnSearchInput placeholder="tìm habitat/account/title…"
                                     value={filters.q ?? ''}
                                     onChange={(v) => setF({ q: v || undefined })} />
                </th>
                <th style={thFilter()}>
                  <ColumnLifecyclePicker
                    selected={filters.lifecycles ?? []}
                    facets={data.facets.lifecycleCounts}
                    onChange={(arr) => setF({ lifecycles: arr.length > 0 ? arr : undefined })} />
                </th>
                <th style={thFilter()}>
                  <ColumnNumberInput value={filters.minViews}
                                     placeholder="≥"
                                     onChange={(v) => setF({ minViews: v })} />
                </th>
                <th style={thFilter()}>
                  <ColumnNumberInput value={filters.minScore}
                                     placeholder="≥"
                                     onChange={(v) => setF({ minScore: v })} />
                </th>
                <th style={thFilter()}>
                  <ColumnNumberInput value={filters.minReplies}
                                     placeholder="≥"
                                     onChange={(v) => setF({ minReplies: v })} />
                </th>
                <th style={thFilter()} />
                <th style={thFilter()} />
                <th style={thFilter()} />
                <th style={thFilter()}>
                  <ColumnTimeSelect value={filters.days ?? 7}
                                    onChange={(v) => setF({ days: v })} />
                </th>
                <th style={thFilter()} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <Row key={c.id} c={c} projectId={projectId} onOpenBrief={onOpenBrief}
                     onLifecycleSaved={(lc) => setData((prev) => ({
                       ...prev,
                       rows: prev.rows.map((r) => r.id === c.id ? { ...r, postLifecycle: lc } : r),
                     }))} />
              ))}
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

function Row({ c, projectId, onOpenBrief, onLifecycleSaved }: {
  c: AllPostedCard;
  projectId: string;
  onOpenBrief: (briefId: number, cardId?: number, phase?: string | null) => void;
  onLifecycleSaved: (lc: string) => void;
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

  const openBrief = () => { if (c.briefId != null) onOpenBrief(c.briefId, c.id, c.briefPhase); };

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
              {c.habitatIsOwn && (
                <span title="Own — habitat brand mình quản lý"
                      style={{ color: '#fbbf24', marginRight: 3 }}>👑</span>
              )}
              {c.habitatName || '(orphan)'}
            </span>
            {c.accountHandle && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}
                    title={`Account kind: ${c.accountKind || 'user'}`}>
                <AccountKindIcon kind={c.accountKind} />@{c.accountHandle}
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
      <td style={{ ...td(), textAlign: 'center' }}>
        <LifecycleBadge cardId={c.id} current={c.postLifecycle} postUrl={c.postUrl}
                        onSaved={onLifecycleSaved} />
      </td>
      <MetricCell value={v != null ? formatStatShort(v) : null}
                  fullTitle={v != null ? `${v.toLocaleString()} views` : `Chưa sync${isReddit ? ' — click để fetch' : ''}`}
                  url={refreshUrl} />
      <MetricCell value={s != null ? formatStatShort(s) : null}
                  fullTitle={s != null ? `Upvote ${s}` : `Chưa sync${isReddit ? ' — click để fetch' : ''}`}
                  url={refreshUrl} />
      <MetricCell value={rp != null ? String(rp) : null}
                  fullTitle={rp != null ? `${rp} replies` : `Chưa sync${isReddit ? ' — click để fetch' : ''}`}
                  url={refreshUrl} />
      <MetricCell value={r != null ? `${Math.round(r * 100)}%` : null}
                  fullTitle={r != null ? `Upvote ratio ${Math.round(r * 100)}%` : `Chưa sync${isReddit ? ' — click để fetch' : ''}`}
                  url={refreshUrl} />
      <CostHoverCell cardId={c.id} currentCost={c.genCostUsd} />
      <DurationCell durationMs={c.genDurationMs} />
      <td style={{ ...td(), textAlign: 'center' }}>
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

// LifecycleBadge — click badge mở popover picker để override manual lifecycle.
// Trước đó chỉ click '⏳ Chưa đánh dấu' mở Reddit cho ext detect; giờ:
//   - Click bất kỳ badge → popover 5 lựa chọn manual + (nếu postUrl) link mở Reddit
//   - Optimistic update local sau khi server OK
//   - Vẫn giữ click-to-open Reddit cho row chưa mark (qua nút trong popover)
function LifecycleBadge({ cardId, current, postUrl, onSaved }: {
  cardId: number;
  current: string | null;
  postUrl: string;
  onSaved: (lc: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lc = current ?? '_none';
  const m = LIFECYCLE_META[lc] ?? LIFECYCLE_META._none!;
  const isUnmarked = lc === '_none';

  async function pick(next: string) {
    setBusy(true);
    setErr(null);
    const res = await updateCardLifecycle(cardId,
      next as 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement',
      'manual override từ All Posts tab');
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Save fail');
      return;
    }
    onSaved(next);
    setOpen(false);
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
              title={isUnmarked
                ? 'Chưa đánh dấu — click để chọn lifecycle thủ công (hoặc mở Reddit cho ext detect)'
                : `Lifecycle: ${m.label} — click để đổi`}
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                       background: m.bg, color: m.color,
                       border: `1px ${isUnmarked ? 'dashed' : 'solid'} ${m.color}`,
                       padding: '1px 7px', borderRadius: 999, fontWeight: 700,
                       whiteSpace: 'nowrap', cursor: 'pointer',
                       display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {m.icon} {m.label}
        <span style={{ opacity: 0.6, fontSize: 8 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)}
               style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
                        background: 'var(--bg-1)', border: '1px solid var(--line)',
                        borderRadius: 5, padding: 4, minWidth: 170, zIndex: 51,
                        boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}
               onClick={(e) => e.stopPropagation()}>
            {(['live', 'ghosted', 'removed-by-mod', 'self-deleted', 'low-engagement'] as const).map((key) => {
              const meta = LIFECYCLE_META[key]!;
              const on = lc === key;
              return (
                <button key={key} type="button" disabled={busy}
                        onClick={() => pick(key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6,
                                 width: '100%', textAlign: 'left',
                                 padding: '4px 8px', fontSize: 11,
                                 background: on ? 'var(--accent-soft)' : 'transparent',
                                 border: 'none', cursor: busy ? 'wait' : 'pointer',
                                 color: meta.color, fontFamily: 'var(--font-mono)',
                                 fontWeight: 700, borderRadius: 3 }}>
                  <span>{meta.icon}</span>
                  <span style={{ flex: 1 }}>{meta.label}</span>
                  {on && <span style={{ opacity: 0.7 }}>✓</span>}
                </button>
              );
            })}
            {postUrl && (
              <>
                <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                <a href={wrapExternalUrl(postUrl)} target="_blank" rel="noopener noreferrer"
                   onClick={() => setOpen(false)}
                   style={{ display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', fontSize: 11,
                            color: 'var(--accent)', textDecoration: 'none',
                            fontFamily: 'var(--font-mono)' }}>
                  ↗ Mở Reddit · ext auto-detect
                </a>
              </>
            )}
            {err && (
              <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--bad)' }}>
                ⚠ {err}
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

// ThresholdInput — label + NumberInput inline. Hiển thị icon ngữ nghĩa rõ
// hơn placeholder text trống.
function ThresholdInput({ label, value, onChange }: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      <NumberInput placeholder="0" value={value} onChange={onChange} />
    </span>
  );
}

// MetricCell — 1 cột metric (views/score/replies/ratio). Click cell = mở
// commentstats để ext sync. '—' khi null.
function MetricCell({ value, fullTitle, url }: {
  value: string | null;
  fullTitle: string;
  url: string;
}) {
  // Zero-value (0 / 0% / —): dim xám để dễ scan các bài CÓ engagement
  // (giá trị > 0 nổi bật màu xanh).
  const isZero = value == null || value === '0' || value === '0%';
  return (
    <td style={{ ...td(), textAlign: 'center' }}>
      <a href={wrapExternalUrl(url)} target="_blank" rel="noopener noreferrer"
         onClick={(e) => e.stopPropagation()} title={fullTitle}
         style={{ display: 'inline-block', padding: '1px 5px',
                  fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: isZero ? 'var(--fg-4)' : '#60a5fa',
                  opacity: isZero ? 0.55 : 1,
                  textDecoration: 'none', borderRadius: 3,
                  border: '1px solid transparent',
                  transition: 'background .1s, border-color .1s' }}
         onMouseEnter={(e) => {
           e.currentTarget.style.background = 'var(--bg-2)';
           e.currentTarget.style.borderColor = 'var(--line)';
         }}
         onMouseLeave={(e) => {
           e.currentTarget.style.background = 'transparent';
           e.currentTarget.style.borderColor = 'transparent';
         }}>
        {value ?? '—'}
      </a>
    </td>
  );
}

// SortableHeader — th có thể click để sort theo cột tương ứng. Hỗ trợ:
//   - 1 sortKey: click toggle posted_desc ⇄ sortKey
//   - 2 sortKey (sortKey + altKey, vd posted_desc + posted_asc): click cycle
//     desc → asc → off (posted_desc default).
function SortableHeader({ label, sortKey, altKey, current, onSort }: {
  label: string;
  sortKey: PostedSortKey;
  altKey?: PostedSortKey;
  current: PostedSortKey;
  onSort: (s: PostedSortKey) => void;
}) {
  const isDesc = current === sortKey;
  const isAsc = altKey != null && current === altKey;
  const active = isDesc || isAsc;
  const next: PostedSortKey = isDesc && altKey
    ? altKey
    : isAsc
      ? 'posted_desc'
      : isDesc
        ? 'posted_desc'
        : sortKey;
  const arrow = isDesc ? ' ↓' : (isAsc ? ' ↑' : '');
  return (
    <th style={{ ...th(), cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}
        onClick={() => onSort(next)}
        title={active
          ? (altKey ? 'Click để đổi chiều / tắt sort' : 'Click để bỏ sort')
          : 'Click để sort cột này giảm dần'}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                     color: active ? 'var(--accent)' : 'var(--fg-3)' }}>
        {label}{arrow}
      </span>
    </th>
  );
}

function thFilter(): React.CSSProperties {
  return { padding: '4px 6px', verticalAlign: 'top', textAlign: 'center' };
}

// ColumnSearchInput — text search (q filter). Debounce 250ms để khỏi spam fetch.
function ColumnSearchInput({ value, placeholder, onChange }: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (local !== value) onChange(local);
    }, 250);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return (
    <input type="text" placeholder={placeholder} value={local}
           onChange={(e) => setLocal(e.target.value)}
           style={{ width: '100%', padding: '2px 6px', fontSize: 10.5,
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    borderRadius: 3, color: 'var(--fg-0)', fontFamily: 'inherit' }} />
  );
}

// ColumnNumberInput — min threshold inline. Debounce qua native onChange OK
// vì user gõ xong unfocus mới apply hợp lý; nhưng dùng debounce 300ms cho
// gõ nhanh.
function ColumnNumberInput({ value, placeholder, onChange }: {
  value: number | null | undefined;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  const [local, setLocal] = useState<string>(value != null ? String(value) : '');
  useEffect(() => {
    setLocal(value != null ? String(value) : '');
  }, [value]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = local.trim() === '' ? null : Math.max(0, Number(local) || 0);
      if (next !== (value ?? null)) onChange(next);
    }, 300);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return (
    <input type="number" inputMode="numeric" min={0} placeholder={placeholder} value={local}
           onChange={(e) => setLocal(e.target.value)}
           style={{ width: '100%', padding: '2px 4px', fontSize: 10.5,
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    borderRadius: 3, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)',
                    textAlign: 'center' }} />
  );
}

// ColumnLifecyclePicker — multi-select compact. Hiện summary "All" / "Live"
// / "+2", click mở popover checkbox.
function ColumnLifecyclePicker({ selected, facets, onChange }: {
  selected: string[];
  facets: Record<string, number>;
  onChange: (arr: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0
    ? 'Tất cả'
    : selected.length === 1
      ? (LIFECYCLE_META[selected[0]!]?.label ?? selected[0]!)
      : `${selected.length} đã chọn`;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
              style={{ width: '100%', padding: '2px 6px', fontSize: 10.5,
                       fontFamily: 'var(--font-mono)',
                       background: selected.length > 0 ? 'var(--accent-soft)' : 'var(--bg-2)',
                       border: `1px solid ${selected.length > 0 ? 'var(--accent)' : 'var(--line)'}`,
                       color: selected.length > 0 ? 'var(--accent)' : 'var(--fg-2)',
                       borderRadius: 3, cursor: 'pointer', textAlign: 'left' }}>
        {label} ▾
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)}
               style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
                        background: 'var(--bg-1)', border: '1px solid var(--line)',
                        borderRadius: 5, padding: 4, minWidth: 170, zIndex: 51,
                        boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}
               onClick={(e) => e.stopPropagation()}>
            {Object.entries(LIFECYCLE_META).map(([key, meta]) => {
              const on = selected.includes(key);
              const count = facets[key] ?? 0;
              return (
                <button key={key} type="button"
                        onClick={() => {
                          const next = on ? selected.filter((x) => x !== key) : [...selected, key];
                          onChange(next);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5,
                                 width: '100%', textAlign: 'left',
                                 padding: '3px 6px', fontSize: 11,
                                 background: on ? 'var(--accent-soft)' : 'transparent',
                                 border: 'none', cursor: 'pointer',
                                 color: meta.color, fontFamily: 'var(--font-mono)',
                                 fontWeight: 700, borderRadius: 3 }}>
                  <span style={{ width: 11, height: 11, border: '1px solid currentColor',
                                 borderRadius: 2, flexShrink: 0,
                                 background: on ? 'currentColor' : 'transparent' }} />
                  <span style={{ flex: 1 }}>{meta.icon} {meta.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </span>
  );
}

// ColumnTimeSelect — dropdown time range cột Ago.
function ColumnTimeSelect({ value, onChange }: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <select value={value == null ? 'all' : String(value)}
            onChange={(e) => onChange(e.target.value === 'all' ? null : Number(e.target.value))}
            style={{ width: '100%', padding: '2px 4px', fontSize: 10.5,
                     background: 'var(--bg-2)', border: '1px solid var(--line)',
                     borderRadius: 3, color: 'var(--fg-0)', cursor: 'pointer',
                     fontFamily: 'var(--font-mono)' }}>
      {TIME_OPTIONS.map((t) => (
        <option key={t.label} value={t.value == null ? 'all' : String(t.value)}>{t.label}</option>
      ))}
    </select>
  );
}

// formatCost — 4 chữ số khi <$0.001, 3 chữ số khi ≥$0.001.
function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s > 0 ? `${m}m${s}s` : `${m}m`;
}

// CostHoverCell — hover mở popover hiện breakdown các version (sibling drafts
// cùng parent_url) + tổng cost + total time. Lazy fetch khi hover lần đầu.
// Popover render qua portal vào body để THOÁT clip của table wrapper
// (overflow: hidden). Position = bounding rect của cell, flip lên/xuống
// tuỳ chỗ trống màn hình.
function CostHoverCell({ cardId, currentCost }: {
  cardId: number;
  currentCost: number | null;
}) {
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function ensureFetched() {
    if (data != null || fetching) return;
    setFetching(true);
    try {
      const res = await listCostVersions(cardId);
      setData(res);
    } finally {
      setFetching(false);
    }
  }

  function openWithPos() {
    ensureFetched();
    const el = tdRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const POPOVER_HEIGHT = 240;   // ước lượng
      const POPOVER_WIDTH = 300;
      const spaceAbove = rect.top;
      const placeAbove = spaceAbove > POPOVER_HEIGHT + 20;
      // Anchor right edge của cell, popover xoè sang trái.
      let left = rect.right - POPOVER_WIDTH;
      if (left < 8) left = 8;
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPOVER_WIDTH - 8;
      }
      const top = placeAbove ? rect.top - 4 : rect.bottom + 4;
      setCoords({ top, left, placeAbove });
    }
    setOpen(true);
  }

  const hasCost = currentCost != null && currentCost > 0;

  return (
    <td ref={tdRef}
        style={{ ...td(), textAlign: 'center' }}
        onMouseEnter={openWithPos}
        onMouseLeave={() => setOpen(false)}>
      {hasCost ? (
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                       color: currentCost >= 0.01 ? '#fbbf24' : '#60a5fa',
                       cursor: 'help', borderBottom: '1px dotted currentColor' }}>
          {formatCost(currentCost)}
        </span>
      ) : (
        <span style={{ fontSize: 10, color: 'var(--fg-4)', opacity: 0.55,
                       fontFamily: 'var(--font-mono)' }}>—</span>
      )}
      {open && hasCost && mounted && coords && createPortal(
        <div style={{ position: 'fixed',
                      [coords.placeAbove ? 'bottom' : 'top']:
                        coords.placeAbove ? window.innerHeight - coords.top : coords.top,
                      left: coords.left, width: 300, padding: 8, zIndex: 9999,
                      background: 'var(--bg-1)', border: '1px solid var(--line)',
                      borderRadius: 5, boxShadow: '0 4px 14px rgba(0,0,0,.5)',
                      textAlign: 'left', pointerEvents: 'none' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                        color: 'var(--fg-3)', marginBottom: 6,
                        textTransform: 'uppercase' }}>
            Versions cùng thread
          </div>
          {fetching && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 4 }}>
              ⟳ Đang tải…
            </div>
          )}
          {data && data.versions.length > 0 && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse',
                              fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ color: 'var(--fg-4)', textAlign: 'left' }}>
                    <th style={{ padding: '2px 4px', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '2px 4px', fontWeight: 600 }}>Model</th>
                    <th style={{ padding: '2px 4px', fontWeight: 600, textAlign: 'right' }}>Cost</th>
                    <th style={{ padding: '2px 4px', fontWeight: 600, textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.versions.map((v, i) => (
                    <tr key={v.id}
                        style={{ borderTop: '1px solid var(--line)',
                                 background: v.isCurrent ? 'var(--accent-soft)' : 'transparent',
                                 color: v.isPosted ? 'var(--ok)' : 'var(--fg-1)' }}>
                      <td style={{ padding: '2px 4px' }}>
                        {v.isCurrent ? '▸' : ''}{i + 1}
                        {v.isPosted && <span title="đã đăng" style={{ marginLeft: 2 }}>✓</span>}
                      </td>
                      <td style={{ padding: '2px 4px', fontSize: 9.5,
                                   maxWidth: 90, overflow: 'hidden',
                                   textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={v.modelUsed ?? ''}>
                        {v.modelUsed
                          ? v.modelUsed.replace(/^(claude|gpt|gemini)-?/i, '').slice(0, 14)
                          : (v.answerSource ?? '—')}
                      </td>
                      <td style={{ padding: '2px 4px', textAlign: 'right',
                                   color: v.costUsd != null && v.costUsd >= 0.01 ? '#fbbf24' : '#60a5fa' }}>
                        {v.costUsd != null ? formatCost(v.costUsd) : '—'}
                      </td>
                      <td style={{ padding: '2px 4px', textAlign: 'right', color: 'var(--fg-3)' }}>
                        {v.durationMs != null ? formatDuration(v.durationMs) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: '1px solid var(--accent)', marginTop: 6,
                            paddingTop: 4, display: 'flex', gap: 12,
                            fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--fg-3)' }}>Tổng:</span>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                  💰 {formatCost(data.totalCostUsd)}
                </span>
                <span style={{ color: 'var(--fg-3)' }}>
                  ⏱ {formatDuration(data.totalDurationMs)}
                </span>
                <span style={{ color: 'var(--fg-4)', marginLeft: 'auto' }}>
                  {data.versionCount} ver
                </span>
              </div>
            </>
          )}
          {data && data.versions.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              Không có dữ liệu version
            </div>
          )}
        </div>,
        document.body,
      )}
    </td>
  );
}

// DurationCell — cột '⏱ Gen' show gen_duration_ms version cuối.
function DurationCell({ durationMs }: { durationMs: number | null }) {
  return (
    <td style={{ ...td(), textAlign: 'center' }}>
      {durationMs != null && durationMs > 0 ? (
        <span title={`Thời gian gen AI version cuối: ${durationMs}ms`}
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                       color: durationMs >= 30_000 ? '#fbbf24' : 'var(--fg-2)' }}>
          {formatDuration(durationMs)}
        </span>
      ) : (
        <span style={{ fontSize: 10, color: 'var(--fg-4)', opacity: 0.55,
                       fontFamily: 'var(--font-mono)' }}>—</span>
      )}
    </td>
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
