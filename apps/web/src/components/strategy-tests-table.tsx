'use client';

import { Fragment, useMemo, useState } from 'react';
import type { StrategyTestRow, StrategyAssetRow, StrategyForwardRow, StrategyTradeRow } from '@/lib/data';

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
const GROUP_COLOR: Record<GroupKey, string> = { setup: '#00e5ff', sample: '#b18cff', perf: '#5ac882', robust: '#ff9f43' };
const FWD_BAND_COLOR = '#ffd166';

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
// The EA/bot push forward rows under per-sleeve names; roll them up into the verified-edge row they belong to,
// so an edge's Live columns aggregate all its sleeves instead of showing '—' on a name that never matches.
const FWD_EDGE_ALIAS: Record<string, string> = {
  'IBS mean-reversion': 'Index-MR portfolio',
  'Connors RSI-2': 'Index-MR portfolio',
  'Connors RSI-2 (<5)': 'Index-MR portfolio',
  '5-day-low reversal': 'Index-MR portfolio',
  'Double-7 low': 'Index-MR portfolio',
  '3-down-days': 'Index-MR portfolio',
  'FX NY-close reversion': 'FX NY-close reversion basket',
  'FX London-breakout': 'FX London-breakout trend basket',
};
// re-key the per-sleeve forward map onto edge-row names (sleeves merge; non-aliased names pass through unchanged).
function resolveForward(fbs: Record<string, StrategyForwardRow[]>): Record<string, StrategyForwardRow[]> {
  const out: Record<string, StrategyForwardRow[]> = {};
  for (const [name, list] of Object.entries(fbs)) {
    const target = FWD_EDGE_ALIAS[name] ?? name;
    (out[target] ||= []).push(...list);
  }
  return out;
}
function resolveTrades(tbs: Record<string, StrategyTradeRow[]>): Record<string, StrategyTradeRow[]> {
  const out: Record<string, StrategyTradeRow[]> = {};
  for (const [name, list] of Object.entries(tbs)) {
    const target = FWD_EDGE_ALIAS[name] ?? name;
    (out[target] ||= []).push(...list);
  }
  return out;
}
// derive rich perf metrics from per-trade rows (closed trades only; maxDD on the cumulative-profit curve by exit time).
function tradeMetrics(list: StrategyTradeRow[] | undefined) {
  if (!list || !list.length) return null;
  const open = list.filter((t) => t.isOpen).length;
  const closed = list.filter((t) => !t.isOpen && t.profit != null);
  if (!closed.length) return { n: 0, open, winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, pf: 0, maxDD: 0, net: 0, largestWin: 0, largestLoss: 0, avgHold: null as number | null };
  const profits = closed.map((t) => Number(t.profit));
  const wins = profits.filter((p) => p > 0), losses = profits.filter((p) => p <= 0);
  const gw = wins.reduce((a, b) => a + b, 0), gl = -losses.reduce((a, b) => a + b, 0);
  const net = profits.reduce((a, b) => a + b, 0);
  const ordered = [...closed].sort((a, b) => (a.exitTime ?? '').localeCompare(b.exitTime ?? ''));
  let cum = 0, peak = 0, maxDD = 0;
  for (const t of ordered) { cum += Number(t.profit); peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum); }
  const holds = closed.filter((t) => t.entryTime && t.exitTime).map((t) => (Date.parse(t.exitTime as string) - Date.parse(t.entryTime as string)) / 3.6e6);
  return {
    n: closed.length, open,
    winRate: (100 * wins.length) / closed.length,
    avgWin: wins.length ? gw / wins.length : 0,
    avgLoss: losses.length ? gl / losses.length : 0,
    expectancy: net / closed.length,
    pf: gl > 0 ? gw / gl : (gw > 0 ? 999 : 0),
    maxDD, net,
    largestWin: wins.length ? Math.max(...wins) : 0,
    largestLoss: losses.length ? Math.min(...losses) : 0,
    avgHold: holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : null,
  };
}
const f2 = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
const fmtDT = (s: string | null) => { if (!s) return '—'; const d = new Date(s); const p = (x: number) => String(x).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const holdH = (a: string | null, b: string | null) => (a && b ? (Date.parse(b) - Date.parse(a)) / 3.6e6 : null);
function Metric({ label, v, color }: { label: string; v: string | number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 64 }}>
      <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color ?? 'var(--fg)' }}>{v}</span>
    </span>
  );
}
function MetricGroup({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 12px', borderRadius: 8, background: `${color}14`, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>{children}</div>
    </div>
  );
}
// detail table of the actual live orders (per-trade), newest first
function TradesList({ trades }: { trades: StrategyTradeRow[] }) {
  const cell: React.CSSProperties = { padding: '2px 8px', whiteSpace: 'nowrap' };
  const sorted = [...trades].sort((a, b) => (b.entryTime ?? '').localeCompare(a.entryTime ?? ''));
  const show = sorted.slice(0, 60);
  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Live orders ({trades.length})</div>
      <table style={{ borderCollapse: 'collapse', fontSize: 10.5, width: '100%' }}>
        <thead><tr style={{ color: 'var(--muted)' }}>
          {['Symbol', 'Dir', 'Entry', 'In px', 'Exit', 'Out px', 'Hold', 'P&L', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {show.map((t, i) => {
            const h = holdH(t.entryTime, t.exitTime); const p = t.profit == null ? null : Number(t.profit);
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(127,140,160,0.08)' }}>
                <td style={cell}>{t.symbol}</td>
                <td style={{ ...cell, color: t.dir === 'BUY' ? 'var(--ok,#5ac882)' : '#ff5470', fontWeight: 700 }}>{t.dir}</td>
                <td style={cell}>{fmtDT(t.entryTime)}</td>
                <td style={cell}>{t.entryPrice ?? '—'}</td>
                <td style={cell}>{t.isOpen ? <span style={{ color: 'var(--ok,#5ac882)' }}>open</span> : fmtDT(t.exitTime)}</td>
                <td style={cell}>{t.isOpen ? '—' : (t.exitPrice ?? '—')}</td>
                <td style={cell}>{h != null ? `${h.toFixed(1)}h` : '—'}</td>
                <td style={{ ...cell, fontWeight: 700, color: p == null ? 'var(--muted)' : (p >= 0 ? 'var(--ok,#5ac882)' : '#ff5470') }}>{p == null ? '—' : f2(p)}</td>
                <td style={cell}>{t.isOpen ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(90,200,130,0.15)', color: 'var(--ok,#5ac882)' }}>LIVE</span> : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {trades.length > 60 ? <div style={{ fontSize: 10, color: 'var(--muted)', padding: '4px 8px' }}>showing 60 of {trades.length}</div> : null}
    </div>
  );
}
// aggregate live forward rows for a strategy (may run on >1 symbol): sum trades/wins, trade-weighted PF
function fwdAgg(list: StrategyForwardRow[] | undefined): { trades: number; pf: number; status: string; symbols: number; open: number } | null {
  if (!list || !list.length) return null;
  let trades = 0, pfw = 0, open = 0; const statuses: string[] = [];
  for (const f of list) {
    const t = Number(f.trades) || 0; trades += t;
    open += Number(f.openPos) || 0;
    pfw += (Number(f.fwdPf) || 0) * t; if (f.status) statuses.push(f.status);
  }
  const status = statuses.includes('BELOW') ? 'BELOW' : statuses.includes('HOLDING') ? 'HOLDING' : (statuses[0] ?? 'warming');
  return { trades, pf: trades ? pfw / trades : 0, status, symbols: list.length, open };
}

export function StrategyTestsTable({ rows, assetsByStrategy = {}, forwardByStrategy: forwardRaw = {}, tradesByStrategy: tradesRaw = {} }: { rows: StrategyTestRow[]; assetsByStrategy?: Record<string, StrategyAssetRow[]>; forwardByStrategy?: Record<string, StrategyForwardRow[]>; tradesByStrategy?: Record<string, StrategyTradeRow[]> }) {
  const forwardByStrategy = useMemo(() => resolveForward(forwardRaw), [forwardRaw]);
  const tradesByStrategy = useMemo(() => resolveTrades(tradesRaw), [tradesRaw]);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none' | 'verdict' | 'klass'>('verdict');
  const [sortKey, setSortKey] = useState<SortKey>('pf');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showTags, setShowTags] = useState(true);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showTagFilter, setShowTagFilter] = useState(false);   // tag-chip filter row collapsed by default (saves a row)
  const [visGroups, setVisGroups] = useState<Record<GroupKey, boolean>>({ setup: true, sample: true, perf: true, robust: false });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const showTip = (text: string, e: React.MouseEvent) => { if (text) setTip({ x: e.clientX, y: e.clientY, text }); };
  const hideTip = () => setTip(null);
  const hasForward = Object.keys(forwardByStrategy).length > 0;
  const [showForward, setShowForward] = useState(true);
  const fwdOn = showForward; // forward columns visible (toggle); shows '—' until live data flows

  const cols = COLUMNS.filter((c) => visGroups[c.group]);
  const colSpan = cols.length + 2 + (fwdOn ? 4 : 0);

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
      {/* row 1: search + summary pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strategy, asset, notes…" autoComplete="off"
          style={{ flex: '1 1 220px', minWidth: 170, padding: '7px 11px', fontSize: 12.5, background: 'var(--panel,#0e1420)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }} />
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{rows.length} tested</span>
        {VERDICT_ORDER.filter((v) => counts[v]).map((v) => (
          <span key={v} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 11, color: '#fff', background: VERDICT_COLOR[v] }}>{counts[v]} {v}</span>
        ))}
      </div>

      {/* row 2: all toggles (group · columns · forward · tags) on one line */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Group</span>
        {(['verdict', 'klass', 'none'] as const).map((g) => (
          <button key={g} type="button" onClick={() => setGroupBy(g)} style={{ ...chip(groupBy === g), fontSize: 10.5 }}>{g === 'klass' ? 'class' : g}</button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 4px' }} />
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cols</span>
        {GROUPS.map((g) => (
          <button key={g.key} type="button" onClick={() => setVisGroups((p) => ({ ...p, [g.key]: !p[g.key] }))}
            style={{ ...chip(visGroups[g.key]), fontSize: 10.5, ...(visGroups[g.key] ? { background: GROUP_COLOR[g.key], color: '#001018' } : { color: GROUP_COLOR[g.key], borderColor: `${GROUP_COLOR[g.key]}55` }) }}>{g.label}</button>
        ))}
        <button type="button" onClick={() => setShowForward((v) => !v)} title="Live forward-test results (StrategyLab demo)" style={{ ...chip(fwdOn), fontSize: 10.5, ...(fwdOn ? { background: FWD_BAND_COLOR, color: '#001018' } : { color: FWD_BAND_COLOR, borderColor: `${FWD_BAND_COLOR}55` }) }}>📡 Forward{hasForward ? '' : ' (no data)'}</button>
        <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 4px' }} />
        <button type="button" onClick={() => setShowTagFilter((v) => !v)} style={{ ...chip(showTagFilter || activeTags.length > 0), fontSize: 10.5 }}>🏷 Filter{activeTags.length ? ` (${activeTags.length})` : ''}</button>
        <button type="button" onClick={() => setShowTags((v) => !v)} title="Show tag pills under each strategy name" style={{ ...chip(false), fontSize: 10.5, color: showTags ? 'var(--fg)' : 'var(--muted)' }}>{showTags ? 'row-tags ✓' : 'row-tags'}</button>
      </div>

      {/* tag chips (collapsed by default) */}
      {showTagFilter && (
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
      )}

      <div style={{ overflow: 'auto', maxHeight: '72vh', border: '1px solid var(--line)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: 'auto', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ background: 'var(--panel,#0e1420)', borderBottom: '1px solid var(--line)' }} />
              {GROUPS.filter((g) => visGroups[g.key]).map((g) => {
                const n = cols.filter((c) => c.group === g.key).length;
                if (!n) return null;
                const col = GROUP_COLOR[g.key];
                return <th key={g.key} colSpan={n} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: col, background: `${col}1c`, borderBottom: `2px solid ${col}`, padding: '3px 6px' }}>{g.label}</th>;
              })}
              <th style={{ background: 'var(--panel,#0e1420)', borderBottom: '1px solid var(--line)' }} />
              {fwdOn && <th colSpan={4} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: FWD_BAND_COLOR, background: `${FWD_BAND_COLOR}1c`, borderBottom: `2px solid ${FWD_BAND_COLOR}`, borderLeft: '2px solid var(--line)', padding: '3px 6px' }}>📡 Forward (live)</th>}
            </tr>
            <tr>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => toggleSort('name')}>Strategy{caret('name')}</th>
              {cols.map((c) => (
                <th key={c.key} title={c.title} style={{ ...TH, textAlign: c.num ? 'right' : 'left', background: `${GROUP_COLOR[c.group]}14`, ...(c.sort ? { cursor: 'pointer', userSelect: 'none' } : {}) }}
                  onClick={c.sort ? () => toggleSort(c.sort!) : undefined}>{c.label}{c.sort ? caret(c.sort) : ''}</th>
              ))}
              <th style={TH}>Verdict</th>
              {fwdOn && <th style={{ ...TH, textAlign: 'left', borderLeft: '2px solid var(--line)', background: `${FWD_BAND_COLOR}14` }} title="Live status: warming / HOLDING (live PF ≥ backtest base) / BELOW">📡 Live</th>}
              {fwdOn && <th style={{ ...TH, textAlign: 'right', background: `${FWD_BAND_COLOR}14` }} title="Live forward trades since forward start">Live N</th>}
              {fwdOn && <th style={{ ...TH, textAlign: 'right', background: `${FWD_BAND_COLOR}14` }} title="Live forward profit factor (demo) — compare to backtest PF">Live PF</th>}
              {fwdOn && <th style={{ ...TH, textAlign: 'right', background: `${FWD_BAND_COLOR}14` }} title="Open positions right now (live demo)">Open</th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupBlock key={g.key || 'all'} g={g} groupBy={groupBy} showTags={showTags} cols={cols} colSpan={colSpan} assetsByStrategy={assetsByStrategy} forwardByStrategy={forwardByStrategy} tradesByStrategy={tradesByStrategy} fwdOn={fwdOn} expanded={expanded} toggleExpand={toggleExpand} onTip={showTip} onTipEnd={hideTip} TD={TD} NUM={NUM} />
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
        <>
          <div onClick={hideTip} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'fixed', left: Math.min(tip.x, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 480), top: Math.min(tip.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200), zIndex: 9999, width: 460, maxWidth: '92vw', maxHeight: '72vh', overflowY: 'auto', padding: '14px 16px 16px', background: '#0b1018', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 16px 44px rgba(0,0,0,.6)', fontSize: 12.5, lineHeight: 1.65, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>
            <button type="button" onClick={hideTip} style={{ position: 'sticky', top: 0, float: 'right', cursor: 'pointer', background: 'var(--panel,#0e1420)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--muted)', fontSize: 13, lineHeight: '18px', padding: '0 7px' }}>✕</button>
            {tip.text}
          </div>
        </>
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

function GroupBlock({ g, groupBy, showTags, cols, colSpan, assetsByStrategy, forwardByStrategy, tradesByStrategy, fwdOn, expanded, toggleExpand, onTip, onTipEnd, TD, NUM }: {
  g: { key: string; rows: StrategyTestRow[] }; groupBy: 'none' | 'verdict' | 'klass'; showTags: boolean;
  cols: Col[]; colSpan: number; assetsByStrategy: Record<string, StrategyAssetRow[]>; forwardByStrategy: Record<string, StrategyForwardRow[]>; tradesByStrategy: Record<string, StrategyTradeRow[]>; fwdOn: boolean; expanded: Set<number>; toggleExpand: (id: number) => void;
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
        const trades = tradesByStrategy[r.name] ?? [];
        const tm = tradeMetrics(trades);
        const canExpand = kids.length > 0 || !!tm;
        const isOpen = expanded.has(r.id);
        return (
          <Fragment key={r.id}>
            <tr>
              <td style={TD}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  {!assetColVisible && canExpand ? (
                    <button type="button" onClick={() => toggleExpand(r.id)} title={kids.length > 0 ? `${kids.length} per-asset results` : 'live trade metrics'}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--accent,#00e5ff)', fontSize: 11, padding: 0, lineHeight: 1, width: 10 }}>{isOpen ? '▾' : '▸'}</button>
                  ) : null}
                  <span>
                    <span style={{ fontWeight: 600 }}>
                      {r.sourceUrl
                        ? <a href={wrap(r.sourceUrl)} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--fg)', textDecoration: 'none' }}>{r.name} <span style={{ color: 'var(--accent,#00e5ff)', fontSize: 10 }}>↗</span></a>
                        : r.name}
                      {r.notes ? <button type="button" onClick={(e) => onTip(r.notes ?? '', e)} title="Read the strategy notes / methodology"
                        style={{ marginLeft: 6, cursor: 'pointer', background: 'rgba(127,140,160,0.12)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--muted)', fontSize: 9.5, lineHeight: '14px', padding: '0 5px', verticalAlign: 'middle' }}>📄 notes</button> : null}
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
                const cellBg = `${GROUP_COLOR[c.group]}0a`;
                if (c.key === 'asset' && kids.length > 0) {
                  return (
                    <td key={c.key} style={{ ...TD, background: cellBg }}>
                      <span onClick={() => toggleExpand(r.id)} title={`${kids.length} per-asset results`}
                        style={{ cursor: 'pointer', color: 'var(--accent,#00e5ff)', borderBottom: '1px dotted', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {dash(r.asset)} <span style={{ fontSize: 9 }}>{isOpen ? '▾' : '▸'}</span>
                        <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{kids.length}</span>
                      </span>
                    </td>
                  );
                }
                const col = c.color ? c.color(r) : undefined;
                return <td key={c.key} style={{ ...(c.num ? NUM : TD), background: cellBg, ...(col ? { color: col } : {}), ...(c.bold ? { fontWeight: 700 } : {}) }}>{c.render(r)}</td>;
              })}
              <td style={TD}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff', background: VERDICT_COLOR[r.verdict ?? ''] ?? '#7a8699' }}>{dash(r.verdict)}</span>
              </td>
              {fwdOn && (() => {
                const fb = `${FWD_BAND_COLOR}0a`;
                const fw = fwdAgg(forwardByStrategy[r.name]);
                if (!fw) return (<><td style={{ ...TD, borderLeft: '2px solid var(--line)', background: fb, color: 'var(--muted)' }}>—</td><td style={{ ...NUM, background: fb }}>—</td><td style={{ ...NUM, background: fb }}>—</td><td style={{ ...NUM, background: fb }}>—</td></>);
                return (<>
                  <td style={{ ...TD, borderLeft: '2px solid var(--line)', background: fb }}><span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 9, color: '#001018', background: FWD_COLOR[fw.status] ?? '#7a8699' }}>{fw.status}</span>{fw.symbols > 1 ? <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>×{fw.symbols}</span> : null}</td>
                  <td style={{ ...NUM, background: fb }}>{fw.trades || '—'}</td>
                  <td style={{ ...NUM, background: fb, fontWeight: 700, color: fw.trades ? pfColor(String(fw.pf)) : 'var(--muted)' }}>{fw.trades ? fw.pf.toFixed(2) : '—'}</td>
                  <td style={{ ...NUM, background: fb, fontWeight: 700, color: fw.open > 0 ? 'var(--ok, #5ac882)' : 'var(--muted)' }}>{fw.open > 0 ? fw.open : '—'}</td>
                </>);
              })()}
            </tr>
            {isOpen && tm && (
              <tr style={{ background: 'rgba(0,229,255,0.04)' }}>
                <td colSpan={colSpan} style={{ padding: '9px 28px' }}>
                  {tm.n > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
                        <MetricGroup title="Outcome" color="#00e5ff">
                          <Metric label="Closed" v={tm.n} />
                          <Metric label="Open" v={tm.open || '—'} color={tm.open ? '#5ac882' : undefined} />
                          <Metric label="Win rate" v={`${tm.winRate.toFixed(0)}%`} />
                          <Metric label="Net" v={f2(tm.net)} color={tm.net >= 0 ? '#5ac882' : '#ff5470'} />
                        </MetricGroup>
                        <MetricGroup title="Trade quality" color="#5ac882">
                          <Metric label="Avg win" v={f2(tm.avgWin)} color="#5ac882" />
                          <Metric label="Avg loss" v={`-${f2(tm.avgLoss)}`} color="#ff5470" />
                          <Metric label="Expectancy" v={f2(tm.expectancy)} color={tm.expectancy >= 0 ? '#5ac882' : '#ff5470'} />
                          <Metric label="Largest win" v={f2(tm.largestWin)} />
                          <Metric label="Largest loss" v={f2(tm.largestLoss)} />
                        </MetricGroup>
                        <MetricGroup title="Risk / timing" color="#ff9f43">
                          <Metric label="Live PF" v={tm.pf >= 999 ? '∞' : tm.pf.toFixed(2)} color={pfColor(String(tm.pf))} />
                          <Metric label="Max DD" v={f2(tm.maxDD)} color="#ff9f43" />
                          <Metric label="Avg hold" v={tm.avgHold != null ? `${tm.avgHold.toFixed(1)}h` : '—'} />
                        </MetricGroup>
                      </div>
                      {trades.length > 0 ? <TradesList trades={trades} /> : null}
                    </div>
                  ) : trades.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{tm.open} open position{tm.open === 1 ? '' : 's'}, no closed trades yet — metrics appear once trades close.</span>
                      <TradesList trades={trades} />
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>No live trades yet.</span>
                  )}
                </td>
              </tr>
            )}
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
                {fwdOn && <><td style={{ ...TD, borderLeft: '2px solid var(--line)' }} /><td style={TD} /><td style={TD} /><td style={TD} /></>}
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
