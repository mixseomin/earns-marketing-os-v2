'use server';

// Bundle 1-shot fetch cho 1 brief: channels + pillars + base voice context.
// Mục đích: thay vì mỗi PostRow fetch 3 lần (chip channel + chip pillar +
// pill voice) → N rows × 3 = 3N RSC calls khi mở brief modal → 1 call duy
// nhất ở parent. Per-card data (current pillar/channel ID, target_lang)
// đã có sẵn trong BriefPost row từ listPostsForBriefPhase.
//
// Khi card mutates (đổi pillar/channel/voice), bundle KHÔNG re-fetch — chỉ
// re-fetch khi user F5 hoặc parent bump externalReloadKey.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getHabitatChannelsBundle, type HabitatChannelsBundle } from './card-channel';
import { listProjectPillarsCompact, type PillarPickerOption } from './content-pillars';

export interface BriefRowContextBundle {
  channelsBundle: HabitatChannelsBundle;
  pillars: PillarPickerOption[];
  // Brief's primary_pillar_id để chip pillar biết "inherit" hay "override"
  briefPrimaryPillarId: number | null;
  // Habitat-level tribe lexicon/avoid + visual style counts cho voice pill
  // (per-card resolved voice profile có thể compute từ pillar.voice +
  // habitat.voice + card.channel_id → channel.voice_profile_override).
  habitatId: number;
  habitatName: string;
  habitatVoiceNotes: string;
  habitatHasVisualStyle: boolean;
  tribeLexiconCount: number;
  tribeAvoidCount: number;
}

export async function getBriefRowContextBundle(
  projectId: string, briefId: number,
): Promise<BriefRowContextBundle | null> {
  const db = getDb();
  if (!db) return null;

  const briefRows = await db.execute(sql`
    SELECT b.habitat_id, b.primary_pillar_id,
           h.name AS habitat_name,
           h.voice_notes AS habitat_voice_notes,
           h.visual_style_descriptor IS NOT NULL AS has_visual_style
      FROM community_briefs b
      LEFT JOIN habitats h ON h.id = b.habitat_id
     WHERE b.id = ${briefId} AND b.project_id = ${projectId}
     LIMIT 1
  `);
  const br = (briefRows as unknown as Array<Record<string, unknown>>)[0];
  if (!br) return null;
  const habitatId = Number(br.habitat_id);

  // Tribe lexicon/avoid count aggregated từ all habitat_tribes
  const tribeRows = await db.execute(sql`
    SELECT t.lexicon, t.avoid
      FROM habitat_tribes ht
      JOIN tribes t ON t.id = ht.tribe_id
     WHERE ht.habitat_id = ${habitatId}
  `);
  const lexSet = new Set<string>();
  const avoidSet = new Set<string>();
  for (const tr of tribeRows as unknown as Array<Record<string, unknown>>) {
    if (Array.isArray(tr.lexicon)) for (const w of tr.lexicon as string[]) lexSet.add(w.toLowerCase());
    if (Array.isArray(tr.avoid)) for (const w of tr.avoid as string[]) avoidSet.add(w.toLowerCase());
  }

  // Parallel fetch channels bundle + pillars compact list
  const [channelsBundle, pillars] = await Promise.all([
    getHabitatChannelsBundle(habitatId),
    listProjectPillarsCompact(projectId),
  ]);

  return {
    channelsBundle,
    pillars,
    briefPrimaryPillarId: br.primary_pillar_id != null ? Number(br.primary_pillar_id) : null,
    habitatId,
    habitatName: String(br.habitat_name ?? ''),
    habitatVoiceNotes: String(br.habitat_voice_notes ?? ''),
    habitatHasVisualStyle: !!br.has_visual_style,
    tribeLexiconCount: Math.min(lexSet.size, 40),
    tribeAvoidCount: Math.min(avoidSet.size, 30),
  };
}
