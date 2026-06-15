// GA4 Realtime active-users (last 5min + last 30min) per domain.
// Written by /opt/cgg-report/ga4-realtime.mjs systemd timer every 5 min.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/ga4-realtime.json';

export interface Ga4RealtimeSite {
  last5min: number;
  last30min: number;
  error?: string;
}

export interface Ga4RealtimePayload {
  updated_at: string;
  sites: Record<string, Ga4RealtimeSite>;
}

export async function loadGa4Realtime(): Promise<Ga4RealtimePayload | null> {
  try {
    // revalidate every 60s (cron updates every 5 min, so 60s window keeps it fresh enough)
    const r = await fetch(URL, { next: { revalidate: 60, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as Ga4RealtimePayload;
  } catch {
    return null;
  }
}

export function pickGa4Realtime(payload: Ga4RealtimePayload | null, domain: string): Ga4RealtimeSite | null {
  if (!payload) return null;
  return payload.sites[domain.toLowerCase()] || null;
}
