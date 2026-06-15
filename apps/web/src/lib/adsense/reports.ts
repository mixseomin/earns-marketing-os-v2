// Server loader for AdSense daily revenue rows from mos2_prod.adsense_daily.
// Populated by /opt/cgg-report/adsense_check.mjs (systemd cgg-adsense-pull.timer,
// daily 09:00 UTC). One row per (account, date, site_domain). site_domain='' =
// account-wide total when AdSense returns no DOMAIN_NAME breakdown.

import { getDb } from '@mos2/db';
import { adsenseDaily, platformAccounts } from '@mos2/db';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

export type AdsenseRow = {
  date: string;             // YYYY-MM-DD
  pubId: string;
  displayName: string;
  accountId: number;
  projectId: string | null;
  siteDomain: string;
  earningsUsd: number;
  impressions: number;
  clicks: number;
  pageViews: number;
  rpmUsd: number;
  cpcUsd: number;
};

export type AdsenseSummary = {
  rows: AdsenseRow[];
  totalEarnings: number;
  totalImpressions: number;
  totalClicks: number;
  totalPageViews: number;
  avgRpm: number;
  byDate: { date: string; earnings: number; impressions: number; clicks: number }[];
  byDomain: { domain: string; earnings: number; impressions: number; rpm: number }[];
  byAccount: { pubId: string; displayName: string; earnings: number; impressions: number }[];
  windowDays: number;
};

export async function getAdsenseSummary(opts: {
  projectId?: string;
  windowDays?: number;
  includeAccountTotals?: boolean;
} = {}): Promise<AdsenseSummary> {
  const windowDays = opts.windowDays ?? 30;
  const db = getDb();
  if (!db) return emptySummary(windowDays);

  // Date filter — adsense_daily.date is a DATE column; use ISO string compare.
  const since = new Date(Date.now() - (windowDays - 1) * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);

  const conds = [gte(adsenseDaily.date, since)];
  if (opts.projectId) conds.push(eq(adsenseDaily.projectId, opts.projectId));
  // Exclude account-total rows (site_domain='') by default — they double-count
  // when we group by domain.
  if (!opts.includeAccountTotals) conds.push(sql`${adsenseDaily.siteDomain} <> ''`);

  const raw = await db
    .select({
      date: adsenseDaily.date,
      pubId: adsenseDaily.pubId,
      displayName: platformAccounts.handle,    // we'll prettify below
      accountId: adsenseDaily.accountId,
      projectId: adsenseDaily.projectId,
      siteDomain: adsenseDaily.siteDomain,
      earningsUsd: adsenseDaily.earningsUsd,
      impressions: adsenseDaily.impressions,
      clicks: adsenseDaily.clicks,
      pageViews: adsenseDaily.pageViews,
      rpmUsd: adsenseDaily.rpmUsd,
      cpcUsd: adsenseDaily.cpcUsd,
    })
    .from(adsenseDaily)
    .leftJoin(platformAccounts, eq(platformAccounts.id, adsenseDaily.accountId))
    .where(and(...conds))
    .orderBy(desc(adsenseDaily.date));

  const rows: AdsenseRow[] = raw.map(r => ({
    date: String(r.date),
    pubId: r.pubId,
    displayName: r.displayName ?? r.pubId,
    accountId: r.accountId,
    projectId: r.projectId,
    siteDomain: r.siteDomain,
    earningsUsd: parseFloat(r.earningsUsd as unknown as string) || 0,
    impressions: r.impressions,
    clicks: r.clicks,
    pageViews: r.pageViews,
    rpmUsd: parseFloat(r.rpmUsd as unknown as string) || 0,
    cpcUsd: parseFloat(r.cpcUsd as unknown as string) || 0,
  }));

  // Totals + breakdowns
  let totalEarnings = 0, totalImpressions = 0, totalClicks = 0, totalPageViews = 0;
  const byDateMap = new Map<string, { date: string; earnings: number; impressions: number; clicks: number }>();
  const byDomainMap = new Map<string, { domain: string; earnings: number; impressions: number; rpm: number }>();
  const byAccountMap = new Map<string, { pubId: string; displayName: string; earnings: number; impressions: number }>();
  for (const r of rows) {
    totalEarnings += r.earningsUsd;
    totalImpressions += r.impressions;
    totalClicks += r.clicks;
    totalPageViews += r.pageViews;
    const d = byDateMap.get(r.date) ?? { date: r.date, earnings: 0, impressions: 0, clicks: 0 };
    d.earnings += r.earningsUsd; d.impressions += r.impressions; d.clicks += r.clicks;
    byDateMap.set(r.date, d);
    if (r.siteDomain) {
      const dm = byDomainMap.get(r.siteDomain) ?? { domain: r.siteDomain, earnings: 0, impressions: 0, rpm: 0 };
      dm.earnings += r.earningsUsd; dm.impressions += r.impressions;
      byDomainMap.set(r.siteDomain, dm);
    }
    const ac = byAccountMap.get(r.pubId) ?? { pubId: r.pubId, displayName: r.displayName, earnings: 0, impressions: 0 };
    ac.earnings += r.earningsUsd; ac.impressions += r.impressions;
    byAccountMap.set(r.pubId, ac);
  }
  // Compute RPM per domain from totals (more accurate than averaging row RPMs)
  for (const dm of byDomainMap.values()) dm.rpm = dm.impressions ? (dm.earnings / dm.impressions) * 1000 : 0;
  const avgRpm = totalImpressions ? (totalEarnings / totalImpressions) * 1000 : 0;

  return {
    rows,
    totalEarnings, totalImpressions, totalClicks, totalPageViews, avgRpm,
    byDate: [...byDateMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byDomain: [...byDomainMap.values()].sort((a, b) => b.earnings - a.earnings),
    byAccount: [...byAccountMap.values()].sort((a, b) => b.earnings - a.earnings),
    windowDays,
  };
}

function emptySummary(windowDays: number): AdsenseSummary {
  return {
    rows: [], totalEarnings: 0, totalImpressions: 0, totalClicks: 0, totalPageViews: 0, avgRpm: 0,
    byDate: [], byDomain: [], byAccount: [], windowDays,
  };
}
