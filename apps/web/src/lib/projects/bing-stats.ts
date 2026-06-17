// Reads bing-latest.json (written by /opt/cgg-report/bing-check.mjs daily).
// Same shape pattern as gsc-latest.json and ga4-properties.json.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/bing-latest.json';

export type BingTrafficPoint = { date: string; clicks: number; imp: number };
export type BingCrawlPoint   = { date: string; crawled: number; in_index: number; code4xx: number; code5xx: number; robots_blocked: number };

export type BingSiteStats = {
  clicks_7d: number;
  impressions_7d: number;
  clicks_30d: number;
  impressions_30d: number;
  days_with_data: number;
  last_data_date: string | null;
  feeds_count: number;
  feeds_urls_indexed: number;
  // NEW (2026-06-17) — rich crawl + timeseries
  ts_30d?: BingTrafficPoint[];
  crawl_30d?: BingCrawlPoint[];
  crawled_pages_30d?: number;
  errors_4xx_30d?: number;
  errors_5xx_30d?: number;
  robots_blocked_30d?: number;
  in_index?: number;
  in_links?: number;
  last_crawled?: number;
  error?: string | null;
  crawl_error?: string;
};

export type BingPayload = {
  updated_at: string;
  sites: Record<string, BingSiteStats>;
};

export async function loadBingStats(): Promise<BingPayload | null> {
  try {
    const r = await fetch(URL, { next: { revalidate: 600, tags: ['bing-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as BingPayload;
  } catch {
    return null;
  }
}

export function pickBing(payload: BingPayload | null, domain: string): BingSiteStats | undefined {
  if (!payload) return undefined;
  return payload.sites[domain];
}
