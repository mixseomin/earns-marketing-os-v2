import Link from 'next/link';

const GSC_JSON_URL = 'https://militarymarkdown.com/wp-content/uploads/phase7/gsc-latest.json';

type GscSiteStats = {
  pages_with_impressions_7d: number;
  clicks_7d: number;
  impressions_7d: number;
  avg_position_7d: number;
  sitemaps_count: number;
  sitemap_urls_submitted: number;
  sitemap_urls_indexed: number;
  period: string;
};

type GscPayload = {
  updated_at: string;
  sites: Record<string, GscSiteStats>;
};

// Map GSC site URL → MOS2 project id + display name
const SITE_MAPPING: Array<{ matchKey: string; project: string; label: string; emoji: string }> = [
  { matchKey: 'militarymarkdown', project: 'militarymarkdown', label: 'militarymarkdown.com', emoji: '🪖' },
  { matchKey: 'cities.gg', project: 'cities-gg', label: 'cities.gg', emoji: '🏙️' },
  { matchKey: 'maileyes', project: 'maileyes', label: 'maileyes.com', emoji: '📧' },
];

function pickSite(payload: GscPayload, matchKey: string): GscSiteStats | null {
  for (const k of Object.keys(payload.sites)) {
    if (k.startsWith('sc-domain:') && k.includes(matchKey)) return payload.sites[k] ?? null;
  }
  for (const k of Object.keys(payload.sites)) {
    if (k.includes(matchKey)) return payload.sites[k] ?? null;
  }
  return null;
}

export async function SeoSitesPanel() {
  let payload: GscPayload | null = null;
  try {
    const r = await fetch(GSC_JSON_URL, { next: { revalidate: 600 } });
    if (r.ok) payload = (await r.json()) as GscPayload;
  } catch { /* fall through */ }

  if (!payload) {
    return (
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>SEO Sites Overview</h2>
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>GSC data unavailable — daily cron at 02:30 UTC.</p>
      </div>
    );
  }

  const rows = SITE_MAPPING
    .map((m) => ({ ...m, stats: pickSite(payload!, m.matchKey) }))
    .filter((r) => r.stats !== null) as Array<typeof SITE_MAPPING[0] & { stats: GscSiteStats }>;

  // Totals
  const totalImps = rows.reduce((s, r) => s + r.stats.impressions_7d, 0);
  const totalClicks = rows.reduce((s, r) => s + r.stats.clicks_7d, 0);
  const totalPages = rows.reduce((s, r) => s + r.stats.pages_with_impressions_7d, 0);
  const totalSitemap = rows.reduce((s, r) => s + r.stats.sitemap_urls_submitted, 0);
  const avgPos = rows.length ? rows.reduce((s, r) => s + r.stats.avg_position_7d, 0) / rows.length : 0;
  const updated = new Date(payload.updated_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', fontWeight: 500 };
  const tone = (cond: boolean) => ({ color: cond ? 'var(--ok)' : 'var(--fg-2)' });

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: 0 }}>
          SEO Sites Overview
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 10, letterSpacing: '0.06em' }}>// GSC live · {rows.length} sites · last sync {updated}</small>
        </h2>
        <Link href="/seo" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Details →</Link>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Site</th>
            <th style={head}>Impr 7d</th>
            <th style={head}>Clicks 7d</th>
            <th style={head}>CTR</th>
            <th style={head}>Avg Pos</th>
            <th style={head}>Pages</th>
            <th style={head}>Sitemap URLs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ctr = r.stats.impressions_7d ? (r.stats.clicks_7d / r.stats.impressions_7d * 100) : 0;
            return (
              <tr key={r.project}>
                <td style={{ ...cell, textAlign: 'left' }}>
                  <Link href={`/p/${r.project}`} style={{ color: 'var(--fg-1)', textDecoration: 'none', fontWeight: 600 }}>
                    {r.emoji} {r.label}
                  </Link>
                </td>
                <td style={{ ...cell, textAlign: 'right', ...tone(r.stats.impressions_7d > 0) }}>{r.stats.impressions_7d.toLocaleString()}</td>
                <td style={{ ...cell, textAlign: 'right', ...tone(r.stats.clicks_7d > 0) }}>{r.stats.clicks_7d.toLocaleString()}</td>
                <td style={{ ...cell, textAlign: 'right', ...tone(ctr > 0) }}>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</td>
                <td style={{ ...cell, textAlign: 'right', ...tone(r.stats.avg_position_7d > 0 && r.stats.avg_position_7d < 20) }}>{r.stats.avg_position_7d > 0 ? r.stats.avg_position_7d.toFixed(1) : '—'}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.stats.pages_with_impressions_7d}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.stats.sitemap_urls_submitted.toLocaleString()}</td>
              </tr>
            );
          })}
          <tr style={{ background: 'var(--bg-2)' }}>
            <td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>TOTAL</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalImps.toLocaleString()}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalClicks.toLocaleString()}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalImps > 0 ? (totalClicks / totalImps * 100).toFixed(2) + '%' : '—'}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{avgPos > 0 ? avgPos.toFixed(1) : '—'}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalPages}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{totalSitemap.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
