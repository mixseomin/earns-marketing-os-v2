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
const DIRECTUS_URL    = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN  = process.env.DIRECTUS_TOKEN || '';
const CJ_ACCOUNT_ID   = '45388bdb-ffdc-4a0d-993a-da66e3d28105';

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
    baselineNotjoined = notjoined;
  }

  // Count attempted applies recorded by cj-events endpoint.
  // - `applied_attempts`: rows whose notes contain `"result":"applied"` (ext POSTed apply event)
  // - `pending_in_directus`: rows where we flipped status to 'pending' (ext applied successfully)
  // - `auto_rejected_estimate`: applied_attempts - pending_in_directus - joined
  //   (we asked, advertiser auto-rejected → row didn't flip to pending → still 'paused')
  let appliedAttempts = 0;
  let pendingInDirectus = 0;
  if (DIRECTUS_TOKEN) {
    try {
      const [a, p] = await Promise.all([
        fetch(`${DIRECTUS_URL}/items/affiliate_programs?filter[account_id][_eq]=${CJ_ACCOUNT_ID}&filter[notes][_contains]=${encodeURIComponent('"result":"applied"')}&aggregate[count]=id`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: 'no-store',
        }).then((r) => r.json()).catch(() => null),
        fetch(`${DIRECTUS_URL}/items/affiliate_programs?filter[account_id][_eq]=${CJ_ACCOUNT_ID}&filter[status][_eq]=pending&aggregate[count]=id`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: 'no-store',
        }).then((r) => r.json()).catch(() => null),
      ]);
      appliedAttempts   = parseInt(a?.data?.[0]?.count ?? '0', 10) || 0;
      pendingInDirectus = parseInt(p?.data?.[0]?.count ?? '0', 10) || 0;
    } catch { /* keep zeros */ }
  }
  const autoRejectedEstimate = Math.max(0, appliedAttempts - pendingInDirectus - joined);

  const data = {
    joined,
    notjoined,
    baselineNotjoined,
    pendingEstimate: pendingInDirectus,             // now from Directus (precise)
    autoRejectedEstimate,
    appliedAttempts,
    fetchedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
