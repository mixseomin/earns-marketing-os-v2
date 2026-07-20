// Email-subscriber count per domain.
// Written by /opt/cgg-report/subs-pull.mjs systemd timer (daily): polls each
// site's public count endpoint (registry in that script) and writes the JSON.
// Sites without an email-capture form simply aren't in the payload → show —.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/subscribers.json';

export interface SubscribersPayload {
  updated_at: string;
  sites: Record<string, number>;
}

export async function loadSubscribers(): Promise<SubscribersPayload | null> {
  try {
    const r = await fetch(URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as SubscribersPayload;
  } catch {
    return null;
  }
}

export function pickSubs(payload: SubscribersPayload | null, domain: string): number | null {
  if (!payload) return null;
  const v = payload.sites[domain.toLowerCase()];
  return typeof v === 'number' ? v : null;
}
