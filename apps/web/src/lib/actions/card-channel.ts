'use server';

// Channel picker cho 1 card: list channels của habitat (cùng resolve voice
// để UI hiển thị) + setCardChannel để update card.channel_id. Khi đổi channel
// → voice resolution có thể đổi (channel.voice_profile_override khác habitat)
// → UI cần re-render pill voice + có thể prompt re-gen.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveVoiceProfile, VOICE_PROFILE_META, type VoiceProfile } from '@/lib/ai/voice-profile';

export interface CardChannelOption {
  id: number;
  name: string;
  description: string;
  allowedFormats: string[] | null;
  voiceProfileOverride: VoiceProfile | null;
  effectiveVoice: VoiceProfile;          // resolve theo channel override + habitat
  voiceLabel: string;                     // VN label cho UI
  voiceIcon: string;
  isCurrent: boolean;                     // đang là channel của card
  isSuggested: boolean;                   // AI suggest (theo phase + content_type)
  suggestReason: string;                  // 1 dòng giải thích nếu isSuggested
  hasRules: boolean;
  fewShotCount: number;
  // 'skip_for_post' marker từ posting_gates.skip_for_post = true (vd #rules channel)
  skipForPost: boolean;
}

// Suggest score: cao = phù hợp hơn. Trả top 1 reason + score.
function scoreChannel(
  ch: { name: string; description: string; allowedFormats: string[] | null; skipForPost: boolean },
  phase: string | null,
  contentType: string,
): { score: number; reason: string } {
  if (ch.skipForPost) return { score: -1000, reason: 'channel này không dùng để đăng bài (read-only / rules)' };
  let score = 0;
  let reason = '';
  const nameLc = ch.name.toLowerCase();
  const descLc = ch.description.toLowerCase();
  // Allowed formats — chặn nếu không cho content_type này
  if (Array.isArray(ch.allowedFormats) && ch.allowedFormats.length > 0
      && !ch.allowedFormats.includes(contentType)) {
    return { score: -500, reason: `không nhận loại bài '${contentType}'` };
  }
  // Phase-aware: ưu tiên channel khớp intent của phase. Phase enum của
  // mos2 là lowercase + dấu gạch: 'warm-up' | 'value' | 'bridge' | 'seed' | 'direct'.
  if (phase === 'warm-up') {
    if (/general|intro|chat|lounge|welcome/.test(nameLc)) { score += 30; reason = 'channel chính (entry) — hợp warm-up'; }
    if (/rule|announce/.test(nameLc)) return { score: -800, reason: 'announcement/rules channel — không warm-up ở đây' };
  }
  if (phase === 'value') {
    if (/help|question|q-a|qa|advice|chart|tarot|reading|astro|numerolog|vedic/.test(nameLc)) { score += 35; reason = 'Q&A/help channel — hợp phase value'; }
    if (/discuss|talk/.test(nameLc)) score += 15;
    if (contentType === 'image' && /showcase|share|gallery|art/.test(nameLc)) { score += 40; reason = 'channel showcase ảnh — hợp Value × image'; }
  }
  if (phase === 'bridge') {
    if (/build|project|work-in-progress|wip|share|portfolio/.test(nameLc)) { score += 30; reason = 'channel chia sẻ project — hợp bridge'; }
  }
  if (phase === 'seed' || phase === 'direct') {
    // Bao gồm cả 'our-ad', 'ad', 'partners' (Discord pattern phổ biến)
    if (/promo|self.?promo|launch|advertis|^our.?ad|^ad$|partner|affiliat|sponsor/.test(nameLc)) {
      score += 50; reason = 'channel cho phép promo — đúng phase seed/direct';
    }
    if (/general/.test(nameLc)) score += 10;     // có thể, nhưng yếu hơn promo
    if (/no.?promo|rule|announce/.test(nameLc)) return { score: -800, reason: 'channel cấm promo' };
  }
  // Content type ↔ channel name match
  if (contentType === 'image' && /showcase|gallery|art|photo|image/.test(nameLc + ' ' + descLc)) score += 25;
  if (contentType === 'video' && /video|clip|tiktok|youtube/.test(nameLc + ' ' + descLc)) score += 25;
  if (contentType === 'poll' && /poll|vote/.test(nameLc + ' ' + descLc)) score += 25;
  // Generic fallback: general/chat luôn dùng được
  if (/general|chat|lounge/.test(nameLc) && score === 0) { score = 5; reason = 'fallback chung'; }
  return { score, reason };
}

export async function getCardChannels(
  cardId: number,
): Promise<{ ok: true; channels: CardChannelOption[]; isDiscord: boolean } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  const cardRows = await db.execute(sql`
    SELECT c.channel_id, c.brief_phase, c.content_type,
           b.habitat_id,
           h.voice_profile AS habitat_voice,
           h.platform_key AS habitat_platform
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = b.habitat_id
     WHERE c.id = ${cardId}
     LIMIT 1
  `);
  const r = (cardRows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'card not found' };
  const habitatId = r.habitat_id ? Number(r.habitat_id) : null;
  if (habitatId == null) return { ok: true, channels: [], isDiscord: false };

  const platformKey = r.habitat_platform ? String(r.habitat_platform) : '';
  const isDiscord = ['discord', 'slack', 'telegram'].includes(platformKey);
  if (!isDiscord) return { ok: true, channels: [], isDiscord: false };

  const currentChannelId = r.channel_id ? Number(r.channel_id) : null;
  const phase = r.brief_phase ? String(r.brief_phase) : null;
  const contentType = String(r.content_type ?? 'text');
  const habitatVoice = String(r.habitat_voice ?? 'regular') as VoiceProfile;

  const chRows = await db.execute(sql`
    SELECT id, name, description, rules, allowed_formats,
           voice_profile_override, few_shot_examples, posting_gates
      FROM habitat_channels
     WHERE habitat_id = ${habitatId}
     ORDER BY sort_order ASC, id ASC
  `);

  type Row = Record<string, unknown>;
  // First pass: build base data + score
  const scored = (chRows as unknown as Row[]).map((row) => {
    const allowedFormats = Array.isArray(row.allowed_formats) ? (row.allowed_formats as string[]) : null;
    const gates = (row.posting_gates && typeof row.posting_gates === 'object'
                   && !Array.isArray(row.posting_gates))
      ? row.posting_gates as Record<string, unknown> : {};
    const skipForPost = gates.skip_for_post === true;
    const override = row.voice_profile_override ? String(row.voice_profile_override) : null;
    const effective = resolveVoiceProfile(habitatVoice, override);
    const meta = VOICE_PROFILE_META[effective];
    const { score, reason } = scoreChannel(
      { name: String(row.name ?? ''), description: String(row.description ?? ''), allowedFormats, skipForPost },
      phase, contentType,
    );
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      allowedFormats,
      voiceProfileOverride: (override && (override === 'lurker' || override === 'regular' || override === 'shitposter'
        || override === 'edgelord' || override === 'expert' || override === 'hype')) ? override as VoiceProfile : null,
      effectiveVoice: effective,
      voiceLabel: meta.label,
      voiceIcon: meta.icon,
      isCurrent: currentChannelId === Number(row.id),
      isSuggested: false,                // patched bên dưới
      suggestReason: reason,
      hasRules: !!(row.rules && String(row.rules).trim()),
      fewShotCount: Array.isArray(row.few_shot_examples) ? (row.few_shot_examples as unknown[]).length : 0,
      skipForPost,
      _score: score,
    };
  });
  // Mark TOP scored channel(s) as suggested (chỉ 1 — top 1, score > 0)
  const topPositive = scored.filter((c) => c._score > 0).sort((a, b) => b._score - a._score)[0];
  if (topPositive) topPositive.isSuggested = true;
  // Strip internal _score
  const channels: CardChannelOption[] = scored.map(({ _score, ...rest }) => { void _score; return rest; });
  return { ok: true, channels, isDiscord: true };
}

// Set card.channel_id. Trả về voice changed flag để UI có thể prompt re-gen.
export async function setCardChannel(
  projectId: string, cardId: number, channelId: number | null,
): Promise<{ ok: boolean; voiceChanged?: boolean; oldVoice?: VoiceProfile; newVoice?: VoiceProfile; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  // Compute voice BEFORE và AFTER (channel override > habitat)
  const beforeRows = await db.execute(sql`
    SELECT c.channel_id, h.voice_profile AS habitat_voice, hc.voice_profile_override AS current_override
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = b.habitat_id
      LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
     WHERE c.id = ${cardId} AND c.project_id = ${projectId}
     LIMIT 1
  `);
  const br = (beforeRows as unknown as Array<Record<string, unknown>>)[0];
  if (!br) return { ok: false, error: 'card not in project' };
  const habitatVoice = String(br.habitat_voice ?? 'regular') as VoiceProfile;
  const oldOverride = br.current_override ? String(br.current_override) : null;
  const oldVoice = resolveVoiceProfile(habitatVoice, oldOverride);

  let newOverride: string | null = null;
  if (channelId != null) {
    const newRows = await db.execute(sql`
      SELECT voice_profile_override FROM habitat_channels WHERE id = ${channelId} LIMIT 1
    `);
    const nr = (newRows as unknown as Array<{ voice_profile_override: unknown }>)[0];
    newOverride = nr?.voice_profile_override ? String(nr.voice_profile_override) : null;
  }
  const newVoice = resolveVoiceProfile(habitatVoice, newOverride);

  await db.execute(sql`
    UPDATE cards SET channel_id = ${channelId}, updated_at = now()
    WHERE id = ${cardId} AND project_id = ${projectId}
  `);
  return { ok: true, voiceChanged: oldVoice !== newVoice, oldVoice, newVoice };
}

// Phase B — suggest 1 channel mặc định khi tạo bài mới. Dùng cùng scorer
// với getCardChannels nhưng không cần card phải tồn tại trước (chỉ habitat).
export async function suggestChannelForNewPost(
  habitatId: number, phase: string | null, contentType: string,
): Promise<{ ok: true; channelId: number | null; reason: string } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  const chRows = await db.execute(sql`
    SELECT id, name, description, allowed_formats, posting_gates
      FROM habitat_channels
     WHERE habitat_id = ${habitatId}
     ORDER BY sort_order ASC, id ASC
  `);
  const channels = (chRows as unknown as Array<Record<string, unknown>>).map((row) => {
    const allowedFormats = Array.isArray(row.allowed_formats) ? (row.allowed_formats as string[]) : null;
    const gates = (row.posting_gates && typeof row.posting_gates === 'object' && !Array.isArray(row.posting_gates))
      ? row.posting_gates as Record<string, unknown> : {};
    const skipForPost = gates.skip_for_post === true;
    const s = scoreChannel({ name: String(row.name ?? ''), description: String(row.description ?? ''),
                             allowedFormats, skipForPost }, phase, contentType);
    return { id: Number(row.id), name: String(row.name ?? ''), score: s.score, reason: s.reason };
  });
  const positive = channels.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
  if (positive.length === 0) return { ok: true, channelId: null, reason: 'không channel nào phù hợp — bài sẽ ở habitat-level' };
  return { ok: true, channelId: positive[0]!.id, reason: positive[0]!.reason || `khớp phase ${phase}` };
}

// Fetch raw channels cho 1 habitat (không phụ thuộc card). Dùng ở parent
// để fetch 1 lần thay vì mỗi card row tự fetch (N requests → 1 request).
// Per-card isCurrent + isSuggested + skip tính ở client.
export interface HabitatChannelMeta {
  id: number;
  name: string;
  url: string | null;                    // deep-link channel (Discord/Slack/Telegram) — null = không có
  description: string;
  allowedFormats: string[] | null;
  voiceProfileOverride: VoiceProfile | null;
  effectiveVoice: VoiceProfile;          // resolve theo channel override + habitat
  voiceLabel: string;
  voiceIcon: string;
  hasRules: boolean;
  fewShotCount: number;
  skipForPost: boolean;
}
export interface HabitatChannelsBundle {
  habitatId: number;
  isDiscord: boolean;
  habitatVoice: VoiceProfile;
  channels: HabitatChannelMeta[];
}

export async function getHabitatChannelsBundle(
  habitatId: number,
): Promise<HabitatChannelsBundle> {
  const db = getDb();
  if (!db) return { habitatId, isDiscord: false, habitatVoice: 'regular', channels: [] };

  const habRows = await db.execute(sql`
    SELECT voice_profile, platform_key FROM habitats WHERE id = ${habitatId} LIMIT 1
  `);
  const h = (habRows as unknown as Array<Record<string, unknown>>)[0];
  if (!h) return { habitatId, isDiscord: false, habitatVoice: 'regular', channels: [] };
  const platformKey = h.platform_key ? String(h.platform_key) : '';
  const isDiscord = ['discord', 'slack', 'telegram'].includes(platformKey);
  const habitatVoice = String(h.voice_profile ?? 'regular') as VoiceProfile;
  if (!isDiscord) return { habitatId, isDiscord: false, habitatVoice, channels: [] };

  const chRows = await db.execute(sql`
    SELECT id, name, url, description, rules, allowed_formats,
           voice_profile_override, few_shot_examples, posting_gates
      FROM habitat_channels
     WHERE habitat_id = ${habitatId}
     ORDER BY sort_order ASC, id ASC
  `);
  const channels: HabitatChannelMeta[] = (chRows as unknown as Array<Record<string, unknown>>).map((row) => {
    const allowedFormats = Array.isArray(row.allowed_formats) ? (row.allowed_formats as string[]) : null;
    const gates = (row.posting_gates && typeof row.posting_gates === 'object'
                   && !Array.isArray(row.posting_gates))
      ? row.posting_gates as Record<string, unknown> : {};
    const override = row.voice_profile_override ? String(row.voice_profile_override) : null;
    const effective = resolveVoiceProfile(habitatVoice, override);
    const meta = VOICE_PROFILE_META[effective];
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      url: row.url ? String(row.url) : null,
      description: String(row.description ?? ''),
      allowedFormats,
      voiceProfileOverride: (override && ['lurker','regular','shitposter','edgelord','expert','hype'].includes(override))
        ? override as VoiceProfile : null,
      effectiveVoice: effective,
      voiceLabel: meta.label,
      voiceIcon: meta.icon,
      hasRules: !!(row.rules && String(row.rules).trim()),
      fewShotCount: Array.isArray(row.few_shot_examples) ? (row.few_shot_examples as unknown[]).length : 0,
      skipForPost: gates.skip_for_post === true,
    };
  });
  return { habitatId, isDiscord: true, habitatVoice, channels };
}

// Phase C — list posts hiện có của 1 brief với chỉ (channel_id, brief_phase)
// để vẽ matrix coverage. Trả về raw data cho ChannelCoverageGrid.
export async function listBriefPostChannels(
  briefId: number,
): Promise<Array<{ channelId: number | null; briefPhase: string | null }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT channel_id, brief_phase
      FROM cards
     WHERE brief_id = ${briefId} AND archived_at IS NULL
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    channelId: r.channel_id != null ? Number(r.channel_id) : null,
    briefPhase: r.brief_phase ? String(r.brief_phase) : null,
  }));
}

// Phase B — distribute N placeholders qua N channels khác nhau (phù hợp với
// phase). Dùng cho createPlaceholdersForBriefPhase: thay vì N bài cùng
// channel, mỗi bài 1 channel để cover nhiều surface trong server.
export async function distributeChannelsForPlaceholders(
  habitatId: number, phase: string | null, contentType: string, count: number,
): Promise<number[]> {
  const db = getDb();
  if (!db) return [];

  const chRows = await db.execute(sql`
    SELECT id, name, description, allowed_formats, posting_gates
      FROM habitat_channels
     WHERE habitat_id = ${habitatId}
     ORDER BY sort_order ASC, id ASC
  `);
  const scored = (chRows as unknown as Array<Record<string, unknown>>).map((row) => {
    const allowedFormats = Array.isArray(row.allowed_formats) ? (row.allowed_formats as string[]) : null;
    const gates = (row.posting_gates && typeof row.posting_gates === 'object' && !Array.isArray(row.posting_gates))
      ? row.posting_gates as Record<string, unknown> : {};
    const skipForPost = gates.skip_for_post === true;
    const s = scoreChannel({ name: String(row.name ?? ''), description: String(row.description ?? ''),
                             allowedFormats, skipForPost }, phase, contentType);
    return { id: Number(row.id), score: s.score };
  });
  const positive = scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
  if (positive.length === 0) return new Array(count).fill(null) as unknown as number[];

  // Distribute: round-robin theo score order
  // Vd count=5, positive=[A,B,C]: [A, B, C, A, B]
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(positive[i % positive.length]!.id);
  }
  return result;
}
