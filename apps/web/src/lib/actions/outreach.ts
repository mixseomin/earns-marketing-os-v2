// Outreach prospects reader — server-only data fetch for the /p/[id]/outreach pipeline.
// Mirrors the scene-people reader pattern (plain async module, imported by the server page).
import { getDb, outreachProspects } from '@mos2/db';
import { asc, eq } from 'drizzle-orm';

export type OutreachProspect = {
  id: number;
  agentName: string;
  company: string | null;
  base: string | null;
  email: string | null;
  contactUrl: string | null;
  website: string;
  websiteEtld1: string | null;
  status: string;
  source: string;
  sentAt: string | null;
  repliedAt: string | null;
  embeddedAt: string | null;
  embedHostMatched: string | null;
  embedItemId: string | null;
  embedLoads: number;
  nextFollowupAt: string | null;
  followupCount: number;
  snoozeUntil: string | null;
  templateKey: string | null;
  notes: string | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export async function listOutreachProspects(projectId: string): Promise<OutreachProspect[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(outreachProspects)
      .where(eq(outreachProspects.projectId, projectId))
      .orderBy(asc(outreachProspects.id));
    return rows.map((r) => ({
      id: Number(r.id),
      agentName: r.agentName,
      company: r.company,
      base: r.base,
      email: r.email,
      contactUrl: r.contactUrl,
      website: r.website,
      websiteEtld1: r.websiteEtld1,
      status: r.status,
      source: r.source,
      sentAt: iso(r.sentAt),
      repliedAt: iso(r.repliedAt),
      embeddedAt: iso(r.embeddedAt),
      embedHostMatched: r.embedHostMatched,
      embedItemId: r.embedItemId,
      embedLoads: Number(r.embedLoads),
      nextFollowupAt: iso(r.nextFollowupAt),
      followupCount: Number(r.followupCount),
      snoozeUntil: iso(r.snoozeUntil),
      templateKey: r.templateKey,
      notes: r.notes,
    }));
  } catch {
    return [];
  }
}
