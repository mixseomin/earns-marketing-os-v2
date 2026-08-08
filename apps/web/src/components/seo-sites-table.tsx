'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkline } from './sparkline';
import { GscDetailDrawer } from './gsc-detail-drawer';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';
import { SiteMenu } from './site-menu';
import { ContactsDrawer } from './contacts-drawer';
import { DataTable, type DataColumn, type DataGroup } from './ui/data-table';

// Domains whose Subs number is backed by a browsable Mailjet contact list (mirrors contacts/route.ts).
const CONTACT_DOMAINS = new Set(['militarycalc.com', 'govcalcs.com', 'visagps.com', 'mintalmanac.com', 'steamsolo.com']);

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
  bing_ts_30d?: { date: string; imp: number; clicks: number }[] | null;   // 30-day daily impressions → trend sparkline
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
  // Subscribers group — email list size (per site that captures emails)
  subscribers?: number | null;
  // BL group — OUR backlink campaign (human_tasks platform_key='backlink')
  bl_total?: number | null;
  bl_done?: number | null;
  bl_inflight?: number | null;
  bl_pending?: number | null;
  bl_broken?: number | null;
  bl_by_status?: Record<string, number> | null;
  // Yandex group — Yandex Webmaster stats (CIS search engine)
  yandex_impr_7d?: number | null;
  yandex_clicks_7d?: number | null;
  yandex_in_search?: number | null;
  yandex_sqi?: number | null;
}

type ColGroup = 'live' | 'interactions' | 'gsc' | 'adsense' | 'bing' | 'bl' | 'ai' | 'subs' | 'yandex';

interface Props {
  rows: RowData[];
  timeseries: Record<string, GscDailyPoint[]>;
  totals: { imps: number; clicks: number; pages: number; sitemap: number; avgPos: number };
  initialCols?: Partial<Record<ColGroup, boolean>>;
}

// Group order = the toggle + the column render order. Colours = the SEO reference hues; the
// DataTable derives the header band + column tint + chip from these. subs/yandex off by default.
const GROUPS: DataGroup[] = [
  { key: 'live', label: 'Live', color: '#22c55e' },
  { key: 'interactions', label: 'Interact', color: '#ec4899' },
  { key: 'bing', label: 'Bing', color: '#9d6cff' },
  { key: 'bl', label: 'BL', color: '#22d3ee' },
  { key: 'gsc', label: 'GSC', color: '#3c9bff' },
  { key: 'adsense', label: 'AdSense', color: '#ffb03c' },
  { key: 'ai', label: 'AI', color: '#10b981' },
  { key: 'yandex', label: 'Yandex', color: '#fc3f1d', defaultOn: false },
  { key: 'subs', label: 'Subs', color: '#14b8a6', defaultOn: false },
];

const fmtUsd = (n: number) => (n >= 10 ? `$${n.toFixed(2)}` : n > 0 ? `$${n.toFixed(3)}` : '—');
const tone = (c: boolean) => ({ color: c ? 'var(--ok)' : 'var(--fg-2)' } as React.CSSProperties);
const lightImpr = (c: boolean): React.CSSProperties => ({ ...tone(c), fontWeight: 300 });   // impressions thin
const boldClk = (c: boolean): React.CSSProperties => ({ ...tone(c), fontWeight: 700 });      // clicks bold
const num = (n: number | null | undefined, zero = '0') => (n == null ? '—' : n > 0 ? n.toLocaleString() : zero);
const breakdown = (by: Record<string, number> | null | undefined, suffix = '') =>
  by && Object.keys(by).length
    ? Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ') + suffix
    : null;
const sum = (rows: RowData[], pick: (r: RowData) => number | null | undefined) => rows.reduce((s, r) => s + (pick(r) ?? 0), 0);

export function SeoSitesTable({ rows, timeseries, totals, initialCols }: Props) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [openSrc, setOpenSrc] = useState<'google' | 'bing'>('google');
  const [contactsDomain, setContactsDomain] = useState<string | null>(null);
  // Client-only clock for per-site review countdowns (avoids SSR/CSR hydration mismatch).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { setNowMs(Date.now()); }, []);

  const openTool = (u: string | null) => { if (u) window.open(u, '_blank', 'noopener,noreferrer'); };
  const openDrawer = (domain: string, src: 'google' | 'bing') => { setOpenSrc(src); setOpenDomain(domain); };
  const gaUrl = (r: RowData) => (r.ga4PropertyId ? `https://analytics.google.com/analytics/web/#/p${r.ga4PropertyId}/reports/intelligenthome` : null);
  const enc = (r: RowData) => encodeURIComponent('https://' + r.domain + '/');
  const scEnc = (r: RowData) => encodeURIComponent('sc-domain:' + r.domain);
  const gscConsole = (r: RowData) => `https://search.google.com/search-console?resource_id=${scEnc(r)}`;
  const gscKeywords = (r: RowData) => `https://search.google.com/search-console/performance/search-analytics?resource_id=${scEnc(r)}`;
  const bingConsole = (r: RowData) => `https://www.bing.com/webmasters/?siteUrl=${enc(r)}`;
  const bingKeywords = (r: RowData) => `https://www.bing.com/webmasters/searchperformance?siteUrl=${enc(r)}`;
  const bingBacklinks = (r: RowData) => `https://www.bing.com/webmasters/backlinks?siteUrl=${enc(r)}`;
  const yandexUrl = (r: RowData) => `https://webmaster.yandex.com/site/https:${r.domain}:443/dashboard/`;
  const blUrl = (r: RowData) => (r.project ? `/p/${r.project}/backlinks` : null);
  const adsenseHome = 'https://www.google.com/adsense/new/u/0/home';
  const canViewContacts = (r: RowData) => CONTACT_DOMAINS.has(r.domain) && (r.subscribers ?? 0) > 0;

  const columns: DataColumn<RowData>[] = [
    // ── Site (always shown; clicking the cell does nothing — the Link + menu handle their own clicks) ──
    {
      key: 'site', sortValue: (r) => r.domain, align: 'left', width: '100%', header: 'Site',
      cell: (r) => (
        <>
          {r.project
            ? <Link href={`/p/${r.project}`} style={{ color: 'var(--fg-1)', textDecoration: 'none', fontWeight: 600 }}>{r.emoji} {r.domain}</Link>
            : <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{r.emoji} {r.domain}</span>}
          <SiteMenu domain={r.domain} project={r.project} ga4PropertyId={r.ga4PropertyId}
            onOpenDetail={() => openDrawer(r.domain, 'google')} />
        </>
      ),
      total: (rows) => `TOTAL (${rows.length})`,
    },

    // ── Live (GA4 realtime) ──
    {
      key: 'live5', sortValue: (r) => r.ga4_active_5min ?? null, group: 'live', align: 'right', headerAlign: 'center',
      header: <span className="live-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 0 rgba(34,197,94,0.7)' }} />,
      title: 'GA4 Realtime: active users in the last 5 minutes (updates every 5 min)',
      cell: (r) => <span style={{ ...tone((r.ga4_active_5min ?? 0) > 0), fontWeight: (r.ga4_active_5min ?? 0) > 0 ? 600 : 400 }}>{num(r.ga4_active_5min)}</span>,
      onCellClick: (r) => openTool(gaUrl(r)),
      total: (rows) => sum(rows, (r) => r.ga4_active_5min).toLocaleString(),
    },
    {
      key: 'live30', sortValue: (r) => r.ga4_active_30min ?? null, group: 'live', header: <span className="live-text">30m</span>,
      title: 'GA4 Realtime: active users in the last 30 minutes',
      cell: (r) => <span style={tone((r.ga4_active_30min ?? 0) > 0)}>{num(r.ga4_active_30min)}</span>,
      onCellClick: (r) => openTool(gaUrl(r)),
      total: (rows) => sum(rows, (r) => r.ga4_active_30min).toLocaleString(),
    },

    // ── Interactions (GA4 custom events, 7d) ──
    {
      key: 'interactions', sortValue: (r) => r.ga4_interactions_7d ?? null, group: 'interactions', header: 'Inter',
      title: 'GA4 interaction events last 7 days: share, save, subscribe, calc_used, compare, command palette, location clicks + outbound clicks/downloads/forms. Hover a row for the per-event breakdown. Sites show 0 until their UI is instrumented.',
      cell: (r) => <span style={{ ...tone((r.ga4_interactions_7d ?? 0) > 0), fontWeight: (r.ga4_interactions_7d ?? 0) > 0 ? 600 : 400 }}>{num(r.ga4_interactions_7d)}</span>,
      cellTitle: (r) => breakdown(r.ga4_interactions_by) ?? 'No GA4 interaction events in last 7d (site not instrumented or no activity yet)',
      onCellClick: (r) => openTool(gaUrl(r)),
      total: (rows) => sum(rows, (r) => r.ga4_interactions_7d).toLocaleString(),
    },

    // ── Bing ──
    {
      key: 'bing_impr', sortValue: (r) => r.bing_impressions_7d ?? null, group: 'bing', header: 'Impr', title: 'Bing impressions last 7 days · click a cell → Bing search keywords',
      cell: (r) => <span style={lightImpr((r.bing_impressions_7d ?? 0) > 0)}>{r.bing_impressions_7d == null ? '—' : r.bing_impressions_7d.toLocaleString()}</span>,
      cellTitle: () => 'Bing impressions (7d) · click → Bing search keywords (Search Performance)',
      onCellClick: (r) => openTool(bingKeywords(r)),
      total: (rows) => sum(rows, (r) => r.bing_impressions_7d).toLocaleString(),
    },
    {
      key: 'bing_trend', group: 'bing', align: 'center', width: 70, header: 'Trend', title: '30-day Bing impressions trend sparkline',
      cell: (r) => <Sparkline values={(r.bing_ts_30d || []).slice(-30).map((p) => p.imp)} color="#9d6cff" />,
      onCellClick: (r) => openDrawer(r.domain, 'bing'),
    },
    {
      key: 'bing_clk', sortValue: (r) => r.bing_clicks_7d ?? null, group: 'bing', header: 'Clk', title: 'Bing clicks last 7 days',
      cell: (r) => <span style={boldClk((r.bing_clicks_7d ?? 0) > 0)}>{r.bing_clicks_7d == null ? '—' : r.bing_clicks_7d.toLocaleString()}</span>,
      onCellClick: (r) => openTool(bingConsole(r)),
      total: (rows) => sum(rows, (r) => r.bing_clicks_7d).toLocaleString(),
    },
    {
      key: 'bing_idx', sortValue: (r) => r.bing_in_index ?? null, group: 'bing', header: 'Idx', title: 'Pages currently in the Bing index (latest snapshot)',
      cell: (r) => <span style={tone((r.bing_in_index ?? 0) > 0)}>{r.bing_in_index == null ? '—' : r.bing_in_index.toLocaleString()}</span>,
      cellTitle: (r) => `Indexed pages (latest snapshot) · ${(r.bing_crawled_30d ?? 0).toLocaleString()} crawled in 30d · ${(r.bing_feeds_indexed ?? 0).toLocaleString()} via sitemap`,
      onCellClick: (r) => openTool(bingConsole(r)),
      total: (rows) => sum(rows, (r) => r.bing_in_index).toLocaleString(),
    },
    {
      key: 'bing_links', sortValue: (r) => r.bing_in_links ?? null, group: 'bing', header: 'Links', title: 'Inbound links (backlinks) — Bing count · click a cell → Bing Backlinks report',
      cell: (r) => <span style={{ ...tone((r.bing_in_links ?? 0) > 0), textDecoration: (r.bing_in_links ?? 0) > 0 ? 'underline dotted' : undefined, textUnderlineOffset: 3 }}>{r.bing_in_links == null ? '—' : r.bing_in_links.toLocaleString()}</span>,
      cellTitle: () => 'Backlinks (Bing count) · click → Bing Backlinks report',
      onCellClick: (r) => openTool(bingBacklinks(r)),
      total: (rows) => sum(rows, (r) => r.bing_in_links).toLocaleString(),
    },
    {
      key: 'bing_4xx', sortValue: (r) => r.bing_errors_4xx_30d ?? null, group: 'bing', header: '4xx', title: '4xx errors Bing crawler hit in last 30 days',
      cell: (r) => <span style={{ color: (r.bing_errors_4xx_30d ?? 0) > 20 ? 'var(--warn)' : (r.bing_errors_4xx_30d ?? 0) > 0 ? 'var(--fg-2)' : 'var(--fg-3)' }}>{num(r.bing_errors_4xx_30d)}</span>,
      cellTitle: (r) => (r.bing_errors_4xx_30d ?? 0) > 20 ? 'Many 4xx errors — check Bing Webmaster crawl report' : 'Bing crawler 4xx hits in last 30 days',
      onCellClick: (r) => openTool(bingConsole(r)),
      total: (rows) => sum(rows, (r) => r.bing_errors_4xx_30d).toLocaleString(),
    },

    // ── BL (our backlink campaign) ──
    {
      key: 'bl', sortValue: (r) => r.bl_done ?? null, group: 'bl', header: 'BL', title: "OUR backlink campaign: links landed / total tasks for this site. Hover a cell for the status breakdown · click → the site's backlink board",
      cell: (r) => (!r.bl_total ? <span style={tone(false)}>—</span> : (
        <span style={tone((r.bl_done ?? 0) > 0)}>{r.bl_done ?? 0}/{r.bl_total}{(r.bl_inflight ?? 0) > 0 && <span style={{ color: '#22d3ee', opacity: 0.75, fontSize: '0.85em', marginLeft: 3 }} title="submitted / claimed — worked, not yet confirmed live">+{r.bl_inflight}</span>}</span>
      )),
      cellTitle: (r) => r.bl_total
        ? `Our backlink campaign — ${r.bl_done ?? 0} live of ${r.bl_total} tasks · ` + Object.entries(r.bl_by_status || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') + (r.project ? ' · click → backlink board' : '')
        : 'No backlink task targets this site yet',
      onCellClick: (r) => openTool(blUrl(r)),
      total: (rows) => {
        const done = sum(rows, (r) => r.bl_done), tot = sum(rows, (r) => r.bl_total), inflight = sum(rows, (r) => r.bl_inflight);
        return <span title={`Portfolio backlink campaign — ${done} live · ${inflight} in-flight (submitted/claimed) of ${tot} tasks`}>{done}/{tot}{inflight > 0 && <span style={{ opacity: 0.75, fontSize: '0.85em', marginLeft: 3 }}>+{inflight}</span>}</span>;
      },
    },

    // ── GSC ──
    {
      key: 'gsc_impr', sortValue: (r) => r.impressions_7d, group: 'gsc', header: 'Impr', title: 'GSC impressions last 7 days · click a cell → Google keywords (Performance)',
      cell: (r) => <span style={lightImpr(r.impressions_7d > 0)}>{r.impressions_7d.toLocaleString()}</span>,
      cellTitle: () => 'GSC impressions (7d) · click → Google keywords (Search Console Performance)',
      onCellClick: (r) => openTool(gscKeywords(r)),
      total: () => totals.imps.toLocaleString(),
    },
    {
      key: 'gsc_trend', group: 'gsc', align: 'center', width: 70, header: 'Trend', title: '30-day impressions trend sparkline',
      cell: (r) => <Sparkline values={(timeseries[r.domain] || []).slice(-30).map((p) => p.impressions)} />,
      onCellClick: (r) => openDrawer(r.domain, 'google'),
    },
    {
      key: 'gsc_clk', sortValue: (r) => r.clicks_7d, group: 'gsc', header: 'Clk', title: 'GSC clicks last 7 days',
      cell: (r) => <span style={boldClk(r.clicks_7d > 0)}>{r.clicks_7d.toLocaleString()}</span>,
      onCellClick: (r) => openTool(gscConsole(r)),
      total: () => totals.clicks.toLocaleString(),
    },
    {
      key: 'gsc_ctr', sortValue: (r) => r.impressions_7d ? r.clicks_7d / r.impressions_7d : null, group: 'gsc', header: 'CTR', title: 'Click-through rate last 7 days',
      cell: (r) => { const ctr = r.impressions_7d ? (r.clicks_7d / r.impressions_7d * 100) : 0; return <span style={tone(ctr > 0)}>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</span>; },
      onCellClick: (r) => openTool(gscConsole(r)),
      total: () => totals.imps > 0 ? (totals.clicks / totals.imps * 100).toFixed(2) + '%' : '—',
    },
    {
      key: 'gsc_pos', sortValue: (r) => r.avg_position_7d > 0 ? r.avg_position_7d : null, group: 'gsc', header: 'Pos', title: 'Average search position last 7 days',
      cell: (r) => <span style={tone(r.avg_position_7d > 0 && r.avg_position_7d < 20)}>{r.avg_position_7d > 0 ? r.avg_position_7d.toFixed(1) : '—'}</span>,
      onCellClick: (r) => openTool(gscConsole(r)),
      total: () => totals.avgPos > 0 ? totals.avgPos.toFixed(1) : '—',
    },
    {
      key: 'gsc_pages', sortValue: (r) => r.pages_with_impressions_7d, group: 'gsc', header: 'Pages', title: 'Pages with at least 1 impression last 7 days',
      cell: (r) => r.pages_with_impressions_7d,
      onCellClick: (r) => openTool(gscConsole(r)),
      total: () => totals.pages,
    },
    {
      key: 'gsc_sites', sortValue: (r) => r.sitemap_urls_submitted, group: 'gsc', header: 'Sites', title: 'URLs submitted via sitemap',
      cell: (r) => r.sitemap_urls_submitted.toLocaleString(),
      onCellClick: (r) => openTool(gscConsole(r)),
      total: () => totals.sitemap.toLocaleString(),
    },

    // ── AdSense ──
    {
      key: 'ad_td', sortValue: (r) => r.adsense_earnings_today ?? null, group: 'adsense', header: '$ TD', title: 'AdSense earnings today (intra-day estimate, refreshed hourly)',
      cell: (r) => <span style={tone((r.adsense_earnings_today ?? 0) > 0)}>{r.adsense_earnings_today == null ? '—' : fmtUsd(r.adsense_earnings_today)}</span>,
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => { const t = sum(rows, (r) => r.adsense_earnings_today); return t > 0 ? fmtUsd(t) : '—'; },
    },
    {
      key: 'ad_impr_td', sortValue: (r) => r.adsense_impressions_today ?? null, group: 'adsense', header: 'Impr TD', title: 'AdSense ad impressions today',
      cell: (r) => <span style={tone((r.adsense_impressions_today ?? 0) > 0)}>{num(r.adsense_impressions_today)}</span>,
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => sum(rows, (r) => r.adsense_impressions_today).toLocaleString(),
    },
    {
      key: 'ad_clk_td', sortValue: (r) => r.adsense_clicks_today ?? null, group: 'adsense', header: 'Clk TD', title: 'AdSense clicks today',
      cell: (r) => <span style={tone((r.adsense_clicks_today ?? 0) > 0)}>{num(r.adsense_clicks_today)}</span>,
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => sum(rows, (r) => r.adsense_clicks_today).toLocaleString(),
    },
    {
      key: 'ad_7d', sortValue: (r) => r.adsense_earnings_7d ?? null, group: 'adsense', header: '$ 7d', title: 'AdSense earnings last 7 days (USD)',
      cell: (r) => <span style={tone((r.adsense_earnings_7d ?? 0) > 0)}>{r.adsense_earnings_7d == null ? '—' : fmtUsd(r.adsense_earnings_7d)}</span>,
      cellTitle: (r) => r.adsense_earnings_7d != null ? 'Last 7d AdSense earnings' : 'No AdSense data for this site (or not in cron map)',
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => { const t = sum(rows, (r) => r.adsense_earnings_7d); return t > 0 ? fmtUsd(t) : '—'; },
    },
    {
      key: 'ad_rpm', sortValue: (r) => r.adsense_rpm_7d ?? null, group: 'adsense', header: 'RPM', title: 'AdSense RPM last 7 days (USD per 1k impressions)',
      cell: (r) => <span style={tone((r.adsense_rpm_7d ?? 0) > 0)}>{r.adsense_rpm_7d == null || r.adsense_rpm_7d <= 0 ? '—' : `$${r.adsense_rpm_7d.toFixed(2)}`}</span>,
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => { const impr = sum(rows, (r) => r.adsense_impressions_7d), earn = sum(rows, (r) => r.adsense_earnings_7d); const rpm = impr > 0 ? (earn / impr) * 1000 : 0; return rpm > 0 ? `$${rpm.toFixed(2)}` : '—'; },
    },
    {
      key: 'ad_impr', sortValue: (r) => r.adsense_impressions_7d ?? null, group: 'adsense', header: 'Impr', title: 'AdSense ad impressions last 7 days',
      cell: (r) => (r.adsense_impressions_7d == null ? '—' : r.adsense_impressions_7d.toLocaleString()),
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => sum(rows, (r) => r.adsense_impressions_7d).toLocaleString(),
    },
    {
      key: 'ad_pv', sortValue: (r) => r.adsense_page_views_7d ?? null, group: 'adsense', header: 'PV', title: 'AdSense page views last 7 days',
      cell: (r) => (r.adsense_page_views_7d == null ? '—' : r.adsense_page_views_7d.toLocaleString()),
      onCellClick: () => openTool(adsenseHome),
      total: (rows) => sum(rows, (r) => r.adsense_page_views_7d).toLocaleString(),
    },

    // ── AI answer-engine referrals ──
    {
      key: 'ai_7d', sortValue: (r) => r.ai_sessions_7d ?? null, group: 'ai', header: 'AI 7d',
      title: 'Sessions referred by an AI answer engine (ChatGPT, Perplexity, Gemini, Copilot, Claude) in the last 7 days — GA4 sessionSource. Tier-3 proof of LLM SEO: the engine cited the page AND a human clicked through.',
      cell: (r) => <span style={{ ...tone((r.ai_sessions_7d ?? 0) > 0), fontWeight: (r.ai_sessions_7d ?? 0) > 0 ? 600 : 400 }}>{num(r.ai_sessions_7d)}</span>,
      cellTitle: (r) => breakdown(r.ai_by_engine, ' (28d)') ?? 'No AI answer-engine referrals yet (ChatGPT/Perplexity/Gemini/Copilot/Claude). Crawl can be active before clicks appear.',
      onCellClick: (r) => openTool(gaUrl(r)),
      total: (rows) => sum(rows, (r) => r.ai_sessions_7d).toLocaleString(),
    },
    {
      key: 'ai_28d', sortValue: (r) => r.ai_sessions_28d ?? null, group: 'ai', header: 'AI 28d', title: 'AI answer-engine referred sessions, last 28 days. Hover a row for the per-engine breakdown.',
      cell: (r) => <span style={tone((r.ai_sessions_28d ?? 0) > 0)}>{num(r.ai_sessions_28d)}</span>,
      cellTitle: (r) => breakdown(r.ai_by_engine, ' (28d)') ?? 'No AI referrals in last 28d',
      onCellClick: (r) => openTool(gaUrl(r)),
      total: (rows) => sum(rows, (r) => r.ai_sessions_28d).toLocaleString(),
    },
    {
      key: 'ai_review', sortValue: (r) => r.review ?? null, group: 'ai', header: 'Review', title: 'Manual review/checkpoint per site — countdown to the next scheduled SEO/AI review.',
      cellTitle: (r) => r.review ? `Next review: ${r.review}` : 'No review scheduled',
      cell: (r) => {
        if (!r.review) return <span style={{ color: 'var(--fg-3)' }}>—</span>;
        if (nowMs == null) return <span style={{ color: 'var(--fg-3)' }}>·</span>;
        const days = Math.ceil((new Date(r.review + 'T00:00:00Z').getTime() - nowMs) / 86400000);
        const color = days < 0 ? '#f87171' : days <= 7 ? '#e3b341' : 'var(--fg-2)';
        const label = days < 0 ? `${-days}d late` : days === 0 ? 'today' : `${days}d`;
        return <span style={{ color, fontWeight: days <= 7 ? 700 : 400 }}>⏰ {label}</span>;
      },
      onCellClick: (r) => openTool(gaUrl(r)),
    },

    // ── Yandex ──
    {
      key: 'ya_impr', sortValue: (r) => r.yandex_impr_7d ?? null, group: 'yandex', header: 'Impr', title: 'Yandex impressions last 7 days (Yandex Webmaster / CIS). New hosts show — for a few days after being added.',
      cell: (r) => <span style={tone((r.yandex_impr_7d ?? 0) > 0)}>{r.yandex_impr_7d == null ? '—' : r.yandex_impr_7d.toLocaleString()}</span>,
      onCellClick: (r) => openTool(yandexUrl(r)),
      total: (rows) => sum(rows, (r) => r.yandex_impr_7d).toLocaleString(),
    },
    {
      key: 'ya_clk', sortValue: (r) => r.yandex_clicks_7d ?? null, group: 'yandex', header: 'Clk', title: 'Yandex clicks last 7 days',
      cell: (r) => <span style={tone((r.yandex_clicks_7d ?? 0) > 0)}>{r.yandex_clicks_7d == null ? '—' : r.yandex_clicks_7d.toLocaleString()}</span>,
      onCellClick: (r) => openTool(yandexUrl(r)),
      total: (rows) => sum(rows, (r) => r.yandex_clicks_7d).toLocaleString(),
    },
    {
      key: 'ya_idx', sortValue: (r) => r.yandex_in_search ?? null, group: 'yandex', header: 'Idx', title: 'Pages in the Yandex search index',
      cell: (r) => <span style={tone((r.yandex_in_search ?? 0) > 0)}>{r.yandex_in_search == null ? '—' : r.yandex_in_search.toLocaleString()}</span>,
      onCellClick: (r) => openTool(yandexUrl(r)),
      total: (rows) => sum(rows, (r) => r.yandex_in_search).toLocaleString(),
    },
    {
      key: 'ya_sqi', sortValue: (r) => r.yandex_sqi ?? null, group: 'yandex', header: 'SQI', title: 'Yandex Site Quality Index (SQI)',
      cell: (r) => (r.yandex_sqi == null ? '—' : r.yandex_sqi.toLocaleString()),
      onCellClick: (r) => openTool(yandexUrl(r)),
    },

    // ── Subs (email list) ──
    {
      key: 'subs', sortValue: (r) => r.subscribers ?? null, group: 'subs', header: 'Subs', title: 'Email subscribers (list size). Sites show — until they capture emails; add the site to /opt/cgg-report/subs-pull.mjs as it gets a subscribe form.',
      cell: (r) => <span style={{ ...tone((r.subscribers ?? 0) > 0), fontWeight: (r.subscribers ?? 0) > 0 ? 600 : 400, ...(canViewContacts(r) ? { textDecoration: 'underline', textUnderlineOffset: 2 } : {}) }}>{r.subscribers == null ? '—' : r.subscribers.toLocaleString()}</span>,
      cellTitle: (r) => r.subscribers == null ? 'No email capture on this site yet' : canViewContacts(r) ? `${r.subscribers.toLocaleString()} contacts — click to view the list` : `${r.subscribers.toLocaleString()} email subscribers`,
      onCellClick: (r) => { if (canViewContacts(r)) setContactsDomain(r.domain); },
      total: (rows) => sum(rows, (r) => r.subscribers).toLocaleString(),
    },
  ];

  const openPoints = openDomain ? timeseries[openDomain] || [] : [];
  const openBing = openDomain ? (rows.find((r) => r.domain === openDomain)?.bing_ts_30d || []) : [];

  return (
    <>
      <style>{`
        @keyframes live-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70%  { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .live-dot { animation: live-pulse 1.6s infinite; }
        @keyframes live-text-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .live-text { animation: live-text-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.domain}
        groups={GROUPS}
        persistKey="seo_cols"
        initialShown={initialCols}
        minWidth={640}
        rowTitle={(r) => `Ô số → mở tool (GSC/GA/Bing) · ô chart → chi tiết ${r.domain}`}
      />

      {openDomain && (
        <GscDetailDrawer
          key={openDomain + openSrc}
          domain={openDomain}
          points={openPoints}
          bingPoints={openBing}
          initialSrc={openSrc}
          interactions={rows.find((r) => r.domain === openDomain)?.ga4_interactions_by ?? null}
          onClose={() => setOpenDomain(null)}
        />
      )}
      {contactsDomain && <ContactsDrawer domain={contactsDomain} onClose={() => setContactsDomain(null)} />}
    </>
  );
}
