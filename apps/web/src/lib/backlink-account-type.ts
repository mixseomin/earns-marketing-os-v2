// Backlink → account readiness classification. Keyed by platform_key (the canonical
// key from detectPlatformKeyFromUrl). Pure logic, no DB — shared by the server enrichment
// and any client display. Keys MUST match the platforms catalog (seed-data/platforms.ts).

export type BacklinkAccountType = 'persistent' | 'no-account' | 'special';

// B-type: email pitch / one-off submit / open edit — no persistent login account.
const NO_ACCOUNT = new Set([
  'wikipedia', 'calculator-net', 'llmstxt-cloud', 'militarywallet', 'kk-cooltools', 'recomendo',
]);
// C-type: needs an account but with a special gate (API key / SVN / reputation).
const SPECIAL = new Set(['crunchbase', 'stackexchange', 'wordpress-org']);

// null host (unrecognised) → treat as no-account (manual submit) — never false-block as "need account".
export function getBacklinkAccountType(platformKey: string | null): BacklinkAccountType {
  if (!platformKey) return 'no-account';
  if (NO_ACCOUNT.has(platformKey)) return 'no-account';
  if (SPECIAL.has(platformKey)) return 'special';
  return 'persistent';
}

// Readiness bucket for a backlink task — what the admin must do before posting.
export type ReadinessBucket = 'no-account' | 'missing' | 'setup' | 'warming' | 'ready' | 'locked';

const STATUS_BUCKET: Record<string, ReadinessBucket> = {
  active: 'ready', verified: 'ready',
  warming: 'warming', limited: 'warming',
  todo: 'setup', creating: 'setup',
  blocked: 'locked', banned: 'locked',
};

// accountType + the best matching account's status → bucket. No account row + a
// persistent/special platform → 'missing' (must create). no-account type short-circuits.
export function readinessBucket(accountType: BacklinkAccountType, accountStatus: string | null): ReadinessBucket {
  if (accountType === 'no-account') return 'no-account';
  if (!accountStatus) return 'missing';
  return STATUS_BUCKET[accountStatus] ?? 'setup';
}

// Pick the most-ready account when several exist on a platform (best status wins).
const STATUS_RANK: Record<string, number> = {
  active: 0, verified: 1, warming: 2, limited: 3, creating: 4, todo: 5, blocked: 6, banned: 7,
};
export function pickBestAccount<T extends { status: string }>(accounts: T[]): T | null {
  if (!accounts.length) return null;
  return [...accounts].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))[0] ?? null;
}

// ── Recommended P/B/S role for a NEW account on a source ─────────────────────
// Which account_type (personal | brand | seeding) fits a source, from the platform's
// catalog `category`. Directory/listing/launch/social = the BRAND is listed/represented;
// community/forum/blog/tech/Q&A = a PERSONA posts (a brand account gets flagged as spam in
// communities). Seeding = a manual choice (father/extra persona), never auto-recommended.
export type AccountRole = 'personal' | 'brand' | 'seeding';
// This operator is persona-first: most link placements (community, Q&A, blog, dev, social,
// even PH launches) go through a founder PERSONA (their real accounts: davidng/David Nguyen on
// devto/govloop/linkedin/producthunt are all account_type=personal). Only pure product
// DIRECTORY listings (where the product itself is the entry) are brand. So: marketplace = brand,
// everything else defaults personal, with an override for directories mis-categorised in the catalog.
const ROLE_BY_CATEGORY: Record<string, AccountRole> = { marketplace: 'brand' };
const ROLE_OVERRIDE: Record<string, AccountRole> = {
  crunchbase: 'brand', alternativeto: 'brand', saashub: 'brand', g2: 'brand', capterra: 'brand',
  getapp: 'brand', softwareadvice: 'brand', producthq: 'brand', slant: 'brand',
};
export function recommendedAccountRole(platformKey: string | null, category: string | null): AccountRole {
  if (platformKey && ROLE_OVERRIDE[platformKey]) return ROLE_OVERRIDE[platformKey];
  return ROLE_BY_CATEGORY[(category || '').toLowerCase()] ?? 'personal';
}
export const ACCOUNT_ROLE_META: Record<AccountRole, { badge: string; label: string; color: string; why: string }> = {
  personal: { badge: 'P', label: 'Personal', color: '#5badff', why: 'Persona thật đăng bài (forum/Q&A/blog/dev) — account brand dễ bị flag spam ở cộng đồng.' },
  brand:    { badge: 'B', label: 'Brand',    color: '#22c55e', why: 'Listing/directory/launch/social chính chủ — account đại diện brand của site.' },
  seeding:  { badge: 'S', label: 'Seeding',  color: '#ffb03c', why: 'Account cộng đồng gieo hạt hàng loạt (father / persona phụ).' },
};

export const READINESS_META: Record<ReadinessBucket, { label: string; color: string; icon: string }> = {
  ready:        { label: 'Account ready',  color: '#22c55e', icon: '✓' },
  warming:      { label: 'Warming up',     color: '#ffb03c', icon: '🔥' },
  setup:        { label: 'Setting up',     color: '#5badff', icon: '🔄' },
  missing:      { label: 'Need account',   color: '#5badff', icon: '➕' },
  locked:       { label: 'Locked',         color: '#ef4444', icon: '🔒' },
  'no-account': { label: 'No account needed', color: '#8a92a3', icon: '✉' },
};
