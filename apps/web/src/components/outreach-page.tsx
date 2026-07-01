'use client';

// Outreach pipeline UI — cold-pitch the BAH map to base-area realtors.
// Two channels, kept distinct: EMAIL prospects auto-send via Mailjet; FORM-only prospects
// (no public email) are submitted by hand through the realtor's contact form. Tabs synced to
// ?tab= so F5 keeps place. 'Embedded' is auto-flipped by the GA4 embed_host cron (Phase 3).
// All external links open with no referrer so the target site never sees the internal tool URL.
import { Suspense, useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { buildEmailForProspect } from '@/lib/outreach-template';
import { setProspectStatus, markFollowupSent, snoozeProspect, markFormSubmitted, updateProspectContact, updateProspectDraft } from '@/lib/actions/outreach-mutations';
import { sendProspectEmail } from '@/lib/actions/outreach-send';
import { MonthCalendar, type CalItem } from '@/components/ui';

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
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

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

export function OutreachPage(props: { projectId: string; prospects: OutreachProspect[] }) {
  return (
    <Suspense fallback={null}>
      <OutreachInner {...props} />
    </Suspense>
  );
}

function OutreachInner({ projectId, prospects }: { projectId: string; prospects: OutreachProspect[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const urlTab = sp.get('tab');
  // Defaults (no URL params): Calendar view + All status.
  const [tab, setTabState] = useState<TabKey>(
    urlTab === 'pipeline' || urlTab === 'due' || urlTab === 'needs' || urlTab === 'all' ? urlTab : 'all',
  );
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<OutreachProspect | null>(null);
  const [chan, setChan] = useState<'all' | 'email' | 'form'>('all');
  const [baseF, setBaseF] = useState('');
  const [q, setQ] = useState('');
  const [cal, setCal] = useState(sp.get('view') !== 'list');   // default calendar
  const toggleCal = (on: boolean) => {
    setCal(on);
    const u = new URL(window.location.href);
    if (on) u.searchParams.delete('view'); else u.searchParams.set('view', 'list');   // default (calendar) → clean URL
    window.history.replaceState(null, '', u.toString());
  };

  const setTab = (k: TabKey) => {
    setTabState(k);
    const u = new URL(window.location.href);
    if (k === 'all') u.searchParams.delete('tab'); else u.searchParams.set('tab', k);   // default (all) → clean URL
    window.history.replaceState(null, '', u.toString());
  };

  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

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
  const shown = useMemo(() => prospects.filter((p) => {
    if (chan === 'email' && !p.email) return false;
    if (chan === 'form' && p.email) return false;
    if (baseF && p.base !== baseF) return false;
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--neon-cyan) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--neon-cyan) 30%, transparent)', margin: '0 0 18px' }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
            <b style={{ color: 'var(--neon-cyan)' }}>Sending on autopilot.</b>{' '}
            {autoNew} cold {autoNew === 1 ? 'pitch' : 'pitches'} queued · {autoDue} follow-up{autoDue === 1 ? '' : 's'} due — emails go out automatically Mon–Fri 14:00 UTC. Nothing to click for those.
          </div>
        </div>

        {newReplies.length > 0 && (
          <Section title="🔔 New replies — categorize" color="var(--neon-violet)" hint="auto-detected from your inbox — a realtor wrote back">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {newReplies.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', border: '1px solid color-mix(in srgb, var(--neon-violet) 45%, var(--bg-3))', borderRadius: 7, background: 'color-mix(in srgb, var(--neon-violet) 7%, var(--bg-1))', flexWrap: 'wrap' }}>
                  <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{p.agentName}</button>
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
                  <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{p.agentName}</button>
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                  <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>{p.agentName}</button>
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

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Outreach · widget embeds</h1>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 12px' }}>
        Pitch the free BAH map to base-area realtors. <b style={{ color: 'var(--neon-cyan)' }}>EMAIL</b> prospects + follow-ups <b>auto-send on a daily cron</b> (Mailjet, hello@militarycalc.com);{' '}
        <b style={{ color: 'var(--neon-amber)' }}>FORM</b> ones you submit by hand. <b>Needs you</b> shows only what the bot can&apos;t do; <b>Embedded</b> is auto-detected from GA4.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 14px' }}>
        <Kpi label="Prospects" value={kpi.total} />
        <Kpi label="To send" value={kpi.toSend} />
        <Kpi label="Sent" value={kpi.sent} color="var(--neon-cyan)" />
        <Kpi label="Replied" value={kpi.replied} color="var(--neon-violet)" />
        <Kpi label="Embedded" value={kpi.embedded} color="var(--neon-lime)" />
        <Kpi label="Conv %" value={`${kpi.conv}%`} color="var(--neon-lime)" />
        <Kpi label="Due now" value={kpi.due} color={kpi.due ? 'var(--bad)' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px' }}>
        <div style={{ display: 'flex', border: '1px solid var(--bg-3)', borderRadius: 7, overflow: 'hidden' }}>
          {([['all', 'All'], ['email', '✉ Email'], ['form', '📝 Form']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setChan(k)} style={{ fontSize: 11, padding: '4px 11px', border: 'none', cursor: 'pointer', background: chan === k ? 'color-mix(in srgb, var(--neon-cyan) 16%, transparent)' : 'var(--bg-2)', color: chan === k ? 'var(--neon-cyan)' : 'var(--fg-2)', fontWeight: chan === k ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <select value={baseF} onChange={(e) => setBaseF(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-2)', color: 'var(--fg-1)' }}>
          <option value="">All bases</option>
          {bases.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agent / company / email…" autoComplete="off" style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-2)', color: 'var(--fg-1)', minWidth: 200 }} />
        {(chan !== 'all' || baseF || q) && <button onClick={() => { setChan('all'); setBaseF(''); setQ(''); }} style={{ ...btn, padding: '4px 10px' }}>Clear</button>}
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{shown.length}/{prospects.length} shown</span>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '0 0 12px', alignItems: 'center' }}>
        <TabBtn k="needs" label="Needs you" n={needsCount} />
        <TabBtn k="due" label="Due today" n={dueList.length} />
        <TabBtn k="pipeline" label="Pipeline" />
        <TabBtn k="all" label="All" n={shown.length} />
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          <button onClick={() => toggleCal(false)} style={{ ...btn, padding: '4px 12px', fontSize: 12, borderColor: !cal ? 'var(--neon-cyan)' : 'var(--bg-3)', color: !cal ? 'var(--neon-cyan)' : 'var(--fg-2)', background: !cal ? 'color-mix(in srgb, var(--neon-cyan) 12%, transparent)' : 'var(--bg-2)' }}>☰ List</button>
          <button onClick={() => toggleCal(true)} style={{ ...btn, padding: '4px 12px', fontSize: 12, borderColor: cal ? 'var(--neon-cyan)' : 'var(--bg-3)', color: cal ? 'var(--neon-cyan)' : 'var(--fg-2)', background: cal ? 'color-mix(in srgb, var(--neon-cyan) 12%, transparent)' : 'var(--bg-2)' }}>📅 Lịch</button>
        </div>
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
                    <button onClick={() => setPreview(p)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-0)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>{p.agentName}</button>
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
        <EmailDrawer
          projectId={projectId}
          prospect={preview}
          pending={pending}
          onClose={() => setPreview(null)}
          onAfterAction={() => { setPreview(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function EmailDrawer({
  projectId, prospect: p, pending, onClose, onAfterAction,
}: {
  projectId: string;
  prospect: OutreachProspect;
  pending: boolean;
  onClose: () => void;
  onAfterAction: () => void;
}) {
  const router = useRouter();
  const isFollowup = ACTIVE.has(p.status);
  const sendable = SENDABLE.has(p.status);

  // Subject + body are editable so you can fix the greeting (e.g. "Hi Moving,") before it sends.
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [didCopy, setDidCopy] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [send, setSend] = useState<'idle' | 'confirm' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const copyLocal = (text: string) => { navigator.clipboard?.writeText(text).then(() => { setDidCopy(true); setTimeout(() => setDidCopy(false), 1500); }).catch(() => {}); };
  const saveDraft = async () => { await updateProspectDraft(projectId, p.id, { subject, body }); setSavedDraft(true); setTimeout(() => setSavedDraft(false), 1500); router.refresh(); };
  const resetTpl = () => { const e = buildEmailForProspect({ agentName: p.agentName, base: p.base, status: p.status, source: p.source }); setSubject(e.subject); setBody(e.body); };
  // Local contact copy so edits ("field reality") flip FORM<->EMAIL live without reopening.
  const [cur, setCur] = useState({ email: p.email ?? '', contactUrl: p.contactUrl ?? '', website: p.website ?? '' });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cur);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  useEffect(() => {
    const c = { email: p.email ?? '', contactUrl: p.contactUrl ?? '', website: p.website ?? '' };
    setCur(c); setDraft(c); setEditing(false); setSaveErr('');
    setSend('idle'); setErr(''); setFormBusy(false); setDidCopy(false); setSavedDraft(false);
    if (p.emailBody) {
      setSubject(p.emailSubject ?? ''); setBody(p.emailBody);   // restore the operator's saved/sent edit
    } else {
      const e = buildEmailForProspect({ agentName: p.agentName, base: p.base, status: p.status, source: p.source });
      setSubject(e.subject); setBody(e.body);
    }
  }, [p.id, p.email, p.contactUrl, p.website, p.agentName, p.base, p.status, p.emailSubject, p.emailBody]);

  const isForm = !cur.email.trim();
  const formLink = (cur.contactUrl || cur.website || '').trim();

  const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 3px' };
  const inputStyle: CSSProperties = { width: '100%', padding: '6px 9px', fontSize: 13, borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-0)', marginBottom: 8 };

  const doSend = async () => {
    setSend('sending');
    const res = await sendProspectEmail(projectId, p.id, { subject, body });
    if (res.ok) { setSend('sent'); setTimeout(onAfterAction, 900); }
    else { setSend('error'); setErr(res.error || 'Send failed'); }
  };
  const doForm = async (kind: 'submitted' | 'unreachable') => {
    setFormBusy(true);
    if (kind === 'submitted') await markFormSubmitted(projectId, p.id);
    else await setProspectStatus(projectId, p.id, 'unreachable');
    onAfterAction();
  };
  const openEdit = () => { setDraft(cur); setSaveErr(''); setEditing(true); };
  const saveEdit = async () => {
    setSaving(true); setSaveErr('');
    const res = await updateProspectContact(projectId, p.id, draft);
    setSaving(false);
    if (res.ok) { setCur(draft); setEditing(false); router.refresh(); }
    else setSaveErr(res.error || 'Save failed');
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', height: '100%', background: 'var(--bg-0)', borderLeft: '1px solid var(--bg-3)', overflowY: 'auto', padding: 18, boxShadow: '-8px 0 24px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{p.agentName}</div>
            <div style={{ color: 'var(--fg-3)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <span>{p.base || '—'}</span><ChannelTag email={cur.email || null} /><Badge status={p.status} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!editing && <button onClick={openEdit} style={{ ...btn, fontSize: 12, padding: '2px 9px' }} title="Fix the email / form link from what you found on their site">✎ Edit contact</button>}
            <button onClick={onClose} style={{ ...btn, fontSize: 14, padding: '2px 9px' }}>✕</button>
          </div>
        </div>

        {editing ? (
          /* ── EDIT CONTACT: correct email / form link / website from field reality ── */
          <div style={{ margin: '16px 0 0' }}>
            <div style={lbl}>Fix contact (from what is actually on their site)</div>
            <div style={lbl}>Email</div>
            <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="leave blank = form-only" autoComplete="off" style={inputStyle} />
            <div style={lbl}>Contact form URL</div>
            <input value={draft.contactUrl} onChange={(e) => setDraft({ ...draft, contactUrl: e.target.value })} placeholder="https://their-site.com/contact" autoComplete="off" style={inputStyle} />
            <div style={lbl}>Website</div>
            <input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://their-site.com" autoComplete="off" style={inputStyle} />
            {saveErr && <div style={{ fontSize: 12, color: 'var(--bad)', margin: '0 0 8px' }}>✗ {saveErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...btn, padding: '7px 14px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
              <button style={{ ...btn, padding: '7px 12px' }} disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
            </div>
            <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>
              Add an <b>email</b> to upgrade a FORM prospect to EMAIL (then you can auto-send). <b>Website</b> is what the GA4 embed-detector matches on — keep it their real homepage.
            </p>
          </div>
        ) : isForm ? (
          /* ── FORM-ONLY: submit by hand through their contact form ── */
          <>
            <div style={{ margin: '16px 0 0' }}>
              <div style={lbl}>Submit via their contact form</div>
              {formLink ? (
                <a href={formLink} {...EXT} style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block', borderColor: 'var(--neon-amber)', color: 'var(--neon-amber)', fontWeight: 700 }}>
                  Open {hostOf(formLink)} form ↗
                </a>
              ) : <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>No contact link on file.</div>}
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
                Opens with no referrer — their site won&apos;t see this tool. Contact forms usually have one message box and no subject, so paste the message below into it.
              </div>
            </div>

            <div style={{ margin: '14px 0 0' }}>
              <div style={lbl}>Form fields — copy each into the matching box on their form</div>
              <CopyField label="Name" value={SENDER.name} />
              <CopyField label="Email" value={SENDER.email} />
              <CopyField label="Phone" value={SENDER.phone} />
              <CopyField label="Subject" value={subject} />
              <div style={{ ...lbl, marginTop: 6 }}>Message <span style={{ color: 'var(--fg-3)' }}>· editable</span></div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={taStyle} />
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
                For radio / dropdown fields (e.g. &quot;I am interested in&quot;), pick <b>Other</b> or the closest option — this is a partnership pitch, not a buy/sell inquiry. Phone is optional, leave blank.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={() => copyLocal(body)}>{didCopy ? '✓ Copied' : 'Copy message'}</button>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={saveDraft} title="Save your edits without sending">{savedDraft ? '✓ Saved' : 'Save draft'}</button>
              <button style={{ ...btn, padding: '7px 12px' }} onClick={resetTpl} title="Regenerate from template (discards edits)">Reset</button>
              {sendable && (
                <>
                  <button style={{ ...btn, padding: '7px 14px', fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={formBusy} onClick={() => doForm('submitted')}>
                    {formBusy ? 'Saving…' : '✓ Submitted the form'}
                  </button>
                  <button style={{ ...btn, padding: '7px 12px', borderColor: 'var(--bad)', color: 'var(--bad)' }} disabled={formBusy} onClick={() => doForm('unreachable')} title="Broken form, not a real form, captcha-blocked, or won't send">
                    Can&apos;t send / form broken
                  </button>
                </>
              )}
            </div>
            <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>
              Open the form, paste the message, hit their submit. Then mark <b>Submitted</b>. If the form is broken, isn&apos;t a real contact form, or is captcha/login-blocked, hit <b>Can&apos;t send</b> — it moves them to <b>Unreachable</b> so they leave your queue (Reopen later from Closed if you find another way in).
            </p>
          </>
        ) : (
          /* ── EMAIL: preview the exact message, then auto-send or send by hand ── */
          <>
            <div style={{ margin: '16px 0 0' }}>
              <div style={lbl}>From</div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>Jake Miller &lt;hello@militarycalc.com&gt;</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Sent via Mailjet · replies land in your inbox</div>
            </div>
            <div style={{ margin: '12px 0 0' }}>
              <div style={lbl}>To</div>
              <div style={{ fontSize: 13, color: 'var(--fg-0)' }}>{cur.email}</div>
            </div>
            <div style={{ margin: '12px 0 0' }}>
              <div style={lbl}>Subject <span style={{ color: 'var(--fg-3)' }}>· editable</span>{isFollowup && <span style={{ color: 'var(--neon-amber)' }}> · follow-up</span>}</div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" style={{ ...inputStyle, fontWeight: 600, marginBottom: 0 }} />
            </div>
            <div style={{ margin: '12px 0 0' }}>
              <div style={lbl}>Body <span style={{ color: 'var(--fg-3)' }}>· editable — fix the greeting/wording before sending</span></div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} style={taStyle} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 0', alignItems: 'center' }}>
              {sendable && send === 'idle' && (
                <button style={{ ...btn, padding: '7px 14px', fontSize: 13, fontWeight: 700, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={pending} onClick={() => setSend('confirm')}>
                  {isFollowup ? 'Send follow-up via MilitaryCalc' : 'Send via MilitaryCalc'}
                </button>
              )}
              {sendable && send === 'confirm' && (
                <>
                  <button style={{ ...btn, padding: '7px 14px', fontSize: 13, fontWeight: 800, background: 'var(--neon-lime)', color: 'var(--bg-0)', borderColor: 'var(--neon-lime)' }} onClick={doSend}>Confirm: email {cur.email} now</button>
                  <button style={{ ...btn, padding: '7px 12px' }} onClick={() => setSend('idle')}>Cancel</button>
                </>
              )}
              {send === 'sending' && <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Sending…</span>}
              {send === 'sent' && <span style={{ fontSize: 13, color: 'var(--neon-lime)', fontWeight: 700 }}>✓ Sent</span>}
              {send === 'error' && <span style={{ fontSize: 12, color: 'var(--bad)' }}>✗ {err}</span>}

              {send !== 'sending' && send !== 'sent' && (
                <>
                  <button style={{ ...btn, padding: '7px 12px' }} onClick={() => copyLocal(`Subject: ${subject}\n\n${body}`)}>{didCopy ? '✓ Copied' : 'Copy email'}</button>
                  <a href={gmailUrl(cur.email, subject, body)} {...EXT} style={{ ...btn, padding: '7px 12px', textDecoration: 'none', display: 'inline-block' }}>Open in Gmail ↗</a>
                  <button style={{ ...btn, padding: '7px 12px' }} onClick={saveDraft} title="Save your edits without sending">{savedDraft ? '✓ Saved' : 'Save draft'}</button>
                  <button style={{ ...btn, padding: '7px 12px' }} onClick={resetTpl} title="Regenerate from template (discards edits)">Reset</button>
                </>
              )}
            </div>
            <p style={{ color: 'var(--fg-3)', fontSize: 11, margin: '12px 0 0' }}>
              Send via MilitaryCalc goes out through Mailjet from hello@militarycalc.com (replies come to your inbox) and advances the pipeline. Or open it prefilled in Gmail to send by hand.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
