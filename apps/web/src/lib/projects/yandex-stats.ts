// Yandex Webmaster stats per domain.
// Written by /opt/cgg-report/yandex-pull.mjs (daily cron). New hosts return
// HOST_NOT_LOADED for a few days -> nulls. Sites not added to Yandex aren't in
// the payload -> show —.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/yandex-stats.json';

export interface YandexSite {
  verified?: boolean;
  impr_7d?: number | null;
  clicks_7d?: number | null;
  in_search?: number | null;
  sqi?: number | null;
}

export interface YandexPayload {
  updated_at: string;
  sites: Record<string, YandexSite>;
}

export async function loadYandexStats(): Promise<YandexPayload | null> {
  try {
    const r = await fetch(URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as YandexPayload;
  } catch {
    return null;
  }
}

export function pickYandex(payload: YandexPayload | null, domain: string): YandexSite | null {
  if (!payload) return null;
  return payload.sites[domain.toLowerCase()] || null;
}
