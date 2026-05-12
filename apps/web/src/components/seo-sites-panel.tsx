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

// Map domain → MOS2 project id + visual label
const SITE_META: Record<string, { project?: string; emoji: string }> = {
  'militarymarkdown.com': { project: 'militarymarkdown', emoji: '🪖' },
  'cities.gg': { project: 'cities-gg', emoji: '🏙️' },
  'maileyes.com': { project: 'maileyes', emoji: '📧' },
  'cee-trust.org': { emoji: '🔍' },
  'techwhiff.com': { emoji: '🤓' },
  'sitedd.com': { emoji: '🌐' },
  'wenoted.com': { emoji: '📝' },
  'loginwiz.com': { emoji: '🔐' },
  'steamsolo.com': { emoji: '🎮' },
  'on.tc': { emoji: '🛠️' },
  'scriptinstant.blogspot.com': { emoji: '📜' },
};

function normalize(key: string): string {
  // sc-domain:militarymarkdown.com → militarymarkdown.com
  // https://cities.gg/ → cities.gg
  return key
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

// Deduplicate sites: when same domain has multiple keys (sc-domain + https), pick
// the one with the most data (impressions desc, then sitemap_urls_submitted desc).
function mergeAndDedupe(payload: GscPayload): Array<{ domain: string; stats: GscSiteStats }> {
  const byDomain = new Map<string, GscSiteStats>();
  for (const [key, stats] of Object.entries(payload.sites)) {
    const d = normalize(key);
    const existing = byDomain.get(d);
    if (!existing) { byDomain.set(d, stats); continue; }
    // Prefer richer entry
    const richer =
      stats.impressions_7d > existing.impressions_7d ? stats :
      stats.impressions_7d < existing.impressions_7d ? existing :
      stats.sitemap_urls_submitted > existing.sitemap_urls_submitted ? stats : existing;
    byDomain.set(d, richer);
  }
  return Array.from(byDomain.entries())
    .map(([domain, stats]) => ({ domain, stats }))
    .sort((a, b) => {
      // Sort by impressions desc, then by sitemap_urls desc, then by domain alpha
      if (b.stats.impressions_7d !== a.stats.impressions_7d) return b.stats.impressions_7d - a.stats.impressions_7d;
      if (b.stats.sitemap_urls_submitted !== a.stats.sitemap_urls_submitted) return b.stats.sitemap_urls_submitted - a.stats.sitemap_urls_submitted;
      return a.domain.localeCompare(b.domain);
    });
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

  const rows = mergeAndDedupe(payload);
  const totalImps = rows.reduce((s, r) => s + r.stats.impressions_7d, 0);
  const totalClicks = rows.reduce((s, r) => s + r.stats.clicks_7d, 0);
  const totalPages = rows.reduce((s, r) => s + r.stats.pages_with_impressions_7d, 0);
  const totalSitemap = rows.reduce((s, r) => s + r.stats.sitemap_urls_submitted, 0);
  const weightedPos = rows.reduce((acc, r) => acc + (r.stats.avg_position_7d * r.stats.impressions_7d), 0);
  const avgPos = totalImps > 0 ? weightedPos / totalImps : 0;
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
            const meta = SITE_META[r.domain] || { emoji: '🌐' };
            const SiteCell = meta.project
              ? <Link href={`/p/${meta.project}`} style={{ color: 'var(--fg-1)', textDecoration: 'none', fontWeight: 600 }}>{meta.emoji} {r.domain}</Link>
              : <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{meta.emoji} {r.domain}</span>;
            return (
              <tr key={r.domain}>
                <td style={{ ...cell, textAlign: 'left' }}>{SiteCell}</td>
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
            <td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>TOTAL ({rows.length})</td>
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
