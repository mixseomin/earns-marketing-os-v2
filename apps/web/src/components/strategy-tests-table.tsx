'use client';

import { Fragment, useMemo, useState } from 'react';
import type { StrategyTestRow, StrategyAssetRow, StrategyForwardRow } from '@/lib/data';

const VERDICT_COLOR: Record<string, string> = {
  dead: '#ff5470', marginal: '#f5a623', 'gold-only': '#d4af37', edge: '#2ecc71', discretionary: '#9b8cff', queued: '#7a8699', testing: '#00b8d4',
};
const VERDICT_ORDER = ['edge', 'gold-only', 'marginal', 'dead', 'discretionary', 'testing', 'queued'];
const dash = (v: string | number | null | undefined) => (v === null || v === '' || v === undefined ? '—' : String(v));
const wrap = (url: string) => `https://href.li/?${url}`;

type SortKey = 'name' | 'trades' | 'permo' | 'winPct' | 'pf' | 'maxDd' | 'cagr' | 'isPf' | 'oosPf' | 'realtickPf';
type GroupKey = 'setup' | 'sample' | 'perf' | 'robust';

const perMo = (r: StrategyTestRow): number => (r.trades && r.spanMonths ? r.trades / r.spanMonths : NaN);
// CAGR risk-normalized to a 20% max-drawdown budget (uses real net + maxDD; no fabricated capital).
const cagrCalc = (net: number, dd: number, m: number | null): number => {
  if (!m || Number.isNaN(net) || Number.isNaN(dd) || dd <= 0 || net <= 0) return NaN;
  return (Math.pow(1 + 0.2 * net / dd, 12 / m) - 1) * 100;
};
const cagrPct = (r: StrategyTestRow): number => cagrCalc(Number(r.net), Number(r.maxDd), r.spanMonths);
const cagrColor = (v: number): string | undefined => (Number.isNaN(v) ? undefined : v >= 10 ? '#2ecc71' : v >= 4 ? '#f5a623' : '#ff5470');
function pfColor(v: string | null): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  return n >= 1.3 ? '#2ecc71' : n >= 1.0 ? '#f5a623' : '#ff5470';
}

type Col = { key: string; group: GroupKey; label: string; title?: string; sort?: SortKey; num?: boolean; bold?: boolean; render: (r: StrategyTestRow) => React.ReactNode; color?: (r: StrategyTestRow) => string | undefined };

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'setup', label: 'Setup' }, { key: 'sample', label: 'Sample' }, { key: 'perf', label: 'Performance' }, { key: 'robust', label: 'Robustness' },
];

const COLUMNS: Col[] = [
  { key: 'asset', group: 'setup', label: 'Asset', render: (r) => dash(r.asset) },
  { key: 'tf', group: 'setup', label: 'TF', render: (r) => dash(r.timeframe) },
  { key: 'period', group: 'setup', label: 'Period', title: 'Test window · years', render: (r) => (r.period ? <span>{r.period}{r.spanMonths ? <span style={{ color: 'var(--muted)' }}> · {(r.spanMonths / 12).toFixed(1)}y</span> : null}</span> : '—') },
  { key: 'code', group: 'setup', label: 'Code', title: 'Codability: full / partial / none', render: (r) => dash(r.codability), color: (r) => (r.codability === 'none' ? '#ff5470' : r.codability === 'partial' ? '#f5a623' : 'var(--muted)') },
  { key: 'trades', group: 'sample', label: 'Trades', title: 'Sample size', sort: 'trades', num: true, render: (r) => dash(r.trades) },
  { key: 'permo', group: 'sample', label: 'Tr/mo', title: 'Trades per month', sort: 'permo', num: true, render: (r) => (Number.isNaN(perMo(r)) ? '—' : perMo(r).toFixed(1)), color: () => 'var(--muted)' },
  { key: 'win', group: 'perf', label: 'Win%', sort: 'winPct', num: true, render: (r) => dash(r.winPct) },
  { key: 'pf', group: 'perf', label: 'PF', title: 'Profit factor', sort: 'pf', num: true, bold: true, render: (r) => dash(r.pf), color: (r) => pfColor(r.pf) },
  { key: 'net', group: 'perf', label: 'Net', num: true, render: (r) => (r.net != null && r.net !== '' ? `${r.net}${r.netUnit ? ' ' + r.netUnit : ''}` : '—') },
  { key: 'dd', group: 'perf', label: 'Max DD', title: 'Max drawdown (peak-to-trough of equity ÷ peak). For edges: standard %DD on a $10k account, fixed notional, NO leverage (MT5 fixed-lot style). Other rows in raw instrument points.', sort: 'maxDd', num: true, render: (r) => (r.maxDd != null && r.maxDd !== '' ? `${r.maxDd}${r.netUnit ? ' ' + r.netUnit : ''}` : '—'), color: () => 'var(--muted)' },
  { key: 'cagr', group: 'perf', label: 'CAGR*', title: 'Risk-normalized CAGR at a 20% max-drawdown budget (indicative)', sort: 'cagr', num: true, bold: true, render: (r) => { const v = cagrPct(r); return Number.isNaN(v) ? '—' : `${v.toFixed(1)}%`; }, color: (r) => cagrColor(cagrPct(r)) },
  { key: 'is', group: 'robust', label: 'IS', title: 'In-sample PF', sort: 'isPf', num: true, render: (r) => dash(r.isPf), color: (r) => pfColor(r.isPf) },
  { key: 'oos', group: 'robust', label: 'OOS', title: 'Out-of-sample PF', sort: 'oosPf', num: true, render: (r) => dash(r.oosPf), color: (r) => pfColor(r.oosPf) },
  { key: 'rt', group: 'robust', label: 'Real-tick', title: 'MT5 Model=4 real-tick PF', sort: 'realtickPf', num: true, bold: true, render: (r) => dash(r.realtickPf), color: (r) => pfColor(r.realtickPf) },
];

const FWD_COLOR: Record<string, string> = { HOLDING: '#2ecc71', BELOW: '#ff5470', warming: '#7a8699' };
// aggregate live forward rows for a strategy (may run on >1 symbol): sum trades/wins, trade-weighted PF
function fwdAgg(list: StrategyForwardRow[] | undefined): { trades: number; pf: number; status: string; symbols: number } | null {
  if (!list || !list.length) return null;
  let trades = 0, pfw = 0; const statuses: string[] = [];
  for (const f of list) {
    const t = Number(f.trades) || 0; trades += t;
    pfw += (Number(f.fwdPf) || 0) * t; if (f.status) statuses.push(f.status);
  }
  const status = statuses.includes('BELOW') ? 'BELOW' : statuses.includes('HOLDING') ? 'HOLDING' : (statuses[0] ?? 'warming');
  return { trades, pf: trades ? pfw / trades : 0, status, symbols: list.length };
}

export function StrategyTestsTable({ rows, assetsByStrategy = {}, forwardByStrategy = {} }: { rows: StrategyTestRow[]; assetsByStrategy?: Record<string, StrategyAssetRow[]>; forwardByStrategy?: Record<string, StrategyForwardRow[]> }) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none' | 'verdict' | 'klass'>('verdict');
  const [sortKey, setSortKey] = useState<SortKey>('pf');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showTags, setShowTags] = useState(true);
  const [showAllTags, setShowAllTags] = useState(false);
  const [visGroups, setVisGroups] = useState<Record<GroupKey, boolean>>({ setup: true, sample: true, perf: true, robust: false });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const showTip = (text: string, e: React.MouseEvent) => { if (text) setTip({ x: e.clientX, y: e.clientY, text }); };
  const hideTip = () => setTip(null);
  const hasForward = Object.keys(forwardByStrategy).length > 0;
  const [showForward, setShowForward] = useState(true);
  const fwdOn = showForward; // forward columns visible (toggle); shows '—' until live data flows

  const cols = COLUMNS.filter((c) => visGroups[c.group]);
  const colSpan = cols.length + 2 + (fwdOn ? 3 : 0);

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
      sortKey === 'permo' ? perMo(r) : sortKey === 'cagr' ? cagrPct(r) : Number((r as unknown as Record<string, unknown>)[sortKey] ?? NaN);
    out = [...out].sort((a, b) => {
      if (sortKey === 'name') return dir * String(a.name).localeCompare(String(b.name));
      const av = val(a), bv = val(b);
      const aNan = Number.isNaN(av), bNan = Number.isNaN(bv);
      if (aNan && bNan) return 0;
      if (aNan) return 1;
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
    const keys = [...m.keys()].sort((a, b) => (groupBy === 'verdict' ? VERDICT_ORDER.indexOf(a) - VERDICT_ORDER.indexOf(b) : a.localeCompare(b)));
    return keys.map((k) => ({ key: k, rows: m.get(k)! }));
  }, [filtered, groupBy]);

  const toggleTag = (t: string) => setActiveTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  };

  const TH: React.CSSProperties = { padding: '7px 10px', fontSize: 11, textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 3, background: 'var(--panel,#0e1420)', boxShadow: 'inset 0 -1px 0 var(--line)' };
  const TD: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const caret = (k: SortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');
  const chip = (on: boolean): React.CSSProperties => ({ fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--accent,#00e5ff)' : 'transparent', color: on ? '#001018' : 'var(--muted)', fontWeight: on ? 700 : 500 });

  return (
    <div>
      {/* summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{rows.length} methods tested:</span>
        {VERDICT_ORDER.filter((v) => counts[v]).map((v) => (
          <span key={v} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12, color: '#fff', background: VERDICT_COLOR[v] }}>{counts[v]} {v}</span>
        ))}
      </div>

      {/* controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strategy, asset, notes…" autoComplete="off"
          style={{ flex: '1 1 220px', minWidth: 170, padding: '7px 11px', fontSize: 12.5, background: 'var(--panel,#0e1420)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Group:</span>
          {(['verdict', 'klass', 'none'] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGroupBy(g)} style={chip(groupBy === g)}>{g === 'klass' ? 'class' : g}</button>
          ))}
        </div>
        <button type="button" onClick={() => setShowTags((v) => !v)} style={{ ...chip(false), color: showTags ? 'var(--fg)' : 'var(--muted)' }}>{showTags ? '🏷 Tags on' : '🏷 Tags off'}</button>
      </div>

      {/* column group toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Columns:</span>
        {GROUPS.map((g) => (
          <button key={g.key} type="button" onClick={() => setVisGroups((p) => ({ ...p, [g.key]: !p[g.key] }))} style={{ ...chip(visGroups[g.key]), fontSize: 10.5 }}>{g.label}</button>
        ))}
        <button type="button" onClick={() => setShowForward((v) => !v)} title="Live forward-test results (StrategyLab demo) joined by strategy name" style={{ ...chip(fwdOn), fontSize: 10.5 }}>📡 Forward (live){hasForward ? '' : ' — no data yet'}</button>
      </div>

      {/* tag chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {(() => {
          const visible = showAllTags ? allTags : [...new Set([...activeTags, ...allTags])].slice(0, Math.max(14, activeTags.length));
          return visible.map((t) => {
            const on = activeTags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 11, cursor: 'pointer', border: '1px solid transparent', background: on ? 'var(--accent,#00e5ff)' : 'rgba(127,140,160,0.16)', color: on ? '#001018' : 'var(--fg)', fontWeight: on ? 700 : 500 }}>{t}</button>
            );
          });
        })()}
        {allTags.length > 14 && (
          <button type="button" onClick={() => setShowAllTags((v) => !v)} style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 11, cursor: 'pointer', border: '1px dashed var(--line)', background: 'transparent', color: 'var(--accent,#00e5ff)' }}>{showAllTags ? '− less' : `+${allTags.length - 14} tags`}</button>
        )}
        {activeTags.length > 0 && (
          <button type="button" onClick={() => setActiveTags([])} style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 11, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: '#ff5470' }}>clear ✕</button>
        )}
      </div>

      <div style={{ overflow: 'auto', maxHeight: '72vh', border: '1px solid var(--line)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: 'auto', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => toggleSort('name')}>Strategy{caret('name')}</th>
              {cols.map((c) => (
                <th key={c.key} title={c.title} style={c.sort ? { ...TH, textAlign: c.num ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' } : { ...TH, textAlign: c.num ? 'right' : 'left' }}
                  onClick={c.sort ? () => toggleSort(c.sort!) : undefined}>{c.label}{c.sort ? caret(c.sort) : ''}</th>
              ))}
              <th style={TH}>Verdict</th>
              {fwdOn && <th style={{ ...TH, textAlign: 'left', borderLeft: '2px solid var(--line)' }} title="Live status: warming / HOLDING (live PF ≥ backtest base) / BELOW">📡 Live</th>}
              {fwdOn && <th style={{ ...TH, textAlign: 'right' }} title="Live forward trades since forward start">Live N</th>}
              {fwdOn && <th style={{ ...TH, textAlign: 'right' }} title="Live forward profit factor (demo) — compare to backtest PF">Live PF</th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupBlock key={g.key || 'all'} g={g} groupBy={groupBy} showTags={showTags} cols={cols} colSpan={colSpan} assetsByStrategy={assetsByStrategy} forwardByStrategy={forwardByStrategy} fwdOn={fwdOn} expanded={expanded} toggleExpand={toggleExpand} onTip={showTip} onTipEnd={hideTip} TD={TD} NUM={NUM} />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={colSpan} style={{ ...TD, textAlign: 'center', color: 'var(--muted)', padding: 28 }}>No strategies match the filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
        PF = profit factor (green ≥1.3 · amber ≥1.0 · red &lt;1.0). For the 10 edges, <b>Net</b> &amp; <b>Max DD</b> are in <b>% of a $10k account, fixed notional, no leverage</b> (standard equity-drawdown, MT5-style); other rows are in raw instrument points. <b>CAGR*</b> = risk-normalized to a 20% max-drawdown budget, indicative. The ↗ on a strategy name links its <b>canonical published source</b> (book / paper / Turtle rules); the numbers here are this lab&apos;s own cost-subtracted, IS/OOS-split backtest (harness file in the notes tooltip), not the source&apos;s. Candle backtest is cost-subtracted; survivors get MT5 Model=4 real-tick. Hover a strategy name for its rules; use the Columns toggles to show/hide groups. <b>📡 Forward (live)</b> = real demo forward-test from StrategyLab (MT5), joined by name: <i>warming</i> → <i>HOLDING</i> (live PF ≥ backtest base) → <i>BELOW</i>. Watch Live PF vs backtest PF as N grows — that is the real out-of-sample proof.
      </p>

      {tip && (
        <div style={{ position: 'fixed', left: Math.min(tip.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 400), top: tip.y + 16, zIndex: 9999, maxWidth: 380, padding: '10px 13px', background: '#0b1018', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.55)', fontSize: 11.5, lineHeight: 1.6, color: 'var(--fg)', pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>{tip.text}</div>
      )}
    </div>
  );
}

function childCell(key: string, a: StrategyAssetRow, spanMonths: number | null, unit?: string): React.ReactNode {
  const u = unit ? ' ' + unit : '';
  if (key === 'trades') return dash(a.trades);
  if (key === 'win') return dash(a.winPct);
  if (key === 'pf') return dash(a.pf);
  if (key === 'net') return a.net != null && a.net !== '' ? `${a.net}${u}` : '—';
  if (key === 'dd') return a.maxDd != null && a.maxDd !== '' ? `${a.maxDd}${u}` : '—';
  if (key === 'cagr') { const v = cagrCalc(Number(a.net), Number(a.maxDd), spanMonths); return Number.isNaN(v) ? '—' : `${v.toFixed(1)}%`; }
  return '';
}

function GroupBlock({ g, groupBy, showTags, cols, colSpan, assetsByStrategy, forwardByStrategy, fwdOn, expanded, toggleExpand, onTip, onTipEnd, TD, NUM }: {
  g: { key: string; rows: StrategyTestRow[] }; groupBy: 'none' | 'verdict' | 'klass'; showTags: boolean;
  cols: Col[]; colSpan: number; assetsByStrategy: Record<string, StrategyAssetRow[]>; forwardByStrategy: Record<string, StrategyForwardRow[]>; fwdOn: boolean; expanded: Set<number>; toggleExpand: (id: number) => void;
  onTip: (text: string, e: React.MouseEvent) => void; onTipEnd: () => void;
  TD: React.CSSProperties; NUM: React.CSSProperties;
}) {
  const assetColVisible = cols.some((c) => c.key === 'asset');
  return (
    <>
      {groupBy !== 'none' && (
        <tr>
          <td colSpan={colSpan} style={{ padding: '7px 9px', background: 'var(--panel,#0e1420)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff', background: groupBy === 'verdict' ? (VERDICT_COLOR[g.key] ?? '#7a8699') : '#3a4660' }}>{g.key}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{g.rows.length}</span>
          </td>
        </tr>
      )}
      {g.rows.map((r) => {
        const kids = assetsByStrategy[r.name] ?? [];
        const isOpen = expanded.has(r.id);
        return (
          <Fragment key={r.id}>
            <tr>
              <td style={TD}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  {!assetColVisible && kids.length > 0 ? (
                    <button type="button" onClick={() => toggleExpand(r.id)} title={`${kids.length} per-asset results`}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--accent,#00e5ff)', fontSize: 11, padding: 0, lineHeight: 1, width: 10 }}>{isOpen ? '▾' : '▸'}</button>
                  ) : null}
                  <span>
                    <span style={{ fontWeight: 600, cursor: 'help' }} onMouseMove={(e) => onTip(r.notes ?? '', e)} onMouseLeave={onTipEnd}>
                      {r.sourceUrl
                        ? <a href={wrap(r.sourceUrl)} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--fg)', textDecoration: 'none' }}>{r.name} <span style={{ color: 'var(--accent,#00e5ff)', fontSize: 10 }}>↗</span></a>
                        : r.name}
                    </span>
                    {!assetColVisible && kids.length > 0 ? <span onClick={() => toggleExpand(r.id)} style={{ fontSize: 9.5, color: 'var(--accent,#00e5ff)', marginLeft: 6, cursor: 'pointer' }}>({kids.length} assets)</span> : null}
                    {r.variant ? <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r.variant}</div> : null}
                    {showTags && (r.tags ?? []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, opacity: 0.55 }}>
                        {(r.tags ?? []).map((t) => (<span key={t} style={{ fontSize: 9, lineHeight: '14px', color: 'var(--muted)', background: 'rgba(127,140,160,0.10)', borderRadius: 4, padding: '0 5px' }}>{t}</span>))}
                      </div>
                    )}
                  </span>
                </div>
              </td>
              {cols.map((c) => {
                if (c.key === 'asset' && kids.length > 0) {
                  return (
                    <td key={c.key} style={TD}>
                      <span onClick={() => toggleExpand(r.id)} title={`${kids.length} per-asset results`}
                        style={{ cursor: 'pointer', color: 'var(--accent,#00e5ff)', borderBottom: '1px dotted', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {dash(r.asset)} <span style={{ fontSize: 9 }}>{isOpen ? '▾' : '▸'}</span>
                        <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{kids.length}</span>
                      </span>
                    </td>
                  );
                }
                const col = c.color ? c.color(r) : undefined;
                return <td key={c.key} style={{ ...(c.num ? NUM : TD), ...(col ? { color: col } : {}), ...(c.bold ? { fontWeight: 700 } : {}) }}>{c.render(r)}</td>;
              })}
              <td style={TD}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff', background: VERDICT_COLOR[r.verdict ?? ''] ?? '#7a8699' }}>{dash(r.verdict)}</span>
              </td>
              {fwdOn && (() => {
                const fw = fwdAgg(forwardByStrategy[r.name]);
                if (!fw) return (<><td style={{ ...TD, borderLeft: '2px solid var(--line)', color: 'var(--muted)' }}>—</td><td style={NUM}>—</td><td style={NUM}>—</td></>);
                return (<>
                  <td style={{ ...TD, borderLeft: '2px solid var(--line)' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 9, color: '#001018', background: FWD_COLOR[fw.status] ?? '#7a8699' }}>{fw.status}</span>{fw.symbols > 1 ? <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>×{fw.symbols}</span> : null}</td>
                  <td style={NUM}>{fw.trades || '—'}</td>
                  <td style={{ ...NUM, fontWeight: 700, color: fw.trades ? pfColor(String(fw.pf)) : 'var(--muted)' }}>{fw.trades ? fw.pf.toFixed(2) : '—'}</td>
                </>);
              })()}
            </tr>
            {isOpen && kids.map((a, idx) => (
              <tr key={`${r.id}-${idx}`} style={{ background: 'rgba(127,140,160,0.05)' }}>
                <td style={{ ...TD, paddingLeft: 28, color: 'var(--muted)', fontSize: 11.5 }}>↳ {a.asset}</td>
                {cols.map((c) => {
                  let color: string | undefined = 'var(--muted)';
                  if (c.key === 'pf') color = pfColor(a.pf);
                  else if (c.key === 'cagr') color = cagrColor(cagrCalc(Number(a.net), Number(a.maxDd), r.spanMonths));
                  const bold = c.key === 'pf' || c.key === 'cagr';
                  return <td key={c.key} style={{ ...(c.num ? NUM : TD), fontSize: 11.5, ...(color ? { color } : {}), ...(bold ? { fontWeight: 700 } : {}) }}>{childCell(c.key, a, r.spanMonths, r.netUnit ?? undefined)}</td>;
                })}
                <td style={TD} />
                {fwdOn && <><td style={{ ...TD, borderLeft: '2px solid var(--line)' }} /><td style={TD} /><td style={TD} /></>}
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
