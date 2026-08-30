import { RefreshGscBtn } from './refresh-gsc-btn';
import { SeoSitesTable } from './seo-sites-table';
import { Panel } from './ui/panel';
import { loadGscTimeSeries, pickSiteSeries } from '@/lib/projects/gsc-timeseries';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';
import { loadGa4Properties, pickGa4 } from '@/lib/projects/ga4-properties';
import { loadGa4Realtime, pickGa4Realtime } from '@/lib/projects/ga4-realtime';
import { loadGa4Events, pickGa4Events } from '@/lib/projects/ga4-events';
import { loadBingStats, pickBing } from '@/lib/projects/bing-stats';
import { loadGa4AiReferrals, pickGa4Ai } from '@/lib/projects/ga4-ai-referrals';
import { loadSubscribers, pickSubs } from '@/lib/projects/subscribers';
import { loadYandexStats, pickYandex } from '@/lib/projects/yandex-stats';
import { loadBacklinkStats, pickBacklinks } from '@/lib/projects/backlink-stats';
import { loadAdsenseByDomain } from '@/lib/adsense/by-domain';

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
// astrolas.com: chưa launch — gỡ khỏi Bing/IndexNow submission + ẩn row (2026-07-02).
// GSC property vẫn verified (dùng lại khi launch), chỉ không hiển thị + không submit.
const HIDDEN_DOMAINS = new Set<string>(['techwhiff.com', 'loginwiz.com', 'astrolas.com']);

// Map domain → MOS2 project id + visual label.
// GA4 property ID không hardcode ở đây — auto-pulled từ ga4-properties.json
// (35 sites, daily cron). Xem lib/projects/ga4-properties.ts.
const SITE_META: Record<string, { project?: string; emoji: string; review?: string }> = {
  'militarymarkdown.com': { project: 'militarymarkdown', emoji: '🪖', review: '2026-10-25' },  // dormant husk (pivoted to militarycalc): 31 impr/0 clk 07-27 → quarterly, not 2-wk
  'militarycalc.com': { project: 'militarycalc', emoji: '🪖', review: '2026-09-20' },  // 08-30 review: 668 impr / 0 click / pos TB 61.3, GROWTH theo script (impr +11%, URL +33%) nhưng click = 0 ở CẢ HAI cửa sổ. Head terms nằm pos 62-93 (bah calculator 86.8, gi bill calculator 83.2, mha calculator 84.8) → KHÔNG có cần gạt snippet: CTR-opportunity 0, striking-distance 0, question 0. Cùng chẩn đoán với visagps 08-16: thiếu AUTHORITY, không thiếu content. Trang chủ ăn 344/668 impr (51%) ở pos 80.9. GEO gate SẠCH (GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Google-Extended đều 200, llms.txt 200, robots mở). Sửa được + đã ship: trang chủ trước đó KHÔNG phát JSON-LD nào (chỉ Organization của layout) trong khi /bah/2026-changes phát đủ Article+WebApplication+ItemList+Offer → thêm WebSite+WebApplication+ItemList (commit 1e654f4). Và bắt được lỗi deploy toàn site: Next gửi s-maxage=31536000 nên CF giữ HTML MỘT NĂM — trang chủ đang ở tuổi 2,8 ngày trong khi origin đã có bản mới; purge CF nay là bước [5/5] của deploy.sh (a51db39). recheck: pos của trang chủ + head terms có nhúc nhích sau khi có backlink chưa; nếu vẫn pos 80+ thì cần gạt duy nhất là link, đừng sửa content nữa
  'visagps.com': { project: 'visagps', emoji: '🛂', review: '2026-09-06' },  // 08-16 review: hết tuần trăng mật — DERANK không phải deindex (case-status/processing-time/priority-date/home đều 'Submitted and indexed'), pos TB 45.5→74.4, impr -83%. Head terms nằm pos 60-99 (visa bulletin 77, priority date tracker 92, green card tracker 86); 0 CTR-opportunity, 0 striking-distance → sửa snippet vô nghĩa lúc này. Thiếu AUTHORITY. GEO ok (GPTBot/ClaudeBot/PerplexityBot 200, llms.txt 200) trừ schema trang tool chỉ có WebSite/Organization/Breadcrumb → thiếu WebApplication+FAQPage. Lever=backlink 3 trang trụ + schema + bồi /citizenship-test,/glossary (nhóm đang tăng). play card đã lập
  'govcalcs.com': { project: 'govcalcs', emoji: '🏛️', review: '2026-09-14' },  // 08-17 review: MẤT INDEX gần hết — impr -100% (còn 88), URL -98% (còn 22). URL Inspection: chỉ trang chủ PASS; /take-home-pay/california (hub 1 tầng, KHÔNG noindex, robots ALLOWED) = 'Crawled - currently not indexed' lastCrawl 23/06; /rmd/age-96 (trang top impr, pos 2.4) cũng vậy. Sau prune 07-11, Google loại tiếp cả tier hub → kết luận 07-27 'prune working' là đọc nhầm phần impressions còn dư. Không phải lỗi kỹ thuật (sitemap 370, GPTBot/ClaudeBot 200, llms.txt 200, FAQPage schema ok; noindex+nofollow trên route 2 tầng là cố ý từ 07-14). Lever=làm 10-15 hub thành nội dung ĐỘC NHẤT (bảng thuế bang theo năm + ví dụ + nguồn IRS) + authority, đo bằng lastCrawl/verdict chứ không phải impressions (play #566)
  'mintalmanac.com': { project: 'mint-almanac', emoji: '🪙', review: '2026-08-20' },  // 08-02 review: Bing impr 62→0 = new-site volatility (13/161 indexed, pos 50-80), NOT CF/breakage (0 firewall blocks ASN-8075, apex crawled 0-err). Google GROWING. Fixed: WebApplication schema live (7 tools) + www→apex 301 + IndexNow 161 URL. Bing-first → lever=authority/seeding numismatic communities. recheck Bing index count
  'paydochub.com': { project: 'paydochub', emoji: '🧾', review: '2026-09-13' },  // 08-16 review: -93% impr / -72% URLs = the 07-11 noindex PRUNE landing, not a break (07-27 "seasonal demand" verdict was wrong). URL Inspection: thin pages "Crawled - currently not indexed", /staples "Excluded by noindex", all pages serve 200, sitemap 55 URLs. isRichEmployer needs ≥2 of portal/platforms/shot → only 47 of 591 indexable; 174 are one signal short. Prune shipped, ENRICH never did. Lever=fill portal/shot on the top-pv near-miss pages (play #550). recheck: rich-tier impressions after the first batch of 20
  'cities.gg': { project: 'cities-gg', emoji: '🏙️', review: '2026-09-06' },  // 08-16 review: RANKING DECLINE tiếp diễn (impr -55%, pos 29→51, 548 URL) nhưng KHÔNG deindex — london-england/map/home đều indexed. Sức ép core-update lên trang programmatic mỏng, đúng như 08-02. Tìm được: nhu cầu Hà Lan thật (334 impr 'routeplanner meerdere adressen'…) nhưng URL đang rank là SUBDOMAIN CŨ routeplanner.cities.gg/nl/ đi 2 chặng 301→308 mới tới /route-planner/nl (pos 88, CTR 0) → gom về 1 chặng + sitemap + internal link; đã IndexNow 12 URL locale. GPTBot/ClaudeBot 403 do WAF RULE CỐ Ý 2026-07-30 (GPTBot 1477 req/window thổi ISR cache lên 410MB) — không ảnh hưởng Google, nhưng đồng nghĩa 0 citation ChatGPT/Claude, cần quyết lại nếu muốn GEO
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
  'hljournal.xyz': { project: 'hyperjournal', emoji: '📓' },
  'astrolas.com': { project: 'astrolas', emoji: '🔭' },
  'mamphat.com': { emoji: '☸️' },
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
  const ga4Realtime = await loadGa4Realtime();
  const ga4Events = await loadGa4Events();
  const bingPayload = await loadBingStats();
  const ga4AiPayload = await loadGa4AiReferrals();
  const adsenseByDomain = await loadAdsenseByDomain(7);
  const subsPayload = await loadSubscribers();
  const yandexPayload = await loadYandexStats();
  const backlinkPayload = await loadBacklinkStats();

  if (!payload) {
    return (
      <Panel title="SEO Sites Overview">
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>GSC data unavailable — daily cron at 02:30 UTC.</p>
      </Panel>
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
    <Panel
      title="SEO Sites Overview"
      subtitle={`GSC live · ${rows.length} sites · last sync ${updated}`}
      actions={<>
        <a href="/seo/keyword-research" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-2)', textDecoration: 'none', background: 'var(--bg-2)' }}>
          🔍 Keyword Research
        </a>
        <RefreshGscBtn />
      </>}
    >

      <SeoSitesTable
        rows={rows.map((r) => {
          const meta = SITE_META[r.domain] || { emoji: '🌐' };
          const bing = pickBing(bingPayload, r.domain);
          const bl = pickBacklinks(backlinkPayload, r.domain, meta.project);
          const ai = pickGa4Ai(ga4AiPayload, r.domain);
          const rt = pickGa4Realtime(ga4Realtime, r.domain);
          const ev = pickGa4Events(ga4Events, r.domain);
          return {
            domain: r.domain,
            emoji: meta.emoji,
            project: meta.project,
            review: meta.review,
            ga4PropertyId: pickGa4(ga4Payload, r.domain),
            subscribers: pickSubs(subsPayload, r.domain),
            yandex_impr_7d: pickYandex(yandexPayload, r.domain)?.impr_7d ?? null,
            yandex_clicks_7d: pickYandex(yandexPayload, r.domain)?.clicks_7d ?? null,
            yandex_in_search: pickYandex(yandexPayload, r.domain)?.in_search ?? null,
            yandex_sqi: pickYandex(yandexPayload, r.domain)?.sqi ?? null,
            ga4_active_5min: rt?.last5min ?? null,
            ga4_active_30min: rt?.last30min ?? null,
            ga4_interactions_7d: ev?.total ?? null,
            ga4_interactions_by: ev?.byEvent ?? null,
            impressions_7d: r.stats.impressions_7d,
            clicks_7d: r.stats.clicks_7d,
            avg_position_7d: r.stats.avg_position_7d,
            pages_with_impressions_7d: r.stats.pages_with_impressions_7d,
            sitemap_urls_submitted: r.stats.sitemap_urls_submitted,
            bing_impressions_7d: bing?.impressions_7d ?? null,
            bing_clicks_7d: bing?.clicks_7d ?? null,
            bing_ts_30d: bing?.ts_30d ?? null,
            bing_feeds_indexed: bing?.feeds_urls_indexed ?? null,
            bing_in_index: bing?.in_index ?? null,
            bing_in_links: bing?.in_links ?? null,
            bing_errors_4xx_30d: bing?.errors_4xx_30d ?? null,
            bing_crawled_30d: bing?.crawled_pages_30d ?? null,
            bl_total: bl?.total ?? null,
            bl_done: bl?.done ?? null,
            bl_inflight: bl?.inflight ?? null,
            bl_pending: bl?.pending ?? null,
            bl_broken: bl?.broken ?? null,
            bl_by_status: bl?.byStatus ?? null,
            ai_sessions_7d: ai?.sessions_7d ?? null,
            ai_sessions_28d: ai?.sessions_28d ?? null,
            ai_by_engine: ai?.byEngine_28d ?? null,
            adsense_earnings_today: adsenseByDomain[r.domain]?.earnings_today_usd ?? null,
            adsense_impressions_today: adsenseByDomain[r.domain]?.impressions_today ?? null,
            adsense_clicks_today: adsenseByDomain[r.domain]?.clicks_today ?? null,
            adsense_earnings_7d: adsenseByDomain[r.domain]?.earnings_usd ?? null,
            adsense_impressions_7d: adsenseByDomain[r.domain]?.impressions ?? null,
            adsense_rpm_7d: adsenseByDomain[r.domain]?.rpm_usd ?? null,
            adsense_page_views_7d: adsenseByDomain[r.domain]?.page_views ?? null,
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
    </Panel>
  );
}
