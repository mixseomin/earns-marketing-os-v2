'use client';

// Per-project backlink task surface (CRM-style, /p/[id]/backlinks). Lists the backlink
// sources that apply to THIS project's site (membership = site_status[slug]) and lets the
// admin assign each to a team user (→ ext /api/ext/my-tasks) and track per-site status +
// the live placed URL. A source is shared across sites; here we focus on this site.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { wrapExternalUrl } from '@/lib/external-url';
import { setBacklinkSite, setBacklinkSchedule, splitBacklinkTask, deleteBacklinkTask, dropBacklinkSiblings, restoreBacklinkTask, listDroppedSources, restoreDroppedSource, verifyBacklink, verifyAllBacklinks, setBacklinkAccount, listBacklinkAccountOptions, setBacklinkNote, setBacklinkBlocker, seenBacklinkResolved, submitDraftReview, setTaskResume } from '@/lib/actions/architecture';
import { hasResume, type TaskInput, type TaskResume } from '@/lib/task-resume';
import { listBacklinkSources, seedBacklinksFromCatalog, generatePlaysForProject, setBacklinkSourceStatus, type BacklinkSource, type SourceIntel } from '@/lib/actions/backlink-catalog';
import { AUTOMATION_META, automationBadge, automationNeedsHuman } from '@/lib/backlink-gates';
import { SourceEditor } from './source-editor';
import { setBacklinkTier } from '@/lib/actions/backlink-tasks';
import { BACKLINK_SITES } from '@/lib/backlink-sites';
import { AssigneeCell } from '@/components/assignee-chip';
import { AccountFormModal } from '@/components/accounts-vault';
import { getAccountForEditAny } from '@/lib/actions/accounts';
import { StatusSegmented, Segmented, MonthCalendar, ViewToggle, LIST_CALENDAR_VIEWS, Drawer, FilterChips, SearchInput, usePaged, Pager, type CalItem, type CalMode, type LegendEntry } from '@/components/ui';
import { ImageAttach, discardAttachments } from '@/components/ui/image-attach';
import type { BuildingProduct } from '@/lib/actions/products-building';
import { searchBacklinkMedia, attachBacklinkMedia, generateBacklinkMedia, autoPrepareProjectMedia, deleteBacklinkMedia, generateBacklinkDraft, condenseBacklinkDraft } from '@/lib/actions/backlink-media';
import { suggestProjectStack } from '@/lib/actions/projects';
import { listAiContent, generateAiContent, deleteAiContent, normalizeInstructions, normalizeProjectInstructions, listTaskDomSamples, prepFillFields, type AiContentRow } from '@/lib/actions/ai-content';
import { getBacklinkSourceForTask } from '@/lib/actions/backlink-catalog';
import { linkTaskToOutreach } from '@/lib/actions/outreach-campaigns';
import { TaskOutreachDrawer } from '@/components/task-outreach-drawer';
import { CampaignLinkPicker, EmailSendPrep } from '@/components/ui';

// Compact status labels for the Outreach linkage chip on a backlink task.
const OUTREACH_ST: Record<string, string> = { to_send: 'chưa gửi', sent: 'đã gửi', followup_1: 'FU1', followup_2: 'FU2', replied: 'đã hồi', interested: 'quan tâm', embedded: 'đã đặt ★', declined: 'từ chối', bounced: 'bounced', unreachable: 'ko liên hệ được', no_response: 'ko hồi' };
import { listIdentities } from '@/lib/actions/identities';
import type { PhotoCandidate } from '@/lib/stock-photos';
import { READINESS_META, ACCOUNT_ROLE_META, type ReadinessBucket, type AccountRole } from '@/lib/backlink-account-type';
import type { BacklinkTask, BacklinkVerify } from '@/lib/actions/backlink-tasks';
import type { PlatformRow, AccountRow, MediaRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import type { ProxyRow, BrowserProfileRow } from '@/lib/actions/environments';
import type { TeamMemberRow } from '@/lib/actions/team';
import { SITE_STATUS_META, SITE_STATUSES, CLOSED_SITE_STATUSES } from '@/lib/site-status';
import { setPref, pick, type Prefs } from '@/lib/prefs';
import { localDay, todayLocal } from '@/lib/local-day';
import { FOLLOWUP_META, type Followup } from '@/lib/followup-status';
import { FollowupDrawer } from '@/components/followup-drawer';
import { taskKind, KIND_ICON, stripKindPrefix, isEmailSend as detectEmailSend } from '@/lib/task-kind';
import { hostOf } from '@/lib/host';

// One status taxonomy for the whole page. SITE_STATUS is the single source of truth —
// it drives BOTH the status picker (StatusSegmented) and the tabs/KPI, so they never
// diverge (no separate tab-rollup vocabulary). Tabs = these statuses + "All".
const SITE_STATUS: Record<string, { label: string; color: string }> = SITE_STATUS_META;
const STATUS_ORDER = SITE_STATUSES;
// Chú thích lịch: LOẠI (icon SVG) + TRẠNG THÁI (nhãn/màu lấy THẲNG từ SITE_STATUS_META = nguồn drawer/kanban
// → calendar không tự chế chữ, luôn đồng nhất). Follow-up có bộ status riêng (drawer follow-up), pin = loại.
const CAL_LEGEND: LegendEntry[] = [
  { icon: 'link', label: 'backlink' }, { icon: 'mail', label: 'email' }, { icon: 'sprout', label: 'seed' }, { icon: 'pin', label: 'follow-up' },
  { sep: true },
  ...STATUS_ORDER.map((s) => ({ color: SITE_STATUS_META[s].color, label: SITE_STATUS_META[s].label })),
  { sep: true },
  { icon: 'brief', label: 'có bàn giao · rê chuột xem' },
];
// Columns where recency (most-recent activity) beats tier for ordering — a finished/awaiting task
// should surface at the top of its column, not sink under stale tier order.
const TERMINAL_STATES = new Set<string>(['submitted', 'completed', 'verified', 'broken', 'dropped']);
const CLOSED = new Set<string>(CLOSED_SITE_STATUSES);   // xong/bỏ/lỗi — ẩn mặc định, xem lib/site-status.ts
type TabKey = 'all' | (typeof STATUS_ORDER)[number];

const EXT = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;

const domainForSlug = (s: string | null | undefined) => (s ? BACKLINK_SITES.find((x) => x.slug === s)?.domain ?? null : null);
const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const daysSince = (iso: string) => { try { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); } catch { return 0; } };
// Image actions on a thumbnail: fetch the bytes so both download and copy-as-image work even
// cross-origin (when the host allows CORS). Fallbacks: open-in-tab / copy-URL when it doesn't.
async function fetchImageBlob(url: string): Promise<Blob> {
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
}
async function downloadImage(url: string, filename?: string): Promise<void> {
  try {
    const blob = await fetchImageBlob(url);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = filename || url.split('/').pop()?.split('?')[0] || 'image';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch { window.open(url, '_blank', 'noopener'); }  // CORS-blocked → open so the user can save manually
}
async function copyImageToClipboard(url: string): Promise<boolean> {
  try {
    // Pass a Promise to ClipboardItem so the write stays inside the user gesture. Convert to
    // PNG via a canvas over our own fetched blob (blob: is same-origin → no taint) — clipboard
    // only reliably accepts image/png.
    const png = (async () => {
      const blob = await fetchImageBlob(url);
      if (blob.type === 'image/png') return blob;
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
    })();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch { return false; }
}
// Link health badge (shared by list + drawer). null = never checked.
const verifyMeta = (v: BacklinkVerify | null): { c: string; t: string } | null => !v ? null
  : !v.reachable ? { c: 'var(--fg-3)', t: `? không truy cập${v.httpStatus ? ' ' + v.httpStatus : ''}` }
  : !v.found ? (v.mentioned ? { c: '#ffb03c', t: '⚠ cần kiểm tra' } : { c: 'var(--bad,#ef4444)', t: '✗ link mất' })
  : v.dofollow ? { c: '#22c55e', t: '✓ dofollow' }
  // nofollow = link CONFIRMED present (verify succeeded), just no link-juice. Not an error — most
  // directory/forum/social backlinks are nofollow. Muted ✓, not an amber ⚠ (which read as "failed").
  : { c: 'var(--fg-3)', t: '✓ nofollow' };

const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };
const chip = (c: string, on: boolean): CSSProperties => ({ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${on ? c : 'var(--line)'}`, background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'transparent', color: on ? c : 'var(--fg-3)' });

// Collapsible section (progressive disclosure — see feedback_progressive_disclosure_tiers). Tier-2
// sections stay closed until clicked; defaultOpen when they already hold meaningful content.
function Disclosure({ title, badge, defaultOpen, children }: { title: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 9 }}>
      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-2)', userSelect: 'none' }}>
        <span style={{ color: 'var(--fg-4)', fontSize: 9, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▶</span>
        <span>{title}</span>
        {badge != null && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'none', letterSpacing: 0 }}>{badge}</span>}
      </summary>
      <div style={{ marginTop: 9 }}>{children}</div>
    </details>
  );
}

function Pill({ status }: { status: string }) {
  const m = SITE_STATUS[status] || { label: status, color: 'var(--fg-2)' };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: `color-mix(in srgb, ${m.color} 18%, transparent)`, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</span>;
}
function Tag({ children, color = 'var(--fg-3)' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-3)', color, whiteSpace: 'nowrap' }}>{children}</span>;
}

const seedPill = (c: string): CSSProperties => ({ fontSize: 9.5, fontWeight: 700, padding: '0 5px', borderRadius: 5, lineHeight: 1.55, whiteSpace: 'nowrap', color: c, border: `1px solid ${c}55`, background: `${c}14` });
// 🌱 community-seed readiness readout — replaces the flat badge. Shows the live link gate
// for this account × subreddit (🟢 sanctioned / 🔒 building / ⛔ unsafe / ⚠ no account),
// with the sub-metrics that gate a link (join · tenure · karma · seed). Full blockers in
// the tooltip; the drawer expands them. null gate (unresolved) → the plain class badge.
function SeedStrip({ g }: { g: BacklinkTask['seedGate'] }) {
  if (!g) return <span title="🌱 Community-seed: nền tảng bật link-gate — account phải xây standing (join · tenure · karma · seed) trước khi thả LINK. Trước đó = seeding value link-free." style={seedPill('#22c55e')}>🌱 community-seed</span>;
  const m = g.ok ? { c: '#22c55e', icon: '🟢' }
    : g.safetyFail ? { c: '#ef4444', icon: '⛔' }
    : g.state === 'no-account' ? { c: '#ef4444', icon: '⚠' }
    : { c: '#ffb03c', icon: '🔒' };
  const sub = g.sub ? `r/${g.sub}` : 'community';
  const body = g.state === 'no-account' ? 'chưa gán account'
    : g.ok ? 'link OK'
    : [g.joined ? null : 'join✗', `⏳${g.tenureDays ?? '–'}/${g.tenureNeed}d`, `⭐${g.karma ?? '?'}/${g.karmaNeed}`, `🌱${g.seeds ?? 0}/${g.seedsNeed}`].filter(Boolean).join(' ');
  const tip = `🌱 ${sub} — ${g.ok ? 'ĐỦ điều kiện thả LINK' : 'CHƯA đủ điều kiện thả link'}`
    + (g.blockers.length ? '\n' + g.blockers.map((b) => '• ' + b).join('\n') : '')
    + (g.ok ? '' : '\n\n→ Seeding link-free tới khi đạt (quản lý sâu ở /seeding).');
  return <span title={tip} style={seedPill(m.c)}>🌱 {sub} {m.icon} {body}</span>;
}

// Neutral filter chip — YDNI colour discipline: neutral by default, accent when active;
// `sig` (e.g. red for a blocker) only when the filter itself carries a signal meaning.
const fchip = (on: boolean, sig?: string): CSSProperties => ({
  fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${on ? (sig || 'var(--accent)') : 'var(--line)'}`,
  color: on ? (sig || 'var(--accent)') : 'var(--fg-2)',
  background: on ? `color-mix(in srgb, ${sig || 'var(--accent)'} 14%, transparent)` : 'transparent',
});
const flbl: CSSProperties = { fontSize: 9, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 };
const frow: CSSProperties = { display: 'flex', gap: 5, flexWrap: 'wrap' };

// SẢN PHẨM ĐANG DỰNG — dải nổi ngay đầu bảng, vì đây là thứ đang thực sự được làm ra, còn
// backlink/seeding chỉ là việc quanh nó. Bấm một ô → drawer đọc được cả bản thảo: trước đây bản
// thảo nằm trong file ở máy cá nhân nên câu "muốn xem quyển sách thì vào đâu" không có chỗ trả lời.
function ProductStrip({ products, projects, onOpen, narrow }: { products: BuildingProduct[]; projects?: Record<string, Project>; onOpen: (slug: string) => void; narrow?: boolean }) {
  if (!products.length) return null;
  // narrow = cột trái của lịch (236px): xếp dọc, ô ăn hết bề ngang thay vì tự dàn hàng ngang.
  return (
    <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 10, flexWrap: 'wrap', marginBottom: narrow ? 0 : 12 }}>
      {narrow && <div style={{ fontSize: 9, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sản phẩm đang dựng</div>}
      {products.map((p) => {
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return (
          <button key={p.slug} type="button" onClick={() => onOpen(p.slug)}
            title={`${p.description.slice(0, 180)}…`}
            style={{ textAlign: 'left', cursor: 'pointer', ...(narrow ? { width: '100%' } : { minWidth: 268, flex: '1 1 268px', maxWidth: 420 }),
              border: '1px solid var(--line)', borderLeft: '3px solid var(--accent)', borderRadius: 9,
              background: 'var(--bg-1)', padding: '9px 12px', color: 'var(--fg-1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {/* cột hẹp đã có tiêu đề "Sản phẩm đang dựng" ở trên → chỉ để lại 📕, khỏi lặp chữ */}
              <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>📕{narrow ? '' : ' đang dựng'}</span>
              {/* Ở bảng toàn cục mới cần nói sản phẩm của project nào; trong trang project thì thừa. */}
              {projects?.[p.projectId] && <span style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>· {projects[p.projectId]!.emoji ?? ''} {projects[p.projectId]!.name}</span>}
              {p.price != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok,#22c55e)', marginLeft: 'auto' }}>${p.price}</span>}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>{p.title}</div>
            <div style={{ height: 4, borderRadius: 3, background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>{p.done}/{p.total} bước</span>
              <span>{p.words.toLocaleString()} từ</span>
              <span>{p.chapters.length} chương</span>
            </div>
            {p.nextCard && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              kế: {p.nextCard.date ? `${p.nextCard.date} · ` : ''}{p.nextCard.title}
            </div>}
          </button>
        );
      })}
    </div>
  );
}

// Drawer sản phẩm: mô tả bán hàng · tiến độ từng bước · và ĐỌC ĐƯỢC từng chương.
function ProductDrawer({ p, onOpenCard }: { p: BuildingProduct; onOpenCard: (id: number) => void }) {
  const [openCh, setOpenCh] = useState<number | null>(p.chapters[0]?.id ?? null);
  const lbl: CSSProperties = { display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 };
  const pill: CSSProperties = { fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, border: '1px solid var(--line)', textTransform: 'uppercase', letterSpacing: '.04em' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>{p.title}</span>
          {p.price != null && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok,#22c55e)' }}>${p.price} {p.currency}</span>}
          <span style={{ ...pill, borderColor: 'var(--accent)', color: 'var(--accent)' }}>{p.status}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>store: {p.store || 'chưa chốt'}</span>
        </div>
        {p.liveUrl && <a href={wrapExternalUrl(p.liveUrl)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>{p.liveUrl}</a>}
      </div>

      <div>
        <div style={lbl}>Mô tả bán hàng</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg-1)' }}>{p.description}</div>
      </div>

      <div>
        <div style={lbl}>Tiến độ · {p.done}/{p.total} bước · {p.words.toLocaleString()} từ đã viết</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {p.cards.map((c) => {
            const done = c.status === 'completed' || c.status === 'verified';
            return (
              <button key={c.id} type="button" onClick={() => onOpenCard(c.id)}
                style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', borderRadius: 6,
                  background: 'transparent', padding: '4px 8px', fontSize: 12, color: done ? 'var(--fg-3)' : 'var(--fg-1)',
                  display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: done ? 'var(--ok,#22c55e)' : 'var(--fg-4)' }}>{done ? '✓' : '○'}</span>
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                {c.date && <span style={{ fontSize: 10.5, color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums' }}>{c.date}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={lbl}>Nội dung · {p.chapters.length} chương</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {p.chapters.map((ch) => (
            <div key={ch.id} style={{ border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenCh(openCh === ch.id ? null : ch.id)}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--bg-2)',
                  padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--fg-4)' }}>{openCh === ch.id ? '▾' : '▸'}</span>
                <span style={{ flex: 1 }}>{ch.title}</span>
                <span style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--fg-4)' }}>{ch.chars.toLocaleString()} ký tự</span>
              </button>
              {openCh === ch.id && (
                <div style={{ padding: '10px 14px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--fg-1)', maxHeight: 520, overflowY: 'auto' }}
                  className="md-body" dangerouslySetInnerHTML={{ __html: mdToHtml(ch.content) }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lightweight popover (no house primitive existed) — trigger + floating panel + click-outside.
// Reused for the ⚙ Lọc advanced filters and the project select. children is a render-prop
// given close() so an in-panel action can dismiss it.
//
// Panel được PORTAL ra <body> + position:fixed, KHÔNG phải absolute trong trigger (sửa 2026-08-07).
// Lý do: chỉ cần một ancestor có overflow là panel bị cắt — hàng chip project dùng overflowX:'auto',
// CSS bắt overflow-y thành 'auto' theo, panel nằm ngoài vùng cắt nên select mở ra chỉ thấy ô tìm
// kiếm; tệ hơn, autoFocus kéo luôn hàng scroll đi làm trigger + chip biến mất. Bỏ overflow ở chỗ
// dùng chỉ chữa một chỗ và gài lại bẫy cho lần sau; portal cắt cả lớp lỗi cho MỌI Popover.
function Popover({ label, active, badge, align = 'left', minWidth = 220, children }: {
  label: React.ReactNode; active?: boolean; badge?: number; align?: 'left' | 'right'; minWidth?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<CSSProperties>({ top: -9999, left: -9999 });
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    // Bám theo trigger: mở, cuộn (capture=true để bắt cả scroll container lồng nhau), đổi cỡ.
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const raw = align === 'right' ? r.right - minWidth : r.left;
      setBox({ top: r.bottom + 4, left: Math.max(8, Math.min(raw, window.innerWidth - minWidth - 8)),
        maxHeight: Math.max(160, window.innerHeight - r.bottom - 16) });
    };
    place();
    // Click-outside phải xét CẢ panel: portal rồi thì nó không còn là con của trigger nữa.
    const out = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', out);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', out);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align, minWidth]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ ...btn, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, borderColor: active || open ? 'var(--accent)' : 'var(--line)', color: active ? 'var(--accent)' : 'var(--fg-1)' }}>
        {label}{badge ? <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#000', borderRadius: 999, padding: '0 5px', minWidth: 14, textAlign: 'center' }}>{badge}</span> : null}
        <span style={{ fontSize: 8, opacity: 0.5 }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', ...box, zIndex: 500, minWidth, overflowY: 'auto', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, boxShadow: '0 8px 30px rgba(0,0,0,.4)' }}>
          {children(() => setOpen(false))}
        </div>, document.body)}
    </div>
  );
}

// Searchable single-select for the project filter (>5 items → searchable per YDNI). Collapsed
// trigger shows the picked project; open shows a search box + per-project counts.
function ProjectFilterSelect({ projects, value, onChange }: {
  projects: { slug: string; label: string; emoji: string; count: number }[];
  value: string; onChange: (slug: string) => void;
}) {
  const [q, setQ] = useState('');
  const sel = projects.find((p) => p.slug === value);
  const shown = projects.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover minWidth={240} active={!!value}
      label={sel ? <span>{sel.emoji} {sel.label}</span> : <span style={{ color: 'var(--fg-3)' }}>Tất cả project</span>}>
      {(close) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 project…" style={{ ...btn, cursor: 'text', background: 'var(--bg-1)' }} />
          <div style={{ overflowY: 'auto', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button type="button" onClick={() => { onChange(''); close(); }} style={{ ...btn, cursor: 'pointer', textAlign: 'left', borderColor: !value ? 'var(--accent)' : 'transparent', color: 'var(--fg-3)' }}>Tất cả project</button>
            {shown.map((p) => (
              <button key={p.slug} type="button" onClick={() => { onChange(p.slug); close(); }}
                style={{ ...btn, cursor: 'pointer', textAlign: 'left', borderColor: value === p.slug ? 'var(--accent)' : 'transparent', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{p.emoji} {p.label}</span><span style={{ color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
              </button>
            ))}
            {!shown.length && <div style={{ fontSize: 11, color: 'var(--fg-4)', padding: 6 }}>không khớp</div>}
          </div>
        </div>
      )}
    </Popover>
  );
}

// Value tier of a backlink target: A = high-value focus (niche community seeding
// where our tool genuinely helps), B = editorial outreach, C = self-serve directory.
// Drives the ★ badge, the gold row highlight, and the focus sort — same on every project.
const TIER_META: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: '★ A', color: '#f5c518', bg: 'rgba(245,197,24,0.10)' },
  B: { label: '★ B', color: '#b9c2cf', bg: 'rgba(185,194,207,0.08)' },
  C: { label: '★ C', color: '#cd7f32', bg: 'rgba(205,127,50,0.08)' },
};
const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
const nextTier = (t: string | null): 'A' | 'B' | 'C' | null => t === 'A' ? 'B' : t === 'B' ? 'C' : t === 'C' ? null : 'A';

// Draft comes authored as Markdown. Derive HTML + plain so each platform gets the
// right paste format (Markdown → dev.to/Reddit, HTML → forum/WP, Plain → comment/bio).
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inlineHtml = (s: string) => escHtml(s)
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/_([^_]+)_/g, '<em>$1</em>');
function mdToHtml(md: string): string {
  return md.trim().split(/\n{2,}/).map((b) => {
    const h = b.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = h[1]!.length; return `<h${n}>${inlineHtml(h[2]!)}</h${n}>`; }
    const lines = b.split('\n');
    // Blockquote: chương "trước/sau" của sách gần như toàn trích dẫn, thiếu nhánh này thì mỗi
    // đoạn trích đổ ra thành một dòng "> …" trần (thêm 2026-08-08).
    if (lines.every((l) => /^\s*>/.test(l))) {
      return `<blockquote>${inlineHtml(lines.map((l) => l.replace(/^\s*>\s?/, '')).join(' ').trim())}</blockquote>`;
    }
    if (lines.every((l) => /^\s*\|/.test(l))) {   // bảng markdown → giữ dạng đơn giản, đừng vỡ
      return `<pre>${escHtml(lines.join('\n'))}</pre>`;
    }
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>\n${lines.map((l) => `  <li>${inlineHtml(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('\n')}\n</ul>`;
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) return `<ol>\n${lines.map((l) => `  <li>${inlineHtml(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('\n')}\n</ol>`;
    return `<p>${inlineHtml(b.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}
// BBCode for forums (phpBB / vBulletin / XenForo).
const inlineBb = (s: string): string => s
  .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '[img]$1[/img]')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[url=$2]$1[/url]')
  .replace(/\*\*([^*]+)\*\*/g, '[b]$1[/b]')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/_([^_]+)_/g, '[i]$1[/i]');
const mdToBbcode = (md: string): string => md.trim().split(/\n{2,}/).map((b) => {
  const h = b.match(/^(#{1,6})\s+(.*)$/);
  if (h) return `[b]${inlineBb(h[2]!)}[/b]`;
  const lines = b.split('\n');
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `[list]\n${lines.map((l) => `[*]${inlineBb(l.replace(/^\s*[-*]\s+/, ''))}`).join('\n')}\n[/list]`;
  if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) return `[list=1]\n${lines.map((l) => `[*]${inlineBb(l.replace(/^\s*\d+\.\s+/, ''))}`).join('\n')}\n[/list]`;
  return inlineBb(b.replace(/\n/g, ' '));
}).join('\n\n');
const mdToPlain = (md: string): string => md
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$2')
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

type DraftFmt = 'md' | 'html' | 'plain' | 'bbcode';
const DRAFT_FMTS: { k: DraftFmt; label: string; hint: string }[] = [
  { k: 'md', label: 'Markdown', hint: 'dev.to · Reddit · Medium' },
  { k: 'html', label: 'HTML', hint: 'WordPress · site tự do HTML' },
  { k: 'bbcode', label: 'BBCode', hint: 'forum phpBB · vBulletin · XenForo' },
  { k: 'plain', label: 'Plain', hint: 'comment · bio · profile' },
];

// Backup plans for the link itself — some platforms/moments allow a real link, some
// strip markup, some ban links (or a new account can't post one yet). Applied to the
// Markdown source BEFORE formatting.
type LinkMode = 'link' | 'bare' | 'brand' | 'nolink';
const LINK_MODES: { k: LinkMode; label: string; hint: string }[] = [
  { k: 'link', label: '🔗 Link', hint: 'Platform cho dofollow / link tự do' },
  { k: 'bare', label: '🔓 Bare URL', hint: 'Markdown bị strip → URL trần, tự auto-link' },
  { k: 'brand', label: '🏷 Brand', hint: 'Link bị chặn / account mới → nhắc brand + domain, thêm link sau' },
  { k: 'nolink', label: '🚫 No link', hint: 'Platform cấm link hẳn → chỉ nhắc tên brand, bỏ mọi URL' },
];
function applyLink(md: string, mode: LinkMode): string {
  if (mode === 'link') return md;
  if (mode === 'nolink') {
    // [anchor](url) → anchor ; drop all loose URLs entirely
    let s = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/https?:\/\/[^\s)]+/g, '');
    return s.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,])/g, '$1');
  }
  // [anchor](url) → "anchor url" (bare) or "anchor (host)" (brand, no clickable link)
  let s = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, a: string, u: string) => mode === 'bare' ? `${a} ${u}` : `${a} (${hostOf(u)})`);
  // loose bare urls → keep (bare) or reduce to host (brand)
  s = s.replace(/https?:\/\/[^\s)]+/g, (u) => mode === 'bare' ? u : hostOf(u));
  return s;
}
// Strip image markdown (for platforms that don't allow images).
const stripImages = (md: string): string => md.replace(/!\[[^\]]*\]\([^)]+\)\n?/g, '').replace(/\n{3,}/g, '\n\n').trim();

// Render build steps as dash bullets. Splits on newlines first (new format); falls
// back to splitting a single-line "1) … 2) …" recipe (legacy).
const stripMarker = (s: string) => s.replace(/^\s*[-*•–]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim();
// Turn bare URLs in instruction text into a clickable link + one-tap copy button.
function LinkText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => !/^https?:\/\//.test(p) ? <span key={i}>{p}</span> : (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, maxWidth: '100%' }}>
      <a href={wrapExternalUrl(p)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{p}</a>
      <button type="button" title="Copy link"
        onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(p); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        style={{ flexShrink: 0, cursor: 'pointer', border: 'none', background: 'none', color: copied ? 'var(--ok, #22c55e)' : 'var(--fg-4)', fontSize: 11, padding: 0 }}>{copied ? '✓' : '⧉'}</button>
    </span>
  ))}</>;
}
// Hướng dẫn viết liền một khối, không xuống dòng (task ghi lùi bằng `play add`, hướng dẫn cũ
// nhập tay, đoạn AI trả về một mạch) trước đây đổ nguyên xi ra thành một tảng chữ không đọc nổi.
// Không thể bắt MỌI nguồn ghi đúng khuôn — nhiều đường cùng ghi vào `instructions` — nên chỗ sửa
// đúng là tầng HIỂN THỊ: tự cắt khối văn xuôi thành ý, theo hết câu và theo dấu '·' (đang được
// dùng làm dấu phân cách trong chính các hướng dẫn này). Cắt xong đi tiếp qua đúng đường render
// của bullet bên dưới, nên link vẫn bấm được và nút ⚠ Lỗi vẫn gắn theo từng ý.
// Cố ý KHÔNG cắt theo dấu phẩy: câu tiếng Việt dùng phẩy dày, cắt ra sẽ vụn hơn là dễ đọc.
// Và KHÔNG cắt khi dấu chấm đứng ngay sau chữ số — "Bước 1. Vào trang" là một bước, cắt ra
// thành "Bước 1." lơ lửng thì tệ hơn lúc chưa cắt. Cùng luật đó giữ nguyên "3.5 triệu", "2026.".
export function segmentProse(s: string): string[] {
  return s
    .split(/(?<=[^\d\s][.;!?])\s+(?=[\p{Lu}\p{Extended_Pictographic}0-9])|\s+·\s+/su)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Render instruction text as an aligned list: a fixed gutter (step number / leading emoji /
// dash) + the body. Numbered steps keep their number; emoji-led meta lines (🔗🔑📍✅) get the
// emoji in the gutter; a short line ending ":" is a sub-heading. URLs stay clickable via LinkText.
function Steps({ text, onBlock, urlValue, onUrlChange, onUrlSave, urlSaving, emailMode }: {
  text: string;
  onBlock?: (reason: string, shot?: string) => Promise<void> | void;   // ⚠ per-line report → flag blocker (+ optional screenshot)
  urlValue?: string; onUrlChange?: (v: string) => void; onUrlSave?: () => void; urlSaving?: boolean;
  emailMode?: boolean;   // email-send card: "done" = sent, the link is an optional campaign/offer URL (không phải backlink đã đặt)
}) {
  const [rIdx, setRIdx] = useState<number | null>(null);   // which line has its report box open
  const [rText, setRText] = useState('');
  const [rShots, setRShots] = useState<string[]>([]);      // attached screenshot URLs
  const [rBusy, setRBusy] = useState(false);
  let items = text.split('\n').map((s) => s.trim()).filter(Boolean);
  if (items.length <= 1) {
    const parts = text.split(/\s*(?=\b\d+\)\s)/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) items = parts;
  }
  if (items.length <= 1) {
    const seg = segmentProse(text);
    if (seg.length >= 2) items = seg;
  }
  if (items.length <= 1) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg-1)' }}><LinkText text={stripMarker(items[0] ?? text)} /></div>;
  }
  const openReport = (i: number, ln: string) => { setRIdx(i); setRText(`Không làm được / không thấy như mô tả: "${ln.length > 90 ? ln.slice(0, 90) + '…' : ln}"`); setRShots([]); };
  const sendReport = async () => { if (!rText.trim() || !onBlock) return; setRBusy(true); await onBlock(rText.trim(), rShots[0]); setRBusy(false); setRIdx(null); setRText(''); setRShots([]); };
  return (<>
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((ln, i) => {
        const num = ln.match(/^(\d+)[.)]\s*(.*)$/s);
        const emo = ln.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/su);
        // "Các bước:" style label — a short line ending in ":" with no number/emoji.
        if (!num && !emo && /^.{1,28}:$/.test(ln)) {
          return <li key={i} style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-2)', marginTop: i ? 5 : 0, marginBottom: -1 }}>{ln.replace(/:$/, '')}</li>;
        }
        const gutter = num ? num[1] : emo ? emo[1] : '–';
        const body = (num ? num[2] : emo ? emo[2] : ln) ?? ln;
        return (
          <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--fg-1)' }}>
              <span style={{ flexShrink: 0, minWidth: 17, textAlign: num ? 'right' : 'center', fontWeight: num ? 700 : 400, color: num ? 'var(--accent)' : 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{num ? `${gutter}.` : gutter}</span>
              <span style={{ minWidth: 0, flex: 1 }}><LinkText text={body} /></span>
              {onBlock && (num || emo) && <button type="button" onClick={() => (rIdx === i ? setRIdx(null) : openReport(i, ln))} title="Làm không được / không thấy như mô tả? Báo lỗi ngay dòng này"
                style={{ flexShrink: 0, alignSelf: 'flex-start', border: '1px solid var(--warn,#ffb03c)', background: 'transparent', borderRadius: 5, cursor: 'pointer', color: 'var(--warn,#ffb03c)', fontSize: 10.5, fontWeight: 700, padding: '1px 7px', whiteSpace: 'nowrap' }}>⚠ Lỗi</button>}
            </div>
            {rIdx === i && onBlock && (
              <div style={{ marginLeft: 25, padding: 8, borderRadius: 7, border: '1px solid var(--warn,#ffb03c)', background: 'color-mix(in srgb, var(--warn,#ffb03c) 8%, transparent)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea value={rText} onChange={(e) => setRText(e.target.value)}
                  rows={2} autoFocus autoComplete="off" placeholder="Mắc gì ở bước này?"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }} />
                <ImageAttach value={rShots} onChange={setRShots} folder="blockers" max={3} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" onClick={sendReport} disabled={rBusy || !rText.trim()} style={{ ...btn, color: 'var(--warn,#ffb03c)', fontWeight: 700 }}>{rBusy ? '…' : '⚠ Báo lỗi'}</button>
                  <button type="button" onClick={() => { discardAttachments(rShots); setRShots([]); setRIdx(null); }} style={btn}>Huỷ</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
    {/* Kết quả — always give a paste spot at the end of the how-to, synced with the Live URL field below. */}
    {onUrlChange && (
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px dashed var(--line)' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-2)', marginBottom: 5 }}>{emailMode ? '🔗 Link chèn — offer / sản phẩm' : '✅ Làm xong — dán link vào đây'}</div>
        {emailMode ? (
          <CampaignLinkPicker value={urlValue} onChange={onUrlChange} onSave={onUrlSave} saving={urlSaving} />
        ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={urlValue || ''} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://… link đã đặt được" autoComplete="off"
            style={{ flex: 1, minWidth: 0, padding: '5px 9px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12 }} />
          {onUrlSave && <button type="button" onClick={onUrlSave} disabled={urlSaving} style={{ ...btn, padding: '3px 12px', fontWeight: 700 }}>{urlSaving ? '…' : 'Lưu'}</button>}
        </div>
        )}
      </div>
    )}
  </>);
}

// Account-readiness chip on a backlink card — is the platform account ready to post?
function AcctChip({ task, onClick }: { task: BacklinkTask; onClick: (e: React.MouseEvent) => void }) {
  const m = READINESS_META[task.readiness];
  const showHandle = (task.readiness === 'ready' || task.readiness === 'warming' || task.readiness === 'setup') && task.accountHandle;
  // On "need acct", show which P/B/S type fits the source so it's actionable at a glance.
  const label = showHandle ? task.accountHandle! : task.readiness === 'missing' ? `need acct ${ACCOUNT_ROLE_META[task.recommendedRole].badge}` : task.readiness === 'no-account' ? 'no acct' : m.label;
  const title = `${m.label}${task.platformLabel ? ' · ' + task.platformLabel : ''}${task.readiness === 'missing' ? ` · nên tạo ${ACCOUNT_ROLE_META[task.recommendedRole].label}: ${ACCOUNT_ROLE_META[task.recommendedRole].why}` : ''}${task.accountHandle ? ' · @' + task.accountHandle : ''}${task.accountStatus ? ' (' + task.accountStatus + ')' : ''}`;
  // YDNI màu: chỉ 'missing' (need acct) là BLOCKER thật để làm task → tô amber. Có account rồi /
  // email-only = trạng thái bình thường → trung tính, không tô (đừng để mỗi card 1 màu account).
  const blocked = task.readiness === 'missing';
  const c = blocked ? '#ffb03c' : 'var(--fg-3)';
  return (
    <span role="button" onClick={onClick} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, cursor: 'pointer', maxWidth: 132,
        background: blocked ? 'color-mix(in srgb, #ffb03c 15%, transparent)' : 'transparent', color: c, border: `1px solid ${blocked ? 'color-mix(in srgb, #ffb03c 45%, transparent)' : 'var(--line)'}` }}>
      <span>{m.icon}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  );
}

export function BacklinksPage({ projectId, slug, siteLabel, tasks, followups = [], project, platforms, accounts, teamMembers, proxies, browserProfiles, media, sourceIntel = {}, browserReady = [], initialView, allProjects, projectsById, products = [], prefs = {} }: {
  projectId: string; slug: string | null; siteLabel: string; tasks: BacklinkTask[]; followups?: Followup[];
  project: Project; platforms: PlatformRow[]; accounts: AccountRow[];
  teamMembers: TeamMemberRow[]; proxies: ProxyRow[]; browserProfiles: BrowserProfileRow[]; media: MediaRow[];
  sourceIntel?: Record<string, SourceIntel>;   // canonical_url → learned {automation, obstacles}; drives the per-card 🖐 badge (self-learning propagates to every project's task by source, read-time)
  browserReady?: string[];   // project ids that HAVE a browser profile — step-0 precondition to run any task; others get a "⚠ cần browser" badge
  initialView?: string;   // '/plays' passes 'kanban' so this same surface opens Kanban-first
  // Global /plays (all projects): tasks carry projectId/projectSlug/projectLabel; per-task project resolved
  // via projectsById for the drawer. Seed/Generate/readiness (per-project) are hidden. See getAllBacklinkTasks.
  allProjects?: boolean;
  projectsById?: Record<string, Project>;
  /** Sản phẩm ĐANG DỰNG của (các) project trong tầm — hiện thành dải đầu bảng. */
  products?: BuildingProduct[];
  /** Lựa chọn giao diện đã nhớ (cookie, server đọc) — view/lịch/ẩn-đã-xong. Xem lib/prefs.ts. */
  prefs?: Prefs;
}) {
  // In global mode a task acts on its OWN project/slug, not one page-level value.
  const slugForTask = (t?: BacklinkTask | null) => (allProjects ? (t?.projectSlug ?? '') : slug);
  const projectForTask = (t?: BacklinkTask | null) => (allProjects && t?.projectId ? (projectsById?.[t.projectId] ?? project) : project);
  // Self-learning surfaced per-task: the source's learned automation shows on EVERY task that derives from it
  // (any project) via the shared AUTOMATION_META — so a sibling visibly warns before you waste an auto attempt.
  const intelFor = (t: BacklinkTask) => (t.sourceUrl ? sourceIntel[t.sourceUrl] : undefined);
  // Step-0 precondition: the task's project must have a browser profile to run at all.
  const browserReadySet = new Set(browserReady);
  const needsBrowser = (t: BacklinkTask) => { const pid = t.projectId || projectId; return pid ? !browserReadySet.has(pid) : false; };
  const router = useRouter();
  const sp = useSearchParams();
  const [, start] = useTransition();
  // Realtime auto-refresh toggle (default ON). The effect is defined after `view` (below) so it can
  // gate on it — only the live views (calendar + kanban) auto-refresh.
  const [realtime, setRealtime] = useState(true);
  // A seeded editorial play with no concrete target URL carries a placeholder source_url on the
  // site's OWN domain (e.g. mintalmanac.com#play-N) — showing that host on a card reads as a
  // meaningless self-link. Hide it (return null) so the descriptive title speaks instead. In the
  // global /plays grid each task's own site comes from its projectSlug.
  const showHost = (url: string | null | undefined, taskSlug?: string | null): string | null => {
    if (!url) return null;
    const h = hostOf(url);
    const own = allProjects ? domainForSlug(taskSlug) : domainForSlug(slug);
    return own && h === own ? null : h;
  };
  // All view state initialises from the URL so tabs/filters/drawer are deep-linkable + refresh-safe.
  // Defaults (no URL params): Calendar view + All status.
  const initTab = ([...STATUS_ORDER, 'all'] as const).find((t) => t === sp.get('tab')) ?? 'all';
  const [tab, setTab] = useState<TabKey>(initTab);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [follow, setFollow] = useState<string>(sp.get('follow') ?? '');   // dofollow filter
  const [traf, setTraf] = useState<string>(sp.get('traf') ?? '');          // traffic filter
  const [draftOnly, setDraftOnly] = useState(sp.get('draft') === '1');
  const [blockedOnly, setBlockedOnly] = useState(sp.get('blocked') === '1');
  const [openId, setOpenId] = useState<number | null>(Number(sp.get('task')) || null);
  const [openProd, setOpenProd] = useState<string | null>(sp.get('sp'));   // slug sản phẩm đang mở
  const [openFollowupId, setOpenFollowupId] = useState<number | null>(null);   // 📌 followup pill clicked
  const [outreachPid, setOutreachPid] = useState<number | null>(Number(sp.get('outreach')) || null);   // stacked Outreach drawer, URL-driven like ?task
  const [outreachCh, setOutreachCh] = useState<string>(sp.get('ch') || '');   // selected channel tab inside the Outreach drawer (→ URL so F5 restores it)
  const [readyFilter, setReadyFilter] = useState<ReadinessBucket | ''>((sp.get('ready') as ReadinessBucket) || '');
  const [tierFilter, setTierFilter] = useState<string>(sp.get('tier') ?? '');   // '' | A | B | C | any(=tiered only)
  // Chế độ lịch (tháng/tuần/ngày) đi vào URL như mọi state khác → F5 và chia sẻ link vẫn đúng chỗ.
  const [calMode, setCalModeState] = useState<CalMode>(() => { const v = pick(sp.get('cal'), prefs['plays.cal'], 'month'); return v === 'week' || v === 'day' ? v : 'month'; });
  const setCalMode = (m: CalMode) => { setCalModeState(m); setPref('plays.cal', m === 'month' ? '' : m); };
  // Ngày đang chọn trên lịch cũng vào URL như mọi state khác → F5 / chia sẻ link giữ đúng ngày,
  // không nhảy về hôm nay và không phải chọn lại. Rỗng = hôm nay (lịch tự tính sau mount, giờ local).
  const [calDate, setCalDate] = useState<string>(sp.get('d') ?? '');
  // Mặc định ẩn việc đã đóng sổ (xong/bỏ/lỗi): bảng việc là để biết CÒN phải làm gì, không phải
  // kho lưu trữ. ?closed=1 bật lại. Chọn đích danh một tab trạng thái = ý muốn rõ ràng, luật này nhường.
  const [showClosed, setShowClosedState] = useState(() => pick(sp.get('closed'), prefs['plays.closed'], '0') === '1');
  const setShowClosed = (v: boolean) => { setShowClosedState(v); setPref('plays.closed', v ? '1' : ''); };
  const [projectFilter, setProjectFilter] = useState<string>(sp.get('proj') ?? '');   // global /plays only: filter to one project's plays (by slug)
  // Sản phẩm theo ĐÚNG project đang xem. Trang project đã lọc từ server; bảng toàn cục thì phải
  // theo chip project đang chọn — nếu không, chọn một project vẫn thấy sản phẩm của project khác.
  const shownProducts = useMemo(() => (allProjects && projectFilter ? products.filter((p) => p.projectId === projectFilter) : products), [products, allProjects, projectFilter]);
  // Work-type axis (the YDNI spine that scales to email later): '' = all, acquire = 🔗
  // one-shot backlink, seed = 🌱 community-seed (link-gated). Filters by communitySeed.
  const [workType, setWorkType] = useState<'' | 'acquire' | 'seed'>((sp.get('wt') as '' | 'acquire' | 'seed') || '');
  // View / chế độ lịch / ẩn-đã-xong = LỰA CHỌN, không phải vị trí điều hướng → nhớ vào cookie (lib/prefs).
  // Thứ tự: URL (link chia sẻ) → lựa chọn đã nhớ → mặc định của trang.
  const [view, setViewState] = useState<'list' | 'calendar' | 'kanban'>(() => {
    const v = pick(sp.get('view'), prefs['plays.view'], initialView === 'kanban' ? 'kanban' : 'calendar');
    return v === 'list' || v === 'kanban' || v === 'calendar' ? v : 'calendar';
  });
  const setView = (v: 'list' | 'calendar' | 'kanban') => { setViewState(v); setPref('plays.view', v); };
  // Auto-refresh every 10s on the LIVE views (calendar + kanban — where cards move); skip the list view
  // (don't disrupt reading/inline edits) and backgrounded tabs. Header checkbox toggles `realtime`.
  useEffect(() => {
    if (!realtime || view === 'list') return;
    const id = setInterval(() => { if (!document.hidden) start(() => router.refresh()); }, 10000);
    return () => clearInterval(id);
  }, [realtime, view, router]);
  const [groupBy, setGroupBy] = useState<'none' | 'platform' | 'status' | 'readiness'>(['platform', 'status', 'readiness'].includes(sp.get('group') || '') ? (sp.get('group') as 'platform' | 'status' | 'readiness') : 'none');

  const openTask = (id: number) => setOpenId(id);
  // Cycle the value tier A→B→C→(unset). One action, all projects; row refreshes after.
  const cycleTier = async (id: number, cur: string | null) => { await setBacklinkTier(id, nextTier(cur)); start(() => router.refresh()); };
  const closeTask = () => { setOpenId(null); setOutreachPid(null); setOutreachCh(''); };

  // Delete a backlink task with a 10s undo (destructive-action pattern). undoRow holds the
  // snapshot; restore re-inserts it with the same id so the deep-link still resolves.
  const [undoRows, setUndoRows] = useState<Record<string, unknown>[] | null>(null);
  const deleteTask = async (taskId: number) => {
    const r = await deleteBacklinkTask(taskId);
    if (r.ok && r.row) { setOpenId(null); setUndoRows([r.row]); start(() => router.refresh()); setTimeout(() => setUndoRows(null), 9000); }
  };
  // Drop this source across every site (same source_url). Bulk undo restores all rows.
  const dropSource = async (taskId: number, reason?: string) => {
    const r = await dropBacklinkSiblings(taskId, reason);
    if (r.ok && r.rows) { setOpenId(null); setUndoRows(r.rows); start(() => router.refresh()); setTimeout(() => setUndoRows(null), 9000); }
  };
  const undoDelete = async () => { const rows = undoRows; if (!rows) return; setUndoRows(null); for (const row of rows) await restoreBacklinkTask(row); start(() => router.refresh()); };
  // Trash — dropped sources recoverable any time (durable backstop beyond the 9s undo).
  const [trashOpen, setTrashOpen] = useState(false);
  const [trash, setTrash] = useState<Awaited<ReturnType<typeof listDroppedSources>> | null>(null);
  const openTrash = async () => { setTrashOpen(true); setTrash(await listDroppedSources()); };
  const restoreTrash = async (id: string) => { await restoreDroppedSource(id); setTrash(await listDroppedSources()); start(() => router.refresh()); };

  // Seed-from-catalog — instantiate tasks for this project from the shared source catalog (backlink_sources).
  const [seedOpen, setSeedOpen] = useState(sp.get('seed') === '1');
  const [seedSrcs, setSeedSrcs] = useState<BacklinkSource[] | null>(null);
  const [seedAud, setSeedAud] = useState(sp.get('sniche') ?? '');
  const [seedCat, setSeedCat] = useState(sp.get('schan') ?? '');
  const [seedSort, setSeedSort] = useState(sp.get('ssort') ?? '');
  const [seedQ, setSeedQ] = useState(sp.get('sq') ?? '');
  const [seedHideUsed, setSeedHideUsed] = useState(sp.get('shide') === '1');
  const [seedSel, setSeedSel] = useState<Set<number>>(new Set());
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const reloadSeed = async () => setSeedSrcs(await listBacklinkSources({ projectId, status: 'active' }));
  const openSeed = async () => { setSeedOpen(true); setSeedSrcs(null); setSeedSel(new Set()); setSeedMsg(''); setSeedAud(''); setSeedCat(''); setSeedSort(''); setSeedQ(''); setSeedHideUsed(false); await reloadSeed(); };
  // Restore an URL-opened drawer (F5 with ?seed=1) — load the catalog without resetting the restored filters.
  useEffect(() => { if (seedOpen && seedSrcs === null) void reloadSeed(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const toggleSeed = (id: number) => setSeedSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const doSeed = async () => {
    if (!seedSel.size) return;
    setSeedBusy(true);
    const r = await seedBacklinksFromCatalog(projectId, [...seedSel]);
    setSeedBusy(false);
    if (r.ok) { setSeedMsg(`✓ Tạo ${r.created} task${r.skipped ? ` · bỏ qua ${r.skipped} (đã có)` : ''}`); setSeedSel(new Set()); start(() => router.refresh()); await reloadSeed(); }
    else setSeedMsg(`✗ ${r.error}`);
  };
  // Catalog admin — add/edit a source (stacked over the seed picker). null=closed, {}=new, {id,…}=edit.
  const [srcEdit, setSrcEdit] = useState<BacklinkSource | Record<string, never> | null>(null);
  // Bulk-reshape this project's genuinely-thin instructions to the template (AI, content-preserving).
  const [normBusy, setNormBusy] = useState(false);
  const [normMsg, setNormMsg] = useState('');
  // One-click generator: seed this site with the reusable play-source templates (living-template).
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const doGeneratePlays = async () => {
    setGenBusy(true); setGenMsg('');
    const r = await generatePlaysForProject(projectId);
    setGenBusy(false);
    setGenMsg(r.ok ? `✓ +${r.created ?? 0} play${r.skipped ? ` · bỏ qua ${r.skipped}` : ''}` : `✗ ${r.error}`);
    if (r.ok && r.created) start(() => router.refresh());
  };
  const doNormalize = async () => {
    setNormBusy(true); setNormMsg('');
    const r = await normalizeProjectInstructions(projectId);
    setNormBusy(false);
    setNormMsg(r.ok ? `✓ Chuẩn hoá ${r.done} task${r.failed ? ` · ${r.failed} lỗi` : ''}` : `✗ ${r.error}`);
    if (r.ok && r.done) start(() => router.refresh());
  };

  // Single source of URL truth — reflect every view-changing state (shallow, no refetch).
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string | number | null | undefined) => { if (v) u.searchParams.set(k, String(v)); else u.searchParams.delete(k); };
    set('tab', tab === 'all' ? '' : tab);    // default (all) → clean URL
    set('q', q.trim());
    set('follow', follow);
    set('traf', traf);
    set('draft', draftOnly ? '1' : '');
    set('blocked', blockedOnly ? '1' : '');
    set('ready', readyFilter);
    set('tier', tierFilter);
    set('closed', showClosed ? '1' : '');
    set('proj', allProjects ? projectFilter : '');
    set('cal', calMode === 'month' ? '' : calMode);
    set('d', view === 'calendar' ? calDate : '');
    set('wt', workType);
    set('view', view);   // always explicit — else /plays (default kanban) reverts calendar on F5
    set('group', groupBy === 'none' ? '' : groupBy);
    set('task', openId);
    set('sp', openProd);
    set('outreach', outreachPid);
    set('ch', outreachPid != null ? outreachCh : '');   // channel tab only meaningful while the drawer is open
    // seed-catalog drawer state (only meaningful while open)
    set('seed', seedOpen ? '1' : '');
    set('sniche', seedOpen ? seedAud : '');
    set('schan', seedOpen ? seedCat : '');
    set('ssort', seedOpen ? seedSort : '');
    set('sq', seedOpen ? seedQ.trim() : '');
    set('shide', seedOpen && seedHideUsed ? '1' : '');
    window.history.replaceState(null, '', u);
  }, [tab, q, follow, traf, draftOnly, blockedOnly, readyFilter, tierFilter, showClosed, projectFilter, calMode, calDate, workType, allProjects, view, groupBy, openId, openProd, outreachPid, outreachCh, seedOpen, seedAud, seedCat, seedSort, seedQ, seedHideUsed]);

  // Create/edit a platform account in-place (no page jump). null = closed.
  // Init from URL so the account editor opened INSIDE a task survives F5 (the "full flow", one level
  // deeper than ?task). ?acct=new&aplat=<key> = create; ?acct=<id> = edit (looked up in this page's
  // accounts; absent → skip, no crash). assignToTask/pickContext are transient, not restored.
  const [acctModal, setAcctModal] = useState<{ account: AccountRow | null; platformKey?: string; assignToTask?: number; recommendedRole?: AccountRole } | null>(() => {
    const a = sp.get('acct');
    if (!a) return null;
    if (a === 'new') return { account: null, platformKey: sp.get('aplat') || undefined };
    const found = accounts.find((x) => x.id === Number(a));
    return found ? { account: found } : null;
  });
  // assignToTask: pin the newly-created account to this backlink task on create.
  const openCreateAccount = (platformKey: string, assignToTask?: number, recommendedRole?: AccountRole) => setAcctModal({ account: null, platformKey, assignToTask, recommendedRole });
  const openEditAccount = (account: AccountRow) => setAcctModal({ account });
  // Mirror acctModal → URL (disjoint keys from the main sync effect; both preserve each other's params).
  useEffect(() => {
    const u = new URL(window.location.href);
    if (acctModal) {
      u.searchParams.set('acct', acctModal.account ? String(acctModal.account.id) : 'new');
      if (!acctModal.account && acctModal.platformKey) u.searchParams.set('aplat', acctModal.platformKey);
      else u.searchParams.delete('aplat');
    } else { u.searchParams.delete('acct'); u.searchParams.delete('aplat'); }
    window.history.replaceState(null, '', u);
  }, [acctModal]);
  const [autoMedia, setAutoMedia] = useState<'busy' | string | null>(null);
  const doAutoMedia = async () => { setAutoMedia('busy'); const r = await autoPrepareProjectMedia(projectId, project.website || ''); setAutoMedia(r.ok ? `+${r.added} media` : (r.error || 'lỗi')); start(() => router.refresh()); setTimeout(() => setAutoMedia(null), 2500); };
  // Bulk link health-check across every placed link — broken links then show as list badges.
  const [chk, setChk] = useState<'busy' | string | null>(null);
  const doCheckLinks = async () => { setChk('busy'); const r = await verifyAllBacklinks(slug || '', project.website || ''); setChk(r.ok ? `${r.checked} checked${r.broken ? `, ${r.broken} mất` : ''}` : (r.error || 'lỗi')); start(() => router.refresh()); setTimeout(() => setChk(null), 4000); };

  // Account-readiness rollup (prepare before posting): counts per bucket + the distinct
  // platforms still missing an account (deep-link to create each).
  const prep = useMemo(() => {
    const c: Record<ReadinessBucket, number> = { ready: 0, warming: 0, setup: 0, missing: 0, locked: 0, 'no-account': 0 };
    const missing = new Map<string, { label: string; role: AccountRole }>();
    for (const t of tasks) { c[t.readiness]++; if (t.readiness === 'missing' && t.platformKey && !missing.has(t.platformKey)) missing.set(t.platformKey, { label: t.platformLabel || t.platformKey, role: t.recommendedRole }); }
    return { c, missing: [...missing.entries()] };
  }, [tasks]);

  // Chip click → open the task drawer (account section lives there). No page jump.
  const goAccount = (e: React.MouseEvent, t: BacklinkTask) => { e.stopPropagation(); openTask(t.id); };

  // Count per status (single taxonomy) so tabs + KPI cards share the exact same buckets.
  const kpi = useMemo(() => {
    const k: Record<string, number> = { total: tasks.length };
    for (const s of STATUS_ORDER) k[s] = 0;
    for (const t of tasks) { const s = SITE_STATUS[t.siteState] ? t.siteState : 'pending'; k[s] = (k[s] ?? 0) + 1; }
    return k;
  }, [tasks]);

  // Shared filter predicate (search + attribute filters). Tab (status) applied separately
  // so BOTH the list and the calendar honour the same filters — "global" filtering.
  const hideClosed = !showClosed && tab === 'all';
  const filteredAll = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (tab !== 'all' && t.siteState !== tab) return false;
      if (workType === 'seed' && !t.communitySeed) return false;
      if (workType === 'acquire' && t.communitySeed) return false;
      if (follow && (t.dofollow || '') !== follow) return false;
      if (traf && (t.traffic || '') !== traf) return false;
      if (draftOnly && !t.hasDraft) return false;
      if (blockedOnly && !t.blocker) return false;
      if (readyFilter && t.readiness !== readyFilter) return false;
      if (tierFilter && (tierFilter === 'any' ? !t.tier : t.tier !== tierFilter)) return false;
      if (allProjects && projectFilter && t.projectSlug !== projectFilter) return false;
      if (s && !(`${t.title} ${t.sourceUrl || ''} ${t.catalogSourceName || ''} ${t.mechanism || ''} ${t.platformLabel || ''} ${t.projectLabel || ''} ${t.instructions || ''} ${t.notes || ''}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [tasks, tab, workType, follow, traf, draftOnly, blockedOnly, q, readyFilter, tierFilter, allProjects, projectFilter]);

  // Hai tầng để ĐẾM được số đang ẩn (nút phải nói bật lên sẽ thêm bao nhiêu), thay vì viết lại
  // predicate lần thứ hai chỉ để đếm.
  const filtered = useMemo(() => (hideClosed ? filteredAll.filter((t) => !CLOSED.has(t.siteState)) : filteredAll), [filteredAll, hideClosed]);
  const closedN = filteredAll.length - filtered.length;

  const shown = useMemo(() => {
    const base = tab === 'pending'
      ? [...filtered].sort((a, b) => Number(!!a.assignedUserId) - Number(!!b.assignedUserId))
      : [...filtered];
    // Float valued tiers to the top (A→B→C→unset). Stable sort keeps prior order within a tier.
    return base.sort((a, b) => (TIER_RANK[a.tier ?? ''] ?? 9) - (TIER_RANK[b.tier ?? ''] ?? 9));
  }, [filtered, tab]);

  // The flat list view renders the whole array → paginate it with the shared vault-list primitive.
  // Stats/KPI and the kanban/calendar/grouped views keep using the full `shown`; only the flat slice.
  const { pageItems, ...pager } = usePaged(shown);

  // Group the (already filtered) list by one dimension — sections ordered by size. null = flat list.
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;
    const keyOf = (t: BacklinkTask) => groupBy === 'platform' ? (t.platformLabel || t.platformKey || '(no platform)')
      : groupBy === 'status' ? (SITE_STATUS[t.siteState]?.label || t.siteState)
      : (READINESS_META[t.readiness]?.label || t.readiness);
    const m = new Map<string, BacklinkTask[]>();
    for (const t of shown) { const k = keyOf(t); (m.get(k) ?? m.set(k, []).get(k)!).push(t); }
    return [...m.entries()].map(([label, items]) => ({ label, items })).sort((a, b) => b.items.length - a.items.length);
  }, [shown, groupBy]);

  // Calendar items from the SAME filtered set: done → solid on done date; scheduled-not-done → dim.
  const calItems = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    // Prefix [project] CHỈ khi đang xem NHIỀU project (global chưa lọc). Lọc về 1 project → thừa, bỏ.
    const showProj = allProjects && !projectFilter;
    for (const t of filtered) {
      const plbl = showProj && t.projectLabel ? `[${t.projectLabel}] ` : '';
      const seedT = t.communitySeed ? ' · community-seed (link-gated)' : '';
      const icon = KIND_ICON[taskKind(t)];   // LOẠI → SVG: mail (email-send) / sprout (seed) / link (backlink)
      const ttl = stripKindPrefix(t.title).replace(/\s+/g, ' ').trim();   // bỏ tiền tố 📧 (icon SVG đã thay)
      const host = showHost(t.sourceUrl, t.projectSlug);
      const label = plbl + ttl;
      const suffix = `${host ? ` · ${host}` : ''}${seedT}`;
      // MÀU + NHÃN trạng thái = SITE_STATUS_META (đúng nguồn drawer/kanban) — không tự chế.
      // icon = loại (cố định theo task); trạng thái chỉ đổi màu thanh-trái + ✓ + mờ.
      const smeta = SITE_STATUS[t.siteState] ?? { label: t.siteState, color: '#8a92a3' };
      // Bàn giao → đính vào pill CHƯA xong (pending/scheduled/submitted) để chat khác nối; card đã xong khỏi cần.
      const brief = hasResume({ inputs: t.inputs, doneWhen: t.doneWhen, dependsOn: t.dependsOn })
        ? { inputs: t.inputs, doneWhen: t.doneWhen, dependsOn: t.dependsOn } : undefined;
      if (t.siteDoneAt) out.push({ id: t.id, date: localDay(t.siteDoneAt), label, icon, done: true, color: smeta.color, title: `${smeta.label} · ${plbl}${ttl}${suffix}` });
      else {
        if (t.siteState === 'submitted' && t.siteSubmittedAt) out.push({ id: t.id, date: localDay(t.siteSubmittedAt), label, icon, color: SITE_STATUS_META.submitted.color, title: `${SITE_STATUS_META.submitted.label} · ${plbl}${ttl}${suffix}`, brief });
        if (t.siteScheduledAt) out.push({ id: t.id, date: t.siteScheduledAt, label, icon, color: smeta.color, title: `Hẹn kiểm tra (${smeta.label}) · ${plbl}${ttl}${suffix}`, brief });   // việc SẮP làm → full contrast, không mờ
      }
    }
    // Follow-ups deferred: cùng lịch — icon 📌pin (loại), màu thanh-trái theo status, ✓ khi xong.
    for (const f of followups) {
      if (!f.due) continue;
      if (allProjects && projectFilter && f.projectId !== projectFilter) continue;   // lọc theo project đang chọn
      const m = FOLLOWUP_META[f.status];
      const p = allProjects ? projectsById?.[f.projectId] : undefined;
      const plbl = showProj ? `[${p?.name ?? f.projectId}] ` : '';
      out.push({ id: `f:${f.id}`, date: f.due, label: `${plbl}${f.title.replace(/\s+/g, ' ').trim()}`, icon: 'pin', done: f.status === 'done', dim: f.status === 'dropped', color: m.color, title: `${m.label} · ${p?.name ?? f.projectId}: ${f.title}` });
    }
    return out;
  }, [filtered, allProjects, projectFilter, followups, projectsById]);

  const open = openId != null ? tasks.find((t) => t.id === openId) ?? null : null;

  const setSite = async (taskId: number, status: string, url: string) => {
    const s = slugForTask(tasks.find((t) => t.id === taskId));
    if (!s) return;
    await setBacklinkSite(taskId, s, status, url);
    start(() => router.refresh());
  };
  const setSchedule = async (taskId: number, date: string) => {
    const s = slugForTask(tasks.find((t) => t.id === taskId));
    if (!s) return;
    await setBacklinkSchedule(taskId, s, date);
    start(() => router.refresh());
  };
  const setResume = async (taskId: number, r: TaskResume) => { await setTaskResume(taskId, r); start(() => router.refresh()); };

  if (!slug && !allProjects) {   // global /plays has no single slug — each task carries its own
    return (
      <div style={{ padding: 24, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Project này chưa phải site theo dõi backlink. Thêm site vào <code>BACKLINK_SITES</code> (lib/backlink-sites.ts) để bật.
      </div>
    );
  }

  // One list row — shared by the flat list and each group section.
  // Fixed column widths so list rows line up as real columns (not free-flowing badges).
  const COL = { date: 104, acct: 96, asgn: 108, status: 84, live: 40 };
  // One canonical date per task for the Ngày column: done > awaiting-approval > scheduled.
  const taskDate = (t: BacklinkTask): { icon: string; text: string; color: string; title: string } | null => {
    if (t.siteDoneAt) return { icon: '✓', text: localDay(t.siteDoneAt), color: '#22c55e', title: 'Ngày đặt link xong' };
    if (t.siteState === 'submitted' && t.siteSubmittedAt) return { icon: '⏳', text: `chờ ${daysSince(t.siteSubmittedAt)}d`, color: '#9d6cff', title: `Gửi chờ duyệt từ ${t.siteSubmittedAt.slice(0, 10)}` };
    if (t.siteScheduledAt && !t.siteDoneAt) return { icon: '🗓', text: t.siteScheduledAt.slice(0, 10), color: '#ffb03c', title: 'Ngày hẹn làm' };
    return null;
  };
  // cols = list view → fixed columns + Ngày cell. Kanban (cols=false) = vertical card:
  // title on top (2-line clamp, not truncated), meta row below. Same row height in a narrow column.
  const rowEl = (t: BacklinkTask, cols = false) => {
    const d = taskDate(t);
    const tierBtn = (
      <button type="button" onClick={(e) => { e.stopPropagation(); cycleTier(t.id, t.tier); }}
        title={t.tier ? `Tier ${t.tier} (giá trị) — click đổi A→B→C→bỏ` : 'Đánh dấu tier giá trị để tập trung — click'}
        style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.tier ? (TIER_META[t.tier]?.color ?? 'var(--line)') : 'var(--line)'}`, background: t.tier ? (TIER_META[t.tier]?.bg ?? 'transparent') : 'transparent', color: t.tier ? (TIER_META[t.tier]?.color ?? 'var(--fg-4)') : 'var(--fg-4)', cursor: 'pointer', fontSize: 11, fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t.tier || '☆'}
      </button>
    );
    const badges = (
      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Metadata = trung tính (YDNI màu): project/host/DA/type/traffic/draft chỉ là ngữ cảnh, KHÔNG
            tô. Màu chỉ dành cho tín hiệu cần chú ý: blocker 🚩, chờ-duyệt quá hạn, cần account. */}
        {t.communitySeed && <SeedStrip g={t.seedGate} />}
        {allProjects && t.projectLabel && <span onClick={(e) => { e.stopPropagation(); setProjectFilter((v) => v === t.projectSlug ? '' : (t.projectSlug ?? '')); }} title={`Lọc theo ${t.projectLabel}`} style={{ fontSize: 9.5, fontWeight: 600, padding: '0 5px', borderRadius: 5, lineHeight: 1.55, cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--fg-3)', border: '1px solid var(--line)' }}>{t.projectEmoji} {t.projectLabel}</span>}
        {(() => { const h = showHost(t.sourceUrl, t.projectSlug); return h ? <a href={wrapExternalUrl(t.sourceUrl!)} {...EXT} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--fg-2)', textDecoration: 'underline dotted' }}>↗ {h}</a> : null; })()}
        {t.da && <Tag>DA {t.da}</Tag>}
        {t.dofollow && <Tag>{t.dofollow}</Tag>}
        {t.traffic && <Tag>{t.traffic}</Tag>}
        {t.draftPlan?.items?.length ? <Tag>📋 {t.draftPlan.items.length} comment</Tag> : (t.hasDraft && <Tag>📋 draft</Tag>)}
        {t.draftReview?.status === 'pending' && <Tag color="var(--bad,#ef4444)">🔴 chờ duyệt</Tag>}
        {t.draftReview?.status === 'changes' && <Tag color="#ffb03c">✏️ cần sửa</Tag>}
        {t.draftReview?.status === 'approved' && <Tag color="#22c55e">✅ đã duyệt</Tag>}
        {/* Date-ish tags stay inline only in compact (kanban) mode; list has a Ngày column. */}
        {!cols && t.siteState === 'submitted' && t.siteSubmittedAt && (() => { const dd = daysSince(t.siteSubmittedAt); return <Tag color={dd > 30 ? 'var(--bad,#ef4444)' : dd > 14 ? '#ffb03c' : 'var(--fg-3)'}>⏳ chờ duyệt {dd}d</Tag>; })()}
        {!cols && t.siteScheduledAt && !t.siteDoneAt && (() => { const overdue = t.siteScheduledAt.slice(0, 10) <= todayLocal(); /* ngày người dùng nhập ⇒ so hôm nay LOCAL, không phải UTC */ return <span title={overdue ? 'Đến hạn follow — kiểm tra đã duyệt chưa' : 'Ngày follow-up (kiểm tra duyệt)'}><Tag color={overdue ? '#ffb03c' : 'var(--fg-3)'}>🗓 follow {t.siteScheduledAt.slice(0, 10)}</Tag></span>; })()}
        {!cols && t.siteDoneAt && <Tag>✓ {localDay(t.siteDoneAt)}</Tag>}
        {t.siteLiveUrl && (() => { const m = verifyMeta(t.siteVerify); return m ? <Tag color={m.c}>{m.t}</Tag> : null; })()}
        {t.appliesTo.length > 1 && <Tag>+{t.appliesTo.length - 1} sites</Tag>}
        {t.blocker && (t.blocker.paused ? <Tag color="#ffb03c">⏸ tạm dừng</Tag> : <Tag color="var(--bad,#ef4444)">🚩 vướng</Tag>)}
        {!t.blocker && t.resolved && <Tag color="#22c55e">🟢 vừa gỡ vướng</Tag>}
        {(() => { const it = intelFor(t); const b = it && automationBadge(it.automation); if (!b) return null; const gate = it!.obstacles?.[0]; return <span title={`Nguồn tự học: ${it!.automation}${it!.obstacles?.length ? ' · ' + it!.obstacles.map((o) => o.type + (o.stage ? '@' + o.stage : '')).join(', ') : ''}`}><Tag color={b.color}>{b.icon} {b.label}{gate ? ' · ' + gate.type : ''}</Tag></span>; })()}
        {needsBrowser(t) && <span title="Project chưa có browser profile → không chạy được task. Tạo: browsers new <label> <slug> <gmail> <project>"><Tag color="#ffb03c">⚠ cần browser</Tag></span>}
      </div>
    );
    const cardStyle: CSSProperties = { display: 'flex', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer', background: t.tier === 'A' ? 'rgba(245,197,24,0.05)' : 'var(--bg-1)', ...(t.tier ? { borderLeft: `3px solid ${TIER_META[t.tier]?.color ?? 'var(--line)'}` } : {}) };

    if (!cols) {
      // Kanban card — vertical so the title gets full width (2 lines) instead of "Bio-only …".
      // content-visibility: skip layout/paint for off-screen cards (columns can hold ~300) — 0 deps.
      return (
        <div key={t.id} onClick={() => openTask(t.id)} style={{ ...cardStyle, flexDirection: 'column', gap: 7, contentVisibility: 'auto', containIntrinsicSize: 'auto 68px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
            {tierBtn}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div title={t.title} style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{t.title}</div>
              {badges}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 32 }}>
            <AcctChip task={t} onClick={(e) => goAccount(e, t)} />
            <div onClick={(e) => e.stopPropagation()}><AssigneeCell taskId={t.id} name={t.assignee || ''} assignedId={t.assignedUserId} onChange={() => start(() => router.refresh())} /></div>
            {/* Status Pill bỏ ở kanban — card đã nằm trong cột trạng thái (header cột báo màu). Redundant. */}
            {t.siteLiveUrl && <a href={wrapExternalUrl(t.siteLiveUrl)} {...EXT} onClick={(e) => e.stopPropagation()} title="Live backlink" style={{ fontSize: 11, color: 'var(--fg-2)' }}>live ↗</a>}
          </div>
        </div>
      );
    }
    // List row — fixed columns, single-line title.
    return (
    <div key={t.id} onClick={() => openTask(t.id)} style={{ ...cardStyle, alignItems: 'center', gap: 10 }}>
      {tierBtn}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
        {badges}
      </div>
      <div style={{ width: COL.date, flexShrink: 0, fontSize: 11 }} title={d?.title}>
        {d ? <span style={{ color: d.color }}>{d.icon} {d.text}</span> : <span style={{ color: 'var(--fg-4)' }}>—</span>}
      </div>
      <div style={{ width: COL.acct, flexShrink: 0, display: 'flex' }}><AcctChip task={t} onClick={(e) => goAccount(e, t)} /></div>
      <div onClick={(e) => e.stopPropagation()} style={{ width: COL.asgn, flexShrink: 0 }}><AssigneeCell taskId={t.id} name={t.assignee || ''} assignedId={t.assignedUserId} onChange={() => start(() => router.refresh())} /></div>
      <div style={{ width: COL.status, flexShrink: 0, display: 'flex' }}><Pill status={t.siteState} /></div>
      <div style={{ width: COL.live, flexShrink: 0, textAlign: 'center' }}>{t.siteLiveUrl && <a href={wrapExternalUrl(t.siteLiveUrl)} {...EXT} onClick={(e) => e.stopPropagation()} title="Live backlink" style={{ fontSize: 11, color: 'var(--ok)' }}>live ↗</a>}</div>
    </div>
    );
  };

  // Column header for the list view — aligns with the fixed widths above.
  const listHead = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 2px', fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-4)' }}>
      <span style={{ width: 24, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>Nguồn</span>
      <span style={{ width: COL.date, flexShrink: 0 }}>Ngày</span>
      <span style={{ width: COL.acct, flexShrink: 0 }}>Account</span>
      <span style={{ width: COL.asgn, flexShrink: 0 }}>Người</span>
      <span style={{ width: COL.status, flexShrink: 0 }}>Trạng thái</span>
      <span style={{ width: COL.live, flexShrink: 0 }} />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, margin: 0 }}>
          {allProjects ? 'Plays' : 'Backlinks'} <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 8 }}>// {allProjects ? 'All projects' : siteLabel} · {kpi.total} {allProjects ? 'plays' : 'sources'}</small>
        </h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-2)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
            title="Tự động refresh dữ liệu board mỗi 10s (bỏ tick để tắt)">
            <input type="checkbox" checked={realtime} onChange={(e) => setRealtime(e.target.checked)} style={{ cursor: 'pointer' }} />
            <span style={{ color: realtime ? 'var(--neon-lime, #22c55e)' : 'var(--fg-3)', fontWeight: 600 }}>{realtime ? '🟢 Realtime' : '⚪ Realtime'}</span>
          </label>
          <a href="/catalog" style={{ ...btn, textDecoration: 'none', color: 'var(--accent)' }} title="Quản lý phương pháp (catalog mẫu play dùng chung) — theo Nhóm · Level">📋 Phương pháp</a>
          {!allProjects && (
            <button type="button" onClick={doAutoMedia} disabled={autoMedia === 'busy'} style={{ ...btn, color: 'var(--accent)' }}
              title="Tự chuẩn bị media: cover OG + screenshot trang + logo → lưu vào Media vault">
              {autoMedia === 'busy' ? '⏳ đang chuẩn bị…' : autoMedia ? `✓ ${autoMedia}` : '⚡ Auto media'}
            </button>
          )}
          <button type="button" onClick={doCheckLinks} disabled={chk === 'busy'} style={{ ...btn }}
            title="Kiểm tra sức khoẻ mọi link đã đặt (còn sống? dofollow?) — kết quả hiện badge ngay trong list">
            {chk === 'busy' ? '⏳ đang kiểm…' : chk ? `✓ ${chk}` : '🔍 Check links'}
          </button>
          {!allProjects && <>
          <button type="button" onClick={openSeed} style={{ ...btn, color: 'var(--accent)' }} title="Seed nguồn backlink từ catalog dùng chung (mọi dự án) — lọc theo audience, tạo task hàng loạt">➕ Seed catalog</button>
          <button type="button" onClick={doGeneratePlays} disabled={genBusy} style={{ ...btn, color: 'var(--accent)' }} title="Sinh play chuẩn cho site này từ các play-source tái dùng (AlternativeTo · Product Hunt · GitHub · HARO/Featured · Reddit · Quora · Wikipedia · Show HN) — fill param theo product, dedup. Sửa template ở catalog sẽ lan về đây (living-template).">
            {genBusy ? '⏳ đang sinh…' : genMsg && genMsg.startsWith('✓') ? genMsg : '🎯 Generate plays'}
          </button>
          <button type="button" onClick={doNormalize} disabled={normBusy} style={{ ...btn }} title="Chuẩn hoá khuôn cho các task hướng dẫn còn sơ sài (thiếu bước/📍) của site này — AI reshape giữ nội dung, không bịa">
            {normBusy ? '⏳ đang chuẩn hoá…' : normMsg && normMsg.startsWith('✓') ? normMsg : '✨ Chuẩn khuôn'}
          </button>
          <button type="button" onClick={openTrash} style={{ ...btn }} title="Nguồn đã drop — khôi phục bất cứ lúc nào">🗑 Đã drop</button>
          <a href={`/architecture?obj=backlink&site=${slug}`} style={{ ...btn, textDecoration: 'none' }} title="Mở bird's-eye cross-project trong Architect">↗ Architect</a>
          </>}
        </div>
      </div>
      {/* Drawer sản phẩm đang dựng — đọc được bản thảo, không phải đi lục file. */}
      {openProd && (() => {
        const p = products.find((x) => x.slug === openProd);
        if (!p) return null;
        return (
          <Drawer onClose={() => setOpenProd(null)} width={860}>
            <><div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>📕 {p.title}</div><ProductDrawer p={p} onOpenCard={(id) => { setOpenProd(null); setOpenId(id); }} /></>
          </Drawer>
        );
      })()}
      {trashOpen && (
        <Drawer onClose={() => setTrashOpen(false)} width={520}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🗑 Nguồn đã drop</h2>
            <button type="button" onClick={() => setTrashOpen(false)} style={{ ...btn, padding: '2px 9px' }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 10 }}>Drop cả cụm cùng nguồn lưu ở đây — bấm khôi phục là dựng lại mọi task đã xoá (giữ nguyên id/status/URL).</div>
          {trash === null ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>đang tải…</div>
            : trash.length === 0 ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Chưa drop nguồn nào.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trash.map((e) => (
                  <div key={e.id} style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '9px 11px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--fg-1)', wordBreak: 'break-all' }}>{e.source_url ? hostOf(e.source_url) : '(no source)'} <span style={{ color: 'var(--fg-4)' }}>· {e.count} task</span></div>
                      {e.reason && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>{e.reason}</div>}
                      <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 2 }}>{fmtWhen(e.at)}</div>
                    </div>
                    <button type="button" onClick={() => restoreTrash(e.id)} style={{ ...btn, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>↩ Khôi phục</button>
                  </div>
                ))}
              </div>}
        </Drawer>
      )}

      {seedOpen && (() => {
        const auds = seedSrcs ? [...new Set(seedSrcs.flatMap((s) => s.audienceTags))].sort() : [];
        const cats = seedSrcs ? [...new Set(seedSrcs.map((s) => s.category).filter(Boolean) as string[])].sort() : [];
        const qLow = seedQ.trim().toLowerCase();
        const trafRank = (t: string | null) => (t === 'high' ? 3 : t === 'medium' ? 2 : t === 'low' ? 1 : 0);
        const shown = (seedSrcs || [])
          .filter((s) =>
            (!seedAud || s.audienceTags.includes(seedAud)) &&
            (!seedCat || s.category === seedCat) &&
            (!seedHideUsed || !s.usedByHere) &&
            (!qLow || `${s.name} ${s.canonicalUrl} ${s.audienceTags.join(' ')}`.toLowerCase().includes(qLow)))
          .sort((a, b) =>
            seedSort === 'da' ? (Number(b.da) || 0) - (Number(a.da) || 0)
              : seedSort === 'usage' ? b.usageCount - a.usageCount
              : seedSort === 'traffic' ? trafRank(b.traffic) - trafRank(a.traffic)
              : seedSort === 'name' ? a.name.localeCompare(b.name)
              : 0);
        const newCount = seedSel.size;
        const inp: CSSProperties = { fontSize: 12, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' };
        const lblCol: CSSProperties = { fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', width: 52, flexShrink: 0 };
        return (
          <Drawer onClose={() => setSeedOpen(false)} width={660} backgrounded={!!srcEdit} bodyStyle={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>➕ Seed từ catalog nguồn</h2>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" onClick={() => setSrcEdit({})} style={{ ...btn, color: 'var(--accent)', padding: '2px 9px' }} title="Thêm nguồn mới vào catalog dùng chung">➕ Thêm nguồn</button>
                <button type="button" onClick={() => setSeedOpen(false)} style={{ ...btn, padding: '2px 9px' }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 10, flexShrink: 0 }}>
              Catalog nguồn dùng chung cho mọi dự án. Chọn nguồn → tạo task cho <b>{siteLabel}</b>. Nguồn đã có tự bỏ qua. <code>{'{product}'}</code>/<code>{'{domain}'}</code> điền sẵn; ví dụ chủ đề trong hướng dẫn nhớ chỉnh cho đúng sản phẩm.
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexShrink: 0 }}>
              <input value={seedQ} onChange={(e) => setSeedQ(e.target.value)} autoComplete="off" placeholder="🔎 tìm tên / URL / tag…" style={{ ...inp, flex: 1, minWidth: 0 }} />
              <select value={seedSort} onChange={(e) => setSeedSort(e.target.value)} title="Sắp xếp" style={{ ...inp, padding: '5px 6px' }}>
                <option value="">Mặc định</option>
                <option value="usage">Nhiều dự án dùng</option>
                <option value="da">DA cao</option>
                <option value="traffic">Traffic cao</option>
                <option value="name">Tên A→Z</option>
              </select>
              <button type="button" onClick={() => setSeedHideUsed((v) => !v)} title="Ẩn nguồn site này đã có" style={chip('var(--fg-2)', seedHideUsed)}>ẩn đã có</button>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center', flexShrink: 0 }}>
              <span style={lblCol}>Niche</span>
              {auds.map((a) => <button key={a} type="button" onClick={() => setSeedAud(seedAud === a ? '' : a)} style={chip('var(--accent)', seedAud === a)}>{a}</button>)}
            </div>
            {cats.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={lblCol}>Channel</span>
                {cats.map((c) => <button key={c} type="button" onClick={() => setSeedCat(seedCat === c ? '' : c)} style={chip('var(--fg-2)', seedCat === c)}>{c}</button>)}
              </div>
            )}
            {seedSrcs && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginBottom: 6, flexShrink: 0 }}>{shown.length}/{seedSrcs.length} nguồn{(seedAud || seedCat || qLow || seedHideUsed) ? ' (đã lọc)' : ''}</div>}
            {seedSrcs === null ? <div style={{ fontSize: 12, color: 'var(--fg-4)', flex: 1 }}>đang tải catalog…</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {shown.map((s) => (
                    <div key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                      <label style={{ flex: 1, minWidth: 0, display: 'flex', gap: 9, alignItems: 'flex-start', border: '1px solid var(--line)', borderRadius: 8, background: s.usedByHere ? 'var(--bg-2)' : 'var(--bg-1)', padding: '8px 10px', cursor: s.usedByHere ? 'default' : 'pointer', opacity: s.usedByHere ? 0.55 : 1 }}>
                        <input type="checkbox" disabled={s.usedByHere} checked={s.usedByHere || seedSel.has(s.id)} onChange={() => toggleSeed(s.id)} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-1)' }}>{s.name} {s.usedByHere && <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 400 }}>· đã có</span>}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span>{s.category}</span>
                            {s.dofollow && <span style={{ color: s.dofollow === 'dofollow' ? 'var(--good,#39c07a)' : 'var(--fg-4)' }}>{s.dofollow}</span>}
                            {s.da && <span>DA {s.da}</span>}
                            {s.usageCount > 0 && <span title="Số dự án đang dùng nguồn này" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.usageCount} dự án</span>}
                            <span style={{ color: 'var(--fg-4)' }}>{s.audienceTags.join(' · ')}</span>
                          </div>
                        </div>
                      </label>
                      <button type="button" onClick={() => setSrcEdit(s)} title="Sửa nguồn trong catalog" style={{ ...btn, padding: '2px 8px', flexShrink: 0 }}>✎</button>
                    </div>
                  ))}
                  {shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Không có nguồn nào khớp bộ lọc.</div>}
                </div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', flexShrink: 0 }}>
              <button type="button" onClick={doSeed} disabled={seedBusy || newCount === 0} style={{ ...btn, background: 'var(--accent)', color: '#fff', borderColor: 'transparent', fontWeight: 700, opacity: newCount === 0 ? 0.5 : 1 }}>{seedBusy ? '⏳ đang tạo…' : `➕ Seed ${newCount} nguồn`}</button>
              {seedMsg && <span style={{ fontSize: 12, color: seedMsg.startsWith('✓') ? 'var(--good,#39c07a)' : 'var(--bad,#ef4444)' }}>{seedMsg}</span>}
            </div>
          </Drawer>
        );
      })()}

      {srcEdit && <SourceEditor initial={srcEdit} onClose={() => setSrcEdit(null)} onSaved={async () => { setSrcEdit(null); await reloadSeed(); }} />}

      {/* Sản phẩm đang dựng: ở view Lịch nó nằm trong cột trái, ngay dưới mini-month (chỗ trống sẵn có,
          đứng cạnh lịch làm việc). Ở List/Kanban không có cột đó nên đưa lên đầu trang, trên cả KPI —
          thứ đang được làm ra để bán đứng trước bộ đếm backlink. */}
      {view !== 'calendar' && <ProductStrip products={shownProducts} projects={allProjects ? projectsById : undefined} onOpen={setOpenProd} />}

      {/* KPI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {([['total', 'Total', 'var(--fg-1)'], ...STATUS_ORDER.map((s) => [s, SITE_STATUS[s]!.label, SITE_STATUS[s]!.color] as const)] as const).map(([k, label, c]) => (
          <div key={k} style={{ flex: '1 1 90px', minWidth: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: 'var(--font-mono)' }}>{kpi[k]}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* account-readiness rollup — per-project only (hidden in the global /plays aggregate) */}
      {!allProjects && (<div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)', fontSize: 11 }}>
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
            {prep.missing.map(([k, { label, role }]) => (
              <button key={k} type="button" onClick={() => openCreateAccount(k, undefined, role)} title={`Tạo account — nên loại ${ACCOUNT_ROLE_META[role].label}: ${ACCOUNT_ROLE_META[role].why}`} style={{ ...btn, color: 'var(--accent)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>➕ {label} <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ACCOUNT_ROLE_META[role].color, border: `1px solid ${ACCOUNT_ROLE_META[role].color}`, borderRadius: 3, padding: '0 4px' }}>{ACCOUNT_ROLE_META[role].badge}</span></button>
            ))}
          </div>
        )}
      </div>)}

      {/* Row 1 — YDNI essentials: search · work-type spine (scales to ✉ email later) · ⚙ advanced popover · view */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="tìm task (tên/URL/method/niche)…" width={240} />
        <Segmented options={[{ value: '', label: 'All' }, { value: 'acquire', label: '🔗 Acquire' }, { value: 'seed', label: '🌱 Seed' }]} value={workType} onChange={(v) => setWorkType(v as '' | 'acquire' | 'seed')} />
        {(() => {
          const advN = [follow, traf, draftOnly, blockedOnly, tierFilter].filter(Boolean).length;
          return (
            <Popover label="⚙ Lọc" active={advN > 0} badge={advN || undefined} minWidth={230}>
              {() => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {workType !== 'seed' && (<>
                    <div><div style={flbl}>Link</div><div style={frow}>{['dofollow', 'nofollow', 'mixed'].map((f) => <button key={f} type="button" onClick={() => setFollow(follow === f ? '' : f)} style={fchip(follow === f)}>{f}</button>)}</div></div>
                    <div><div style={flbl}>Traffic</div><div style={frow}>{['high', 'medium', 'low'].map((f) => <button key={f} type="button" onClick={() => setTraf(traf === f ? '' : f)} style={fchip(traf === f)}>{f}</button>)}</div></div>
                  </>)}
                  <div><div style={flbl}>Tier giá trị</div><div style={frow}>{(['A', 'B', 'C'] as const).map((tv) => <button key={tv} type="button" onClick={() => setTierFilter(tierFilter === tv ? '' : tv)} title={tv === 'A' ? 'high-value seeding' : tv === 'B' ? 'outreach' : 'directory'} style={fchip(tierFilter === tv)}>★{tv}</button>)}<button type="button" onClick={() => setTierFilter(tierFilter === 'any' ? '' : 'any')} title="Chỉ task đã gắn tier" style={fchip(tierFilter === 'any')}>★ tiered</button></div></div>
                  <div><div style={flbl}>Cờ</div><div style={frow}><button type="button" onClick={() => setDraftOnly((v) => !v)} style={fchip(draftOnly)}>📋 ready</button><button type="button" onClick={() => setBlockedOnly((v) => !v)} title="Chỉ task nhân sự báo vướng" style={fchip(blockedOnly, '#ef4444')}>🚩 vướng</button></div></div>
                  {advN > 0 && <button type="button" onClick={() => { setFollow(''); setTraf(''); setDraftOnly(false); setBlockedOnly(false); setTierFilter(''); }} style={{ ...btn, alignSelf: 'flex-start' }}>Xoá lọc</button>}
                </div>
              )}
            </Popover>
          );
        })()}
        <ViewToggle style={{ marginLeft: 'auto' }} options={[...LIST_CALENDAR_VIEWS, { value: 'kanban', label: '▦ Kanban', title: 'Kanban theo trạng thái' }]} value={view} onChange={(v) => setView(v as 'list' | 'calendar' | 'kanban')} />
        {view === 'list' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--fg-3)' }} title="Nhóm danh sách theo tiêu chí (không đổi bộ lọc)">
            <span>nhóm</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'none' | 'platform' | 'status' | 'readiness')} style={{ ...btn, cursor: 'pointer', padding: '3px 6px' }}>
              <option value="none">— không —</option><option value="platform">platform</option><option value="status">trạng thái</option><option value="readiness">độ sẵn sàng</option>
            </select>
          </label>
        )}
      </div>

      {/* Row 2 — status. Shared vault-list FilterChips: single-select chip group + counts, one YDNI accent. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Ẩn xong/bỏ/lỗi thì GIẤU LUÔN 4 chip đó sau một chip bật — 9 chip xuống 6, và không còn
            cảnh bấm "Completed" ra danh sách rỗng. Bấm chip = hiện lại cả 4 chip lẫn task. */}
        <FilterChips<TabKey>
          value={tab} onChange={setTab}
          options={[...STATUS_ORDER.filter((s) => !hideClosed || !CLOSED.has(s)).map((s) => ({ value: s, label: SITE_STATUS[s]!.label })), { value: 'all' as const, label: 'All' }]}
          counts={STATUS_ORDER.reduce<Partial<Record<TabKey, number>>>((a, s) => { a[s] = kpi[s] ?? 0; return a; },
            { all: hideClosed ? STATUS_ORDER.reduce((n, s) => n - (CLOSED.has(s) ? (kpi[s] ?? 0) : 0), kpi.total ?? 0) : kpi.total })}
        />
        {(closedN > 0 || showClosed) && (
          <label title="Việc đã xong, đã bỏ, link lỗi. Lựa chọn được nhớ cho lần mở sau."
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11,
              padding: '2px 9px', borderRadius: 999, border: `1px solid ${showClosed ? 'var(--accent)' : 'var(--line)'}`,
              background: showClosed ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
              color: showClosed ? 'var(--fg-1)' : 'var(--fg-3)' }}>
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} style={{ cursor: 'pointer', margin: 0 }} />
            hiện việc đã xong/bỏ/lỗi{!showClosed && closedN > 0 ? ` (${closedN})` : ''}
          </label>
        )}
      </div>

      {/* Row 3 — project (global /plays only): searchable select, YDNI >5-items rule */}
      {allProjects && (() => {
        const projs = Array.from(new Map(tasks.map((t) => [t.projectSlug, { slug: (t.projectSlug || '') as string, label: t.projectLabel || t.projectSlug || '', emoji: t.projectEmoji || '' }])).values())
          .filter((p) => p.slug)
          .map((p) => ({ ...p, count: tasks.filter((t) => t.projectSlug === p.slug).length }))
          .sort((a, b) => b.count - a.count);
        // Lần chạm gần nhất của một project = mốc muộn nhất trong mọi task của nó (xong /
        // gửi chờ duyệt / tạo). Project hay dùng thì nằm ngay ngoài, không phải mở select
        // rồi gõ tìm — select giữ lại cho phần đuôi dài.
        const touched = (slug: string) => tasks.reduce<string>((mx, t) => (t.projectSlug !== slug ? mx
          : [t.siteDoneAt, t.siteSubmittedAt, t.createdAt].reduce<string>((m, d) => (d && d > m ? d : m), mx)), '');
        const recent = projs.slice().map((p) => ({ ...p, at: touched(p.slug) }))
          .sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : b.count - a.count)).slice(0, 6);
        const chip = (active: boolean): React.CSSProperties => ({
          ...btn, cursor: 'pointer', padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap',
          borderColor: active ? 'var(--accent)' : 'var(--line)', color: active ? 'var(--fg-1)' : 'var(--fg-3)',
        });
        return (
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Project</span>
            <ProjectFilterSelect projects={projs} value={projectFilter} onChange={setProjectFilter} />
            {projectFilter && (
              <button type="button" onClick={() => setProjectFilter('')} style={chip(false)} title="Bỏ lọc project">✕ tất cả</button>
            )}
            {recent.map((p) => (
              <button key={p.slug} type="button" onClick={() => setProjectFilter(projectFilter === p.slug ? '' : p.slug)}
                style={chip(projectFilter === p.slug)} title={`${p.label} · ${p.count} plays${p.at ? ` · chạm ${localDay(p.at)}` : ''}`}>
                {p.emoji} {p.label} <span style={{ color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {view === 'kanban' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
          {STATUS_ORDER.filter((st) => !hideClosed || !CLOSED.has(st)).map((st) => {
            const col = shown.filter((t) => t.siteState === st);
            // Terminal columns: most-recently-touched on top (just-finished shouldn't sink to the
            // bottom under stale tier order). Actionable columns keep the tier sort (do-next first).
            if (TERMINAL_STATES.has(st)) {
              const recTs = (t: BacklinkTask) => t.siteDoneAt || t.siteSubmittedAt || t.siteScheduledAt || '';
              col.sort((a, b) => recTs(b).localeCompare(recTs(a)));
            }
            return (
              <div key={st} style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: SITE_STATUS[st]!.color, paddingLeft: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: SITE_STATUS[st]!.color }} />
                  {SITE_STATUS[st]!.label}<span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>{col.length}</span>
                </div>
                {/* Column scrolls internally so a 300-card column doesn't stretch the page to infinity. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: col.length > 6 ? 4 : 0 }}>
                  {col.map((t) => rowEl(t))}
                  {!col.length && <div style={{ fontSize: 11, color: 'var(--fg-4)', padding: '6px 2px' }}>—</div>}
                </div>
              </div>
            );
          })}
          {!shown.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, gridColumn: '1 / -1' }}>Không có task ở tab này.</div>}
        </div>
      ) : view === 'calendar' ? (
        <MonthCalendar legend={CAL_LEGEND} items={calItems} onItemClick={(id) => { const s = String(id); if (s.startsWith('f:')) setOpenFollowupId(Number(s.slice(2))); else openTask(Number(id)); }} mode={calMode} onModeChange={setCalMode} date={calDate} onDateChange={setCalDate}
          sidebar={<ProductStrip products={shownProducts} projects={allProjects ? projectsById : undefined} onOpen={setOpenProd} narrow />} />
      ) : grouped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.length > 0 && listHead}
          {grouped.map((g) => (
            <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 2 }}>
                {g.label}<span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>{g.items.length}</span>
              </div>
              {g.items.map((t) => rowEl(t, true))}
            </div>
          ))}
          {!shown.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Không có task ở tab này.</div>}
        </div>
      ) : (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.length > 0 && listHead}
        {pageItems.map((t) => rowEl(t, true))}
        {!shown.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Không có task ở tab này.</div>}
      </div>
      <Pager {...pager} onPage={pager.setPage} />
      </>
      )}

      {open && <TaskDrawer task={open} slug={slugForTask(open) ?? ''} project={projectForTask(open)} accounts={accounts} media={media} backgrounded={!!acctModal || outreachPid != null} onOpenOutreach={setOutreachPid} onClose={closeTask} setSite={setSite} setSchedule={setSchedule} setResume={setResume} onChange={() => start(() => router.refresh())} onCreateAccount={openCreateAccount} onEditAccount={openEditAccount} onOpenTask={openTask} onDelete={deleteTask} onDropSource={dropSource} />}
      {openFollowupId != null && (() => { const f = followups.find((x) => x.id === openFollowupId); return f ? <FollowupDrawer followup={f} projectLabel={allProjects ? (projectsById?.[f.projectId]?.name ?? f.projectId) : siteLabel} onClose={() => setOpenFollowupId(null)} /> : null; })()}
      {/* Outreach drawer — page-level + URL-driven (?outreach=<pid>), stacked ON the task drawer. Standard pattern (parent owns both open states). */}
      {open && outreachPid != null && <TaskOutreachDrawer projectId={projectForTask(open).id} prospectId={outreachPid} initialChannel={outreachCh} onChannel={setOutreachCh} onClose={() => { setOutreachPid(null); setOutreachCh(''); }} onChange={() => start(() => router.refresh())} />}

      {undoRows && undoRows.length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 400, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line-2)', boxShadow: '0 8px 30px rgba(0,0,0,.4)', fontSize: 13 }}>
          <span>{undoRows.length > 1 ? <>Đã drop <b>{undoRows.length}</b> task cùng nguồn</> : <>Đã xoá task <b>{String(undoRows[0]?.title || '')}</b></>}</span>
          <button type="button" onClick={undoDelete} style={{ ...btn, color: 'var(--accent)', fontWeight: 700 }}>↩ Hoàn tác</button>
        </div>
      )}

      {/* Account create/edit in-place as a right-side DRAWER — stacks above the task drawer. */}
      {acctModal && (
        <div style={{ position: 'relative', zIndex: 300 }}>
          <AccountFormModal account={acctModal.account} project={projectForTask(open)} projectId={projectForTask(open).id}
            platforms={platforms} presetPlatformKey={acctModal.platformKey} presetAccountType={acctModal.recommendedRole}
            teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles}
            onCreated={acctModal.assignToTask != null ? (async (newId: number) => { await setBacklinkAccount(acctModal.assignToTask!, newId); setAcctModal(null); start(() => router.refresh()); }) : undefined}
            onClose={() => { setAcctModal(null); start(() => router.refresh()); }} />
        </div>
      )}
    </div>
  );
}

// Bàn giao card: inputs (link) + done-when (tiêu chí) + depends-on (id card trước). Điền vào đây =
// 1 chat khác đọc `play show <id>` là nối được, không đoán. Lưu 1 phát qua setTaskResume (merge prep_payload).
function ResumeEditor({ task, onSave, onOpenTask }: { task: BacklinkTask; onSave: (r: TaskResume) => Promise<void>; onOpenTask: (id: number) => void }) {
  const [inputs, setInputs] = useState<TaskInput[]>(task.inputs);
  const [doneWhen, setDoneWhen] = useState(task.doneWhen);
  const [deps, setDeps] = useState(task.dependsOn.join(', '));
  const [saving, setSaving] = useState(false);
  const lbl: CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-3)', marginBottom: 5 };
  const inp: CSSProperties = { padding: '5px 8px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 12.5, fontFamily: 'inherit' };
  const mini: CSSProperties = { padding: '4px 9px', borderRadius: 5, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', fontSize: 11.5, cursor: 'pointer' };
  const setRow = (i: number, k: 'label' | 'url', v: string) => setInputs((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => { setSaving(true); await onSave({ inputs, doneWhen, dependsOn: deps.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0) }); setSaving(false); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div>
        <label style={lbl}>🔗 Đầu vào — link cụ thể (sản phẩm · tài sản/vault · tài liệu đang viết)</label>
        {inputs.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 4 }}>
            <input value={row.label} onChange={(e) => setRow(i, 'label', e.target.value)} placeholder="nhãn" style={{ ...inp, width: 110, flexShrink: 0 }} />
            <input value={row.url} onChange={(e) => setRow(i, 'url', e.target.value)} placeholder="https://…" style={{ ...inp, flex: 1, minWidth: 0 }} />
            <button type="button" onClick={() => setInputs((a) => a.filter((_, j) => j !== i))} style={{ ...mini, color: '#ef4444' }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setInputs((a) => [...a, { label: '', url: '' }])} style={mini}>+ thêm link</button>
      </div>
      <div>
        <label style={lbl}>✅ Xong khi — làm ĐÚNG là khi nào (tiêu chí nghiệm thu)</label>
        <textarea value={doneWhen} onChange={(e) => setDoneWhen(e.target.value)} rows={2} placeholder="vd: PDF+zip xuất ra · cover duyệt ở 48px thật · mô tả English human-voice" style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
      </div>
      <div>
        <label style={lbl}>🧩 Cần trước — id card cần KẾT QUẢ trước (chuỗi phụ thuộc)</label>
        <input value={deps} onChange={(e) => setDeps(e.target.value)} placeholder="vd: 399, 400" style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
        {task.dependsOn.length > 0 && (
          <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {task.dependsOn.map((d) => <button key={d} type="button" onClick={() => onOpenTask(d)} style={{ ...mini, color: 'var(--neon-blue)' }}>#{d} ↗ mở</button>)}
          </div>
        )}
      </div>
      <button type="button" onClick={save} disabled={saving} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--neon-blue)', background: 'color-mix(in srgb, var(--neon-blue) 15%, transparent)', color: 'var(--neon-blue)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>{saving ? 'Đang lưu…' : '💾 Lưu bàn giao'}</button>

    </div>
  );
}

function TaskDrawer({ task, slug, project, accounts, media, backgrounded, onOpenOutreach, onClose, setSite, setSchedule, setResume, onChange, onCreateAccount, onEditAccount, onOpenTask, onDelete, onDropSource }: {
  task: BacklinkTask; slug: string; project: Project; accounts: AccountRow[]; media: MediaRow[]; backgrounded?: boolean; onOpenOutreach: (pid: number) => void; onClose: () => void; setSite: (id: number, status: string, url: string) => Promise<void>; setSchedule: (id: number, date: string) => Promise<void>; setResume: (id: number, r: TaskResume) => Promise<void>; onChange: () => void;
  onCreateAccount: (platformKey: string, assignToTask?: number, recommendedRole?: AccountRole) => void; onEditAccount: (account: AccountRow) => void; onOpenTask: (id: number) => void; onDelete: (id: number) => void; onDropSource: (id: number, reason?: string) => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  // 🌱 link gate: recording a live URL on a community-seed task = a link went out. If the
  // community isn't ready (🔒), arm an inline confirm first (no native dialog) — one more
  // click to override. This is the operator-surface gate; ~/bin/task-run gets its own.
  const seedBlocked = !!(task.communitySeed && task.seedGate && !task.seedGate.ok);
  const [linkArmed, setLinkArmed] = useState(false);
  // Saving a live URL = the backlink is placed → auto-advance an open status to Completed.
  const saveUrl = async () => {
    if (seedBlocked && url.trim() && !linkArmed) { setLinkArmed(true); return; }   // arm, don't save yet
    setLinkArmed(false);
    setSaveState('saving');
    const next = (url.trim() && (task.siteState === 'pending' || task.siteState === 'claimed' || task.siteState === 'submitted' || task.siteState === 'broken')) ? 'completed' : task.siteState;
    await setSite(task.id, next, url);
    setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1800);
  };
  // Staff feedback loop — free-text note (result/opinions) + blocker flag ("I'm stuck, here's why").
  const [note, setNote] = useState(task.workerNote || '');
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveNote = async () => { setNoteState('saving'); await setBacklinkNote(task.id, note); setNoteState('saved'); onChange(); setTimeout(() => setNoteState('idle'), 1800); };
  // "Vừa gỡ vướng" banner: snapshot at open (survives the refresh that clears the DB marker),
  // and clear the marker once so it stops standing out in the list after this view.
  const [justResolved] = useState(task.resolved);
  useEffect(() => { if (task.resolved) seenBacklinkResolved(task.id).then(() => onChange()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [task.id]);
  const [blkOpen, setBlkOpen] = useState(false);
  const [blkReason, setBlkReason] = useState('');
  const [blkShots, setBlkShots] = useState<string[]>([]);
  const [blkBusy, setBlkBusy] = useState(false);
  const flagBlocker = async () => { if (!blkReason.trim()) return; setBlkBusy(true); await setBacklinkBlocker(task.id, blkReason, blkShots[0]); setBlkBusy(false); setBlkOpen(false); setBlkReason(''); setBlkShots([]); onChange(); };
  const clearBlocker = async () => { setBlkBusy(true); await setBacklinkBlocker(task.id, ''); setBlkBusy(false); onChange(); };
  // Draft review — AI drafted, staff approves/requests-changes inline (banner below the blocker banner).
  const [revNote, setRevNote] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const doReview = async (action: 'approve' | 'changes' | 'comment') => {
    if ((action === 'changes' || action === 'comment') && !revNote.trim()) return;
    setRevBusy(true); await submitDraftReview(task.id, action, revNote.trim()); setRevBusy(false); setRevNote(''); onChange();
  };
  // ✨ Chuẩn hoá — AI reshape this task's instructions into the canonical template, grounded on real DOM.
  const [normBusy, setNormBusy] = useState(false);
  type DomSample = NonNullable<Awaited<ReturnType<typeof listTaskDomSamples>>['samples']>[number];
  const [domPicker, setDomPicker] = useState<{ groundedSampleId: number | null; samples: DomSample[] } | null>(null);
  const runNormalize = async (sampleId?: number) => { setDomPicker(null); setNormBusy(true); await normalizeInstructions(task.id, sampleId != null ? { sampleId } : undefined); setNormBusy(false); onChange(); };
  // Catalog-source provenance: view the shared source (+ params) this task derives from.
  const [sourceDetail, setSourceDetail] = useState<Awaited<ReturnType<typeof getBacklinkSourceForTask>> | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  // GET route (not the Server Action) — a Server Action call refetched the whole /plays RSC = slow.
  const openSource = async () => {
    if (!task.catalogSourceId) return;
    setSourceBusy(true);
    try {
      const r = await fetch(`/api/backlink-source/${task.catalogSourceId}?project=${encodeURIComponent(project.id)}`).then((x) => x.json());
      if (r.ok) setSourceDetail(r);
    } finally { setSourceBusy(false); }
  };
  const doNormalize = async () => {
    // Not grounded yet, or a NEWER DOM was captured since last grounding → run immediately.
    // Already grounded on the latest DOM → don't blindly re-run: ask which DOM (with a preview).
    const newerDom = task.domSampleId != null && Number(task.grounded?.sampleId) !== Number(task.domSampleId);
    if (task.grounded && !newerDom) {
      const r = await listTaskDomSamples(task.id);
      if (r.ok && (r.samples?.length ?? 0) > 0) { setDomPicker({ groundedSampleId: r.groundedSampleId ?? null, samples: r.samples ?? [] }); return; }
    }
    await runNormalize();
  };
  // ✨ Chuẩn bị điền — sinh giá trị điền cho từng field form thật (từ DOM đã lưu). Ext auto-fill (P2).
  const [fillBusy, setFillBusy] = useState(false);
  const [fillErr, setFillErr] = useState<string | null>(null);
  const [fillFields, setFillFields] = useState<Array<{ key: string; label: string; type: string; value: string; source: string; confidence: string }> | null>(task.fillFields?.items ?? null);
  const [fillNeedAcct, setFillNeedAcct] = useState(false);
  // Danh tính: auto theo role (deterministic) HOẶC user chọn tay từ full list identities của project.
  const [identities, setIdentities] = useState<Array<{ id: number; name: string; kind: string; email: string; personaName: string }>>([]);
  const [pinnedIdentityId, setPinnedIdentityId] = useState<number | null>(null);
  const [identityUsed, setIdentityUsed] = useState<{ name: string; email: string; kind: string; role: string; source: string } | null>(null);
  useEffect(() => {   // full list identities để override tay (auto vẫn là default)
    let live = true;
    listIdentities(project.id).then((rows) => { if (live) setIdentities(rows.map((i) => ({ id: i.id, name: i.displayName || i.name, kind: i.kind, email: i.email, personaName: [i.persona?.name_first, i.persona?.name_last].filter(Boolean).join(' ') }))); }).catch(() => {});
    return () => { live = false; };
  }, [project.id]);
  // Danh tính resolve DETERMINISTIC theo role (không để LLM quyết): truyền recommendedRole + pinnedIdentityId (chọn tay).
  const doPrepFill = async () => {
    setFillBusy(true); setFillErr(null); setFillNeedAcct(false);
    const r = await prepFillFields(task.id, { resolvedAccountId: task.accountId ?? null, recommendedRole: task.recommendedRole ?? null, pinnedIdentityId });
    setFillBusy(false);
    if (r.ok && r.fields) { setFillFields(r.fields); setIdentityUsed(r.identity ?? null); onChange(); }
    else { setFillErr(r.error || 'lỗi'); if (r.needAccount) setFillNeedAcct(true); }
  };
  // ⚠ report on a specific instruction line → flag the blocker directly (+ optional screenshot).
  const blockWithReason = async (reason: string, shot?: string) => { await setBacklinkBlocker(task.id, reason, shot); onChange(); };
  const mediaNeed = task.platformKey ? MEDIA_NEED[task.platformKey] : undefined;
  // Scope to THIS task's project — the global /plays board ships the whole media vault (listMedia() with no
  // arg); without this filter the drawer rendered every project's images (dozens of <img>) and hung the page.
  const imgs = media.filter((m) => m.projectId === project.id && ((m.mimeType || '').startsWith('image') || m.kind === 'image'));
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
  // Open the account editor. Backlink accounts are tenant-shared, so a task's account may
  // not be in this project's `accounts` list — fetch it by id in that case.
  // Open the standardized account editor (AccountFormModal) for ANY account by id — local to this
  // project or a tenant-shared / cross-project one (fetch by id). Reused by the current-account ✎
  // and every row in the swap picker, so editing an account is available wherever one is shown.
  const editAccountById = async (id: number) => {
    const local = accounts.find((a) => a.id === id) ?? null;
    if (local) { onEditAccount(local); return; }
    const row = await getAccountForEditAny(id);
    if (row) onEditAccount(row);
  };
  const openAcct = async () => { if (task.accountId != null) await editAccountById(task.accountId); };
  // Switch which account this task uses (auto-match may pick another project's shared
  // account). Lazy-load options for the task's platform; pick pins it, "auto" clears.
  const [acctPick, setAcctPick] = useState(false);
  const [acctOpts, setAcctOpts] = useState<Awaited<ReturnType<typeof listBacklinkAccountOptions>> | null>(null);
  const [apq, setApq] = useState('');
  const togglePicker = async () => {
    const next = !acctPick; setAcctPick(next);
    if (next && !acctOpts && task.platformKey) setAcctOpts(await listBacklinkAccountOptions(task.platformKey));
  };
  const pickAcct = async (id: number | null) => { setAcctPick(false); await setBacklinkAccount(task.id, id); onChange(); };
  const acctOptsShown = useMemo(() => { const q = apq.trim().toLowerCase(); const list = acctOpts ?? []; return q ? list.filter((a) => (a.handle || '').toLowerCase().includes(q)) : list; }, [acctOpts, apq]);
  const [url, setUrl] = useState(task.siteLiveUrl || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fmt, setFmt] = useState<DraftFmt>('md');
  const [linkMode, setLinkMode] = useState<LinkMode>('link');
  const [dPrev, setDPrev] = useState(false);   // draft: WYSIWYG rendered preview vs raw source
  const [noImg, setNoImg] = useState(false);   // strip images (platform bans them)
  const [short, setShort] = useState(false);   // use the condensed version
  const [shortDraft, setShortDraft] = useState<string | null>(task.draftShort);   // persisted AI-condensed markdown
  const [condBusy, setCondBusy] = useState(false);
  // Variants to cover platform rules: full/short length, keep/strip images, link mode (incl. no-link).
  // The AI writer embeds project images inline; toggles derive every variant client-side (instant).
  const baseDraft = short && shortDraft ? shortDraft : task.draft;
  const draftFmts = useMemo(() => {
    if (!baseDraft) return null;
    const src = applyLink(noImg ? stripImages(baseDraft) : baseDraft, linkMode);
    return { md: src, html: mdToHtml(src), bbcode: mdToBbcode(src), plain: mdToPlain(src) };
  }, [baseDraft, linkMode, noImg]);
  const toggleShort = async () => {
    if (short) { setShort(false); return; }
    if (shortDraft) { setShort(true); return; }   // already generated (this session or persisted) → instant
    if (!task.draft) return;
    setCondBusy(true); const r = await condenseBacklinkDraft(task.id, task.draft, project.name); setCondBusy(false);
    if (r.ok && r.draft) { setShortDraft(r.draft); setShort(true); onChange(); } else setDerr(r.error || 'lỗi rút gọn');
  };
  // Some placements require you to publish a post/article to embed the link. Offer an
  // AI writer that produces that draft in-drawer (saved to prep_payload.draft → flows below).
  const needsPost = /post|article|blog|write|guest|review|content|đăng|bài/i.test(`${task.mechanism || ''} ${task.instructions || ''} ${task.title || ''}`);
  // Task shape drives what the drawer shows (surface mirrors the real work order):
  //  - email-pitch (resource pages / LibGuides / editorial): the work IS writing an email → lead with an email generator.
  //  - "Built with"/stack chips only matter for shoutout/directory/launch listings — noise elsewhere.
  // Email-SEND card (newsletter blast via Mailjet, title prefixed 📧 / mechanism 'email') is a
  // different work order from a backlink: no source page, no account-to-post, no live backlink to
  // verify. YDNI → the drawer hides all that and shows only content + schedule + status.
  const isEmailSend = detectEmailSend(task.title, task.mechanism);   // 1 định nghĩa (lib/task-kind) — dùng chung calendar + drawer
  const isEmailPitch = !isEmailSend && /\b(email|pitch|editorial|librarian|curator)\b/i.test(`${task.mechanism || ''} ${task.instructions || ''}`);
  const emailTarget = task.platformLabel || (task.sourceUrl ? hostOf(task.sourceUrl) : 'this resource page');
  // Already emailed (site is "submitted") → the next email is a short nudge, not a fresh pitch.
  const isFollowUp = task.siteState === 'submitted';
  const emailKind = isFollowUp
    ? `Short follow-up email nudging the owner of ${emailTarget} about the earlier note suggesting ${project.name} for their resource list`
    : `Outreach email pitching ${project.name} to the owner of ${emailTarget}, asking them to add our free tool to their resource list`;
  const showStack = /built with|shoutout|stack|listing|directory|launch|submit (your|the) (tool|site|app)/i.test(`${task.mechanism || ''} ${task.instructions || ''} ${task.title || ''}`);
  const [dbusy, setDbusy] = useState(false);
  const [derr, setDerr] = useState<string | null>(null);
  // Split a compound placement (e.g. "profile + blog post") into two independently-tracked
  // links. Prefill titles from the source name + the "+"-separated mechanism parts.
  const srcBase = (task.title.split(/[—–-]/)[0] || task.title).trim();
  const mechParts = (task.mechanism || '').split('+').map((s) => s.trim()).filter(Boolean);
  const [splitting, setSplitting] = useState(false);
  const [sa, setSa] = useState(mechParts.length >= 2 ? `${srcBase} — ${mechParts[0]}` : task.title);
  const [sb, setSb] = useState(mechParts.length >= 2 ? `${srcBase} — ${mechParts.slice(1).join(' + ')}` : `${task.title} (2)`);
  const [sbusy, setSbusy] = useState(false);
  const [serr, setSerr] = useState<string | null>(null);
  const [splitDone, setSplitDone] = useState<{ id: number; name: string } | null>(null);
  const doSplit = async () => {
    setSbusy(true); setSerr(null);
    const r = await splitBacklinkTask(task.id, sa, sb);
    setSbusy(false);
    // Keep THIS drawer open (split is an in-lifecycle action) and offer a link to the new
    // task instead of force-navigating into it. See feedback_workflow_continuity.
    if (r.ok && r.newId) { setSplitting(false); setSplitDone({ id: r.newId, name: sb }); onChange(); } else setSerr(r.error || 'lỗi');
  };
  const [delConfirm, setDelConfirm] = useState(false);
  const [dropConfirm, setDropConfirm] = useState(false);
  const [dropReason, setDropReason] = useState('');
  // Link health-check (#3): fetch the placed URL, confirm our domain is linked + dofollow.
  const [vbusy, setVbusy] = useState(false);
  const [vres, setVres] = useState<BacklinkVerify | null>(task.siteVerify);
  const doVerify = async () => {
    setVbusy(true);
    const r = await verifyBacklink(task.id, slug, project.website || '');
    setVbusy(false);
    if (r.ok && r.result) { setVres(r.result); onChange(); }
  };
  // Assigning an owner = "I'm taking this" → auto-advance To-do → In progress so claiming is
  // one action, not assign-then-manually-pick-status. Only bumps from pending (never on clear).
  const onAssign = (userId: number | null) => {
    if (userId != null && task.siteState === 'pending') void setSite(task.id, 'claimed', url);
    onChange();
  };
  const doDraft = async () => {
    setDbusy(true); setDerr(null);
    const r = await generateBacklinkDraft(task.id, {
      projectName: project.name, website: project.website || '', oneLiner: project.oneLiner || '', bio: project.bio || '',
      title: task.title, instructions: task.instructions || '', mechanism: task.mechanism || '',
      images: imgs.map((m) => ({ url: m.url, desc: m.filename || '' })),
    });
    setDbusy(false);
    if (r.ok) { setShortDraft(null); setShort(false); onChange(); } else setDerr(r.error || 'lỗi');
  };
  // AI content pieces: generate any content the task needs, combining full context. Two
  // engines — OpenAI (now) or Claude (queued, fulfilled by a chat session servicing it).
  const [aiList, setAiList] = useState<AiContentRow[]>([]);
  const [aiKind, setAiKind] = useState('');
  const [aiExtra, setAiExtra] = useState('');
  const [aiBusy, setAiBusy] = useState<'' | 'openai' | 'claude'>('');
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiDelId, setAiDelId] = useState<number | null>(null);  // AI-content row pending delete-confirm
  const reloadAi = () => { listAiContent(task.id).then(setAiList).catch(() => {}); };
  useEffect(() => { listAiContent(task.id).then(setAiList).catch(() => {}); }, [task.id]);
  // Build steps that call for written content → one-tap chips to prefill "what to generate".
  const writableSteps = useMemo(() => (task.instructions || '').split('\n').map(stripMarker).filter(Boolean)
    .filter((s) => /viết|write|comment|post|reply|answer|bio|mô tả|describe|caption|tiêu đề|title|pin|thread|explain|giải thích|signature|chữ ký|trả lời|đăng|bài/i.test(s)), [task.instructions]);
  const aiCtx = { projectName: project.name, website: project.website || '', oneLiner: project.oneLiner || '', bio: project.bio || '', platformLabel: task.platformLabel || '', mechanism: task.mechanism || '', instructions: task.instructions || '' };
  const runGen = async (engine: 'openai' | 'claude', kind: string) => {
    setAiBusy(engine); setAiErr(null);
    const r = await generateAiContent({ taskId: task.id, projectId: project.id, site: slug, kind, extra: aiExtra.trim(), engine, ctx: aiCtx });
    setAiBusy('');
    if (r.ok) { reloadAi(); return true; }
    setAiErr(r.error || 'lỗi'); return false;
  };
  const doGen = async (engine: 'openai' | 'claude') => {
    if (!aiKind.trim()) { setAiErr('nhập cần sinh gì'); return; }
    if (await runGen(engine, aiKind.trim())) { setAiKind(''); setAiExtra(''); }
  };
  // Email-pitch tasks: one tap = generate the outreach email directly (kind is fixed), no prefill step.
  const genEmail = (engine: 'openai' | 'claude') => runGen(engine, emailKind);
  // Send-via-Gmail: .edu/librarian pitches go out from a real Gmail (better .edu deliverability +
  // you own the reply thread) — NOT the Mailjet bulk pipeline. Open a Gmail compose deep-link
  // prefilled with the AI email, then mark the task "submitted" so it lands in the Chờ-duyệt tab
  // with the existing follow-up badge. Recipient auto-parsed from the task; none → form-only.
  const recipientEmail = useMemo(() => (`${task.mechanism || ''} ${task.instructions || ''}`.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || '', [task.mechanism, task.instructions]);
  const lastEmail = useMemo(() => aiList.find((a) => a.status === 'done' && a.result && /email|pitch|outreach/i.test(a.kind))?.result || '', [aiList]);
  const [outBusy, setOutBusy] = useState(false);
  // → Outreach: link this direct-contact task to the managed outreach pipeline, then open the Outreach
  // drawer — which the PAGE renders + URL-drives (?outreach=<pid>), stacked on this drawer. Already
  // linked → open immediately. See feedback_url_state + feedback_openable_opens_immediately.
  const openOutreach = async () => {
    if (task.outreach?.prospectId != null) { onOpenOutreach(task.outreach.prospectId); return; }
    setOutBusy(true); setAiErr(null);
    const r = await linkTaskToOutreach(task.id);
    setOutBusy(false);
    if (r.ok && r.prospectId) { onOpenOutreach(r.prospectId); onChange(); }
    else setAiErr(r.error || 'lỗi outreach');
  };
  const doSendEmail = async () => {
    if (!lastEmail) { setAiErr('Sinh email trước đã'); return; }
    const m = lastEmail.match(/^\s*subject:\s*(.+?)\s*\n+([\s\S]*)$/i);
    const subject = m?.[1]?.trim() || `${project.name} - a free tool for your resource page`;
    const body = m?.[2]?.trim() || lastEmail.trim();
    const openUrl = recipientEmail
      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : (task.sourceUrl || '');
    if (openUrl) window.open(openUrl, '_blank', 'noopener');
    await setSite(task.id, 'submitted', url);   // emailed → awaiting reply (Chờ duyệt + follow-up badge)
    onChange();
  };
  const delAi = async (id: number) => { await deleteAiContent(id); reloadAi(); };
  const copy = (txt: string, key: string) => { navigator.clipboard?.writeText(txt).then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1200); }).catch(() => {}); };
  // Rich copy — writes text/html + text/plain so pasting into a WYSIWYG editor keeps formatting.
  const copyRich = async (html: string, key: string) => {
    const plain = html.replace(/<[^>]+>/g, '');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
      setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1200);
    } catch { copy(html, key); }
  };
  const flash = (key: string) => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1200); };
  const copyImg = async (url: string, key: string) => { (await copyImageToClipboard(url)) ? flash(key) : copy(url, key.replace('img-', 'media-')); };
  const dlImg = async (url: string, filename: string, key: string) => { flash(key); await downloadImage(url, filename); };
  const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 0 4px' };
  // Paste kit — the reusable brand copy the instructions refer to ("paste the 160-char
  // desc", tagline, logo). Source of truth = the project record (one_liner / bio / website).
  const kit = [
    { key: 'url', label: 'Website URL', val: project.website || '' },
    { key: 'desc', label: 'Mô tả (one-liner)', val: project.oneLiner || '' },
    { key: 'bio', label: 'Bio (dài)', val: project.bio || '' },
    { key: 'logo', label: 'Logo URL', val: project.website ? `${project.website.replace(/\/$/, '')}/logo.png` : '' },
  ].filter((k) => k.val);
  // "Built with" / stack — split into per-tool chips for one-tap paste (PH shoutouts, "Built
  // with X" listings). Edited once in /p/[id]/settings, reused across every project's tasks.
  const stackItems = (project.stack || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const [stackBusy, setStackBusy] = useState(false);
  const doStack = async () => { setStackBusy(true); const r = await suggestProjectStack(project.id); setStackBusy(false); if (r.ok) onChange(); };
  return (
    <>
    <Drawer onClose={onClose} width={720} backgrounded={!!domPicker || backgrounded}>
      <div>
        {/* Header — title + close only. Split + delete demoted to the footer utility row. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{task.title}</h2>
          <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px', flexShrink: 0 }}>✕</button>
        </div>

        {/* meta: source · captured-DOM check link · DOM-grounded badge (small, for the person doing + checking here) */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, fontSize: 11 }}>
          {task.sourceUrl && <a href={wrapExternalUrl(task.sourceUrl)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(task.sourceUrl)}</a>}
          {task.catalogSourceId ? (
            <button type="button" onClick={openSource} disabled={sourceBusy} title={task.catalogVia === 'method' ? 'Bung ra từ 1 METHOD trong catalog (fan-out) — bấm xem method gốc + params' : 'Nguồn chuẩn trong catalog — bấm xem chi tiết + params ({product}/{domain}/{pitch}/{link})'}
              style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '0 6px', fontSize: 10.5, color: 'var(--accent)', cursor: 'pointer', lineHeight: '1.7' }}>
              {sourceBusy ? '…' : `📚 #${task.catalogSourceId} ${task.catalogSourceName || 'nguồn'}${task.catalogVia === 'method' ? ' · method' : ''}${task.catalogSourceStatus && task.catalogSourceStatus !== 'active' ? ' · ' + task.catalogSourceStatus : ''}`}
            </button>
          ) : !isEmailSend ? (
            <span title="Task này KHÔNG khớp nguồn nào trong catalog — nên đưa nguồn vào catalog trước khi assign" style={{ fontSize: 10.5, color: 'var(--warn,#ffb03c)' }}>⚠ ngoài catalog nguồn</span>
          ) : null}
          {task.domSampleId && <a href={`/api/dom-sample/${task.domSampleId}`} target="_blank" rel="noopener noreferrer" title="Xem DOM trang này đã capture — cấu trúc THẬT (nút/field/label) mà hướng dẫn bám theo" style={{ color: 'var(--fg-3)' }}>🔎 DOM đã lưu</a>}
          {task.grounded && <span title={`Hướng dẫn viết dựa trên DOM thật (${task.grounded.source || 'dom'}${task.grounded.sampleAt ? ' · capture ' + fmtWhen(task.grounded.sampleAt) : ''})`} style={{ color: 'var(--ok,#22c55e)', fontWeight: 700 }}>✓ dựa trên DOM thật</span>}
          {!isEmailSend && !task.grounded && task.instructions && <span title={task.domSampleId ? 'Có DOM đã lưu nhưng hướng dẫn CHƯA bám theo — bấm ✨ Chuẩn hoá để viết lại đúng nút/field thật của trang.' : 'Hướng dẫn CHƯA dựa trên DOM thật (chưa capture trang này) — các bước điều hướng là SUY ĐOÁN, mở trang tự kiểm. Capture DOM qua ext (crew) để chuẩn hoá bám trang thật.'} style={{ color: 'var(--warn,#ffb03c)', fontWeight: 700, cursor: 'help' }}>⚠ {task.domSampleId ? 'chưa bám DOM' : 'chưa có DOM thật'}</span>}
          {/* Outreach linkage — visible up top (not buried in Email Pitch). Linked → open drawer in-place; else offer to link. */}
          {(task.outreach || isEmailPitch) && (
            <button type="button" onClick={openOutreach} disabled={outBusy}
              title={task.outreach ? `Mở Outreach của task này ngay tại đây — kênh ${task.outreach.channel === 'form' ? 'form' : 'email'}, trạng thái đồng bộ 2 chiều` : 'Đưa task vào hệ Outreach (campaign + prospect + pitch) rồi mở drawer ngay tại đây'}
              style={{ background: task.outreach ? 'color-mix(in srgb, var(--neon-lime) 14%, transparent)' : 'none', border: '1px solid var(--neon-lime)', borderRadius: 4, padding: '0 6px', fontSize: 10.5, color: 'var(--neon-lime)', cursor: 'pointer', lineHeight: '1.7', fontWeight: 700 }}>
              {outBusy ? '…' : task.outreach ? `✉️ Outreach · ${OUTREACH_ST[task.outreach.status] || task.outreach.status}` : '→ Outreach'}
            </button>
          )}
        </div>

        {/* Blocker banner — active when a staffer flagged this task stuck. Actionable: shows the
            reason + clear. Surfaces so admin/AI can fix outdated instructions and self-heal. */}
        {task.blocker && (() => { const paused = !!task.blocker.paused; const c = paused ? '#ffb03c' : 'var(--bad,#ef4444)'; return (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${c}`, background: `color-mix(in srgb, ${c} 10%, transparent)`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c }}>{paused ? '⏸ Tạm dừng (site khác cùng nguồn đang vướng)' : '🚩 Đang vướng'} · {fmtWhen(task.blocker.at)}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-1)', marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{task.blocker.reason}</div>
              {task.blocker.shot && <a href={task.blocker.shot} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6 }}><img src={task.blocker.shot} alt="ảnh báo lỗi" style={{ maxWidth: 260, maxHeight: 170, borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} /></a>}
              {paused && <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>Tự chạy lại khi task gốc gỡ vướng. Hoặc gỡ tay nếu vẫn làm được.</div>}
            </div>
            <button type="button" onClick={clearBlocker} disabled={blkBusy} style={{ ...btn, padding: '2px 9px', flexShrink: 0 }}>{blkBusy ? '…' : '✓ Đã gỡ'}</button>
          </div>
        ); })()}

        {!task.blocker && justResolved && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid #22c55e', background: 'color-mix(in srgb, #22c55e 10%, transparent)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>🟢 Vừa gỡ vướng · {fmtWhen(justResolved.at)}</div>
            {justResolved.note && <div style={{ fontSize: 12.5, color: 'var(--fg-1)', marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>Trước đó: {justResolved.note}</div>}
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>Hướng dẫn đã cập nhật — đọc lại rồi làm tiếp. (Nhãn này tự mất sau khi mở.)</div>
          </div>
        )}

        {/* Draft review — AI soạn draft (mục 📋 dưới), nhân sự duyệt/yêu-cầu-sửa NGAY tại đây trước khi đăng.
            Banner đỏ = chờ duyệt · vàng = cần sửa · xanh = đã duyệt. Thread = luồng tương tác người↔AI. */}
        {task.draftReview && (() => {
          const st = task.draftReview.status;
          const m = st === 'approved' ? { c: '#22c55e', icon: '✅', label: 'Đã duyệt — sẵn sàng đăng' }
                  : st === 'changes' ? { c: '#ffb03c', icon: '✏️', label: 'Nhân sự yêu cầu sửa — AI viết lại' }
                  : { c: 'var(--bad,#ef4444)', icon: '🔴', label: 'Draft chờ nhân sự duyệt' };
          const thread = task.draftReview.thread || [];
          const aLabel = (a: string) => a === 'submit' ? 'nộp draft' : a === 'approve' ? 'duyệt ✅' : a === 'changes' ? 'yêu cầu sửa ✏️' : 'ghi chú 💬';
          return (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${m.c}`, background: `color-mix(in srgb, ${m.c} 10%, transparent)` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.c }}>{m.icon} {m.label}{task.draftReview.at ? ` · ${fmtWhen(task.draftReview.at)}` : ''}</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 3 }}>Bài do AI soạn nằm ở mục 📋 Draft bên dưới. Đọc rồi Duyệt cho đăng, hoặc Yêu cầu sửa (ghi rõ chỗ cần đổi) — AI sẽ viết lại.</div>
              {thread.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {thread.map((it, i) => (
                    <div key={i} style={{ fontSize: 12, borderLeft: `2px solid ${it.kind === 'ai' ? 'var(--accent)' : 'var(--line)'}`, paddingLeft: 8 }}>
                      <div style={{ color: 'var(--fg-4)', fontSize: 10.5 }}>{it.kind === 'ai' ? '🤖 ' : '🧑 '}{it.by} · {aLabel(it.action)} · {fmtWhen(it.at)}</div>
                      {it.note && <div style={{ color: 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.note}</div>}
                    </div>
                  ))}
                </div>
              )}
              {st !== 'approved' && (
                <div style={{ marginTop: 8 }}>
                  <textarea value={revNote} onChange={(e) => setRevNote(e.target.value)} placeholder="Ghi chú / yêu cầu sửa (nêu rõ chỗ nào, đổi thế nào)…" rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', resize: 'vertical', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => doReview('approve')} disabled={revBusy} style={{ ...btn, borderColor: '#22c55e', color: '#22c55e', fontWeight: 700 }}>{revBusy ? '…' : '✅ Duyệt cho đăng'}</button>
                    <button type="button" onClick={() => doReview('changes')} disabled={revBusy || !revNote.trim()} style={{ ...btn, borderColor: '#ffb03c', color: '#ffb03c' }}>✏️ Yêu cầu sửa</button>
                    <button type="button" onClick={() => doReview('comment')} disabled={revBusy || !revNote.trim()} style={{ ...btn }}>💬 Ghi chú</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Email-send card → the send-ready package up top: real email + list + send time + offer. */}
        {isEmailSend && <EmailSendPrep taskId={task.id} defaultSendAt={task.siteScheduledAt} />}

        {/* 1 · Source & how-to — read first: where to place, how, and the build steps. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {task.sourceUrl && <a href={wrapExternalUrl(task.sourceUrl)} {...EXT} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(task.sourceUrl)}</a>}
          {task.tier && TIER_META[task.tier] && <Tag color={TIER_META[task.tier]!.color}>{TIER_META[task.tier]!.label} · tier</Tag>}
          {task.da && <Tag>DA {task.da}</Tag>}
          {task.dofollow && <Tag color="#9d6cff">{task.dofollow}</Tag>}
          {task.traffic && <Tag color="#22c55e">{task.traffic}</Tag>}
          {task.rank && <Tag color="#ffb03c">rank {task.rank}</Tag>}
        </div>
        {task.mechanism && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 6 }}><span style={{ color: 'var(--fg-4)' }}>Cách đặt: </span>{task.mechanism}</div>}
        {task.instructions && (<>
          <div style={{ ...lbl, color: 'var(--accent)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{isEmailSend ? '✉ Nội dung email' : '🛠 Cách build'}</span>
            {task.catalogSourceId ? (
              // Catalog-sourced → instructions are template-driven. No per-task reshape (that detaches
              // & drifts). Funnel edits to the source (opens the 📚 panel → "Sửa nguồn trong catalog").
              <button type="button" onClick={openSource} title="Hướng dẫn theo TEMPLATE NGUỒN trong catalog. Muốn đổi → sửa ở nguồn (lan xuống MỌI site), KHÔNG sửa lẻ ở task. Bấm để mở nguồn."
                style={{ ...btn, padding: '1px 8px', textTransform: 'none', letterSpacing: 0, fontWeight: 700, marginLeft: 'auto', color: 'var(--fg-3)' }}>🔒 theo nguồn #{task.catalogSourceId} — sửa ở nguồn</button>
            ) : !isEmailSend ? (
              <button type="button" onClick={doNormalize} disabled={normBusy} title="AI viết lại hướng dẫn theo khuôn chuẩn (bước đánh số + dòng meta + link kỳ vọng)"
                style={{ ...btn, padding: '1px 8px', textTransform: 'none', letterSpacing: 0, fontWeight: 700, marginLeft: 'auto', color: 'var(--accent)' }}>{normBusy ? '…' : '✨ Chuẩn hoá'}</button>
            ) : null}
            {task.domSampleId && <button type="button" onClick={doPrepFill} disabled={fillBusy} title="AI chuẩn bị GIÁ TRỊ điền cho từng field của form thật (từ DOM đã lưu): tên/email/message/link. Ext sẽ auto-fill (P2)."
              style={{ ...btn, padding: '1px 8px', textTransform: 'none', letterSpacing: 0, fontWeight: 700, color: 'var(--accent)' }}>{fillBusy ? '…' : '✨ Chuẩn bị điền'}</button>}
          </div>
          {/* Danh tính điền form: Auto (deterministic theo role platform) hoặc CHỌN TAY từ full list identities. */}
          {task.domSampleId && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 11, marginTop: 4 }}>
              <span style={{ color: 'var(--fg-4)' }} title="Ai đứng ra điền form (tên/email/giọng). Auto = deterministic theo role platform (directory→brand · community→personal founder · đề xuất/newsletter→seeding độc lập). Hoặc chọn tay 1 identity của project.">🎭 Danh tính:</span>
              <select value={pinnedIdentityId ?? ''} onChange={(e) => setPinnedIdentityId(e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: 11, padding: '2px 5px', background: 'var(--bg-1)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 6, maxWidth: 300 }}>
                <option value="">Auto (theo role platform)</option>
                {identities.map((i) => <option key={i.id} value={i.id}>{i.kind === 'brand' ? '🏢' : i.kind === 'personal' ? '👤' : '🌱'} {i.personaName || i.name}{i.email ? ` · ${i.email}` : ''} ({i.kind})</option>)}
              </select>
              {identityUsed && <span style={{ color: 'var(--fg-4)' }} title={`role: ${identityUsed.role} · nguồn: ${identityUsed.source === 'pinned' ? 'chọn tay' : 'auto theo role'}`}>→ dùng: <b style={{ color: 'var(--fg-2)' }}>{identityUsed.name || '(random)'}</b>{identityUsed.email ? ` · ${identityUsed.email}` : ''} · {identityUsed.kind} {identityUsed.source === 'pinned' ? '(tay)' : '(auto)'}</span>}
            </div>
          )}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px', marginTop: 4 }}>
            <Steps text={task.instructions} onBlock={blockWithReason} urlValue={url} onUrlChange={setUrl} onUrlSave={saveUrl} urlSaving={saveState === 'saving'} emailMode={isEmailSend} />
          </div>
          {/* ✨ Chuẩn bị điền — field→value đã chuẩn bị cho form thật (ext auto-fill P2). 🟢 chắc · 🔴 cần review. */}
          {(fillFields || fillErr) && (
            <div style={{ marginTop: 8 }}>
              <div style={{ ...lbl, color: 'var(--accent)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📋 Điền sẵn (form)</span>
                {fillFields && fillFields.length > 0 && (
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(fillFields.map((f) => `${f.label || f.key}: ${f.value}`).join('\n')); setCopiedKey('__fillall'); setTimeout(() => setCopiedKey(null), 1000); }}
                    style={{ ...btn, padding: '1px 8px', textTransform: 'none', letterSpacing: 0, fontWeight: 700, marginLeft: 'auto' }}>{copiedKey === '__fillall' ? '✓ copy' : '📋 Copy tất cả'}</button>
                )}
              </div>
              {fillErr && (
                <div style={{ fontSize: 12, color: 'var(--bad,#ef4444)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>⚠ {fillErr}</span>
                  {fillNeedAcct && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>→ Cuộn xuống mục <b>Account</b> bên dưới để gán/tạo account thật (tên + email thật) rồi bấm lại ✨ Chuẩn bị điền.</span>}
                </div>
              )}
              {fillFields && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-2)' }}>
                  {fillFields.map((f, i) => {
                    const cc = f.confidence === 'high' ? 'var(--ok,#22c55e)' : f.confidence === 'low' ? 'var(--bad,#ef4444)' : 'var(--fg-4)';
                    const need = /^NEED:/i.test(f.source);            // account thiếu field này → cần bổ sung
                    const isPwd = f.source === 'account-password';     // ext điền từ creds an toàn, không lưu plaintext
                    const needWhat = need ? f.source.slice(5) : '';
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                        <div style={{ minWidth: 118, flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--fg-1)', wordBreak: 'break-word' }}>{f.label || f.key}</div>
                          <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>{f.type}{f.source ? ' · ' + f.source : ''}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, color: need ? 'var(--bad,#ef4444)' : 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {need ? `⚠ account thiếu "${needWhat}" — bổ sung trong account rồi chuẩn bị lại` : isPwd ? '🔒 ext điền từ creds (không lộ ở đây)' : (f.value || '—')}
                        </div>
                        <span title={`độ chắc: ${f.confidence}`} style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 8, background: cc, marginTop: 4 }} />
                        {f.value && !need && !isPwd && <button type="button" onClick={() => { navigator.clipboard?.writeText(f.value); setCopiedKey('fill' + i); setTimeout(() => setCopiedKey(null), 1000); }} style={{ ...btn, padding: '1px 6px', flexShrink: 0 }}>{copiedKey === 'fill' + i ? '✓' : '📋'}</button>}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>Identity lấy từ account THẬT (🟢). Ext auto-fill (P2). 🔴 = account còn thiếu field, bổ sung rồi chuẩn bị lại.</div>
                </div>
              )}
            </div>
          )}
        </>)}

        {/* 2 · Claim — assign an owner (auto-advances To do → In progress). */}
        <div style={lbl}>Assign to (nhận việc)</div>
        <AssigneeCell taskId={task.id} name={task.assignee || ''} assignedId={task.assignedUserId} onChange={onAssign} />

        {/* 3 · Account — must be ready before posting. Hidden for email-send (blast qua Mailjet, không cần account đăng nền tảng). */}
        {!isEmailSend && (<>
        <div style={lbl}>Account · {task.platformLabel || 'platform ?'}</div>
        {task.readiness === 'no-account' ? (
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>✉ Nguồn này không cần account riêng — submit qua {task.mechanism || 'email / one-off'}.</div>
        ) : task.accountHandle ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            {task.accountId != null
              ? <span role="button" tabIndex={0} onClick={openAcct} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void openAcct(); } }}
                  title="Mở account" style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2, textDecorationStyle: 'dotted' }}>@{task.accountHandle}</span>
              : <span style={{ fontWeight: 700 }}>@{task.accountHandle}</span>}
            <Tag color={READINESS_META[task.readiness].color}>{READINESS_META[task.readiness].icon} {task.accountStatus}</Tag>
            {task.has2fa && <Tag>🔐 2FA</Tag>}
            {task.authMethod && <Tag>{task.authMethod}</Tag>}
            {task.hasProxy && <Tag color="#9d6cff">🌐 proxy</Tag>}
            {task.hasProfile && <Tag color="#5badff">🧭 profile</Tag>}
            <button type="button" onClick={openAcct} title="Sửa account (mở editor chuẩn)" style={{ ...btn, padding: '2px 8px', marginLeft: 'auto' }}>✎ sửa</button>
            <button type="button" onClick={togglePicker} title="Đổi sang account khác / tạo account mới cho nguồn này" style={{ ...btn, padding: '2px 8px' }}>{acctPick ? 'đóng' : '⇄ đổi acc'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ color: READINESS_META.missing.color }}>➕ Chưa có account trên {task.platformLabel}</span>
            <span title={ACCOUNT_ROLE_META[task.recommendedRole].why} style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ACCOUNT_ROLE_META[task.recommendedRole].color, border: `1px solid ${ACCOUNT_ROLE_META[task.recommendedRole].color}`, borderRadius: 4, padding: '1px 6px' }}>nên: {ACCOUNT_ROLE_META[task.recommendedRole].badge} {ACCOUNT_ROLE_META[task.recommendedRole].label}</span>
            {task.platformKey && <button type="button" onClick={togglePicker} style={{ ...btn }}>⇄ chọn acc</button>}
            {task.platformKey && <button type="button" onClick={() => onCreateAccount(task.platformKey!, task.id, task.recommendedRole)} style={{ ...btn, color: 'var(--accent)', fontWeight: 700 }}>+ Tạo account</button>}
          </div>
        )}
        {acctPick && (
          <div style={{ marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={apq} onChange={(e) => setApq(e.target.value)} placeholder={`tìm account ${task.platformLabel || ''}…`} autoComplete="off"
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
              {task.accountId != null && <button type="button" onClick={() => pickAcct(null)} style={{ ...btn, textAlign: 'left', color: 'var(--fg-3)' }}>↺ Auto (bỏ ghim, để hệ thống tự chọn)</button>}
              {acctOpts === null && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>đang tải…</span>}
              {acctOpts !== null && acctOptsShown.length === 0 && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>Chưa có account {task.platformLabel} nào — tạo mới ↓</span>}
              {acctOptsShown.map((a) => {
                const foreign = a.homeProjectId && a.homeProjectId !== slug;
                const cur = a.id === task.accountId;
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                    <button type="button" onClick={() => pickAcct(a.id)} disabled={cur}
                      style={{ ...btn, flex: 1, textAlign: 'left', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', opacity: cur ? 0.55 : 1 }}>
                      <span style={{ fontWeight: 700 }}>@{a.handle || a.id}</span>
                      <Tag>{a.status}</Tag>
                      {foreign && <Tag color="#ffb03c">↗ {a.homeProjectId}</Tag>}
                      {cur && <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>đang dùng</span>}
                    </button>
                    <button type="button" onClick={() => editAccountById(a.id)} title="Sửa account này (editor chuẩn)"
                      style={{ ...btn, padding: '2px 8px' }}>✎</button>
                  </div>
                );
              })}
            </div>
            {task.platformKey && <button type="button" onClick={() => onCreateAccount(task.platformKey!, task.id, task.recommendedRole)} style={{ ...btn, color: 'var(--accent)', fontWeight: 700, textAlign: 'left' }}>＋ Tạo account mới cho {project.name}</button>}
          </div>
        )}
        </>)}

        {/* 4 · Content — paste kit + the post draft + any other AI content the task needs. */}
        {kit.length > 0 && (
          <Disclosure title="📎 Paste kit" badge={`${kit.length} mục · ${project.name}`}>
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
          </Disclosure>
        )}

        {/* Built with / stack — per-tool copy chips (PH shoutouts, "Built with X" listings) +
            one-tap AI generate. Only for shoutout/directory/launch tasks — noise for email/forum/Q&A. */}
        {showStack && (
        <Disclosure title="🧩 Built with" badge="stack · copy từng tool" defaultOpen={stackItems.length > 0}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {stackItems.map((s, i) => (
            <button key={i} type="button" onClick={() => copy(s, `stack-${i}`)} title="Copy tên tool để dán vào shoutout/listing"
              style={{ ...btn, padding: '2px 9px' }}>{copiedKey === `stack-${i}` ? `✓ ${s}` : s}</button>
          ))}
          {stackItems.length > 0 && <button type="button" onClick={() => copy(stackItems.join(', '), 'stack-all')} title="Copy cả danh sách" style={{ ...btn, padding: '2px 9px', color: 'var(--fg-3)' }}>{copiedKey === 'stack-all' ? '✓ all' : 'Copy tất cả'}</button>}
          <button type="button" onClick={doStack} disabled={stackBusy} title="AI gợi ý stack từ mô tả + trang chủ project (sửa lại trong Settings)"
            style={{ ...btn, padding: '2px 9px', color: 'var(--accent)', fontWeight: 700 }}>{stackBusy ? '…' : stackItems.length ? '↻ Gợi ý lại' : '✨ Gợi ý stack (AI)'}</button>
        </div>
        {stackItems.length === 0 && !stackBusy && <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>Chưa có stack — bấm ✨ để AI đề xuất, hoặc điền ở Settings. Dùng cho PH shoutouts / &ldquo;Built with&rdquo; listings.</div>}
        </Disclosure>
        )}

        {/* Post draft — ONE block: empty → generate; generated → show + regen + format/link toggles. */}
        {/* Structured seeding draft — one CARD per candidate comment: thread link + the exact EN text to
            post (its own Copy button) + a muted why. All Vietnamese meta sealed in a collapsed sub-disclosure.
            Replaces the markdown "wall" for community-seed weeks; generalizes to N comments. */}
        {task.draftPlan && task.draftPlan.items?.length > 0 && (
        <Disclosure title={`📋 Bài đăng — ${task.draftPlan.items.length} comment (chờ duyệt)`} defaultOpen>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>POST · {task.draftPlan.items.length} comment</span>
            {task.draftPlan.goal && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{task.draftPlan.goal}</span>}
            {task.draftPlan.week && <Tag color="var(--accent)">{task.draftPlan.week}</Tag>}
          </div>
          {task.draftPlan.items.map((it, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)', padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <a href={wrapExternalUrl(it.thread_url)} {...EXT} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, minWidth: 0 }}>{i + 1} ↗ {it.thread_title}</a>
                {it.thread_tag && <Tag color="#ffb03c">{it.thread_tag}</Tag>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, color: 'var(--fg-1)', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.comment}</div>
                <button type="button" onClick={() => copy(it.comment, `c${i}`)} title="Copy đúng nội dung comment (không kèm link/ghi chú)" style={{ ...btn, padding: '2px 9px', flexShrink: 0 }}>{copiedKey === `c${i}` ? '✓ copied' : 'Copy'}</button>
              </div>
              {it.why && <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 5 }}>{it.why}</div>}
            </div>
          ))}
          {(task.draftPlan.voice_note || task.draftPlan.ops_note || task.draftPlan.ops_warn) && (
            <Disclosure title="Văn phong + ghi chú vận hành" defaultOpen={false}>
              {task.draftPlan.voice_note && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 4, lineHeight: 1.5 }}><span style={{ color: 'var(--fg-4)' }}>Văn phong: </span>{task.draftPlan.voice_note}</div>}
              {task.draftPlan.ops_note && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 4, lineHeight: 1.5 }}><span style={{ color: 'var(--fg-4)' }}>Vận hành: </span>{task.draftPlan.ops_note}</div>}
              {task.draftPlan.ops_warn && <div style={{ fontSize: 11.5, color: 'var(--bad,#ef4444)', marginTop: 5, fontWeight: 600 }}>⚠ {task.draftPlan.ops_warn}</div>}
            </Disclosure>
          )}
        </Disclosure>
        )}

        {!task.draftPlan && (needsPost || task.draft) && (
        <Disclosure title="📋 Draft (bài đăng)" defaultOpen={!!task.draft}>
        {draftFmts ? (<>
          <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>📋 Draft (paste-ready)</span>
            <button type="button" onClick={doDraft} disabled={dbusy} title="Sinh lại bản nháp khác" style={{ ...btn, padding: '1px 8px' }}>{dbusy ? '…' : '↻ Viết lại'}</button>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              {DRAFT_FMTS.map((f) => (
                <button key={f.k} type="button" onClick={() => setFmt(f.k)} title={f.hint}
                  style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                    border: `1px solid ${fmt === f.k ? 'var(--accent)' : 'var(--line)'}`, background: fmt === f.k ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent', color: fmt === f.k ? 'var(--accent)' : 'var(--fg-3)' }}>{f.label}</button>
              ))}
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
              <button type="button" onClick={() => setDPrev((v) => !v)} title={dPrev ? 'Xem mã nguồn để copy dạng text' : 'Xem bản render (WYSIWYG)'}
                style={{ ...btn, padding: '1px 8px', color: dPrev ? 'var(--accent)' : 'var(--fg-3)' }}>{dPrev ? '</> Nguồn' : '👁 Xem'}</button>
              <button type="button" onClick={() => (dPrev ? copyRich(draftFmts.html, 'draft') : copy(draftFmts[fmt], 'draft'))} title={dPrev ? 'Copy giữ định dạng — dán vào Gmail/WordPress/Docs là ra rich text' : 'Copy mã nguồn'}
                style={{ ...btn, padding: '1px 8px' }}>{copiedKey === 'draft' ? '✓ copied' : dPrev ? 'Copy (rich)' : 'Copy'}</button>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '2px 0' }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Link</span>
            {LINK_MODES.map((m) => (
              <button key={m.k} type="button" onClick={() => setLinkMode(m.k)} title={m.hint}
                style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${linkMode === m.k ? '#9d6cff' : 'var(--line)'}`, background: linkMode === m.k ? 'color-mix(in srgb, #9d6cff 16%, transparent)' : 'transparent', color: linkMode === m.k ? '#9d6cff' : 'var(--fg-3)' }}>{m.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '2px 0' }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Bản</span>
            <button type="button" onClick={() => setNoImg((v) => !v)} title="Platform không cho ảnh → bỏ mọi ảnh khỏi bài"
              style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${noImg ? '#22c55e' : 'var(--line)'}`, background: noImg ? 'color-mix(in srgb, #22c55e 16%, transparent)' : 'transparent', color: noImg ? '#22c55e' : 'var(--fg-3)' }}>{noImg ? '🚫 Bỏ ảnh' : '🖼 Có ảnh'}</button>
            <button type="button" onClick={toggleShort} disabled={condBusy} title="Bản rút gọn ~90-140 từ (comment / forum ngắn) — AI cô đọng, giữ link + 1 ảnh"
              style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${short ? '#3c9bff' : 'var(--line)'}`, background: short ? 'color-mix(in srgb, #3c9bff 16%, transparent)' : 'transparent', color: short ? '#3c9bff' : 'var(--fg-3)' }}>{condBusy ? '⏳…' : short ? '✂️ Bản ngắn' : '↔ Full'}</button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-4)', margin: '-1px 0 4px' }}>{DRAFT_FMTS.find((f) => f.k === fmt)!.hint} · {LINK_MODES.find((m) => m.k === linkMode)!.hint} · {imgs.length ? `AI chèn ảnh từ media (${imgs.length} có sẵn)` : 'chưa có media — thêm ở mục 🖼 Media để AI chèn ảnh'}</div>
          {derr && <div style={{ fontSize: 11, color: 'var(--bad,#ef4444)', marginBottom: 4 }}>{derr}</div>}
          {dPrev ? (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--fg-1)' }}>
              <style>{`.draft-wys h1{font-size:18px;margin:.3em 0 .4em;font-weight:700}.draft-wys h2{font-size:16px;margin:.4em 0 .3em;font-weight:700}.draft-wys h3{font-size:14px;margin:.4em 0 .25em;font-weight:700}.draft-wys p{margin:.5em 0}.draft-wys a{color:var(--accent);text-decoration:underline}.draft-wys ul,.draft-wys ol{margin:.4em 0;padding-left:1.4em}.draft-wys code{font-family:var(--font-mono);background:var(--bg-1);padding:1px 4px;border-radius:4px}`}</style>
              <div className="draft-wys" dangerouslySetInnerHTML={{ __html: draftFmts.html }} />
            </div>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.5, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, margin: 0, fontFamily: 'var(--font-mono)' }}>{draftFmts[fmt]}</pre>
          )}
        </>) : (<>
          <div style={{ ...lbl, color: 'var(--accent)', fontSize: 11 }}>✍️ Bài viết</div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>Task này cần đăng 1 bài để nhúng link. Sinh bản nháp (English, đúng chủ đề platform, đã cắm link) rồi tinh chỉnh — bài hiện ngay tại đây.</div>
            <button type="button" onClick={doDraft} disabled={dbusy} style={{ ...btn, alignSelf: 'flex-start' }}>{dbusy ? 'Đang viết…' : '✍️ Viết bài (AI)'}</button>
            {derr && <div style={{ fontSize: 11, color: 'var(--bad,#ef4444)' }}>{derr}</div>}
          </div>
        </>)}
        </Disclosure>
        )}

        <Disclosure title={isEmailPitch ? '✉️ Email pitch (AI)' : '🧠 Nội dung AI'} defaultOpen={aiList.length > 0}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>{isEmailPitch
            ? (isFollowUp
              ? 'Đã gửi lần đầu, đang Chờ duyệt. Bấm 🔁 để AI sinh email NHẮC ngắn (không pitch lại), rồi 📤 mở Gmail gửi tiếp.'
              : 'Nguồn này lấy link bằng EMAIL cho chủ trang/librarian. Bấm ✉️ là AI sinh luôn email (subject + nội dung, English) — kết quả hiện ngay dưới, bấm 📤 mở Gmail gửi. Cần bản khác thì gõ yêu cầu ở ô dưới.')
            : 'Sinh mọi loại nội dung task cần (title, first comment, reply, bio, signature, answer…). AI gộp full context: project + instructions + mechanism + paste kit.'}</div>
          {isEmailPitch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" onClick={() => genEmail('openai')} disabled={!!aiBusy} title={isFollowUp ? 'Sinh email nhắc ngắn (đã gửi lần đầu)' : 'Sinh email pitch ngay (OpenAI)'}
                  style={{ ...btn, fontWeight: 700, color: 'var(--accent)', borderColor: 'var(--accent)' }}>{aiBusy === 'openai' ? '⏳ đang sinh…' : lastEmail ? '↻ Sinh lại' : isFollowUp ? '🔁 Sinh email nhắc (follow-up)' : `✉️ Sinh email${recipientEmail ? ` cho ${recipientEmail}` : ''}`}</button>
                <button type="button" onClick={() => genEmail('claude')} disabled={!!aiBusy} title="Đẩy vào queue — Claude sinh khi mở phiên chat"
                  style={{ ...btn, fontWeight: 700, color: '#d19a66', borderColor: '#d19a66' }}>{aiBusy === 'claude' ? '⏳…' : '🧠 Nhờ Claude'}</button>
                <button type="button" onClick={openOutreach} disabled={outBusy} title={task.outreach ? 'Mở Outreach của task này (ngay tại đây)' : 'Đưa task này vào hệ Outreach (campaign + prospect + pitch, đồng bộ trạng thái 2 chiều; có email → cron tự gửi & follow-up). Mở drawer ngay tại đây.'}
                  style={{ ...btn, fontWeight: 700, color: 'var(--neon-lime)', borderColor: 'var(--neon-lime)' }}>{outBusy ? '⏳…' : task.outreach ? '✉️ Mở Outreach' : '→ Outreach'}</button>
              </div>
              {lastEmail && (<>
                <button type="button" onClick={doSendEmail} title={recipientEmail ? 'Mở Gmail soạn sẵn email này (review rồi Send), task chuyển Chờ duyệt' : 'Mở trang/form gửi, task chuyển Chờ duyệt — dán email vào form của họ'}
                  style={{ ...btn, fontWeight: 700, alignSelf: 'flex-start', color: '#22c55e', borderColor: '#22c55e' }}>{recipientEmail ? `📤 Mở Gmail gửi cho ${recipientEmail}` : '📤 Mở form gửi + đánh dấu đã gửi'}</button>
                <div style={{ fontSize: 10.5, color: 'var(--fg-4)', lineHeight: 1.4 }}>Gửi xong task tự sang &ldquo;Chờ duyệt&rdquo; + nhắc follow-up. {recipientEmail ? 'Review trong Gmail rồi bấm Send (giao hàng .edu tốt hơn Mailjet).' : 'Dán email AI vào form của họ.'}</div>
              </>)}
            </div>
          )}
          {writableSteps.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {writableSteps.map((s, i) => (
                <button key={i} type="button" onClick={() => setAiKind(s)} title="Dùng bước này làm yêu cầu"
                  style={{ ...btn, padding: '2px 8px', fontSize: 10.5, textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}>+ {s.length > 64 ? s.slice(0, 64) + '…' : s}</button>
              ))}
            </div>
          )}
          <input value={aiKind} onChange={(e) => setAiKind(e.target.value)} placeholder="Cần sinh gì? (vd: HN first comment giải thích nguồn data DoD)" autoComplete="off"
            style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' }} />
          <input value={aiExtra} onChange={(e) => setAiExtra(e.target.value)} placeholder="Yêu cầu thêm (tuỳ chọn): giọng, độ dài, góc nhìn…" autoComplete="off"
            style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => doGen('openai')} disabled={!!aiBusy} style={{ ...btn, fontWeight: 700 }}>{aiBusy === 'openai' ? '…' : '✨ OpenAI (ngay)'}</button>
            <button type="button" onClick={() => doGen('claude')} disabled={!!aiBusy} title="Đẩy vào queue — Claude xử lý khi mở phiên chat" style={{ ...btn, fontWeight: 700, color: '#d19a66', borderColor: '#d19a66' }}>{aiBusy === 'claude' ? '…' : '🧠 Nhờ Claude (queue)'}</button>
            {aiErr && <span style={{ fontSize: 11, color: 'var(--bad,#ef4444)' }}>{aiErr}</span>}
          </div>
        </div>
        {aiList.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {aiList.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Tag color={a.engine === 'claude' ? '#d19a66' : '#3c9bff'}>{a.engine === 'claude' ? '🧠 Claude' : '✨ OpenAI'}</Tag>
                  {a.status === 'queued' ? <Tag color="#d19a66">⏳ đang chờ Claude</Tag> : a.status === 'error' ? <Tag color="var(--bad,#ef4444)">lỗi</Tag> : <Tag color="#22c55e">✓ xong</Tag>}
                  <span style={{ fontSize: 11, color: 'var(--fg-2)', flex: 1, minWidth: 120 }}>{a.kind}</span>
                  {a.status === 'done' && a.result && <button type="button" onClick={() => copy(a.result!, `ai-${a.id}`)} style={{ ...btn, padding: '1px 8px' }}>{copiedKey === `ai-${a.id}` ? '✓' : 'Copy'}</button>}
                  {aiDelId === a.id ? (
                    <>
                      <button type="button" onClick={() => { void delAi(a.id); setAiDelId(null); }} style={{ ...btn, padding: '1px 7px', borderColor: 'var(--bad,#ef4444)', color: '#fff', background: 'var(--bad,#ef4444)' }}>Xoá?</button>
                      <button type="button" onClick={() => setAiDelId(null)} style={{ ...btn, padding: '1px 7px' }}>Huỷ</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setAiDelId(a.id)} title="Xoá" style={{ ...btn, padding: '1px 7px', color: 'var(--bad,#ef4444)' }}>✕</button>
                  )}
                </div>
                {a.status === 'done' && a.result && <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.5, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: 8, margin: '6px 0 0', fontFamily: 'var(--font-mono)' }}>{a.result}</pre>}
                {a.status === 'queued' && <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 4 }}>Đã vào queue. Mở phiên chat Claude, bảo &ldquo;xử lý queue nội dung backlink&rdquo; để nhận kết quả.</div>}
                {a.status === 'error' && a.error && <div style={{ fontSize: 11, color: 'var(--bad,#ef4444)', marginTop: 4 }}>{a.error}</div>}
              </div>
            ))}
          </div>
        )}
        </Disclosure>

        {/* 5 · Media — prepare screenshot/logo/cover before posting. */}
        {mediaNeed && (
          <Disclosure title={`🖼 Media · ${mediaNeed.label}`} defaultOpen={imgs.length > 0}>
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
                  <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                    <button type="button" onClick={() => dlImg(m.url, m.filename || `img-${m.id}`, `dl-${m.id}`)} title="Tải ảnh về máy" style={{ ...btn, flex: 1, padding: '1px 0', fontSize: 11 }}>{copiedKey === `dl-${m.id}` ? '✓' : '⬇'}</button>
                    <button type="button" onClick={() => copyImg(m.url, `img-${m.id}`)} title="Copy ảnh (dán thẳng vào form/post)" style={{ ...btn, flex: 1, padding: '1px 0', fontSize: 11 }}>{copiedKey === `img-${m.id}` ? '✓' : '🖼'}</button>
                    <button type="button" onClick={() => copy(m.url, `media-${m.id}`)} title="Copy URL ảnh" style={{ ...btn, flex: 1, padding: '1px 0', fontSize: 11 }}>{copiedKey === `media-${m.id}` ? '✓' : '🔗'}</button>
                  </div>
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
          </Disclosure>
        )}

        {/* 6 · Status — the single "I posted / it's live" control, right before URL capture. */}
        <div style={{ ...lbl, marginTop: 16 }}>Status @ {slug}</div>
        <StatusSegmented size="md" value={task.siteState}
          options={STATUS_ORDER.map((s) => ({ value: s, label: SITE_STATUS[s]?.label ?? s, color: SITE_STATUS[s]?.color ?? 'var(--fg-2)' }))}
          onChange={(s) => { void setSite(task.id, s, url); }} />

        {/* 7-9 · Link + verify + schedule — grouped (the primary paste spot is inline at the ✅ line above). */}
        <Disclosure title="📋 Bàn giao — để chat khác nối tiếp" badge={hasResume({ inputs: task.inputs, doneWhen: task.doneWhen, dependsOn: task.dependsOn }) ? '✓ đã có bàn giao' : 'trống — nên điền'} defaultOpen={hasResume({ inputs: task.inputs, doneWhen: task.doneWhen, dependsOn: task.dependsOn })}>
          <ResumeEditor task={task} onSave={(r) => setResume(task.id, r)} onOpenTask={onOpenTask} />
        </Disclosure>

        <Disclosure title={isEmailSend ? '🗓 Lịch gửi' : '🔗 Link · kiểm tra · lịch'} defaultOpen={!!(task.siteLiveUrl || task.siteScheduledAt || task.siteDoneAt)}>
        {task.communitySeed && task.seedGate && (
          <div style={{ marginBottom: 8, padding: '7px 9px', borderRadius: 6, border: `1px solid ${task.seedGate.ok ? '#22c55e55' : '#ffb03c55'}`, background: task.seedGate.ok ? '#22c55e10' : '#ffb03c10' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <SeedStrip g={task.seedGate} />
              <a href={`/p/${project.id}/seeding`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--fg-3)', textDecoration: 'underline dotted' }}>quản lý ở /seeding ↗</a>
            </div>
            {!task.seedGate.ok && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                {task.seedGate.blockers.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </div>
        )}
        {!isEmailSend && (<>
        <div style={lbl}>Live URL (link đã đặt được @ {slug})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoComplete="off"
            style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, boxSizing: 'border-box' }} />
          <button type="button" onClick={saveUrl} disabled={saveState === 'saving'}
            style={{ ...btn, fontWeight: 700, minWidth: 78, borderColor: linkArmed ? '#ffb03c' : saveState === 'saved' ? 'var(--ok)' : 'var(--line)', color: linkArmed ? '#ffb03c' : saveState === 'saved' ? 'var(--ok)' : 'var(--fg-1)' }}>
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ Đã lưu' : linkArmed ? '⚠ Vẫn lưu' : 'Lưu'}</button>
        </div>
        {linkArmed && <div style={{ fontSize: 11, color: '#ffb03c', marginTop: 4 }}>🔒 Community chưa đủ điều kiện thả link — nhấn “⚠ Vẫn lưu” lần nữa để ghi đè, hoặc seeding thêm trước.</div>}

        {/* 8 · Verify — own action row (auto-advances Completed → Verified on a dofollow hit). */}
        <div style={lbl}>🔍 Kiểm tra link @ {slug}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
          <button type="button" onClick={doVerify} disabled={vbusy || !(task.siteLiveUrl || url.trim())}
            title="Fetch link → kiểm tra domain mình có được link + dofollow không; đạt sẽ tự lên Verified"
            style={{ ...btn, fontWeight: 700 }}>{vbusy ? '…' : '🔍 Kiểm tra'}</button>
          {!(task.siteLiveUrl || url.trim()) && <span style={{ color: 'var(--fg-4)' }}>Lưu Live URL ở trên trước</span>}
          {task.siteLiveUrl && vres && (() => { const m = verifyMeta(vres); return m ? <span style={{ color: m.c }}>{m.t} · kiểm {fmtWhen(vres.checkedAt)}</span> : null; })()}
        </div>
        </>)}

        {/* 9 · Schedule */}
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
        </Disclosure>

        {/* Trailing read-only: also-applies-to + notes */}
        {task.appliesTo.length > 1 && (<><div style={lbl}>Cũng áp dụng cho ({task.appliesTo.length} sites)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{task.appliesTo.map((s) => { const st = task.siteStatus[s] || ''; return <Tag key={s} color={s === slug ? 'var(--accent)' : undefined}>{s} · {SITE_STATUS[st]?.label || st || '—'}</Tag>; })}</div></>)}
        {task.notes && (<><div style={lbl}>Notes (admin)</div><div style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'pre-wrap' }}>{task.notes}</div></>)}

        {/* Staff feedback — result report + opinions (worker note), and a blocker flag when stuck.
            This is the write-back half of the loop: staff execute above, report here → system self-runs. */}
        <Disclosure title="📣 Phản hồi của bạn" badge="kết quả · ý kiến · báo lỗi" defaultOpen={!!task.workerNote}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoComplete="off"
          placeholder="Đặt xong link ở đâu? gặp gì? góp ý về hướng dẫn (nếu sai/cũ)…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12.5, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={saveNote} disabled={noteState === 'saving' || note === (task.workerNote || '')}
            style={{ ...btn, fontWeight: 700, borderColor: noteState === 'saved' ? 'var(--ok)' : 'var(--line)', color: noteState === 'saved' ? 'var(--ok)' : 'var(--fg-1)' }}>
            {noteState === 'saving' ? '…' : noteState === 'saved' ? '✓ Đã lưu' : 'Lưu phản hồi'}</button>
          {!task.blocker && !blkOpen && <button type="button" onClick={() => setBlkOpen(true)} title="Báo là đang mắc/không làm được — admin sẽ thấy để gỡ" style={{ ...btn, color: 'var(--bad,#ef4444)' }}>🚩 Báo vướng</button>}
        </div>
        {blkOpen && !task.blocker && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--bad,#ef4444)', background: 'color-mix(in srgb, var(--bad,#ef4444) 7%, transparent)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Mắc gì? (vd: cần verify SĐT không có · account bị khoá · hướng dẫn/URL sai). Task sẽ gắn cờ 🚩 cho admin.</div>
            <textarea value={blkReason} onChange={(e) => setBlkReason(e.target.value)}
              rows={2} autoComplete="off" placeholder="Lý do vướng…"
              style={{ fontSize: 12.5, padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', resize: 'vertical', fontFamily: 'inherit' }} />
            <ImageAttach value={blkShots} onChange={setBlkShots} folder="blockers" max={3} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" onClick={flagBlocker} disabled={blkBusy || !blkReason.trim()} style={{ ...btn, color: 'var(--bad,#ef4444)', fontWeight: 700 }}>{blkBusy ? '…' : '🚩 Gửi'}</button>
              <button type="button" onClick={() => { discardAttachments(blkShots); setBlkOpen(false); setBlkReason(''); setBlkShots([]); }} style={btn}>Huỷ</button>
            </div>
          </div>
        )}
        </Disclosure>

        {/* Footer utility row — structural/destructive actions out of the primary top-down path. */}
        <div style={{ marginTop: 22, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setSplitting((v) => !v)} title="Tách thành 2 link (vd profile + bài post) — mỗi link 1 status/URL riêng" style={{ ...btn, padding: '2px 9px' }}>⑃ Tách</button>
          {delConfirm ? (
            <>
              <button type="button" onClick={() => onDelete(task.id)} style={{ ...btn, padding: '2px 9px', borderColor: 'var(--bad,#ef4444)', color: '#fff', background: 'var(--bad,#ef4444)' }}>Xoá task?</button>
              <button type="button" onClick={() => setDelConfirm(false)} style={{ ...btn, padding: '2px 9px' }}>Huỷ</button>
            </>
          ) : (
            <button type="button" onClick={() => setDelConfirm(true)} title="Xoá task này (có hoàn tác)" style={{ ...btn, padding: '2px 9px', color: 'var(--bad,#ef4444)' }}>🗑 Xoá</button>
          )}
          {!dropConfirm && (
            <button type="button" onClick={() => setDropConfirm(true)} title="Nguồn không khả thi cho mọi site (vd Wikidata notability) → xoá task này + mọi task cùng nguồn ở tất cả project. Có hoàn tác." style={{ ...btn, padding: '2px 9px', color: 'var(--bad,#ef4444)' }}>🗑 Drop nguồn (mọi site)</button>
          )}
          <span style={{ fontSize: 10, color: 'var(--fg-4)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>#{task.id}</span>
        </div>
        {dropConfirm && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--bad,#ef4444)', background: 'color-mix(in srgb, var(--bad,#ef4444) 7%, transparent)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Xoá task này + <b>mọi task cùng nguồn</b> ở tất cả site (nguồn không khả thi, vd Wikidata notability). Hoàn tác 9s, hoặc khôi phục sau bất cứ lúc nào ở nút <b>🗑 Đã drop</b> trên đầu trang.</div>
            <input value={dropReason} onChange={(e) => setDropReason(e.target.value)} autoComplete="off" placeholder="Lý do drop (tuỳ chọn — ghi để không seed lại nguồn này)…"
              style={{ fontSize: 12.5, padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => { onDropSource(task.id, dropReason); setDropConfirm(false); setDropReason(''); }} style={{ ...btn, borderColor: 'var(--bad,#ef4444)', color: '#fff', background: 'var(--bad,#ef4444)', fontWeight: 700 }}>🗑 Drop cả cụm cùng nguồn</button>
              <button type="button" onClick={() => { setDropConfirm(false); setDropReason(''); }} style={btn}>Huỷ</button>
            </div>
          </div>
        )}
        {splitting && (
          <div style={{ marginTop: 8, padding: 12, borderRadius: 8, border: '1px solid #9d6cff', background: 'color-mix(in srgb, #9d6cff 8%, transparent)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Tách nguồn này thành 2 task. Task hiện tại → tên trên; task mới (clone cùng account/nguồn, reset trạng thái) → tên dưới. Drawer này vẫn mở.</div>
            <input value={sa} onChange={(e) => setSa(e.target.value)} autoComplete="off" placeholder="Tên task hiện tại" style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-0)' }} />
            <input value={sb} onChange={(e) => setSb(e.target.value)} autoComplete="off" placeholder="Tên task mới" style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-0)' }} />
            {serr && <div style={{ fontSize: 11, color: 'var(--bad,#ef4444)' }}>{serr}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={doSplit} disabled={sbusy} style={{ ...btn, color: '#9d6cff', fontWeight: 700 }}>{sbusy ? 'Đang tách…' : '⑃ Tách'}</button>
              <button type="button" onClick={() => setSplitting(false)} style={btn}>Huỷ</button>
            </div>
          </div>
        )}
        {splitDone && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #9d6cff', background: 'color-mix(in srgb, #9d6cff 8%, transparent)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ color: 'var(--fg-2)' }}>✓ Đã tách ra task mới: <b>{splitDone.name}</b></span>
            <button type="button" onClick={() => onOpenTask(splitDone.id)} style={{ ...btn, color: '#9d6cff', fontWeight: 700 }}>Mở task mới →</button>
            <button type="button" onClick={() => setSplitDone(null)} style={{ ...btn, marginLeft: 'auto' }}>✕</button>
          </div>
        )}
      </div>
    </Drawer>
    {domPicker && (
      <Drawer onClose={() => setDomPicker(null)} width={620} zIndex={320}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🔎 Chọn DOM để chuẩn hoá</h2>
          <button type="button" onClick={() => setDomPicker(null)} style={{ ...btn, padding: '2px 9px' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>Task này đã chuẩn hoá theo DOM mới nhất rồi — không tự chạy lại. Chọn bản DOM muốn viết lại hướng dẫn theo (xem preview cấu trúc field), hoặc đóng.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {domPicker.samples.map((s) => {
            const used = s.id === domPicker.groundedSampleId;
            return (
              <div key={s.id} style={{ border: '1px solid ' + (used ? 'var(--accent)' : 'var(--line)'), borderRadius: 8, background: 'var(--bg-1)', padding: '9px 11px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title || hostOf(s.url) || ('DOM #' + s.id)}</span>
                  {used && <Tag color="var(--accent)">đang dùng</Tag>}
                  {s.pageKind && <Tag>{s.pageKind}</Tag>}
                  <Tag>{s.fieldCount} field</Tag>
                  <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>{fmtWhen(s.capturedAt)}</span>
                </div>
                {s.url && <div style={{ fontSize: 10.5, color: 'var(--fg-3)', wordBreak: 'break-all', marginTop: 2 }}>{s.url}</div>}
                <details style={{ marginTop: 6 }}>
                  <summary style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}>Preview cấu trúc field</summary>
                  <pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', color: 'var(--fg-2)', background: 'var(--bg-2)', padding: 8, borderRadius: 6, marginTop: 4, maxHeight: 200, overflow: 'auto' }}>{s.preview || '(trống)'}</pre>
                </details>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <a href={`/api/dom-sample/${s.id}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none', padding: '2px 9px', fontSize: 11 }}>🔎 Xem DOM đầy đủ</a>
                  <button type="button" onClick={() => runNormalize(s.id)} disabled={normBusy} style={{ ...btn, color: 'var(--accent)', fontWeight: 700, padding: '2px 9px', fontSize: 11 }}>{normBusy ? '…' : '✨ Chuẩn hoá với DOM này'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </Drawer>
    )}
    {sourceDetail?.ok && sourceDetail.source && (
      <Drawer onClose={() => setSourceDetail(null)} width={640} zIndex={320}>
        {(() => { const src = sourceDetail.source!; return (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📚 Nguồn chuẩn #{src.id}</h2>
            <button type="button" onClick={() => setSourceDetail(null)} style={{ ...btn, padding: '2px 9px' }}>✕</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{src.name}</div>
          <a href={wrapExternalUrl(src.canonicalUrl)} {...EXT} style={{ fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all' }}>↗ {src.canonicalUrl}</a>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
            {src.category && <Tag>{src.category}</Tag>}
            {src.dofollow && <Tag color="#9d6cff">{src.dofollow}</Tag>}
            {src.da && <Tag>DA {src.da}</Tag>}
            <Tag color={src.sourceStatus === 'active' ? '#22c55e' : '#ffb03c'}>{src.sourceStatus}</Tag>
            {src.audienceTags.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
          {/* Execution intelligence — the self-learning state (set by reportSourceOutcome). */}
          {(src.automation || src.obstacles.length > 0 || src.lastRunAt) && (() => {
            const meta = src.automation ? AUTOMATION_META[src.automation] : undefined;
            const needsHuman = automationNeedsHuman(src.automation);
            return (
              <div style={{ marginBottom: 12, border: `1px solid ${needsHuman ? 'var(--bad,#ef4444)' : 'var(--line)'}`, borderRadius: 8, padding: '8px 10px', background: needsHuman ? 'color-mix(in srgb, var(--bad,#ef4444) 8%, transparent)' : 'var(--bg-1)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Cách chạy (tự học từ execution)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: meta?.color ?? 'var(--fg-3)' }}>{meta ? meta.icon + ' ' : ''}{src.automation || 'chưa rõ (chưa chạy)'}</span>
                  {src.lastRunAt && <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>· chạy gần nhất {String(src.lastRunAt).slice(0, 10)} → {src.lastRunOutcome}</span>}
                </div>
                {src.obstacles.length > 0 && (
                  <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {src.obstacles.map((o, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--fg-2)' }}>⛔ <b>{o.type}</b>{o.stage ? ` @${o.stage}` : ''}{o.note ? ` — ${o.note}` : ''}{o.at ? <span style={{ color: 'var(--fg-4)' }}> ({o.at})</span> : null}</div>
                    ))}
                  </div>
                )}
                {src.lastRunNote && <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>{src.lastRunNote}</div>}
              </div>
            );
          })()}
          {sourceDetail.params && (
            <div style={{ marginBottom: 12, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-1)' }}>
              <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Params điền cho project này</div>
              {(['product', 'domain', 'pitch', 'link'] as const).map((k) => (
                <div key={k} style={{ fontSize: 11.5, display: 'flex', gap: 8, marginBottom: 2 }}>
                  <code style={{ color: 'var(--accent)', flexShrink: 0 }}>{'{' + k + '}'}</code>
                  <span style={{ color: 'var(--fg-2)', wordBreak: 'break-all' }}>{sourceDetail.params![k]}</span>
                </div>
              ))}
            </div>
          )}
          <details open>
            <summary style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Template gốc (còn {'{params}'})</summary>
            <pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', color: 'var(--fg-2)', background: 'var(--bg-2)', padding: 8, borderRadius: 6, marginTop: 4, maxHeight: 240, overflow: 'auto' }}>{src.instructionTemplate || '(trống)'}</pre>
          </details>
          {sourceDetail.filled && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Preview đã điền params cho project</summary>
              <pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', color: 'var(--fg-2)', background: 'var(--bg-2)', padding: 8, borderRadius: 6, marginTop: 4, maxHeight: 240, overflow: 'auto' }}>{sourceDetail.filled}</pre>
            </details>
          )}
          <div style={{ marginTop: 10 }}>
            <a href={`/architecture?obj=backlink`} style={{ fontSize: 11, color: 'var(--fg-3)', textDecoration: 'none' }} title="Nguồn dùng chung cho mọi project — sửa ở catalog (Seed catalog → ✎)">↗ Sửa nguồn trong catalog</a>
          </div>
        </>); })()}
      </Drawer>
    )}
    </>
  );
}
