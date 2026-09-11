// GA4 audience (last 7d + the 7d before) per domain.
// Written by /opt/cgg-report/ga4-users.mjs systemd timer on as.on.tc (hourly, :20).
// activeUsers / sessions / screenPageViews for 7daysAgo..today, plus activeUsers for
// 14daysAgo..8daysAgo so the table can show a trend. This is the "is anyone coming"
// number; Realtime and Interact both read 0 for a site doing a few visits a day.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/ga4-users.json';

export interface Ga4UsersSite {
  users_7d: number;
  sessions_7d: number;
  views_7d: number;
  users_prev_7d: number;
  error?: string;
}

export interface Ga4UsersPayload {
  updated_at: string;
  period: string;
  sites: Record<string, Ga4UsersSite>;
}

export async function loadGa4Users(): Promise<Ga4UsersPayload | null> {
  try {
    const r = await fetch(URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as Ga4UsersPayload;
  } catch {
    return null;
  }
}

export function pickGa4Users(payload: Ga4UsersPayload | null, domain: string): Ga4UsersSite | null {
  if (!payload) return null;
  return payload.sites[domain.toLowerCase()] || null;
}
