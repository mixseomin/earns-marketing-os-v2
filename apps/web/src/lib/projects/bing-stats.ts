// Reads bing-latest.json (written by /opt/cgg-report/bing-check.mjs daily).
// Same shape pattern as gsc-latest.json and ga4-properties.json.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/bing-latest.json';

export type BingSiteStats = {
  clicks_7d: number;
  impressions_7d: number;
  clicks_30d: number;
  impressions_30d: number;
  days_with_data: number;
  last_data_date: string | null;
  feeds_count: number;
  feeds_urls_indexed: number;
  error?: string;
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
