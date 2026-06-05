'use client';

import { useState } from 'react';
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
  impressions_7d: number;
  clicks_7d: number;
  avg_position_7d: number;
  pages_with_impressions_7d: number;
  sitemap_urls_submitted: number;
}

interface Props {
  rows: RowData[];
  timeseries: Record<string, GscDailyPoint[]>;
  totals: { imps: number; clicks: number; pages: number; sitemap: number; avgPos: number };
}

export function SeoSitesTable({ rows, timeseries, totals }: Props) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', fontWeight: 500 };
  const tone = (cond: boolean) => ({ color: cond ? 'var(--ok)' : 'var(--fg-2)' });

  const openPoints = openDomain ? timeseries[openDomain] || [] : [];

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Site</th>
            <th style={head}>Impr 7d</th>
            <th style={head}>30d trend</th>
            <th style={head}>Clicks 7d</th>
            <th style={head}>CTR</th>
            <th style={head}>Avg Pos</th>
            <th style={head}>Pages</th>
            <th style={head}>Sitemap URLs</th>
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
              <tr key={r.domain} style={{ cursor: pts.length > 1 ? 'pointer' : 'default' }}
                  onClick={() => pts.length > 1 && setOpenDomain(r.domain)}
                  title={pts.length > 1 ? `Click → mở chart 30/90d cho ${r.domain}` : ''}>
                <td style={{ ...cell, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
                  {SiteCell}
                  <a
                    href={wrapExternalUrl(`https://${r.domain}/`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${r.domain} homepage`}
                    style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}
                  >
                    Web&nbsp;↗
                  </a>
                  <a
                    href={wrapExternalUrl(gscUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${r.domain} in Google Search Console`}
                    style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}
                  >
                    GSC&nbsp;↗
                  </a>
                  {r.ga4PropertyId && (
                    <a
                      href={wrapExternalUrl(`https://analytics.google.com/analytics/web/#/p${r.ga4PropertyId}/reports/intelligenthome`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${r.domain} in Google Analytics (GA4)`}
                      style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', textDecoration: 'none', letterSpacing: '0.04em' }}
                    >
                      GA&nbsp;↗
                    </a>
                  )}
                </td>
                <td style={{ ...cell, textAlign: 'right', ...tone(r.impressions_7d > 0) }}>{r.impressions_7d.toLocaleString()}</td>
                <td style={{ ...cell, textAlign: 'center', padding: '2px 6px' }}>
                  <Sparkline values={sparkValues} />
                </td>
                <td style={{ ...cell, textAlign: 'right', ...tone(r.clicks_7d > 0) }}>{r.clicks_7d.toLocaleString()}</td>
                <td style={{ ...cell, textAlign: 'right', ...tone(ctr > 0) }}>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</td>
                <td style={{ ...cell, textAlign: 'right', ...tone(r.avg_position_7d > 0 && r.avg_position_7d < 20) }}>{r.avg_position_7d > 0 ? r.avg_position_7d.toFixed(1) : '—'}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.pages_with_impressions_7d}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.sitemap_urls_submitted.toLocaleString()}</td>
              </tr>
            );
          })}
          <tr style={{ background: 'var(--bg-2)' }}>
            <td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>TOTAL ({rows.length})</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.imps.toLocaleString()}</td>
            <td style={{ ...cell }} />
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.clicks.toLocaleString()}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.imps > 0 ? (totals.clicks / totals.imps * 100).toFixed(2) + '%' : '—'}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.avgPos > 0 ? totals.avgPos.toFixed(1) : '—'}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.pages}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totals.sitemap.toLocaleString()}</td>
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
