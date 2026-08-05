'use server';
// Read-only view of approved affiliate offers stored in Directus `affiliate_programs`
// (CJ + Awin, populated by their own syncs). NO write-back: the Awin sync packs a
// JSON blob into `notes` and manages `tags`, so a PATCH here would clobber it and
// get overwritten next sync anyway.
// ponytail: read + filter surface only. Add a local annotation table (per-offer
// email-ok / project-pick) only when picking offers per-project becomes real.
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

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

// account_id → network label. Same UUIDs used by lib/awin/programmes.ts and
// api/ext/cj-stats. Anything else = a manual Directus entry.
const NETWORK_BY_ACCOUNT: Record<string, string> = {
  '6d5e233c-ad3d-4b90-a46a-541177170edc': 'awin',
  '45388bdb-ffdc-4a0d-993a-da66e3d28105': 'cj',
};

export interface AffiliateOffer {
  id: string;
  network: string;             // awin | cj | other
  name: string;
  status: string;              // active | joined | pending | paused | ...
  vertical: string | null;
  geos: string[];
  affiliateUrl: string | null;
  previewUrl: string | null;
  tags: string[];
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
};

// NB: `notes` deliberately excluded — see the PERF note above. Lazy-loaded via getOfferNote.
const LIST_FIELDS = 'id,account_id,name,status,vertical,affiliate_url,preview_url,target_geo,tags';
const PAGE_SIZE = 200;

async function fetchPage(page: number): Promise<{ rows: Row[]; total: number }> {
  const url = `${DIRECTUS_URL}/items/affiliate_programs?fields=${LIST_FIELDS}&limit=${PAGE_SIZE}&page=${page}&meta=filter_count`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, next: { revalidate: 300 } });
  if (!r.ok) return { rows: [], total: 0 };
  const j = (await r.json()) as { data?: Row[]; meta?: { filter_count?: number } };
  return { rows: j.data ?? [], total: j.meta?.filter_count ?? 0 };
}

function toOffer(x: Row): AffiliateOffer {
  return {
    id: x.id,
    network: NETWORK_BY_ACCOUNT[x.account_id ?? ''] ?? 'other',
    name: x.name,
    status: x.status || 'unknown',
    vertical: x.vertical,
    geos: Array.isArray(x.target_geo) ? x.target_geo : [],
    affiliateUrl: x.affiliate_url,
    previewUrl: x.preview_url,
    tags: Array.isArray(x.tags) ? x.tags.filter((t) => !/^awin-mid-/.test(t)) : [],
  };
}

// unstable_cache: the assembled list is cached for 5 min across requests, independent of the
// route being force-dynamic. Tag lets a future sync bust it (revalidateTag('affiliate-offers')).
export const listAffiliateOffers = unstable_cache(
  async (): Promise<AffiliateOffer[]> => {
    if (!DIRECTUS_TOKEN) return [];
    const first = await fetchPage(1);
    const pageCount = Math.min(20, Math.max(1, Math.ceil(first.total / PAGE_SIZE)));   // 20-page hard cap = 4000 rows
    const rest = pageCount > 1
      ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2)))
      : [];
    return [first, ...rest].flatMap((p) => p.rows).map(toOffer);
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
