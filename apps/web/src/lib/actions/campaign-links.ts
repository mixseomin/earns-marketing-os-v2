'use server';
// One pick-list of every link you might drop into a campaign/email: affiliate offers
// (/offers → affiliate_programs) + own products (/products → Directus products). Both live
// in Directus; this flattens them to {label,url,sub} so the drawer's link field is a PICKER,
// not a free-text paste. ponytail: own lightweight offer fetch (getOffersView is filtered +
// paginated for the page UI — wrong shape for a full catalog) rather than plumb its view here.

import { getProductsView } from '@/lib/products/data';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const NET: Record<string, string> = {
  '6d5e233c-ad3d-4b90-a46a-541177170edc': 'Awin',
  '45388bdb-ffdc-4a0d-993a-da66e3d28105': 'CJ',
};

export interface CampaignLink {
  kind: 'offer' | 'product';
  label: string;
  url: string;
  sub: string;      // network · vertical  |  platform
  status?: string;  // active/pending (offer) or product status
}

const isApproved = (s?: string) => /active|joined|approved/i.test(s ?? '');

async function offerLinks(): Promise<CampaignLink[]> {
  if (!DIRECTUS_TOKEN) return [];
  const out: CampaignLink[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${DIRECTUS_URL}/items/affiliate_programs?fields=name,status,vertical,affiliate_url,account_id&filter[affiliate_url][_nnull]=true&limit=200&page=${page}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, next: { revalidate: 300 } });
    if (!r.ok) break;
    const rows = ((await r.json()) as { data?: Array<Record<string, unknown>> }).data ?? [];
    for (const x of rows) {
      const u = String(x.affiliate_url ?? '').trim();
      if (!u) continue;
      out.push({
        kind: 'offer',
        label: String(x.name ?? '').trim() || '(offer)',
        url: u,
        status: String(x.status ?? ''),
        sub: `${NET[String(x.account_id ?? '')] ?? 'Offer'}${x.vertical ? ' · ' + String(x.vertical) : ''}`,
      });
    }
    if (rows.length < 200) break;
  }
  return out;
}

export async function listCampaignLinks(): Promise<CampaignLink[]> {
  const [offers, pv] = await Promise.all([
    offerLinks().catch(() => []),
    getProductsView(365).then((v) => v.rows).catch(() => []),
  ]);
  const products: CampaignLink[] = pv
    .filter((p) => p.url)
    .map((p) => ({ kind: 'product', label: p.title, url: p.url as string, sub: p.platform, status: p.status ?? undefined }));
  // Approved offers first, then the rest alphabetically — the pickable ones surface on top.
  offers.sort((a, b) => Number(isApproved(b.status)) - Number(isApproved(a.status)) || a.label.localeCompare(b.label));
  return [...offers, ...products];
}
