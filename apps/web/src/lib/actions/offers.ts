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
import { touchEntity } from '@/lib/touch-entity';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

// account_id → network label. Same UUIDs used by lib/awin/programmes.ts and
// api/ext/cj-stats. Anything else = a manual Directus entry.
const NETWORK_BY_ACCOUNT: Record<string, OfferKind | undefined> = {
  '6d5e233c-ad3d-4b90-a46a-541177170edc': 'awin',
  '45388bdb-ffdc-4a0d-993a-da66e3d28105': 'cj',
};

// Offer network key → MOS2 platform_accounts.platform_key, for the (rare) cases the two taxonomies
// drift. Only CJ diverges: offers say 'cj', the account's platform_key is 'cj-affiliate'.
const NET_KEY_ALIAS: Record<string, string> = { cj: 'cj-affiliate' };

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
  accountId: string | null;    // which of OUR accounts this offer is signed up under (Directus id — facet/filter/edit)
  account: string | null;      // OfferAccount.label, resolved
  mosAccountId: number | null; // the SAME login as a real MOS2 account entity (platform_accounts.id) →
                               // Account cell opens the house account drawer via <EntityRef>. Joined by network.
  name: string;
  brand: string;               // name stripped of network/model/geo qualifiers → groups the SAME offer across networks
  network: string | null;      // network key (tkglobal, clickbank, awin…) — the label for cross-network comparison
  status: string;              // active | joined | pending | paused | ...
  vertical: string | null;
  geos: string[];
  affiliateUrl: string | null;
  previewUrl: string | null;
  tags: string[];
  productType: string | null;
  // Extra performance signals a network exposes (mostly the scraped rows).
  epc: string | null;          // earnings per click
  cvr: string | null;          // conversion / approval rate
  currency: string | null;     // VND | USD | EUR
  payoutUsd: number | null;    // absolute money PER CONVERSION in USD — real for flat CPA/CPL/CPI ($X);
                               // null for %-only offers (needs an order value the network doesn't expose)
  // Deal terms (editable — see saveOfferTerms).
  commission: string | null;   // commission_rate   e.g. "30%", "$1", "20–62,25%"
  model: string | null;        // commission_model  e.g. "recurring (lifetime)"
  recurring: string | null;    // commission_time   e.g. "forever", "1_year"
  cookie: string | null;       // cookie_lifetime   e.g. "60 days"
  policy: string | null;       // promotion_policy  = the special rules
  reward: string | null;       // reward_details
  // Support / promotion rules the network provides — surfaced in the drawer, not the bulk list.
  payoutThreshold: string | null;  // minimum payout before you can withdraw
  payoutMethods: string | null;    // how the network pays out
  trafficSources: string[];        // allowed traffic sources (rules)
  promoteUrl: string | null;       // creative / landing page to promote
  panelUrl: string | null;         // the network's offer panel / detail page
  selfReferral: boolean;           // the network's OWN referral program (not a merchant offer) — labelled
  // Dates. createdAt = when OUR sync first saw the row (not when the merchant joined the
  // network). approvedAt = the run a sync observed it flip to approved — NULL for anything
  // approved before 2026-08-07 (neither Awin nor CJ exposes a joined-date, so it can't be
  // backfilled) and for direct offers added by hand.
  createdAt: string;
  approvedAt: string | null;
}

type Row = {
  id: string;
  account_id: string | null;
  name: string;
  network: string | null;
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
  payout_threshold: string | null;
  payout_methods: string | null;
  traffic_sources: string[] | null;
  promote_url: string | null;
  panel_url: string | null;
  epc: string | null;
  conversion_rate: string | null;
  currency: string | null;
  created_at: string;
  approved_at: string | null;
};

// Strip the qualifiers a network tacks onto the merchant name so the SAME merchant lines up across
// networks: "Klook - CPS" / "Klook Network - CPS" / "Klook" → "Klook". Lets /offers compare who pays
// most for the same brand.
function brandOf(name: string): string {
  const clean = name.replace(/^\d+\s+/, '');   // some networks prefix a numeric campaign id
  let b = (clean.split(/\s*[-(/|·]| CP[SLAI]\b| Network\b| Global\b/i)[0] ?? clean).trim();
  b = b.replace(/\.(com|vn|net|co|shop|world|eco|asia|io|org|bg|au|in|id|tw)\b.*$/i, '').trim();
  return b || name;
}

// The network's OWN referral / refer-a-friend program (e.g. "ACCESSTRADE Referral"), scraped off a
// campaign list — not a merchant offer. Kept (it can still earn) but LABELLED so it isn't mistaken for
// a real brand. Detect: brand contains the network's own name AND the name reads as a referral.
function isSelfReferral(name: string, brand: string, network: string | null): boolean {
  if (!network) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const net = norm(network);
  return net.length >= 4 && norm(brand).includes(net) && /refer|giới thiệu|mời|invite/i.test(name);
}

// Static approx FX — used ONLY to line up flat payouts in one currency for eyeball comparison; it never
// moves real money. ponytail: refresh only if it ever feeds an actual payout (it doesn't).
// ponytail: static approx rates, fine for a rough $ comparator; add a live feed only if this ever moves real money.
const FX_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, VND: 1 / 24500,
  CAD: 0.73, AUD: 0.66, CZK: 0.043, PLN: 0.25, SEK: 0.095, DKK: 0.145,
  NOK: 0.093, CHF: 1.12, JPY: 1 / 150, INR: 0.012, BRL: 0.18, SGD: 0.74, MXN: 0.05,
};
// Absolute money PER CONVERSION in USD. ONLY a flat amount is real money we can state (CPA/CPL/CPI $X).
// A percentage needs the order value we don't have → null (an honest blank, not a guessed number).
// Cases: "$ 52"→52 · "€10"→10.8 · "50.000đ"→2.04 (VN '.'=thousands) · "CZK 100"→4.3 · "30%"→null · unknown cur→null.
function payoutUsdOf(rate: string | null, currency: string | null): number | null {
  if (!rate || rate.includes('%')) return null;
  // Detect currency: unambiguous symbol/word first, then an ISO code embedded in the string, then the column.
  let cur = /€|eur/i.test(rate) ? 'EUR' : /£|gbp/i.test(rate) ? 'GBP'
    : /[₫đ]|vnd/i.test(rate) ? 'VND' : /\$|usd/i.test(rate) ? 'USD' : '';
  if (!cur) cur = (rate.match(/\b([A-Za-z]{3})\b/)?.[1] || currency || '').toUpperCase();
  const mul = FX_USD[cur];
  if (mul == null) return null;  // unknown currency → honest blank, never fake USD (the "$105000" bug class)
  const digits = cur === 'VND' ? rate.replace(/[^\d]/g, '') : rate.replace(/[^\d.]/g, '');  // VN '.' = thousands, drop it
  const num = parseFloat(digits);
  if (!isFinite(num) || num <= 0) return null;
  return +(num * mul).toFixed(2);
}

// NB: `notes` deliberately excluded — see the PERF note above. Lazy-loaded via getOfferNote.
// The terms columns are short text and null on ~99% of rows → negligible payload.
const LIST_FIELDS = 'id,account_id,name,network,status,vertical,affiliate_url,preview_url,promote_url,panel_url,target_geo,traffic_sources,tags,product_type,commission_rate,commission_model,commission_time,cookie_lifetime,promotion_policy,reward_details,payout_threshold,payout_methods,epc,conversion_rate,currency,created_at,approved_at';
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
    // limit=-1 (all): there are 600+ accounts; a fixed cap silently dropped late-alphabet networks
    // (tkglobal/travelpayouts/vcommission sort past 500 → their offers showed "chưa gán").
    const r = await fetch(`${DIRECTUS_URL}/items/accounts?fields=id,platform,handle&limit=-1&sort=platform`, {
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

// Bridge each offer to the REAL MOS2 account entity (platform_accounts, numeric id) so the Account
// cell opens the house account drawer (identity/session/vault) via <EntityRef> — instead of a bespoke
// re-fetch. Joined by network = platform_key: every affiliate network is one login under the aff
// browser profile, so the network label IS the account key. First profile-linked account per network
// (each network has exactly one today). Empty map on any failure → cells fall back to "chưa gán".
async function mosAccountByNetwork(): Promise<Map<string, { id: number; handle: string }>> {
  const m = new Map<string, { id: number; handle: string }>();
  try {
    const db = getDb();
    if (!db) return m;               // không có DB thì trả map rỗng, đừng gọi .execute trên null
    const rows = (await db.execute(sql`
      SELECT id, platform_key, handle FROM platform_accounts
      WHERE browser_profile_id IS NOT NULL ORDER BY id`)) as unknown as Array<{ id: number; platform_key: string; handle: string }>;
    for (const r of rows) if (r.platform_key && !m.has(r.platform_key)) m.set(r.platform_key, { id: Number(r.id), handle: r.handle });
  } catch { /* mos2 db unreachable → no bridge, cells show "chưa gán" */ }
  return m;
}

function toOffer(x: Row, own: Set<string>, accounts: Map<string, string>, mosAccts: Map<string, { id: number; handle: string }>): AffiliateOffer {
  const netKind = NETWORK_BY_ACCOUNT[x.account_id ?? ''];
  const platformKey = x.network ?? netKind ?? null;
  const mos = platformKey ? (mosAccts.get(platformKey) ?? mosAccts.get(NET_KEY_ALIAS[platformKey] ?? '')) : undefined;
  return {
    id: x.id,
    kind: own.has(x.name.trim().toLowerCase()) ? 'own' : netKind ?? 'direct',
    accountId: x.account_id,
    account: x.account_id ? accounts.get(x.account_id) ?? null : null,
    mosAccountId: mos?.id ?? null,
    name: x.name,
    brand: brandOf(x.name),
    network: x.network ?? netKind ?? null,
    status: x.status || 'unknown',
    vertical: x.vertical,
    geos: Array.isArray(x.target_geo) ? x.target_geo : [],
    affiliateUrl: x.affiliate_url,
    previewUrl: x.preview_url,
    tags: Array.isArray(x.tags) ? x.tags.filter((t) => !/^awin-mid-/.test(t)) : [],
    productType: x.product_type,
    epc: x.epc,
    cvr: x.conversion_rate,
    currency: x.currency,
    payoutUsd: payoutUsdOf(x.commission_rate, x.currency),
    commission: x.commission_rate,
    model: x.commission_model,
    recurring: x.commission_time,
    cookie: x.cookie_lifetime,
    policy: x.promotion_policy,
    reward: x.reward_details,
    payoutThreshold: x.payout_threshold,
    payoutMethods: x.payout_methods,
    trafficSources: Array.isArray(x.traffic_sources) ? x.traffic_sources : [],
    promoteUrl: x.promote_url,
    panelUrl: x.panel_url,
    selfReferral: isSelfReferral(x.name, brandOf(x.name), x.network ?? netKind ?? null),
    createdAt: x.created_at,
    approvedAt: x.approved_at,
  };
}

// NO unstable_cache here: the assembled list is ~3MB (5k rows × terms fields), OVER Next's 2MB
// data-cache limit — so wrapping it made unstable_cache FAIL ("items over 2MB can not be cached")
// and return EMPTY, wiping the whole /offers list (a real offer like "Aligned Vibration" vanished).
// Caching still happens at the right layer: each fetchPage() fetch carries revalidate:300 +
// tag 'affiliate-offers' (every page <2MB), so repeat loads skip Directus; this assembler is just
// cheap in-memory work over already-cached pages. revalidateTag('affiliate-offers') still busts it.
export async function listAffiliateOffers(): Promise<AffiliateOffer[]> {
  if (!DIRECTUS_TOKEN) return [];
  const [first, own, accList, mosAccts] = await Promise.all([fetchPage(1), ownProductTitles(), listOfferAccounts(), mosAccountByNetwork()]);
  const accounts = new Map(accList.map((a) => [a.id, a.label]));
  // 30-page cap = 6000 rows (runaway guard, just above the real row count).
  const pageCount = Math.min(30, Math.max(1, Math.ceil(first.total / PAGE_SIZE)));
  const rest = pageCount > 1
    ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2)))
    : [];
  return [first, ...rest].flatMap((p) => p.rows).map((r) => toOffer(r, own, accounts, mosAccts));
}

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
  sort: string;        // '' = approved-first/name | new = mới thêm | approved = mới duyệt
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
    const hay = [o.name, o.brand, o.network, o.vertical, o.account, o.commission, o.policy, o.reward, ...o.tags];
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
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  // Sort: default puts usable offers first; the date sorts answer "what's new" (the syncs
  // add ~50 Awin programmes a day, so recency is the only way to see them).
  const desc = (x: string | null, y: string | null) => (y ?? '').localeCompare(x ?? '');
  const bySort: Record<string, (a: AffiliateOffer, b: AffiliateOffer) => number> = {
    new: (a, b) => desc(a.createdAt, b.createdAt),
    approved: (a, b) => desc(a.approvedAt, b.approvedAt) || desc(a.createdAt, b.createdAt),
  };
  const hit = all.filter((o) => matches(o, f)).sort(bySort[f.sort]
    ?? ((a, b) => (APPROVED.has(a.status.toLowerCase()) ? 0 : 1) - (APPROVED.has(b.status.toLowerCase()) ? 0 : 1)
      || a.name.localeCompare(b.name)));
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
      new7: all.filter((o) => o.createdAt >= weekAgo).length,
      approved7: all.filter((o) => (o.approvedAt ?? '') >= weekAgo).length,
    },
    facets: facetsOf(all),
  };
}

// Quick-view drawer: pull every offer for one entity (a brand / network / account) so the drawer
// can show the SAME offer across networks side-by-side (compare who pays most). Reuses the cached
// full list → cheap. Brand match is case-insensitive exact on the stripped brand.
export async function getEntityOffers(field: 'brand' | 'network', value: string): Promise<AffiliateOffer[]> {
  const all = await listAffiliateOffers();
  const v = value.toLowerCase();
  const hit = all.filter((o) =>
    field === 'brand' ? o.brand.toLowerCase() === v : (o.network ?? '').toLowerCase() === v);
  // Approved first, then highest commission-ish string — good enough for a glance.
  return hit.sort((a, b) => (APPROVED.has(a.status.toLowerCase()) ? 0 : 1) - (APPROVED.has(b.status.toLowerCase()) ? 0 : 1)
    || (b.commission ?? '').localeCompare(a.commission ?? ''));
}

// Account identity (login/network/health/vault) is NOT re-fetched here — the Account cell opens the
// canonical MOS2 account drawer (account-drawer.tsx via <EntityRef kind="account">), one source for
// every account across the app. offers only supplies the numeric id (mosAccountId, joined by network).

// Awin rows store a sync blob behind `[awin-sync]` in notes — not a user note.
function cleanNote(notes: string | null): string | null {
  if (!notes) return null;
  return /^\s*\[awin-sync\]/.test(notes) ? null : notes;
}

// One offer by id, for deep-link / F5 rehydrate: a shared ?m=offer&mId=<id> link may point at an offer
// that doesn't sort onto the current server page, so rows.find() misses it → drawer stays empty. Resolve
// from the cached full list (cheap in-memory find, no extra Directus hit) so ANY offer link reopens.
export async function getOffer(id: string): Promise<AffiliateOffer | null> {
  return (await listAffiliateOffers()).find((o) => o.id === id) ?? null;
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
