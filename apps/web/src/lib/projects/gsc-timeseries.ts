// GSC 90-day per-day time-series loader.
// Source: /usr/local/bin/gsc-timeseries.php (cron daily 06:30 +07).

const GSC_TS_URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/gsc-timeseries.json';

export interface GscDailyPoint {
  date: string;          // YYYY-MM-DD
  clicks: number;
  impressions: number;
  position: number;      // average SERP position that day
}

export interface GscSiteSeries {
  points: GscDailyPoint[];
  count: number;
}

export interface GscTimeSeriesPayload {
  updated_at: string;
  period_days: number;
  sites: Record<string, GscSiteSeries>;
}

export async function loadGscTimeSeries(): Promise<GscTimeSeriesPayload | null> {
  try {
    const r = await fetch(GSC_TS_URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as GscTimeSeriesPayload;
  } catch {
    return null;
  }
}

export function pickSiteSeries(payload: GscTimeSeriesPayload, domain: string): GscSiteSeries | null {
  const keys = [
    `sc-domain:${domain}`,
    `https://${domain}/`,
    `https://www.${domain}/`,
    `http://${domain}/`,
  ];
  for (const k of keys) {
    if (payload.sites[k]) return payload.sites[k];
  }
  return null;
}
