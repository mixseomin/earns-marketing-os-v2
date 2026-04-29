// Postgres client + Drizzle ORM wrapper.
// Singleton: reuses connection across requests (Next.js dev HMR-safe via globalThis).

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type DB = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __mos2_db: DB | undefined;
  // eslint-disable-next-line no-var
  var __mos2_pg: ReturnType<typeof postgres> | undefined;
}

export function getDb(): DB | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalThis.__mos2_db) {
    const sql = postgres(url, { max: 4, prepare: false });
    globalThis.__mos2_pg = sql;
    globalThis.__mos2_db = drizzle(sql, { schema, casing: 'snake_case' });
  }
  return globalThis.__mos2_db;
}

export async function closeDb(): Promise<void> {
  if (globalThis.__mos2_pg) {
    await globalThis.__mos2_pg.end({ timeout: 5 });
    globalThis.__mos2_pg = undefined;
    globalThis.__mos2_db = undefined;
  }
}
