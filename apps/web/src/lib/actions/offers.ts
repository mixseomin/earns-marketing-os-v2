'use server';
// View of affiliate offers stored in Directus `affiliate_programs` (CJ + Awin, populated
// by their own syncs, + manually-added direct programs).
//
// WRITE-BACK is limited to the DEAL-TERMS columns (commission_rate, commission_model,
// commission_time, cookie_lifetime, promotion_policy, reward_details). Verified safe:
// /usr/local/bin/awin-sync-programmes.php only writes name/account_id/status/affiliate_url/
// preview_url/vertical/target_geo/tags/notes/affiliate_type — it never touches the terms
// columns, so a nightly sync can't clobber them. Everything else stays read-only (the Awin
// sync packs a JSON blob into `notes` and owns `tags`).
//
// PERF (2026-08-06): the list is fetched cross-box (MOS2 on box3 → Directus on box1),
// so latency matters. Three things keep /offers fast:
//   1. the bulk list does NOT pull `notes` — Awin packs a multi-KB [awin-sync] blob in
//      there, which bloated every response (and could exceed Next's fetch-cache size cap,
//      silently disabling caching). The rare user note is lazy-loaded per offer on drawer open.
//   2. pages are fetched IN PARALLEL (page 1 returns filter_count → fan out the rest),
//      not one-after-another.
//   3. the assembled list is wrapped in unstable_cache (5 min) so repeat loads skip Directus.

import { revalidateTag, unstable_cache } from 'next/cache';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

// account_id → network label. Same UUIDs used by lib/awin/programmes.ts and
// api/ext/cj-stats. Anything else = a manual Directus entry.
const NETWORK_BY_ACCOUNT: Record<string, OfferKind | undefined> = {
  '6d5e233c-ad3d-4b90-a46a-541177170edc': 'awin',
  '45388bdb-ffdc-4a0d-993a-da66e3d28105': 'cj',
};

// awin/cj = synced from a network · direct = merchant's own program, added by hand ·
// own = OUR product that leaked into this collection (it belongs on /products).
export type OfferKind = 'awin' | 'cj' | 'direct' | 'own';

export interface AffiliateOffer {
  id: string;
  kind: OfferKind;
  name: string;
  status: string;              // active | joined | pending | paused | ...
  vertical: string | null;
  geos: string[];
  affiliateUrl: string | null;
  previewUrl: string | null;
  tags: string[];
  productType: string | null;
  // Deal terms (editable — see saveOfferTerms).
  commission: string | null;   // commission_rate   e.g. "30%", "$1", "20–62,25%"
  model: string | null;        // commission_model  e.g. "recurring (lifetime)"
  recurring: string | null;    // commission_time   e.g. "forever", "1_year"
  cookie: string | null;       // cookie_lifetime   e.g. "60 days"
  policy: string | null;       // promotion_policy  = the special rules
  reward: string | null;       // reward_details
}

type Row = {
  id: string;
  account_id: string | null;
  name: string;
  status: string;
  vertical: string | null;
  affiliate_url: string | null;
  preview_url: string | null;
  target_geo: string[] | null;
  tags: string[] | null;
  product_type: string | null;
  commission_rate: string | null;
  commission_model: string | null;
  commission_time: string | null;
  cookie_lifetime: string | null;
  promotion_policy: string | null;
  reward_details: string | null;
};

// NB: `notes` deliberately excluded — see the PERF note above. Lazy-loaded via getOfferNote.
// The terms columns are short text and null on ~99% of rows → negligible payload.
const LIST_FIELDS = 'id,account_id,name,status,vertical,affiliate_url,preview_url,target_geo,tags,product_type,commission_rate,commission_model,commission_time,cookie_lifetime,promotion_policy,reward_details';
const PAGE_SIZE = 200;

async function fetchPage(page: number): Promise<{ rows: Row[]; total: number }> {
  const url = `${DIRECTUS_URL}/items/affiliate_programs?fields=${LIST_FIELDS}&limit=${PAGE_SIZE}&page=${page}&meta=filter_count`;
  // tagged too, not just the unstable_cache wrapper — otherwise a saved edit stays invisible
  // for up to 5 min behind the fetch cache.
  const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, next: { revalidate: 300, tags: ['affiliate-offers'] } });
  if (!r.ok) return { rows: [], total: 0 };
  const j = (await r.json()) as { data?: Row[]; meta?: { filter_count?: number } };
  return { rows: j.data ?? [], total: j.meta?.filter_count ?? 0 };
}

// Titles of OUR OWN products (Directus `products` → /products). A few of them were also
// filed as affiliate programs (e.g. the AWS Udemy course), which mixes "money we earn from
// someone else's product" with "money we earn from ours". Exact title match flags them so
// /offers can separate the two instead of silently double-listing.
async function ownProductTitles(): Promise<Set<string>> {
  const r = await fetch(`${DIRECTUS_URL}/items/products?fields=title&limit=200`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate: 300 },
  });
  if (!r.ok) return new Set();
  const j = (await r.json()) as { data?: { title?: string }[] };
  return new Set((j.data ?? []).map((p) => (p.title ?? '').trim().toLowerCase()).filter(Boolean));
}

function toOffer(x: Row, own: Set<string>): AffiliateOffer {
  const network = NETWORK_BY_ACCOUNT[x.account_id ?? ''];
  return {
    id: x.id,
    kind: own.has(x.name.trim().toLowerCase()) ? 'own' : network ?? 'direct',
    name: x.name,
    status: x.status || 'unknown',
    vertical: x.vertical,
    geos: Array.isArray(x.target_geo) ? x.target_geo : [],
    affiliateUrl: x.affiliate_url,
    previewUrl: x.preview_url,
    tags: Array.isArray(x.tags) ? x.tags.filter((t) => !/^awin-mid-/.test(t)) : [],
    productType: x.product_type,
    commission: x.commission_rate,
    model: x.commission_model,
    recurring: x.commission_time,
    cookie: x.cookie_lifetime,
    policy: x.promotion_policy,
    reward: x.reward_details,
  };
}

// unstable_cache: the assembled list is cached for 5 min across requests, independent of the
// route being force-dynamic. Tag lets a future sync bust it (revalidateTag('affiliate-offers')).
export const listAffiliateOffers = unstable_cache(
  async (): Promise<AffiliateOffer[]> => {
    if (!DIRECTUS_TOKEN) return [];
    const [first, own] = await Promise.all([fetchPage(1), ownProductTitles()]);
    const pageCount = Math.min(20, Math.max(1, Math.ceil(first.total / PAGE_SIZE)));   // 20-page hard cap = 4000 rows
    const rest = pageCount > 1
      ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2)))
      : [];
    return [first, ...rest].flatMap((p) => p.rows).map((r) => toOffer(r, own));
  },
  ['affiliate-offers-list'],
  { revalidate: 300, tags: ['affiliate-offers'] },
);

// Awin rows store a sync blob behind `[awin-sync]` in notes — not a user note.
function cleanNote(notes: string | null): string | null {
  if (!notes) return null;
  return /^\s*\[awin-sync\]/.test(notes) ? null : notes;
}

// Lazy per-offer user note — only the drawer needs it, so it's kept out of the bulk list
// (the Awin blob would bloat every load). One tiny fetch when a specific offer is opened.
export async function getOfferNote(id: string): Promise<string | null> {
  if (!DIRECTUS_TOKEN) return null;
  const r = await fetch(`${DIRECTUS_URL}/items/affiliate_programs/${encodeURIComponent(id)}?fields=notes`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    next: { revalidate: 300 },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { data?: { notes?: string | null } };
  return cleanNote(j.data?.notes ?? null);
}

export interface OfferTerms {
  commission: string;   // "30%" / "$1" / "20-62%"
  recurring: string;    // '' | 6_months | 1_year | 2_years | forever
  cookie: string;       // "60 days"
  policy: string;       // special rules (allowed traffic, brand bidding, coupon policy…)
  reward: string;       // extra payout detail
}

// Write the deal terms a network never gives us (Awin/CJ syncs leave these columns alone —
// see the header note). Empty string → NULL so a cleared field doesn't linger as ''.
export async function saveOfferTerms(id: string, t: OfferTerms): Promise<{ ok: boolean; error?: string }> {
  if (!DIRECTUS_TOKEN) return { ok: false, error: 'no directus token' };
  const nn = (v: string) => (v.trim() ? v.trim() : null);
  const r = await fetch(`${DIRECTUS_URL}/items/affiliate_programs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commission_rate: nn(t.commission),
      commission_time: nn(t.recurring),
      cookie_lifetime: nn(t.cookie),
      promotion_policy: nn(t.policy),
      reward_details: nn(t.reward),
    }),
  });
  if (!r.ok) return { ok: false, error: `directus ${r.status}` };
  revalidateTag('affiliate-offers');
  return { ok: true };
}
