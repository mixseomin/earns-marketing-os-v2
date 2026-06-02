'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';

interface Opp {
  base: string; pair: string;
  buyEx: string; buyPrice: number;
  sellEx: string; sellPrice: number;
  grossPct: number; netPct: number;
  grossProfit: number; netProfit: number;
}
interface Data {
  opportunities: Opp[];
  exchanges: Array<{ id: string; label: string; ok: boolean; coins: number }>;
  notional: number; netPositive: number; updatedAt: number;
}

const POLL_MS = 15_000;
const ok = 'var(--ok)';
const bad = 'var(--neon-red)';
const muted = 'var(--fg-2, #7c879b)';

function price(n: number): string {
  if (n >= 100) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}
function pct(n: number): string {
  return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%';
}
function money(n: number): string {
  const a = Math.abs(n);
  const s = a >= 10 ? a.toFixed(0) : a.toFixed(2);
  return (n >= 0 ? '' : '−') + '$' + s;
}

export function ArbScanner() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [view, setView] = useState<'net' | 'gross'>('net');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scanner', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setErr(false);
    } catch { setErr(true); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Persisted coin selection (empty = auto / top spreads)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('arb-scanner-coins');
      if (raw) setSelected(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, []);
  const persist = (s: Set<string>) => {
    try {
      if (s.size) localStorage.setItem('arb-scanner-coins', JSON.stringify([...s]));
      else localStorage.removeItem('arb-scanner-coins');
    } catch { /* ignore */ }
  };
  const toggleCoin = useCallback((c: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      persist(next);
      return next;
    });
  }, []);
  const clearSel = useCallback(() => { setSelected(new Set()); persist(new Set()); }, []);

  const all = data?.opportunities ?? [];
  const custom = selected.size > 0;
  // Auto = top 12 by gross spread; custom = exactly the picked coins (any spread), gross-desc.
  const rows = custom
    ? all.filter((o) => selected.has(o.base))
    : all.filter((o) => o.grossPct > 0).slice(0, 12);
  const coinChips = [...new Set(all.map((o) => o.base))].sort();
  const liveEx = data?.exchanges.filter((e) => e.ok) ?? [];

  const chip = (active: boolean): CSSProperties => ({
    appearance: 'none', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border, #1b2230)'}`,
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--accent)' : muted,
    borderRadius: 999, padding: '2px 9px', fontSize: 10.5,
    fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
  });

  return (
    <section
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border, #1b2230)',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 18,
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 0 0 1px rgba(0,0,0,.2), 0 8px 28px rgba(0,0,0,.25)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: ok,
            boxShadow: `0 0 8px ${ok}`, animation: 'arbpulse 1.6s ease-in-out infinite',
          }} />
          <span style={{ letterSpacing: '.14em', fontSize: 12, textTransform: 'uppercase', color: 'var(--fg-1)' }}>
            Live Arbitrage Scanner
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* NET / GROSS toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border, #1b2230)', borderRadius: 8, overflow: 'hidden' }}>
            {(['net', 'gross'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  appearance: 'none', cursor: 'pointer', border: 'none',
                  padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 10,
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  background: view === v ? 'var(--accent-soft)' : 'transparent',
                  color: view === v ? 'var(--accent)' : muted,
                }}
                title={v === 'net' ? 'Profit after taker fees (the honest number)' : 'Gross spread before any fees (the hype number)'}
              >
                {v === 'net' ? 'Net' : 'Gross'}
              </button>
            ))}
          </div>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 999,
            border: `1px solid var(--border, #1b2230)`, color: ok,
          }}>
            {rows.length} {custom ? 'selected' : 'opportunities'}
          </span>
        </div>
      </div>

      {/* Coin picker — empty selection = auto (top spreads) */}
      {coinChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          <button onClick={clearSel} style={chip(!custom)} title="Auto: show the highest-spread pairs">★ Top spreads</button>
          <span style={{ width: 1, height: 16, background: 'var(--border, #1b2230)', margin: '0 2px' }} />
          {coinChips.map((c) => (
            <button key={c} onClick={() => toggleCoin(c)} style={chip(selected.has(c))}
              title={selected.has(c) ? `Remove ${c}` : `Pin ${c} to the table`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ color: muted, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Pair</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Buy at</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Sell at</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Spread</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>
                Profit /${data?.notional?.toLocaleString('en-US') ?? '1,000'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const profit = view === 'gross' ? o.grossProfit : o.netProfit;
              const profitColor = view === 'gross' ? ok : (profit > 0 ? ok : bad);
              return (
                <tr key={o.base} style={{ borderTop: '1px solid var(--border, #161c28)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 700, fontSize: 14, color: 'var(--fg-1)' }}>{o.base}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ color: muted, fontSize: 11 }}>{o.buyEx}</div>
                    <div style={{ color: 'var(--fg-1)', fontSize: 13 }}>{price(o.buyPrice)}</div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ color: muted, fontSize: 11 }}>{o.sellEx}</div>
                    <div style={{ color: 'var(--fg-1)', fontSize: 13 }}>{price(o.sellPrice)}</div>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: ok, fontWeight: 600, fontSize: 13 }}>
                    {pct(o.grossPct)}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: profitColor, fontWeight: 600, fontSize: 13 }}>
                    {profit > 0 ? '↗ ' : ''}{money(profit)}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={5} style={{ padding: '18px 8px', textAlign: 'center', color: muted, fontSize: 12 }}>
                {err ? 'Scanner offline — retrying…' : data ? (custom ? 'No live spread for the selected pairs.' : 'No positive spreads right now.') : 'Scanning exchanges…'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Honest footnote */}
      <div style={{ marginTop: 12, fontSize: 10.5, color: muted, lineHeight: 1.6 }}>
        <div>
          <b style={{ color: 'var(--fg-1)' }}>Spread</b> = gross (before fees).{' '}
          <b style={{ color: 'var(--fg-1)' }}>Profit</b> = {view === 'gross' ? 'gross on' : 'net of taker fees on'} a $
          {data?.notional?.toLocaleString('en-US') ?? '1,000'} trade
          {view === 'net' ? ' (still excludes withdrawal + network + slippage).' : ' — the number competitors flash. Flip to Net.'}
        </div>
        <div style={{ marginTop: 3 }}>
          Across {liveEx.length} venues: {liveEx.map((e) => e.label).join(', ') || '—'}.{' '}
          {data ? <>{data.netPositive} of {rows.length} survive taker fees.</> : null}
        </div>
      </div>

      <style>{`@keyframes arbpulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
    </section>
  );
}
