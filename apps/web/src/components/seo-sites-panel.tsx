import { RefreshGscBtn } from './refresh-gsc-btn';
import { SeoSitesTable } from './seo-sites-table';
import { loadGscTimeSeries, pickSiteSeries } from '@/lib/projects/gsc-timeseries';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';
import { loadGa4Properties, pickGa4 } from '@/lib/projects/ga4-properties';
import { loadBingStats, pickBing } from '@/lib/projects/bing-stats';

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

// Domain ẩn khỏi panel (vẫn trong GSC nhưng không hiển thị MOS2).
const HIDDEN_DOMAINS = new Set<string>(['techwhiff.com', 'loginwiz.com']);

// Map domain → MOS2 project id + visual label.
// GA4 property ID không hardcode ở đây — auto-pulled từ ga4-properties.json
// (35 sites, daily cron). Xem lib/projects/ga4-properties.ts.
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
  'chatlt.com': { emoji: '💬' },
  'bestweightlosspills.reviews': { emoji: '💊' },
  'hljournal.xyz': { emoji: '📓' },
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
    const r = await fetch(GSC_JSON_URL, { next: { revalidate: 600, tags: ['gsc-json'] } });
    if (r.ok) payload = (await r.json()) as GscPayload;
  } catch { /* fall through */ }
  const tsPayload = await loadGscTimeSeries();
  const ga4Payload = await loadGa4Properties();
  const bingPayload = await loadBingStats();

  if (!payload) {
    return (
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>SEO Sites Overview</h2>
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>GSC data unavailable — daily cron at 02:30 UTC.</p>
      </div>
    );
  }

  const rows = mergeAndDedupe(payload).filter((r) => !HIDDEN_DOMAINS.has(r.domain));
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
        <RefreshGscBtn />
      </div>

      <SeoSitesTable
        rows={rows.map((r) => {
          const meta = SITE_META[r.domain] || { emoji: '🌐' };
          const bing = pickBing(bingPayload, r.domain);
          return {
            domain: r.domain,
            emoji: meta.emoji,
            project: meta.project,
            ga4PropertyId: pickGa4(ga4Payload, r.domain),
            impressions_7d: r.stats.impressions_7d,
            clicks_7d: r.stats.clicks_7d,
            avg_position_7d: r.stats.avg_position_7d,
            pages_with_impressions_7d: r.stats.pages_with_impressions_7d,
            sitemap_urls_submitted: r.stats.sitemap_urls_submitted,
            bing_impressions_7d: bing?.impressions_7d ?? null,
            bing_clicks_7d: bing?.clicks_7d ?? null,
            bing_feeds_indexed: bing?.feeds_urls_indexed ?? null,
          };
        })}
        timeseries={Object.fromEntries(
          rows.map((r) => {
            const series = tsPayload ? pickSiteSeries(tsPayload, r.domain) : null;
            return [r.domain, series?.points || []] as [string, GscDailyPoint[]];
          })
        )}
        totals={{ imps: totalImps, clicks: totalClicks, pages: totalPages, sitemap: totalSitemap, avgPos }}
      />
    </div>
  );
}
