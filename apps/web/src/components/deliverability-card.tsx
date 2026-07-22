'use client';

import { useEffect, useState, useCallback, Fragment, type CSSProperties, type ReactNode } from 'react';
import { MonthCalendar, type CalItem } from '@/components/ui/month-calendar';

interface Auth { spf: boolean; dkim: boolean; dmarc: string | null }
interface PmPoint { date: string; reputation: string | null; spam: number | null; dkim: number | null; spf: number | null; dmarc: number | null }
interface Issue { rule: string; pts: number }
interface SpamPoint { date: string; score?: number; dkimAligned?: boolean; spfPass?: boolean; listUnsub?: boolean; blacklisted?: boolean; issues?: Issue[]; error?: string }
interface Row { domain: string; send?: boolean; warmupStart?: string | null; warmupCampaign?: string | null; listUid?: string | null; auth: Auth; postmaster: PmPoint[] | null; spamTest: SpamPoint[] | null }
interface Data { rows: Row[]; postmasterConfigured: boolean }
interface MwList { uid: string; name: string; description: string; fromName: string | null; fromEmail: string | null; replyTo: string | null; subject: string | null; company: string | null; subscribers: number | null }
interface MwField { label: string; tag: string; type: string; required: boolean }
interface MwSeg { uid: string; name: string; count: number }
interface MwCamp { uid: string; name: string; subject: string | null; status: string; type: string; sendAt: string | null; createdAt: string | null }
interface MwView { list: MwList; fields: MwField[]; segments: MwSeg[]; campaigns: MwCamp[] }

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

const cbtn = (busy = false): CSSProperties => ({ ...mono, fontSize: 10, padding: '3px 9px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--accent,#37d4c2)', cursor: busy ? 'default' : 'pointer', fontWeight: 700 });

// One sending domain's warm-up: content first (create/pick a campaign, preview it) → THEN start.
// You can't start without a campaign — no email = nothing to send, and a bad first send burns
// reputation. Once started, a calendar strip tracks the daily ramp vs real reputation/scores.
function WarmupCalendar({ row, onChange, onView, onPreview, onCompose }: { row: Row; onChange: () => void; onView: (d: string) => void; onPreview: (uid: string, name: string) => void; onCompose: (d: string, editUid?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [camps, setCamps] = useState<MwCamp[] | null>(null); // null = loading

  useEffect(() => {
    let alive = true;
    fetch(`/api/deliverability/mailwizz?domain=${encodeURIComponent(row.domain)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setCamps(j?.campaigns || []); })
      .catch(() => { if (alive) setCamps([]); });
  }, [row.domain, row.warmupCampaign]);

  const post = useCallback(async (action: 'start' | 'stop' | 'select', campaign?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/deliverability/warmup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: row.domain, action, campaign }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || 'failed'); }
      onChange();
    } finally { setBusy(false); }
  }, [busy, row.domain, onChange]);

  const btn = cbtn(busy);
  const selected = camps?.find((c) => c.uid === row.warmupCampaign) || null;

  // Content step — shown in every state (above the calendar too).
  const contentStep = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {camps === null ? <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>loading campaigns…</span>
        : camps.length === 0 ? (
          <>
            <span style={{ fontSize: 11, color: '#e0a94a' }}>⚠ No email yet</span>
            <button onClick={() => onCompose(row.domain)} style={cbtn()} title="Compose a warm-up email — default template or AI-generated from your brief">
              ＋ Create warm-up email
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>Email:</span>
            <select value={row.warmupCampaign || ''} onChange={(e) => post('select', e.target.value)}
              style={{ ...mono, fontSize: 10.5, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', maxWidth: 200 }}>
              <option value="">— choose —</option>
              {camps.map((c) => <option key={c.uid} value={c.uid}>{c.subject || c.name}{c.createdAt ? ` · ${c.createdAt.slice(0, 16)}` : ''} · {c.status}</option>)}
            </select>
            {selected && <button onClick={() => onPreview(selected.uid, selected.name)} style={btn} title="Preview the actual email that goes out">👁 Preview</button>}
            {selected && <button onClick={() => onCompose(row.domain, selected.uid)} style={btn} title="Edit this email (subject + content)">✏️ Edit</button>}
            <button onClick={() => onCompose(row.domain)} style={cbtn()} title="Compose another campaign (default or AI)">＋</button>
          </>
        )}
    </div>
  );

  if (!row.warmupStart) {
    return (
      <div style={{ padding: '4px 0 8px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...mono, fontSize: 11, color: 'var(--fg-1)', fontWeight: 700 }}>{row.domain}</span>
          <button onClick={() => onView(row.domain)} style={btn} title="View the MailWizz list — params, merge tags, segments">✉️ List detail</button>
        </div>
        {contentStep}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => post('start')} disabled={busy || !selected}
            style={{ ...btn, color: selected ? '#e0a94a' : 'var(--fg-3)', borderColor: selected ? '#e0a94a66' : 'var(--line)', cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.6 }}
            title={selected ? 'Mark today as day 1 of the ramp' : 'Pick or create the warm-up email first'}>🔥 Start warm-up</button>
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{selected ? `ramp 50 → full over ${RAMP.length} days` : 'pick the email above first'}</span>
        </div>
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
    <div style={{ padding: '4px 0 8px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 11, color: 'var(--fg-0)', fontWeight: 700 }}>{row.domain}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>
          {done ? <b style={{ color: '#5ac47e' }}>full volume ✓</b> : <>Day {Math.max(dayIdx + 1, 1)} of {RAMP.length} · today’s cap <b style={{ ...mono, color: 'var(--fg-1)' }}>{capLabel(RAMP[Math.min(Math.max(dayIdx, 0), RAMP.length - 1)] ?? RAMP[0]!)}</b></>}
        </span>
        {selected && <button onClick={() => onPreview(selected.uid, selected.name)} style={btn} title="Preview the email being sent">👁 {selected.subject || 'Preview'}</button>}
        {selected && <button onClick={() => onCompose(row.domain, selected.uid)} style={btn} title="Edit this email">✏️ Edit</button>}
        <button onClick={() => onView(row.domain)} style={btn} title="View the MailWizz list — params, merge tags, segments">✉️ List</button>
        <button onClick={() => post('stop')} disabled={busy} style={btn} title="Reset — clears the start date">reset</button>
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

// Month calendar of email ops — one row's worth of dated events per sending domain:
// 🎯 planned warm-up target, ● Postmaster reputation, ⭐ mail-tester score. Filter by domain.
// Actual sends/clicks/unsubs land here once warm-up sending starts (needs a daily MailWizz snapshot).
function CalendarView({ rows }: { rows: Row[] }) {
  const sending = rows.filter((r) => r.send);
  const [dom, setDom] = useState<string>('all');
  const picked = dom === 'all' ? sending : sending.filter((r) => r.domain === dom);

  const items: CalItem[] = [];
  for (const r of picked) {
    // Planned ramp — from warmupStart if started, else PROJECTED from today so the schedule
    // (50 → 100 → 250 …) is visible before you press Start.
    const projected = !r.warmupStart;
    const start = new Date((r.warmupStart || isoUTC(new Date())) + 'T00:00:00Z');
    RAMP.forEach((cap, i) => {
      items.push({ id: `p-${r.domain}-${i}`, date: isoUTC(new Date(start.getTime() + i * DAY_MS)), label: `🎯 ${capLabel(cap)}`, dim: true, color: projected ? '#8a8a8a' : '#e0a94a', title: `${r.domain} · ${projected ? 'PROJECTED (not started — press Start to lock) · ' : ''}warm-up D${i + 1} · send ${cap.toLocaleString()}` });
    });
    for (const p of r.postmaster || []) if (p.reputation) items.push({ id: `r-${r.domain}-${p.date}`, date: p.date, label: `● ${repShort(p.reputation)}`, color: repColor[p.reputation] || 'var(--fg-2)', title: `${r.domain} · reputation ${repShort(p.reputation)}${p.spam != null ? ` · spam ${(p.spam * 100).toFixed(1)}%` : ''}` });
    for (const p of r.spamTest || []) if (p.score != null) items.push({ id: `s-${r.domain}-${p.date}`, date: p.date, label: `⭐ ${p.score}`, color: scoreColor(p.score), title: `${r.domain} · mail-tester ${p.score}/10` });
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>Domain</span>
        <select value={dom} onChange={(e) => setDom(e.target.value)}
          style={{ ...mono, fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' }}>
          <option value="all">all sending</option>
          {sending.map((r) => <option key={r.domain} value={r.domain}>{r.domain}</option>)}
        </select>
        <span style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)' }}>🎯 send target (grey = projected until you Start) · ● reputation · ⭐ score</span>
      </div>
      {sending.length === 0
        ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>No sending domains yet.</span>
        : <MonthCalendar items={items} />}
      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 6 }}>Actual sends / clicks / unsubscribes will populate once warm-up sending starts (daily MailWizz stats snapshot — added when the first send goes out).</div>
    </div>
  );
}

export function DeliverabilityCard() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [view, setView] = useState<'table' | 'warmup' | 'calendar'>('table');
  const [viewDomain, setViewDomain] = useState<string | null>(null);
  const [mw, setMw] = useState<MwView | null>(null);
  const [mwErr, setMwErr] = useState('');
  const [mwNonce, setMwNonce] = useState(0);
  const [preview, setPreview] = useState<{ uid: string; name: string } | null>(null);
  const openPreview = useCallback((uid: string, name: string) => setPreview({ uid, name }), []);
  const [compose, setCompose] = useState<{ domain: string; editUid?: string } | null>(null);

  useEffect(() => {
    if (!viewDomain) { setMw(null); setMwErr(''); return; }
    let alive = true;
    setMw(null); setMwErr('');
    fetch(`/api/deliverability/mailwizz?domain=${encodeURIComponent(viewDomain)}`, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!alive) return; ok ? setMw(j) : setMwErr(j.error || 'failed'); })
      .catch(() => alive && setMwErr('network error'));
    return () => { alive = false; };
  }, [viewDomain, mwNonce]);

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
            {(['table', 'warmup', 'calendar'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: view === v ? 'var(--bg-2)' : 'transparent', color: view === v ? 'var(--fg-0)' : 'var(--fg-3)', fontWeight: view === v ? 700 : 400 }}>
                {v === 'table' ? 'Table' : v === 'warmup' ? '🔥 Warm-up' : '📅 Calendar'}
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
            : d.rows.filter((r) => r.send).map((r) => <WarmupCalendar key={r.domain} row={r} onChange={load} onView={setViewDomain} onPreview={openPreview} onCompose={(dom, editUid) => setCompose({ domain: dom, editUid })} />)}
          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4, lineHeight: 1.5 }}>
            Ramp the daily send cap in MailWizz to each day’s target; send to most-engaged first. Dot = Postmaster reputation that day, number = mail-tester score. Green → step up, red → hold a day.
          </div>
        </div>
      ) : view === 'calendar' ? (
        <CalendarView rows={d.rows} />
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
      {viewDomain && (
        <MailwizzDrawer domain={viewDomain} data={mw} err={mwErr} onClose={() => setViewDomain(null)} onPreview={openPreview} onChanged={() => { setMwNonce((n) => n + 1); load(); }} />
      )}
      {preview && (
        <ContentPreview uid={preview.uid} name={preview.name} onClose={() => setPreview(null)} />
      )}
      {compose && (
        <CreateCampaignModal domain={compose.domain} editUid={compose.editUid} onClose={() => setCompose(null)} onDone={() => { setCompose(null); setMwNonce((n) => n + 1); load(); }} />
      )}
    </div>
  );
}

// Compose a warm-up/promo email: free-form brief → gpt-4o-mini draft (subject + HTML), fully
// editable, live preview, then saved as a MailWizz draft and selected for this domain.
// Leave the brief blank + Create = the free static default template (no AI call).
function CreateCampaignModal({ domain, editUid, onClose, onDone }: { domain: string; editUid?: string; onClose: () => void; onDone: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [gen, setGen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'html' | 'preview'>('html');
  const [msg, setMsg] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [savedOffers, setSavedOffers] = useState<Array<{ id: number; label: string; url: string; interest: string }>>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [projectName, setProjectName] = useState('');
  const [newOffer, setNewOffer] = useState({ label: '', url: '', interest: '' });
  const [savingOffer, setSavingOffer] = useState(false);
  const cleanOffers = savedOffers.filter((o) => selected.has(o.id)).map((o) => ({ label: o.label, url: o.url, interest: o.interest }));

  useEffect(() => {
    let alive = true;
    fetch(`/api/deliverability/offers?domain=${encodeURIComponent(domain)}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => { if (alive) { setSavedOffers(j.offers || []); setProjectName(j.project?.name || ''); } }).catch(() => {});
    return () => { alive = false; };
  }, [domain]);

  const addOffer = async () => {
    if (savingOffer || !newOffer.label.trim() || !newOffer.url.trim()) return;
    setSavingOffer(true);
    try {
      const r = await fetch('/api/deliverability/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, ...newOffer }) });
      const j = await r.json();
      if (!r.ok) { alert(j.error || 'failed'); return; }
      setSavedOffers((a) => [j.offer, ...a]); setSelected((s) => new Set(s).add(j.offer.id)); setNewOffer({ label: '', url: '', interest: '' });
    } finally { setSavingOffer(false); }
  };
  const delOffer = async (id: number) => {
    await fetch(`/api/deliverability/offers?id=${id}`, { method: 'DELETE' });
    setSavedOffers((a) => a.filter((o) => o.id !== id)); setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  };
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const generate = async () => {
    if (gen || (!prompt.trim() && !cleanOffers.length)) return;
    setGen(true); setMsg('generating with gpt-4o-mini…');
    try {
      const r = await fetch('/api/deliverability/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, prompt, subject: subject.trim() || undefined, offers: cleanOffers, model }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || 'generate failed'); return; }
      setSubject(j.subject || subject); setHtml(j.html || ''); setTab('preview');
      setMsg(`✓ ${j.model}${j.tokens ? ` · ${j.tokens} tok · ~$${((j.tokens / 1e6) * 0.4).toFixed(4)}` : ''}`);
    } catch { setMsg('network error'); } finally { setGen(false); }
  };

  // In edit mode, load the campaign's current subject + HTML to tweak.
  useEffect(() => {
    if (!editUid) return;
    fetch(`/api/deliverability/campaign-content?uid=${encodeURIComponent(editUid)}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => { if (j && !j.error) { setSubject(j.subject || ''); setHtml(j.html || ''); setTab('preview'); } }).catch(() => {});
  }, [editUid]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      if (editUid) {
        setMsg('saving changes…');
        if (!html.trim()) { setMsg('body is empty'); return; }
        const r = await fetch(`/api/deliverability/campaign?uid=${encodeURIComponent(editUid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim() || undefined, body: html }) });
        const j = await r.json();
        if (!r.ok) { setMsg(j.error || 'save failed'); return; }
        onDone(); return;
      }
      setMsg(html.trim() ? 'saving draft…' : 'saving default template…');
      const r = await fetch('/api/deliverability/campaign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, subject: subject.trim() || undefined, body: html.trim() || undefined, offers: cleanOffers }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || 'create failed'); return; }
      if (j.uid) await fetch('/api/deliverability/warmup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, action: 'select', campaign: j.uid }) });
      onDone();
    } catch { setMsg('network error'); } finally { setCreating(false); }
  };

  const field: CSSProperties = { ...mono, fontSize: 12, padding: '6px 8px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', width: '100%' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px,96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>{editUid ? '✏️ Edit email' : '✉️ New email'} · <span style={{ ...mono, color: 'var(--fg-2)' }}>{domain}</span></div>
          <button onClick={onClose} style={{ ...mono, fontSize: 14, border: 'none', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <label style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Brief (optional — blank = free default template)</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
            placeholder="e.g. Promo: 20% coupon for the BAH premium, friendly + short — weave in the offers below"
            style={{ ...field, resize: 'vertical' }} />

          <label style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
            Offer links <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--fg-4)' }}>— pick from {projectName || 'project'}; AI builds the email around them</span>
          </label>
          {savedOffers.length === 0
            ? <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>No saved offers for this project yet — add one below (reusable).</span>
            : savedOffers.map((o) => (
              <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} style={{ cursor: 'pointer' }} />
                <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{o.label}</span>
                <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.url}</a>
                {o.interest && <span style={{ ...mono, fontSize: 9, color: 'var(--accent,#37d4c2)', border: '1px solid var(--line)', borderRadius: 4, padding: '0 5px' }}>{o.interest}</span>}
                <button onClick={() => delOffer(o.id)} title="Delete offer" style={{ ...mono, fontSize: 11, border: 'none', background: 'transparent', color: '#d16b6b', cursor: 'pointer' }}>🗑</button>
              </div>
            ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <input value={newOffer.label} onChange={(e) => setNewOffer((o) => ({ ...o, label: e.target.value }))} placeholder="label" style={{ ...field, flex: 1.1 }} spellCheck={false} />
            <input value={newOffer.url} onChange={(e) => setNewOffer((o) => ({ ...o, url: e.target.value }))} placeholder="https://…" style={{ ...field, flex: 1.6 }} spellCheck={false} />
            <input value={newOffer.interest} onChange={(e) => setNewOffer((o) => ({ ...o, interest: e.target.value }))} placeholder="interest" style={{ ...field, flex: 0.9 }} spellCheck={false} />
            <button onClick={addOffer} disabled={savingOffer || !newOffer.label.trim() || !newOffer.url.trim()} style={cbtn(savingOffer)}>{savingOffer ? '…' : '＋ save'}</button>
          </div>
          {cleanOffers.length > 0 && <div style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)' }}>{cleanOffers.length} selected · tracked per subscriber via {domain}. After sending, each link’s clickers = an interest segment to target next.</div>}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 2 }}>
            <button onClick={generate} disabled={gen || (!prompt.trim() && !cleanOffers.length)} style={{ ...cbtn(gen), opacity: (prompt.trim() || cleanOffers.length) ? 1 : 0.5 }} title="Draft with AI — writes the email around your brief + selected offers">{gen ? '…' : '✨ Generate with AI'}</button>
            <select value={model} onChange={(e) => setModel(e.target.value)} title="Model — 4o-mini is cheapest; 4o/4.1 write better for special campaigns"
              style={{ ...mono, fontSize: 10.5, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)' }}>
              <option value="gpt-4o-mini">gpt-4o-mini · ~$0.0005</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini · ~$0.001</option>
              <option value="gpt-4o">gpt-4o · ~$0.008</option>
              <option value="gpt-4.1">gpt-4.1 · ~$0.008</option>
            </select>
            {msg && <span style={{ ...mono, fontSize: 10, color: msg.startsWith('✓') ? '#5ac47e' : 'var(--fg-2)' }}>{msg}</span>}
          </div>

          <label style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="(auto if blank)" style={field} spellCheck={false} />
          <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
            {(['html', 'preview'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ ...mono, fontSize: 10, padding: '2px 9px', borderRadius: 4, border: 'none', cursor: 'pointer', background: tab === t ? 'var(--bg-1)' : 'transparent', color: tab === t ? 'var(--fg-0)' : 'var(--fg-3)', fontWeight: tab === t ? 700 : 400 }}>{t === 'html' ? 'Edit HTML' : 'Preview'}</button>
            ))}
          </div>
          {tab === 'html'
            ? <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12} placeholder="(blank = default warm-up template; or Generate above, then trim here)" style={{ ...field, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical' }} spellCheck={false} />
            : <iframe title="preview" sandbox="" srcDoc={html || '<p style="font-family:sans-serif;color:#888;padding:20px">Nothing to preview — generate or paste HTML.</p>'} style={{ width: '100%', height: 300, border: '1px solid var(--line)', borderRadius: 5, background: '#fff' }} />}
          <div style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)' }}>Required tags [UNSUBSCRIBE_URL] + [COMPANY_FULL_ADDRESS] are auto-added if missing. Draft only — never auto-sends.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--line)' }}>
          <button onClick={onClose} style={{ ...mono, fontSize: 11, padding: '5px 12px', borderRadius: 5, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={create} disabled={creating} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--accent,#37d4c2)', cursor: 'pointer' }}>{creating ? 'saving…' : editUid ? 'Save changes' : 'Create draft'}</button>
        </div>
      </div>
    </div>
  );
}

// Renders the actual email HTML (sandboxed iframe) so you see exactly what recipients get.
function ContentPreview({ uid, name, onClose }: { uid: string; name: string; onClose: () => void }) {
  const [c, setC] = useState<{ subject: string; fromName: string; fromEmail: string; status: string; html: string; editedElsewhere?: boolean } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    fetch(`/api/deliverability/campaign-content?uid=${encodeURIComponent(uid)}`, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (alive) (ok ? setC(j) : setErr(j.error || 'failed')); })
      .catch(() => alive && setErr('network error'));
    return () => { alive = false; };
  }, [uid]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px,96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c?.subject || name}</div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{c ? <>{c.fromName} &lt;{c.fromEmail}&gt; · {c.status}</> : uid}</div>
          </div>
          <button onClick={onClose} style={{ ...mono, fontSize: 14, border: 'none', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>✕</button>
        </div>
        {err && <div style={{ padding: 16, fontSize: 12, color: '#d16b6b' }}>{err}</div>}
        {!c && !err && <div style={{ padding: 16, fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>}
        {c && (c.html
          ? <iframe title="email preview" sandbox="" srcDoc={c.html} style={{ flex: 1, minHeight: 360, border: 'none', background: '#fff' }} />
          : <div style={{ padding: 16, fontSize: 12, color: 'var(--fg-3)' }}>{c.editedElsewhere ? 'Edited in MailWizz — open MailWizz to view the body.' : 'No content stored.'}</div>)}
      </div>
    </div>
  );
}

// Read-only drawer: everything MailWizz holds for a sending domain's list — defaults/params,
// merge tags, segments, campaigns. No editing here; compose stays in MailWizz.
function MailwizzDrawer({ domain, data, err, onClose, onPreview, onChanged }: { domain: string; data: MwView | null; err: string; onClose: () => void; onPreview: (uid: string, name: string) => void; onChanged: () => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const del = async (uid: string, name: string) => {
    if (deleting || !confirm(`Delete campaign "${name}" from MailWizz? This cannot be undone.`)) return;
    setDeleting(uid);
    try {
      const r = await fetch(`/api/deliverability/campaign?uid=${encodeURIComponent(uid)}`, { method: 'DELETE' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || 'delete failed'); return; }
      onChanged();
    } finally { setDeleting(null); }
  };
  const secTitle: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-3)', fontWeight: 700, margin: '14px 0 6px' };
  const kv = (k: string, v: ReactNode) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
      <span style={{ color: 'var(--fg-3)', minWidth: 78 }}>{k}</span>
      <span style={{ ...mono, color: 'var(--fg-1)', wordBreak: 'break-word' }}>{v ?? '—'}</span>
    </div>
  );
  const statusColor: Record<string, string> = { sent: '#5ac47e', sending: '#37d4c2', 'draft': 'var(--fg-3)', 'pending-sending': '#e0a94a', paused: '#e0a94a' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px,92vw)', height: '100%', overflowY: 'auto', background: 'var(--bg-2)', borderLeft: '1px solid var(--line)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>✉️ {domain}</div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>MailWizz list {data ? `· ${data.list.subscribers ?? '?'} subs` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="https://mail.on.tc/customer/campaigns" target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: 10, color: 'var(--fg-2)', textDecoration: 'none' }}>MailWizz ↗</a>
            <button onClick={onClose} style={{ ...mono, fontSize: 14, border: 'none', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {err && <div style={{ marginTop: 16, fontSize: 12, color: '#d16b6b' }}>{err}</div>}
        {!data && !err && <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>}
        {data && (
          <>
            <div style={secTitle}>Params · sending defaults</div>
            {kv('list', `${data.list.name} · ${data.list.uid}`)}
            {kv('from', data.list.fromEmail && <>{data.list.fromName} &lt;{data.list.fromEmail}&gt;</>)}
            {kv('reply-to', data.list.replyTo)}
            {kv('subject', data.list.subject)}
            {kv('CAN-SPAM', data.list.company)}
            {data.list.description && kv('note', data.list.description)}

            <div style={secTitle}>Merge tags · {data.fields.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {data.fields.map((f) => (
                <span key={f.tag} title={`${f.label} · ${f.type}${f.required ? ' · required' : ''}`}
                  style={{ ...mono, fontSize: 10, color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px' }}>
                  [{f.tag}]{f.required && <span style={{ color: '#e0a94a' }}> *</span>}
                </span>
              ))}
            </div>

            <div style={secTitle}>Segments · {data.segments.length}</div>
            {data.segments.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>none</div>
              : data.segments.map((s) => (
                <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0' }}>
                  <span style={{ color: 'var(--fg-1)' }}>{s.name}</span>
                  <span style={{ ...mono, color: 'var(--fg-2)' }}>{s.count.toLocaleString()} subs</span>
                </div>
              ))}

            <div style={secTitle}>Campaigns · {data.campaigns.length}</div>
            {data.campaigns.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>no campaigns yet — create one in MailWizz to send the warm-up</div>
              : data.campaigns.map((c) => (
                <div key={c.uid} style={{ borderBottom: '1px solid var(--line)', padding: '5px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 600 }}>{c.name}</span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => onPreview(c.uid, c.name)} title="Preview email" style={{ ...mono, fontSize: 10, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-1)', color: 'var(--accent,#37d4c2)', cursor: 'pointer', padding: '1px 6px' }}>👁</button>
                      <button onClick={() => del(c.uid, c.name)} disabled={deleting === c.uid} title="Delete from MailWizz" style={{ ...mono, fontSize: 10, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-1)', color: '#d16b6b', cursor: 'pointer', padding: '1px 6px' }}>{deleting === c.uid ? '…' : '🗑'}</button>
                      <span style={{ ...mono, fontSize: 9.5, color: statusColor[c.status] || 'var(--fg-3)', textTransform: 'uppercase' }}>{c.status}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{c.subject}</div>
                  <div style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)' }}>{[c.createdAt && `created ${c.createdAt.slice(0, 16)}`, c.type].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
