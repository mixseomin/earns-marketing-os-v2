'use server';

// By-id bundles for project-scoped entities so <EntityDrawerHost> can open a habitat / tribe
// in-place from any page with only an id. Each resolves the entity's project first, then loads
// exactly what its modal needs. Sibling of accountEditBundle / briefDrawerBundle.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getHabitatById, listTribes, listPlatforms } from '@/lib/data';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

async function projectOf(table: 'habitats' | 'tribes', id: number): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db.execute(
    table === 'habitats'
      ? sql`SELECT project_id FROM habitats WHERE id = ${id} AND tenant_id = ${TENANT} LIMIT 1`
      : sql`SELECT project_id FROM tribes WHERE id = ${id} AND tenant_id = ${TENANT} LIMIT 1`,
  );
  return (rows as unknown as Array<{ project_id?: string }>)[0]?.project_id ?? null;
}

export async function habitatDrawerBundle(habitatId: number) {
  const pid = await projectOf('habitats', habitatId);
  if (!pid) return null;
  const [habitat, tribes, platforms] = await Promise.all([
    getHabitatById(pid, habitatId), listTribes(pid), listPlatforms(),
  ]);
  return habitat ? { projectId: pid, habitat, tribes, platforms } : null;
}

export async function tribeDrawerBundle(tribeId: number) {
  const pid = await projectOf('tribes', tribeId);
  if (!pid) return null;
  const tribe = (await listTribes(pid)).find((t) => t.id === tribeId) ?? null;
  return tribe ? { projectId: pid, tribe } : null;
}
