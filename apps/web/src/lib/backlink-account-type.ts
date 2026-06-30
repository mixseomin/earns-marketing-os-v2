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

export const READINESS_META: Record<ReadinessBucket, { label: string; color: string; icon: string }> = {
  ready:        { label: 'Account ready',  color: '#22c55e', icon: '✓' },
  warming:      { label: 'Warming up',     color: '#ffb03c', icon: '🔥' },
  setup:        { label: 'Setting up',     color: '#5badff', icon: '🔄' },
  missing:      { label: 'Need account',   color: '#5badff', icon: '➕' },
  locked:       { label: 'Locked',         color: '#ef4444', icon: '🔒' },
  'no-account': { label: 'No account needed', color: '#8a92a3', icon: '✉' },
};
