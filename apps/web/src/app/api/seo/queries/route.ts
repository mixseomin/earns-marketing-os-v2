import { NextResponse } from 'next/server';
import { getGscAccessToken } from '@/lib/gsc-oauth';

// Top queries per site over last N days. Hit on-demand from the SEO drawer
// so we don't bloat the daily cron payload — query data is rarely viewed.

const BING_KEY = process.env.BING_WEBMASTER_API_KEY;

async function gscQueries(domain: string, days: number) {
  const token = await getGscAccessToken();
  if (!token) return [];

  const today = new Date();
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // Try sc-domain first (covers https + http + www); fall back to https://.
  for (const property of [`sc-domain:${domain}`, `https://${domain}/`]) {
    const r = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: iso(start),
          endDate: iso(today),
          dimensions: ['query'],
          rowLimit: 25,
          dataState: 'all',
        }),
      },
    );
    if (!r.ok) continue;
    const j = await r.json();
    if (!j.rows) continue;
    return j.rows.map((row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  }
  return [];
}

// Bing top queries — usually empty for newly-verified sites; still try.
async function bingQueries(domain: string) {
  if (!BING_KEY) return [];
  const url = `https://${domain}/`;
  const r = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?apikey=${BING_KEY}&siteUrl=${encodeURIComponent(url)}`);
  const text = (await r.text()).replace(/^﻿/, '');
  try {
    const arr = JSON.parse(text).d || [];
    return arr.slice(0, 25).map((row: { Query: string; Clicks: number; Impressions: number; AvgClickPosition: number; AvgImpressionPosition: number }) => ({
      query: row.Query,
      clicks: row.Clicks,
      impressions: row.Impressions,
      position: row.AvgImpressionPosition,
    }));
  } catch { return []; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = (url.searchParams.get('domain') || '').trim().toLowerCase();
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 28)));
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 });

  const [google, bing] = await Promise.all([gscQueries(domain, days), bingQueries(domain)]);
  return NextResponse.json({ domain, days, google, bing });
}
