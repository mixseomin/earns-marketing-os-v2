// Affiliate-offer telemetry for cities.gg, shown in the SEO section.
// Source: https://cities.gg/api/offer-stats (aggregates cgg_events offer_view_*
// / offer_click_* fired by the contextual Awin CTAs on walk pages). 5-min cache.
// Conversions/commission live in Awin (clickref = walk_<offer>_<city>); this
// panel is the site-side open/click funnel that precedes them.

const OFFER_META: Record<string, { label: string; merchant: string }> = {
  ghost: { label: '👻 Ghost walking tours', merchant: 'US Ghost Adventures · US cities' },
  samboat: { label: '⛵ Boat rental', merchant: 'SamBoat · water cities' },
};

interface OfferRow {
  key: string;
  views7: number; clicks7: number; ctr7: number;
  views30: number; clicks30: number; ctr30: number;
}

async function load(): Promise<{ updated: string; offers: OfferRow[] } | null> {
  try {
    const r = await fetch('https://cities.gg/api/offer-stats', { next: { revalidate: 300 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const th: React.CSSProperties = { textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--fg-3)', fontSize: 11, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums' };

export async function CitiesOfferStats() {
  const data = await load();
  const offers = data?.offers ?? [];

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: 0 }}>
          🏙️ cities.gg — Affiliate offers (Awin)
        </h2>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          conversions → <a href="https://ui.awin.com/" target="_blank" rel="noopener" style={{ color: 'var(--ok)' }}>Awin</a>
        </span>
      </div>

      {offers.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>No offer activity yet — CTAs live on walk pages (Ghost on US cities, SamBoat on water cities).</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th style={{ ...th, textAlign: 'left' }}>Offer</th>
              <th style={th}>Views 7d</th>
              <th style={th}>Clicks 7d</th>
              <th style={th}>CTR 7d</th>
              <th style={th}>Views 30d</th>
              <th style={th}>Clicks 30d</th>
              <th style={th}>CTR 30d</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const meta = OFFER_META[o.key] ?? { label: o.key, merchant: '' };
              return (
                <tr key={o.key} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ fontWeight: 600 }}>{meta.label}</span>
                    {meta.merchant && <span style={{ display: 'block', color: 'var(--fg-3)', fontSize: 11 }}>{meta.merchant}</span>}
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
      )}
    </div>
  );
}
