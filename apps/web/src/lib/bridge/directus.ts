// Bridge to as.on.tc Directus REST API.
// Originally read-only (decision 2026-04-28 v5). Reverse sync added 2026-05-05
// per user request — MOS2 can now push accounts back to Directus so the
// legacy dashboard stays in sync.
//
// Used to import existing per-platform accounts (read) and push MOS2-created
// accounts back to Directus (write).

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

// ── Platforms collection (write methods) ─────────────────────────

export type DirectusPlatformWritable = {
  name?: string;
  slug?: string;
  type?: string;
  url?: string | null;
  status?: string;
  notes?: string | null;
};

// Find a Directus platform by slug. Used to dedupe before INSERT — if MOS2
// pushes a platform with key 'phpbb' and Directus already has one with
// slug='phpbb', we PATCH instead of creating a duplicate.
export async function findDirectusPlatformBySlug(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  if (!directusEnabled() || !slug) return null;
  const filter = encodeURIComponent(JSON.stringify({ slug: { _eq: slug } }));
  const url = `/items/platforms?fields=id,slug,name&filter=${filter}&limit=1`;
  try {
    const json = await getJson<{ data: Array<{ id: string; slug: string; name: string }> }>(url);
    return json.data?.[0] ?? null;
  } catch { return null; }
}

export async function createDirectusPlatform(payload: DirectusPlatformWritable): Promise<{ id: string; slug: string; name: string }> {
  const res = await sendJson<{ data: { id: string; slug: string; name: string } }>('POST', '/items/platforms', payload);
  return res.data;
}

export async function updateDirectusPlatform(id: string, patch: DirectusPlatformWritable): Promise<{ id: string; slug: string; name: string }> {
  const res = await sendJson<{ data: { id: string; slug: string; name: string } }>('PATCH', `/items/platforms/${encodeURIComponent(id)}`, patch);
  return res.data;
}

// Pull the canonical platforms catalog from Directus `platforms` collection.
// This is the SOURCE OF TRUTH (155+ rows) — much richer than the distinct
// values of `accounts.platform` (which was just free-form strings).
//
// Directus shape: { id, name, slug, type, url, status, notes, accounts_count }
export interface DirectusPlatformRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  url: string | null;
  notes: string | null;
  status: string;
  accountsCount: number;
}

export async function fetchDirectusPlatformCatalog(): Promise<DirectusPlatformRow[]> {
  if (!directusEnabled()) return [];
  const fields = ['id', 'name', 'slug', 'type', 'url', 'notes', 'status', 'accounts_count'].join(',');
  const url = `/items/platforms?fields=${fields}&limit=-1&sort=name`;
  const json = await getJson<{ data: Array<Record<string, unknown>> }>(url);
  return (json.data ?? []).map((r) => ({
    id:    String(r.id ?? ''),
    name:  String(r.name ?? ''),
    slug:  String(r.slug ?? ''),
    type:  String(r.type ?? ''),
    url:   r.url ? String(r.url) : null,
    notes: r.notes ? String(r.notes) : null,
    status: String(r.status ?? 'active'),
    accountsCount: Number(r.accounts_count ?? 0),
  })).filter((r) => r.slug && r.name);
}

// Fetch communities by ids — used to back-fill MOS2 habitats.platform_key
// from the Directus community.platform string. Batched for efficiency.
export async function fetchDirectusCommunitiesByIds(ids: string[]): Promise<Array<{ id: string; platform: string | null; platform_id: string | null }>> {
  if (!directusEnabled() || ids.length === 0) return [];
  const fields = ['id', 'platform', 'platform_id'].join(',');
  const filter = encodeURIComponent(JSON.stringify({ id: { _in: ids } }));
  const url = `/items/communities?fields=${fields}&filter=${filter}&limit=-1`;
  const json = await getJson<{ data: Array<Record<string, unknown>> }>(url);
  return (json.data ?? []).map((r) => ({
    id: String(r.id ?? ''),
    platform: r.platform ? String(r.platform) : null,
    platform_id: r.platform_id ? String(r.platform_id) : null,
  }));
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

// Reverse map: MOS2 status → Directus status string.
// Directus accepts the same labels we use, so identity for known values.
export function denormalizeStatus(s: string): string {
  return s;
}

// ── WRITE methods (MOS2 → Directus) ──────────────────────────────

async function sendJson<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  if (!directusEnabled()) throw new Error('Directus bridge disabled (DIRECTUS_URL / DIRECTUS_TOKEN unset).');
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Directus ${method} ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export type DirectusAccountWritable = Partial<Omit<DirectusAccount, 'id'>>;

export async function createDirectusAccount(payload: DirectusAccountWritable): Promise<DirectusAccount> {
  const res = await sendJson<{ data: DirectusAccount }>('POST', '/items/accounts', payload);
  return res.data;
}

export async function updateDirectusAccount(id: string, patch: DirectusAccountWritable): Promise<DirectusAccount> {
  const res = await sendJson<{ data: DirectusAccount }>('PATCH', `/items/accounts/${encodeURIComponent(id)}`, patch);
  return res.data;
}
