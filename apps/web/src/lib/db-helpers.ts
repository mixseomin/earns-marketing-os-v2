// db-helpers — shared utilities for server actions that touch the MOS2 DB.
//
// Why this file exists:
//   - Before: 221+ raw `db.execute(sql\`SELECT ... WHERE tenant_id = ${TENANT} AND
//     project_id = ${projectId}\`)` queries with hand-written row mappers in every
//     action file. Boilerplate per query: ~10-15 LOC.
//   - After: import these helpers to:
//     * Wrap query+map+throw boilerplate (dbList, dbOne)
//     * Cast bigint/timestamp/jsonb consistently (numField, dateField, ...)
//     * Standardize tenant/project WHERE clause (tenantProjectScope)
//     * Standardize revalidate calls (revalidateProject)
//
// IMPORTANT: this module is INTENDED to be imported BY server-action files
// ('use server'). It is NOT itself a 'use server' file because it exports
// constants/helpers (not async functions). Keep it that way.

import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

// ── WHERE clause fragments ────────────────────────────────────────────

/**
 * Append-friendly fragment for `tenant_id = TENANT AND project_id = ...`.
 * Pass the table alias you used in FROM (default 'b' to match convention).
 *
 * Use with sql template:
 *   sql\`SELECT ... FROM community_briefs b WHERE \${tenantProjectScope(projectId, 'b')}\`
 */
export function tenantProjectScope(projectId: string, alias = 'b'): SQL {
  // sql.raw is safe for static alias here — alias values are literals from
  // calling code, NOT user input. If you ever need a dynamic alias, validate.
  return sql.raw(`${alias}.tenant_id = '${TENANT.replace(/'/g, "''")}' AND ${alias}.project_id = '${projectId.replace(/'/g, "''")}'`);
}

/**
 * Same but for tables without project_id (only tenant scope).
 *   sql\`SELECT ... FROM platform_accounts pa WHERE \${tenantScope('pa')}\`
 */
export function tenantScope(alias = 'pa'): SQL {
  return sql.raw(`${alias}.tenant_id = '${TENANT.replace(/'/g, "''")}'`);
}

// ── Query execution wrappers ──────────────────────────────────────────

type SqlExecutor = ReturnType<typeof getDb> extends infer D
  ? D extends { execute: (q: SQL) => Promise<infer R> } ? R : never
  : never;

/**
 * Run query + return mapped array. Replaces:
 *   const rows = await db.execute(sql\`...\`);
 *   return (rows as unknown as Array<...>).map(mapFn);
 * with:
 *   return dbList(sql\`...\`, mapFn);
 */
export async function dbList<T>(
  query: SQL,
  mapFn: (r: Record<string, unknown>) => T,
): Promise<T[]> {
  const db = ensureDb();
  const rows = await db.execute(query);
  return (rows as unknown as Array<Record<string, unknown>>).map(mapFn);
}

/**
 * Run query + return first row mapped, or null.
 */
export async function dbOne<T>(
  query: SQL,
  mapFn: (r: Record<string, unknown>) => T,
): Promise<T | null> {
  const db = ensureDb();
  const rows = await db.execute(query);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  return r ? mapFn(r) : null;
}

/**
 * Run query without returning data (UPDATE/INSERT/DELETE).
 */
export async function dbExec(query: SQL): Promise<void> {
  const db = ensureDb();
  await db.execute(query);
}

// ── Field parsers (handle pg driver quirks: bigint as string, jsonb as object) ──

/**
 * Cast bigint/int/numeric to number. pg-driver returns bigint as STRING by
 * default — `Number(r.id)` is needed everywhere. See
 * `feedback_mos2_pg_bigint_string.md`.
 */
export function numField(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

/**
 * Same but nullable.
 */
export function nullNumField(v: unknown): number | null {
  if (v == null) return null;
  return Number(v);
}

/**
 * Date / timestamp → ISO string. pg-driver may return Date object OR string,
 * depending on column type config. Normalize.
 */
export function dateField(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Required date (throws if null). Use for createdAt/updatedAt columns that
 * are notNull in schema.
 */
export function reqDateField(v: unknown): string {
  if (v == null) throw new Error('reqDateField: null value');
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Text/varchar → string, with empty-string fallback.
 */
export function textField(v: unknown, fallback = ''): string {
  return String(v ?? fallback);
}

/**
 * Text/varchar → string | null (preserve null vs empty distinction).
 */
export function nullTextField(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length > 0 ? s : null;
}

/**
 * jsonb array → typed array. Returns [] if not array.
 */
export function jsonArrayField<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * jsonb object → typed object. Returns {} if not object.
 */
export function jsonObjectField<T = Record<string, unknown>>(v: unknown): T {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  return {} as T;
}

/**
 * Boolean (pg returns boolean directly, but safe-cast).
 */
export function boolField(v: unknown): boolean {
  return Boolean(v);
}

// ── Revalidate helpers ─────────────────────────────────────────────────

/**
 * Standard project-scoped revalidate. Pass the sub-paths to invalidate.
 *   revalidateProject(projectId, ['seeding', 'community']);
 * Calls revalidatePath dynamically (lazy import to avoid Next bundling
 * 'next/cache' into client by accident — db-helpers.ts is server-only).
 */
export async function revalidateProject(
  projectId: string, sections: string[],
): Promise<void> {
  const { revalidatePath } = await import('next/cache');
  for (const s of sections) {
    revalidatePath(`/p/${projectId}/${s}`);
  }
}
