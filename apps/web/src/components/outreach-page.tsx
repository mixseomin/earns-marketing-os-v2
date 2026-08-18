'use client';

// Outreach pipeline UI — cold-pitch the BAH map to base-area realtors.
// Two channels, kept distinct: EMAIL prospects auto-send via Mailjet; FORM-only prospects
// (no public email) are submitted by hand through the realtor's contact form. Tabs synced to
// ?tab= so F5 keeps place. 'Embedded' is auto-flipped by the GA4 embed_host cron (Phase 3).
// All external links open with no referrer so the target site never sees the internal tool URL.
import { Suspense, useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { shallowReplaceUrl } from '@/lib/url-shallow';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { buildEmailForProspect } from '@/lib/outreach-template';
import { setProspectStatus, markFollowupSent, snoozeProspect, markFormSubmitted, updateProspectContact, updateProspectDraft } from '@/lib/actions/outreach-mutations';
import { sendProspectEmail } from '@/lib/actions/outreach-send';
import { MonthCalendar, ViewToggle, LIST_CALENDAR_VIEWS, ListToolbar, FilterChips, MultiSelect, type CalItem } from '@/components/ui';
import { createCampaign, updateCampaign, importBacklinkTasks, type OutreachCampaign } from '@/lib/actions/outreach-campaigns';
import { generateIdentityAI, type IdentityRow } from '@/lib/actions/identities';
import { TaskOutreachDrawer } from '@/components/task-outreach-drawer';
import { hostOf } from '@/lib/host';

type TabKey = 'needs' | 'due' | 'pipeline' | 'all';

// Open externals with no referrer + noopener: the realtor's site never sees mos2.on.tc in Referer.
const EXT = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  to_send: { label: 'To send', color: 'var(--fg-3)' },
  sent: { label: 'Sent', color: 'var(--neon-cyan)' },
  followup_1: { label: 'Follow-up 1', color: 'var(--neon-amber)' },
  followup_2: { label: 'Follow-up 2', color: 'var(--neon-amber)' },
  replied: { label: 'Replied', color: 'var(--neon-violet)' },
  interested: { label: 'Interested', color: 'var(--neon-lime)' },
  embedded: { label: 'Embedded ★', color: 'var(--neon-lime)' },
  declined: { label: 'Declined', color: 'var(--fg-3)' },
  bounced: { label: 'Bounced', color: 'var(--bad)' },
  unreachable: { label: 'Unreachable', color: 'var(--bad)' },
  no_response: { label: 'No response', color: 'var(--fg-3)' },
};
const meta = (s: string) => STATUS_META[s] || { label: s, color: 'var(--fg-2)' };

const ACTIVE = new Set(['sent', 'followup_1', 'followup_2']);
const DEAD = new Set(['declined', 'bounced', 'no_response', 'unreachable']);
const SENDABLE = new Set(['to_send', 'sent', 'followup_1', 'followup_2']);

function dueNow(p: OutreachProspect): boolean {
  if (!ACTIVE.has(p.status) || !p.nextFollowupAt) return false;
  const now = Date.now();
  if (new Date(p.nextFollowupAt).getTime() > now) return false;
  if (p.snoozeUntil && new Date(p.snoozeUntil).getTime() > now) return false;
  return true;
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
const gmailUrl = (to: string, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;


const btn: CSSProperties = {
  fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line, var(--bg-3))',
  background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap',
};
const taStyle: CSSProperties = {
  width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.5, padding: 10,
  borderRadius: 8, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-1)', resize: 'vertical',
};
// Two visually distinct button families so channel actions never look like status actions:
//  · CHANNEL (do the outreach) = solid 1.5px border + filled tint, pill — Email ✉ / Form 📝
//  · RESPONSE (record what happened) = dashed border, transparent, square-ish chip — Replied/Declined/…
const chanStyle = (c: string): CSSProperties => ({
  fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 999,
  border: `1.5px solid ${c}`, background: `color-mix(in srgb, ${c} 16%, transparent)`,
  color: c, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4,
});
const respStyle = (c: string): CSSProperties => ({
  fontSize: 11, padding: '2px 8px', borderRadius: 4,
  border: `1px dashed color-mix(in srgb, ${c} 55%, transparent)`, background: 'transparent',
  color: c, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3,
});

// Identity used to fill the realtor's contact-form fields (Name/Email), matching the email sender.
const SENDER = { name: 'Jake Miller', email: 'hello@militarycalc.com', phone: '' };

// One labelled contact-form field with its own Copy button (forms have Name/Email/Phone/Subject, not just a message).
function CopyField({ label, value }: { label: string; value: string }) {
  const [c, setC] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 6px' }}>
      <div style={{ width: 70, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: value ? 'var(--fg-0)' : 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '— (optional, leave blank)'}</div>
      {value && (
        <button style={btn} onClick={() => { navigator.clipboard?.writeText(value).then(() => { setC(true); setTimeout(() => setC(false), 1200); }).catch(() => {}); }}>
          {c ? '✓' : 'Copy'}
        </button>
      )}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const m = meta(status);
  return (
    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: `color-mix(in srgb, ${m.color} 18%, transparent)`, color: m.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function ChannelTag({ email }: { email: string | null }) {
  const isForm = !email;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 99, background: isForm ? 'color-mix(in srgb, var(--neon-amber) 22%, transparent)' : 'color-mix(in srgb, var(--neon-cyan) 18%, transparent)', color: isForm ? 'var(--neon-amber)' : 'var(--neon-cyan)' }}>
      {isForm ? 'FORM' : 'EMAIL'}
    </span>
  );
}

const CAMP_ICON: Record<string, string> = { embed: '🧩', backlink: '🔗', sales: '💰', recruit: '🧑‍💼', custom: '📣' };
const CAMP_TYPES = ['embed', 'backlink', 'sales', 'recruit', 'custom'];
const campPill = (on: boolean, status?: string): CSSProperties => ({
  fontSize: 11.5, fontWeight: on ? 700 : 500, padding: '3px 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${on ? 'var(--neon-cyan)' : 'var(--bg-3)'}`, background: on ? 'color-mix(in srgb, var(--neon-cyan) 16%, transparent)' : 'var(--bg-2)',
  color: on ? 'var(--neon-cyan)' : 'var(--fg-2)', opacity: status === 'paused' ? 0.6 : 1,
});

// Module-level (STABLE identity) — must NOT be nested in OutreachInner, else every parent
// re-render remounts it and wipes the half-typed form (the "đổi type mất tên" bug).
function CampaignForm({ init, projectId, identities, onClose, onSaved }: { init: OutreachCampaign; projectId: string; identities: IdentityRow[]; onClose: () => void; onSaved: () => void }) {
  const isNew = init.id === 0;
  const [f, setF] = useState({
    name: init.name, type: init.type, status: init.status,
    fromEmail: init.fromEmail || '', fromName: init.fromName || '',
    dailyCap: init.dailyCap, followupGapDays: init.followupGapDays, maxFollowups: init.maxFollowups,
    autoSend: init.autoSend ?? (init.type !== 'backlink'),   // backlink defaults to manual (quality)
    // '' = chưa chọn, 'custom' = nhập tay, else = identity id
    identitySel: identities.find((i) => i.email && i.email === (init.fromEmail || ''))?.id.toString() ?? (init.fromEmail ? 'custom' : ''),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [extra, setExtra] = useState<IdentityRow[]>([]);   // AI-created identities (chưa qua refresh)
  const idOptions = [...extra, ...identities];
  const inp: CSSProperties = { fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-0)' };
  const lblS: CSSProperties = { fontSize: 11, color: 'var(--fg-3)', display: 'flex', gap: 4, alignItems: 'center' };
  const pickIdentity = (val: string) => {
    if (val === '') { setF((c) => ({ ...c, identitySel: '', fromName: '', fromEmail: '' })); return; }
    if (val === 'custom') { setF((c) => ({ ...c, identitySel: 'custom' })); return; }
    const i = idOptions.find((x) => x.id.toString() === val);
    if (i) setF((c) => ({ ...c, identitySel: val, fromName: i.displayName || i.name, fromEmail: i.email }));
  };
  const aiCreate = async () => {
    setAiBusy(true); setErr(null);
    const r = await generateIdentityAI(projectId, 'brand');
    setAiBusy(false);
    if (r.ok && r.identity) {
      const idn = r.identity;
      setExtra((e) => [idn, ...e]);
      setF((c) => ({ ...c, identitySel: idn.id.toString(), fromName: idn.displayName || idn.name, fromEmail: idn.email }));
    } else setErr(r.error || 'AI lỗi');
  };
  const save = async () => {
    if (!f.name.trim()) { setErr('nhập tên campaign'); return; }
    setBusy(true); setErr(null);
    const r = isNew
      ? await createCampaign({ projectId, name: f.name, type: f.type, autoSend: f.autoSend, fromEmail: f.fromEmail || undefined, fromName: f.fromName || undefined, dailyCap: f.dailyCap, followupGapDays: f.followupGapDays, maxFollowups: f.maxFollowups })
      : await updateCampaign(init.id, projectId, { name: f.name, type: f.type, status: f.status, autoSend: f.autoSend, fromEmail: f.fromEmail, fromName: f.fromName, dailyCap: f.dailyCap, followupGapDays: f.followupGapDays, maxFollowups: f.maxFollowups });
    setBusy(false);
    if (r.ok) onSaved(); else setErr(r.error || 'lỗi');
  };
  return (
    <div style={{ border: '1px solid var(--bg-3)', borderRadius: 8, background: 'var(--bg-2)', padding: 12, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{isNew ? '＋ Campaign mới' : `⚙ Sửa: ${init.name}`}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tên campaign" autoComplete="off" style={{ ...inp, flex: 1, minWidth: 180 }} />
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} style={inp}>{CAMP_TYPES.map((t) => <option key={t} value={t}>{CAMP_ICON[t]} {t}</option>)}</select>
        {!isNew && <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={inp}>{['active', 'paused', 'done'].map((s) => <option key={s} value={s}>{s}</option>)}</select>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', minWidth: 52 }}>Gửi</span>
        <div style={{ display: 'flex', border: '1px solid var(--bg-3)', borderRadius: 7, overflow: 'hidden' }}>
          {([[true, '🤖 Tự động'], [false, '✍️ Tay']] as const).map(([v, label]) => (
            <button key={String(v)} type="button" onClick={() => setF((c) => ({ ...c, autoSend: v }))}
              style={{ fontSize: 11, padding: '4px 12px', border: 'none', cursor: 'pointer', background: f.autoSend === v ? 'color-mix(in srgb, var(--neon-cyan) 16%, transparent)' : 'var(--bg-2)', color: f.autoSend === v ? 'var(--neon-cyan)' : 'var(--fg-2)', fontWeight: f.autoSend === v ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>{f.autoSend ? 'cron tự gửi + follow-up (Mailjet)' : 'nội dung tự sinh — anh review + gửi tay (Gmail)'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', minWidth: 52 }}>Gửi bằng</span>
          <select value={f.identitySel} onChange={(e) => pickIdentity(e.target.value)} style={{ ...inp, flex: 1, minWidth: 220 }}>
            <option value="">— Chọn identity/persona —</option>
            {idOptions.map((i) => <option key={i.id} value={i.id.toString()}>{i.kind === 'brand' ? '🏢' : '🌱'} {i.displayName || i.name}{i.email ? ` · ${i.email}` : ' · (chưa có email)'}</option>)}
            <option value="custom">✎ Nhập tay…</option>
          </select>
          <button type="button" onClick={aiCreate} disabled={aiBusy} title="AI sinh persona (tên + email) từ context project rồi lưu thành identity, chọn luôn" style={{ ...btn, fontWeight: 700, color: 'var(--neon-lime)', borderColor: 'var(--neon-lime)' }}>{aiBusy ? '✨ đang tạo…' : '✨ Tạo AI'}</button>
        </div>
        {f.identitySel === 'custom' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} placeholder="From name" autoComplete="off" style={{ ...inp, flex: 1, minWidth: 150 }} />
            <input value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} placeholder="From email (Mailjet-verified)" autoComplete="off" style={{ ...inp, flex: 1, minWidth: 180 }} />
          </div>
        )}
        {f.identitySel && f.identitySel !== 'custom' && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Gửi từ: <b>{f.fromName || '—'}</b> &lt;{f.fromEmail || 'chưa có email'}&gt;{!f.fromEmail && <span style={{ color: 'var(--neon-amber)' }}> · identity chưa có email — thêm ở trang Identities</span>}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={lblS}>Daily cap <input type="number" value={f.dailyCap} onChange={(e) => setF({ ...f, dailyCap: +e.target.value })} style={{ ...inp, width: 64 }} /></label>
        <label style={lblS}>Follow-up (ngày) <input type="number" value={f.followupGapDays} onChange={(e) => setF({ ...f, followupGapDays: +e.target.value })} style={{ ...inp, width: 56 }} /></label>
        <label style={lblS}>Max follow-up <input type="number" value={f.maxFollowups} onChange={(e) => setF({ ...f, maxFollowups: +e.target.value })} style={{ ...inp, width: 56 }} /></label>
      </div>
      {f.type !== 'embed' && <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4 }}>Auto-send Mailjet mới có cho <b>embed</b>. Type khác hiện để nhóm + track; nội dung sinh + gửi tay (vd <b>backlink</b> = Gmail ngay ở tab Backlinks).</div>}
      {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ ...btn, fontWeight: 700, color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }}>{busy ? '…' : isNew ? 'Tạo' : 'Lưu'}</button>
        <button onClick={onClose} style={btn}>Huỷ</button>
      </div>
    </div>
  );
}

type TouchSummary = { prospectId: number; channel: string; status: string };
export function OutreachPage(props: { projectId: string; prospects: OutreachProspect[]; campaigns: OutreachCampaign[]; identities: IdentityRow[]; touchRows?: TouchSummary[] }) {
  return (
    <Suspense fallback={null}>
      <OutreachInner {...props} />
    </Suspense>
  );
}

// Channel dots on a prospect row — email (always, from the prospect) + every touch channel, ✓ when sent.
// Makes multi-channel outreach VISIBLE on the list instead of buried in the drawer.
const CH_ICON: Record<string, string> = { email: '✉️', contact_form: '📝', facebook: 'f', x: '𝕏', linkedin: 'in', instagram: '📷', reddit: '🤖', youtube: '▶️', comment: '🗨️', telegram: '✈️', discord: '🎮', medium: '✍️', devto: '👩‍💻', github: '🐙' };
function ChanDots({ p, touches }: { p: OutreachProspect; touches: TouchSummary[] }) {
  const dots: Array<{ ch: string; done: boolean; title: string }> = [];
  if (p.email) dots.push({ ch: 'email', done: ACTIVE.has(p.status) || DEAD.has(p.status) || p.status === 'interested' || p.status === 'embedded' || p.status === 'replied', title: 'Email · ' + meta(p.status).label });
  for (const t of touches) dots.push({ ch: t.channel, done: t.status === 'sent' || t.status === 'replied', title: (CH_ICON[t.channel] || t.channel) + ' · ' + (t.status === 'sent' ? 'đã gửi' : t.status === 'replied' ? 'đã hồi' : 'chưa gửi') });
  if (!dots.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
      {dots.map((d, i) => (
        <span key={i} title={d.title} style={{ fontSize: 9, fontWeight: 700, lineHeight: '14px', minWidth: 14, height: 14, padding: '0 3px', borderRadius: 4, textAlign: 'center', background: d.done ? 'color-mix(in srgb, var(--neon-lime) 20%, transparent)' : 'var(--bg-3)', color: d.done ? 'var(--neon-lime)' : 'var(--fg-3)' }}>{CH_ICON[d.ch] || '•'}</span>
      ))}
    </span>
  );
}

function OutreachInner({ projectId, prospects: allProspects, campaigns, identities, touchRows }: { projectId: string; prospects: OutreachProspect[]; campaigns: OutreachCampaign[]; identities: IdentityRow[]; touchRows?: TouchSummary[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const touchesByProspect = useMemo(() => { const m = new Map<number, TouchSummary[]>(); for (const t of (touchRows || [])) { const a = m.get(t.prospectId) || []; a.push(t); m.set(t.prospectId, a); } return m; }, [touchRows]);
  const urlTab = sp.get('tab');
  // Defaults (no URL params): Calendar view + All status.
  const [tab, setTabState] = useState<TabKey>(
    urlTab === 'pipeline' || urlTab === 'due' || urlTab === 'needs' || urlTab === 'all' ? urlTab : 'all',
  );
  const [pending, start] = useTransition();
  // ?prospect=<id> (deep link from a backlink task's "→ Outreach") opens that prospect on first render.
  const [preview, setPreview] = useState<OutreachProspect | null>(() => {
    const pid = sp.get('prospect');
    return pid && /^\d+$/.test(pid) ? allProspects.find((x) => x.id === Number(pid)) ?? null : null;
  });
  // Drawer is URL-driven (like the backlinks page): ?prospect=<id> + ?ch=<channel> → F5 reopens the same
  // prospect on the same channel. setPreview stays the plain setter; this effect mirrors it to the URL.
  const [outreachCh, setOutreachChState] = useState<string>(() => sp.get('ch') || '');
  const setOutreachCh = (c: string) => { setOutreachChState(c); const u = new URL(window.location.href); if (c) u.searchParams.set('ch', c); else u.searchParams.delete('ch'); shallowReplaceUrl(u.toString()); };
  useEffect(() => {
    const u = new URL(window.location.href);
    if (preview) u.searchParams.set('prospect', String(preview.id));
    else { u.searchParams.delete('prospect'); u.searchParams.delete('ch'); }
    shallowReplaceUrl(u.toString());
  }, [preview]);
  const [chan, setChan] = useState<'all' | 'email' | 'form'>('all');
  const [baseF, setBaseF] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [cal, setCal] = useState(sp.get('view') !== 'list');   // default calendar
  const toggleCal = (on: boolean) => {
    setCal(on);
    const u = new URL(window.location.href);
    if (on) u.searchParams.delete('view'); else u.searchParams.set('view', 'list');   // default (calendar) → clean URL
    shallowReplaceUrl(u.toString());
  };

  const setTab = (k: TabKey) => {
    setTabState(k);
    const u = new URL(window.location.href);
    if (k === 'all') u.searchParams.delete('tab'); else u.searchParams.set('tab', k);   // default (all) → clean URL
    shallowReplaceUrl(u.toString());
  };

  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  // Campaign scoping: the whole page below works off `prospects` = the selected campaign's slice
  // (or all). campId null = "Tất cả". campEdit holds the campaign being created (id 0) or edited.
  const [campId, setCampIdState] = useState<number | null>(() => { const c = sp.get('c'); return c && /^\d+$/.test(c) ? Number(c) : null; });
  const setCampId = (id: number | null) => {
    setCampIdState(id);
    const u = new URL(window.location.href);
    if (id == null) u.searchParams.delete('c'); else u.searchParams.set('c', String(id));
    shallowReplaceUrl(u.toString());
  };
  const [campEdit, setCampEdit] = useState<OutreachCampaign | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const prospects = useMemo(() => (campId == null ? allProspects : allProspects.filter((p) => p.campaignId === campId)), [allProspects, campId]);

  const kpi = useMemo(() => {
    const c = (f: (p: OutreachProspect) => boolean) => prospects.filter(f).length;
    const sent = c((p) => !!p.sentAt);
    const embedded = c((p) => p.status === 'embedded');
    return {
      total: prospects.length,
      toSend: c((p) => p.status === 'to_send'),
      sent,
      replied: c((p) => p.status === 'replied' || p.status === 'interested'),
      embedded,
      due: c(dueNow),
      conv: sent ? Math.round((embedded / sent) * 100) : 0,
    };
  }, [prospects]);

  const bases = useMemo(() => Array.from(new Set(prospects.map((p) => p.base).filter(Boolean) as string[])).sort(), [prospects]);
  const chanCounts = useMemo(() => ({
    all: prospects.length,
    email: prospects.filter((p) => p.email).length,
    form: prospects.filter((p) => !p.email).length,
  }), [prospects]);
  const shown = useMemo(() => prospects.filter((p) => {
    if (chan === 'email' && !p.email) return false;
    if (chan === 'form' && p.email) return false;
    if (baseF.length && !baseF.includes(p.base as string)) return false;
    if (q) {
      const t = q.toLowerCase();
      if (![p.agentName, p.base, p.email, p.company].some((v) => (v || '').toLowerCase().includes(t))) return false;
    }
    return true;
  }), [prospects, chan, baseF, q]);

  const dueList = useMemo(
    () => shown.filter(dueNow).sort((a, b) => (a.nextFollowupAt || '').localeCompare(b.nextFollowupAt || '')),
    [shown],
  );

  // "Needs you" = the only things automation can't do: submit web forms + fix bounced/broken contacts.
  const formsToSubmit = useMemo(() => shown.filter((p) => p.status === 'to_send' && !p.email), [shown]);
  const fixes = useMemo(() => shown.filter((p) => p.status === 'bounced' || p.status === 'unreachable'), [shown]);
  const newReplies = useMemo(() => shown.filter((p) => p.status === 'replied'), [shown]); // auto-flagged by reply-watch cron — categorize
  const awaiting = useMemo(() => shown.filter((p) => ACTIVE.has(p.status)), [shown]);
  const needsCount = formsToSubmit.length + fixes.length + newReplies.length;
  const autoNew = useMemo(() => prospects.filter((p) => p.status === 'to_send' && p.email).length, [prospects]);
  const autoDue = useMemo(() => prospects.filter(dueNow).length, [prospects]);

  // Calendar (same filtered set): emails sent land solid on the sent date; due follow-ups
  // land dim on their scheduled date.
  const calItems = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    for (const p of shown) {
      const label = p.agentName || p.company || p.websiteEtld1 || p.website;
      if (p.sentAt) out.push({ id: p.id, date: p.sentAt.slice(0, 10), label, color: '#22c55e', title: `✉ Đã gửi · ${p.agentName}` });
      if (p.nextFollowupAt && !p.repliedAt && ACTIVE.has(p.status)) out.push({ id: `f${p.id}`, date: p.nextFollowupAt.slice(0, 10), label: `↻ ${label}`, dim: true, color: '#ffb03c', title: `Follow-up · ${p.agentName}` });
    }
    return out;
  }, [shown]);

  const groups = useMemo(() => {
    const g = (labels: string[]) => shown.filter((p) => labels.includes(p.status));
    return [
      { key: 'to_send', label: 'To send', items: g(['to_send']) },
      { key: 'sent', label: 'Sent', items: g(['sent']) },
      { key: 'followup', label: 'Following up', items: g(['followup_1', 'followup_2']) },
      { key: 'replied', label: 'Replied / Interested', items: g(['replied', 'interested']) },
      { key: 'embedded', label: 'Embedded ★', items: g(['embedded']) },
      { key: 'dead', label: 'Closed', items: g(['declined', 'bounced', 'no_response', 'unreachable']) },
    ];
  }, [shown]);

  function Actions({ p }: { p: OutreachProspect }) {
    const s = p.status;
    const isForm = !p.email;
    const resp = (c: string, label: string, status: string, title?: string) => (
      <button style={respStyle(c)} disabled={pending} title={title} onClick={() => act(() => setProspectStatus(projectId, p.id, status))}>{label}</button>
    );
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* CHANNEL action — solid pill, channel-colored */}
        <button
          style={chanStyle(isForm ? 'var(--neon-amber)' : 'var(--neon-cyan)')}
          disabled={pending}
          onClick={() => setPreview(p)}
          title={isForm ? 'Open their contact form + the field values to paste' : 'Preview the email, then send or copy'}
        >
          {isForm ? '📝 Form' : '✉ Email'} →
        </button>
        {/* RESPONSE actions — dashed chips */}
        {s === 'to_send' && !isForm && (
          <button style={respStyle('var(--fg-2)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'sent'))} title="Mark sent without auto-sending (e.g. you sent it from Gmail)">📤 Mark sent</button>
        )}
        {ACTIVE.has(s) && (
          <>
            {!isForm && <button style={respStyle('var(--neon-amber)')} disabled={pending} onClick={() => act(() => markFollowupSent(projectId, p.id))} title="Log a follow-up; schedules the next nudge (cap 2)">🔁 Follow-up</button>}
            {resp('var(--neon-violet)', '💬 Replied', 'replied')}
            {resp('var(--neon-lime)', '👍 Interested', 'interested')}
            {!isForm && <button style={respStyle('var(--fg-2)')} disabled={pending} onClick={() => act(() => snoozeProspect(projectId, p.id, 7))} title="Hide from Due for 7 days">💤 Snooze 7d</button>}
            {resp('var(--fg-3)', '✕ Declined', 'declined')}
            {!isForm && resp('var(--bad)', '⚠ Bounced', 'bounced')}
          </>
        )}
        {(s === 'replied' || s === 'interested') && (
          <>
            {resp('var(--neon-lime)', '🎯 Embedded', 'embedded')}
            {resp('var(--fg-3)', '✕ Declined', 'declined')}
          </>
        )}
        {DEAD.has(s) && resp('var(--fg-2)', '↩ Reopen', 'to_send')}
      </div>
    );
  }

  // Automation-first view: surface only what needs a human (forms + fixes), record replies,
  // and collapse the auto-sent bulk into a one-line banner.
  function NeedsYou() {
    const Section = ({ title, hint, color, children }: { title: string; hint: string; color: string; children: React.ReactNode }) => (
      <div style={{ margin: '0 0 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          {title} <span style={{ fontWeight: 400, color: 'var(--fg-3)', textTransform: 'none', letterSpacing: 0 }}>{hint}</span>
        </div>
        {children}
      </div>
    );
    const empty = (txt: string) => <div style={{ border: '1px dashed var(--bg-3)', borderRadius: 8, padding: '14px 16px', color: 'var(--fg-3)', fontSize: 12 }}>{txt}</div>;
    const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 8 };

    return (
      <div>
        {activeCamp && !activeCamp.autoSend ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--neon-amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--neon-amber) 30%, transparent)', margin: '0 0 18px' }}>
            <span style={{ fontSize: 18 }}>✍️</span>
            <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
              <b style={{ color: 'var(--neon-amber)' }}>Gửi tay (chất lượng), không autopilot.</b>{' '}
              Nội dung <b>tự sinh</b> sẵn (Import/AI); anh mở prospect → <b>Open in Gmail</b> review rồi gửi. Ở đây theo dõi đã gửi + <b>follow-up due</b> ({autoDue}). Muốn tự động thì ⚙ Sửa → Gửi: 🤖 Tự động.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--neon-cyan) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--neon-cyan) 30%, transparent)', margin: '0 0 18px' }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
              <b style={{ color: 'var(--neon-cyan)' }}>Sending on autopilot.</b>{' '}
              {autoNew} cold {autoNew === 1 ? 'pitch' : 'pitches'} queued · {autoDue} follow-up{autoDue === 1 ? '' : 's'} due — emails go out automatically Mon–Fri 14:00 UTC. Nothing to click for those.
            </div>
          </div>
        )}

        {newReplies.length > 0 && (
          <Section title="🔔 New replies — categorize" color="var(--neon-violet)" hint="auto-detected from your inbox — a realtor wrote back">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {newReplies.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', border: '1px solid color-mix(in srgb, var(--neon-violet) 45%, var(--bg-3))', borderRadius: 7, background: 'color-mix(in srgb, var(--neon-violet) 7%, var(--bg-1))', flexWrap: 'wrap' }}>
                  <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{p.agentName}</button><ChanDots p={p} touches={touchesByProspect.get(p.id) || []} />
                  <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{p.base || '—'}</span>
                  <span style={{ flex: 1 }} />
                  <button style={chanStyle('var(--neon-lime)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'interested'))}>👍 Interested</button>
                  <button style={respStyle('var(--fg-3)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'declined'))}>✕ Not a fit</button>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="📝 Forms to submit" color="var(--neon-amber)" hint="the bot can't fill web forms — these are on you">
          {formsToSubmit.length === 0 ? empty('No forms waiting. ✓') : (
            <div style={grid}>
              {formsToSubmit.map((p) => (
                <div key={p.id} style={{ border: '1px solid var(--bg-3)', borderRadius: 8, padding: 10, background: 'var(--bg-1)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.agentName}</div>
                  <div style={{ color: 'var(--fg-3)', fontSize: 11, margin: '1px 0 8px' }}>{p.base || '—'}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={chanStyle('var(--neon-amber)')} onClick={() => setPreview(p)}>Open form →</button>
                    <button style={respStyle('var(--neon-lime)')} disabled={pending} onClick={() => act(() => markFormSubmitted(projectId, p.id))}>✓ Submitted</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="⚠ Needs a fix" color="var(--bad)" hint="bounced or broken — fix the contact, then re-queue">
          {fixes.length === 0 ? empty('Nothing bounced. ✓') : (
            <div style={grid}>
              {fixes.map((p) => (
                <div key={p.id} style={{ border: '1px solid var(--bg-3)', borderRadius: 8, padding: 10, background: 'var(--bg-1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{p.agentName}</span><Badge status={p.status} />
                  </div>
                  <div style={{ color: 'var(--fg-3)', fontSize: 11, margin: '1px 0 8px' }}>{p.base || '—'}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={chanStyle('var(--neon-cyan)')} onClick={() => setPreview(p)}>✎ Fix contact</button>
                    <button style={respStyle('var(--fg-2)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'to_send'))}>↩ Re-queue</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="💬 Awaiting reply" color="var(--neon-cyan)" hint="when a realtor replies in Gmail, log it here in one click">
          {awaiting.length === 0 ? empty('No live threads yet.') : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {awaiting.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--bg-3)', borderRadius: 7, background: 'var(--bg-1)', flexWrap: 'wrap' }}>
                  <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{p.agentName}</button><ChanDots p={p} touches={touchesByProspect.get(p.id) || []} />
                  <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{p.base || '—'}</span>
                  <Badge status={p.status} />
                  <span style={{ flex: 1 }} />
                  <button style={respStyle('var(--neon-lime)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'interested'))}>👍 Interested</button>
                  <button style={respStyle('var(--neon-violet)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'replied'))}>💬 Replied</button>
                  <button style={respStyle('var(--fg-3)')} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'declined'))}>✕ Declined</button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    );
  }

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>{children}</th>
  );

  function Table({ rows, dueCol }: { rows: OutreachProspect[]; dueCol?: boolean }) {
    if (rows.length === 0) return <div style={{ border: '1px dashed var(--fg-3)', borderRadius: 8, padding: 24, color: 'var(--fg-2)', fontSize: 13 }}>Nothing here.</div>;
    return (
      <table className="scroll-x" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--fg-2)', borderBottom: '1px solid var(--bg-3)' }}>
            <Th>Agent</Th><Th>Base</Th><Th>Channel</Th><Th>Site</Th><Th>Status</Th>
            <Th>{dueCol ? 'Due' : 'Next'}</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const overdue = dueNow(p);
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-2)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>{p.agentName}</button><ChanDots p={p} touches={touchesByProspect.get(p.id) || []} />
                  {p.company && <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>{p.company}</div>}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{p.base || '—'}</td>
                <td style={{ padding: '6px 8px' }}>
                  <ChannelTag email={p.email} />
                  {p.email && <div style={{ color: 'var(--fg-3)', fontSize: 11, marginTop: 2 }}>{p.email}</div>}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {p.website ? <a href={p.website} {...EXT} style={{ color: 'var(--fg-2)' }}>{(p.websiteEtld1 || p.website).replace(/^https?:\/\//, '')}</a> : '—'}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <Badge status={p.status} />
                  {p.status === 'embedded' && p.embedItemId && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)' }}>{p.embedItemId}</span>}
                </td>
                <td style={{ padding: '6px 8px', color: overdue ? 'var(--bad)' : 'var(--fg-2)', fontWeight: overdue ? 700 : 400, fontSize: 12 }}>
                  {fmtDate(p.nextFollowupAt)}
                </td>
                <td style={{ padding: '6px 8px' }}><Actions p={p} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  const TabBtn = ({ k, label, n }: { k: TabKey; label: string; n?: number }) => (
    <button
      onClick={() => setTab(k)}
      style={{
        ...btn, padding: '4px 12px', fontSize: 12,
        borderColor: tab === k ? 'var(--neon-cyan)' : 'var(--bg-3)',
        color: tab === k ? 'var(--neon-cyan)' : 'var(--fg-2)',
        background: tab === k ? 'color-mix(in srgb, var(--neon-cyan) 12%, transparent)' : 'var(--bg-2)',
      }}
    >
      {label}{n != null ? ` (${n})` : ''}
    </button>
  );

  const Kpi = ({ label, value, color }: { label: string; value: number | string; color?: string }) => (
    <div style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-2)', minWidth: 72 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--fg-0)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );

  const activeCamp = campId != null ? campaigns.find((c) => c.id === campId) : null;
  const doImport = async () => {
    setImportBusy(true); setImportMsg(null);
    const r = await importBacklinkTasks(projectId);
    setImportBusy(false);
    if (r.ok) { setImportMsg(`✓ +${r.created} task mới · ${r.filled} điền nội dung → cron tự gửi`); router.refresh(); }
    else setImportMsg(r.error || 'lỗi');
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>Outreach{activeCamp ? ` · ${activeCamp.name}` : ''}</h1>

      {/* Campaign bar — view / switch / create / manage. Each campaign = an outreach goal with its
          own sender + pacing; the pipeline below scopes to the selected one. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px' }}>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 2 }}>Campaign</span>
        <button onClick={() => setCampId(null)} style={campPill(campId === null)}>Tất cả <span style={{ opacity: .6 }}>{allProspects.length}</span></button>
        {campaigns.map((c) => (
          <button key={c.id} onClick={() => setCampId(c.id)} title={`${c.type} · ${c.stats.sent} đã gửi · ${c.stats.replied} replied · ${c.stats.won} won${c.status !== 'active' ? ' · ' + c.status : ''}`} style={campPill(campId === c.id, c.status)}>
            {CAMP_ICON[c.type] || '📣'} {c.name} <span style={{ opacity: .6 }}>{c.stats.prospects}</span>{c.status === 'paused' ? ' ⏸' : c.status === 'done' ? ' ✓' : ''}
          </button>
        ))}
        <button onClick={() => setCampEdit({ id: 0, projectId, name: '', type: 'embed', status: 'active', goal: null, fromEmail: null, fromName: null, dailyCap: 15, followupGapDays: 3, maxFollowups: 2, autoSend: true, notes: null, stats: { prospects: 0, sent: 0, replied: 0, won: 0 } })} style={{ ...btn, padding: '3px 10px' }}>＋ Campaign</button>
        {activeCamp && <button onClick={() => setCampEdit(activeCamp)} style={{ ...btn, padding: '3px 10px' }} title="Sửa sender / pacing / tạm dừng">⚙ Sửa</button>}
        {activeCamp?.type === 'backlink' && <button onClick={doImport} disabled={importBusy} title="Kéo backlink task (có email) vào campaign + AI tự sinh nội dung → cron tự gửi & follow-up" style={{ ...btn, padding: '3px 10px', color: 'var(--neon-lime)', borderColor: 'var(--neon-lime)', fontWeight: 700 }}>{importBusy ? '⏳ đang import…' : '↻ Import từ Backlinks'}</button>}
        {importMsg && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{importMsg}</span>}
      </div>
      {campEdit && <CampaignForm init={campEdit} projectId={projectId} identities={identities} onClose={() => setCampEdit(null)} onSaved={() => { setCampEdit(null); router.refresh(); }} />}

      {activeCamp && !activeCamp.autoSend ? (
        <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 12px' }}>
          <b>Gửi tay</b> để đảm bảo chất lượng. Nội dung email <b>tự sinh</b> sẵn (bấm <b>↻ Import từ Backlinks</b> để AI viết pitch từng nguồn); anh mở prospect → <b>Open in Gmail</b> review rồi gửi, đánh dấu <b>📤 Mark sent</b>. Follow-up tự lên lịch (Due / Awaiting). Đổi sang tự động bất cứ lúc nào ở ⚙ Sửa.
        </p>
      ) : (
        <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 12px' }}>
          Pitch the free BAH map to base-area realtors. <b style={{ color: 'var(--neon-cyan)' }}>EMAIL</b> prospects + follow-ups <b>auto-send on a daily cron</b> (Mailjet, hello@militarycalc.com);{' '}
          <b style={{ color: 'var(--neon-amber)' }}>FORM</b> ones you submit by hand. <b>Needs you</b> shows only what the bot can&apos;t do; <b>Embedded</b> is auto-detected from GA4.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 14px' }}>
        <Kpi label="Prospects" value={kpi.total} />
        <Kpi label="To send" value={kpi.toSend} />
        <Kpi label="Sent" value={kpi.sent} color="var(--neon-cyan)" />
        <Kpi label="Replied" value={kpi.replied} color="var(--neon-violet)" />
        <Kpi label="Embedded" value={kpi.embedded} color="var(--neon-lime)" />
        <Kpi label="Conv %" value={`${kpi.conv}%`} color="var(--neon-lime)" />
        <Kpi label="Due now" value={kpi.due} color={kpi.due ? 'var(--bad)' : undefined} />
      </div>

      <ListToolbar
        search={q} onSearch={setQ} searchPlaceholder="Search agent / company / email…"
        right={<>
          {(chan !== 'all' || baseF.length || q) && (
            <button onClick={() => { setChan('all'); setBaseF([]); setQ(''); }} style={{ ...btn, padding: '4px 10px' }}>Clear</button>
          )}
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{shown.length}/{prospects.length} shown</span>
        </>}
      >
        <FilterChips value={chan} onChange={setChan} counts={chanCounts}
          options={[{ value: 'all', label: 'All' }, { value: 'email', label: '✉ Email' }, { value: 'form', label: '📝 Form' }]} />
        <MultiSelect label="base" options={bases.map((b) => ({ value: b, label: b }))} selected={baseF} onChange={setBaseF} compact />
      </ListToolbar>

      <div style={{ display: 'flex', gap: 6, margin: '0 0 12px', alignItems: 'center' }}>
        <TabBtn k="needs" label="Needs you" n={needsCount} />
        <TabBtn k="due" label="Due today" n={dueList.length} />
        <TabBtn k="pipeline" label="Pipeline" />
        <TabBtn k="all" label="All" n={shown.length} />
        <ViewToggle style={{ marginLeft: 'auto' }} options={LIST_CALENDAR_VIEWS} value={cal ? 'calendar' : 'list'} onChange={(v) => toggleCal(v === 'calendar')} />
      </div>

      {cal ? (
        <MonthCalendar items={calItems} onItemClick={(id) => { const pid = Number(String(id).replace(/^f/, '')); const p = prospects.find((x) => x.id === pid); if (p) setPreview(p); }} />
      ) : (<>
      {tab === 'needs' && <NeedsYou />}

      {tab === 'due' && (
        <>
          <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: '0 0 8px' }}>Prospects whose follow-up is due. Open one, send the nudge, status advances automatically.</p>
          <Table rows={dueList} dueCol />
        </>
      )}

      {tab === 'all' && <Table rows={shown} />}

      {tab === 'pipeline' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {groups.map((g) => (
            <div key={g.key} style={{ minWidth: 230, flex: '0 0 230px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-2)', margin: '0 0 6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{g.label}</span><span style={{ color: 'var(--fg-3)' }}>{g.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map((p) => (
                  <div key={p.id} style={{ border: '1px solid var(--bg-3)', borderRadius: 8, padding: 8, background: 'var(--bg-1)' }}>
                    <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>{p.agentName}</button><ChanDots p={p} touches={touchesByProspect.get(p.id) || []} />
                    <div style={{ color: 'var(--fg-3)', fontSize: 11, margin: '1px 0 6px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{p.base || '—'}</span>
                      <ChannelTag email={p.email} />
                    </div>
                    <Actions p={p} />
                  </div>
                ))}
                {g.items.length === 0 && <div style={{ color: 'var(--fg-3)', fontSize: 11, padding: '4px 0' }}>—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      </>)}

      {preview && (
        // UNIFIED: same multi-channel drawer as the backlinks page (email + FB/social touches), not a
        // separate email-only drawer. One drawer to maintain; FB etc. checkable here too.
        <TaskOutreachDrawer
          projectId={projectId}
          prospectId={preview.id}
          initialChannel={outreachCh || undefined}
          onChannel={setOutreachCh}
          onClose={() => setPreview(null)}
          onChange={() => router.refresh()}
        />
      )}
    </div>
  );
}

