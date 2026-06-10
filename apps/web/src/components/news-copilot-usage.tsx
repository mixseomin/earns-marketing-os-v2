'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';

interface Totals {
  requests: number; llmCalls: number; cacheHits: number; costUsd: number;
  promptTokens: number; completionTokens: number; events: number;
  hitRate: number; avgCostPerReq: number;
}
interface Stats {
  totals: Totals;
  byDay: Record<string, { requests: number; llm: number; cost: number }>;
  byEndpoint: Record<string, number>;
  byModel: Record<string, { calls: number; cost: number }>;
  byCurrency: Record<string, number>;
  byClient: Record<string, { requests: number; cost: number }>;
  recent: Array<{ ts: number; endpoint: string; exposure?: string[]; events?: number; llm_calls?: number; cache_hits?: number; prompt_tokens?: number; completion_tokens?: number; cost_usd?: number }>;
}

const muted = 'var(--fg-2, #7c879b)';
const accent = 'var(--accent, #26c6c6)';
const POLL_MS = 30_000;

const intf = (n: number) => (Number(n) || 0).toLocaleString('en-US');
const usd = (n: number) => '$' + (Number(n) || 0).toFixed(4);
const usd2 = (n: number) => '$' + (Number(n) || 0).toFixed(2);
const pct = (n: number) => (Number(n) || 0).toFixed(1) + '%';

const card: CSSProperties = { background: 'var(--bg-2, #101d2e)', border: '1px solid var(--border, #1d2c42)', borderRadius: 10, padding: 14 };
const th: CSSProperties = { textAlign: 'left', padding: '7px 10px', color: muted, fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border,#1d2c42)' };
const td: CSSProperties = { textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--border,#18283d)', fontVariantNumeric: 'tabular-nums' };

function Bar({ frac, color = accent }: { frac: number; color?: string }) {
  const w = Math.max(0, Math.min(100, frac * 100));
  return <div style={{ background: 'var(--bg-3,#1a2433)', borderRadius: 3, height: 7, overflow: 'hidden', minWidth: 60 }}><div style={{ width: `${w}%`, height: 7, background: color }} /></div>;
}

function Card({ k, v, s }: { k: string; v: string; s?: string }) {
  return <div style={card}><div style={{ color: muted, fontSize: 12 }}>{k}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 3 }}>{v}</div>{s && <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>{s}</div>}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
    <div style={{ padding: '10px 12px', color: muted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid var(--border,#1d2c42)' }}>{title}</div>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table></div>
  </div>;
}

export function NewsCopilotUsage() {
  const [d, setD] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/news-copilot/stats', { cache: 'no-store' });
      if (!r.ok) { setErr(r.status === 503 ? 'not configured' : 'unavailable'); return; }
      setD(await r.json()); setErr(null);
    } catch { setErr('unavailable'); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (err) return <div style={{ ...card, color: muted, margin: '16px 0' }}>News Co-pilot metrics: {err}.</div>;
  if (!d) return <div style={{ ...card, color: muted, margin: '16px 0' }}>Loading News Co-pilot usage…</div>;

  const t = d.totals;
  const days = Object.entries(d.byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const maxDay = Math.max(1, ...days.map(([, v]) => v.requests));
  const eps = Object.entries(d.byEndpoint).sort((a, b) => b[1] - a[1]);
  const maxEp = Math.max(1, ...eps.map(([, v]) => v));
  const ccy = Object.entries(d.byCurrency).sort((a, b) => b[1] - a[1]);
  const maxCcy = Math.max(1, ...ccy.map(([, v]) => v));
  const models = Object.entries(d.byModel);
  const clients = Object.entries(d.byClient).sort((a, b) => b[1].requests - a[1].requests).slice(0, 10);

  return (
    <div style={{ margin: '12px 0 24px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>📰 News Co-pilot — Usage &amp; Cost <span style={{ color: muted, fontWeight: 400, fontSize: 12 }}>· live · fxnewsapi.on.tc</span></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        <Card k="Requests" v={intf(t.requests)} />
        <Card k="LLM calls" v={intf(t.llmCalls)} s={`cache hits ${intf(t.cacheHits)}`} />
        <Card k="Cache hit rate" v={pct(t.hitRate)} s="higher = cheaper" />
        <Card k="Total cost" v={usd2(t.costUsd)} s={`avg ${usd(t.avgCostPerReq)}/req`} />
        <Card k="Tokens" v={intf(t.promptTokens + t.completionTokens)} s={`in ${intf(t.promptTokens)} · out ${intf(t.completionTokens)}`} />
        <Card k="Events served" v={intf(t.events)} />
      </div>

      <Panel title="By day">
        <thead><tr><th style={th}>Date</th><th style={th}>Requests</th><th style={th}>LLM</th><th style={th}>Cost</th></tr></thead>
        <tbody>{days.length ? days.map(([k, v]) => <tr key={k}><td style={td}>{k}</td><td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{intf(v.requests)}<Bar frac={v.requests / maxDay} /></div></td><td style={td}>{intf(v.llm)}</td><td style={td}>{usd(v.cost)}</td></tr>) : <tr><td style={{ ...td, color: muted }} colSpan={4}>no data yet</td></tr>}</tbody>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginTop: 14 }}>
        <Panel title="By endpoint">
          <tbody>{eps.map(([k, v]) => <tr key={k}><td style={td}>{k}</td><td style={{ ...td, width: 60 }}>{intf(v)}</td><td style={td}><Bar frac={v / maxEp} color="#3fa7ff" /></td></tr>)}</tbody>
        </Panel>
        <Panel title="By exposure currency">
          <tbody>{ccy.length ? ccy.map(([k, v]) => <tr key={k}><td style={td}>{k}</td><td style={{ ...td, width: 60 }}>{intf(v)}</td><td style={td}><Bar frac={v / maxCcy} color="#2fd47a" /></td></tr>) : <tr><td style={{ ...td, color: muted }} colSpan={3}>none</td></tr>}</tbody>
        </Panel>
        <Panel title="By model">
          <thead><tr><th style={th}>Model</th><th style={th}>Calls</th><th style={th}>Cost</th></tr></thead>
          <tbody>{models.length ? models.map(([k, v]) => <tr key={k}><td style={td}>{k}</td><td style={td}>{intf(v.calls)}</td><td style={td}>{usd(v.cost)}</td></tr>) : <tr><td style={{ ...td, color: muted }} colSpan={3}>none</td></tr>}</tbody>
        </Panel>
        <Panel title="Top clients">
          <thead><tr><th style={th}>License / IP</th><th style={th}>Req</th><th style={th}>Cost</th></tr></thead>
          <tbody>{clients.map(([k, v]) => <tr key={k}><td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</td><td style={td}>{intf(v.requests)}</td><td style={td}>{usd(v.cost)}</td></tr>)}</tbody>
        </Panel>
      </div>

      <div style={{ marginTop: 14 }}>
        <Panel title="Recent requests">
          <thead><tr><th style={th}>Time (UTC)</th><th style={th}>Endpoint</th><th style={th}>Exposure</th><th style={th}>Events</th><th style={th}>LLM/Cache</th><th style={th}>Tokens</th><th style={th}>Cost</th></tr></thead>
          <tbody>{d.recent.length ? d.recent.map((r, i) => <tr key={i}><td style={td}>{new Date(r.ts).toISOString().replace('T', ' ').slice(5, 19)}</td><td style={td}>{r.endpoint}</td><td style={td}>{(r.exposure || []).join(',') || '-'}</td><td style={td}>{intf(r.events || 0)}</td><td style={td}>{intf(r.llm_calls || 0)}/{intf(r.cache_hits || 0)}</td><td style={td}>{intf((r.prompt_tokens || 0) + (r.completion_tokens || 0))}</td><td style={td}>{usd(r.cost_usd || 0)}</td></tr>) : <tr><td style={{ ...td, color: muted }} colSpan={7}>no requests yet</td></tr>}</tbody>
        </Panel>
      </div>
    </div>
  );
}
