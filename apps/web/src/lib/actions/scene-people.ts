import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

// Read side for the WHO-THEM Scenes view (migration 0099). Sorted by
// familiarity so bridge-ready people surface first.
export type SceneChannel = { type: string; value: string; url?: string; subtype?: string };
export type SceneContacts = {
  userId?: string; profile?: string; pm?: string; email?: string; emailForm?: string;
  website?: string; location?: string; posts?: number; host?: string; engine?: string; model?: string;
  channels?: SceneChannel[];   // Orit parseSocialHref classifier: social/messaging/donation… ~80 channel_type
};
export type ScenePersonRow = {
  id: number;
  handle: string;
  platformKey: string;
  sceneTag: string | null;
  habitatId: number | null;
  habitatName: string | null;
  familiarityScore: number;
  interactionCount: number;
  theyRepliedBack: boolean;
  status: string;
  lastEngagedAt: string | null;
  contacts: SceneContacts | null;   // từ scene_identities.scraped_meta.contacts (scrape forum: userId/profile/PM/email)
};

export async function listProjectScenePeople(projectId: string): Promise<ScenePersonRow[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const res = await db.execute(sql`
      SELECT p.id, p.handle, p.platform_key, p.scene_tag, p.habitat_id,
             h.name AS habitat_name, p.familiarity_score, p.interaction_count,
             p.they_replied_back, p.status, p.last_engaged_at,
             i.scraped_meta -> 'contacts' AS contacts
      FROM people p
      LEFT JOIN habitats h ON h.id = p.habitat_id
      LEFT JOIN scene_identities i ON i.id = p.identity_id
      WHERE p.project_id = ${projectId}
      ORDER BY p.familiarity_score DESC, p.interaction_count DESC, p.updated_at DESC
      LIMIT 500`);
    const rows = res as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      handle: String(r.handle ?? ''),
      platformKey: String(r.platform_key ?? ''),
      sceneTag: r.scene_tag != null ? String(r.scene_tag) : null,
      habitatId: r.habitat_id != null ? Number(r.habitat_id) : null,
      habitatName: r.habitat_name != null ? String(r.habitat_name) : null,
      familiarityScore: Number(r.familiarity_score ?? 0),
      interactionCount: Number(r.interaction_count ?? 0),
      theyRepliedBack: r.they_replied_back === true,
      status: String(r.status ?? 'observed'),
      lastEngagedAt: r.last_engaged_at != null ? String(r.last_engaged_at) : null,
      contacts: (r.contacts && typeof r.contacts === 'object') ? (r.contacts as SceneContacts) : null,
    }));
  } catch {
    return [];
  }
}
