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
    // Cỡ pool đọc từ DB_POOL_MAX (mặc định 4 cho mos2). etp2 chạy ~30 câu song song mỗi lượt đọc trang (docEtp): với 4 kết nối các câu xếp hàng,
    // câu ROAS chạy riêng 7 ms mà trong lượt đo ra 1,1 s (26/11/2026). Unit etp2 đặt DB_POOL_MAX riêng, mos2 giữ nguyên.
    const max = Number(process.env.DB_POOL_MAX) > 0 ? Number(process.env.DB_POOL_MAX) : 4;
    const sql = postgres(url, { max, prepare: false });
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
