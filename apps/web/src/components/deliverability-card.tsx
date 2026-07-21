'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';

interface Auth { spf: boolean; dkim: boolean; dmarc: string | null }
interface PmPoint { date: string; reputation: string | null; spam: number | null; dkim: number | null; spf: number | null; dmarc: number | null }
interface Issue { rule: string; pts: number }
interface SpamPoint { date: string; score?: number; dkimAligned?: boolean; spfPass?: boolean; listUnsub?: boolean; blacklisted?: boolean; issues?: Issue[]; error?: string }
interface Row { domain: string; auth: Auth; postmaster: PmPoint[] | null; spamTest: SpamPoint[] | null }
interface Data { rows: Row[]; postmasterConfigured: boolean }

const repColor: Record<string, string> = { HIGH: '#5ac47e', MEDIUM: '#37d4c2', LOW: '#e0a94a', BAD: '#d16b6b' };
const repShort = (r: string | null) => (r ? r.replace('REPUTATION_', '').replace('_', ' ') : '—');
const pct = (n: number | null | undefined) => (n == null ? '—' : (n * 100).toFixed(n && n < 0.01 ? 2 : 0) + '%');
const scoreColor = (s?: number) => (s == null ? 'var(--fg-3)' : s >= 8 ? '#5ac47e' : s >= 6 ? '#e0a94a' : '#d16b6b');

const th: CSSProperties = { textAlign: 'left', padding: '6px 10px', color: 'var(--fg-3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--line)', fontSize: 12, verticalAlign: 'top' };
const mono: CSSProperties = { fontFamily: 'var(--font-mono)' };

function Tick({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const c = ok ? '#5ac47e' : warn ? '#e0a94a' : '#d16b6b';
  return <span style={{ ...mono, fontSize: 10, color: c, marginRight: 6 }}>{ok ? '✓' : '✗'}{label}</span>;
}

// Tiny bar sparkline of mail-tester scores (0-10) — the warm-up/health trend.
function Spark({ pts }: { pts: number[] }) {
  if (!pts.length) return <span style={{ color: 'var(--fg-3)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1, height: 16 }}>
      {pts.map((s, i) => (
        <span key={i} title={`${s}/10`} style={{ width: 4, height: Math.max(2, (s / 10) * 16), background: scoreColor(s), borderRadius: 1, display: 'inline-block' }} />
      ))}
    </span>
  );
}

export function DeliverabilityCard() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/deliverability', { cache: 'no-store' });
      if (!r.ok) { setErr(true); return; }
      setD(await r.json()); setErr(false);
    } catch { setErr(true); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 300_000); return () => clearInterval(t); }, [load]);

  if (err || !d) return null;

  return (
    <div style={{ margin: '0 16px 14px', padding: '11px 14px 6px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>✉️ Email deliverability</span>
        <a href="https://postmaster.google.com/managedomains" target="_blank" rel="noopener noreferrer"
          title="Add / manage sending domains in Google Postmaster Tools (domain add is web-only, no API)"
          style={{ ...mono, fontSize: 10, color: 'var(--fg-2)', textDecoration: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 7px' }}>
          Manage in Postmaster ↗
        </a>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Domain</th>
              <th style={th}>Auth</th>
              <th style={th}>Postmaster rep</th>
              <th style={th}>Spam rate</th>
              <th style={th}>Spam-test</th>
              <th style={th}>Trend</th>
              <th style={{ ...th, width: '30%' }}>Top drags (to fix)</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row) => {
              const pm = row.postmaster && row.postmaster.length ? row.postmaster[row.postmaster.length - 1] : null;
              const st = row.spamTest && row.spamTest.length ? row.spamTest[row.spamTest.length - 1] : null;
              const scores = (row.spamTest || []).map((p) => p.score).filter((s): s is number => s != null);
              return (
                <tr key={row.domain}>
                  <td style={{ ...td, fontWeight: 700, color: 'var(--fg-0)', whiteSpace: 'nowrap' }}>{row.domain}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <Tick ok={row.auth.spf} label="SPF" />
                    <Tick ok={row.auth.dkim} label="DKIM" />
                    <Tick ok={!!row.auth.dmarc} label={`DMARC${row.auth.dmarc ? ':' + row.auth.dmarc : ''}`} warn={row.auth.dmarc === 'none'} />
                  </td>
                  <td style={{ ...td, ...mono }}>
                    {!d.postmasterConfigured ? <span style={{ color: 'var(--fg-3)' }}>off</span>
                      : pm ? <b style={{ color: repColor[pm.reputation || ''] || 'var(--fg-2)' }}>{repShort(pm.reputation)}</b>
                        : <span style={{ color: 'var(--fg-3)' }} title="registered, awaiting volume">no data</span>}
                  </td>
                  <td style={{ ...td, ...mono, color: pm && pm.spam && pm.spam > 0.003 ? '#d16b6b' : 'var(--fg-2)' }}>{pm ? pct(pm.spam) : '—'}</td>
                  <td style={{ ...td, ...mono }}>
                    {st?.score != null ? <b style={{ color: scoreColor(st.score) }}>{st.score.toFixed(1)}<span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>/10</span></b> : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                    {st?.date && <div style={{ color: 'var(--fg-3)', fontSize: 9.5 }}>{st.date}</div>}
                  </td>
                  <td style={td}><Spark pts={scores.slice(-10)} /></td>
                  <td style={td}>
                    {st?.blacklisted && <span style={{ ...mono, fontSize: 10, color: '#d16b6b' }}>⚠ blacklisted </span>}
                    {st?.issues?.length
                      ? st.issues.map((is) => (
                        <span key={is.rule} title={`+${is.pts} spam points`} style={{ ...mono, fontSize: 10, color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', marginRight: 4, display: 'inline-block' }}>
                          {is.rule} <span style={{ color: '#e0a94a' }}>+{is.pts}</span>
                        </span>))
                      : st ? <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>none</span> : <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
