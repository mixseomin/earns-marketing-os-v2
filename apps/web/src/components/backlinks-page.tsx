'use client';

// Per-project backlink task surface (CRM-style, /p/[id]/backlinks). Lists the backlink
// sources that apply to THIS project's site (membership = site_status[slug]) and lets the
// admin assign each to a team user (→ ext /api/ext/my-tasks) and track per-site status +
// the live placed URL. A source is shared across sites; here we focus on this site.
import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { wrapExternalUrl } from '@/lib/external-url';
import { setBacklinkSite } from '@/lib/actions/architecture';
import { AssigneeCell } from '@/components/assignee-chip';
import { AccountFormModal } from '@/components/accounts-vault';
import { READINESS_META, type ReadinessBucket } from '@/lib/backlink-account-type';
import type { BacklinkTask } from '@/lib/actions/backlink-tasks';
import type { PlatformRow, AccountRow } from '@/lib/data';
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

export function BacklinksPage({ projectId, slug, siteLabel, tasks, project, platforms, accounts, teamMembers, proxies, browserProfiles }: {
  projectId: string; slug: string | null; siteLabel: string; tasks: BacklinkTask[];
  project: Project; platforms: PlatformRow[]; accounts: AccountRow[];
  teamMembers: TeamMemberRow[]; proxies: ProxyRow[]; browserProfiles: BrowserProfileRow[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [tab, setTab] = useState<TabKey>('todo');
  const [q, setQ] = useState('');
  const [follow, setFollow] = useState<string>('');   // dofollow filter
  const [traf, setTraf] = useState<string>('');        // traffic filter
  const [draftOnly, setDraftOnly] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  // Create/edit a platform account in-place (no page jump). null = closed.
  const [acctModal, setAcctModal] = useState<{ account: AccountRow | null; platformKey?: string } | null>(null);
  const openCreateAccount = (platformKey: string) => setAcctModal({ account: null, platformKey });
  const openEditAccount = (account: AccountRow) => setAcctModal({ account });

  // Account-readiness rollup (prepare before posting): counts per bucket + the distinct
  // platforms still missing an account (deep-link to create each).
  const prep = useMemo(() => {
    const c: Record<ReadinessBucket, number> = { ready: 0, warming: 0, setup: 0, missing: 0, locked: 0, 'no-account': 0 };
    const missing = new Map<string, string>();
    for (const t of tasks) { c[t.readiness]++; if (t.readiness === 'missing' && t.platformKey) missing.set(t.platformKey, t.platformLabel || t.platformKey); }
    return { c, missing: [...missing.entries()] };
  }, [tasks]);

  // Chip click → open the task drawer (account section lives there). No page jump.
  const goAccount = (e: React.MouseEvent, t: BacklinkTask) => { e.stopPropagation(); setOpenId(t.id); };

  const kpi = useMemo(() => {
    const k = { total: tasks.length, todo: 0, progress: 0, done: 0 };
    for (const t of tasks) { const tb = tabOf(t.siteState); if (tb === 'todo') k.todo++; else if (tb === 'progress') k.progress++; else k.done++; }
    return k;
  }, [tasks]);

  const shown = useMemo(() => {
    let rows = tasks.filter((t) => tab === 'all' || tabOf(t.siteState) === tab);
    if (follow) rows = rows.filter((t) => (t.dofollow || '') === follow);
    if (traf) rows = rows.filter((t) => (t.traffic || '') === traf);
    if (draftOnly) rows = rows.filter((t) => t.hasDraft);
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((t) => t.title.toLowerCase().includes(s) || (t.sourceUrl || '').toLowerCase().includes(s));
    // To do: unassigned first; then by created (desc already from query).
    if (tab === 'todo') rows = [...rows].sort((a, b) => Number(!!a.assignedUserId) - Number(!!b.assignedUserId));
    return rows;
  }, [tasks, tab, follow, traf, draftOnly, q]);

  const open = openId != null ? tasks.find((t) => t.id === openId) ?? null : null;

  const setSite = (taskId: number, status: string, url: string) => {
    if (!slug) return;
    start(async () => { await setBacklinkSite(taskId, slug, status, url); router.refresh(); });
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
        <a href={`/architecture?obj=backlink&site=${slug}`} style={{ ...btn, textDecoration: 'none' }} title="Mở bird's-eye cross-project trong Architect">↗ Architect</a>
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

      {/* account-readiness rollup — prepare before posting */}
      <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)', fontSize: 11 }}>
        <div onClick={() => setPrepOpen((v) => !v)} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', cursor: prep.missing.length ? 'pointer' : 'default' }}>
          <span style={{ color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 9.5 }}>Accounts</span>
          {(['ready', 'missing', 'warming', 'setup', 'locked', 'no-account'] as ReadinessBucket[]).map((b) => prep.c[b] ? (
            <span key={b} style={{ color: READINESS_META[b].color, fontWeight: 700 }} title={READINESS_META[b].label}>{READINESS_META[b].icon} {prep.c[b]} {b === 'no-account' ? 'email-only' : b === 'missing' ? 'need acct' : b}</span>
          ) : null)}
          {prep.missing.length > 0 && <span style={{ marginLeft: 'auto', color: 'var(--fg-3)' }}>{prepOpen ? '▾ ẩn' : `▸ ${prep.missing.length} platform cần tạo`}</span>}
        </div>
        {prepOpen && prep.missing.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm nguồn / source…" autoComplete="off"
          style={{ ...btn, flex: '1 1 160px', minWidth: 140, cursor: 'text', background: 'var(--bg-1)' }} />
        {['dofollow', 'nofollow', 'mixed'].map((f) => <button key={f} type="button" onClick={() => setFollow(follow === f ? '' : f)} style={chip('#9d6cff', follow === f)}>{f}</button>)}
        <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
        {['high', 'medium', 'low'].map((f) => <button key={f} type="button" onClick={() => setTraf(traf === f ? '' : f)} style={chip('#22c55e', traf === f)}>{f}</button>)}
        <button type="button" onClick={() => setDraftOnly((v) => !v)} style={chip('#3c9bff', draftOnly)}>📋 ready</button>
        {(q || follow || traf || draftOnly) && <button type="button" onClick={() => { setQ(''); setFollow(''); setTraf(''); setDraftOnly(false); }} style={btn}>Clear</button>}
      </div>

      {/* cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((t) => (
          <div key={t.id} onClick={() => setOpenId(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {t.sourceUrl && <a href={wrapExternalUrl(t.sourceUrl)} {...EXT} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(t.sourceUrl)}</a>}
                {t.da && <Tag>DA {t.da}</Tag>}
                {t.dofollow && <Tag color="#9d6cff">{t.dofollow}</Tag>}
                {t.traffic && <Tag color="#22c55e">{t.traffic}</Tag>}
                {t.hasDraft && <Tag color="#3c9bff">📋 draft</Tag>}
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

      {open && <Drawer task={open} slug={slug} accounts={accounts} onClose={() => setOpenId(null)} setSite={setSite} onChange={() => start(() => router.refresh())} onCreateAccount={openCreateAccount} onEditAccount={openEditAccount} />}

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

function Drawer({ task, slug, accounts, onClose, setSite, onChange, onCreateAccount, onEditAccount }: {
  task: BacklinkTask; slug: string; accounts: AccountRow[]; onClose: () => void; setSite: (id: number, status: string, url: string) => void; onChange: () => void;
  onCreateAccount: (platformKey: string) => void; onEditAccount: (account: AccountRow) => void;
}) {
  const acctObj = task.accountId != null ? accounts.find((a) => a.id === task.accountId) ?? null : null;
  const [url, setUrl] = useState(task.siteLiveUrl || '');
  const [copied, setCopied] = useState(false);
  const [fmt, setFmt] = useState<DraftFmt>('md');
  const [linkMode, setLinkMode] = useState<LinkMode>('link');
  const draftFmts = useMemo(() => {
    if (!task.draft) return null;
    const src = applyLink(task.draft, linkMode);
    return { md: src, html: mdToHtml(src), plain: mdToPlain(src) };
  }, [task.draft, linkMode]);
  const copy = (txt: string) => { navigator.clipboard?.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {}); };
  const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 0 4px' };
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_ORDER.map((s) => {
            const m = SITE_STATUS[s] ?? { label: s, color: 'var(--fg-2)' }; const on = task.siteState === s;
            return <button key={s} type="button" onClick={() => setSite(task.id, s, url)}
              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${m.color}`, background: on ? m.color : 'transparent', color: on ? '#0b0f17' : m.color }}>{m.label}</button>;
          })}
        </div>

        <div style={lbl}>Live URL (link đã đặt được @ {slug})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoComplete="off"
            style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setSite(task.id, task.siteState, url)} style={{ ...btn, fontWeight: 700 }}>Lưu</button>
        </div>

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
            <button type="button" onClick={() => copy(draftFmts[fmt])} style={{ ...btn, padding: '1px 8px', marginLeft: 'auto' }}>{copied ? '✓ copied' : 'Copy'}</button>
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
