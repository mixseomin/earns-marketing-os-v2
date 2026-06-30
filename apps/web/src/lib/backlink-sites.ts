// Single source of truth for the portfolio sites a backlink source can target.
// A backlink source = one shared cross-project entity (human_tasks platform_key
// 'backlink'); the sites it applies to live in prep_payload.site_status keys.
// These slugs are those keys — keep them stable (they are persisted in the DB).
export const BACKLINK_SITES: { slug: string; domain: string; label: string; emoji: string }[] = [
  { slug: 'militarycalc',     domain: 'militarycalc.com',     label: 'MilitaryCalc',     emoji: '🪖' },
  { slug: 'govcalcs',         domain: 'govcalcs.com',         label: 'GovCalcs',         emoji: '🏛️' },
  { slug: 'visagps',          domain: 'visagps.com',          label: 'VisaGPS',          emoji: '🛂' },
  { slug: 'paydochub',        domain: 'paydochub.com',        label: 'PayDocHub',        emoji: '🧾' },
  { slug: 'maileyes',         domain: 'maileyes.com',         label: 'MailEyes',         emoji: '📧' },
  { slug: 'chatlt',           domain: 'chatlt.com',           label: 'ChatLT',           emoji: '💬' },
  { slug: 'cities',           domain: 'cities.gg',            label: 'Cities.gg',        emoji: '🏙️' },
  { slug: 'militarymarkdown', domain: 'militarymarkdown.com', label: 'MilitaryMarkdown', emoji: '🪖' },
];

const BY_DOMAIN = new Map(BACKLINK_SITES.map((s) => [s.domain, s.slug]));

// domain (with/without trailing slash, www) → backlink site slug, or null.
export function siteSlugForDomain(domain: string): string | null {
  const d = domain.replace(/^www\./, '').replace(/\/$/, '');
  return BY_DOMAIN.get(d) ?? null;
}
