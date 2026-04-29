// READ-ONLY bridge to as.on.tc Directus REST API.
// Per decision 2026-04-28 v5: MOS2 NEVER writes to as.on.tc; only fetches.
//
// Used to import existing per-platform accounts that were already created
// on the legacy as.on.tc setup, into MOS2 platform_accounts table.

const URL_ = process.env.DIRECTUS_URL || 'https://as.on.tc';
const TOKEN = process.env.DIRECTUS_TOKEN || '';

export const directusEnabled = (): boolean => Boolean(URL_ && TOKEN);

interface DirectusResponse<T> {
  data: T;
  meta?: { total_count?: number; filter_count?: number };
}

async function getJson<T>(path: string): Promise<T> {
  if (!directusEnabled()) throw new Error('Directus bridge disabled (DIRECTUS_URL / DIRECTUS_TOKEN unset).');
  const res = await fetch(`${URL_}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Directus ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface DirectusAccount {
  id: string;
  platform: string | null;
  handle: string | null;
  email: string | null;
  status: string | null;
  auth_method: string | null;
  has_2fa: boolean | null;
  monthly_cost: number | null;
  collect_stats: boolean | null;
  tags: string[] | null;
  notes: string | null;
  recovery_info?: string | null;
  warmup_checklist?: Record<string, unknown> | null;
  purpose?: string | null;
  value_tier?: string | null;
}

const ACCOUNT_FIELDS = [
  'id', 'platform', 'handle', 'email', 'status', 'auth_method',
  'has_2fa', 'monthly_cost', 'collect_stats', 'tags', 'notes',
  'recovery_info', 'warmup_checklist', 'purpose', 'value_tier',
].join(',');

// Fetch accounts matching platform key (case-insensitive). Limited to 50.
export async function fetchDirectusAccountsByPlatform(platformKey: string): Promise<DirectusAccount[]> {
  if (!directusEnabled()) return [];
  const url = `/items/accounts?filter%5Bplatform%5D%5B_icontains%5D=${encodeURIComponent(platformKey)}&fields=${ACCOUNT_FIELDS}&limit=50&sort=handle`;
  const json = await getJson<DirectusResponse<DirectusAccount[]>>(url);
  return json.data || [];
}

// Fetch single account by Directus uuid.
export async function fetchDirectusAccount(id: string): Promise<DirectusAccount | null> {
  if (!directusEnabled()) return null;
  const url = `/items/accounts/${encodeURIComponent(id)}?fields=${ACCOUNT_FIELDS}`;
  try {
    const json = await getJson<{ data: DirectusAccount }>(url);
    return json.data || null;
  } catch (e) {
    console.warn('[mos2/bridge/directus] fetch failed:', (e as Error).message);
    return null;
  }
}

// Map Directus status strings to MOS2's account status state machine.
// Directus statuses include free-form values like 'not_created', 'creating', 'warming', 'active',
// 'limited', 'banned', 'unknown', etc. Normalize.
const STATUS_MAP: Record<string, string> = {
  not_created: 'todo',
  todo:        'todo',
  creating:    'creating',
  warming:     'warming',
  active:      'active',
  limited:     'limited',
  blocked:     'blocked',
  banned:      'banned',
};

export function normalizeStatus(s: string | null | undefined): string {
  if (!s) return 'todo';
  return STATUS_MAP[s.toLowerCase()] ?? 'todo';
}
