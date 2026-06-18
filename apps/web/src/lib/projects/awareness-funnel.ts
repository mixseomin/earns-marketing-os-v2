// Awareness Funnel data for cities.gg — joins Bidvertiser daily spend (from
// mos2_prod.ad_spend_daily) with GA4 channel sessions and computes the viral
// coefficient (Direct ÷ Paid). The frame is NOT ROI; it's awareness/spillover.
// Bigger Direct surge per dollar of Paid = the paid traffic is converting into
// returning + organic-sharing users.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { loadGa4Realtime, pickGa4Realtime } from './ga4-realtime';

export type FunnelDailyPoint = {
  date: string;
  paid_visits: number;
  paid_spend_usd: number;
  ga4_paid_sessions: number | null;
  ga4_direct_sessions: number | null;
  viral_ratio: number | null;
};

export type AwarenessFunnelStats = {
  spend_7d_usd: number;
  spend_30d_usd: number;
  paid_visits_7d: number;
  paid_visits_30d: number;
  ga4_paid_7d: number | null;
  ga4_direct_7d: number | null;
  viral_ratio_7d: number | null;
  realtime_5min: number | null;
  realtime_30min: number | null;
  last_day_spend_usd: number;
  last_day_paid_visits: number;
  last_day_date: string | null;
  top_countries_7d: Array<{ country: string; spend_usd: number; visits: number; cpc_usd: number }>;
  daily: FunnelDailyPoint[];
  engagement_7d: Record<string, number>;
};

async function fetchGa4Channel(domain: string, days: number, channel: string): Promise<number | null> {
  // GA4 day-by-channel JSON dropped by ga4-channel-mix cron (if running).
  // Fallback to null when not available — the UI will gracefully degrade.
  try {
    const r = await fetch(
      `https://militarymarkdown.com/wp-content/uploads/phase7/ga4-channel-mix.json`,
      { next: { revalidate: 600, tags: ['ga4-channel-mix'] } }
    );
    if (!r.ok) return null;
    const payload = await r.json();
    const site = payload?.sites?.[domain];
    if (!site) return null;
    const days_data = Array.isArray(site.days) ? site.days : [];
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    let sum = 0;
    for (const d of days_data) {
      if (d.date >= cutoff && d.channel === channel) sum += Number(d.sessions || 0);
    }
    return sum;
  } catch { return null; }
}

type DailyRow = { date: string | Date; spend: string | number | null; visits: string | number | null };
type CountryRow = { country: string; spend: string | number; visits: string | number; cpc: string | number };
type ActionRow = { action: string; n: string | number };

const DIRECTUS_BASE = 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

// Engagement events are stored in the cities.gg Directus (collection cgg_events),
// not in mos2_prod. Pull them via REST aggregate.
async function loadEngagement7d(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!DIRECTUS_TOKEN) return out;
  try {
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const url = `${DIRECTUS_BASE}/items/cgg_events?aggregate[count]=*&groupBy=action&filter[created_at][_gte]=${sevenAgo}&filter[action][_nstarts_with]=ab_&limit=-1`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      next: { revalidate: 300, tags: ['cgg-events'] },
    });
    if (!r.ok) return out;
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    for (const row of data as ActionRow[]) {
      out[row.action] = Number(row.n || 0);
    }
  } catch { /* fall through */ }
  return out;
}

export async function loadAwarenessFunnel(domain: string = 'cities.gg'): Promise<AwarenessFunnelStats | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r1 = await db.execute(sql`
      SELECT date::text AS date, SUM(spend_usd)::numeric AS spend, SUM(visits)::integer AS visits
      FROM ad_spend_daily
      WHERE network='bidvertiser' AND project_slug='cities-gg' AND date >= CURRENT_DATE - 30
      GROUP BY date ORDER BY date
    `);
    const rows1 = (r1 as unknown as DailyRow[]);
    const daily_by_date = new Map<string, { spend: number; visits: number }>();
    for (const row of rows1) {
      const d = (row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date)).slice(0, 10);
      daily_by_date.set(d, { spend: Number(row.spend || 0), visits: Number(row.visits || 0) });
    }

    const today = new Date();
    const days: FunnelDailyPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      const r = daily_by_date.get(d) || { spend: 0, visits: 0 };
      days.push({
        date: d, paid_visits: r.visits, paid_spend_usd: r.spend,
        ga4_paid_sessions: null, ga4_direct_sessions: null, viral_ratio: null,
      });
    }

    const spend_7d = days.slice(-7).reduce((s, d) => s + d.paid_spend_usd, 0);
    const spend_30d = days.reduce((s, d) => s + d.paid_spend_usd, 0);
    const visits_7d = days.slice(-7).reduce((s, d) => s + d.paid_visits, 0);
    const visits_30d = days.reduce((s, d) => s + d.paid_visits, 0);

    const r2 = await db.execute(sql`
      SELECT country, SUM(spend_usd) AS spend, SUM(visits) AS visits,
             CASE WHEN SUM(visits) > 0 THEN SUM(spend_usd) / SUM(visits) ELSE 0 END AS cpc
      FROM ad_spend_daily_country
      WHERE network='bidvertiser' AND date >= CURRENT_DATE - 7
      GROUP BY country ORDER BY SUM(visits) DESC LIMIT 12
    `);
    const top_countries_7d = (r2 as unknown as CountryRow[]).map(r => ({
      country: String(r.country),
      spend_usd: Number(r.spend),
      visits: Number(r.visits),
      cpc_usd: Number(r.cpc),
    }));

    const ga4_paid_7d = await fetchGa4Channel(domain, 7, 'Paid Other');
    const ga4_direct_7d = await fetchGa4Channel(domain, 7, 'Direct');
    const viral_ratio_7d = (ga4_paid_7d && ga4_paid_7d > 0 && ga4_direct_7d !== null)
      ? ga4_direct_7d / ga4_paid_7d : null;

    const rt = await loadGa4Realtime();
    const rtSite = rt ? pickGa4Realtime(rt, domain) : null;

    const engagement_7d = await loadEngagement7d();

    const last = days[days.length - 1];
    const yesterday = days[days.length - 2];
    const lastWithData = last && last.paid_visits > 0 ? last : (yesterday ?? last);

    return {
      spend_7d_usd: spend_7d,
      spend_30d_usd: spend_30d,
      paid_visits_7d: visits_7d,
      paid_visits_30d: visits_30d,
      ga4_paid_7d,
      ga4_direct_7d,
      viral_ratio_7d,
      realtime_5min: rtSite?.last5min ?? null,
      realtime_30min: rtSite?.last30min ?? null,
      last_day_spend_usd: lastWithData?.paid_spend_usd ?? 0,
      last_day_paid_visits: lastWithData?.paid_visits ?? 0,
      last_day_date: lastWithData?.date ?? null,
      top_countries_7d,
      daily: days,
      engagement_7d,
    };
  } catch (e) {
    console.error('[awareness-funnel] load failed', e);
    return null;
  }
}
