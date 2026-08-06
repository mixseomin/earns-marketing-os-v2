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

import { unstable_cache } from 'next/cache';
import { touchEntity } from '@/lib/entity-cascade';

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

export interface OfferAccount {
  id: string;
  platform: string;
  handle: string;
  label: string;               // "travelpayouts · htuan82"
}

export interface AffiliateOffer {
  id: string;
  kind: OfferKind;
  accountId: string | null;    // which of OUR accounts this offer is signed up under
  account: string | null;      // OfferAccount.label, resolved
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

// Every offer is earned through one of OUR accounts (the login that got approved) — that account
// is what you need to check stats / raise a ticket, so it's resolved into the list, not hidden
// behind account_id. Cheap: one 500-row fetch, cached with the list.
export const listOfferAccounts = unstable_cache(
  async (): Promise<OfferAccount[]> => {
    if (!DIRECTUS_TOKEN) return [];
    const r = await fetch(`${DIRECTUS_URL}/items/accounts?fields=id,platform,handle&limit=500&sort=platform`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      next: { revalidate: 300, tags: ['affiliate-offers'] },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: { id: string; platform: string; handle: string }[] };
    return (j.data ?? []).map((a) => ({ ...a, label: `${a.platform} · ${a.handle}` }));
  },
  ['offer-accounts'],
  { revalidate: 300, tags: ['affiliate-offers'] },
);

function toOffer(x: Row, own: Set<string>, accounts: Map<string, string>): AffiliateOffer {
  const network = NETWORK_BY_ACCOUNT[x.account_id ?? ''];
  return {
    id: x.id,
    kind: own.has(x.name.trim().toLowerCase()) ? 'own' : network ?? 'direct',
    accountId: x.account_id,
    account: x.account_id ? accounts.get(x.account_id) ?? null : null,
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
    const [first, own, accList] = await Promise.all([fetchPage(1), ownProductTitles(), listOfferAccounts()]);
    const accounts = new Map(accList.map((a) => [a.id, a.label]));
    // 30-page cap = 6000 rows. Was 20 (=4000) while Directus holds 4897 → the list silently
    // dropped ~900 offers. Keep a ceiling (runaway guard), just above the real row count.
    const pageCount = Math.min(30, Math.max(1, Math.ceil(first.total / PAGE_SIZE)));
    const rest = pageCount > 1
      ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2)))
      : [];
    return [first, ...rest].flatMap((p) => p.rows).map((r) => toOffer(r, own, accounts));
  },
  ['affiliate-offers-list'],
  { revalidate: 300, tags: ['affiliate-offers'] },
);

// ── Filtering + paging: SERVER-side (ui-conventions §5) ──────────────────────────────────────
// The source is remote (Directus, cross-box) and ~5k rows — shipping the whole array to the
// client so it could slice 50 of them cost 2.9 MB / 1.2 s per load. The full list already sits
// in unstable_cache here, so filtering in memory is ~free and the client only ever receives one
// page. Filter state lives in the URL → shareable + survives F5.

export interface OfferFilters {
  q: string;
  kind: string;        // all | awin | cj | direct | own
  status: string;      // all | approved | pending | paused
  accounts: string[];  // account ids
  verticals: string[];
  geos: string[];
  gap: string;         // all | no-terms | no-account | no-link  (what still needs filling in)
  recurring: string;   // all | yes | no
  page: number;        // 0-based
}

export interface OfferFacet { value: string; label: string; count: number }

export interface OffersView {
  rows: AffiliateOffer[];
  matched: number;                  // rows after filters
  total: number;                    // rows before filters
  page: number; pageCount: number; pageSize: number;
  counts: Record<string, number>;   // chip counts (whole set, so you can see what a filter would open up)
  facets: { accounts: OfferFacet[]; verticals: OfferFacet[]; geos: OfferFacet[] };
}

// NB: this module is 'use server' → only async functions may be EXPORTED (types are erased,
// consts are not). Page size travels back inside OffersView instead.
const OFFERS_PAGE_SIZE = 50;
const APPROVED = new Set(['active', 'joined', 'approved']);
// Statuses the networks report for "we're not earning from this" — paused/suspended by the
// merchant, or dropped out of the relationship entirely (see the sync reconcile on the box).
const INACTIVE = new Set(['paused', 'suspended', 'notjoined']);

const hasTerms =(o: AffiliateOffer) => Boolean(o.commission || o.recurring || o.cookie || o.policy || o.reward);
const isRecurring = (o: AffiliateOffer) => Boolean(o.recurring || /recurring/i.test(o.model ?? ''));

function matches(o: AffiliateOffer, f: OfferFilters): boolean {
  if (f.kind !== 'all' && o.kind !== f.kind) return false;
  const s = o.status.toLowerCase();
  if (f.status === 'approved' && !APPROVED.has(s)) return false;
  if (f.status === 'pending' && s !== 'pending') return false;
  if (f.status === 'rejected' && s !== 'rejected') return false;
  if (f.status === 'inactive' && !INACTIVE.has(s)) return false;
  if (f.accounts.length && !(o.accountId && f.accounts.includes(o.accountId))) return false;
  if (f.verticals.length && !(o.vertical && f.verticals.includes(o.vertical))) return false;
  if (f.geos.length && !f.geos.some((g) => o.geos.includes(g))) return false;
  if (f.gap === 'no-terms' && hasTerms(o)) return false;
  if (f.gap === 'no-account' && o.accountId) return false;
  if (f.gap === 'no-link' && o.affiliateUrl) return false;
  if (f.recurring === 'yes' && !isRecurring(o)) return false;
  if (f.recurring === 'no' && isRecurring(o)) return false;
  if (f.q) {
    const t = f.q.toLowerCase();
    const hay = [o.name, o.vertical, o.account, o.commission, o.policy, o.reward, ...o.tags];
    if (!hay.some((v) => v?.toLowerCase().includes(t))) return false;
  }
  return true;
}

// Facet options come from the WHOLE set (not the current result), so a filter never hides the
// value you were about to pick. Counts are whole-set for the same reason.
function facetsOf(offers: AffiliateOffer[]): OffersView['facets'] {
  const bump = (m: Map<string, OfferFacet>, value: string, label: string) => {
    const cur = m.get(value);
    if (cur) cur.count++;
    else m.set(value, { value, label, count: 1 });
  };
  const accounts = new Map<string, OfferFacet>(), verticals = new Map<string, OfferFacet>(), geos = new Map<string, OfferFacet>();
  for (const o of offers) {
    if (o.accountId) bump(accounts, o.accountId, o.account ?? o.accountId);
    if (o.vertical) bump(verticals, o.vertical, o.vertical);
    for (const g of o.geos) bump(geos, g, g);
  }
  const byCount = (a: OfferFacet, b: OfferFacet) => b.count - a.count || a.label.localeCompare(b.label);
  return {
    accounts: [...accounts.values()].sort(byCount),
    verticals: [...verticals.values()].sort(byCount),
    geos: [...geos.values()].sort(byCount),
  };
}

export async function getOffersView(f: OfferFilters): Promise<OffersView> {
  const all = await listAffiliateOffers();
  const hit = all.filter((o) => matches(o, f))
    .sort((a, b) => (APPROVED.has(a.status.toLowerCase()) ? 0 : 1) - (APPROVED.has(b.status.toLowerCase()) ? 0 : 1)
      || a.name.localeCompare(b.name));
  const pageCount = Math.max(1, Math.ceil(hit.length / OFFERS_PAGE_SIZE));
  const page = Math.min(Math.max(0, f.page), pageCount - 1);
  return {
    rows: hit.slice(page * OFFERS_PAGE_SIZE, page * OFFERS_PAGE_SIZE + OFFERS_PAGE_SIZE),
    matched: hit.length,
    total: all.length,
    page, pageCount, pageSize: OFFERS_PAGE_SIZE,
    counts: {
      all: all.length,
      awin: all.filter((o) => o.kind === 'awin').length,
      cj: all.filter((o) => o.kind === 'cj').length,
      direct: all.filter((o) => o.kind === 'direct').length,
      own: all.filter((o) => o.kind === 'own').length,
      approved: all.filter((o) => APPROVED.has(o.status.toLowerCase())).length,
      pending: all.filter((o) => o.status.toLowerCase() === 'pending').length,
      rejected: all.filter((o) => o.status.toLowerCase() === 'rejected').length,
      inactive: all.filter((o) => INACTIVE.has(o.status.toLowerCase())).length,
      terms: all.filter(hasTerms).length,
      recurring: all.filter(isRecurring).length,
      'no-terms': all.filter((o) => !hasTerms(o)).length,
      'no-account': all.filter((o) => !o.accountId).length,
      'no-link': all.filter((o) => !o.affiliateUrl).length,
    },
    facets: facetsOf(all),
  };
}

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
  accountId: string;    // '' = unassigned. Awin/CJ rows get theirs from the sync.
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
      account_id: nn(t.accountId),
    }),
  });
  if (!r.ok) return { ok: false, error: `directus ${r.status}` };
  await touchEntity('offer');
  return { ok: true };
}
