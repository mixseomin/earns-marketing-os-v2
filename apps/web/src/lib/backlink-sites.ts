// Single source of truth for the portfolio sites a backlink source can target.
// A backlink source = one shared cross-project entity (human_tasks platform_key
// 'backlink'); the sites it applies to live in prep_payload.site_status keys.
// These slugs are those keys — keep them stable (they are persisted in the DB).
// niches = the site's topic tags. A catalog source (backlink_sources.audience_tags) is offered to a
// project when its niche tags overlap the site's (or it is tagged 'universal'). See generatePlaysForProject.
export const BACKLINK_SITES: { slug: string; domain: string; label: string; emoji: string; niches: string[] }[] = [
  { slug: 'militarycalc',     domain: 'militarycalc.com',     label: 'MilitaryCalc',     emoji: '🪖', niches: ['military', 'finance', 'veterans', 'retirement'] },
  { slug: 'govcalcs',         domain: 'govcalcs.com',         label: 'GovCalcs',         emoji: '🏛️', niches: ['gov', 'finance', 'retirement', 'payroll'] },
  { slug: 'visagps',          domain: 'visagps.com',          label: 'VisaGPS',          emoji: '🛂', niches: ['immigration'] },
  { slug: 'paydochub',        domain: 'paydochub.com',        label: 'PayDocHub',        emoji: '🧾', niches: ['payroll', 'hr', 'finance'] },
  { slug: 'maileyes',         domain: 'maileyes.com',         label: 'MailEyes',         emoji: '📧', niches: ['email', 'saas', 'marketing', 'devtools'] },
  { slug: 'chatlt',           domain: 'chatlt.com',           label: 'ChatLT',           emoji: '💬', niches: ['chat', 'saas'] },
  { slug: 'cities-gg',        domain: 'cities.gg',            label: 'Cities.gg',        emoji: '🏙️', niches: ['games', 'geo-data', 'reference'] },
  { slug: 'militarymarkdown', domain: 'militarymarkdown.com', label: 'MilitaryMarkdown', emoji: '🪖', niches: ['military', 'writing-tools', 'devtools'] },
  { slug: 'mint-almanac',     domain: 'mintalmanac.com',      label: 'Mint Almanac',     emoji: '🪙', niches: ['coins', 'collectibles'] },
  { slug: 'steamsolo',        domain: 'steamsolo.com',        label: 'steamsolo.com',    emoji: '🎮', niches: ['games', 'game-guides'] },
  { slug: 'earns-io',         domain: 'earns.io',             label: 'earns.io',         emoji: '💸', niches: ['make-money', 'side-hustle', 'affiliate', 'finance'] },
  { slug: 'hotel-arb',        domain: 'staymarlow.com',       label: 'StayMarlow',       emoji: '🏨', niches: ['travel', 'hotels', 'affiliate', 'ppc-arbitrage'] },
];

const BY_DOMAIN = new Map(BACKLINK_SITES.map((s) => [s.domain, s.slug]));
const BY_SLUG = new Set(BACKLINK_SITES.map((s) => s.slug));

// MOS2 project id → backlink site slug when they differ (most are identical).
// Empty by design: every project id now equals its site slug, so the site_status key the seeder/ext WRITE
// matches what the board READs. (Was {'cities-gg':'cities'} — that mismatch hid all 12 cities-gg tasks.)
const PROJECT_SLUG_OVERRIDE: Record<string, string> = {};

// domain (with/without trailing slash, www) → backlink site slug, or null.
export function siteSlugForDomain(domain: string): string | null {
  const d = domain.replace(/^www\./, '').replace(/\/$/, '');
  return BY_DOMAIN.get(d) ?? null;
}

// MOS2 project id → backlink site slug (key in human_tasks.site_status), or null
// if the project isn't a backlink-tracked site.
export function resolveSiteSlug(projectId: string): string | null {
  const slug = PROJECT_SLUG_OVERRIDE[projectId] ?? projectId;
  return BY_SLUG.has(slug) ? slug : null;
}

const BY_SLUG_NICHES = new Map(BACKLINK_SITES.map((s) => [s.slug, s.niches]));

// MOS2 project id → the site's niche tags (empty if unmapped → generator falls back to all plays).
export function nichesForProject(projectId: string): string[] {
  const slug = resolveSiteSlug(projectId);
  return (slug && BY_SLUG_NICHES.get(slug)) || [];
}
