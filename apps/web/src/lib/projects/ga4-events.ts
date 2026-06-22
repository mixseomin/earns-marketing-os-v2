// GA4 interaction-events (last 7d) per domain.
// Written by /opt/cgg-report/ga4-events.mjs systemd timer (daily 03:15 UTC).
// Counts real UI interactions (share, save, subscribe, calc_used, compare,
// command palette, location clicks + standard enhanced-measurement clicks/
// downloads/form/video), NOT passive page_view/session_start.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/ga4-events.json';

export interface Ga4EventsSite {
  total: number;
  byEvent: Record<string, number>;
  error?: string;
}

export interface Ga4EventsPayload {
  updated_at: string;
  period: string;
  sites: Record<string, Ga4EventsSite>;
}

export async function loadGa4Events(): Promise<Ga4EventsPayload | null> {
  try {
    const r = await fetch(URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as Ga4EventsPayload;
  } catch {
    return null;
  }
}

export function pickGa4Events(payload: Ga4EventsPayload | null, domain: string): Ga4EventsSite | null {
  if (!payload) return null;
  return payload.sites[domain.toLowerCase()] || null;
}
