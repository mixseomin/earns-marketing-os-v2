'use server';
// Read-only view of approved affiliate offers stored in Directus `affiliate_programs`
// (CJ + Awin, populated by their own syncs). NO write-back: the Awin sync packs a
// JSON blob into `notes` and manages `tags`, so a PATCH here would clobber it and
// get overwritten next sync anyway.
// ponytail: read + filter surface only. Add a local annotation table (per-offer
// email-ok / project-pick) only when picking offers per-project becomes real.

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
  note: string | null;         // user notes (awin-sync blob stripped)
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
  notes: string | null;
};

// Awin rows store a sync blob behind `[awin-sync]` in notes — not a user note.
function cleanNote(notes: string | null): string | null {
  if (!notes) return null;
  return /^\s*\[awin-sync\]/.test(notes) ? null : notes;
}

export async function listAffiliateOffers(): Promise<AffiliateOffer[]> {
  if (!DIRECTUS_TOKEN) return [];
  const out: AffiliateOffer[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${DIRECTUS_URL}/items/affiliate_programs?fields=id,account_id,name,status,vertical,affiliate_url,preview_url,target_geo,tags,notes&limit=200&page=${page}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, next: { revalidate: 300 } });
    if (!r.ok) break;
    const j = (await r.json()) as { data: Row[] };
    const rows = j.data ?? [];
    for (const x of rows) {
      out.push({
        id: x.id,
        network: NETWORK_BY_ACCOUNT[x.account_id ?? ''] ?? 'other',
        name: x.name,
        status: x.status || 'unknown',
        vertical: x.vertical,
        geos: Array.isArray(x.target_geo) ? x.target_geo : [],
        affiliateUrl: x.affiliate_url,
        previewUrl: x.preview_url,
        tags: Array.isArray(x.tags) ? x.tags.filter((t) => !/^awin-mid-/.test(t)) : [],
        note: cleanNote(x.notes),
      });
    }
    if (rows.length < 200) break;
  }
  return out;
}
