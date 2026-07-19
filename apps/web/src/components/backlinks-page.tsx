'use client';

// Per-project backlink task surface (CRM-style, /p/[id]/backlinks). Lists the backlink
// sources that apply to THIS project's site (membership = site_status[slug]) and lets the
// admin assign each to a team user (→ ext /api/ext/my-tasks) and track per-site status +
// the live placed URL. A source is shared across sites; here we focus on this site.
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { wrapExternalUrl } from '@/lib/external-url';
import { setBacklinkSite, setBacklinkSchedule, splitBacklinkTask, deleteBacklinkTask, dropBacklinkSiblings, restoreBacklinkTask, listDroppedSources, restoreDroppedSource, verifyBacklink, verifyAllBacklinks, setBacklinkAccount, listBacklinkAccountOptions, setBacklinkNote, setBacklinkBlocker, seenBacklinkResolved } from '@/lib/actions/architecture';
import { listBacklinkSources, seedBacklinksFromCatalog, upsertBacklinkSource, setBacklinkSourceStatus, type BacklinkSource } from '@/lib/actions/backlink-catalog';
import { AssigneeCell } from '@/components/assignee-chip';
import { AccountFormModal } from '@/components/accounts-vault';
import { getAccountForEditAny } from '@/lib/actions/accounts';
import { StatusSegmented, MonthCalendar, ViewToggle, LIST_CALENDAR_VIEWS, Drawer, type CalItem } from '@/components/ui';
import { ImageAttach, discardAttachments } from '@/components/ui/image-attach';
import { searchBacklinkMedia, attachBacklinkMedia, generateBacklinkMedia, autoPrepareProjectMedia, deleteBacklinkMedia, generateBacklinkDraft, condenseBacklinkDraft } from '@/lib/actions/backlink-media';
import { suggestProjectStack } from '@/lib/actions/projects';
import { listAiContent, generateAiContent, deleteAiContent, normalizeInstructions, normalizeProjectInstructions, type AiContentRow } from '@/lib/actions/ai-content';
import type { PhotoCandidate } from '@/lib/stock-photos';
import { READINESS_META, ACCOUNT_ROLE_META, type ReadinessBucket, type AccountRole } from '@/lib/backlink-account-type';
import type { BacklinkTask, BacklinkVerify } from '@/lib/actions/backlink-tasks';
import type { PlatformRow, AccountRow, MediaRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import type { ProxyRow, BrowserProfileRow } from '@/lib/actions/environments';
import type { TeamMemberRow } from '@/lib/actions/team';

// One status taxonomy for the whole page. SITE_STATUS is the single source of truth —
// it drives BOTH the status picker (StatusSegmented) and the tabs/KPI, so they never
// diverge (no separate tab-rollup vocabulary). Tabs = these statuses + "All".
const SITE_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'To do',      color: '#8a92a3' },
  claimed:   { label: 'In progress', color: '#ffb03c' },
  submitted: { label: 'Submitted',  color: '#9d6cff' },  // posted, awaiting moderation/approval — link not live yet
  completed: { label: 'Completed',  color: '#5badff' },
  verified:  { label: 'Verified',   color: '#22c55e' },
  broken:    { label: 'Link lỗi',   color: '#ef4444' },  // was live, a re-check found the link gone — needs re-do (auto-set by the health-check cron)
};
const STATUS_ORDER = ['pending', 'claimed', 'submitted', 'completed', 'verified', 'broken'] as const;
type TabKey = 'all' | (typeof STATUS_ORDER)[number];

const EXT = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
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
  : { c: '#ffb03c', t: '⚠ nofollow' };

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
// Render instruction text as an aligned list: a fixed gutter (step number / leading emoji /
// dash) + the body. Numbered steps keep their number; emoji-led meta lines (🔗🔑📍✅) get the
// emoji in the gutter; a short line ending ":" is a sub-heading. URLs stay clickable via LinkText.
function Steps({ text, onBlock, urlValue, onUrlChange, onUrlSave, urlSaving }: {
  text: string;
  onBlock?: (reason: string, shot?: string) => Promise<void> | void;   // ⚠ per-line report → flag blocker (+ optional screenshot)
  urlValue?: string; onUrlChange?: (v: string) => void; onUrlSave?: () => void; urlSaving?: boolean;
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
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-2)', marginBottom: 5 }}>✅ Làm xong — dán link vào đây</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={urlValue || ''} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://… link đã đặt được" autoComplete="off"
            style={{ flex: 1, minWidth: 0, padding: '5px 9px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12 }} />
          {onUrlSave && <button type="button" onClick={onUrlSave} disabled={urlSaving} style={{ ...btn, padding: '3px 12px', fontWeight: 700 }}>{urlSaving ? '…' : 'Lưu'}</button>}
        </div>
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
  return (
    <span role="button" onClick={onClick} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, cursor: 'pointer', maxWidth: 132,
        background: `color-mix(in srgb, ${m.color} 15%, transparent)`, color: m.color, border: `1px solid color-mix(in srgb, ${m.color} 45%, transparent)` }}>
      <span>{m.icon}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  );
}

// Catalog source editor (add/edit a backlink_sources row). Stacks over the seed picker.
function SourceEditor({ initial, onClose, onSaved }: { initial: BacklinkSource | Record<string, never>; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const s = initial as Partial<BacklinkSource>;
  const [name, setName] = useState(s.name ?? '');
  const [url, setUrl] = useState(s.canonicalUrl ?? '');
  const [category, setCategory] = useState(s.category ?? '');
  const [dofollow, setDofollow] = useState(s.dofollow ?? '');
  const [da, setDa] = useState(s.da ?? '');
  const [traffic, setTraffic] = useState(s.traffic ?? '');
  const [aud, setAud] = useState((s.audienceTags ?? []).join(', '));
  const [platformKey, setPlatformKey] = useState(s.platformKey ?? '');
  const [gates, setGates] = useState(s.gates ?? '');
  const [tpl, setTpl] = useState(s.instructionTemplate ?? '');
  const [status, setStatus] = useState(s.sourceStatus ?? 'active');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const r = await upsertBacklinkSource({ id: s.id, canonicalUrl: url, name, category, dofollow, da, traffic, audienceTags: aud.split(',').map((x) => x.trim()).filter(Boolean), instructionTemplate: tpl, gates, platformKey, sourceStatus: status });
    setBusy(false);
    if (r.ok) await onSaved(); else setErr(r.error || 'lỗi');
  };
  const field: CSSProperties = { fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', width: '100%', boxSizing: 'border-box' };
  const lbl: CSSProperties = { fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3, display: 'block' };
  return (
    <Drawer onClose={onClose} width={560} zIndex={300}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{s.id ? '✎ Sửa nguồn' : '➕ Nguồn mới'}</h2>
        <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px' }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div><label style={lbl}>Tên *</label><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" style={field} /></div>
        <div><label style={lbl}>URL hành động *</label><input value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" placeholder="https://…/submit" style={field} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Category</label>
            <select value={category ?? ''} onChange={(e) => setCategory(e.target.value)} style={field}>
              <option value="">—</option>{['tool-dir', 'forum', 'edu-resource', 'haro', 'listicle', 'wiki', 'social', 'llms', 'qa', 'directory', 'guest-post'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div style={{ flex: 1 }}><label style={lbl}>Dofollow</label>
            <select value={dofollow ?? ''} onChange={(e) => setDofollow(e.target.value)} style={field}>
              <option value="">—</option>{['dofollow', 'nofollow', 'mixed'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>DA</label><input value={da ?? ''} onChange={(e) => setDa(e.target.value)} autoComplete="off" style={field} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Traffic</label><input value={traffic ?? ''} onChange={(e) => setTraffic(e.target.value)} autoComplete="off" style={field} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Platform key</label><input value={platformKey ?? ''} onChange={(e) => setPlatformKey(e.target.value)} autoComplete="off" style={field} /></div>
        </div>
        <div><label style={lbl}>Audience tags (phẩy)</label><input value={aud} onChange={(e) => setAud(e.target.value)} autoComplete="off" placeholder="games, general, finance…" style={field} /></div>
        <div><label style={lbl}>Gates / điều kiện</label><input value={gates ?? ''} onChange={(e) => setGates(e.target.value)} autoComplete="off" style={field} /></div>
        <div><label style={lbl}>Instruction template (chỗ trống {'{product}'} / {'{domain}'})</label><textarea value={tpl ?? ''} onChange={(e) => setTpl(e.target.value)} rows={9} style={{ ...field, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} /></div>
        <div><label style={lbl}>Trạng thái</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={field}>{['active', 'needs-review', 'broken', 'archived'].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <button type="button" onClick={save} disabled={busy || !name.trim() || !url.trim()} style={{ ...btn, background: 'var(--accent)', color: '#fff', borderColor: 'transparent', fontWeight: 700 }}>{busy ? '⏳ lưu…' : '💾 Lưu'}</button>
        {err && <span style={{ fontSize: 12, color: 'var(--bad,#ef4444)' }}>✗ {err}</span>}
      </div>
    </Drawer>
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
  const initTab = ([...STATUS_ORDER, 'all'] as const).find((t) => t === sp.get('tab')) ?? 'all';
  const [tab, setTab] = useState<TabKey>(initTab);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [follow, setFollow] = useState<string>(sp.get('follow') ?? '');   // dofollow filter
  const [traf, setTraf] = useState<string>(sp.get('traf') ?? '');          // traffic filter
  const [draftOnly, setDraftOnly] = useState(sp.get('draft') === '1');
  const [blockedOnly, setBlockedOnly] = useState(sp.get('blocked') === '1');
  const [openId, setOpenId] = useState<number | null>(Number(sp.get('task')) || null);
  const [readyFilter, setReadyFilter] = useState<ReadinessBucket | ''>((sp.get('ready') as ReadinessBucket) || '');
  const [view, setView] = useState<'list' | 'calendar'>(sp.get('view') === 'list' ? 'list' : 'calendar');

  const openTask = (id: number) => setOpenId(id);
  const closeTask = () => setOpenId(null);

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
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedSrcs, setSeedSrcs] = useState<BacklinkSource[] | null>(null);
  const [seedAud, setSeedAud] = useState('');
  const [seedSel, setSeedSel] = useState<Set<number>>(new Set());
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const reloadSeed = async () => setSeedSrcs(await listBacklinkSources({ projectId, status: 'active' }));
  const openSeed = async () => { setSeedOpen(true); setSeedSrcs(null); setSeedSel(new Set()); setSeedMsg(''); setSeedAud(''); await reloadSeed(); };
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
    set('view', view === 'list' ? 'list' : '');   // default (calendar) → clean URL
    set('task', openId);
    window.history.replaceState(null, '', u);
  }, [tab, q, follow, traf, draftOnly, blockedOnly, readyFilter, view, openId]);

  // Create/edit a platform account in-place (no page jump). null = closed.
  const [acctModal, setAcctModal] = useState<{ account: AccountRow | null; platformKey?: string; assignToTask?: number; recommendedRole?: AccountRole } | null>(null);
  // assignToTask: pin the newly-created account to this backlink task on create.
  const openCreateAccount = (platformKey: string, assignToTask?: number, recommendedRole?: AccountRole) => setAcctModal({ account: null, platformKey, assignToTask, recommendedRole });
  const openEditAccount = (account: AccountRow) => setAcctModal({ account });
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
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (tab !== 'all' && t.siteState !== tab) return false;
      if (follow && (t.dofollow || '') !== follow) return false;
      if (traf && (t.traffic || '') !== traf) return false;
      if (draftOnly && !t.hasDraft) return false;
      if (blockedOnly && !t.blocker) return false;
      if (readyFilter && t.readiness !== readyFilter) return false;
      if (s && !(t.title.toLowerCase().includes(s) || (t.sourceUrl || '').toLowerCase().includes(s))) return false;
      return true;
    });
  }, [tasks, tab, follow, traf, draftOnly, blockedOnly, q, readyFilter]);

  const shown = useMemo(() => (tab === 'pending'
    ? [...filtered].sort((a, b) => Number(!!a.assignedUserId) - Number(!!b.assignedUserId))
    : filtered), [filtered, tab]);

  // Calendar items from the SAME filtered set: done → solid on done date; scheduled-not-done → dim.
  const calItems = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    for (const t of filtered) {
      const label = t.sourceUrl ? hostOf(t.sourceUrl) : t.title;
      if (t.siteDoneAt) out.push({ id: t.id, date: t.siteDoneAt.slice(0, 10), label, color: '#22c55e', title: `✓ ${t.title}` });
      else if (t.siteState === 'submitted' && t.siteSubmittedAt) out.push({ id: t.id, date: t.siteSubmittedAt.slice(0, 10), label, color: '#9d6cff', title: `⏳ chờ duyệt · ${t.title}` });
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
          <button type="button" onClick={doCheckLinks} disabled={chk === 'busy'} style={{ ...btn }}
            title="Kiểm tra sức khoẻ mọi link đã đặt (còn sống? dofollow?) — kết quả hiện badge ngay trong list">
            {chk === 'busy' ? '⏳ đang kiểm…' : chk ? `✓ ${chk}` : '🔍 Check links'}
          </button>
          <button type="button" onClick={openSeed} style={{ ...btn, color: 'var(--accent)' }} title="Seed nguồn backlink từ catalog dùng chung (mọi dự án) — lọc theo audience, tạo task hàng loạt">➕ Seed catalog</button>
          <button type="button" onClick={doNormalize} disabled={normBusy} style={{ ...btn }} title="Chuẩn hoá khuôn cho các task hướng dẫn còn sơ sài (thiếu bước/📍) của site này — AI reshape giữ nội dung, không bịa">
            {normBusy ? '⏳ đang chuẩn hoá…' : normMsg && normMsg.startsWith('✓') ? normMsg : '✨ Chuẩn khuôn'}
          </button>
          <button type="button" onClick={openTrash} style={{ ...btn }} title="Nguồn đã drop — khôi phục bất cứ lúc nào">🗑 Đã drop</button>
          <a href={`/architecture?obj=backlink&site=${slug}`} style={{ ...btn, textDecoration: 'none' }} title="Mở bird's-eye cross-project trong Architect">↗ Architect</a>
        </div>
      </div>
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
        const shown = (seedSrcs || []).filter((s) => !seedAud || s.audienceTags.includes(seedAud));
        const newCount = seedSel.size;
        return (
          <Drawer onClose={() => setSeedOpen(false)} width={660} backgrounded={!!srcEdit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>➕ Seed từ catalog nguồn</h2>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" onClick={() => setSrcEdit({})} style={{ ...btn, color: 'var(--accent)', padding: '2px 9px' }} title="Thêm nguồn mới vào catalog dùng chung">➕ Thêm nguồn</button>
                <button type="button" onClick={() => setSeedOpen(false)} style={{ ...btn, padding: '2px 9px' }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 10 }}>
              Catalog nguồn dùng chung cho mọi dự án. Chọn nguồn → tạo task cho <b>{siteLabel}</b>. Nguồn đã có tự bỏ qua. <code>{'{product}'}</code>/<code>{'{domain}'}</code> điền sẵn; ví dụ chủ đề trong hướng dẫn nhớ chỉnh cho đúng sản phẩm.
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Audience</span>
              {auds.map((a) => <button key={a} type="button" onClick={() => setSeedAud(seedAud === a ? '' : a)} style={chip('var(--accent)', seedAud === a)}>{a}</button>)}
            </div>
            {seedSrcs === null ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>đang tải catalog…</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '52vh', overflowY: 'auto' }}>
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
                            <span style={{ color: 'var(--fg-4)' }}>{s.audienceTags.join(' · ')}</span>
                          </div>
                        </div>
                      </label>
                      <button type="button" onClick={() => setSrcEdit(s)} title="Sửa nguồn trong catalog" style={{ ...btn, padding: '2px 8px', flexShrink: 0 }}>✎</button>
                    </div>
                  ))}
                  {shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Không có nguồn nào khớp bộ lọc.</div>}
                </div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <button type="button" onClick={doSeed} disabled={seedBusy || newCount === 0} style={{ ...btn, background: 'var(--accent)', color: '#fff', borderColor: 'transparent', fontWeight: 700, opacity: newCount === 0 ? 0.5 : 1 }}>{seedBusy ? '⏳ đang tạo…' : `➕ Seed ${newCount} nguồn`}</button>
              {seedMsg && <span style={{ fontSize: 12, color: seedMsg.startsWith('✓') ? 'var(--good,#39c07a)' : 'var(--bad,#ef4444)' }}>{seedMsg}</span>}
            </div>
          </Drawer>
        );
      })()}

      {srcEdit && <SourceEditor initial={srcEdit} onClose={() => setSrcEdit(null)} onSaved={async () => { setSrcEdit(null); await reloadSeed(); }} />}

      {/* KPI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {([['total', 'Total', 'var(--fg-1)'], ...STATUS_ORDER.map((s) => [s, SITE_STATUS[s]!.label, SITE_STATUS[s]!.color] as const)] as const).map(([k, label, c]) => (
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
            {prep.missing.map(([k, { label, role }]) => (
              <button key={k} type="button" onClick={() => openCreateAccount(k, undefined, role)} title={`Tạo account — nên loại ${ACCOUNT_ROLE_META[role].label}: ${ACCOUNT_ROLE_META[role].why}`} style={{ ...btn, color: 'var(--accent)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>➕ {label} <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ACCOUNT_ROLE_META[role].color, border: `1px solid ${ACCOUNT_ROLE_META[role].color}`, borderRadius: 3, padding: '0 4px' }}>{ACCOUNT_ROLE_META[role].badge}</span></button>
            ))}
          </div>
        )}
      </div>

      {/* tabs + filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_ORDER.map((s) => <TabBtn key={s} k={s} label={SITE_STATUS[s]!.label} n={kpi[s]} />)}
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
        <button type="button" onClick={() => setBlockedOnly((v) => !v)} title="Chỉ hiện task nhân sự báo vướng" style={chip('#ef4444', blockedOnly)}>🚩 vướng</button>
        {(q || follow || traf || draftOnly || blockedOnly) && <button type="button" onClick={() => { setQ(''); setFollow(''); setTraf(''); setDraftOnly(false); setBlockedOnly(false); }} style={btn}>Clear</button>}
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
                {t.siteState === 'submitted' && t.siteSubmittedAt && <Tag color="#9d6cff">⏳ chờ duyệt {daysSince(t.siteSubmittedAt)}d</Tag>}
                {t.siteScheduledAt && !t.siteDoneAt && <Tag color="#ffb03c">🗓 {t.siteScheduledAt}</Tag>}
                {t.siteDoneAt && <Tag color="#22c55e">✓ {t.siteDoneAt.slice(0, 10)}</Tag>}
                {(() => { const m = verifyMeta(t.siteVerify); return m ? <Tag color={m.c}>{m.t}</Tag> : null; })()}
                {t.appliesTo.length > 1 && <Tag>+{t.appliesTo.length - 1} sites</Tag>}
                {t.blocker && (t.blocker.paused ? <Tag color="#ffb03c">⏸ tạm dừng</Tag> : <Tag color="var(--bad,#ef4444)">🚩 vướng</Tag>)}
                {!t.blocker && t.resolved && <Tag color="#22c55e">🟢 vừa gỡ vướng</Tag>}
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

      {open && <TaskDrawer task={open} slug={slug} project={project} accounts={accounts} media={media} backgrounded={!!acctModal} onClose={closeTask} setSite={setSite} setSchedule={setSchedule} onChange={() => start(() => router.refresh())} onCreateAccount={openCreateAccount} onEditAccount={openEditAccount} onOpenTask={openTask} onDelete={deleteTask} onDropSource={dropSource} />}

      {undoRows && undoRows.length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 400, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line-2)', boxShadow: '0 8px 30px rgba(0,0,0,.4)', fontSize: 13 }}>
          <span>{undoRows.length > 1 ? <>Đã drop <b>{undoRows.length}</b> task cùng nguồn</> : <>Đã xoá task <b>{String(undoRows[0]?.title || '')}</b></>}</span>
          <button type="button" onClick={undoDelete} style={{ ...btn, color: 'var(--accent)', fontWeight: 700 }}>↩ Hoàn tác</button>
        </div>
      )}

      {/* Account create/edit in-place as a right-side DRAWER — stacks above the task drawer. */}
      {acctModal && (
        <div style={{ position: 'relative', zIndex: 300 }}>
          <AccountFormModal account={acctModal.account} project={project} projectId={projectId}
            platforms={platforms} presetPlatformKey={acctModal.platformKey} presetAccountType={acctModal.recommendedRole}
            teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles} asDrawer
            onCreated={acctModal.assignToTask != null ? (async (newId: number) => { await setBacklinkAccount(acctModal.assignToTask!, newId); setAcctModal(null); start(() => router.refresh()); }) : undefined}
            onClose={() => { setAcctModal(null); start(() => router.refresh()); }} />
        </div>
      )}
    </div>
  );
}

function TaskDrawer({ task, slug, project, accounts, media, backgrounded, onClose, setSite, setSchedule, onChange, onCreateAccount, onEditAccount, onOpenTask, onDelete, onDropSource }: {
  task: BacklinkTask; slug: string; project: Project; accounts: AccountRow[]; media: MediaRow[]; backgrounded?: boolean; onClose: () => void; setSite: (id: number, status: string, url: string) => Promise<void>; setSchedule: (id: number, date: string) => Promise<void>; onChange: () => void;
  onCreateAccount: (platformKey: string, assignToTask?: number, recommendedRole?: AccountRole) => void; onEditAccount: (account: AccountRow) => void; onOpenTask: (id: number) => void; onDelete: (id: number) => void; onDropSource: (id: number, reason?: string) => void;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Saving a live URL = the backlink is placed → auto-advance an open status to Completed.
  const saveUrl = async () => {
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
  // ✨ Chuẩn hoá — AI reshape this task's instructions into the canonical template.
  const [normBusy, setNormBusy] = useState(false);
  const doNormalize = async () => { setNormBusy(true); await normalizeInstructions(task.id); setNormBusy(false); onChange(); };
  // ⚠ report on a specific instruction line → flag the blocker directly (+ optional screenshot).
  const blockWithReason = async (reason: string, shot?: string) => { await setBacklinkBlocker(task.id, reason, shot); onChange(); };
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
  // Open the account editor. Backlink accounts are tenant-shared, so a task's account may
  // not be in this project's `accounts` list — fetch it by id in that case.
  const openAcct = async () => {
    if (task.accountId == null) return;
    if (acctObj) { onEditAccount(acctObj); return; }
    const row = await getAccountForEditAny(task.accountId);
    if (row) onEditAccount(row);
  };
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
  const isEmailPitch = /\b(email|pitch|editorial|librarian|curator)\b/i.test(`${task.mechanism || ''} ${task.instructions || ''}`);
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
    <Drawer onClose={onClose} width={720} backgrounded={backgrounded}>
      <div>
        {/* Header — title + close only. Split + delete demoted to the footer utility row. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{task.title}</h2>
          <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px', flexShrink: 0 }}>✕</button>
        </div>

        {/* meta: source · captured-DOM check link · DOM-grounded badge (small, for the person doing + checking here) */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, fontSize: 11 }}>
          {task.sourceUrl && <a href={wrapExternalUrl(task.sourceUrl)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(task.sourceUrl)}</a>}
          {task.domSampleId && <a href={`/api/dom-sample/${task.domSampleId}`} target="_blank" rel="noopener noreferrer" title="Xem DOM trang này đã capture — cấu trúc THẬT (nút/field/label) mà hướng dẫn bám theo" style={{ color: 'var(--fg-3)' }}>🔎 DOM đã lưu</a>}
          {task.grounded && <span title={`Hướng dẫn viết dựa trên DOM thật (${task.grounded.source || 'dom'}${task.grounded.sampleAt ? ' · capture ' + fmtWhen(task.grounded.sampleAt) : ''})`} style={{ color: 'var(--ok,#22c55e)', fontWeight: 700 }}>✓ dựa trên DOM thật</span>}
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

        {/* 1 · Source & how-to — read first: where to place, how, and the build steps. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {task.sourceUrl && <a href={wrapExternalUrl(task.sourceUrl)} {...EXT} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'underline dotted' }}>↗ {hostOf(task.sourceUrl)}</a>}
          {task.da && <Tag>DA {task.da}</Tag>}
          {task.dofollow && <Tag color="#9d6cff">{task.dofollow}</Tag>}
          {task.traffic && <Tag color="#22c55e">{task.traffic}</Tag>}
          {task.rank && <Tag color="#ffb03c">rank {task.rank}</Tag>}
        </div>
        {task.mechanism && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 6 }}><span style={{ color: 'var(--fg-4)' }}>Cách đặt: </span>{task.mechanism}</div>}
        {task.instructions && (<>
          <div style={{ ...lbl, color: 'var(--accent)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🛠 Cách build</span>
            <button type="button" onClick={doNormalize} disabled={normBusy} title="AI viết lại hướng dẫn theo khuôn chuẩn (bước đánh số + dòng meta + link kỳ vọng)"
              style={{ ...btn, padding: '1px 8px', textTransform: 'none', letterSpacing: 0, fontWeight: 700, marginLeft: 'auto', color: 'var(--accent)' }}>{normBusy ? '…' : '✨ Chuẩn hoá'}</button>
          </div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px' }}>
            <Steps text={task.instructions} onBlock={blockWithReason} urlValue={url} onUrlChange={setUrl} onUrlSave={saveUrl} urlSaving={saveState === 'saving'} />
          </div>
        </>)}

        {/* 2 · Claim — assign an owner (auto-advances To do → In progress). */}
        <div style={lbl}>Assign to (nhận việc)</div>
        <AssigneeCell taskId={task.id} name={task.assignee || ''} assignedId={task.assignedUserId} onChange={onAssign} />

        {/* 3 · Account — must be ready before posting. */}
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
            <button type="button" onClick={togglePicker} title="Đổi sang account khác / tạo account mới cho nguồn này" style={{ ...btn, padding: '2px 8px', marginLeft: 'auto' }}>{acctPick ? 'đóng' : '⇄ đổi acc'}</button>
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
                  <button key={a.id} type="button" onClick={() => pickAcct(a.id)} disabled={cur}
                    style={{ ...btn, textAlign: 'left', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', opacity: cur ? 0.55 : 1 }}>
                    <span style={{ fontWeight: 700 }}>@{a.handle || a.id}</span>
                    <Tag>{a.status}</Tag>
                    {foreign && <Tag color="#ffb03c">↗ {a.homeProjectId}</Tag>}
                    {cur && <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>đang dùng</span>}
                  </button>
                );
              })}
            </div>
            {task.platformKey && <button type="button" onClick={() => onCreateAccount(task.platformKey!, task.id, task.recommendedRole)} style={{ ...btn, color: 'var(--accent)', fontWeight: 700, textAlign: 'left' }}>＋ Tạo account mới cho {project.name}</button>}
          </div>
        )}

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
        {(needsPost || task.draft) && (
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
        <Disclosure title="🔗 Link · kiểm tra · lịch" defaultOpen={!!(task.siteLiveUrl || task.siteScheduledAt || task.siteDoneAt)}>
        <div style={lbl}>Live URL (link đã đặt được @ {slug})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoComplete="off"
            style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, boxSizing: 'border-box' }} />
          <button type="button" onClick={saveUrl} disabled={saveState === 'saving'}
            style={{ ...btn, fontWeight: 700, minWidth: 78, borderColor: saveState === 'saved' ? 'var(--ok)' : 'var(--line)', color: saveState === 'saved' ? 'var(--ok)' : 'var(--fg-1)' }}>
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ Đã lưu' : 'Lưu'}</button>
        </div>

        {/* 8 · Verify — own action row (auto-advances Completed → Verified on a dofollow hit). */}
        <div style={lbl}>🔍 Kiểm tra link @ {slug}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
          <button type="button" onClick={doVerify} disabled={vbusy || !(task.siteLiveUrl || url.trim())}
            title="Fetch link → kiểm tra domain mình có được link + dofollow không; đạt sẽ tự lên Verified"
            style={{ ...btn, fontWeight: 700 }}>{vbusy ? '…' : '🔍 Kiểm tra'}</button>
          {!(task.siteLiveUrl || url.trim()) && <span style={{ color: 'var(--fg-4)' }}>Lưu Live URL ở trên trước</span>}
          {vres && (() => { const m = verifyMeta(vres); return m ? <span style={{ color: m.c }}>{m.t} · kiểm {fmtWhen(vres.checkedAt)}</span> : null; })()}
        </div>

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
  );
}
