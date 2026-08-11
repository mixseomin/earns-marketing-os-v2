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
  MultiSelect, Segmented, EmptyState, Pill,
  SiteFavicon, DataTable, type DataColumn, type DataGroup,
} from './ui';
import { platformFaviconProps } from './ui/site-favicon';
import { accountStatColumns, DASH } from './account-metrics';

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

// Nhóm cột (ui.DataTable lo nút ⚙ bật/tắt + nhớ lựa chọn qua persistKey).
// YDNI: mặc định chỉ bật nhóm hay dùng; nhóm còn lại 1 click là hiện, không mất.
const COL_GROUPS: DataGroup[] = [
  { key: 'stats',   label: '📊 Chỉ số platform', color: '#5ec8e6', defaultOn: true },
  { key: 'seeding', label: '🌱 Seeding',         color: '#3ecf8e', defaultOn: true },
  { key: 'warmup',  label: '🔥 Warm-up',         color: '#f59e0b', defaultOn: true },
  { key: 'env',     label: '🛡 Môi trường',      color: '#9d6cff', defaultOn: false },
  { key: 'ops',     label: '🗂 Vận hành',        color: '#a1a1aa', defaultOn: false },
];


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

  // Count theo lens cho Segmented label.
  const lensCounts = useMemo(() => {
    let warmup = 0, health = 0;
    for (const a of accounts) {
      if (LENS_STATUSES.warmup.has(a.status)) warmup++;
      else if (LENS_STATUSES.health.has(a.status)) health++;
    }
    return { all: accounts.length, warmup, health };
  }, [accounts]);

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
    // Sort do DataTable lo (mỗi cột khai sortValue) → ở đây chỉ lọc, mặc định theo handle.
    return [...list].sort((a, b) => (a.handle || '').localeCompare(b.handle || ''));
  }, [accounts, lens, q, filterPlatforms, filterStatus, filterOwners]);

  const activeFilters = filterPlatforms.length + filterStatus.length + filterOwners.length;

  // Cột: 3 cột lõi luôn hiện, phần còn lại thuộc nhóm bật/tắt được (⚙ của DataTable).
  const met = (a: AccountRow) => metricsByAccount.get(a.id) ?? emptyMetrics;
  const columns: DataColumn<AccountRow>[] = [
    {
      key: 'account', header: 'Account', align: 'left', width: 240,
      sortValue: (a) => a.handle || '',
      cell: (a) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--fg-0)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {a.platformKey && <SiteFavicon {...platformFaviconProps(a.platformKey)} size={13} title={a.platformKey} style={{ opacity: 0.85 }} />}
            @{a.handle ?? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>chưa có handle</span>}
          </div>
          {(a.email || a.tags.length > 0) && (
            <div style={{ fontSize: 9.5, color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
              {a.email}{a.email && a.tags.length > 0 ? ' · ' : ''}{a.tags.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      ),
      total: (rs) => <b>{rs.length} account</b>,
    },
    { key: 'platform', header: 'Platform', align: 'left', sortValue: (a) => a.platformKey || '',
      cell: (a) => <span style={{ color: 'var(--fg-2)', fontSize: 10.5 }}>{a.platformKey || '—'}</span> },
    { key: 'status', header: 'Status', align: 'left', sortValue: (a) => a.status || '',
      cell: (a) => { const sm = accountStatusMeta(a.status); return (
        <Pill color={sm.color} label={sm.label} tone="soft" size="xs" mono uppercase
              title={a.blockReason ? `${sm.hint}\n⚠ ${a.blockReason}` : sm.hint} />
      ); } },

    // 📊 Chỉ số platform — 6 cột dùng chung với /environments (account-metrics.tsx).
    ...accountStatColumns<AccountRow>((a) => a.accountStats),

    // ── 🌱 Seeding (derive từ queue, không query thêm) ──
    { key: 'briefs', group: 'seeding', header: 'Briefs', align: 'center', title: 'brief đang seed (distinct)',
      sortValue: (a) => met(a).briefs,
      cell: (a) => { const m = met(a); return <span style={{ color: m.briefs ? 'var(--accent)' : 'var(--fg-4)', fontWeight: m.briefs ? 700 : 400 }}
        title={m.briefs ? `${m.briefs} brief · ${m.backlog} nháp chờ` : 'Chưa gán brief'}>{m.briefs || '—'}</span>; },
      total: (rs) => rs.reduce((s, a) => s + met(a).briefs, 0) || '—' },
    { key: 'habitats', group: 'seeding', header: 'Habitats', align: 'center', title: 'community distinct đang seeding',
      sortValue: (a) => met(a).habitats,
      cell: (a) => { const n = met(a).habitats; return <span style={{ color: n ? 'var(--fg-1)' : 'var(--fg-4)' }}>{n || '—'}</span>; },
      total: (rs) => { const ids = new Set(rs.map((a) => a.id)); const h = new Set<number>();
        for (const x of queue) if (ids.has(x.accountId)) h.add(x.habitatId); return h.size || '—'; } },
    { key: 'posts', group: 'seeding', header: 'Posts', align: 'center', title: 'tổng bài đã đăng (cross-brief)',
      sortValue: (a) => met(a).posts,
      cell: (a) => { const n = met(a).posts; return n ? <span style={{ color: '#60a5fa', fontWeight: 700 }}>📨{fmtCompactNum(n)}</span> : DASH; },
      total: (rs) => { const n = rs.reduce((s, a) => s + met(a).posts, 0); return n ? `📨${fmtCompactNum(n)}` : '—'; } },
    { key: 'backlog', group: 'seeding', header: 'Nháp', align: 'center', title: 'nháp chưa đăng',
      sortValue: (a) => met(a).backlog,
      cell: (a) => { const n = met(a).backlog; return n ? String(n) : DASH; } },
    { key: 'lastSeed', group: 'seeding', header: 'Seed', align: 'center', title: 'lần seed gần nhất',
      sortValue: (a) => met(a).lastSeededAt,
      cell: (a) => { const t = met(a).lastSeededAt; return t ? <span style={{ color: 'var(--fg-3)' }} title={new Date(t).toLocaleString()}>⏱{fmtAgoShort(t)}</span> : DASH; } },

    // ── 🔥 Warm-up + hộp thư ──
    { key: 'warmup', group: 'warmup', header: 'Warmup', align: 'center', title: 'checklist done/total — điều kiện đủ tuổi/karma global',
      sortValue: (a) => { const w = warmupProgress(a.warmupChecklist); return w ? w.done / w.total : null; },
      cell: (a) => { const w = warmupProgress(a.warmupChecklist); return w
        ? <span style={{ color: w.done === w.total ? 'var(--ok)' : 'var(--warn)' }}>{w.done}/{w.total}</span>
        : DASH; } },
    { key: 'unread', group: 'warmup', header: '✉', align: 'center', title: 'tin nhắn chưa đọc — ext quét khi account đang đăng nhập',
      sortValue: (a) => a.unreadMessages ?? -1,
      cell: (a) => a.unreadMessages && a.unreadMessages > 0
        ? <span style={{ color: 'var(--warn)', fontWeight: 700 }} title={a.unreadAt ? `quét ${fmtAgoShort(new Date(a.unreadAt).getTime())} trước` : undefined}>✉ {a.unreadMessages}</span>
        : <span style={{ color: 'var(--fg-4)' }}>{a.unreadMessages === 0 ? '0' : '—'}</span> },
    { key: 'followUp', group: 'warmup', header: 'Hẹn', align: 'center', title: 'ngày hẹn check verify/duyệt',
      sortValue: (a) => a.followUpAt || null,
      cell: (a) => a.followUpAt ? <span style={{ color: 'var(--fg-2)' }}>{a.followUpAt.slice(5)}</span> : DASH },

    // ── 🛡 Môi trường + credential (mặc định tắt) ──
    { key: 'proxy', group: 'env', header: 'Proxy', align: 'center', sortValue: (a) => (a.proxyId ? 1 : 0),
      cell: (a) => a.proxyId ? <span title={`proxy #${a.proxyId}`}>🛡</span> : DASH },
    { key: 'profile', group: 'env', header: 'Profile', align: 'center', sortValue: (a) => (a.browserProfileId ? 1 : 0),
      cell: (a) => a.browserProfileId ? <span title={`browser profile #${a.browserProfileId}`}>🦊</span> : DASH },
    { key: 'auth', group: 'env', header: 'Auth', align: 'left', sortValue: (a) => a.authMethod || '',
      cell: (a) => <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{a.authMethod || '—'}</span> },
    { key: 'creds', group: 'env', header: 'Creds', align: 'center', title: '🔒 2FA · 🔑 password · 🎫 API token',
      sortValue: (a) => (a.has2fa ? 4 : 0) + (a.hasPassword ? 2 : 0) + (a.hasApiToken ? 1 : 0),
      cell: (a) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {a.has2fa && <span title="2FA bật">🔒</span>}
          {a.hasPassword && <span title="Có password lưu (mở drawer → Advanced để xem)">🔑</span>}
          {a.hasApiToken && <span title="Có API token">🎫</span>}
          {!a.has2fa && !a.hasPassword && !a.hasApiToken && DASH}
        </span>
      ) },

    // ── 🗂 Vận hành (mặc định tắt) ──
    { key: 'type', group: 'ops', header: 'P/B/S', align: 'center', title: 'personal / brand / seeding',
      sortValue: (a) => a.accountType || '',
      cell: (a) => <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{a.accountType?.[0]?.toUpperCase() ?? '—'}</span> },
    { key: 'kind', group: 'ops', header: 'Kind', align: 'center', sortValue: (a) => a.accountKind || '',
      cell: (a) => <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{a.accountKind || '—'}</span> },
    { key: 'owner', group: 'ops', header: 'Owner', align: 'left', sortValue: (a) => (a.ownerUserId != null ? ownerName.get(a.ownerUserId) ?? '' : ''),
      cell: (a) => { const o = a.ownerUserId != null ? ownerName.get(a.ownerUserId) : null;
        return o ? <span style={{ fontSize: 10 }} title={`Giao cho ${o}`}>👤{o.split(' ')[0]}</span> : DASH; } },
    { key: 'cost', group: 'ops', header: '$/mo', align: 'right', sortValue: (a) => a.monthlyCost,
      cell: (a) => a.monthlyCost > 0 ? `$${a.monthlyCost}` : DASH,
      total: (rs) => { const c = rs.reduce((s, a) => s + a.monthlyCost, 0); return c > 0 ? `$${c}` : '—'; } },
    { key: 'collect', group: 'ops', header: '📊', align: 'center', title: 'thu thập stats tự động',
      sortValue: (a) => (a.collectStats ? 1 : 0),
      cell: (a) => a.collectStats ? <span title="Thu thập stats tự động">📊</span> : DASH },
  ];

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
        <DataTable<AccountRow>
          rows={rows}
          columns={columns}
          groups={COL_GROUPS}
          persistKey="acct-cols"
          getRowKey={(a) => String(a.id)}
          onRowClick={(a) => onOpenAccount(a.id)}
          rowTitle={(a) => `Mở chi tiết account: @${a.handle ?? a.id}`}
          minWidth={920}
        />
      )}
    </div>
  );
}
