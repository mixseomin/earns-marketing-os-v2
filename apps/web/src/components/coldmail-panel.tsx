'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';

interface ListRow { id: number; name: string; type: string; optin: string; total: number; confirmed: number; unconfirmed: number; unsubscribed: number; }
interface CampRow { id: number; name: string; status: string; sent: number; toSend: number; views: number; clicks: number; bounces: number; startedAt: string | null; }
interface Counts {
  subscribers: { total: number; blocklisted: number; orphans: number };
  lists: { total: number };
  campaigns: { total: number; by_status?: Record<string, number> };
  messages: number;
}
interface Stats { counts: Counts; lists: ListRow[]; campaigns: CampRow[]; consoleUrl: string; }

const muted = 'var(--fg-2, #7c879b)';
const accent = 'var(--accent, #37d4c2)';
const POLL_MS = 30_000;
const intf = (n: number) => (Number(n) || 0).toLocaleString('en-US');

const card: CSSProperties = { background: 'var(--bg-2, #101d2e)', border: '1px solid var(--border, #1d2c42)', borderRadius: 10, padding: 14 };
const th: CSSProperties = { textAlign: 'left', padding: '7px 10px', color: muted, fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border,#1d2c42)' };
const td: CSSProperties = { textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--border,#18283d)', fontVariantNumeric: 'tabular-nums' };

function Card({ k, v, s }: { k: string; v: string; s?: string }) {
  return <div style={card}><div style={{ color: muted, fontSize: 12 }}>{k}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 3 }}>{v}</div>{s && <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>{s}</div>}</div>;
}
function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
    <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border,#1d2c42)' }}>
      <span style={{ color: muted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{title}</span>{right}
    </div>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table></div>
  </div>;
}
function Pill({ s }: { s: string }) {
  const map: Record<string, string> = { running: accent, finished: '#5ac47e', draft: muted, scheduled: '#e0a94a', paused: '#e0a94a', cancelled: '#d16b6b' };
  const c = map[s] || muted;
  return <span style={{ color: c, border: `1px solid ${c}`, borderRadius: 5, padding: '1px 7px', fontSize: 11, textTransform: 'capitalize' }}>{s}</span>;
}

export function ColdmailPanel() {
  const [d, setD] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/coldmail/stats', { cache: 'no-store' });
      if (!r.ok) { setErr(r.status === 503 ? 'not configured' : 'unavailable'); return; }
      setD(await r.json()); setErr(null);
    } catch { setErr('unavailable'); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const openBtn = (url: string) => (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ background: accent, color: '#08131f', fontWeight: 700, fontSize: 13, textDecoration: 'none', padding: '7px 14px', borderRadius: 8 }}>
      Open MailWizz ↗
    </a>
  );

  const header = (url = 'https://mail.on.tc/customer') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 14px' }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Email OS — owned audiences</div>
        <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>Warm lane: MailWizz lists + broadcasts, SES backend. Deep work happens in MailWizz; this is the glance.</div>
      </div>
      {openBtn(url)}
    </div>
  );

  if (err) return <div style={{ margin: '16px 0' }}>{header()}<div style={{ ...card, color: muted }}>MailWizz metrics: {err}.</div></div>;
  if (!d) return <div style={{ margin: '16px 0' }}>{header()}<div style={{ ...card, color: muted }}>Loading Email OS…</div></div>;

  const c = d.counts;
  const confirmed = d.lists.reduce((a, l) => a + l.confirmed, 0);
  const unsub = d.lists.reduce((a, l) => a + l.unsubscribed, 0);

  return (
    <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {header(d.consoleUrl)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <Card k="Subscribers" v={intf(c.subscribers.total)} s={`${intf(c.subscribers.blocklisted)} blocklisted`} />
        <Card k="Confirmed" v={intf(confirmed)} s="sendable" />
        <Card k="Unsubscribed" v={intf(unsub)} />
        <Card k="Lists" v={intf(c.lists.total)} />
        <Card k="Campaigns" v={intf(c.campaigns.total)} s={c.campaigns.by_status ? Object.entries(c.campaigns.by_status).map(([k, v]) => `${v} ${k}`).join(', ') : undefined} />
        <Card k="Messages sent" v={intf(c.messages)} />
      </div>

      <Panel title="Lists">
        <thead><tr><th style={th}>List</th><th style={th}>Type</th><th style={{ ...th, textAlign: 'right' }}>Confirmed</th><th style={{ ...th, textAlign: 'right' }}>Unsub</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
        <tbody>
          {d.lists.map((l) => (
            <tr key={l.id}>
              <td style={td}>{l.name}</td>
              <td style={{ ...td, color: muted }}>{l.type} · {l.optin}</td>
              <td style={{ ...td, textAlign: 'right' }}>{intf(l.confirmed)}</td>
              <td style={{ ...td, textAlign: 'right', color: unsub ? '#d16b6b' : muted }}>{intf(l.unsubscribed)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{intf(l.total)}</td>
            </tr>
          ))}
          {!d.lists.length && <tr><td style={{ ...td, color: muted }} colSpan={5}>No lists yet.</td></tr>}
        </tbody>
      </Panel>

      <Panel title="Recent campaigns">
        <thead><tr><th style={th}>Campaign</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Sent</th><th style={{ ...th, textAlign: 'right' }}>Views</th><th style={{ ...th, textAlign: 'right' }}>Clicks</th></tr></thead>
        <tbody>
          {d.campaigns.map((cp) => (
            <tr key={cp.id}>
              <td style={td}>{cp.name}</td>
              <td style={td}><Pill s={cp.status} /></td>
              <td style={{ ...td, textAlign: 'right' }}>{intf(cp.sent)}{cp.toSend ? <span style={{ color: muted }}> / {intf(cp.toSend)}</span> : null}</td>
              <td style={{ ...td, textAlign: 'right' }}>{intf(cp.views)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{intf(cp.clicks)}</td>
            </tr>
          ))}
          {!d.campaigns.length && <tr><td style={{ ...td, color: muted }} colSpan={5}>No campaigns yet — compose one in MailWizz.</td></tr>}
        </tbody>
      </Panel>

      <div style={{ ...card, color: muted, fontSize: 12 }}>
        Transactional lane (sign-in links, welcome) sends via <b style={{ color: 'var(--fg,#c9d4e3)' }}>Amazon SES</b> directly from each site — infra, not managed here. Broadcasts to these lists send from MailWizz via SES delivery server.
      </div>
    </div>
  );
}
