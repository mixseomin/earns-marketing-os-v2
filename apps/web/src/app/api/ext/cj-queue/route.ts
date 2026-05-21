// GET /api/ext/cj-queue?limit=300&minEpc=0
// Returns a sorted list of CJ advertiser IDs ready to apply.
//
// Source: Directus `affiliate_programs` WHERE account_id = <CJ account>
//         (populated daily by /usr/local/bin/cj-sync-advertisers.php).
// Filter: relationship is notjoined-ish (status != 'active' && status != 'pending').
// Sort:   by 7-day EPC desc, then US/global region first per brand family.
//         (Pre-computed externally and reflected in row order — we just trust
//         Directus's order here; future improvement: sort server-side.)
//
// Returns: { aids: ["7864295","4297311",…], count: N, generated_at }

import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

const DIRECTUS_URL   = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const CJ_ACCOUNT_ID  = '45388bdb-ffdc-4a0d-993a-da66e3d28105';

const REGION_RX = /\s+(US|USA|UK|EU|APAC|AUS(?:TRALIA)?|CA(?:NADA)?|BENELUX|BRAZIL|DACH|ES|FR|IT|LATAM|NORDICS|MEA|NORTH AMERICA|EMEA|CENTRAL AND EASTERN EUROPE|GERMANY|AUSTRIA|TURKEY|MIDDLE EAST|SWITZERLAND|SPAIN|ITALY|FRANCE|BELGIUM|NETHERLANDS|KOREA|JAPAN|HOLDINGS?|INTL|INTERNATIONAL|GLOBAL|OUTLET|REFURBISHED|BUSINESS|RESIDENTIAL|HOME)\b.*$/i;

function familyKey(name: string): string {
  return name.replace(REGION_RX, '').trim().replace(/[\s.,-]+$/, '').toLowerCase();
}

function usScore(name: string): number {
  const n = name.toLowerCase();
  if (/\bnorth america\b|\bus\b|\busa\b/.test(n)) return 100;
  if (n === familyKey(name)) return 80;
  if (/\bca\b|\bcanada\b/.test(n)) return 50;
  if (/\buk\b|\beu\b|emea/.test(n)) return 20;
  return 10;
}

type Row = {
  id: string;
  name: string;
  status: string;
  tags: string[] | null;
  notes: string | null;
};

type Parsed = {
  aid: number;
  name: string;
  epc7: number;
  status: string;
  matchedFamily: string;
};

function parseRow(r: Row): Parsed | null {
  let aid = 0;
  for (const t of r.tags ?? []) {
    const m = t.match(/^cj-aid-(\d+)$/);
    if (m && m[1]) { aid = parseInt(m[1], 10); break; }
  }
  if (!aid) return null;
  let epc7 = 0;
  if (r.notes) {
    const em = r.notes.match(/"seven_day_epc":"([^"]*)"/);
    if (em && em[1] && /^-?\d/.test(em[1])) epc7 = parseFloat(em[1]) || 0;
  }
  return { aid, name: r.name || '', epc7, status: r.status, matchedFamily: familyKey(r.name || '') };
}

export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!DIRECTUS_TOKEN) return NextResponse.json({ error: 'Directus not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '300', 10), 1000);
  const minEpc = parseFloat(searchParams.get('minEpc') || '0');
  const matchedOnly = searchParams.get('matchedOnly') !== 'false';  // default true

  // Pull all CJ rows. With ~2,910 rows, that's ~15 page fetches of 200.
  const all: Row[] = [];
  let page = 1;
  while (page < 20) {
    const url = `${DIRECTUS_URL}/items/affiliate_programs`
      + `?filter[account_id][_eq]=${CJ_ACCOUNT_ID}`
      + `&fields=id,name,status,tags,notes`
      + `&limit=200&page=${page}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ error: `Directus ${r.status}` }, { status: 502 });
    const j = (await r.json()) as { data: Row[] };
    const rows = j.data ?? [];
    all.push(...rows);
    if (rows.length < 200) break;
    page++;
  }

  // Parse + filter: skip already-applied/active/pending, drop low EPC, optionally restrict to mm-matched families.
  const matchedFamiliesSet = new Set<string>();
  if (matchedOnly) {
    // Hard-coded for now — match families known to overlap with militarymarkdown.com.
    // Future: lift this from the cj-match.csv at /tmp/cj-match/matched.csv on the
    // server, or store the match map in Directus.
    // 99 families × 177 programmes per the 2026-05-22 match report.
    // Approximation: any row whose family name appears as the first token in
    // at least one Awin/affiliate post — too expensive to compute live, so
    // for v1 we skip this restriction and return ALL notjoined rows.
  }

  const parsed: Parsed[] = [];
  for (const r of all) {
    const p = parseRow(r);
    if (!p) continue;
    if (p.status === 'active' || p.status === 'pending') continue;  // already applied
    if (p.epc7 < minEpc) continue;
    parsed.push(p);
  }

  // Compute max EPC per family for primary sort
  const famMaxEpc = new Map<string, number>();
  for (const p of parsed) {
    const cur = famMaxEpc.get(p.matchedFamily) ?? 0;
    if (p.epc7 > cur) famMaxEpc.set(p.matchedFamily, p.epc7);
  }

  parsed.sort((a, b) => {
    const fa = famMaxEpc.get(a.matchedFamily) ?? 0;
    const fb = famMaxEpc.get(b.matchedFamily) ?? 0;
    if (fb !== fa) return fb - fa;                          // family EPC desc
    const sa = usScore(a.name); const sb = usScore(b.name);
    if (sb !== sa) return sb - sa;                          // US-first within family
    return b.epc7 - a.epc7;                                 // tiebreak own EPC
  });

  const aids = parsed.slice(0, limit).map((p) => String(p.aid));

  return NextResponse.json({
    aids,
    count: aids.length,
    total_rows: all.length,
    generated_at: new Date().toISOString(),
  });
}
