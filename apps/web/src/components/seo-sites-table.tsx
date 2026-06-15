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
}

interface Props {
  rows: RowData[];
  timeseries: Record<string, GscDailyPoint[]>;
  totals: { imps: number; clicks: number; pages: number; sitemap: number; avgPos: number };
}

type ColGroup = 'live' | 'gsc' | 'adsense' | 'bing';
const DEFAULT_COLS: Record<ColGroup, boolean> = { live: true, gsc: true, adsense: true, bing: true };
const STORAGE_KEY = 'seo-table-cols-v2';

export function SeoSitesTable({ rows, timeseries, totals }: Props) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [cols, setCols] = useState<Record<ColGroup, boolean>>(DEFAULT_COLS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCols({ ...DEFAULT_COLS, ...JSON.parse(stored) });
    } catch {}
  }, []);
  function toggle(g: ColGroup) {
    setCols(prev => {
      const next = { ...prev, [g]: !prev[g] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Tighter padding (was 8/10 → 5/8). Sparkline column narrower (no horizontal pad).
  const cell: React.CSSProperties = { padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', fontWeight: 500 };
  const tone = (cond: boolean) => ({ color: cond ? 'var(--ok)' : 'var(--fg-2)' });
  const totalAdsenseToday = rows.reduce((s, r) => s + (r.adsense_earnings_today ?? 0), 0);
  const totalAdsenseImprToday = rows.reduce((s, r) => s + (r.adsense_impressions_today ?? 0), 0);
  const totalAdsenseClkToday = rows.reduce((s, r) => s + (r.adsense_clicks_today ?? 0), 0);
  const totalAdsenseEarnings = rows.reduce((s, r) => s + (r.adsense_earnings_7d ?? 0), 0);
  const totalAdsenseImpr = rows.reduce((s, r) => s + (r.adsense_impressions_7d ?? 0), 0);
  const totalAdsensePV = rows.reduce((s, r) => s + (r.adsense_page_views_7d ?? 0), 0);
  const totalBingImpr = rows.reduce((s, r) => s + (r.bing_impressions_7d ?? 0), 0);
  const totalLive5 = rows.reduce((s, r) => s + (r.ga4_active_5min ?? 0), 0);
  const totalLive30 = rows.reduce((s, r) => s + (r.ga4_active_30min ?? 0), 0);
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
      `}</style>
      {/* Column-group toggles */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Show:</span>
        {(['live', 'gsc', 'adsense', 'bing'] as ColGroup[]).map(g => (
          <button key={g} type="button" onClick={() => toggle(g)}
            style={{
              padding: '3px 9px', borderRadius: 4,
              background: cols[g] ? 'var(--bg-2)' : 'transparent',
              border: `1px solid ${cols[g] ? 'var(--line)' : 'transparent'}`,
              color: cols[g] ? 'var(--fg-1)' : 'var(--fg-3)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
            {cols[g] ? '✓ ' : '+ '}{g}
          </button>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Site</th>
            {cols.live && <>
              <th style={{ ...head, textAlign: 'center' }} title="GA4 Realtime: active users in the last 5 minutes (updates every 5 min)">
                <span className="live-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 0 rgba(34,197,94,0.7)' }} />
              </th>
              <th style={head} title="GA4 Realtime: active users in the last 30 minutes">
                <span className="live-dot" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#22c55e', verticalAlign: 'middle', marginRight: 4, boxShadow: '0 0 0 0 rgba(34,197,94,0.7)' }} />
                30m
              </th>
            </>}
            {cols.gsc && <>
              <th style={head}>Impr 7d</th>
              <th style={{ ...head, padding: '5px 4px' }}>30d trend</th>
              <th style={head}>Clicks 7d</th>
              <th style={head}>CTR</th>
              <th style={head}>Avg Pos</th>
              <th style={head}>Pages</th>
              <th style={head}>Sitemap</th>
            </>}
            {cols.adsense && <>
              <th style={head} title="AdSense earnings today (intra-day estimate, refreshed hourly)">$ TD</th>
              <th style={head} title="AdSense ad impressions today">Impr TD</th>
              <th style={head} title="AdSense clicks today">Clk TD</th>
              <th style={head} title="AdSense earnings last 7 days (USD)">$ 7d</th>
              <th style={head} title="AdSense RPM last 7 days (USD per 1k impressions)">RPM</th>
              <th style={head} title="AdSense ad impressions last 7 days">Impr</th>
              <th style={head} title="AdSense page views last 7 days">PV</th>
            </>}
            {cols.bing && <>
              <th style={head} title="Bing Webmaster Tools — impressions last 7d">Bing 7d</th>
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
              <tr key={r.domain} style={{ cursor: 'pointer' }}
                  onClick={() => setOpenDomain(r.domain)}
                  title={`Click → mở chart + top queries cho ${r.domain}`}>
                <td style={{ ...cell, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
                  {SiteCell}
                  <a href={wrapExternalUrl(`https://${r.domain}/`)} target="_blank" rel="noopener noreferrer"
                    title={`Open ${r.domain} homepage`}
                    style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>Web&nbsp;↗</a>
                  <a href={wrapExternalUrl(gscUrl)} target="_blank" rel="noopener noreferrer"
                    title={`Open ${r.domain} in Google Search Console`}
                    style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>GSC&nbsp;↗</a>
                  {r.ga4PropertyId && (
                    <a href={wrapExternalUrl(`https://analytics.google.com/analytics/web/#/p${r.ga4PropertyId}/reports/intelligenthome`)} target="_blank" rel="noopener noreferrer"
                      title={`Open ${r.domain} in Google Analytics (GA4)`}
                      style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>GA&nbsp;↗</a>
                  )}
                  <a href={wrapExternalUrl(`https://www.bing.com/webmasters/?siteUrl=${encodeURIComponent('https://' + r.domain + '/')}`)} target="_blank" rel="noopener noreferrer"
                    title={`Open ${r.domain} in Bing Webmaster Tools`}
                    style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}>Bing&nbsp;↗</a>
                </td>
                {cols.live && <>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.ga4_active_5min ?? 0) > 0), fontWeight: (r.ga4_active_5min ?? 0) > 0 ? 600 : 400 }}>
                    {r.ga4_active_5min == null ? '—' : r.ga4_active_5min > 0 ? r.ga4_active_5min.toLocaleString() : '0'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.ga4_active_30min ?? 0) > 0) }}>
                    {r.ga4_active_30min == null ? '—' : r.ga4_active_30min > 0 ? r.ga4_active_30min.toLocaleString() : '0'}
                  </td>
                </>}
                {cols.gsc && <>
                  <td style={{ ...cell, textAlign: 'right', ...tone(r.impressions_7d > 0) }}>{r.impressions_7d.toLocaleString()}</td>
                  <td style={{ ...cell, textAlign: 'center', padding: '2px 4px', width: 70 }}>
                    <Sparkline values={sparkValues} />
                  </td>
                  <td style={{ ...cell, textAlign: 'right', ...tone(r.clicks_7d > 0) }}>{r.clicks_7d.toLocaleString()}</td>
                  <td style={{ ...cell, textAlign: 'right', ...tone(ctr > 0) }}>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', ...tone(r.avg_position_7d > 0 && r.avg_position_7d < 20) }}>{r.avg_position_7d > 0 ? r.avg_position_7d.toFixed(1) : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{r.pages_with_impressions_7d}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{r.sitemap_urls_submitted.toLocaleString()}</td>
                </>}
                {cols.adsense && <>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.adsense_earnings_today ?? 0) > 0) }}>
                    {r.adsense_earnings_today == null ? '—' : fmtUsd(r.adsense_earnings_today)}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.adsense_impressions_today ?? 0) > 0) }}>
                    {r.adsense_impressions_today == null ? '—' : r.adsense_impressions_today.toLocaleString()}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.adsense_clicks_today ?? 0) > 0) }}>
                    {r.adsense_clicks_today == null ? '—' : r.adsense_clicks_today.toLocaleString()}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.adsense_earnings_7d ?? 0) > 0) }}
                      title={r.adsense_earnings_7d != null ? `Last 7d AdSense earnings` : 'No AdSense data for this site (or not in cron map)'}>
                    {r.adsense_earnings_7d == null ? '—' : fmtUsd(r.adsense_earnings_7d)}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.adsense_rpm_7d ?? 0) > 0) }}>
                    {r.adsense_rpm_7d == null ? '—' : r.adsense_rpm_7d > 0 ? `$${r.adsense_rpm_7d.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    {r.adsense_impressions_7d == null ? '—' : r.adsense_impressions_7d.toLocaleString()}
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    {r.adsense_page_views_7d == null ? '—' : r.adsense_page_views_7d.toLocaleString()}
                  </td>
                </>}
                {cols.bing && <>
                  <td style={{ ...cell, textAlign: 'right', ...tone((r.bing_impressions_7d ?? 0) > 0) }}
                    title={r.bing_clicks_7d != null ? `${r.bing_clicks_7d.toLocaleString()} clicks · ${(r.bing_feeds_indexed ?? 0).toLocaleString()} indexed via sitemap` : 'No Bing data yet — daily cron pulls from BWT'}>
                    {r.bing_impressions_7d == null ? '—' : r.bing_impressions_7d.toLocaleString()}
                  </td>
                </>}
              </tr>
            );
          })}
          <tr style={{ background: 'var(--bg-2)' }}>
            <td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>TOTAL ({rows.length})</td>
            {cols.live && <>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalLive5.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalLive30.toLocaleString()}</td>
            </>}
            {cols.gsc && <>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.imps.toLocaleString()}</td>
              <td style={{ ...cell }} />
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.clicks.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.imps > 0 ? (totals.clicks / totals.imps * 100).toFixed(2) + '%' : '—'}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.avgPos > 0 ? totals.avgPos.toFixed(1) : '—'}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.pages}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.sitemap.toLocaleString()}</td>
            </>}
            {cols.adsense && <>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalAdsenseToday > 0 ? fmtUsd(totalAdsenseToday) : '—'}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalAdsenseImprToday.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalAdsenseClkToday.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalAdsenseEarnings > 0 ? fmtUsd(totalAdsenseEarnings) : '—'}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalRpm > 0 ? `$${totalRpm.toFixed(2)}` : '—'}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalAdsenseImpr.toLocaleString()}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalAdsensePV.toLocaleString()}</td>
            </>}
            {cols.bing && <>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalBingImpr.toLocaleString()}</td>
            </>}
          </tr>
        </tbody>
      </table>

      {openDomain && (
        <GscDetailDrawer
          domain={openDomain}
          points={openPoints}
          onClose={() => setOpenDomain(null)}
        />
      )}
    </>
  );
}
