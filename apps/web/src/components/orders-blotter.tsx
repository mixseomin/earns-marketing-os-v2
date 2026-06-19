'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StrategyTradeRow, StrategyTestRow, StrategyForwardRow } from '@/lib/data';

// trade/forward sleeve name -> the canonical edge row in strategy_tests (mirrors strategy-tests-table FWD_EDGE_ALIAS)
const EDGE_ALIAS: Record<string, string> = {
  'IBS mean-reversion': 'Index-MR portfolio', 'Connors RSI-2': 'Index-MR portfolio', 'Connors RSI-2 (<5)': 'Index-MR portfolio',
  '5-day-low reversal': 'Index-MR portfolio', 'Double-7 low': 'Index-MR portfolio', '3-down-days': 'Index-MR portfolio',
  'FX NY-close reversion': 'FX NY-close reversion basket', 'FX London-breakout': 'FX London-breakout trend basket',
};
const VERDICT_COLOR: Record<string, string> = { dead: '#ff5470', marginal: '#f5a623', 'gold-only': '#d4af37', edge: '#2ecc71', discretionary: '#9b8cff', queued: '#7a8699', testing: '#00b8d4' };
const FWD_STATUS_COLOR: Record<string, string> = { HOLDING: '#2ecc71', BELOW: '#ff5470', warming: '#7a8699' };
const pfColor = (v: number) => (Number.isNaN(v) ? 'var(--muted)' : v >= 1.3 ? '#2ecc71' : v >= 1.0 ? '#f5a623' : '#ff5470');
// risk-normalized CAGR at a 20% maxDD budget (same formula as the Strategy Tests table)
const cagrPct = (t: StrategyTestRow): number => {
  const net = Number(t.net), dd = Number(t.maxDd), m = t.spanMonths;
  if (!m || Number.isNaN(net) || Number.isNaN(dd) || dd <= 0 || net <= 0) return NaN;
  return (Math.pow(1 + 0.2 * net / dd, 12 / m) - 1) * 100;
};

const f2 = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
const fmtVol = (n: number) => (Math.abs(n) >= 1000 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4));
const fmtUsd = (n: number) => (Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`);
const fmtPnlUsd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : Math.abs(n).toFixed(Math.abs(n) < 10 ? 2 : 0)}`;
const fmtDT = (s: string | null) => { if (!s) return '—'; const d = new Date(s); const p = (x: number) => String(x).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const isCryptoSym = (s: string) => /USDT$/i.test(s);
const tRef = (t: StrategyTradeRow) => (t.exitTime ?? t.entryTime) ?? '';
// hold in hours. Closed: entry->exit. Open: entry->now (broker clock for MT5, real UTC for crypto). See strategy-tests-table.
const holdH = (t: StrategyTradeRow, brokerNowMs?: number | null) => {
  if (!t.entryTime) return null;
  const end = t.exitTime ? Date.parse(t.exitTime) : (t.isOpen ? (isCryptoSym(t.symbol) ? Date.now() : (brokerNowMs ?? null)) : null);
  return end == null ? null : (end - Date.parse(t.entryTime)) / 3.6e6;
};

const cell: React.CSSProperties = { padding: '4px 10px', whiteSpace: 'nowrap', fontSize: 11.5 };
const th: React.CSSProperties = { padding: '5px 10px', fontSize: 10.5, textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--panel,#0e1420)', boxShadow: 'inset 0 -1px 0 var(--line)', zIndex: 2 };

function Row({ t, brokerNowMs, showStrategy }: { t: StrategyTradeRow; brokerNowMs?: number | null; showStrategy: boolean }) {
  const h = holdH(t, brokerNowMs);
  const p = t.profit == null ? null : Number(t.profit);
  const crypto = isCryptoSym(t.symbol);
  const usd = p == null ? null : (crypto ? (t.notional != null ? p / 100 * t.notional : null) : p);   // $ converted
  const pnlColor = p == null ? 'var(--muted)' : (p >= 0 ? 'var(--ok,#5ac882)' : '#ff5470');
  return (
    <tr style={{ borderBottom: '1px solid rgba(127,140,160,0.08)', opacity: t.isOpen ? 1 : 0.55, background: t.isOpen ? 'rgba(90,200,130,0.06)' : 'transparent' }}>
      {showStrategy ? <td style={{ ...cell, fontWeight: t.isOpen ? 600 : 400 }}>{t.strategy}</td> : null}
      <td style={{ ...cell, fontWeight: t.isOpen ? 700 : 500 }}>{t.symbol}</td>
      <td style={{ ...cell, color: t.dir === 'BUY' ? 'var(--ok,#5ac882)' : '#ff5470', fontWeight: 700 }}>{t.dir}</td>
      <td style={cell}>{t.lots != null ? <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{fmtVol(t.lots)}</span>{t.notional != null ? <span style={{ color: 'var(--muted)', opacity: 0.55, fontSize: 9.5 }}>{fmtUsd(t.notional)}</span> : null}</span> : '—'}</td>
      <td style={cell}>{fmtDT(t.entryTime)}</td>
      <td style={cell}>{t.entryPrice ?? '—'}</td>
      <td style={cell}>{t.isOpen ? <span style={{ color: 'var(--ok,#5ac882)' }}>open</span> : fmtDT(t.exitTime)}</td>
      <td style={cell} title={t.isOpen ? 'live mark price' : undefined}>{t.exitPrice ?? '—'}</td>
      <td style={cell} title={isCryptoSym(t.symbol) ? 'SL = Donchian-20 trailing exit (no fixed TP, trend-following)' : 'broker SL / TP orders'}>
        {t.sl != null || t.tp != null
          ? <span><span style={{ color: '#ff8a8a' }}>{t.sl != null ? t.sl : '—'}</span><span style={{ color: 'var(--muted)' }}> / </span><span style={{ color: 'var(--ok,#5ac882)' }}>{t.tp != null ? t.tp : '—'}</span></span>
          : '—'}
      </td>
      <td style={cell}>{h != null ? `${h.toFixed(1)}h` : '—'}</td>
      <td style={{ ...cell, textAlign: 'right', color: pnlColor }} title={t.isOpen ? 'floating / unrealized P&L (native number)' : 'realized P&L (native number)'}>{p == null ? '—' : f2(p)}</td>
      <td style={{ ...cell, textAlign: 'right', color: pnlColor }} title="P&L converted to account $">{usd != null ? fmtPnlUsd(usd) : '—'}</td>
      <td style={cell}>{t.isOpen ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(90,200,130,0.15)', color: 'var(--ok,#5ac882)' }}>LIVE</span> : ''}</td>
    </tr>
  );
}

const chip = (on: boolean): React.CSSProperties => ({ fontSize: 11, padding: '3px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--accent,#00e5ff)' : 'transparent', color: on ? '#001018' : 'var(--muted)', fontWeight: 600 });

type StratMeta = { test?: StrategyTestRow; fwd?: { trades: number; pf: number; basePf: number; status: string; equity: number | null } };

function MetaPill({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: 'rgba(127,140,160,0.10)', borderRadius: 7, padding: '5px 8px', minWidth: 0 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--fg)' }}>{value}</div>
    </div>
  );
}

// hover card: strategy description + expected (backtest) metrics + live forward, anchored near the cursor (clamped to viewport)
function HoverCard({ name, meta, x, y }: { name: string; meta: StratMeta; x: number; y: number }) {
  const t = meta.test; const fwd = meta.fwd;
  const W = 340;
  const left = Math.min(x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 12);
  const top = Math.min(y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320);
  const cagr = t ? cagrPct(t) : NaN;
  return (
    <div style={{ position: 'fixed', left, top, width: W, zIndex: 100, background: 'var(--panel,#0e1420)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.55)', padding: 14, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t?.name ?? name}</span>
        {t?.verdict ? <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 9, color: '#fff', background: VERDICT_COLOR[t.verdict] ?? '#7a8699' }}>{t.verdict}</span> : null}
      </div>
      {t?.variant ? <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 6 }}>{t.variant}</div> : null}
      {t?.notes ? <div style={{ fontSize: 11, color: 'var(--fg)', opacity: 0.85, lineHeight: 1.5, marginBottom: 10 }}>{t.notes.length > 300 ? t.notes.slice(0, 300) + '…' : t.notes}</div>
        : <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>No backtest metadata linked for this strategy.</div>}
      {t ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: fwd ? 10 : 0 }}>
          <MetaPill label="Backtest PF" value={t.pf ?? '—'} color={t.pf ? pfColor(Number(t.pf)) : undefined} />
          <MetaPill label="OOS PF" value={t.oosPf ?? '—'} color={t.oosPf ? pfColor(Number(t.oosPf)) : undefined} />
          <MetaPill label="Win%" value={t.winPct ?? '—'} />
          <MetaPill label="CAGR*" value={Number.isNaN(cagr) ? '—' : `${cagr.toFixed(0)}%`} color={Number.isNaN(cagr) ? undefined : cagr >= 10 ? '#2ecc71' : '#f5a623'} />
          <MetaPill label="Max DD" value={t.maxDd != null && t.maxDd !== '' ? `${t.maxDd}${t.netUnit ? ' ' + t.netUnit : ''}` : '—'} />
          <MetaPill label="Tr/mo" value={t.trades && t.spanMonths ? (t.trades / t.spanMonths).toFixed(1) : '—'} />
        </div>
      ) : null}
      {fwd ? (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 9, color: '#001018', background: FWD_STATUS_COLOR[fwd.status] ?? '#7a8699' }}>{fwd.status}</span>
          <span style={{ color: 'var(--muted)' }}>live forward:</span>
          <span>PF <b style={{ color: pfColor(fwd.pf) }}>{fwd.trades ? fwd.pf.toFixed(2) : '—'}</b> vs base {fwd.basePf.toFixed(2)}</span>
          <span style={{ color: 'var(--muted)' }}>· {fwd.trades} trades</span>
          {fwd.equity != null ? <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>💰 ${Math.round(fwd.equity).toLocaleString()} <span style={{ color: fwd.equity >= 10000 ? '#2ecc71' : '#ff5470' }}>({((fwd.equity / 10000 - 1) * 100).toFixed(1)}%)</span></span> : null}
        </div>
      ) : null}
      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 8 }}>* CAGR risk-normalized to a 20% max-drawdown budget · PF green ≥1.3 / amber ≥1.0 / red &lt;1.0</div>
    </div>
  );
}

export function OrdersBlotter({ trades, tests = [], forward = [], brokerNowMs }: { trades: StrategyTradeRow[]; tests?: StrategyTestRow[]; forward?: StrategyForwardRow[]; brokerNowMs?: number | null }) {
  const [showAll, setShowAll] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const router = useRouter();
  useEffect(() => { const id = setInterval(() => router.refresh(), 20000); return () => clearInterval(id); }, [router]);

  // strategy (trade name) -> backtest edge row + aggregated live forward, for the hover card
  const metaByStrategy = useMemo(() => {
    const testByName: Record<string, StrategyTestRow> = {};
    tests.forEach((t) => { testByName[t.name] = t; });
    const fwdByName: Record<string, StrategyForwardRow[]> = {};
    forward.forEach((f) => { (fwdByName[f.strategy] ??= []).push(f); });
    const names = Array.from(new Set(trades.map((t) => t.strategy)));
    const m: Record<string, StratMeta> = {};
    names.forEach((name) => {
      const test = testByName[EDGE_ALIAS[name] ?? name] ?? testByName[name];
      const fl = fwdByName[name];
      let fwd: StratMeta['fwd'];
      if (fl && fl.length) {
        const tr = fl.reduce((a, f) => a + (f.trades ?? 0), 0);
        const pf = tr > 0 ? fl.reduce((a, f) => a + Number(f.fwdPf ?? 0) * (f.trades ?? 0), 0) / tr : 0;
        fwd = { trades: tr, pf, basePf: Number(fl[0]?.basePf ?? 0), status: fl.find((f) => f.status)?.status ?? 'warming', equity: fl.find((f) => f.equity != null)?.equity ?? null };
      }
      m[name] = { test, fwd };
    });
    return m;
  }, [trades, tests, forward]);

  // scope: every open position + closed within 24h of the latest activity (relative -> tz-safe). "Show all" reveals older closed.
  const visible = useMemo(() => {
    const times = trades.map((t) => Date.parse(tRef(t))).filter((n) => !Number.isNaN(n));
    const cutoff = (times.length ? Math.max(...times) : 0) - 24 * 3.6e6;
    return trades.filter((t) => { if (t.isOpen || showAll) return true; const r = Date.parse(tRef(t)); return Number.isNaN(r) || r >= cutoff; });
  }, [trades, showAll]);

  const openN = visible.filter((t) => t.isOpen).length;
  const closedRows = visible.filter((t) => !t.isOpen && t.profit != null);
  const closedN = closedRows.length;
  const netClosed = closedRows.reduce((a, t) => a + Number(t.profit), 0);
  const hiddenN = trades.filter((t) => !t.isOpen).length - trades.filter((t) => !t.isOpen && (showAll || (() => { const r = Date.parse(tRef(t)); return Number.isNaN(r) || r >= ((() => { const ts = trades.map((x) => Date.parse(tRef(x))).filter((n) => !Number.isNaN(n)); return (ts.length ? Math.max(...ts) : 0) - 24 * 3.6e6; })()); })())).length;

  const sortRows = (rows: StrategyTradeRow[]) => [...rows].sort((a, b) => (Number(b.isOpen) - Number(a.isOpen)) || tRef(b).localeCompare(tRef(a)));

  // group by strategy: strategies with open positions first, then by name
  const groups = useMemo(() => {
    const m: Record<string, StrategyTradeRow[]> = {};
    visible.forEach((t) => { (m[t.strategy] ??= []).push(t); });
    return Object.entries(m)
      .map(([name, rows]) => ({ name, rows: sortRows(rows), open: rows.filter((r) => r.isOpen).length, net: rows.filter((r) => !r.isOpen && r.profit != null).reduce((a, r) => a + Number(r.profit), 0) }))
      .sort((a, b) => (Number(b.open > 0) - Number(a.open > 0)) || a.name.localeCompare(b.name));
  }, [visible]);

  const HEADERS = grouped ? ['Symbol', 'Dir', 'Lots', 'Entry', 'In px', 'Exit', 'Out px', 'SL/TP', 'Hold', 'P&L', '$', ''] : ['Strategy', 'Symbol', 'Dir', 'Lots', 'Entry', 'In px', 'Exit', 'Out px', 'SL/TP', 'Hold', 'P&L', '$', ''];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5 }}>
          <b style={{ color: 'var(--ok,#5ac882)' }}>{openN}</b> open · <b>{closedN}</b> closed{showAll ? '' : ' (24h)'} · net <b style={{ color: netClosed >= 0 ? 'var(--ok,#5ac882)' : '#ff5470' }}>{f2(netClosed)}</b>
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setGrouped((v) => !v)} style={chip(grouped)}>{grouped ? '▣ Grouped' : '☰ Flat'}</button>
        <button type="button" onClick={() => setShowAll((v) => !v)} style={chip(showAll)}>{showAll ? 'All' : 'Last 24h'}{!showAll && hiddenN > 0 ? ` (+${hiddenN})` : ''}</button>
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>🟢 auto 20s</span>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '76vh', border: '1px solid var(--line)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: grouped ? 520 : 640 }}>
          <thead><tr>{HEADERS.map((h) => <th key={h} style={{ ...th, textAlign: h === 'P&L' || h === '$' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {grouped
              ? groups.map((g) => (
                <Fragment key={g.name}>
                  <tr style={{ background: 'rgba(0,229,255,0.06)' }}>
                    <td colSpan={HEADERS.length}
                      onMouseEnter={(e) => setHover({ name: g.name, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setHover((h) => (h && h.name === g.name ? { ...h, x: e.clientX, y: e.clientY } : h))}
                      onMouseLeave={() => setHover((h) => (h && h.name === g.name ? null : h))}
                      style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700, borderBottom: '1px solid var(--line)', borderTop: '1px solid var(--line)', cursor: 'help' }}>
                      {g.name}
                      <span style={{ marginLeft: 5, fontSize: 9.5, color: 'var(--accent,#00e5ff)', opacity: 0.7 }}>ⓘ</span>
                      {g.open > 0 ? <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--ok,#5ac882)' }}>{g.open} open</span> : null}
                      <span style={{ marginLeft: 8, fontSize: 10, color: g.net >= 0 ? 'var(--ok,#5ac882)' : '#ff5470' }}>net {f2(g.net)}</span>
                      {metaByStrategy[g.name]?.fwd?.equity != null ? <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--muted)' }}>💰 ${Math.round(metaByStrategy[g.name]!.fwd!.equity!).toLocaleString()} <span style={{ color: (metaByStrategy[g.name]!.fwd!.equity! >= 10000 ? 'var(--ok,#5ac882)' : '#ff5470') }}>({((metaByStrategy[g.name]!.fwd!.equity! / 10000 - 1) * 100).toFixed(1)}%)</span></span> : null}
                    </td>
                  </tr>
                  {g.rows.map((t) => <Row key={String(t.entryTime) + t.symbol + String(t.exitTime)} t={t} brokerNowMs={brokerNowMs} showStrategy={false} />)}
                </Fragment>
              ))
              : sortRows(visible).map((t) => <Row key={t.strategy + String(t.entryTime) + t.symbol + String(t.exitTime)} t={t} brokerNowMs={brokerNowMs} showStrategy />)}
            {visible.length === 0 && <tr><td colSpan={HEADERS.length} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 28 }}>No orders.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8 }}>Open positions on top (highlighted, <i>italic *</i> P&amp;L = floating); closed dimmed. P&amp;L unit: crypto = %, MT5 = account currency. Hold counts to now for open positions. {grouped ? 'Hover a strategy header for its description & expected metrics.' : ''}</p>
      {(() => { const hm = hover ? metaByStrategy[hover.name] : undefined; return hover && hm ? <HoverCard name={hover.name} meta={hm} x={hover.x} y={hover.y} /> : null; })()}
    </div>
  );
}
