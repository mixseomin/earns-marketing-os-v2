'use client';

// Outreach pipeline UI — cold-email-the-realtors tracker for the widget-embed pitch.
// Tabs: Due today (chase queue) | Pipeline (grouped) | All. One-click status advance via
// server actions; "Copy email" drops a personalized pitch to clipboard for manual Gmail send.
// 'Embedded' is the hero — auto-flipped by the GA4 embed_host conversion cron (Phase 3).
import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { OutreachProspect } from '@/lib/actions/outreach';
import { buildOutreachEmail } from '@/lib/outreach-template';
import { setProspectStatus, markFollowupSent, snoozeProspect } from '@/lib/actions/outreach-mutations';

type TabKey = 'due' | 'pipeline' | 'all';

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
  no_response: { label: 'No response', color: 'var(--fg-3)' },
};
const meta = (s: string) => STATUS_META[s] || { label: s, color: 'var(--fg-2)' };

const ACTIVE = new Set(['sent', 'followup_1', 'followup_2']);
const DEAD = new Set(['declined', 'bounced', 'no_response']);

function dueNow(p: OutreachProspect): boolean {
  if (!ACTIVE.has(p.status) || !p.nextFollowupAt) return false;
  const now = Date.now();
  if (new Date(p.nextFollowupAt).getTime() > now) return false;
  if (p.snoozeUntil && new Date(p.snoozeUntil).getTime() > now) return false;
  return true;
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');

const btn: CSSProperties = {
  fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line, var(--bg-3))',
  background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap',
};

function Badge({ status }: { status: string }) {
  const m = meta(status);
  return (
    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: `color-mix(in srgb, ${m.color} 18%, transparent)`, color: m.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

export function OutreachPage({ projectId, prospects }: { projectId: string; prospects: OutreachProspect[] }) {
  const [tab, setTab] = useState<TabKey>('due');
  const [pending, start] = useTransition();
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const act = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  const copy = async (p: OutreachProspect) => {
    const { subject, body } = buildOutreachEmail(p);
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 1600);
    } catch { /* clipboard blocked */ }
  };

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

  const dueList = useMemo(
    () => prospects.filter(dueNow).sort((a, b) => (a.nextFollowupAt || '').localeCompare(b.nextFollowupAt || '')),
    [prospects],
  );

  const groups = useMemo(() => {
    const g = (labels: string[]) => prospects.filter((p) => labels.includes(p.status));
    return [
      { key: 'to_send', label: 'To send', items: g(['to_send']) },
      { key: 'sent', label: 'Sent', items: g(['sent']) },
      { key: 'followup', label: 'Following up', items: g(['followup_1', 'followup_2']) },
      { key: 'replied', label: 'Replied / Interested', items: g(['replied', 'interested']) },
      { key: 'embedded', label: 'Embedded ★', items: g(['embedded']) },
      { key: 'dead', label: 'Closed', items: g(['declined', 'bounced', 'no_response']) },
    ];
  }, [prospects]);

  function Contact({ p }: { p: OutreachProspect }) {
    if (p.email) return <a href={`mailto:${p.email}`} style={{ color: 'var(--fg-1)' }}>{p.email}</a>;
    if (p.contactUrl) return <a href={p.contactUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-2)' }}>contact form ↗</a>;
    return <span style={{ color: 'var(--fg-3)' }}>—</span>;
  }

  function Actions({ p }: { p: OutreachProspect }) {
    const s = p.status;
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button style={btn} disabled={pending} onClick={() => copy(p)} title="Copy a personalized pitch email to clipboard">
          {copiedId === p.id ? '✓ Copied' : 'Copy email'}
        </button>
        {s === 'to_send' && (
          <button style={{ ...btn, borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'sent'))}>Mark sent</button>
        )}
        {ACTIVE.has(s) && (
          <>
            <button style={btn} disabled={pending} onClick={() => act(() => markFollowupSent(projectId, p.id))} title="Log a follow-up; schedules the next nudge (cap 2)">Follow-up sent</button>
            <button style={{ ...btn, borderColor: 'var(--neon-violet)', color: 'var(--neon-violet)' }} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'replied'))}>Replied</button>
            <button style={{ ...btn, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'interested'))}>Interested</button>
            <button style={btn} disabled={pending} onClick={() => act(() => snoozeProspect(projectId, p.id, 7))} title="Hide from Due for 7 days">Snooze 7d</button>
            <button style={btn} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'declined'))}>Declined</button>
            <button style={btn} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'bounced'))}>Bounced</button>
          </>
        )}
        {(s === 'replied' || s === 'interested') && (
          <>
            <button style={{ ...btn, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'embedded'))}>Mark embedded</button>
            <button style={btn} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'declined'))}>Declined</button>
          </>
        )}
        {DEAD.has(s) && (
          <button style={btn} disabled={pending} onClick={() => act(() => setProspectStatus(projectId, p.id, 'to_send'))}>Reopen</button>
        )}
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
            <Th>Agent</Th><Th>Base</Th><Th>Contact</Th><Th>Site</Th><Th>Status</Th>
            <Th>{dueCol ? 'Due' : 'Next'}</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const overdue = dueNow(p);
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-2)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ fontWeight: 700 }}>{p.agentName}</div>
                  {p.company && <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>{p.company}</div>}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{p.base || '—'}</td>
                <td style={{ padding: '6px 8px', fontSize: 12 }}><Contact p={p} /></td>
                <td style={{ padding: '6px 8px' }}>
                  {p.website ? <a href={p.website} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-2)' }}>{(p.websiteEtld1 || p.website).replace(/^https?:\/\//, '')}</a> : '—'}
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
        Pitch the free BAH map to base-area realtors. Send manually from <b>hello@militarycalc.com</b>, advance status here.{' '}
        <b>Embedded</b> is auto-detected from GA4 (who actually loaded the widget).
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

      <div style={{ display: 'flex', gap: 6, margin: '0 0 12px' }}>
        <TabBtn k="due" label="Due today" n={dueList.length} />
        <TabBtn k="pipeline" label="Pipeline" />
        <TabBtn k="all" label="All" n={prospects.length} />
      </div>

      {tab === 'due' && (
        <>
          <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: '0 0 8px' }}>Prospects whose follow-up is due. Copy the email, send it, then click <b>Follow-up sent</b>.</p>
          <Table rows={dueList} dueCol />
        </>
      )}

      {tab === 'all' && <Table rows={prospects} />}

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
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{p.agentName}</div>
                    <div style={{ color: 'var(--fg-3)', fontSize: 11, margin: '1px 0 6px' }}>{p.base || '—'}</div>
                    <Actions p={p} />
                  </div>
                ))}
                {g.items.length === 0 && <div style={{ color: 'var(--fg-3)', fontSize: 11, padding: '4px 0' }}>—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
