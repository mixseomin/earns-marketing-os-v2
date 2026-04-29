// CLI helper for the AI workflow: after shipping a fix that addresses a
// use case's feedback, run this to set fixed_in + fixed_at on the case so
// the user sees a "🔄 re-test" signal in /tests.
//
// Usage:
//   npx tsx packages/db/src/mark-fixed.ts <slug> <commit-sha> ["fix note"]
//
// Examples (run via SSH after deploy):
//   npx tsx packages/db/src/mark-fixed.ts 5.1-tests-page-list 1b84f5c "per-group collapse"
//   npx tsx packages/db/src/mark-fixed.ts 5.1-tests-page-list 1b84f5c
//
// Doesn't touch status — user re-tests and marks pass themselves.

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { useCases } from './schema';

const [, , slug, sha, ...noteParts] = process.argv;
const note = noteParts.join(' ').trim();

if (!slug || !sha) {
  console.error('Usage: tsx mark-fixed.ts <slug> <commit-sha> ["fix note"]');
  process.exit(1);
}

const db = getDb();
if (!db) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

const tenant = process.env.DEFAULT_TENANT_ID || 'self';

const rows = await db
  .select({ slug: useCases.slug, status: useCases.status, title: useCases.title })
  .from(useCases)
  .where(eq(useCases.slug, slug))
  .limit(1);

if (rows.length === 0) {
  console.error(`Use case "${slug}" not found.`);
  process.exit(1);
}

await db
  .update(useCases)
  .set({
    fixedIn: sha,
    fixedAt: new Date(),
    fixNote: note || null,
    updatedAt: new Date(),
  })
  .where(eq(useCases.slug, slug));

console.log(`✓ Marked "${rows[0]!.title}" (${slug}) fixed in ${sha}${note ? ` — ${note}` : ''}`);
console.log(`  Status untouched (${rows[0]!.status}). User re-tests and marks pass.`);
process.exit(0);
