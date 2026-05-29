'use client';

// HabitatsTable — quản lý danh sách habitat dạng table cho tab 'Habitats'
// trong /seeding. Mỗi row = 1 habitat. Click row → mở HabitatFormModal chi
// tiết (qua onOpenHabitat — nested ?hab= overlay ở SeedingCockpit). '+ Habitat
// mới' → onCreateHabitat mở modal create.
//
// Seeding metrics (briefs / accounts / posts / seed gần nhất) derive từ
// seeding queue (mỗi SeedingQueueItem có habitatId) — không query thêm.
//
// Cột: Core+status (name/kind/url/status/lang/members/health/own) +
// Seeding metrics (briefs · accounts · posts · last seed) + Tribe+voice.
// Search + sort theo cột + filter platform/status/own. Footer tổng.

import { useMemo, useState } from 'react';
import type { HabitatRow, TribeRow } from '@/lib/data';
import type { SeedingQueueItem } from '@/lib/actions/seeding';
import { HabitatKindChip } from './habitat-kind-chip';
import { LangChip } from './lang-chip';
import { fmtCompactNum } from '@/lib/format';
import { fmtAgoShort } from '@/lib/time-format';
import {
  MultiSelect, Segmented, EmptyState, SiteFavicon, Pill, IconChevron,
} from './ui';

// ── Seeding metrics gộp per-habitat (derive 1 lần từ queue) ──────────────
interface HabitatSeedMetrics {
  briefs: number;        // distinct briefId seeding habitat này
  accounts: number;      // distinct accountId
  posts: number;         // sum postedCount cross-brief
  backlog: number;       // sum nháp chưa đăng
  lastSeededAt: number | null;  // max lastSeededAt (ms)
}

const MOD_COLOR: Record<string, string> = {
  low: 'var(--ok)', medium: 'var(--warn)', high: 'var(--bad)',
};

type SortKey = 'name' | 'platform' | 'status' | 'members' | 'briefs' | 'posts' | 'lastSeed';
type SortDir = 'asc' | 'desc';

// Status habitat — string tự do trong DB, map sang màu. Default xám.
function statusMeta(status: string): { label: string; color: string } {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'seeding') return { label: status || '—', color: 'var(--ok)' };
  if (s === 'watching' || s === 'prospect' || s === 'candidate') return { label: status, color: 'var(--warn)' };
  if (s === 'paused' || s === 'banned' || s === 'dead' || s === 'left') return { label: status, color: 'var(--bad)' };
  return { label: status || '—', color: 'var(--fg-3)' };
}

const TH: React.CSSProperties = {
  padding: '7px 8px', fontSize: 9.5, fontFamily: 'var(--font-mono)',
  color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em',
  fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--line)', position: 'sticky', top: 0,
  background: 'var(--bg-1)', zIndex: 1,
};
const TD: React.CSSProperties = {
  padding: '7px 8px', fontSize: 11.5, borderBottom: '1px solid var(--line)',
  verticalAlign: 'middle',
};

function SortHead({ label, k, sort, dir, onSort, align = 'left', title }: {
  label: string; k: SortKey; sort: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; align?: 'left' | 'center' | 'right'; title?: string;
}) {
  const on = sort === k;
  return (
    <th style={{ ...TH, textAlign: align, cursor: 'pointer' }} onClick={() => onSort(k)} title={title}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                     color: on ? 'var(--accent)' : undefined }}>
        {label}
        {on && <IconChevron dir={dir === 'asc' ? 'up' : 'down'} size={9} />}
      </span>
    </th>
  );
}

export function HabitatsTable({
  habitats, queue, tribes, onOpenHabitat, onCreateHabitat,
}: {
  habitats: HabitatRow[];
  queue: SeedingQueueItem[];
  tribes: TribeRow[];
  onOpenHabitat: (habitatId: number) => void;
  onCreateHabitat: () => void;
}) {
  const [q, setQ] = useState('');
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [ownFilter, setOwnFilter] = useState<'all' | 'own' | 'external'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [dir, setDir] = useState<SortDir>('asc');

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(k); setDir(k === 'name' || k === 'platform' || k === 'status' ? 'asc' : 'desc'); }
  };

  // Tribe id → name (cho cột Tribe).
  const tribeName = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of tribes) m.set(t.id, t.name);
    return m;
  }, [tribes]);

  // Seeding metrics per habitat — 1 pass qua queue.
  const metricsByHabitat = useMemo(() => {
    // postedCount/backlogCount là BRIEF-level (lặp lại trên mọi lane của brief).
    // 1 brief có N lanes = N rows cùng briefId trong queue → cộng thẳng sẽ
    // nhân N. Dồn posts/backlog vào Map theo briefId (lấy 1 lần/brief) trước
    // khi sum, accounts/briefs dùng Set distinct.
    const m = new Map<number, {
      briefs: Set<number>; accounts: Set<number>;
      postsByBrief: Map<number, number>; backlogByBrief: Map<number, number>;
      lastSeededAt: number | null;
    }>();
    for (const x of queue) {
      let cur = m.get(x.habitatId);
      if (!cur) {
        cur = { briefs: new Set(), accounts: new Set(), postsByBrief: new Map(), backlogByBrief: new Map(), lastSeededAt: null };
        m.set(x.habitatId, cur);
      }
      cur.briefs.add(x.briefId);
      cur.accounts.add(x.accountId);
      cur.postsByBrief.set(x.briefId, x.postedCount);     // brief-level → overwrite, không cộng
      // backlog là per brief×phase; lanes của cùng brief cộng dồn (mỗi lane =
      // 1 schedule, backlog riêng) → max-safe: cộng theo từng row nhưng key
      // theo scheduleId để không trùng. Đơn giản: cộng tất, vì backlog là
      // per-lane khác nhau (text/image/video). Dùng accumulate per brief.
      cur.backlogByBrief.set(x.briefId, (cur.backlogByBrief.get(x.briefId) ?? 0) + x.backlogCount);
      if (x.lastSeededAt) {
        const t = new Date(x.lastSeededAt).getTime();
        if (cur.lastSeededAt == null || t > cur.lastSeededAt) cur.lastSeededAt = t;
      }
    }
    const out = new Map<number, HabitatSeedMetrics>();
    for (const [id, v] of m) {
      let posts = 0; for (const p of v.postsByBrief.values()) posts += p;
      let backlog = 0; for (const b of v.backlogByBrief.values()) backlog += b;
      out.set(id, { briefs: v.briefs.size, accounts: v.accounts.size, posts, backlog, lastSeededAt: v.lastSeededAt });
    }
    return out;
  }, [queue]);

  const emptyMetrics: HabitatSeedMetrics = { briefs: 0, accounts: 0, posts: 0, backlog: 0, lastSeededAt: null };

  // Filter options derive từ habitats.
  const platformOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of habitats) { const k = h.platformKey || h.kind; if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [habitats]);
  const statusOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of habitats) { const s = h.status || '—'; m.set(s, (m.get(s) ?? 0) + 1); }
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);
  }, [habitats]);

  const rows = useMemo(() => {
    let list = habitats;
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((h) =>
        h.name.toLowerCase().includes(s) ||
        (h.title || '').toLowerCase().includes(s) ||
        (h.url || '').toLowerCase().includes(s) ||
        (h.communityType || '').toLowerCase().includes(s));
    }
    if (filterPlatforms.length) { const set = new Set(filterPlatforms); list = list.filter((h) => set.has(h.platformKey || h.kind)); }
    if (filterStatus.length) { const set = new Set(filterStatus); list = list.filter((h) => set.has(h.status || '—')); }
    if (ownFilter === 'own') list = list.filter((h) => h.isOwn);
    else if (ownFilter === 'external') list = list.filter((h) => !h.isOwn);

    const mul = dir === 'asc' ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      const ma = metricsByHabitat.get(a.id) ?? emptyMetrics;
      const mb = metricsByHabitat.get(b.id) ?? emptyMetrics;
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name) * mul;
        case 'platform': return (a.platformKey || a.kind).localeCompare(b.platformKey || b.kind) * mul;
        case 'status': return (a.status || '').localeCompare(b.status || '') * mul;
        case 'members': return (a.members - b.members) * mul;
        case 'briefs': return (ma.briefs - mb.briefs) * mul;
        case 'posts': return (ma.posts - mb.posts) * mul;
        case 'lastSeed': return ((ma.lastSeededAt ?? 0) - (mb.lastSeededAt ?? 0)) * mul;
        default: return 0;
      }
    });
    return sorted;
  }, [habitats, q, filterPlatforms, filterStatus, ownFilter, sort, dir, metricsByHabitat]);

  // Tổng cho footer.
  const totals = useMemo(() => {
    let members = 0, briefs = 0, accounts = 0, posts = 0;
    const acctSet = new Set<number>();
    for (const h of rows) {
      members += h.members;
      const m = metricsByHabitat.get(h.id) ?? emptyMetrics;
      briefs += m.briefs; posts += m.posts;
    }
    // accounts distinct cross-habitat (chỉ trong rows hiển thị)
    const visibleIds = new Set(rows.map((h) => h.id));
    for (const x of queue) if (visibleIds.has(x.habitatId)) acctSet.add(x.accountId);
    accounts = acctSet.size;
    return { members, briefs, accounts, posts, count: rows.length };
  }, [rows, metricsByHabitat, queue]);

  const activeFilters = filterPlatforms.length + filterStatus.length + (ownFilter !== 'all' ? 1 : 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Tìm habitat / URL / type…" value={q} onChange={(e) => setQ(e.target.value)}
               style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)',
                        borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 220 }} />
        <MultiSelect<string> label="Platform" options={platformOptions}
                             selected={filterPlatforms} onChange={setFilterPlatforms} />
        <MultiSelect<string> label="Status" options={statusOptions}
                             selected={filterStatus} onChange={setFilterStatus} />
        <Segmented<'all' | 'own' | 'external'>
          options={[{ value: 'all', label: 'Tất cả' }, { value: 'own', label: '👑 Own' }, { value: 'external', label: 'External' }]}
          value={ownFilter} onChange={setOwnFilter} size="sm" />
        {activeFilters > 0 && (
          <button type="button"
                  onClick={() => { setFilterPlatforms([]); setFilterStatus([]); setOwnFilter('all'); }}
                  title="Xoá mọi filter"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 11, padding: '4px 6px' }}>
            ✕ reset
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {rows.length}/{habitats.length} habitat
        </span>
        <button className="btn primary" onClick={onCreateHabitat}
                title="Tạo habitat mới (subreddit / discord / fb-group / forum…)"
                style={{ fontSize: 11.5, fontWeight: 700 }}>
          + Habitat mới
        </button>
      </div>

      {habitats.length === 0 ? (
        <EmptyState icon="🏘" title="Chưa có habitat nào"
                    description="Tạo habitat đầu tiên (subreddit/discord/forum) để bắt đầu seeding." />
      ) : rows.length === 0 ? (
        <EmptyState icon="🔍" title="Không khớp filter" description="Thử đổi search / platform / status." />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                <SortHead label="Habitat" k="name" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Platform" k="platform" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Status" k="status" sort={sort} dir={dir} onSort={onSort} />
                <th style={{ ...TH, textAlign: 'center' }} title="Ngôn ngữ">Lang</th>
                <SortHead label="Members" k="members" sort={sort} dir={dir} onSort={onSort} align="right" />
                <SortHead label="Briefs" k="briefs" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Số brief đang seed habitat này (distinct)" />
                <th style={{ ...TH, textAlign: 'center' }} title="Số account distinct đang seed">Acct</th>
                <SortHead label="Posts" k="posts" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Tổng bài đã đăng (cross-brief)" />
                <SortHead label="Seed" k="lastSeed" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Lần seed gần nhất" />
                <th style={{ ...TH }} title="Tribe gán + voice profile">Tribe / Voice</th>
                <th style={{ ...TH }} title="Mod strictness + gates đăng bài">Gates</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const m = metricsByHabitat.get(h.id) ?? emptyMetrics;
                const sm = statusMeta(h.status);
                const primaryTribe = h.tribeId != null ? tribeName.get(h.tribeId) : null;
                const extraTribes = h.tribeIds.filter((t) => t !== h.tribeId).length;
                const modC = MOD_COLOR[(h.modStrictness || '').toLowerCase()] ?? 'var(--fg-3)';
                return (
                  <tr key={h.id}
                      onClick={() => onOpenHabitat(h.id)}
                      title={`Mở chi tiết habitat: ${h.name}`}
                      style={{ cursor: 'pointer', background: h.isOwn ? 'rgba(251,191,36,0.04)' : undefined }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = h.isOwn ? 'rgba(251,191,36,0.04)' : '')}>
                    {/* Habitat: favicon + name + url */}
                    <td style={{ ...TD, maxWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <SiteFavicon url={h.url} kind={h.kind} size={20} title="" style={{ borderRadius: 4, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--fg-0)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {h.isOwn && <span title="Own habitat (brand mình quản lý)" style={{ color: '#fbbf24' }}>👑</span>}
                            {h.name}
                          </div>
                          {h.url && (
                            <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>
                              {h.url.replace(/^https?:\/\/(www\.)?/, '')}
                            </div>
                          )}
                          {!h.url && (
                            <div style={{ fontSize: 9.5, color: 'var(--warn)' }} title="Thiếu URL — block markPosted">⚠ thiếu URL</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Platform / kind */}
                    <td style={{ ...TD }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {h.platformKey && (
                          <img src={`https://cdn.simpleicons.org/${h.platformKey}/a3a3a3`} alt="" width={12} height={12} style={{ opacity: 0.85, flexShrink: 0 }} />
                        )}
                        <HabitatKindChip kind={h.kind} size="sm" />
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ ...TD }}>
                      <Pill color={sm.color} label={sm.label} tone="soft" size="xs" mono uppercase />
                    </td>
                    {/* Lang */}
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {h.language ? <LangChip mode="static" code={h.language} size="sm" /> : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                    </td>
                    {/* Members */}
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                                 color: h.members > 0 ? 'var(--fg-1)' : 'var(--fg-4)' }}
                        title={h.members > 0 ? `${h.members.toLocaleString()} members` : 'Chưa rõ members'}>
                      {h.members > 0 ? fmtCompactNum(h.members) : '—'}
                    </td>
                    {/* Briefs */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11,
                                 color: m.briefs > 0 ? 'var(--accent)' : 'var(--fg-4)', fontWeight: m.briefs > 0 ? 700 : 400 }}
                        title={m.briefs > 0 ? `${m.briefs} brief đang seed · ${m.backlog} nháp chờ` : 'Chưa có brief seed'}>
                      {m.briefs || '—'}
                    </td>
                    {/* Accounts */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                                 color: m.accounts > 0 ? 'var(--fg-1)' : 'var(--fg-4)' }}
                        title={`${m.accounts} account distinct seeding habitat này`}>
                      {m.accounts || '—'}
                    </td>
                    {/* Posts */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                                 color: m.posts > 0 ? '#60a5fa' : 'var(--fg-4)', fontWeight: m.posts > 0 ? 700 : 400 }}
                        title={m.posts > 0 ? `${m.posts} bài đã đăng` : 'Chưa có bài đăng'}>
                      {m.posts > 0 ? `📨${fmtCompactNum(m.posts)}` : '—'}
                    </td>
                    {/* Last seed */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10,
                                 color: 'var(--fg-3)' }}
                        title={m.lastSeededAt ? new Date(m.lastSeededAt).toLocaleString() : 'Chưa seed lần nào'}>
                      {m.lastSeededAt ? `⏱${fmtAgoShort(m.lastSeededAt)}` : '—'}
                    </td>
                    {/* Tribe / voice */}
                    <td style={{ ...TD, maxWidth: 160 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11, color: primaryTribe ? 'var(--fg-1)' : 'var(--fg-4)',
                                       whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={primaryTribe ? `Tribe: ${primaryTribe}${extraTribes ? ` (+${extraTribes})` : ''}` : 'Chưa gán tribe'}>
                          {primaryTribe ?? '—'}{extraTribes > 0 && <span style={{ color: 'var(--fg-4)' }}> +{extraTribes}</span>}
                        </span>
                        {h.voiceProfile && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
                                title={`Voice profile: ${h.voiceProfile}`}>
                            🎙 {h.voiceProfile}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Gates */}
                    <td style={{ ...TD, fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ color: modC }} title="Mod strictness">
                          mod: {h.modStrictness || '?'}
                        </span>
                        {(h.minKarma > 0 || h.minAccountAgeDays > 0 || h.minPosts > 0) && (
                          <span title={`Gates: ${h.minKarma}k karma · ${h.minAccountAgeDays}d age · ${h.minPosts} posts`}>
                            {[h.minKarma > 0 ? `${h.minKarma}k` : null,
                              h.minAccountAgeDays > 0 ? `${h.minAccountAgeDays}d` : null,
                              h.minPosts > 0 ? `${h.minPosts}p` : null].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {h.aiContentDetection && (
                          <span style={{ color: 'var(--warn)' }} title={h.aiDetectionNote || 'Community có cơ chế tự detect AI content'}>
                            🤖 AI-detect
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)' }}>
                <td style={{ padding: '7px 8px', fontWeight: 700 }}>{totals.count} habitat</td>
                <td colSpan={3} style={{ padding: '7px 8px' }} />
                <td style={{ padding: '7px 8px', textAlign: 'right' }} title="Tổng members">{fmtCompactNum(totals.members)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }} title="Tổng brief">{totals.briefs || '—'}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }} title="Account distinct (visible)">{totals.accounts || '—'}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }} title="Tổng posts">{totals.posts ? `📨${fmtCompactNum(totals.posts)}` : '—'}</td>
                <td colSpan={3} style={{ padding: '7px 8px' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
