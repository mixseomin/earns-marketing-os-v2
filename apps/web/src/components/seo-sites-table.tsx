'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkline } from './sparkline';
import { GscDetailDrawer } from './gsc-detail-drawer';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';
import { wrapExternalUrl } from '@/lib/external-url';

interface RowData {
  domain: string;
  emoji: string;
  project?: string;
  ga4PropertyId?: string;
  // Live (GA4 realtime)
  ga4_active_5min?: number | null;
  ga4_active_30min?: number | null;
  // Interactions (GA4 custom events, 7d)
  ga4_interactions_7d?: number | null;
  ga4_interactions_by?: Record<string, number> | null;
  // GSC group
  impressions_7d: number;
  clicks_7d: number;
  avg_position_7d: number;
  pages_with_impressions_7d: number;
  sitemap_urls_submitted: number;
  // AdSense group
  adsense_earnings_today?: number | null;
  adsense_impressions_today?: number | null;
  adsense_clicks_today?: number | null;
  adsense_earnings_7d?: number | null;
  adsense_impressions_7d?: number | null;
  adsense_rpm_7d?: number | null;
  adsense_page_views_7d?: number | null;
  // Bing group
  bing_impressions_7d?: number | null;
  bing_clicks_7d?: number | null;
  bing_feeds_indexed?: number | null;
  bing_in_index?: number | null;
  bing_in_links?: number | null;
  bing_errors_4xx_30d?: number | null;
  bing_crawled_30d?: number | null;
  // AI answer-engine referrals (GA4 sessionSource = chatgpt/perplexity/gemini/copilot/claude)
  ai_sessions_7d?: number | null;
  ai_sessions_28d?: number | null;
  ai_by_engine?: Record<string, number> | null;
  review?: string; // manual review/checkpoint date (YYYY-MM-DD), shown as AI-group countdown
}

interface Props {
  rows: RowData[];
  timeseries: Record<string, GscDailyPoint[]>;
  totals: { imps: number; clicks: number; pages: number; sitemap: number; avgPos: number };
  initialCols?: Partial<Record<ColGroup, boolean>>;
}

type ColGroup = 'live' | 'interactions' | 'gsc' | 'adsense' | 'bing' | 'ai';
const DEFAULT_COLS: Record<ColGroup, boolean> = { live: true, interactions: true, gsc: true, adsense: true, bing: true, ai: true };
const STORAGE_KEY = 'seo-table-cols-v2';
const COOKIE_KEY = 'seo_cols';

// Per-group palette — same hue used for the toggle chip, the header band,
// and the column's left-edge separator so the eye can scan a column straight
// back to its group label.
const GROUP_COLOR: Record<ColGroup, { fg: string; bg: string; bgSoft: string }> = {
  live:    { fg: '#22c55e', bg: 'rgba(34,197,94,0.22)',  bgSoft: 'rgba(34,197,94,0.06)' },   // green = realtime
  interactions: { fg: '#ec4899', bg: 'rgba(236,72,153,0.22)', bgSoft: 'rgba(236,72,153,0.06)' }, // pink = interactions
  gsc:     { fg: '#3c9bff', bg: 'rgba(60,155,255,0.22)', bgSoft: 'rgba(60,155,255,0.06)' },  // blue = Google
  adsense: { fg: '#ffb03c', bg: 'rgba(255,176,60,0.22)', bgSoft: 'rgba(255,176,60,0.06)' },  // amber = money
  bing:    { fg: '#9d6cff', bg: 'rgba(157,108,255,0.22)',bgSoft: 'rgba(157,108,255,0.06)' }, // violet = Bing/MS
  ai:      { fg: '#10b981', bg: 'rgba(16,185,129,0.22)', bgSoft: 'rgba(16,185,129,0.06)' }, // emerald = AI/LLM referrals
};
const GROUP_LABEL: Record<ColGroup, string> = { live: 'Live', interactions: 'Interact', gsc: 'GSC', adsense: 'AdSense', bing: 'Bing', ai: 'AI' };

export function SeoSitesTable({ rows, timeseries, totals, initialCols }: Props) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  // Seed from server-supplied cookie value (passed via initialCols prop) so the
  // very first render — server AND client — matches the user's saved view.
  // Avoids the FOUC where AdSense/Bing flashed visible then collapsed after
  // useEffect read localStorage.
  const [cols, setCols] = useState<Record<ColGroup, boolean>>(() => ({ ...DEFAULT_COLS, ...(initialCols ?? {}) }));

  // Hydration fallback: if the cookie was missing (older sessions / not
  // mirrored yet), reconcile from localStorage AFTER paint. Reads write the
  // cookie too so the next reload comes back with no fallback needed.
  useEffect(() => {
    if (initialCols && Object.keys(initialCols).length > 0) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCols({ ...DEFAULT_COLS, ...parsed });
        document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(parsed))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      }
    } catch {}
  }, [initialCols]);

  // Client-only clock for per-site review countdowns (avoids SSR/CSR hydration mismatch).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { setNowMs(Date.now()); }, []);

  function toggle(g: ColGroup) {
    setCols(prev => {
      const next = { ...prev, [g]: !prev[g] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      } catch {}
      return next;
    });
  }

  // Tighter padding (was 8/10 → 5/8). Sparkline column narrower (no horizontal pad).
  const cell: React.CSSProperties = { padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', fontWeight: 500 };
  const tone = (cond: boolean) => ({ color: cond ? 'var(--ok)' : 'var(--fg-2)' });

  // Per-group styling helpers — bg tint only (no borders). Header bg is a
  // touch stronger than body so the group reads as a vertical band.
  const headOf = (g: ColGroup, _first = false): React.CSSProperties => ({
    ...head,
    color: GROUP_COLOR[g].fg,
    background: GROUP_COLOR[g].bg,
  });
  const cellOf = (g: ColGroup, _first = false, extra: React.CSSProperties = {}): React.CSSProperties => ({
    ...cell,
    background: GROUP_COLOR[g].bgSoft,
    ...extra,
  });
  const totalAdsenseToday = rows.reduce((s, r) => s + (r.adsense_earnings_today ?? 0), 0);
  const totalAdsenseImprToday = rows.reduce((s, r) => s + (r.adsense_impressions_today ?? 0), 0);
  const totalAdsenseClkToday = rows.reduce((s, r) => s + (r.adsense_clicks_today ?? 0), 0);
  const totalAdsenseEarnings = rows.reduce((s, r) => s + (r.adsense_earnings_7d ?? 0), 0);
  const totalAdsenseImpr = rows.reduce((s, r) => s + (r.adsense_impressions_7d ?? 0), 0);
  const totalAdsensePV = rows.reduce((s, r) => s + (r.adsense_page_views_7d ?? 0), 0);
  const totalBingImpr = rows.reduce((s, r) => s + (r.bing_impressions_7d ?? 0), 0);
  const totalBingClk = rows.reduce((s, r) => s + (r.bing_clicks_7d ?? 0), 0);
  const totalBingIndex = rows.reduce((s, r) => s + (r.bing_in_index ?? 0), 0);
  const totalBingLinks = rows.reduce((s, r) => s + (r.bing_in_links ?? 0), 0);
  const totalBing4xx = rows.reduce((s, r) => s + (r.bing_errors_4xx_30d ?? 0), 0);
  const totalAi7 = rows.reduce((s, r) => s + (r.ai_sessions_7d ?? 0), 0);
  const totalAi28 = rows.reduce((s, r) => s + (r.ai_sessions_28d ?? 0), 0);
  const totalLive5 = rows.reduce((s, r) => s + (r.ga4_active_5min ?? 0), 0);
  const totalLive30 = rows.reduce((s, r) => s + (r.ga4_active_30min ?? 0), 0);
  const totalInteractions = rows.reduce((s, r) => s + (r.ga4_interactions_7d ?? 0), 0);
  const totalRpm = totalAdsenseImpr > 0 ? (totalAdsenseEarnings / totalAdsenseImpr) * 1000 : 0;

  const openPoints = openDomain ? timeseries[openDomain] || [] : [];
  const fmtUsd = (n: number) => n >= 10 ? `$${n.toFixed(2)}` : n > 0 ? `$${n.toFixed(3)}` : '—';

  return (
    <>
      <style>{`
        @keyframes live-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70%  { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .live-dot { animation: live-pulse 1.6s infinite; }
        @keyframes live-text-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        .live-text { animation: live-text-pulse 1.6s ease-in-out infinite; }
        .seo-row:hover td { filter: brightness(1.6); }
        @media (max-width: 768px) { .seo-extlink { display: none; } }
      `}</style>
      {/* Column-group toggles — chip color matches the column band below */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, rowGap: 4, marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Show:</span>
        {(['live', 'interactions', 'gsc', 'adsense', 'bing', 'ai'] as ColGroup[]).map(g => {
          const c = GROUP_COLOR[g];
          return (
            <button key={g} type="button" onClick={() => toggle(g)}
              style={{
                padding: '3px 9px', borderRadius: 4,
                background: cols[g] ? c.bg : 'transparent',
                border: `1px solid ${cols[g] ? c.fg : 'transparent'}`,
                color: cols[g] ? c.fg : 'var(--fg-3)',
                cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                fontWeight: cols[g] ? 600 : 400,
              }}>
              {cols[g] ? '✓ ' : '+ '}{GROUP_LABEL[g]}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Site</th>
            {cols.live && <>
              <th style={{ ...headOf('live', true), textAlign: 'center' }} title="GA4 Realtime: active users in the last 5 minutes (updates every 5 min)">
                <span className="live-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GROUP_COLOR.live.fg, boxShadow: '0 0 0 0 rgba(34,197,94,0.7)' }} />
              </th>
              <th style={headOf('live')} title="GA4 Realtime: active users in the last 30 minutes">
                <span className="live-text">30m</span>
              </th>
            </>}
            {cols.interactions && <>
              <th style={headOf('interactions', true)} title="GA4 interaction events last 7 days: share, save, subscribe, calc_used, compare, command palette, location clicks + outbound clicks/downloads/forms. Hover a row for the per-event breakdown. Sites show 0 until their UI is instrumented.">Inter</th>
            </>}
            {cols.gsc && <>
              <th style={headOf('gsc', true)} title="GSC impressions last 7 days">Impr</th>
              <th style={{ ...headOf('gsc'), padding: '5px 4px' }} title="30-day impressions trend sparkline">Trend</th>
              <th style={headOf('gsc')} title="GSC clicks last 7 days">Clk</th>
              <th style={headOf('gsc')} title="Click-through rate last 7 days">CTR</th>
              <th style={headOf('gsc')} title="Average search position last 7 days">Pos</th>
              <th style={headOf('gsc')} title="Pages with at least 1 impression last 7 days">Pages</th>
              <th style={headOf('gsc')} title="URLs submitted via sitemap">Sites</th>
            </>}
            {cols.adsense && <>
              <th style={headOf('adsense', true)} title="AdSense earnings today (intra-day estimate, refreshed hourly)">$ TD</th>
              <th style={headOf('adsense')} title="AdSense ad impressions today">Impr TD</th>
              <th style={headOf('adsense')} title="AdSense clicks today">Clk TD</th>
              <th style={headOf('adsense')} title="AdSense earnings last 7 days (USD)">$ 7d</th>
              <th style={headOf('adsense')} title="AdSense RPM last 7 days (USD per 1k impressions)">RPM</th>
              <th style={headOf('adsense')} title="AdSense ad impressions last 7 days">Impr</th>
              <th style={headOf('adsense')} title="AdSense page views last 7 days">PV</th>
            </>}
            {cols.bing && <>
              <th style={headOf('bing', true)} title="Bing impressions last 7 days">Impr</th>
              <th style={headOf('bing')} title="Bing clicks last 7 days">Clk</th>
              <th style={headOf('bing')} title="Pages currently in the Bing index (latest snapshot)">Idx</th>
              <th style={headOf('bing')} title="Inbound links (backlinks) — Bing webmaster count">Links</th>
              <th style={headOf('bing')} title="4xx errors Bing crawler hit in last 30 days">4xx</th>
            </>}
            {cols.ai && <>
              <th style={headOf('ai', true)} title="Sessions referred by an AI answer engine (ChatGPT, Perplexity, Gemini, Copilot, Claude) in the last 7 days — GA4 sessionSource. Tier-3 proof of LLM SEO: the engine cited the page AND a human clicked through.">AI 7d</th>
              <th style={headOf('ai')} title="AI answer-engine referred sessions, last 28 days. Hover a row for the per-engine breakdown.">AI 28d</th>
              <th style={headOf('ai')} title="Manual review/checkpoint per site — countdown to the next scheduled SEO/AI review.">Review</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ctr = r.impressions_7d ? (r.clicks_7d / r.impressions_7d * 100) : 0;
            const pts = timeseries[r.domain] || [];
            const sparkValues = pts.slice(-30).map((p) => p.impressions);
            const gscUrl = `https://search.google.com/search-console?resource_id=${encodeURIComponent('sc-domain:' + r.domain)}`;
            const SiteCell = r.project
              ? <Link href={`/p/${r.project}`} style={{ color: 'var(--fg-1)', textDecoration: 'none', fontWeight: 600 }}>{r.emoji} {r.domain}</Link>
              : <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{r.emoji} {r.domain}</span>;
            return (
              <tr key={r.domain} className="seo-row" style={{ cursor: 'pointer' }}
                  onClick={() => setOpenDomain(r.domain)}
                  title={`Click → mở chart + top queries cho ${r.domain}`}>
                <td style={{ ...cell, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
                  {SiteCell}
                  <a href={wrapExternalUrl(`https://${r.domain}/`)} target="_blank" rel="noopener noreferrer"
                    title={`Open ${r.domain} homepage`}
                    className="seo-extlink" style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>Web&nbsp;↗</a>
                  <a href={wrapExternalUrl(gscUrl)} target="_blank" rel="noopener noreferrer"
                    title={`Open ${r.domain} in Google Search Console`}
                    className="seo-extlink" style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>GSC&nbsp;↗</a>
                  {r.ga4PropertyId && (
                    <a href={wrapExternalUrl(`https://analytics.google.com/analytics/web/#/p${r.ga4PropertyId}/reports/intelligenthome`)} target="_blank" rel="noopener noreferrer"
                      title={`Open ${r.domain} in Google Analytics (GA4)`}
                      className="seo-extlink" style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>GA&nbsp;↗</a>
                  )}
                  <a href={wrapExternalUrl(`https://www.bing.com/webmasters/?siteUrl=${encodeURIComponent('https://' + r.domain + '/')}`)} target="_blank" rel="noopener noreferrer"
                    title={`Open ${r.domain} in Bing Webmaster Tools`}
                    className="seo-extlink" style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>Bing&nbsp;↗</a>
                </td>
                {cols.live && <>
                  <td style={{ ...cellOf('live', true, { textAlign: 'right', ...tone((r.ga4_active_5min ?? 0) > 0), fontWeight: (r.ga4_active_5min ?? 0) > 0 ? 600 : 400 }) }}>
                    {r.ga4_active_5min == null ? '—' : r.ga4_active_5min > 0 ? r.ga4_active_5min.toLocaleString() : '0'}
                  </td>
                  <td style={{ ...cellOf('live', false, { textAlign: 'right', ...tone((r.ga4_active_30min ?? 0) > 0) }) }}>
                    {r.ga4_active_30min == null ? '—' : r.ga4_active_30min > 0 ? r.ga4_active_30min.toLocaleString() : '0'}
                  </td>
                </>}
                {cols.interactions && <>
                  <td style={cellOf('interactions', true, { textAlign: 'right', ...tone((r.ga4_interactions_7d ?? 0) > 0), fontWeight: (r.ga4_interactions_7d ?? 0) > 0 ? 600 : 400 })}
                    title={r.ga4_interactions_by && Object.keys(r.ga4_interactions_by).length
                      ? Object.entries(r.ga4_interactions_by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ')
                      : 'No GA4 interaction events in last 7d (site not instrumented or no activity yet)'}>
                    {r.ga4_interactions_7d == null ? '—' : r.ga4_interactions_7d > 0 ? r.ga4_interactions_7d.toLocaleString() : '0'}
                  </td>
                </>}
                {cols.gsc && <>
                  <td style={cellOf('gsc', true, { textAlign: 'right', ...tone(r.impressions_7d > 0) })}>{r.impressions_7d.toLocaleString()}</td>
                  <td style={cellOf('gsc', false, { textAlign: 'center', padding: '2px 4px', width: 70 })}>
                    <Sparkline values={sparkValues} />
                  </td>
                  <td style={cellOf('gsc', false, { textAlign: 'right', ...tone(r.clicks_7d > 0) })}>{r.clicks_7d.toLocaleString()}</td>
                  <td style={cellOf('gsc', false, { textAlign: 'right', ...tone(ctr > 0) })}>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</td>
                  <td style={cellOf('gsc', false, { textAlign: 'right', ...tone(r.avg_position_7d > 0 && r.avg_position_7d < 20) })}>{r.avg_position_7d > 0 ? r.avg_position_7d.toFixed(1) : '—'}</td>
                  <td style={cellOf('gsc', false, { textAlign: 'right' })}>{r.pages_with_impressions_7d}</td>
                  <td style={cellOf('gsc', false, { textAlign: 'right' })}>{r.sitemap_urls_submitted.toLocaleString()}</td>
                </>}
                {cols.adsense && <>
                  <td style={cellOf('adsense', true, { textAlign: 'right', ...tone((r.adsense_earnings_today ?? 0) > 0) })}>
                    {r.adsense_earnings_today == null ? '—' : fmtUsd(r.adsense_earnings_today)}
                  </td>
                  <td style={cellOf('adsense', false, { textAlign: 'right', ...tone((r.adsense_impressions_today ?? 0) > 0) })}>
                    {r.adsense_impressions_today == null ? '—' : r.adsense_impressions_today.toLocaleString()}
                  </td>
                  <td style={cellOf('adsense', false, { textAlign: 'right', ...tone((r.adsense_clicks_today ?? 0) > 0) })}>
                    {r.adsense_clicks_today == null ? '—' : r.adsense_clicks_today.toLocaleString()}
                  </td>
                  <td style={cellOf('adsense', false, { textAlign: 'right', ...tone((r.adsense_earnings_7d ?? 0) > 0) })}
                      title={r.adsense_earnings_7d != null ? `Last 7d AdSense earnings` : 'No AdSense data for this site (or not in cron map)'}>
                    {r.adsense_earnings_7d == null ? '—' : fmtUsd(r.adsense_earnings_7d)}
                  </td>
                  <td style={cellOf('adsense', false, { textAlign: 'right', ...tone((r.adsense_rpm_7d ?? 0) > 0) })}>
                    {r.adsense_rpm_7d == null ? '—' : r.adsense_rpm_7d > 0 ? `$${r.adsense_rpm_7d.toFixed(2)}` : '—'}
                  </td>
                  <td style={cellOf('adsense', false, { textAlign: 'right' })}>
                    {r.adsense_impressions_7d == null ? '—' : r.adsense_impressions_7d.toLocaleString()}
                  </td>
                  <td style={cellOf('adsense', false, { textAlign: 'right' })}>
                    {r.adsense_page_views_7d == null ? '—' : r.adsense_page_views_7d.toLocaleString()}
                  </td>
                </>}
                {cols.bing && <>
                  <td style={cellOf('bing', true, { textAlign: 'right', ...tone((r.bing_impressions_7d ?? 0) > 0) })}>
                    {r.bing_impressions_7d == null ? '—' : r.bing_impressions_7d.toLocaleString()}
                  </td>
                  <td style={cellOf('bing', false, { textAlign: 'right', ...tone((r.bing_clicks_7d ?? 0) > 0) })}>
                    {r.bing_clicks_7d == null ? '—' : r.bing_clicks_7d.toLocaleString()}
                  </td>
                  <td style={cellOf('bing', false, { textAlign: 'right', ...tone((r.bing_in_index ?? 0) > 0) })}
                    title={`Indexed pages (latest snapshot) · ${(r.bing_crawled_30d ?? 0).toLocaleString()} crawled in 30d · ${(r.bing_feeds_indexed ?? 0).toLocaleString()} via sitemap`}>
                    {r.bing_in_index == null ? '—' : r.bing_in_index.toLocaleString()}
                  </td>
                  <td style={cellOf('bing', false, { textAlign: 'right', ...tone((r.bing_in_links ?? 0) > 0) })}>
                    {r.bing_in_links == null ? '—' : r.bing_in_links.toLocaleString()}
                  </td>
                  <td style={cellOf('bing', false, { textAlign: 'right', color: (r.bing_errors_4xx_30d ?? 0) > 20 ? 'var(--warn)' : (r.bing_errors_4xx_30d ?? 0) > 0 ? 'var(--fg-2)' : 'var(--fg-3)' })}
                    title={(r.bing_errors_4xx_30d ?? 0) > 20 ? 'Many 4xx errors — check Bing Webmaster crawl report' : 'Bing crawler 4xx hits in last 30 days'}>
                    {r.bing_errors_4xx_30d == null ? '—' : r.bing_errors_4xx_30d > 0 ? r.bing_errors_4xx_30d.toLocaleString() : '0'}
                  </td>
                </>}
                {cols.ai && <>
                  <td style={cellOf('ai', true, { textAlign: 'right', ...tone((r.ai_sessions_7d ?? 0) > 0), fontWeight: (r.ai_sessions_7d ?? 0) > 0 ? 600 : 400 })}
                    title={r.ai_by_engine && Object.keys(r.ai_by_engine).length
                      ? Object.entries(r.ai_by_engine).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ') + ' (28d)'
                      : 'No AI answer-engine referrals yet (ChatGPT/Perplexity/Gemini/Copilot/Claude). Crawl can be active before clicks appear.'}>
                    {r.ai_sessions_7d == null ? '—' : r.ai_sessions_7d > 0 ? r.ai_sessions_7d.toLocaleString() : '0'}
                  </td>
                  <td style={cellOf('ai', false, { textAlign: 'right', ...tone((r.ai_sessions_28d ?? 0) > 0) })}
                    title={r.ai_by_engine && Object.keys(r.ai_by_engine).length
                      ? Object.entries(r.ai_by_engine).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ') + ' (28d)'
                      : 'No AI referrals in last 28d'}>
                    {r.ai_sessions_28d == null ? '—' : r.ai_sessions_28d > 0 ? r.ai_sessions_28d.toLocaleString() : '0'}
                  </td>
                  <td style={cellOf('ai', false, { textAlign: 'right', whiteSpace: 'nowrap' })}
                    title={r.review ? `Next review: ${r.review}` : 'No review scheduled'}>
                    {(() => {
                      if (!r.review) return <span style={{ color: 'var(--fg-3)' }}>—</span>;
                      if (nowMs == null) return <span style={{ color: 'var(--fg-3)' }}>·</span>;
                      const days = Math.ceil((new Date(r.review + 'T00:00:00Z').getTime() - nowMs) / 86400000);
                      const color = days < 0 ? '#f87171' : days <= 7 ? '#e3b341' : 'var(--fg-2)';
                      const label = days < 0 ? `${-days}d late` : days === 0 ? 'today' : `${days}d`;
                      return <span style={{ color, fontWeight: days <= 7 ? 700 : 400 }}>⏰ {label}</span>;
                    })()}
                  </td>
                </>}
              </tr>
            );
          })}
          <tr style={{ background: 'var(--bg-2)' }}>
            <td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>TOTAL ({rows.length})</td>
            {cols.live && <>
              <td style={cellOf('live', true, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.live.fg })}>{totalLive5.toLocaleString()}</td>
              <td style={cellOf('live', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.live.fg })}>{totalLive30.toLocaleString()}</td>
            </>}
            {cols.interactions && <>
              <td style={cellOf('interactions', true, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.interactions.fg })}>{totalInteractions.toLocaleString()}</td>
            </>}
            {cols.gsc && <>
              <td style={cellOf('gsc', true, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.gsc.fg })}>{totals.imps.toLocaleString()}</td>
              <td style={cellOf('gsc', false)} />
              <td style={cellOf('gsc', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.gsc.fg })}>{totals.clicks.toLocaleString()}</td>
              <td style={cellOf('gsc', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.gsc.fg })}>{totals.imps > 0 ? (totals.clicks / totals.imps * 100).toFixed(2) + '%' : '—'}</td>
              <td style={cellOf('gsc', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.gsc.fg })}>{totals.avgPos > 0 ? totals.avgPos.toFixed(1) : '—'}</td>
              <td style={cellOf('gsc', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.gsc.fg })}>{totals.pages}</td>
              <td style={cellOf('gsc', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.gsc.fg })}>{totals.sitemap.toLocaleString()}</td>
            </>}
            {cols.adsense && <>
              <td style={cellOf('adsense', true, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalAdsenseToday > 0 ? fmtUsd(totalAdsenseToday) : '—'}</td>
              <td style={cellOf('adsense', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalAdsenseImprToday.toLocaleString()}</td>
              <td style={cellOf('adsense', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalAdsenseClkToday.toLocaleString()}</td>
              <td style={cellOf('adsense', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalAdsenseEarnings > 0 ? fmtUsd(totalAdsenseEarnings) : '—'}</td>
              <td style={cellOf('adsense', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalRpm > 0 ? `$${totalRpm.toFixed(2)}` : '—'}</td>
              <td style={cellOf('adsense', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalAdsenseImpr.toLocaleString()}</td>
              <td style={cellOf('adsense', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.adsense.fg })}>{totalAdsensePV.toLocaleString()}</td>
            </>}
            {cols.bing && <>
              <td style={cellOf('bing', true, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.bing.fg })}>{totalBingImpr.toLocaleString()}</td>
              <td style={cellOf('bing', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.bing.fg })}>{totalBingClk.toLocaleString()}</td>
              <td style={cellOf('bing', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.bing.fg })}>{totalBingIndex.toLocaleString()}</td>
              <td style={cellOf('bing', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.bing.fg })}>{totalBingLinks.toLocaleString()}</td>
              <td style={cellOf('bing', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.bing.fg })}>{totalBing4xx.toLocaleString()}</td>
            </>}
            {cols.ai && <>
              <td style={cellOf('ai', true, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.ai.fg })}>{totalAi7.toLocaleString()}</td>
              <td style={cellOf('ai', false, { textAlign: 'right', fontWeight: 700, color: GROUP_COLOR.ai.fg })}>{totalAi28.toLocaleString()}</td>
              <td style={cellOf('ai', false)} />
            </>}
          </tr>
        </tbody>
      </table>
      </div>

      {openDomain && (
        <GscDetailDrawer
          domain={openDomain}
          points={openPoints}
          interactions={rows.find((r) => r.domain === openDomain)?.ga4_interactions_by ?? null}
          onClose={() => setOpenDomain(null)}
        />
      )}
    </>
  );
}
