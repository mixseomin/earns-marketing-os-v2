import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, projects } from '@mos2/db';
import { eq, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ projects: [] });

  const rows = await db
    .select({ id: projects.id, name: projects.name, emoji: projects.emoji, capabilities: projects.capabilities })
    .from(projects)
    .where(eq(projects.isDemo, false))
    .orderBy(projects.name);

  return NextResponse.json({ projects: rows });
}
