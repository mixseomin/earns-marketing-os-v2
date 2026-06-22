'use client';

// AccountsTable — quản lý danh sách account dạng table cho tab 'Accounts'
// trong /seeding. Mỗi row = 1 account. Click row → mở AccountFormModal chi
// tiết (qua onOpenAccount — nested ?acct= overlay ở SeedingCockpit). '+ Account
// mới' → onCreateAccount mở modal create.
//
// Seeding metrics (briefs / habitats / posts / seed gần nhất) derive từ
// seeding queue (mỗi SeedingQueueItem có accountId) — không query thêm.
//
// Cột: Core+status (handle/kind/platform/status/2FA/cost) + warmup progress
// + seeding metrics (briefs · habitats · posts · last seed) + flags.
// Search + sort theo cột + filter platform/status/owner. Footer tổng.

import { useMemo, useState } from 'react';
import type { AccountRow } from '@/lib/data';
import type { SeedingQueueItem } from '@/lib/actions/seeding';
import { accountStatusMeta } from '@/lib/status-meta';
import { fmtCompactNum } from '@/lib/format';
import { fmtAgoShort } from '@/lib/time-format';
import {
  MultiSelect, Segmented, EmptyState, Pill, IconChevron,
} from './ui';

// Lens lifecycle: cắt account theo giai đoạn sống. 'all' = tất cả; 'warmup' =
// đang setup/đủ-điều-kiện (todo/creating/warming) — đây là nguồn block seeding
// lớn nhất; 'health' = chết/giới hạn (banned/blocked/limited/dormant/defunct)
// — rủi ro ban, cần revive/cleanup. (Đề xuất 🔥 Khởi động + 🩺 Sức khỏe.)
export type AccountLens = 'all' | 'warmup' | 'health';
const LENS_STATUSES: Record<Exclude<AccountLens, 'all'>, Set<string>> = {
  warmup: new Set(['todo', 'creating', 'warming']),
  health: new Set(['banned', 'blocked', 'limited', 'dormant', 'defunct']),
};

interface AccountSeedMetrics {
  briefs: number;        // distinct briefId account này đang seed
  habitats: number;      // distinct habitatId
  posts: number;         // sum postedCount cross-brief (dedup brief-level)
  backlog: number;       // sum nháp chưa đăng
  lastSeededAt: number | null;
}

type SortKey = 'handle' | 'platform' | 'status' | 'cost' | 'briefs' | 'posts' | 'lastSeed' | 'unread';
type SortDir = 'asc' | 'desc';

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

// Warmup progress: số mục done / tổng mục trong warmupChecklist.
function warmupProgress(checklist: AccountRow['warmupChecklist']): { done: number; total: number } | null {
  const keys = Object.keys(checklist || {});
  if (keys.length === 0) return null;
  const done = keys.filter((k) => checklist[k]?.done).length;
  return { done, total: keys.length };
}

export function AccountsTable({
  accounts, queue, teamMembers = [], initialLens = 'all', onOpenAccount, onCreateAccount,
}: {
  accounts: AccountRow[];
  queue: SeedingQueueItem[];
  teamMembers?: Array<{ id: number; displayName: string }>;
  initialLens?: AccountLens;
  onOpenAccount: (accountId: number) => void;
  onCreateAccount: () => void;
}) {
  const [lens, setLens] = useState<AccountLens>(initialLens);
  const [q, setQ] = useState('');
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterOwners, setFilterOwners] = useState<number[]>([]);
  const [sort, setSort] = useState<SortKey>('handle');
  const [dir, setDir] = useState<SortDir>('asc');

  // Count theo lens cho Segmented label.
  const lensCounts = useMemo(() => {
    let warmup = 0, health = 0;
    for (const a of accounts) {
      if (LENS_STATUSES.warmup.has(a.status)) warmup++;
      else if (LENS_STATUSES.health.has(a.status)) health++;
    }
    return { all: accounts.length, warmup, health };
  }, [accounts]);

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(k); setDir(k === 'handle' || k === 'platform' || k === 'status' ? 'asc' : 'desc'); }
  };

  const ownerName = useMemo(() => {
    const m = new Map<number, string>();
    for (const tm of teamMembers) m.set(tm.id, tm.displayName);
    return m;
  }, [teamMembers]);

  // Seeding metrics per account — derive từ queue (dedup postedCount brief-level).
  const metricsByAccount = useMemo(() => {
    const m = new Map<number, {
      briefs: Set<number>; habitats: Set<number>;
      postsByBrief: Map<number, number>; backlogByBrief: Map<number, number>;
      lastSeededAt: number | null;
    }>();
    for (const x of queue) {
      let cur = m.get(x.accountId);
      if (!cur) {
        cur = { briefs: new Set(), habitats: new Set(), postsByBrief: new Map(), backlogByBrief: new Map(), lastSeededAt: null };
        m.set(x.accountId, cur);
      }
      cur.briefs.add(x.briefId);
      cur.habitats.add(x.habitatId);
      // postedCount là BRIEF-level (mọi lane cùng brief = cùng giá trị) → SET
      // (overwrite) để đếm 1 lần. ĐỪNG đổi sang += (sẽ nhân theo số lane).
      cur.postsByBrief.set(x.briefId, x.postedCount);
      // backlog là PER-LANE (mỗi schedule/lane backlog riêng) → cộng dồn.
      cur.backlogByBrief.set(x.briefId, (cur.backlogByBrief.get(x.briefId) ?? 0) + x.backlogCount);
      if (x.lastSeededAt) {
        const t = new Date(x.lastSeededAt).getTime();
        if (cur.lastSeededAt == null || t > cur.lastSeededAt) cur.lastSeededAt = t;
      }
    }
    const out = new Map<number, AccountSeedMetrics>();
    for (const [id, v] of m) {
      let posts = 0; for (const p of v.postsByBrief.values()) posts += p;
      let backlog = 0; for (const b of v.backlogByBrief.values()) backlog += b;
      out.set(id, { briefs: v.briefs.size, habitats: v.habitats.size, posts, backlog, lastSeededAt: v.lastSeededAt });
    }
    return out;
  }, [queue]);

  const emptyMetrics: AccountSeedMetrics = { briefs: 0, habitats: 0, posts: 0, backlog: 0, lastSeededAt: null };

  const platformOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts) { if (a.platformKey) m.set(a.platformKey, (m.get(a.platformKey) ?? 0) + 1); }
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts]);
  const statusOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts) { const s = a.status || '—'; m.set(s, (m.get(s) ?? 0) + 1); }
    return [...m.entries()].map(([value, count]) => ({ value, label: value === '—' ? '—' : accountStatusMeta(value).label, count }))
      .sort((a, b) => b.count - a.count);
  }, [accounts]);
  const ownerOptions = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of accounts) { if (a.ownerUserId != null) m.set(a.ownerUserId, (m.get(a.ownerUserId) ?? 0) + 1); }
    return [...m.entries()].map(([value, count]) => ({ value, label: ownerName.get(value) ?? `#${value}`, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts, ownerName]);

  const rows = useMemo(() => {
    let list = accounts;
    if (lens !== 'all') { const set = LENS_STATUSES[lens]; list = list.filter((a) => set.has(a.status)); }
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((a) =>
        (a.handle || '').toLowerCase().includes(s) ||
        (a.email || '').toLowerCase().includes(s) ||
        a.tags.some((t) => t.toLowerCase().includes(s)));
    }
    if (filterPlatforms.length) { const set = new Set(filterPlatforms); list = list.filter((a) => set.has(a.platformKey)); }
    if (filterStatus.length) { const set = new Set(filterStatus); list = list.filter((a) => set.has(a.status || '—')); }
    if (filterOwners.length) { const set = new Set(filterOwners); list = list.filter((a) => a.ownerUserId != null && set.has(a.ownerUserId)); }

    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const ma = metricsByAccount.get(a.id) ?? emptyMetrics;
      const mb = metricsByAccount.get(b.id) ?? emptyMetrics;
      switch (sort) {
        case 'handle': return (a.handle || '').localeCompare(b.handle || '') * mul;
        case 'platform': return (a.platformKey || '').localeCompare(b.platformKey || '') * mul;
        case 'status': return (a.status || '').localeCompare(b.status || '') * mul;
        case 'cost': return (a.monthlyCost - b.monthlyCost) * mul;
        case 'briefs': return (ma.briefs - mb.briefs) * mul;
        case 'posts': return (ma.posts - mb.posts) * mul;
        case 'lastSeed': return ((ma.lastSeededAt ?? 0) - (mb.lastSeededAt ?? 0)) * mul;
        case 'unread': return ((a.unreadMessages ?? -1) - (b.unreadMessages ?? -1)) * mul;
        default: return 0;
      }
    });
  }, [accounts, lens, q, filterPlatforms, filterStatus, filterOwners, sort, dir, metricsByAccount]);

  const totals = useMemo(() => {
    let cost = 0, briefs = 0, posts = 0;
    const habitatSet = new Set<number>();
    for (const a of rows) {
      cost += a.monthlyCost;
      const m = metricsByAccount.get(a.id) ?? emptyMetrics;
      briefs += m.briefs; posts += m.posts;
    }
    const visibleIds = new Set(rows.map((a) => a.id));
    for (const x of queue) if (visibleIds.has(x.accountId)) habitatSet.add(x.habitatId);
    return { cost, briefs, posts, habitats: habitatSet.size, count: rows.length };
  }, [rows, metricsByAccount, queue]);

  const activeFilters = filterPlatforms.length + filterStatus.length + filterOwners.length;

  return (
    <div>
      {/* Lens lifecycle — 🔥 Khởi động (warming) · 🩺 Sức khỏe (dead). */}
      <div style={{ marginBottom: 10 }}>
        <Segmented<AccountLens>
          options={[
            { value: 'all', label: `Tất cả (${lensCounts.all})` },
            { value: 'warmup', label: `🔥 Khởi động${lensCounts.warmup ? ` (${lensCounts.warmup})` : ''}`, title: 'Account đang setup/đủ-điều-kiện (todo/creating/warming) — nguồn block seeding lớn nhất' },
            { value: 'health', label: `🩺 Sức khỏe${lensCounts.health ? ` (${lensCounts.health})` : ''}`, title: 'Account chết/giới hạn (banned/blocked/limited/dormant/defunct) — cần revive/cleanup' },
          ]}
          value={lens} onChange={setLens} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Tìm @handle / email / tag…" value={q} onChange={(e) => setQ(e.target.value)}
               style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)',
                        borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 220 }} />
        <MultiSelect<string> label="Platform" options={platformOptions} selected={filterPlatforms} onChange={setFilterPlatforms} />
        <MultiSelect<string> label="Status" options={statusOptions} selected={filterStatus} onChange={setFilterStatus} />
        {ownerOptions.length > 0 && (
          <MultiSelect<number> label="Owner" options={ownerOptions} selected={filterOwners} onChange={setFilterOwners} />
        )}
        {activeFilters > 0 && (
          <button type="button"
                  onClick={() => { setFilterPlatforms([]); setFilterStatus([]); setFilterOwners([]); }}
                  title="Xoá mọi filter"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 11, padding: '4px 6px' }}>
            ✕ reset
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {rows.length}/{accounts.length} account
        </span>
        <button className="btn primary" onClick={onCreateAccount}
                title="Tạo account mới (handle / platform / credential / status)"
                style={{ fontSize: 11.5, fontWeight: 700 }}>
          + Account mới
        </button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState icon="🔐" title="Chưa có account nào"
                    description="Tạo account đầu tiên để gán vào community + seeding." />
      ) : rows.length === 0 ? (
        <EmptyState icon="🔍" title="Không khớp filter" description="Thử đổi search / platform / status / owner." />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr>
                <SortHead label="Account" k="handle" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Platform" k="platform" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Status" k="status" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="✉" k="unread" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Tin nhắn chưa đọc — ext tự quét khi account đang đăng nhập trên site. Sort để nổi account có inbox cần xử lý lên đầu." />
                <th style={{ ...TH, textAlign: 'center' }} title="Warm-up checklist (done/total) — điều kiện đủ tuổi/karma global">Warmup</th>
                <SortHead label="Briefs" k="briefs" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Số brief account này đang seed (distinct)" />
                <th style={{ ...TH, textAlign: 'center' }} title="Số community distinct account này seeding">Habitats</th>
                <SortHead label="Posts" k="posts" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Tổng bài đã đăng (cross-brief)" />
                <SortHead label="Seed" k="lastSeed" sort={sort} dir={dir} onSort={onSort} align="center"
                          title="Lần seed gần nhất" />
                <SortHead label="$/mo" k="cost" sort={sort} dir={dir} onSort={onSort} align="right"
                          title="Chi phí hằng tháng (proxy/subscription)" />
                <th style={{ ...TH, textAlign: 'center' }} title="2FA · API token · thu thập stats · owner">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const m = metricsByAccount.get(a.id) ?? emptyMetrics;
                const sm = accountStatusMeta(a.status);
                const wp = warmupProgress(a.warmupChecklist);
                const owner = a.ownerUserId != null ? ownerName.get(a.ownerUserId) : null;
                return (
                  <tr key={a.id}
                      onClick={() => onOpenAccount(a.id)}
                      title={`Mở chi tiết account: @${a.handle ?? a.id}`}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                    {/* Account: kind icon + @handle + email/tags */}
                    <td style={{ ...TD, maxWidth: 240 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--fg-0)',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.platformKey && (
                            <img src={`https://cdn.simpleicons.org/${a.platformKey}/a3a3a3`} alt="" width={13} height={13} style={{ opacity: 0.85, flexShrink: 0 }} />
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            @{a.handle ?? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>chưa có handle</span>}
                          </span>
                        </div>
                        {(a.email || a.tags.length > 0) && (
                          <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                            {a.email}{a.email && a.tags.length > 0 ? ' · ' : ''}{a.tags.slice(0, 3).join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Platform */}
                    <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)' }}>
                      {a.platformKey || '—'}
                    </td>
                    {/* Status */}
                    <td style={{ ...TD }}>
                      <Pill color={sm.color} label={sm.label} tone="soft" size="xs" mono uppercase
                            title={a.blockReason ? `${sm.hint}\n⚠ ${a.blockReason}` : sm.hint} />
                    </td>
                    {/* Unread messages (ext-scraped khi đã login) */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                      {a.unreadMessages && a.unreadMessages > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--warn)', fontWeight: 700 }}
                              title={`✉ ${a.unreadMessages} tin nhắn chưa đọc${a.unreadAt ? `\nQuét lúc ${fmtAgoShort(new Date(a.unreadAt).getTime())} trước` : ''}`}>
                          ✉ {a.unreadMessages}
                        </span>
                      ) : a.unreadMessages === 0 ? (
                        <span style={{ color: 'var(--fg-4)' }} title={`Đã đọc hết${a.unreadAt ? ` · quét ${fmtAgoShort(new Date(a.unreadAt).getTime())} trước` : ''}`}>0</span>
                      ) : <span style={{ color: 'var(--fg-4)' }} title="Chưa quét (ext chưa thấy account này đăng nhập)">—</span>}
                    </td>
                    {/* Warmup */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {wp ? (
                        <span style={{ color: wp.done === wp.total ? 'var(--ok)' : 'var(--warn)' }}
                              title={`Warm-up: ${wp.done}/${wp.total} mục hoàn tất`}>
                          {wp.done}/{wp.total}
                        </span>
                      ) : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                    </td>
                    {/* Briefs */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11,
                                 color: m.briefs > 0 ? 'var(--accent)' : 'var(--fg-4)', fontWeight: m.briefs > 0 ? 700 : 400 }}
                        title={m.briefs > 0 ? `${m.briefs} brief đang seed · ${m.backlog} nháp chờ` : 'Chưa gán brief'}>
                      {m.briefs || '—'}
                    </td>
                    {/* Habitats */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                                 color: m.habitats > 0 ? 'var(--fg-1)' : 'var(--fg-4)' }}
                        title={`${m.habitats} community distinct account này seeding`}>
                      {m.habitats || '—'}
                    </td>
                    {/* Posts */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                                 color: m.posts > 0 ? '#60a5fa' : 'var(--fg-4)', fontWeight: m.posts > 0 ? 700 : 400 }}
                        title={m.posts > 0 ? `${m.posts} bài đã đăng` : 'Chưa có bài đăng'}>
                      {m.posts > 0 ? `📨${fmtCompactNum(m.posts)}` : '—'}
                    </td>
                    {/* Last seed */}
                    <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}
                        title={m.lastSeededAt ? new Date(m.lastSeededAt).toLocaleString() : 'Chưa seed lần nào'}>
                      {m.lastSeededAt ? `⏱${fmtAgoShort(m.lastSeededAt)}` : '—'}
                    </td>
                    {/* Cost */}
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                                 color: a.monthlyCost > 0 ? 'var(--fg-1)' : 'var(--fg-4)' }}
                        title={a.monthlyCost > 0 ? `$${a.monthlyCost}/tháng` : 'Miễn phí'}>
                      {a.monthlyCost > 0 ? `$${a.monthlyCost}` : '—'}
                    </td>
                    {/* Flags */}
                    <td style={{ ...TD, fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--fg-3)' }}>
                        {a.has2fa && <span title="2FA bật">🔒</span>}
                        {a.hasApiToken && <span title="Có API token">🔑</span>}
                        {a.collectStats && <span title="Thu thập stats tự động">📊</span>}
                        {owner && <span title={`Giao cho ${owner}`} style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>👤{owner.split(' ')[0]}</span>}
                        {!a.has2fa && !a.hasApiToken && !a.collectStats && !owner && <span style={{ color: 'var(--fg-4)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)' }}>
                <td style={{ padding: '7px 8px', fontWeight: 700 }}>{totals.count} account</td>
                <td colSpan={3} style={{ padding: '7px 8px' }} />
                <td style={{ padding: '7px 8px', textAlign: 'center' }} title="Tổng brief">{totals.briefs || '—'}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }} title="Community distinct (visible)">{totals.habitats || '—'}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }} title="Tổng posts">{totals.posts ? `📨${fmtCompactNum(totals.posts)}` : '—'}</td>
                <td style={{ padding: '7px 8px' }} />
                <td style={{ padding: '7px 8px', textAlign: 'right' }} title="Tổng chi phí/tháng">{totals.cost > 0 ? `$${totals.cost}` : '—'}</td>
                <td style={{ padding: '7px 8px' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
