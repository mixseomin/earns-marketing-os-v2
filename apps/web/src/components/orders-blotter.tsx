'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StrategyTradeRow } from '@/lib/data';

const f2 = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
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
  return (
    <tr style={{ borderBottom: '1px solid rgba(127,140,160,0.08)', opacity: t.isOpen ? 1 : 0.55, background: t.isOpen ? 'rgba(90,200,130,0.06)' : 'transparent' }}>
      {showStrategy ? <td style={{ ...cell, fontWeight: t.isOpen ? 600 : 400 }}>{t.strategy}</td> : null}
      <td style={{ ...cell, fontWeight: t.isOpen ? 700 : 500 }}>{t.symbol}</td>
      <td style={{ ...cell, color: t.dir === 'BUY' ? 'var(--ok,#5ac882)' : '#ff5470', fontWeight: 700 }}>{t.dir}</td>
      <td style={cell}>{fmtDT(t.entryTime)}</td>
      <td style={cell}>{t.entryPrice ?? '—'}</td>
      <td style={cell}>{t.isOpen ? <span style={{ color: 'var(--ok,#5ac882)' }}>open</span> : fmtDT(t.exitTime)}</td>
      <td style={cell} title={t.isOpen ? 'live mark price' : undefined}>{t.exitPrice ?? '—'}</td>
      <td style={cell}>{h != null ? `${h.toFixed(1)}h` : '—'}</td>
      <td style={{ ...cell, fontWeight: 700, fontStyle: t.isOpen ? 'italic' : 'normal', color: p == null ? 'var(--muted)' : (p >= 0 ? 'var(--ok,#5ac882)' : '#ff5470') }} title={t.isOpen ? 'floating / unrealized P&L' : undefined}>{p == null ? '—' : (t.isOpen ? `${f2(p)}*` : f2(p))}</td>
      <td style={cell}>{t.isOpen ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(90,200,130,0.15)', color: 'var(--ok,#5ac882)' }}>LIVE</span> : ''}</td>
    </tr>
  );
}

const chip = (on: boolean): React.CSSProperties => ({ fontSize: 11, padding: '3px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--accent,#00e5ff)' : 'transparent', color: on ? '#001018' : 'var(--muted)', fontWeight: 600 });

export function OrdersBlotter({ trades, brokerNowMs }: { trades: StrategyTradeRow[]; brokerNowMs?: number | null }) {
  const [showAll, setShowAll] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const router = useRouter();
  useEffect(() => { const id = setInterval(() => router.refresh(), 60000); return () => clearInterval(id); }, [router]);

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

  const HEADERS = grouped ? ['Symbol', 'Dir', 'Entry', 'In px', 'Exit', 'Out px', 'Hold', 'P&L', ''] : ['Strategy', 'Symbol', 'Dir', 'Entry', 'In px', 'Exit', 'Out px', 'Hold', 'P&L', ''];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5 }}>
          <b style={{ color: 'var(--ok,#5ac882)' }}>{openN}</b> open · <b>{closedN}</b> closed{showAll ? '' : ' (24h)'} · net <b style={{ color: netClosed >= 0 ? 'var(--ok,#5ac882)' : '#ff5470' }}>{f2(netClosed)}</b>
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setGrouped((v) => !v)} style={chip(grouped)}>{grouped ? '▣ Grouped' : '☰ Flat'}</button>
        <button type="button" onClick={() => setShowAll((v) => !v)} style={chip(showAll)}>{showAll ? 'All' : 'Last 24h'}{!showAll && hiddenN > 0 ? ` (+${hiddenN})` : ''}</button>
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>🟢 auto 60s</span>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '76vh', border: '1px solid var(--line)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: grouped ? 520 : 640 }}>
          <thead><tr>{HEADERS.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {grouped
              ? groups.map((g) => (
                <Fragment key={g.name}>
                  <tr style={{ background: 'rgba(0,229,255,0.06)' }}>
                    <td colSpan={HEADERS.length} style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700, borderBottom: '1px solid var(--line)', borderTop: '1px solid var(--line)' }}>
                      {g.name}
                      {g.open > 0 ? <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--ok,#5ac882)' }}>{g.open} open</span> : null}
                      <span style={{ marginLeft: 8, fontSize: 10, color: g.net >= 0 ? 'var(--ok,#5ac882)' : '#ff5470' }}>net {f2(g.net)}</span>
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
      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8 }}>Open positions on top (highlighted, <i>italic *</i> P&amp;L = floating); closed dimmed. P&amp;L unit: crypto = %, MT5 = account currency. Hold counts to now for open positions.</p>
    </div>
  );
}
