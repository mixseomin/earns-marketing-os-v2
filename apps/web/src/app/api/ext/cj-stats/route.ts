// GET /api/ext/cj-stats
// Live CJ pool snapshot for the cj-bulk.js panel.
//
// CJ's advertiser-lookup API only exposes 2 relationship filters: joined and
// notjoined. Pending applications "vanish" from notjoined but don't appear in
// joined yet — so we infer pending by tracking the notjoined delta over time.
//
// Returns:
//   { joined, notjoined, baselineNotjoined?, pendingEstimate, fetchedAt }
//
// Baseline (snapshot from the day applies started) is stored in-memory; if the
// route hasn't been hit yet today, the first call sets it. Future improvement:
// persist baseline to Directus or a small KV.

import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

const CJ_PAT          = process.env.CJ_PAT || '';
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID || '3877648';
const CJ_LOOKUP       = 'https://advertiser-lookup.api.cj.com/v2/advertiser-lookup';

// 60s cache to avoid hammering CJ on every panel render
let cache: { at: number; data: unknown } | null = null;
const CACHE_TTL_MS = 60_000;

// Track baseline notjoined: the earliest notjoined count we've recorded.
// In production this should live in Directus or a small KV; for v1 we keep
// it in-process and seed from CJ on first call.
let baselineNotjoined: number | null = null;

async function cjCount(rel: 'joined' | 'notjoined'): Promise<number | null> {
  const url = `${CJ_LOOKUP}?requestor-cid=${CJ_PUBLISHER_ID}&advertiser-ids=${rel}&records-per-page=1`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${CJ_PAT}` },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const xml = await r.text();
  const m = xml.match(/total-matched="(\d+)"/);
  return m && m[1] ? parseInt(m[1], 10) : null;
}

export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!CJ_PAT) return NextResponse.json({ error: 'CJ_PAT not set' }, { status: 503 });

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const [joined, notjoined] = await Promise.all([cjCount('joined'), cjCount('notjoined')]);
  if (joined === null || notjoined === null) {
    return NextResponse.json({ error: 'CJ API unreachable' }, { status: 502 });
  }

  if (baselineNotjoined === null || notjoined > baselineNotjoined) {
    // Seed/raise baseline on first call (or if pool grew). Pending estimate
    // resets when baseline rises (pool growth means new advertisers, not new applies).
    baselineNotjoined = notjoined;
  }
  const pendingEstimate = Math.max(0, baselineNotjoined - notjoined - joined);

  const data = {
    joined,
    notjoined,
    baselineNotjoined,
    pendingEstimate,
    fetchedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
