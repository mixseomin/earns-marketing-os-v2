'use client';

// Per-project backlink task surface (CRM-style, /p/[id]/backlinks). Lists the backlink
// sources that apply to THIS project's site (membership = site_status[slug]) and lets the
// admin assign each to a team user (→ ext /api/ext/my-tasks) and track per-site status +
// the live placed URL. A source is shared across sites; here we focus on this site.
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { wrapExternalUrl } from '@/lib/external-url';
import { setBacklinkSite, setBacklinkSchedule } from '@/lib/actions/architecture';
import { AssigneeCell } from '@/components/assignee-chip';
import { AccountFormModal } from '@/components/accounts-vault';
import { StatusSegmented, MonthCalendar, ViewToggle, LIST_CALENDAR_VIEWS, type CalItem } from '@/components/ui';
import { searchBacklinkMedia, attachBacklinkMedia, generateBacklinkMedia, autoPrepareProjectMedia, deleteBacklinkMedia } from '@/lib/actions/backlink-media';
import type { PhotoCandidate } from '@/lib/stock-photos';
import { READINESS_META, type ReadinessBucket } from '@/lib/backlink-account-type';
import type { BacklinkTask } from '@/lib/actions/backlink-tasks';
import type { PlatformRow, AccountRow, MediaRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import type { ProxyRow, BrowserProfileRow } from '@/lib/actions/environments';
import type { TeamMemberRow } from '@/lib/actions/team';

type TabKey = 'todo' | 'progress' | 'done' | 'all';

const SITE_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'To do',      color: '#8a92a3' },
  claimed:   { label: 'In progress', color: '#ffb03c' },
  completed: { label: 'Completed',  color: '#5badff' },
  verified:  { label: 'Verified',   color: '#22c55e' },
};
const STATUS_ORDER = ['pending', 'claimed', 'completed', 'verified'];
const tabOf = (s: string): TabKey => (s === 'pending' ? 'todo' : s === 'claimed' ? 'progress' : 'done');

const EXT = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };
const chip = (c: string, on: boolean): CSSProperties => ({ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${on ? c : 'var(--line)'}`, background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'transparent', color: on ? c : 'var(--fg-3)' });

function Pill({ status }: { status: string }) {
  const m = SITE_STATUS[status] || { label: status, color: 'var(--fg-2)' };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: `color-mix(in srgb, ${m.color} 18%, transparent)`, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</span>;
}
function Tag({ children, color = 'var(--fg-3)' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-3)', color, whiteSpace: 'nowrap' }}>{children}</span>;
}

// Draft comes authored as Markdown. Derive HTML + plain so each platform gets the
// right paste format (Markdown → dev.to/Reddit, HTML → forum/WP, Plain → comment/bio).
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inlineHtml = (s: string) => escHtml(s)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/_([^_]+)_/g, '<em>$1</em>');
function mdToHtml(md: string): string {
  return md.trim().split(/\n{2,}/).map((b) => {
    const h = b.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = h[1]!.length; return `<h${n}>${inlineHtml(h[2]!)}</h${n}>`; }
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>\n${lines.map((l) => `  <li>${inlineHtml(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('\n')}\n</ul>`;
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) return `<ol>\n${lines.map((l) => `  <li>${inlineHtml(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('\n')}\n</ol>`;
    return `<p>${inlineHtml(b.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}
const mdToPlain = (md: string): string => md
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/_([^_]+)_/g, '$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  .replace(/^\s*[-*]\s+/gm, '• ')
  .trim();
// What media each platform needs at posting time — so it's prepared, not scrambled for.
// Keyed by canonical platform key; platforms not listed need no media.
const MEDIA_NEED: Record<string, { label: string; hint: string; field: string }> = {
  devto:       { label: 'Cover image', field: 'cover', hint: 'Ảnh cover ngang (~1000×420). Có thể dùng nút Generate Image của dev.to.' },
  medium:      { label: 'Cover image', field: 'cover', hint: 'Ảnh đầu bài (~1500×750).' },
  hackernoon:  { label: 'Cover image', field: 'cover', hint: 'Ảnh cover bài explainer.' },
  substack:    { label: 'Cover image', field: 'cover', hint: 'Ảnh header cho issue.' },
  linkedin:    { label: 'Cover + logo', field: 'cover', hint: 'Ảnh cho article + logo cho LinkedIn Page.' },
  producthunt: { label: 'Screenshots', field: 'screenshot', hint: '2-3 ảnh gallery: homepage + 1 calculator. Thumbnail + logo.' },
  softpedia:   { label: 'Screenshots', field: 'screenshot', hint: '2-3 screenshot app cho editorial.' },
  alternativeto:{ label: 'Logo + screenshot', field: 'screenshot', hint: 'Logo + 1-2 screenshot.' },
  saashub:     { label: 'Logo + screenshot', field: 'screenshot', hint: 'Logo + 1-2 screenshot.' },
  crunchbase:  { label: 'Logo', field: 'logo', hint: 'Logo công ty (militarycalc.com/logo.png).' },
  webcatalog:  { label: 'Logo + screenshot', field: 'screenshot', hint: 'Logo app + 1 screenshot.' },
  slant:       { label: 'Screenshot', field: 'screenshot', hint: '1 screenshot minh hoạ option.' },
  pinterest:   { label: 'Infographic Pins', field: 'infographic', hint: 'Pin dọc 2:3 (~1000×1500) — checklist/infographic.' },
  youtube:     { label: 'Thumbnail + video', field: 'thumbnail', hint: 'Thumbnail 1280×720 + bản screen-record.' },
  flipboard:   { label: 'Cover ảnh', field: 'cover', hint: 'Ảnh bìa magazine + ảnh cho Notes.' },
};

type DraftFmt = 'md' | 'html' | 'plain';
const DRAFT_FMTS: { k: DraftFmt; label: string; hint: string }[] = [
  { k: 'md', label: 'Markdown', hint: 'dev.to · Reddit · Medium' },
  { k: 'html', label: 'HTML', hint: 'forum · WordPress' },
  { k: 'plain', label: 'Plain', hint: 'comment · bio · profile' },
];

// Backup plans for the link itself — some platforms/moments allow a real link, some
// strip markup, some ban links (or a new account can't post one yet). Applied to the
// Markdown source BEFORE formatting.
type LinkMode = 'link' | 'bare' | 'brand';
const LINK_MODES: { k: LinkMode; label: string; hint: string }[] = [
  { k: 'link', label: '🔗 Link', hint: 'Platform cho dofollow / link tự do' },
  { k: 'bare', label: '🔓 Bare URL', hint: 'Markdown bị strip → URL trần, tự auto-link' },
  { k: 'brand', label: '🏷 Brand', hint: 'Link bị chặn / account mới → nhắc brand, thêm link sau khi có trust' },
];
function applyLink(md: string, mode: LinkMode): string {
  if (mode === 'link') return md;
  // [anchor](url) → "anchor url" (bare) or "anchor (host)" (brand, no clickable link)
  let s = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, a: string, u: string) => mode === 'bare' ? `${a} ${u}` : `${a} (${hostOf(u)})`);
  // loose bare urls → keep (bare) or reduce to host (brand)
  s = s.replace(/https?:\/\/[^\s)]+/g, (u) => mode === 'bare' ? u : hostOf(u));
  return s;
}

// Render build steps as dash bullets. Splits on newlines first (new format); falls
// back to splitting a single-line "1) … 2) …" recipe (legacy).
const stripMarker = (s: string) => s.replace(/^\s*[-*•–]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim();
function Steps({ text }: { text: string }) {
  let items = text.split('\n').map(stripMarker).filter(Boolean);
  if (items.length <= 1) {
    const parts = text.split(/\s*(?=\b\d+\)\s)/).map(stripMarker).filter(Boolean);
    if (parts.length >= 2) items = parts;
  }
  if (items.length <= 1) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg-1)' }}>{items[0] ?? text}</div>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((p, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--fg-1)' }}>
          <span style={{ color: 'var(--fg-4)', flexShrink: 0 }}>–</span><span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

// Account-readiness chip on a backlink card — is the platform account ready to post?
function AcctChip({ task, onClick }: { task: BacklinkTask; onClick: (e: React.MouseEvent) => void }) {
  const m = READINESS_META[task.readiness];
  const showHandle = (task.readiness === 'ready' || task.readiness === 'warming' || task.readiness === 'setup') && task.accountHandle;
  const label = showHandle ? task.accountHandle! : task.readiness === 'missing' ? 'need acct' : task.readiness === 'no-account' ? 'no acct' : m.label;
  const title = `${m.label}${task.platformLabel ? ' · ' + task.platformLabel : ''}${task.accountHandle ? ' · @' + task.accountHandle : ''}${task.accountStatus ? ' (' + task.accountStatus + ')' : ''}`;
  return (
    <span role="button" onClick={onClick} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, cursor: 'pointer', maxWidth: 132,
        background: `color-mix(in srgb, ${m.color} 15%, transparent)`, color: m.color, border: `1px solid color-mix(in srgb, ${m.color} 45%, transparent)` }}>
      <span>{m.icon}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  );
}

export function BacklinksPage({ projectId, slug, siteLabel, tasks, project, platforms, accounts, teamMembers, proxies, browserProfiles, media }: {
  projectId: string; slug: string | null; siteLabel: string; tasks: BacklinkTask[];
  project: Project; platforms: PlatformRow[]; accounts: AccountRow[];
  teamMembers: TeamMemberRow[]; proxies: ProxyRow[]; browserProfiles: BrowserProfileRow[]; media: MediaRow[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, start] = useTransition();
  // All view state initialises from the URL so tabs/filters/drawer are deep-linkable + refresh-safe.
  // Defaults (no URL params): Calendar view + All status.
  const initTab = (['todo', 'progress', 'done', 'all'] as const).find((t) => t === sp.get('tab')) ?? 'all';
  const [tab, setTab] = useState<TabKey>(initTab);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [follow, setFollow] = useState<string>(sp.get('follow') ?? '');   // dofollow filter
  const [traf, setTraf] = useState<string>(sp.get('traf') ?? '');          // traffic filter
  const [draftOnly, setDraftOnly] = useState(sp.get('draft') === '1');
  const [openId, setOpenId] = useState<number | null>(Number(sp.get('task')) || null);
  const [readyFilter, setReadyFilter] = useState<ReadinessBucket | ''>((sp.get('ready') as ReadinessBucket) || '');
  const [view, setView] = useState<'list' | 'calendar'>(sp.get('view') === 'list' ? 'list' : 'calendar');

  const openTask = (id: number) => setOpenId(id);
  const closeTask = () => setOpenId(null);

  // Single source of URL truth — reflect every view-changing state (shallow, no refetch).
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string | number | null | undefined) => { if (v) u.searchParams.set(k, String(v)); else u.searchParams.delete(k); };
    set('tab', tab === 'all' ? '' : tab);    // default (all) → clean URL
    set('q', q.trim());
    set('follow', follow);
    set('traf', traf);
    set('draft', draftOnly ? '1' : '');
    set('ready', readyFilter);
    set('view', view === 'list' ? 'list' : '');   // default (calendar) → clean URL
    set('task', openId);
    window.history.replaceState(null, '', u);
  }, [tab, q, follow, traf, draftOnly, readyFilter, view, openId]);

  // Create/edit a platform account in-place (no page jump). null = closed.
  const [acctModal, setAcctModal] = useState<{ account: AccountRow | null; platformKey?: string } | null>(null);
  const openCreateAccount = (platformKey: string) => setAcctModal({ account: null, platformKey });
  const openEditAccount = (account: AccountRow) => setAcctModal({ account });
  const [autoMedia, setAutoMedia] = useState<'busy' | string | null>(null);
  const doAutoMedia = async () => { setAutoMedia('busy'); const r = await autoPrepareProjectMedia(projectId, project.website || ''); setAutoMedia(r.ok ? `+${r.added} media` : (r.error || 'lỗi')); start(() => router.refresh()); setTimeout(() => setAutoMedia(null), 2500); };

  // Account-readiness rollup (prepare before posting): counts per bucket + the distinct
  // platforms still missing an account (deep-link to create each).
  const prep = useMemo(() => {
    const c: Record<ReadinessBucket, number> = { ready: 0, warming: 0, setup: 0, missing: 0, locked: 0, 'no-account': 0 };
    const missing = new Map<string, string>();
    for (const t of tasks) { c[t.readiness]++; if (t.readiness === 'missing' && t.platformKey) missing.set(t.platformKey, t.platformLabel || t.platformKey); }
    return { c, missing: [...missing.entries()] };
  }, [tasks]);

  // Chip click → open the task drawer (account section lives there). No page jump.
  const goAccount = (e: React.MouseEvent, t: BacklinkTask) => { e.stopPropagation(); openTask(t.id); };

  const kpi = useMemo(() => {
    const k = { total: tasks.length, todo: 0, progress: 0, done: 0 };
    for (const t of tasks) { const tb = tabOf(t.siteState); if (tb === 'todo') k.todo++; else if (tb === 'progress') k.progress++; else k.done++; }
    return k;
  }, [tasks]);

  // Shared filter predicate (search + attribute filters). Tab (status) applied separately
  // so BOTH the list and the calendar honour the same filters — "global" filtering.
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (tab !== 'all' && tabOf(t.siteState) !== tab) return false;
      if (follow && (t.dofollow || '') !== follow) return false;
      if (traf && (t.traffic || '') !== traf) return false;
      if (draftOnly && !t.hasDraft) return false;
      if (readyFilter && t.readiness !== readyFilter) return false;
      if (s && !(t.title.toLowerCase().includes(s) || (t.sourceUrl || '').toLowerCase().includes(s))) return false;
      return true;
    });
  }, [tasks, tab, follow, traf, draftOnly, q, readyFilter]);

  const shown = useMemo(() => (tab === 'todo'
    ? [...filtered].sort((a, b) => Number(!!a.assignedUserId) - Number(!!b.assignedUserId))
    : filtered), [filtered, tab]);

  // Calendar items from the SAME filtered set: done → solid on done date; scheduled-not-done → dim.
  const calItems = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    for (const t of filtered) {
      const label = t.sourceUrl ? hostOf(t.sourceUrl) : t.title;
      if (t.siteDoneAt) out.push({ id: t.id, date: t.siteDoneAt.slice(0, 10), label, color: '#22c55e', title: `✓ ${t.title}` });
      else if (t.siteScheduledAt) out.push({ id: t.id, date: t.siteScheduledAt, label, dim: true, color: '#ffb03c', title: `🗓 ${t.title}` });
    }
    return out;
  }, [filtered]);

  const open = openId != null ? tasks.find((t) => t.id === openId) ?? null : null;

  const setSite = async (taskId: number, status: string, url: string) => {
    if (!slug) return;
    await setBacklinkSite(taskId, slug, status, url);
    start(() => router.refresh());
  };
  const setSchedule = async (taskId: number, date: string) => {
    if (!slug) return;
    await setBacklinkSchedule(taskId, slug, date);
    start(() => router.refresh());
  };

  if (!slug) {
    return (
      <div style={{ padding: 24, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Project này chưa phải site theo dõi backlink. Thêm site vào <code>BACKLINK_SITES</code> (lib/backlink-sites.ts) để bật.
      </div>
    );
  }

  const TabBtn = ({ k, label, n }: { k: TabKey; label: string; n?: number }) => (
    <button type="button" onClick={() => setTab(k)} style={{ ...btn, fontWeight: tab === k ? 700 : 500, borderColor: tab === k ? 'var(--neon-cyan)' : 'var(--line)', background: tab === k ? 'color-mix(in srgb, var(--neon-cyan) 12%, transparent)' : 'var(--bg-2)', color: tab === k ? 'var(--neon-cyan)' : 'var(--fg-2)' }}>
      {label}{n != null ? <span style={{ marginLeft: 6, opacity: 0.75 }}>{n}</span> : null}
    </button>
  );

  return (
    <div style={{ padding: '12px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, margin: 0 }}>
          Backlinks <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 8 }}>// {siteLabel} · {kpi.total} sources</small>
        </h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={doAutoMedia} disabled={autoMedia === 'busy'} style={{ ...btn, color: 'var(--accent)' }}
            title="Tự chuẩn bị media: cover OG + screenshot trang + logo → lưu vào Media vault">
            {autoMedia === 'busy' ? '⏳ đang chuẩn bị…' : autoMedia ? `✓ ${autoMedia}` : '⚡ Auto media'}
          </button>
          <a href={`/architecture?obj=backlink&site=${slug}`} style={{ ...btn, textDecoration: 'none' }} title="Mở bird's-eye cross-project trong Architect">↗ Architect</a>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {([['total', 'Total', 'var(--fg-1)'], ['todo', 'To do', '#8a92a3'], ['progress', 'In progress', '#ffb03c'], ['done', 'Done', '#22c55e']] as const).map(([k, label, c]) => (
          <div key={k} style={{ flex: '1 1 90px', minWidth: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: 'var(--font-mono)' }}>{kpi[k]}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* account-readiness rollup — click a bucket to filter the list below */}
      <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)', fontSize: 11 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 9.5 }}>Accounts</span>
          {(['ready', 'missing', 'warming', 'setup', 'locked', 'no-account'] as ReadinessBucket[]).map((b) => prep.c[b] ? (
            <button key={b} type="button" onClick={() => setReadyFilter((v) => v === b ? '' : b)}
              title={`Lọc: ${READINESS_META[b].label}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, cursor: 'pointer', color: READINESS_META[b].color,
                border: `1px solid ${readyFilter === b ? READINESS_META[b].color : 'transparent'}`, background: readyFilter === b ? `color-mix(in srgb, ${READINESS_META[b].color} 18%, transparent)` : 'transparent' }}>
              {READINESS_META[b].icon} {prep.c[b]} {b === 'no-account' ? 'email-only' : b === 'missing' ? 'need acct' : b}
            </button>
          ) : null)}
          {readyFilter && <button type="button" onClick={() => setReadyFilter('')} style={{ ...btn, marginLeft: 'auto', padding: '1px 8px' }}>✕ bỏ lọc</button>}
        </div>
        {/* when filtering to "need acct", also offer the create-account buttons per platform */}
        {readyFilter === 'missing' && prep.missing.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--fg-4)', fontSize: 9.5 }}>Tạo nhanh:</span>
            {prep.missing.map(([k, label]) => (
              <button key={k} type="button" onClick={() => openCreateAccount(k)} style={{ ...btn, color: 'var(--accent)' }}>➕ {label}</button>
            ))}
          </div>
        )}
      </div>

      {/* tabs + filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TabBtn k="todo" label="To do" n={kpi.todo} />
        <TabBtn k="progress" label="In progress" n={kpi.progress} />
        <TabBtn k="done" label="Done" n={kpi.done} />
        <TabBtn k="all" label="All" n={kpi.total} />
        <ViewToggle style={{ marginLeft: 'auto' }} options={LIST_CALENDAR_VIEWS} value={view} onChange={(v) => setView(v as 'list' | 'calendar')} />
      </div>

      {/* filters — apply to BOTH list & calendar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm nguồn / source…" autoComplete="off"
          style={{ ...btn, flex: '1 1 160px', minWidth: 140, cursor: 'text', background: 'var(--bg-1)' }} />
        {['dofollow', 'nofollow', 'mixed'].map((f) => <button key={f} type="button" onClick={() => setFollow(follow === f ? '' : f)} style={chip('#9d6cff', follow === f)}>{f}</button>)}
        <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
        {['high', 'medium', 'low'].map((f) => <button key={f} type="button" onClick={() => setTraf(traf === f ? '' : f)} style={chip('#22c55e', traf === f)}>{f}</button>)}
        <button type="button" onClick={() => setDraftOnly((v) => !v)} style={chip('#3c9bff', draftOnly)}>📋 ready</button>
        {(q || follow || traf || draftOnly) && <button type="button" onClick={() => { setQ(''); setFollow(''); setTraf(''); setDraftOnly(false); }} style={btn}>Clear</button>}
      </div>

      {view === 'calendar' ? (
        <MonthCalendar items={calItems} onItemClick={(id) => openTask(Number(id))} />
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((t) => (
          <div key={t.id} onClick={() => openTask(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {t.sourceUrl && <a href={wrapExternalUrl(t.sourceUrl)} {...EXT} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(t.sourceUrl)}</a>}
                {t.da && <Tag>DA {t.da}</Tag>}
                {t.dofollow && <Tag color="#9d6cff">{t.dofollow}</Tag>}
                {t.traffic && <Tag color="#22c55e">{t.traffic}</Tag>}
                {t.hasDraft && <Tag color="#3c9bff">📋 draft</Tag>}
                {t.siteScheduledAt && !t.siteDoneAt && <Tag color="#ffb03c">🗓 {t.siteScheduledAt}</Tag>}
                {t.siteDoneAt && <Tag color="#22c55e">✓ {t.siteDoneAt.slice(0, 10)}</Tag>}
                {t.appliesTo.length > 1 && <Tag>+{t.appliesTo.length - 1} sites</Tag>}
              </div>
            </div>
            <AcctChip task={t} onClick={(e) => goAccount(e, t)} />
            <div onClick={(e) => e.stopPropagation()}><AssigneeCell taskId={t.id} name={t.assignee || ''} assignedId={t.assignedUserId} onChange={() => start(() => router.refresh())} /></div>
            <Pill status={t.siteState} />
            {t.siteLiveUrl && <a href={wrapExternalUrl(t.siteLiveUrl)} {...EXT} onClick={(e) => e.stopPropagation()} title="Live backlink" style={{ fontSize: 11, color: 'var(--ok)' }}>live ↗</a>}
          </div>
        ))}
        {!shown.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Không có task ở tab này.</div>}
      </div>
      )}

      {open && <Drawer task={open} slug={slug} project={project} accounts={accounts} media={media} onClose={closeTask} setSite={setSite} setSchedule={setSchedule} onChange={() => start(() => router.refresh())} onCreateAccount={openCreateAccount} onEditAccount={openEditAccount} />}

      {/* Account create/edit in-place — stacks above the drawer (.modal-backdrop is z-100). */}
      {acctModal && (
        <div style={{ position: 'relative', zIndex: 300 }}>
          <AccountFormModal account={acctModal.account} project={project} projectId={projectId}
            platforms={platforms} presetPlatformKey={acctModal.platformKey}
            teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles}
            onClose={() => { setAcctModal(null); start(() => router.refresh()); }} />
        </div>
      )}
    </div>
  );
}

function Drawer({ task, slug, project, accounts, media, onClose, setSite, setSchedule, onChange, onCreateAccount, onEditAccount }: {
  task: BacklinkTask; slug: string; project: Project; accounts: AccountRow[]; media: MediaRow[]; onClose: () => void; setSite: (id: number, status: string, url: string) => Promise<void>; setSchedule: (id: number, date: string) => Promise<void>; onChange: () => void;
  onCreateAccount: (platformKey: string) => void; onEditAccount: (account: AccountRow) => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Saving a live URL = the backlink is placed → auto-advance an open status to Completed.
  const saveUrl = async () => {
    setSaveState('saving');
    const next = (url.trim() && (task.siteState === 'pending' || task.siteState === 'claimed')) ? 'completed' : task.siteState;
    await setSite(task.id, next, url);
    setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1800);
  };
  const mediaNeed = task.platformKey ? MEDIA_NEED[task.platformKey] : undefined;
  const imgs = media.filter((m) => (m.mimeType || '').startsWith('image') || m.kind === 'image');
  // Already-saved stock origins → dedup: don't re-show a candidate we've already saved.
  const savedOrigins = useMemo(() => new Set(imgs.flatMap((m) => (m.tags || []).filter((t) => t.startsWith('origin:')).map((t) => t.slice(7)))), [imgs]);
  // In-drawer media prep — search stock / AI-gen, save to project media (no page jump).
  const [mq, setMq] = useState(project.name);
  const [cands, setCands] = useState<PhotoCandidate[] | null>(null);
  const [mbusy, setMbusy] = useState<'search' | 'ai' | number | null>(null);
  const [merr, setMerr] = useState<string | null>(null);
  const [delId, setDelId] = useState<number | null>(null);   // media pending delete-confirm
  const doDelMedia = async (id: number) => { setDelId(null); await deleteBacklinkMedia(project.id, id); onChange(); };
  const visibleCands = cands ? cands.filter((c) => !savedOrigins.has(c.url)) : null;
  const doSearch = async () => { setMbusy('search'); setMerr(null); const r = await searchBacklinkMedia(mq); setMbusy(null); r.ok ? setCands(r.candidates!) : setMerr(r.error || 'lỗi'); };
  const doAI = async () => { if (!mediaNeed) return; setMbusy('ai'); setMerr(null); const r = await generateBacklinkMedia(project.id, mq, mediaNeed.field); setMbusy(null); if (r.ok) { onChange(); } else setMerr(r.error || 'lỗi'); };
  // Save a candidate → remove just it from the grid (hide saved), keep results open for more.
  const pick = async (c: PhotoCandidate, i: number) => { if (!mediaNeed) return; setMbusy(i); setMerr(null); const r = await attachBacklinkMedia(project.id, c.url, mediaNeed.field); setMbusy(null); if (r.ok) { setCands((cs) => (cs ? cs.filter((x) => x.url !== c.url) : cs)); onChange(); } else setMerr(r.error || 'lỗi'); };
  const acctObj = task.accountId != null ? accounts.find((a) => a.id === task.accountId) ?? null : null;
  const [url, setUrl] = useState(task.siteLiveUrl || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fmt, setFmt] = useState<DraftFmt>('md');
  const [linkMode, setLinkMode] = useState<LinkMode>('link');
  const draftFmts = useMemo(() => {
    if (!task.draft) return null;
    const src = applyLink(task.draft, linkMode);
    return { md: src, html: mdToHtml(src), plain: mdToPlain(src) };
  }, [task.draft, linkMode]);
  const copy = (txt: string, key: string) => { navigator.clipboard?.writeText(txt).then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1200); }).catch(() => {}); };
  const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 0 4px' };
  // Paste kit — the reusable brand copy the instructions refer to ("paste the 160-char
  // desc", tagline, logo). Source of truth = the project record (one_liner / bio / website).
  const kit = [
    { key: 'url', label: 'Website URL', val: project.website || '' },
    { key: 'desc', label: 'Mô tả (one-liner)', val: project.oneLiner || '' },
    { key: 'bio', label: 'Bio (dài)', val: project.bio || '' },
    { key: 'logo', label: 'Logo URL', val: project.website ? `${project.website.replace(/\/$/, '')}/logo.png` : '' },
  ].filter((k) => k.val);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)' }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201, width: 'min(720px, 96vw)', background: 'var(--bg-1)', borderLeft: '1px solid var(--line-2)', boxShadow: '-12px 0 40px rgba(0,0,0,.5)', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{task.title}</h2>
          <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {task.sourceUrl && <a href={wrapExternalUrl(task.sourceUrl)} {...EXT} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(task.sourceUrl)}</a>}
          {task.da && <Tag>DA {task.da}</Tag>}
          {task.dofollow && <Tag color="#9d6cff">{task.dofollow}</Tag>}
          {task.traffic && <Tag color="#22c55e">{task.traffic}</Tag>}
          {task.rank && <Tag color="#ffb03c">rank {task.rank}</Tag>}
        </div>

        {/* Account readiness — phải có account platform trước khi post */}
        <div style={lbl}>Account · {task.platformLabel || 'platform ?'}</div>
        {task.readiness === 'no-account' ? (
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>✉ Nguồn này không cần account riêng — submit qua {task.mechanism || 'email / one-off'}.</div>
        ) : task.accountHandle ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>@{task.accountHandle}</span>
            <Tag color={READINESS_META[task.readiness].color}>{READINESS_META[task.readiness].icon} {task.accountStatus}</Tag>
            {task.has2fa && <Tag>🔐 2FA</Tag>}
            {task.authMethod && <Tag>{task.authMethod}</Tag>}
            {task.hasProxy && <Tag color="#9d6cff">🌐 proxy</Tag>}
            {task.hasProfile && <Tag color="#5badff">🧭 profile</Tag>}
            {acctObj && <button type="button" onClick={() => onEditAccount(acctObj)} style={{ ...btn, padding: '2px 8px' }}>→ Mở account</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ color: READINESS_META.missing.color }}>➕ Chưa có account trên {task.platformLabel}</span>
            {task.platformKey && <button type="button" onClick={() => onCreateAccount(task.platformKey!)} style={{ ...btn, color: 'var(--accent)', fontWeight: 700 }}>+ Tạo account</button>}
          </div>
        )}

        <div style={lbl}>Assign to</div>
        <AssigneeCell taskId={task.id} name={task.assignee || ''} assignedId={task.assignedUserId} onChange={onChange} />

        <div style={lbl}>Status @ {slug}</div>
        <StatusSegmented size="md" value={task.siteState}
          options={STATUS_ORDER.map((s) => ({ value: s, label: SITE_STATUS[s]?.label ?? s, color: SITE_STATUS[s]?.color ?? 'var(--fg-2)' }))}
          onChange={(s) => { void setSite(task.id, s, url); }} />

        <div style={lbl}>Live URL (link đã đặt được @ {slug})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoComplete="off"
            style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, boxSizing: 'border-box' }} />
          <button type="button" onClick={saveUrl} disabled={saveState === 'saving'}
            style={{ ...btn, fontWeight: 700, minWidth: 78, borderColor: saveState === 'saved' ? 'var(--ok)' : 'var(--line)', color: saveState === 'saved' ? 'var(--ok)' : 'var(--fg-1)' }}>
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ Đã lưu' : 'Lưu'}</button>
        </div>

        <div style={lbl}>Lịch & thời gian @ {slug}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--fg-2)' }}>
            🗓 Lên lịch
            <input type="date" value={task.siteScheduledAt || ''} onChange={(e) => setSchedule(task.id, e.target.value)}
              style={{ padding: '4px 6px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, colorScheme: 'dark' }} />
          </label>
          {task.siteDoneAt
            ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Hoàn thành {fmtWhen(task.siteDoneAt)}</span>
            : <span style={{ color: 'var(--fg-4)' }}>chưa hoàn thành</span>}
        </div>

        {/* Paste kit — nguồn cho "paste bản mô tả 160 ký tự" v.v. Lấy từ project record. */}
        {kit.length > 0 && (<>
          <div style={{ ...lbl, marginTop: 16 }}>📎 Paste kit <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--fg-4)' }}>· từ hồ sơ {project.name}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {kit.map((k) => (
              <div key={k.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label} <span style={{ textTransform: 'none' }}>· {k.val.length} ký tự</span></div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', wordBreak: 'break-word' }}>{k.val}</div>
                </div>
                <button type="button" onClick={() => copy(k.val, k.key)} style={{ ...btn, padding: '2px 8px', flexShrink: 0 }}>{copiedKey === k.key ? '✓' : 'Copy'}</button>
              </div>
            ))}
          </div>
        </>)}

        {/* Media cần chuẩn bị trước khi post — tìm stock / AI-gen NGAY tại đây, lưu vào project media */}
        {mediaNeed && (<>
          <div style={{ ...lbl, marginTop: 16 }}>🖼 Media · {mediaNeed.label}</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 6 }}>{mediaNeed.hint}</div>
          {imgs.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {imgs.map((m) => (
                <div key={m.id} style={{ width: 96 }}>
                  <div style={{ position: 'relative' }}>
                    <a href={wrapExternalUrl(m.url)} {...EXT} title={m.filename}>
                      <img src={m.url} alt={m.filename} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} />
                    </a>
                    {delId === m.id ? (
                      <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#fff' }}>Xoá ảnh?</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" onClick={() => doDelMedia(m.id)} style={{ ...btn, padding: '1px 8px', fontSize: 10, borderColor: 'var(--bad,#ef4444)', color: '#fff', background: 'var(--bad,#ef4444)' }}>Xoá</button>
                          <button type="button" onClick={() => setDelId(null)} style={{ ...btn, padding: '1px 8px', fontSize: 10 }}>Huỷ</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDelId(m.id)} title="Xoá ảnh" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, lineHeight: '16px', textAlign: 'center', padding: 0, borderRadius: 4, border: '1px solid var(--line)', background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', fontSize: 11 }}>✕</button>
                    )}
                  </div>
                  <button type="button" onClick={() => copy(m.url, `media-${m.id}`)} style={{ ...btn, padding: '1px 6px', marginTop: 3, width: '100%', fontSize: 10 }}>{copiedKey === `media-${m.id}` ? '✓' : 'Copy URL'}</button>
                </div>
              ))}
            </div>
          )}
          {/* picker: search stock or AI-gen */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="từ khoá ảnh…" autoComplete="off"
              style={{ flex: '1 1 160px', minWidth: 120, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, boxSizing: 'border-box' }} />
            <button type="button" onClick={doSearch} disabled={mbusy === 'search'} style={{ ...btn }}>{mbusy === 'search' ? '…' : '🔍 Tìm stock'}</button>
            <button type="button" onClick={doAI} disabled={mbusy === 'ai'} style={{ ...btn }}>{mbusy === 'ai' ? '…' : '✨ AI tạo'}</button>
          </div>
          {merr && <div style={{ fontSize: 11, color: 'var(--bad,#ef4444)', marginTop: 4 }}>{merr}</div>}
          {visibleCands && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {visibleCands.length === 0 && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Không có kết quả mới.</span>}
              {visibleCands.map((c, i) => (
                <button key={c.url} type="button" onClick={() => pick(c, i)} disabled={mbusy === i} title={`${c.provider} — bấm để lưu`}
                  style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', cursor: 'pointer', position: 'relative' }}>
                  <img src={c.url} alt={c.provider} style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 5, display: 'block', opacity: mbusy === i ? 0.4 : 1 }} />
                  {mbusy === i && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--fg-0)' }}>lưu…</span>}
                </button>
              ))}
            </div>
          )}
        </>)}

        {task.instructions && (<>
          <div style={{ ...lbl, color: 'var(--accent)', fontSize: 11, marginTop: 16 }}>🛠 Cách build</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px' }}><Steps text={task.instructions} /></div>
        </>)}

        {draftFmts && (<>
          <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>📋 Draft (paste-ready)</span>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              {DRAFT_FMTS.map((f) => (
                <button key={f.k} type="button" onClick={() => setFmt(f.k)} title={f.hint}
                  style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                    border: `1px solid ${fmt === f.k ? 'var(--accent)' : 'var(--line)'}`, background: fmt === f.k ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent', color: fmt === f.k ? 'var(--accent)' : 'var(--fg-3)' }}>{f.label}</button>
              ))}
            </span>
            <button type="button" onClick={() => copy(draftFmts[fmt], 'draft')} style={{ ...btn, padding: '1px 8px', marginLeft: 'auto' }}>{copiedKey === 'draft' ? '✓ copied' : 'Copy'}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '2px 0' }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Link</span>
            {LINK_MODES.map((m) => (
              <button key={m.k} type="button" onClick={() => setLinkMode(m.k)} title={m.hint}
                style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${linkMode === m.k ? '#9d6cff' : 'var(--line)'}`, background: linkMode === m.k ? 'color-mix(in srgb, #9d6cff 16%, transparent)' : 'transparent', color: linkMode === m.k ? '#9d6cff' : 'var(--fg-3)' }}>{m.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-4)', margin: '-1px 0 4px' }}>{DRAFT_FMTS.find((f) => f.k === fmt)!.hint} · {LINK_MODES.find((m) => m.k === linkMode)!.hint}</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.5, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, margin: 0, fontFamily: 'var(--font-mono)' }}>{draftFmts[fmt]}</pre>
        </>)}

        {task.mechanism && (<><div style={lbl}>Mechanism</div><div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{task.mechanism}</div></>)}

        {task.appliesTo.length > 1 && (<><div style={lbl}>Cũng áp dụng cho ({task.appliesTo.length} sites)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{task.appliesTo.map((s) => { const st = task.siteStatus[s] || ''; return <Tag key={s} color={s === slug ? 'var(--accent)' : undefined}>{s} · {SITE_STATUS[st]?.label || st || '—'}</Tag>; })}</div></>)}

        {task.notes && (<><div style={lbl}>Notes</div><div style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'pre-wrap' }}>{task.notes}</div></>)}
      </div>
    </>
  );
}
