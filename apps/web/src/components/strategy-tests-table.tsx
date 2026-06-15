'use client';

import { useMemo, useState } from 'react';
import type { StrategyTestRow } from '@/lib/data';

const VERDICT_COLOR: Record<string, string> = {
  dead: '#ff5470', marginal: '#f5a623', 'gold-only': '#d4af37', edge: '#2ecc71', discretionary: '#9b8cff', queued: '#7a8699', testing: '#00b8d4',
};
const VERDICT_ORDER = ['edge', 'gold-only', 'marginal', 'dead', 'discretionary', 'testing', 'queued'];
const dash = (v: string | number | null | undefined) => (v === null || v === '' || v === undefined ? '—' : String(v));
const wrap = (url: string) => `https://href.li/?${url}`;

type SortKey = 'name' | 'trades' | 'permo' | 'winPct' | 'pf' | 'isPf' | 'oosPf' | 'realtickPf';

const perMo = (r: StrategyTestRow): number => (r.trades && r.spanMonths ? r.trades / r.spanMonths : NaN);

function pfColor(v: string | null): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  return n >= 1.3 ? '#2ecc71' : n >= 1.0 ? '#f5a623' : '#ff5470';
}

export function StrategyTestsTable({ rows }: { rows: StrategyTestRow[] }) {
  const [q, setQ] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none' | 'verdict' | 'klass'>('verdict');
  const [sortKey, setSortKey] = useState<SortKey>('pf');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showTags, setShowTags] = useState(true);

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => (r.tags ?? []).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [rows]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { const k = r.verdict ?? '—'; m[k] = (m[k] ?? 0) + 1; });
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (activeTags.length && !activeTags.every((t) => (r.tags ?? []).includes(t))) return false;
      if (!ql) return true;
      return [r.name, r.variant, r.asset, r.notes, r.klass, ...(r.tags ?? [])]
        .filter(Boolean).some((s) => String(s).toLowerCase().includes(ql));
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: StrategyTestRow): number =>
      sortKey === 'permo' ? perMo(r) : Number((r as unknown as Record<string, unknown>)[sortKey] ?? NaN);
    out = [...out].sort((a, b) => {
      if (sortKey === 'name') return dir * String(a.name).localeCompare(String(b.name));
      const av = val(a), bv = val(b);
      const aNan = Number.isNaN(av), bNan = Number.isNaN(bv);
      if (aNan && bNan) return 0;
      if (aNan) return 1;          // nulls last
      if (bNan) return -1;
      return dir * (av - bv);
    });
    return out;
  }, [rows, q, activeTags, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', rows: filtered }];
    const m = new Map<string, StrategyTestRow[]>();
    filtered.forEach((r) => {
      const k = (groupBy === 'verdict' ? r.verdict : r.klass) || '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    const keys = [...m.keys()].sort((a, b) => {
      if (groupBy === 'verdict') return VERDICT_ORDER.indexOf(a) - VERDICT_ORDER.indexOf(b);
      return a.localeCompare(b);
    });
    return keys.map((k) => ({ key: k, rows: m.get(k)! }));
  }, [filtered, groupBy]);

  const toggleTag = (t: string) => setActiveTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  };

  const TH: React.CSSProperties = { padding: '8px 9px', fontSize: 11, textAlign: 'left', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--bg)' };
  const THn: React.CSSProperties = { ...TH, textAlign: 'right', cursor: 'pointer', userSelect: 'none' };
  const TD: React.CSSProperties = { padding: '8px 9px', fontSize: 12, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const caret = (k: SortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div>
      {/* summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{rows.length} methods tested:</span>
        {VERDICT_ORDER.filter((v) => counts[v]).map((v) => (
          <span key={v} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12, color: '#fff', background: VERDICT_COLOR[v] }}>
            {counts[v]} {v}
          </span>
        ))}
      </div>

      {/* controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strategy, asset, notes…"
          autoComplete="off"
          style={{ flex: '1 1 240px', minWidth: 180, padding: '7px 11px', fontSize: 12.5, background: 'var(--panel,#0e1420)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Group:</span>
          {(['verdict', 'klass', 'none'] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGroupBy(g)}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--line)',
                background: groupBy === g ? 'var(--accent,#00e5ff)' : 'transparent', color: groupBy === g ? '#001018' : 'var(--muted)', fontWeight: groupBy === g ? 700 : 500 }}>
              {g === 'klass' ? 'class' : g}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowTags((v) => !v)}
          title={showTags ? 'Hide row tags' : 'Show row tags'}
          style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--line)',
            background: 'transparent', color: showTags ? 'var(--fg)' : 'var(--muted)', fontWeight: 500 }}>
          {showTags ? '🏷 Tags on' : '🏷 Tags off'}
        </button>
      </div>

      {/* tag chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {allTags.map((t) => {
          const on = activeTags.includes(t);
          return (
            <button key={t} type="button" onClick={() => toggleTag(t)}
              style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 11, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accent,#00e5ff)' : 'var(--line)'}`,
                background: on ? 'var(--accent,#00e5ff)' : 'transparent', color: on ? '#001018' : 'var(--muted)', fontWeight: on ? 700 : 500 }}>
              {t}
            </button>
          );
        })}
        {activeTags.length > 0 && (
          <button type="button" onClick={() => setActiveTags([])} style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 11, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: '#ff5470' }}>
            clear ✕
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1120 }}>
          <thead>
            <tr>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => toggleSort('name')}>Strategy{caret('name')}</th>
              <th style={TH}>Asset</th>
              <th style={TH}>TF</th>
              <th style={TH}>Code</th>
              <th style={THn} onClick={() => toggleSort('trades')}>Trades{caret('trades')}</th>
              <th style={THn} onClick={() => toggleSort('permo')} title="Trades per month (trades ÷ test span)">Tr/mo{caret('permo')}</th>
              <th style={THn} onClick={() => toggleSort('winPct')}>Win%{caret('winPct')}</th>
              <th style={THn} onClick={() => toggleSort('pf')}>PF{caret('pf')}</th>
              <th style={{ ...TH, textAlign: 'right' }}>Net</th>
              <th style={THn} onClick={() => toggleSort('isPf')}>IS{caret('isPf')}</th>
              <th style={THn} onClick={() => toggleSort('oosPf')}>OOS{caret('oosPf')}</th>
              <th style={THn} onClick={() => toggleSort('realtickPf')}>Real-tick{caret('realtickPf')}</th>
              <th style={TH}>Verdict</th>
              <th style={TH}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupBlock key={g.key || 'all'} g={g} groupBy={groupBy} showTags={showTags} TD={TD} NUM={NUM} />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={14} style={{ ...TD, textAlign: 'center', color: 'var(--muted)', padding: 28 }}>No strategies match the filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
        PF = profit factor (green ≥1.3 · amber ≥1.0 · red &lt;1.0). IS/OOS = in-/out-of-sample. Candle backtest is cost-subtracted; survivors get MT5 Model=4 real-tick. Click a strategy name for its source thread.
      </p>
    </div>
  );
}

function GroupBlock({ g, groupBy, showTags, TD, NUM }: {
  g: { key: string; rows: StrategyTestRow[] }; groupBy: 'none' | 'verdict' | 'klass';
  showTags: boolean; TD: React.CSSProperties; NUM: React.CSSProperties;
}) {
  return (
    <>
      {groupBy !== 'none' && (
        <tr>
          <td colSpan={14} style={{ padding: '7px 9px', background: 'var(--panel,#0e1420)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff', background: groupBy === 'verdict' ? (VERDICT_COLOR[g.key] ?? '#7a8699') : '#3a4660' }}>
              {g.key}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{g.rows.length}</span>
          </td>
        </tr>
      )}
      {g.rows.map((r) => (
        <tr key={r.id}>
          <td style={TD}>
            <div style={{ fontWeight: 600 }}>
              {r.sourceUrl
                ? <a href={wrap(r.sourceUrl)} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--fg)', textDecoration: 'none' }} title="Open source thread">{r.name} <span style={{ color: 'var(--accent,#00e5ff)', fontSize: 10 }}>↗</span></a>
                : r.name}
            </div>
            {r.variant ? <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r.variant}</div> : null}
            {showTags && (r.tags ?? []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, opacity: 0.55 }}>
                {(r.tags ?? []).map((t) => (
                  <span key={t} style={{ fontSize: 9, lineHeight: '14px', color: 'var(--muted)', background: 'rgba(127,140,160,0.10)', borderRadius: 4, padding: '0 5px' }}>{t}</span>
                ))}
              </div>
            )}
          </td>
          <td style={TD}>{dash(r.asset)}</td>
          <td style={TD}>{dash(r.timeframe)}</td>
          <td style={{ ...TD, color: r.codability === 'none' ? '#ff5470' : r.codability === 'partial' ? '#f5a623' : 'var(--muted)' }}>{dash(r.codability)}</td>
          <td style={NUM}>{dash(r.trades)}</td>
          <td style={{ ...NUM, color: 'var(--muted)' }}>{Number.isNaN(perMo(r)) ? '—' : perMo(r).toFixed(1)}</td>
          <td style={NUM}>{dash(r.winPct)}</td>
          <td style={{ ...NUM, color: pfColor(r.pf), fontWeight: 700 }}>{dash(r.pf)}</td>
          <td style={NUM}>{r.net != null && r.net !== '' ? `${r.net}${r.netUnit ? ' ' + r.netUnit : ''}` : '—'}</td>
          <td style={{ ...NUM, color: pfColor(r.isPf) }}>{dash(r.isPf)}</td>
          <td style={{ ...NUM, color: pfColor(r.oosPf) }}>{dash(r.oosPf)}</td>
          <td style={{ ...NUM, color: pfColor(r.realtickPf), fontWeight: 700 }}>{dash(r.realtickPf)}</td>
          <td style={TD}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff', background: VERDICT_COLOR[r.verdict ?? ''] ?? '#7a8699' }}>{dash(r.verdict)}</span>
          </td>
          <td style={{ ...TD, whiteSpace: 'normal', maxWidth: 260, color: 'var(--muted)', fontSize: 11 }}>{dash(r.notes)}</td>
        </tr>
      ))}
    </>
  );
}
