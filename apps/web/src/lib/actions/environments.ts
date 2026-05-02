'use server';

// Server actions cho Proxies + Browser Profiles + Account environment.
// UI: /p/[id]/resources?vault=proxies / ?vault=profiles
// Used by: accounts-vault.tsx (linking) + new ProxiesVault / ProfilesVault.

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, asc, desc, sql } from 'drizzle-orm';
import { getDb, proxies, browserProfiles, platformAccounts } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

// ── Proxies ───────────────────────────────────────────────────────
export type ProxyType = 'mobile' | 'residential' | 'datacenter' | 'isp';
export type ProxyHealth = 'ok' | 'degraded' | 'down' | 'unknown';

export interface ProxyRow {
  id: number;
  label: string;
  type: ProxyType;
  endpoint: string;
  location: string | null;
  health: ProxyHealth;
  lastCheckAt: string | null;
  costPerGbCents: number;
  rotatesAt: string | null;
  notes: string | null;
  accountsCount: number;       // count platform_accounts referencing this proxy
}

export async function listProxies(): Promise<ProxyRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT p.id, p.label, p.type, p.endpoint, p.location, p.health,
           p.last_check_at, p.cost_per_gb_cents, p.rotates_at, p.notes,
           (SELECT COUNT(*)::int FROM platform_accounts WHERE proxy_id = p.id) AS accounts_count
    FROM proxies p
    WHERE p.tenant_id = ${TENANT} AND p.archived_at IS NULL
    ORDER BY p.health DESC, p.label ASC
  `);
  const toIso = (v: unknown) => v instanceof Date ? v.toISOString() : (typeof v === 'string' ? new Date(v).toISOString() : null);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    label: String(r.label),
    type: String(r.type) as ProxyType,
    endpoint: String(r.endpoint),
    location: (r.location as string | null) ?? null,
    health: String(r.health) as ProxyHealth,
    lastCheckAt: toIso(r.last_check_at),
    costPerGbCents: Number(r.cost_per_gb_cents) || 0,
    rotatesAt: toIso(r.rotates_at),
    notes: (r.notes as string | null) ?? null,
    accountsCount: Number(r.accounts_count) || 0,
  }));
}

export interface ProxyInput {
  label: string;
  type: ProxyType;
  endpoint: string;
  location?: string | null;
  health?: ProxyHealth;
  costPerGbCents?: number;
  notes?: string | null;
}

export async function createProxy(input: ProxyInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!input.label.trim() || !input.endpoint.trim()) return { ok: false, error: 'label + endpoint không được rỗng' };
  const db = ensureDb();
  const rows = await db.insert(proxies).values({
    tenantId: TENANT, label: input.label.trim(), type: input.type,
    endpoint: input.endpoint.trim(), location: input.location ?? null,
    health: input.health ?? 'unknown',
    costPerGbCents: input.costPerGbCents ?? 0,
    notes: input.notes ?? null,
  }).returning({ id: proxies.id });
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true, id: Number(rows[0]?.id) };
}

export async function updateProxy(id: number, patch: Partial<ProxyInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof proxies.$inferInsert> = { updatedAt: new Date() };
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.type !== undefined) set.type = patch.type;
  if (patch.endpoint !== undefined) set.endpoint = patch.endpoint;
  if (patch.location !== undefined) set.location = patch.location;
  if (patch.health !== undefined) set.health = patch.health;
  if (patch.costPerGbCents !== undefined) set.costPerGbCents = patch.costPerGbCents;
  if (patch.notes !== undefined) set.notes = patch.notes;
  await db.update(proxies).set(set).where(eq(proxies.id, id));
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
}

export async function archiveProxy(id: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(proxies).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(proxies.id, id));
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
}

// ── Browser profiles ──────────────────────────────────────────────
export type ProfileTool = 'genlogin' | 'multilogin' | 'adspower' | 'kameleo' | 'chrome' | 'firefox' | 'other';

export interface BrowserProfileRow {
  id: number;
  label: string;
  tool: ProfileTool;
  externalId: string | null;
  userAgent: string | null;
  fingerprint: Record<string, unknown>;
  defaultProxyId: number | null;
  defaultProxyLabel: string | null;
  lastOpenedAt: string | null;
  notes: string | null;
  accountsCount: number;
}

export async function listBrowserProfiles(): Promise<BrowserProfileRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT bp.id, bp.label, bp.tool, bp.external_id, bp.user_agent, bp.fingerprint,
           bp.default_proxy_id, p.label AS proxy_label,
           bp.last_opened_at, bp.notes,
           (SELECT COUNT(*)::int FROM platform_accounts WHERE browser_profile_id = bp.id) AS accounts_count
    FROM browser_profiles bp
    LEFT JOIN proxies p ON p.id = bp.default_proxy_id
    WHERE bp.tenant_id = ${TENANT} AND bp.archived_at IS NULL
    ORDER BY bp.tool ASC, bp.label ASC
  `);
  const toIso = (v: unknown) => v instanceof Date ? v.toISOString() : (typeof v === 'string' ? new Date(v).toISOString() : null);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    label: String(r.label),
    tool: String(r.tool) as ProfileTool,
    externalId: (r.external_id as string | null) ?? null,
    userAgent: (r.user_agent as string | null) ?? null,
    fingerprint: (r.fingerprint as Record<string, unknown>) ?? {},
    defaultProxyId: r.default_proxy_id ? Number(r.default_proxy_id) : null,
    defaultProxyLabel: (r.proxy_label as string | null) ?? null,
    lastOpenedAt: toIso(r.last_opened_at),
    notes: (r.notes as string | null) ?? null,
    accountsCount: Number(r.accounts_count) || 0,
  }));
}

export interface BrowserProfileInput {
  label: string;
  tool: ProfileTool;
  externalId?: string | null;
  userAgent?: string | null;
  fingerprint?: Record<string, unknown>;
  defaultProxyId?: number | null;
  notes?: string | null;
}

export async function createBrowserProfile(input: BrowserProfileInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!input.label.trim() || !input.tool) return { ok: false, error: 'label + tool bắt buộc' };
  const db = ensureDb();
  const rows = await db.insert(browserProfiles).values({
    tenantId: TENANT, label: input.label.trim(), tool: input.tool,
    externalId: input.externalId ?? null,
    userAgent: input.userAgent ?? null,
    fingerprint: input.fingerprint ?? {},
    defaultProxyId: input.defaultProxyId ?? null,
    notes: input.notes ?? null,
  }).returning({ id: browserProfiles.id });
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true, id: Number(rows[0]?.id) };
}

export async function updateBrowserProfile(id: number, patch: Partial<BrowserProfileInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof browserProfiles.$inferInsert> = { updatedAt: new Date() };
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.tool !== undefined) set.tool = patch.tool;
  if (patch.externalId !== undefined) set.externalId = patch.externalId;
  if (patch.userAgent !== undefined) set.userAgent = patch.userAgent;
  if (patch.fingerprint !== undefined) set.fingerprint = patch.fingerprint;
  if (patch.defaultProxyId !== undefined) set.defaultProxyId = patch.defaultProxyId;
  if (patch.notes !== undefined) set.notes = patch.notes;
  await db.update(browserProfiles).set(set).where(eq(browserProfiles.id, id));
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
}

export async function archiveBrowserProfile(id: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(browserProfiles).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(browserProfiles.id, id));
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
}

// ── Test proxy: actually open a connection through it, return IP + latency ──
export interface ProxyTestResult {
  ok: boolean;
  ip?: string;
  country?: string | null;
  city?: string | null;
  asn?: string | null;
  latencyMs?: number;
  proxyType?: 'http' | 'https' | 'socks';
  error?: string;
}

export async function testProxyEndpoint(endpoint: string): Promise<ProxyTestResult> {
  if (!endpoint.trim()) return { ok: false, error: 'Endpoint empty' };
  let proxyUrl = endpoint.trim();
  // Auto-prepend http:// if no protocol
  if (!/^[a-z]+:\/\//i.test(proxyUrl)) proxyUrl = `http://${proxyUrl}`;

  let parsed: URL;
  try { parsed = new URL(proxyUrl); }
  catch { return { ok: false, error: 'Invalid endpoint URL format' }; }

  if (parsed.protocol === 'socks:' || parsed.protocol === 'socks4:' || parsed.protocol === 'socks5:') {
    return { ok: false, error: 'SOCKS proxy testing not supported yet. Use HTTP/HTTPS proxy or test manually.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `Unsupported protocol: ${parsed.protocol}` };
  }

  // Dynamic import undici to avoid bundling issues
  const { ProxyAgent, fetch: undiciFetch } = await import('undici');

  const t0 = Date.now();
  try {
    const dispatcher = new ProxyAgent({ uri: proxyUrl });
    // ipinfo.io returns rich JSON: { ip, city, region, country, org }
    const res = await undiciFetch('https://ipinfo.io/json', {
      dispatcher,
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-ProxyTest/1.0)' },
    });
    const latency = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, error: `IP-check ${res.status}`, latencyMs: latency };
    }
    const data = await res.json() as { ip?: string; country?: string; city?: string; org?: string };
    return {
      ok: true,
      ip: data.ip,
      country: data.country ?? null,
      city: data.city ?? null,
      asn: data.org ?? null,
      latencyMs: latency,
      proxyType: parsed.protocol === 'https:' ? 'https' : 'http',
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message, latencyMs: Date.now() - t0 };
  }
}

// Test proxy + persist health/last_check_at on success
export async function testAndSaveProxy(proxyId: number): Promise<ProxyTestResult> {
  const db = ensureDb();
  const rows = await db.execute(sql`SELECT endpoint FROM proxies WHERE id = ${proxyId} LIMIT 1`);
  const r = (rows as unknown as Array<{ endpoint: string }>)[0];
  if (!r) return { ok: false, error: 'Proxy not found' };
  const result = await testProxyEndpoint(r.endpoint);
  await db.execute(sql`
    UPDATE proxies SET
      health = ${result.ok ? 'ok' : 'down'},
      last_check_at = NOW(),
      updated_at = NOW()
    WHERE id = ${proxyId}
  `);
  revalidatePath('/environments');
  return result;
}

// ── Account environment update (link proxy + browser_profile + ad-hoc env JSONB) ──
export async function updateAccountEnvironment(
  accountId: number,
  patch: { proxyId?: number | null; browserProfileId?: number | null; environment?: Record<string, unknown> }
): Promise<{ ok: boolean }> {
  const db = ensureDb();
  const set: Partial<typeof platformAccounts.$inferInsert> = { updatedAt: new Date() };
  if (patch.proxyId !== undefined) set.proxyId = patch.proxyId;
  if (patch.browserProfileId !== undefined) set.browserProfileId = patch.browserProfileId;
  if (patch.environment !== undefined) set.environment = patch.environment;
  await db.update(platformAccounts).set(set).where(eq(platformAccounts.id, accountId));
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
}
