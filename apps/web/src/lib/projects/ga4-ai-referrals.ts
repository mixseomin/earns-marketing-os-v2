// Reads ga4-ai-referrals.json (written by /opt/cgg-report/ga4-ai-referrals.mjs daily).
// Counts GA4 sessions whose sessionSource is an AI answer engine (ChatGPT, Perplexity,
// Gemini, Copilot, Claude). Powers the "AI" column in the SEO Sites Overview.
// Same shape pattern as ga4-events.json / bing-latest.json.

const URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/ga4-ai-referrals.json';

export type Ga4AiSiteStats = {
  sessions_7d: number;
  sessions_28d: number;
  byEngine_7d: Record<string, number>;
  byEngine_28d: Record<string, number>;
  error?: string;
};

export type Ga4AiPayload = {
  updated_at: string;
  period: string;
  sites: Record<string, Ga4AiSiteStats>;
};

export async function loadGa4AiReferrals(): Promise<Ga4AiPayload | null> {
  try {
    const r = await fetch(URL, { next: { revalidate: 600, tags: ['ga4-ai-json'] } });
    if (!r.ok) return null;
    return (await r.json()) as Ga4AiPayload;
  } catch {
    return null;
  }
}

export function pickGa4Ai(payload: Ga4AiPayload | null, domain: string): Ga4AiSiteStats | undefined {
  if (!payload) return undefined;
  return payload.sites[domain];
}
