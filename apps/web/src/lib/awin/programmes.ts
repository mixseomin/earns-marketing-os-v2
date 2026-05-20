// Server loader for Awin programmes stored in Directus `affiliate_programs`.
// Populated daily by /usr/local/bin/awin-sync-programmes.php (systemd
// awin-sync-programmes.timer, 08:37 +07). One row per (account, merchant id),
// with mid+logo+region+sector packed in `notes` as a JSON blob behind the
// `[awin-sync] ` marker so we don't have to ALTER TABLE.
//
// Each row's `tags` contains `awin-mid-<MID>`, used for upsert + reverse lookup.

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const AWIN_ACCOUNT_ID = '6d5e233c-ad3d-4b90-a46a-541177170edc';

export type AwinProgramme = {
  id: string;          // affiliate_programs.id
  mid: number;         // Awin merchant id
  name: string;
  status: string;      // 'active' | 'pending' | 'paused'
  awinStatus: string;  // raw Awin status ("Active", "Suspended", ...)
  relationship: string;// 'joined' | 'pending'
  vertical: string | null;
  region: string | null;     // ISO country code (e.g. "US")
  regionName: string | null;
  currency: string | null;
  logoUrl: string | null;
  displayUrl: string | null;
  affiliateUrl: string | null; // clickThroughUrl deeplink
  validDomains: string[];
  description: string | null;
  syncedAt: string | null;
};

type DirectusRow = {
  id: string;
  name: string;
  status: string;
  vertical: string | null;
  affiliate_url: string | null;
  preview_url: string | null;
  target_geo: string[] | null;
  tags: string[] | null;
  notes: string | null;
};

function parseNotes(notes: string | null): Record<string, unknown> {
  if (!notes) return {};
  const m = notes.match(/^\[awin-sync\]\s*(\{[\s\S]*\})\s*$/);
  if (!m || !m[1]) return {};
  try { return JSON.parse(m[1]) as Record<string, unknown>; } catch { return {}; }
}

function midFromTags(tags: string[] | null): number {
  if (!tags) return 0;
  for (const t of tags) {
    const m = t.match(/^awin-mid-(\d+)$/);
    if (m && m[1]) return parseInt(m[1], 10);
  }
  return 0;
}

export async function listAwinProgrammes(): Promise<AwinProgramme[]> {
  if (!DIRECTUS_TOKEN) return [];
  const all: DirectusRow[] = [];
  let page = 1;
  // Pull all pages until empty (296 rows fits in ~2 pages at limit 200).
  while (true) {
    const url = `${DIRECTUS_URL}/items/affiliate_programs?filter[account_id][_eq]=${AWIN_ACCOUNT_ID}&fields=id,name,status,vertical,affiliate_url,preview_url,target_geo,tags,notes&limit=200&page=${page}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      next: { revalidate: 300 },
    });
    if (!r.ok) break;
    const j = (await r.json()) as { data: DirectusRow[] };
    const rows = j.data ?? [];
    all.push(...rows);
    if (rows.length < 200) break;
    page++;
    if (page > 10) break; // sanity guard
  }

  return all.map((r): AwinProgramme => {
    const blob = parseNotes(r.notes) as {
      mid?: number;
      logoUrl?: string | null;
      displayUrl?: string | null;
      validDomains?: string[];
      currency?: string | null;
      region?: string | null;
      region_name?: string | null;
      awin_status?: string;
      relationship?: string;
      description?: string | null;
      synced_at?: string;
    };
    return {
      id: r.id,
      mid: blob.mid ?? midFromTags(r.tags),
      name: r.name,
      status: r.status,
      awinStatus: blob.awin_status ?? '',
      relationship: blob.relationship ?? (r.status === 'pending' ? 'pending' : 'joined'),
      vertical: r.vertical,
      region: blob.region ?? (r.target_geo?.[0] ?? null),
      regionName: blob.region_name ?? null,
      currency: blob.currency ?? null,
      logoUrl: blob.logoUrl ?? null,
      displayUrl: blob.displayUrl ?? r.preview_url,
      affiliateUrl: r.affiliate_url,
      validDomains: Array.isArray(blob.validDomains) ? blob.validDomains : [],
      description: blob.description ?? null,
      syncedAt: blob.synced_at ?? null,
    };
  });
}
