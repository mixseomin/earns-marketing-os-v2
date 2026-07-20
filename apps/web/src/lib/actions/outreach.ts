// Outreach prospects reader — server-only data fetch for the /p/[id]/outreach pipeline.
// Mirrors the scene-people reader pattern (plain async module, imported by the server page).
import { getDb, outreachProspects } from '@mos2/db';
import { and, asc, eq } from 'drizzle-orm';

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
  emailSubject: string | null;
  emailBody: string | null;
  nextFollowupAt: string | null;
  followupCount: number;
  snoozeUntil: string | null;
  templateKey: string | null;
  campaignId: number | null;
  notes: string | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

type ProspectRow = typeof outreachProspects.$inferSelect;
const mapProspect = (r: ProspectRow): OutreachProspect => ({
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
  emailSubject: r.emailSubject,
  emailBody: r.emailBody,
  nextFollowupAt: iso(r.nextFollowupAt),
  followupCount: Number(r.followupCount),
  snoozeUntil: iso(r.snoozeUntil),
  templateKey: r.templateKey,
  campaignId: r.campaignId != null ? Number(r.campaignId) : null,
  notes: r.notes,
});

export async function listOutreachProspects(projectId: string): Promise<OutreachProspect[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(outreachProspects)
      .where(eq(outreachProspects.projectId, projectId))
      .orderBy(asc(outreachProspects.id));
    return rows.map(mapProspect);
  } catch {
    return [];
  }
}

// One prospect by id — for opening the Outreach drawer IN-PLACE from a linked backlink task.
export async function getOutreachProspect(projectId: string, prospectId: number): Promise<OutreachProspect | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(outreachProspects)
      .where(and(eq(outreachProspects.projectId, projectId), eq(outreachProspects.id, prospectId))).limit(1);
    return rows[0] ? mapProspect(rows[0]) : null;
  } catch {
    return null;
  }
}
