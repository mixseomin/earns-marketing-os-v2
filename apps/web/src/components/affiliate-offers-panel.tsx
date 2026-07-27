// Cross-site affiliate-offer funnel (Awin), config-driven so every platform shows in one section.
// Each site exposes /api/offer-stats returning { offers: [{ key, views7, clicks7, ctr7, views30,
// clicks30, ctr30 }] } — the on-site open/click funnel that precedes Awin conversions/commission.
// Add a site by dropping a config entry here once its endpoint is live; the panel picks it up.

type OfferMeta = { label: string; merchant: string };
type SiteCfg = { key: string; title: string; statsUrl: string; offerMeta: Record<string, OfferMeta>; note?: string };

const SITES: SiteCfg[] = [
  {
    key: 'cities.gg',
    title: '🏙️ cities.gg',
    statsUrl: 'https://cities.gg/api/offer-stats',
    offerMeta: {
      ghost: { label: '👻 Ghost walking tours', merchant: 'US Ghost Adventures · US cities' },
      samboat: { label: '⛵ Boat rental', merchant: 'SamBoat · water cities' },
    },
    note: 'CTAs live on walk pages (Ghost on US cities, SamBoat on water cities).',
  },
  // Next: add sites once they embed Awin CTAs + expose /api/offer-stats. See the affiliate-embed
  // plan (decisions/2026-07-27-affiliate-offers-cross-site-plan.md). steamsolo is gated on joining
  // gaming programmes (no game-key/gear advertiser is joined on Awin yet).
];

interface OfferRow {
  key: string;
  views7: number; clicks7: number; ctr7: number;
  views30: number; clicks30: number; ctr30: number;
}

async function load(url: string): Promise<{ offers: OfferRow[] } | null> {
  try {
    const r = await fetch(url, { next: { revalidate: 300, tags: ['gsc-json'] } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const th: React.CSSProperties = { textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--fg-3)', fontSize: 11, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums' };

function OfferTable({ offers, meta }: { offers: OfferRow[]; meta: Record<string, OfferMeta> }) {
  return (
    <div className="table-scroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)' }}>
            <th style={{ ...th, textAlign: 'left' }}>Offer</th>
            <th style={th}>Views 7d</th><th style={th}>Clicks 7d</th><th style={th}>CTR 7d</th>
            <th style={th}>Views 30d</th><th style={th}>Clicks 30d</th><th style={th}>CTR 30d</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => {
            const m = meta[o.key] ?? { label: o.key, merchant: '' };
            return (
              <tr key={o.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  {m.merchant && <span style={{ display: 'block', color: 'var(--fg-3)', fontSize: 11 }}>{m.merchant}</span>}
                </td>
                <td style={td}>{o.views7}</td>
                <td style={td}>{o.clicks7}</td>
                <td style={{ ...td, color: o.ctr7 > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{o.ctr7}%</td>
                <td style={td}>{o.views30}</td>
                <td style={td}>{o.clicks30}</td>
                <td style={{ ...td, color: o.ctr30 > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{o.ctr30}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export async function AffiliateOffersPanel() {
  const results = await Promise.all(SITES.map(async (s) => ({ cfg: s, data: await load(s.statsUrl) })));
  const live = results.filter((r) => r.data); // only sites whose endpoint responded
  if (live.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: 0 }}>💸 Affiliate offers (Awin)</h2>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          conversions → <a href="https://ui.awin.com/" target="_blank" rel="noopener" style={{ color: 'var(--ok)' }}>Awin</a>
        </span>
      </div>

      {live.map(({ cfg, data }) => (
        <div key={cfg.key} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{cfg.title}</div>
          {(data!.offers ?? []).length === 0
            ? <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>No offer activity yet{cfg.note ? ` — ${cfg.note}` : ''}.</p>
            : <OfferTable offers={data!.offers} meta={cfg.offerMeta} />}
        </div>
      ))}
    </div>
  );
}
