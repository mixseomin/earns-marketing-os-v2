// Live crypto arbitrage scanner — server-side market data.
//
// Pulls best bid/ask for a curated set of liquid USDT pairs from several CEXes
// (single "all tickers" call each), then computes cross-exchange spreads.
//
// Brand angle: we report GROSS spread (the headline number every competitor
// shows) AND NET after taker fees (the number that actually lands in your
// pocket). On liquid majors the net is almost always ~0 or negative — that is
// the whole point of an honest scanner.
//
// Note: Binance + Bybit geo-block the Hetzner server IP (451 / 403). We reach
// Binance via its public data mirror (data-api.binance.vision); Bybit is
// dropped for now. Quote is USDT across all venues = apples-to-apples.

const QUOTE = 'USDT';

// Coin universe (base assets), curated for liquidity.
const COINS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'LTC',
  'TRX', 'DOT', 'ATOM', 'NEAR', 'ARB', 'OP', 'INJ', 'SUI', 'APT', 'TON',
  'FIL', 'UNI', 'AAVE', 'ETC', 'XLM',
]);

type Quote = { bid: number; ask: number };
type ExchangeSnapshot = Map<string, Quote>; // base -> {bid, ask}

interface Exchange {
  id: string;
  label: string;
  taker: number; // taker fee, percent
  url: string;
  parse: (json: unknown) => ExchangeSnapshot;
}

const UA = 'Mozilla/5.0 (compatible; ArbScanner/1.0; +https://mos2.on.tc)';

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : NaN;
}

// Binance-format bookTicker: [{symbol:"BTCUSDT", bidPrice, askPrice}]
function parseBinanceLike(json: unknown): ExchangeSnapshot {
  const out: ExchangeSnapshot = new Map();
  const arr = Array.isArray(json) ? json : [];
  for (const r of arr as Array<Record<string, unknown>>) {
    const sym = String(r.symbol ?? '');
    if (!sym.endsWith(QUOTE)) continue;
    const base = sym.slice(0, -QUOTE.length);
    if (!COINS.has(base)) continue;
    const bid = num(r.bidPrice), ask = num(r.askPrice);
    if (bid > 0 && ask > 0) out.set(base, { bid, ask });
  }
  return out;
}

const EXCHANGES: Exchange[] = [
  {
    id: 'binance', label: 'Binance', taker: 0.1,
    url: 'https://data-api.binance.vision/api/v3/ticker/bookTicker',
    parse: parseBinanceLike,
  },
  {
    id: 'mexc', label: 'MEXC', taker: 0.1,
    url: 'https://api.mexc.com/api/v3/ticker/bookTicker',
    parse: parseBinanceLike,
  },
  {
    id: 'okx', label: 'OKX', taker: 0.1,
    url: 'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
    parse: (json) => {
      const out: ExchangeSnapshot = new Map();
      const data = (json as { data?: Array<Record<string, unknown>> }).data ?? [];
      for (const r of data) {
        const inst = String(r.instId ?? ''); // "BTC-USDT"
        const [base, quote] = inst.split('-');
        if (!base || quote !== QUOTE || !COINS.has(base)) continue;
        const bid = num(r.bidPx), ask = num(r.askPx);
        if (bid > 0 && ask > 0) out.set(base, { bid, ask });
      }
      return out;
    },
  },
  {
    id: 'gateio', label: 'Gate.io', taker: 0.2,
    url: 'https://api.gateio.ws/api/v4/spot/tickers',
    parse: (json) => {
      const out: ExchangeSnapshot = new Map();
      const arr = Array.isArray(json) ? json : [];
      for (const r of arr as Array<Record<string, unknown>>) {
        const pair = String(r.currency_pair ?? ''); // "BTC_USDT"
        const [base, quote] = pair.split('_');
        if (!base || quote !== QUOTE || !COINS.has(base)) continue;
        const bid = num(r.highest_bid), ask = num(r.lowest_ask);
        if (bid > 0 && ask > 0) out.set(base, { bid, ask });
      }
      return out;
    },
  },
  {
    id: 'kucoin', label: 'KuCoin', taker: 0.1,
    url: 'https://api.kucoin.com/api/v1/market/allTickers',
    parse: (json) => {
      const out: ExchangeSnapshot = new Map();
      const ticks = (json as { data?: { ticker?: Array<Record<string, unknown>> } }).data?.ticker ?? [];
      for (const r of ticks) {
        const sym = String(r.symbol ?? ''); // "BTC-USDT"
        const [base, quote] = sym.split('-');
        if (!base || quote !== QUOTE || !COINS.has(base)) continue;
        const bid = num(r.buy), ask = num(r.sell); // buy=best bid, sell=best ask
        if (bid > 0 && ask > 0) out.set(base, { bid, ask });
      }
      return out;
    },
  },
];

export interface ArbOpportunity {
  base: string;
  pair: string;
  buyEx: string;
  buyPrice: number;
  sellEx: string;
  sellPrice: number;
  grossPct: number;   // headline spread
  netPct: number;     // after taker fees both legs
  grossProfit: number; // on $1,000 notional
  netProfit: number;   // on $1,000 notional, after fees
}

export interface ScannerData {
  opportunities: ArbOpportunity[];
  exchanges: Array<{ id: string; label: string; ok: boolean; coins: number }>;
  notional: number;
  netPositive: number; // count of opps with net > 0 after fees
  updatedAt: number;
}

const NOTIONAL = 1000;

async function fetchExchange(ex: Exchange): Promise<{ ex: Exchange; snap: ExchangeSnapshot }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(ex.url, { headers: { 'User-Agent': UA, accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return { ex, snap: new Map() };
    return { ex, snap: ex.parse(await res.json()) };
  } catch {
    return { ex, snap: new Map() };
  } finally {
    clearTimeout(t);
  }
}

async function build(): Promise<ScannerData> {
  const results = await Promise.all(EXCHANGES.map(fetchExchange));
  const live = results.filter((r) => r.snap.size > 0);

  const opportunities: ArbOpportunity[] = [];
  for (const base of COINS) {
    const quotes = live
      .map((r) => ({ ex: r.ex, q: r.snap.get(base) }))
      .filter((x): x is { ex: Exchange; q: Quote } => !!x.q);
    if (quotes.length < 2) continue;

    const buy = quotes.reduce((a, b) => (b.q.ask < a.q.ask ? b : a)); // cheapest ask
    const sell = quotes.reduce((a, b) => (b.q.bid > a.q.bid ? b : a)); // richest bid
    if (buy.ex.id === sell.ex.id) continue;

    const grossPct = ((sell.q.bid - buy.q.ask) / buy.q.ask) * 100;
    const netPct = grossPct - buy.ex.taker - sell.ex.taker;
    opportunities.push({
      base,
      pair: `${base}/${QUOTE}`,
      buyEx: buy.ex.label,
      buyPrice: buy.q.ask,
      sellEx: sell.ex.label,
      sellPrice: sell.q.bid,
      grossPct,
      netPct,
      grossProfit: (NOTIONAL * grossPct) / 100,
      netProfit: (NOTIONAL * netPct) / 100,
    });
  }
  opportunities.sort((a, b) => b.grossPct - a.grossPct);

  return {
    opportunities,
    exchanges: results.map((r) => ({ id: r.ex.id, label: r.ex.label, ok: r.snap.size > 0, coins: r.snap.size })),
    notional: NOTIONAL,
    netPositive: opportunities.filter((o) => o.netPct > 0).length,
    updatedAt: Date.now(),
  };
}

// Module-level cache so concurrent viewers share one upstream refresh.
let cache: ScannerData | null = null;
let inflight: Promise<ScannerData> | null = null;
const TTL_MS = 30_000;

export async function getScannerData(): Promise<ScannerData> {
  if (cache && Date.now() - cache.updatedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = build()
    .then((d) => { cache = d; return d; })
    .finally(() => { inflight = null; });
  return inflight;
}
