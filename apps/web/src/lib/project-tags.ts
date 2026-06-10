import type { Project } from './mock/types';

// Aliases each mode resolves to when searching the project switcher.
// Lets "forex" find a trading project, "ecommerce" find dropship/ecom, etc.
// Keep lowercase, hyphen-free where the search query likely is.
export const MODE_KEYWORDS: Record<string, string[]> = {
  affiliate:        ['affiliate', 'partner', 'commission', 'cpa', 'cpl', 'offer', 'network'],
  marketing:        ['brand', 'campaign', 'launch', 'pr', 'awareness', 'marketing'],
  seeding:          ['seeding', 'community', 'engagement', 'social', 'reddit', 'forum'],
  support:          ['support', 'tickets', 'helpdesk', 'cs', 'service'],
  ecom:             ['ecom', 'ecommerce', 'shop', 'store', 'cart', 'checkout', 'shopify'],
  'content-studio': ['content', 'studio', 'video', 'youtube', 'creator', 'shorts', 'podcast', 'media', 'faceless'],
  'lead-gen':       ['lead', 'leads', 'leadgen', 'b2b', 'outbound', 'sales', 'sdr', 'cold-email', 'email'],
  saas:             ['saas', 'software', 'subscription', 'mrr', 'product', 'app'],
  recruitment:      ['recruitment', 'hiring', 'talent', 'jobs', 'careers', 'recruit'],
  'real-estate':    ['real-estate', 'realestate', 'property', 'housing', 'rental', 're'],
  event:            ['event', 'conference', 'meetup', 'expo', 'summit', 'workshop'],
  trading:          ['trading', 'forex', 'fx', 'crypto', 'mt5', 'mt4', 'finance', 'investing', 'futures', 'stocks', 'fintech'],
  dropship:         ['dropship', 'ecommerce', 'pod', 'merch', 'store', 'tshirt', 'print-on-demand'],
  'personal-brand': ['personal-brand', 'influencer', 'creator', 'thought-leader'],
};

// Per-project overrides: project id → extra search aliases.
// Use this when a project's domain niche isn't obvious from its mode alone
// (e.g. cee-trust = SEO portfolio, militarymarkdown = SEO + military niche).
export const PROJECT_ALIAS_OVERRIDES: Record<string, string[]> = {
  'cee-trust':         ['seo', 'review', 'directory'],
  'militarymarkdown':  ['seo', 'military', 'review'],
  'cities-gg':         ['seo', 'travel', 'cities', 'nextjs'],
  'maileyes':          ['email', 'newsletter', 'tracking', 'opens'],
  'orit':              ['leadgen', 'contact', 'enrichment', 'extension'],
  'astrolas':          ['astrology', 'spiritual', 'faceless'],
  'hljournal':         ['trading', 'hyperliquid', 'journal', 'crypto'],
  'arbscan':           ['arbitrage', 'scanner', 'crypto', 'mev'],
  'chatlt':            ['chat', 'group-chat', 'pwa'],
  'mt5-tools':         ['mt5', 'metatrader', 'forex', 'ea', 'indicator'],
  'news-copilot':      ['ai', 'news', 'forex', 'trading-news'],
  'mailjet':           ['email', 'smtp'],
  'codecrate':         ['gumroad', 'digital-product', 'template'],
  'wenoted':           ['notes', 'pkm'],
  'bwp':               ['affiliate', 'review', 'weightloss'],
  'godb':              ['url-shortener', 'short'],
  'ismail':            ['email', 'newsletter', 'interspire'],
};

// Pull lowercase tokens from the free-form hashtags field: '#saas #indie' → ['saas','indie'].
function parseHashtags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\s+/)
    .map((t) => t.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean);
}

// Derive the full searchable tag list for a project: mode aliases + hashtags + overrides.
// Used by the project-switcher search so a query like "forex" matches the trading project
// even though "forex" appears nowhere in its name or id.
export function projectTags(p: Project): string[] {
  const out = new Set<string>();
  out.add(p.mode.toLowerCase());
  (MODE_KEYWORDS[p.mode] || []).forEach((t) => out.add(t));
  (PROJECT_ALIAS_OVERRIDES[p.id] || []).forEach((t) => out.add(t));
  parseHashtags(p.hashtags).forEach((t) => out.add(t));
  return Array.from(out);
}

// One flat lowercase blob a project can be matched against with includes().
// Combines name/id/website + mode + hashtags + oneLiner + every derived tag.
export function projectSearchHaystack(p: Project): string {
  return [
    p.name,
    p.id,
    p.website ?? '',
    p.mode,
    p.hashtags ?? '',
    p.oneLiner ?? '',
    projectTags(p).join(' '),
  ].join(' ').toLowerCase();
}
