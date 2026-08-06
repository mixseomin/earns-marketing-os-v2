// Cross-site affiliate-offer funnel (Awin), config-driven so every platform shows in one section.
// Each site exposes /api/offer-stats returning { offers: [{ key, views7, clicks7, ctr7, views30,
// clicks30, ctr30 }] } — the on-site open/click funnel that precedes Awin conversions/commission.
// Add a site by dropping a config entry here once its endpoint is live; the panel picks it up.

import { internalUrl } from '../lib/internal-origin';
import { Panel } from './ui/panel';
import { OfferTable } from './affiliate-offer-table';

export type OfferMeta = { label: string; merchant: string; url?: string };
type SiteCfg = { key: string; title: string; statsUrl: string; offerMeta: Record<string, OfferMeta>; note?: string };

const SITES: SiteCfg[] = [
  {
    key: 'cities.gg',
    title: '🏙️ cities.gg',
    statsUrl: 'https://cities.gg/api/offer-stats',
    offerMeta: {
      // cities.gg /api/offer-stats doesn't return sample_url yet; add it there for on-site preview links.
      ghost: { label: '👻 Ghost walking tours', merchant: 'US Ghost Adventures · US cities' },
      samboat: { label: '⛵ Boat rental', merchant: 'SamBoat · water cities' },
    },
    note: 'CTAs live on walk pages (Ghost on US cities, SamBoat on water cities).',
  },
  {
    key: 'steamsolo.com',
    title: '🎮 steamsolo.com',
    statsUrl: 'https://steamsolo.com/api/offer-stats',
    offerMeta: {
      fiverr_coach: { label: '🎯 Game coaching', merchant: 'Fiverr · per-game coaching/boosting' },
      fiverr_art: { label: '🎨 Custom game art', merchant: 'Fiverr · logos, art, mods' },
      amazon: { label: '📦 Amazon gear', merchant: 'Amazon · steamsolo-20 (gear/setup/universal)' },
      eyewear: { label: '👓 Blue-light glasses', merchant: 'SOJOS · long-session eye strain' },
    },
    note: 'Bridged CTA on guide pages, offer chosen by guide intent (Amazon convs tracked in Amazon dashboard by ascsubtag=guide_<slug>).',
  },
];

export interface OfferRow {
  key: string;
  views7: number; clicks7: number; ctr7: number;
  views30: number; clicks30: number; ctr30: number;
  sample_url?: string | null; // a live page on OUR site currently showing this offer
  recent_clicks?: { url: string; title: string; ts: string }[]; // exact guides that converted
}

async function load(url: string): Promise<{ offers: OfferRow[] } | null> {
  try {
    const r = await fetch(internalUrl(url), { next: { revalidate: 300, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function AffiliateOffersPanel() {
  const results = await Promise.all(SITES.map(async (s) => ({ cfg: s, data: await load(s.statsUrl) })));
  const live = results.filter((r) => r.data); // only sites whose endpoint responded
  if (live.length === 0) return null;

  return (
    <Panel
      title="💸 Affiliate offers"
      actions={
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          conversions → <a href="https://ui.awin.com/" target="_blank" rel="noopener" style={{ color: 'var(--ok)' }}>Awin</a>
          {' · '}<a href="https://affiliate-program.amazon.com/home/reports" target="_blank" rel="noopener" style={{ color: 'var(--ok)' }}>Amazon</a>
        </span>
      }
    >
      {live.map(({ cfg, data }) => (
        <div key={cfg.key} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{cfg.title}</div>
          {(data!.offers ?? []).length === 0
            ? <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>No offer activity yet{cfg.note ? ` — ${cfg.note}` : ''}.</p>
            : <OfferTable offers={data!.offers} meta={cfg.offerMeta} />}
        </div>
      ))}
    </Panel>
  );
}
