// Helper for SeoSitesTable: domain → AdSense KPIs (7d). Pulls from
// adsense_daily where site_domain ≠ '' (skips account-wide totals).

import { getDb, adsenseDaily } from '@mos2/db';
import { and, gte, ne, sql } from 'drizzle-orm';

export type AdsenseByDomain = {
  earnings_usd: number;
  impressions: number;
  clicks: number;
  page_views: number;
  rpm_usd: number;
  earnings_today_usd: number;        // today's intra-day estimate (refreshed hourly)
  impressions_today: number;
  page_views_today: number;
};

export async function loadAdsenseByDomain(windowDays = 7): Promise<Record<string, AdsenseByDomain>> {
  const db = getDb();
  if (!db) return {};
  const since = new Date(Date.now() - (windowDays - 1) * 24 * 3600 * 1000).toISOString().slice(0, 10);
  try {
    const rows = await db
      .select({
        domain: adsenseDaily.siteDomain,
        earnings: sql<number>`SUM(${adsenseDaily.earningsUsd}::numeric)`.as('earnings'),
        impressions: sql<number>`SUM(${adsenseDaily.impressions})::int`.as('impressions'),
        clicks: sql<number>`SUM(${adsenseDaily.clicks})::int`.as('clicks'),
        pageViews: sql<number>`SUM(${adsenseDaily.pageViews})::int`.as('page_views'),
      })
      .from(adsenseDaily)
      .where(and(gte(adsenseDaily.date, since), ne(adsenseDaily.siteDomain, '')))
      .groupBy(adsenseDaily.siteDomain);
    // Second query: TODAY only (live intra-day estimate refreshed by hourly cron)
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = await db
      .select({
        domain: adsenseDaily.siteDomain,
        earnings: sql<number>`SUM(${adsenseDaily.earningsUsd}::numeric)`.as('earnings'),
        impressions: sql<number>`SUM(${adsenseDaily.impressions})::int`.as('impressions'),
        pageViews: sql<number>`SUM(${adsenseDaily.pageViews})::int`.as('page_views'),
      })
      .from(adsenseDaily)
      .where(and(gte(adsenseDaily.date, today), ne(adsenseDaily.siteDomain, '')))
      .groupBy(adsenseDaily.siteDomain);
    const byDomainToday: Record<string, { earn: number; impr: number; pv: number }> = {};
    for (const r of todayRows) {
      byDomainToday[r.domain] = {
        earn: parseFloat(r.earnings as unknown as string) || 0,
        impr: r.impressions || 0,
        pv: r.pageViews || 0,
      };
    }

    const out: Record<string, AdsenseByDomain> = {};
    for (const r of rows) {
      const earn = parseFloat(r.earnings as unknown as string) || 0;
      const impr = r.impressions || 0;
      const td = byDomainToday[r.domain] || { earn: 0, impr: 0, pv: 0 };
      out[r.domain] = {
        earnings_usd: earn,
        impressions: impr,
        clicks: r.clicks || 0,
        page_views: r.pageViews || 0,
        rpm_usd: impr > 0 ? (earn / impr) * 1000 : 0,
        earnings_today_usd: td.earn,
        impressions_today: td.impr,
        page_views_today: td.pv,
      };
    }
    return out;
  } catch {
    return {};
  }
}
