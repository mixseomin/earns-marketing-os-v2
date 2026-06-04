// GA4 property mapping (domain → property ID) — auto-pulled by daily cron
// `ga4-list-oauth.mjs` on as.on.tc. Listing covers ALL GA4 properties under
// htuan82@gmail.com (35 sites as of 2026-06-04).

const GA4_URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/ga4-properties.json';

export interface Ga4Payload {
  updated_at: string;
  properties: Record<string, string>;
}

export async function loadGa4Properties(): Promise<Ga4Payload | null> {
  try {
    const r = await fetch(GA4_URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as Ga4Payload;
  } catch {
    return null;
  }
}

export function pickGa4(payload: Ga4Payload | null, domain: string): string | undefined {
  if (!payload) return undefined;
  return payload.properties[domain.toLowerCase()];
}
