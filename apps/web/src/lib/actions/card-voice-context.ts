'use server';

// Resolve voice context cho 1 card (post) — đúng theo logic mà AI gen sẽ
// dùng (loadPostContext trong post-draft.ts). Trả về effective profile +
// nguồn (habitat/channel) + counts của few-shot/tribe lexicon/visual style
// để UI pill hiển thị cho user biết AI sinh bài với context gì.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveVoiceProfile, type VoiceProfile, type FewShotExample } from '@/lib/ai/voice-profile';

export interface CardVoiceContext {
  effectiveProfile: VoiceProfile;
  source: 'channel' | 'pillar' | 'habitat' | 'default';   // nguồn voice nào thắng
  habitatProfile: VoiceProfile;
  channelOverride: VoiceProfile | null;
  pillarVoice: VoiceProfile | null;          // voice của pillar (nếu có)
  habitatVoiceNotes: string;
  pillarVoiceNotes: string;
  habitatId: number | null;
  habitatName: string;
  channelId: number | null;
  channelName: string | null;
  // Pillar info (effective pillar = card.pillar_id OR brief.primary_pillar_id)
  pillarId: number | null;
  pillarName: string | null;
  pillarTagline: string;
  pillarLanguages: string[];
  pillarKeyMsgCount: number;
  pillarForbiddenCount: number;
  // Language mismatch flag
  targetLang: string;
  languageMismatch: boolean;     // target_lang ∉ pillar.languages
  // Counts để hiển thị "3 ví dụ · 42 từ tribe · có phong cách"
  fewShotCount: number;       // examples ACTUALLY sẽ dùng (channel > habitat > pillar exemplars)
  fewShotSource: 'channel' | 'habitat' | 'pillar' | 'none';
  tribeLexiconCount: number;
  tribeAvoidCount: number;
  hasVisualStyle: boolean;
  hasChannelRules: boolean;   // channel.rules có text?
}

export async function getCardVoiceContext(
  cardId: number,
): Promise<{ ok: true; ctx: CardVoiceContext } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  const rows = await db.execute(sql`
    SELECT
      c.channel_id, c.target_lang,
      h.id AS habitat_id,
      h.name AS habitat_name,
      h.voice_profile, h.voice_notes, h.few_shot_examples, h.visual_style_descriptor,
      hc.name AS channel_name,
      hc.voice_profile_override,
      hc.few_shot_examples AS channel_few_shot,
      hc.rules AS channel_rules,
      -- Pillar resolved: card.pillar_id override OR brief.primary_pillar_id
      cp.id AS pillar_id, cp.name AS pillar_name, cp.tagline AS pillar_tagline,
      cp.voice_profile AS pillar_voice_profile, cp.voice_notes AS pillar_voice_notes,
      cp.languages AS pillar_languages, cp.key_messages AS pillar_key_messages,
      cp.forbidden_msgs AS pillar_forbidden_msgs,
      cp.exemplars AS pillar_exemplars
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
    LEFT JOIN content_pillars cp ON cp.id = COALESCE(c.pillar_id, b.primary_pillar_id)
    WHERE c.id = ${cardId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'card not found' };

  const habitatProfile = (r.voice_profile ? String(r.voice_profile) : 'regular') as VoiceProfile;
  const channelOverrideStr = r.voice_profile_override ? String(r.voice_profile_override) : null;
  const channelOverride = channelOverrideStr as VoiceProfile | null;
  const pillarVoiceStr = r.pillar_voice_profile ? String(r.pillar_voice_profile) : null;
  const pillarVoice = pillarVoiceStr as VoiceProfile | null;
  // Resolution: channel override > pillar > habitat > 'regular'.
  const effectiveProfile = resolveVoiceProfile(
    pillarVoiceStr || habitatProfile,
    channelOverrideStr,
  );
  const source: CardVoiceContext['source'] = channelOverrideStr
    ? 'channel'
    : (pillarVoiceStr ? 'pillar'
      : (r.voice_profile ? 'habitat' : 'default'));

  // Few-shot resolution: channel > habitat > pillar exemplars
  const channelFs = Array.isArray(r.channel_few_shot) ? (r.channel_few_shot as FewShotExample[]) : null;
  const habitatFs = Array.isArray(r.few_shot_examples) ? (r.few_shot_examples as FewShotExample[]) : null;
  const pillarEx = Array.isArray(r.pillar_exemplars)
    ? (r.pillar_exemplars as Array<{ title?: string; whyItWorks?: string }>) : null;
  const pillarExCount = pillarEx ? pillarEx.filter((e) => e.title || e.whyItWorks).length : 0;
  const fewShotCount = (channelFs && channelFs.length > 0) ? channelFs.length
    : (habitatFs && habitatFs.length > 0) ? habitatFs.length
    : pillarExCount;
  const fewShotSource: CardVoiceContext['fewShotSource'] =
    (channelFs && channelFs.length > 0) ? 'channel'
    : (habitatFs && habitatFs.length > 0) ? 'habitat'
    : (pillarExCount > 0 ? 'pillar' : 'none');

  // Tribe lexicon/avoid count — aggregate từ tất cả tribes của habitat
  let tribeLexiconCount = 0;
  let tribeAvoidCount = 0;
  const habitatId = r.habitat_id ? Number(r.habitat_id) : null;
  if (habitatId != null) {
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
    tribeLexiconCount = Math.min(lexSet.size, 40);   // matches prompt cap
    tribeAvoidCount = Math.min(avoidSet.size, 30);
  }

  const targetLang = String(r.target_lang ?? 'en');
  const pillarLanguages = Array.isArray(r.pillar_languages) ? (r.pillar_languages as string[]) : [];
  const languageMismatch = !!(r.pillar_id && pillarLanguages.length > 0 && !pillarLanguages.includes(targetLang));

  return {
    ok: true,
    ctx: {
      effectiveProfile,
      source,
      habitatProfile,
      channelOverride,
      pillarVoice,
      habitatVoiceNotes: String(r.voice_notes ?? ''),
      pillarVoiceNotes: String(r.pillar_voice_notes ?? ''),
      habitatId,
      habitatName: String(r.habitat_name ?? ''),
      channelId: r.channel_id ? Number(r.channel_id) : null,
      channelName: r.channel_name ? String(r.channel_name) : null,
      pillarId: r.pillar_id ? Number(r.pillar_id) : null,
      pillarName: r.pillar_name ? String(r.pillar_name) : null,
      pillarTagline: String(r.pillar_tagline ?? ''),
      pillarLanguages,
      pillarKeyMsgCount: Array.isArray(r.pillar_key_messages) ? (r.pillar_key_messages as unknown[]).length : 0,
      pillarForbiddenCount: Array.isArray(r.pillar_forbidden_msgs) ? (r.pillar_forbidden_msgs as unknown[]).length : 0,
      targetLang,
      languageMismatch,
      fewShotCount,
      fewShotSource,
      tribeLexiconCount,
      tribeAvoidCount,
      hasVisualStyle: !!r.visual_style_descriptor,
      hasChannelRules: !!(r.channel_rules && String(r.channel_rules).trim()),
    },
  };
}
