'use client';

import { useEffect, useState, useCallback } from 'react';

interface Auth { spf: boolean; spfMailbaby: boolean; dkim: boolean; dmarc: string | null }
interface Pm { date: string; domainReputation: string | null; spamRatio: number | null; dkimRatio: number | null; spfRatio: number | null; dmarcRatio: number | null }
interface Row { domain: string; auth: Auth; postmaster: Pm | null }
interface Data { rows: Row[]; postmasterConfigured: boolean }

// Postmaster domain-reputation → colour. HIGH/MEDIUM good, LOW/BAD warn.
const repColor: Record<string, string> = { HIGH: '#5ac47e', MEDIUM: '#37d4c2', LOW: '#e0a94a', BAD: '#d16b6b' };
const repLabel = (r: string | null) => (r ? r.replace('REPUTATION_', '').replace('_', ' ') : '—');
const pct = (n: number | null) => (n == null ? '—' : (n * 100).toFixed(n < 0.01 ? 2 : 0) + '%');

function Badge({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const c = ok ? '#5ac47e' : warn ? '#e0a94a' : '#d16b6b';
  return (
    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: c, border: `1px solid ${c}`, borderRadius: 5, padding: '1px 6px' }}>
      {ok ? '✓' : '✗'} {label}
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
    <div style={{ margin: '0 16px 14px', padding: '11px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>✉️ Email deliverability</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!d.postmasterConfigured && (
            <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Postmaster chưa nối — chỉ hiện auth</span>
          )}
          <a
            href="https://postmaster.google.com/managedomains"
            target="_blank"
            rel="noopener noreferrer"
            title="Add / manage sending domains in Google Postmaster Tools (domain add is web-only, no API)"
            style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', textDecoration: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 7px' }}
          >
            Manage in Postmaster ↗
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.rows.map((row) => (
          <div key={row.domain} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)', minWidth: 140 }}>{row.domain}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge ok={row.auth.spf} label="SPF" />
              <Badge ok={row.auth.dkim} label="DKIM" />
              <Badge ok={!!row.auth.dmarc} label={`DMARC${row.auth.dmarc ? ' ' + row.auth.dmarc.replace('p=', '') : ''}`} />
            </div>
            {d.postmasterConfigured && row.postmaster && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--fg-3)' }}>rep </span>
                  <b style={{ color: repColor[row.postmaster.domainReputation || ''] || 'var(--fg-2)' }}>{repLabel(row.postmaster.domainReputation)}</b>
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
                  <span style={{ color: 'var(--fg-3)' }}>spam </span>{pct(row.postmaster.spamRatio)}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  dkim {pct(row.postmaster.dkimRatio)} · spf {pct(row.postmaster.spfRatio)} · dmarc {pct(row.postmaster.dmarcRatio)}
                </span>
              </div>
            )}
            {d.postmasterConfigured && !row.postmaster && (
              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>chưa có data (cần volume gửi)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
