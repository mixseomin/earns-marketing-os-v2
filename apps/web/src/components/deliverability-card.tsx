'use client';

import { useEffect, useState, useCallback, Fragment, type CSSProperties } from 'react';

interface Auth { spf: boolean; dkim: boolean; dmarc: string | null }
interface PmPoint { date: string; reputation: string | null; spam: number | null; dkim: number | null; spf: number | null; dmarc: number | null }
interface Issue { rule: string; pts: number }
interface SpamPoint { date: string; score?: number; dkimAligned?: boolean; spfPass?: boolean; listUnsub?: boolean; blacklisted?: boolean; issues?: Issue[]; error?: string }
interface Row { domain: string; send?: boolean; warmupStart?: string | null; auth: Auth; postmaster: PmPoint[] | null; spamTest: SpamPoint[] | null }
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

// Standard warm-up ramp: daily send caps for a brand-new sending domain (opt-in list).
// After the last step → steady/full volume. See reference_mailwizz.md.
const RAMP = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const DAY_MS = 86_400_000;
const isoUTC = (d: Date) => d.toISOString().slice(0, 10);
const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const capLabel = (n: number) => (n >= 1000 ? n / 1000 + 'k' : String(n));

// A calendar strip for one sending domain: one cell per warm-up day (D1..D8 + steady),
// each showing that day's target volume + the real reputation/mail-tester result on that date.
function WarmupCalendar({ row, onChange }: { row: Row; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const set = useCallback(async (action: 'start' | 'stop') => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/deliverability/warmup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: row.domain, action }) });
      onChange();
    } finally { setBusy(false); }
  }, [busy, row.domain, onChange]);

  const btn: CSSProperties = { ...mono, fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--accent,#37d4c2)', cursor: busy ? 'default' : 'pointer' };

  if (!row.warmupStart) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
        <span style={{ ...mono, fontSize: 11, color: 'var(--fg-1)', fontWeight: 700 }}>{row.domain}</span>
        <button onClick={() => set('start')} disabled={busy} title="Stamp today as day 1 of the warm-up ramp">🔥 Start warm-up</button>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>ramp 50 → full over {RAMP.length} days</span>
      </div>
    );
  }

  const repByDate = new Map((row.postmaster || []).map((p) => [p.date, p.reputation] as const));
  const scoreByDate = new Map((row.spamTest || []).filter((p) => p.score != null).map((p) => [p.date, p.score] as const));
  const startD = new Date(row.warmupStart + 'T00:00:00Z');
  const todayD = new Date(isoUTC(new Date()) + 'T00:00:00Z');
  const dayIdx = Math.floor((todayD.getTime() - startD.getTime()) / DAY_MS); // 0-based
  const done = dayIdx >= RAMP.length;

  return (
    <div style={{ padding: '3px 0 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 11, color: 'var(--fg-0)', fontWeight: 700 }}>{row.domain}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>
          {done ? <b style={{ color: '#5ac47e' }}>full volume ✓</b> : <>Day {Math.max(dayIdx + 1, 1)} of {RAMP.length} · today’s cap <b style={{ ...mono, color: 'var(--fg-1)' }}>{capLabel(RAMP[Math.min(Math.max(dayIdx, 0), RAMP.length - 1)] ?? RAMP[0]!)}</b></>}
        </span>
        <button onClick={() => set('stop')} disabled={busy} style={btn} title="Reset — clears the start date">reset</button>
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {RAMP.map((cap, i) => {
          const dt = new Date(startD.getTime() + i * DAY_MS);
          const key = isoUTC(dt);
          const isToday = i === dayIdx;
          const past = i < dayIdx;
          const rep = repByDate.get(key) || null;
          const score = scoreByDate.get(key);
          const dot = rep ? repColor[rep] || null : null;
          return (
            <div key={i}
              title={`${key} · target ${cap.toLocaleString()}${rep ? ' · rep ' + repShort(rep) : ''}${score != null ? ' · mail-tester ' + score + '/10' : ''}`}
              style={{ width: 58, padding: '4px 4px', borderRadius: 6, textAlign: 'center', border: isToday ? '1.5px solid var(--accent,#37d4c2)' : '1px solid var(--line)', background: past ? 'var(--bg-1)' : 'transparent', opacity: i > dayIdx ? 0.5 : 1 }}>
              <div style={{ fontSize: 9, color: isToday ? 'var(--accent,#37d4c2)' : 'var(--fg-3)', fontWeight: isToday ? 700 : 400 }}>D{i + 1}</div>
              <div style={{ ...mono, fontSize: 11, color: 'var(--fg-1)', fontWeight: 700 }}>{capLabel(cap)}</div>
              <div style={{ fontSize: 8.5, color: 'var(--fg-3)' }}>{fmtDay(dt)}</div>
              <div style={{ height: 8, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                {dot && <span title={`rep ${repShort(rep)}`} style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block' }} />}
                {score != null && <span style={{ ...mono, fontSize: 8, color: scoreColor(score) }}>{score}</span>}
                {past && !dot && score == null && <span style={{ fontSize: 8, color: 'var(--fg-3)' }}>·</span>}
              </div>
            </div>
          );
        })}
        <div style={{ width: 58, padding: '4px 4px', borderRadius: 6, textAlign: 'center', border: done ? '1.5px solid #5ac47e' : '1px dashed var(--line)', opacity: done ? 1 : 0.5 }}>
          <div style={{ fontSize: 9, color: 'var(--fg-3)' }}>D{RAMP.length + 1}+</div>
          <div style={{ ...mono, fontSize: 11, color: 'var(--fg-1)', fontWeight: 700 }}>full</div>
          <div style={{ fontSize: 8.5, color: 'var(--fg-3)' }}>steady</div>
          <div style={{ height: 8 }} />
        </div>
      </div>
    </div>
  );
}

export function DeliverabilityCard() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [view, setView] = useState<'table' | 'warmup'>('table');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/deliverability', { cache: 'no-store' });
      if (!r.ok) { setErr(true); return; }
      setD(await r.json()); setErr(false);
    } catch { setErr(true); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 300_000); return () => clearInterval(t); }, [load]);

  const [testing, setTesting] = useState<string | null>(null);
  const runTest = useCallback(async (domain: string) => {
    if (testing) return;
    setTesting(domain);
    try {
      const r = await fetch('/api/deliverability/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }) });
      if (!r.ok) { setTesting(null); return; }
      setTimeout(() => { load(); setTesting((t) => (t === domain ? null : t)); }, 98_000);
    } catch { setTesting(null); }
  }, [testing, load]);

  const addDomain = useCallback(async () => {
    const dom = newDomain.trim().toLowerCase();
    if (!dom || adding) return;
    setAdding(true); setAddMsg('registering…');
    try {
      const r = await fetch('/api/deliverability/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: dom }) });
      const j = await r.json();
      if (!r.ok) { setAddMsg(j.error || 'failed'); }
      else { setAddMsg(`${dom}: ${j.state}`); setNewDomain(''); load(); }
    } catch { setAddMsg('network error'); }
    finally { setAdding(false); }
  }, [newDomain, adding, load]);

  if (err || !d) return null;

  return (
    <div style={{ margin: '0 16px 14px', padding: '11px 14px 6px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>✉️ Email deliverability</span>
          <div style={{ display: 'inline-flex', gap: 2, background: 'var(--bg-1)', borderRadius: 6, padding: 2 }}>
            {(['table', 'warmup'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: view === v ? 'var(--bg-2)' : 'transparent', color: view === v ? 'var(--fg-0)' : 'var(--fg-3)', fontWeight: view === v ? 700 : 400 }}>
                {v === 'table' ? 'Table' : '🔥 Warm-up'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {addMsg && <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{addMsg}</span>}
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addDomain(); }}
            placeholder="add domain / subdomain…"
            spellCheck={false} autoComplete="off"
            style={{ ...mono, fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', width: 180 }}
          />
          <button onClick={addDomain} disabled={adding || !newDomain.trim()}
            title="Register + verify this domain in Postmaster (v2 API) and track it here"
            style={{ ...mono, fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: adding ? 'var(--fg-3)' : 'var(--accent, #37d4c2)', cursor: adding ? 'default' : 'pointer' }}>
            {adding ? '…' : '+ Register'}
          </button>
          <a href="https://postmaster.google.com/managedomains" target="_blank" rel="noopener noreferrer"
            title="Open Google Postmaster Tools"
            style={{ ...mono, fontSize: 10, color: 'var(--fg-2)', textDecoration: 'none' }}>Postmaster ↗</a>
        </div>
      </div>
      {view === 'warmup' ? (
        <div style={{ paddingTop: 2 }}>
          {d.rows.filter((r) => r.send).length === 0
            ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>No sending domains yet — set up a send path first.</span>
            : d.rows.filter((r) => r.send).map((r) => <WarmupCalendar key={r.domain} row={r} onChange={load} />)}
          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4, lineHeight: 1.5 }}>
            Ramp the daily send cap in MailWizz to each day’s target; send to most-engaged first. Dot = Postmaster reputation that day, number = mail-tester score. Green → step up, red → hold a day.
          </div>
        </div>
      ) : (
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
            {Object.entries(
              d.rows.reduce<Record<string, Row[]>>((acc, r) => {
                const root = r.domain.split('.').slice(-2).join('.');
                (acc[root] ||= []).push(r);
                return acc;
              }, {}),
            ).sort(([a], [b]) => a.localeCompare(b)).map(([root, rows]) => (
              <Fragment key={root}>
                <tr>
                  <td colSpan={7} style={{ padding: '5px 10px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', ...mono, fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>{root}</td>
                </tr>
                {rows.slice().sort((a, b) => a.domain.length - b.domain.length).map((row) => {
              const pm = row.postmaster && row.postmaster.length ? row.postmaster[row.postmaster.length - 1] : null;
              const st = row.spamTest && row.spamTest.length ? row.spamTest[row.spamTest.length - 1] : null;
              const scores = (row.spamTest || []).map((p) => p.score).filter((s): s is number => s != null);
              const label = row.domain === root ? '@ root' : row.domain.slice(0, row.domain.length - root.length - 1);
              return (
                <tr key={row.domain}>
                  <td style={{ ...td, whiteSpace: 'nowrap', paddingLeft: 22 }}>
                    <span style={{ fontWeight: 700, color: row.send ? 'var(--fg-0)' : 'var(--fg-2)' }}>{label}</span>
                    {row.send && <span style={{ ...mono, fontSize: 9, color: '#5ac47e', marginLeft: 6 }}>sending</span>}
                    {!row.send && <span title="Monitoring only — not set up for sending" style={{ ...mono, fontSize: 9, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 6, border: '1px solid var(--line)', borderRadius: 3, padding: '0 4px' }}>monitor</span>}
                  </td>
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
                    {!row.send ? (
                      <span title="No send path — set up sending (DNS + DKIM + MailWizz list) to spam-test this domain"
                        style={{ fontSize: 10, color: '#e0a94a', border: '1px solid #e0a94a66', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>⚠ no send path</span>
                    ) : testing === row.domain ? (
                      <span style={{ fontSize: 10, color: 'var(--accent,#37d4c2)' }}>testing… ~90s</span>
                    ) : (
                      <>
                        {st?.score != null && <b style={{ color: scoreColor(st.score) }}>{st.score.toFixed(1)}<span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>/10</span></b>}
                        <button onClick={() => runTest(row.domain)} title="Run mail-tester now"
                          style={{ ...mono, fontSize: 10, marginLeft: st?.score != null ? 6 : 0, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--accent,#37d4c2)', cursor: 'pointer' }}>
                          {st?.score != null ? '↻' : 'test now'}
                        </button>
                        {st?.date && <div style={{ color: 'var(--fg-3)', fontSize: 9.5 }}>{st.date}</div>}
                      </>
                    )}
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
