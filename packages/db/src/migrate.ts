// Run pending migrations from ./migrations against DATABASE_URL.
// Invoked by: npm run db:migrate (or deploy.sh before service start).

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set — refusing to migrate.');
  process.exit(1);
}

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

console.log(`[mos2/db] Applying migrations from ${migrationsFolder} → ${url.replace(/:[^@/]+@/, ':***@')}`);
await migrate(db, { migrationsFolder });
await sql.end({ timeout: 5 });
console.log('[mos2/db] Done.');
