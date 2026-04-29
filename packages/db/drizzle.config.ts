import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL || 'postgresql://mos2:CHANGE_ME@127.0.0.1:5432/mos2_dev';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
