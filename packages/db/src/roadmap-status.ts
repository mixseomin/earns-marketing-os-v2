// CLI for AI workflow: update roadmap item status from terminal/SSH.
//
// Usage:
//   npx tsx packages/db/src/roadmap-status.ts <slug> <status> ["note"]
//   npx tsx packages/db/src/roadmap-status.ts <slug> done <sha> ["note"]
//
// status: backlog | planned | in-progress | review | done | blocked | dropped
//
// Examples:
//   npx tsx ... phase-7-polling-alerts-feed in-progress
//   npx tsx ... phase-6-roadmap-page done 21ffe70 "shipped /roadmap MVP"

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { roadmapItems } from './schema';

const VALID = ['backlog', 'planned', 'in-progress', 'review', 'done', 'blocked', 'dropped'];

const args = process.argv.slice(2);
const slug = args[0];
const status = args[1];

if (!slug || !status) {
  console.error('Usage: tsx roadmap-status.ts <slug> <status> [<sha-if-done>] ["note"]');
  console.error(`Status options: ${VALID.join(', ')}`);
  process.exit(1);
}
if (!VALID.includes(status)) {
  console.error(`Invalid status "${status}". Valid: ${VALID.join(', ')}`);
  process.exit(1);
}

let sha: string | null = null;
let note: string;
if (status === 'done' && args[2] && /^[a-f0-9]{6,40}$/.test(args[2])) {
  sha = args[2]!;
  note = args.slice(3).join(' ').trim();
} else {
  note = args.slice(2).join(' ').trim();
}

const db = getDb();
if (!db) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

const rows = await db
  .select({ slug: roadmapItems.slug, title: roadmapItems.title, status: roadmapItems.status, startedAt: roadmapItems.startedAt })
  .from(roadmapItems)
  .where(eq(roadmapItems.slug, slug))
  .limit(1);
if (rows.length === 0) {
  console.error(`Roadmap item "${slug}" not found.`);
  process.exit(1);
}
const cur = rows[0]!;

const set: Partial<typeof roadmapItems.$inferInsert> = {
  status: status as typeof cur.status,
  statusNote: note || null,
  updatedAt: new Date(),
};
if (status === 'in-progress' && !cur.startedAt) set.startedAt = new Date();
if (status === 'done') set.doneAt = new Date();
else if (cur.status === 'done') set.doneAt = null;
if (sha) set.shippedIn = sha;

await db.update(roadmapItems).set(set).where(eq(roadmapItems.slug, slug));

console.log(`✓ ${cur.title} (${slug})`);
console.log(`  ${cur.status} → ${status}${sha ? ` · #${sha}` : ''}${note ? ` · ${note}` : ''}`);
process.exit(0);
