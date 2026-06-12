import { NextResponse } from 'next/server';

// Free keyword research via Bing Webmaster GetKeywordStats.
// Returns 24 months of monthly impression history per query — exact + broad match.
// Replacement for paid keyword-volume tools when researching content topics.

const KEY = process.env.BING_WEBMASTER_API_KEY;

type StatsRow = {
  Date: string;
  Impressions: number;
  BroadImpressions: number;
  Query: string;
};

// /Date(1739347200000-0800)/ → ISO date string YYYY-MM-DD
function parseBingDate(s: string): string | null {
  const m = /\/Date\((\d+)/.exec(s);
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : null;
}

export async function GET(req: Request) {
  if (!KEY) return NextResponse.json({ error: 'BING_WEBMASTER_API_KEY not configured' }, { status: 500 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const country = url.searchParams.get('country') || 'us';
  const language = url.searchParams.get('language') || 'en-US';

  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const base = 'https://ssl.bing.com/webmaster/api.svc/json';
  const params = new URLSearchParams({ apikey: KEY, q, country, language });

  const [statsRes, relatedRes] = await Promise.all([
    fetch(`${base}/GetKeywordStats?${params}`, { next: { revalidate: 86400 } }),
    fetch(`${base}/GetRelatedKeywords?${params}`, { next: { revalidate: 86400 } }),
  ]);

  const statsText = (await statsRes.text()).replace(/^﻿/, '');
  const relatedText = (await relatedRes.text()).replace(/^﻿/, '');

  let history: Array<{ month: string; exact: number; broad: number }> = [];
  let related: Array<{ query: string; impressions: number; broad: number }> = [];

  try {
    const rows: StatsRow[] = JSON.parse(statsText).d || [];
    history = rows
      .map((r) => ({ month: parseBingDate(r.Date)?.slice(0, 7) || '', exact: r.Impressions, broad: r.BroadImpressions }))
      .filter((r) => r.month);
  } catch {}

  try {
    const rows = JSON.parse(relatedText).d || [];
    related = rows.map((r: { Query: string; Impressions: number; BroadImpressions: number }) => ({
      query: r.Query,
      impressions: r.Impressions,
      broad: r.BroadImpressions,
    }));
  } catch {}

  const last3 = history.slice(-3);
  const avgExact = last3.length ? Math.round(last3.reduce((s, r) => s + r.exact, 0) / last3.length) : 0;
  const avgBroad = last3.length ? Math.round(last3.reduce((s, r) => s + r.broad, 0) / last3.length) : 0;

  return NextResponse.json({
    query: q,
    country,
    language,
    avg_exact_3mo: avgExact,
    avg_broad_3mo: avgBroad,
    history,
    related,
  });
}
