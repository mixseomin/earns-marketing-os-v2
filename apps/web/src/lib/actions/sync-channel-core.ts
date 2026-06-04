import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitatChannels } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL } from '@/lib/ai/openai';

// ── sync-channel-core — AI summarize + upsert habitat_channels, DÙNG CHUNG cho
// Discord channel (sync-channel-rules) VÀ forum sub-forum (channels/sync-rules).
// 1 sub-area = 1 habitat_channels row có rules/voice/contentTypes RIÊNG. Khi rules
// có nội dung → buildDraftPrompt tự chèn # CHANNEL OVERRIDE (ưu tiên > habitat).

/**
 * Normalize tên channel — strip prefix Discord new UI (`#`, `»`, `「emoji」`, emoji).
 * Dùng cho TIER-2 name match (channel chưa có external_id). Forum name (vd "EtcetEra
 * Forum") cũng normalize cùng hàm cho cả 2 phía → match nhất quán.
 */
export function normalizeChannelName(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  s = s.replace(/^#+\s*/, '');
  s = s.replace(/^[»›→]+\s*/, '');
  s = s.replace(/「[^」]*」/g, '');
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  s = s.trim().toLowerCase();
  const m = s.match(/[a-z0-9][-_a-z0-9]{1,}/);
  return m ? m[0] : s;
}

export interface SyncChannelInput {
  habitatId: number;
  externalId: string;            // stable key: Discord snowflake | forum slug.id (forumSubForumKey)
  url: string | null;
  name: string;                  // display name (caller đã clean phù hợp platform)
  topic?: string;                // topic (discord) / mô tả sub-forum (forum)
  rulesSamples?: string[];       // nơi rules hay nằm: pinned (discord) / sticky+notice (forum)
  recentSamples?: string[];      // hoạt động gần đây: messages (discord) / thread titles (forum)
  platformHint?: 'discord' | 'forum';
}

export interface SyncChannelResult {
  channelDbId: number;
  channelName: string;
  url: string | null;
  topic: string;
  rulesMarkdown: string;
  pinnedSummary: Record<string, unknown> | null;
  recentSummary: Record<string, unknown> | null;
  contentTypes: string[];
  language: string;
  aiError: string | null;
}

// AI summarize 1 sub-area + upsert vào habitat_channels. Caller tự verify habitat/kind.
export async function summarizeAndSaveChannelRules(input: SyncChannelInput): Promise<SyncChannelResult> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured');

  const { habitatId, externalId, url } = input;
  const isForum = input.platformHint === 'forum';
  const noun = isForum ? 'forum sub-forum (board)' : 'Discord channel';
  const rulesLabel = isForum ? 'STICKY/NOTICE/MÔ TẢ (rules sub-forum thường ở đây)' : 'PINNED MESSAGES (rules thường ở đây)';
  const recentLabel = isForum ? 'TIÊU ĐỀ THREAD GẦN ĐÂY (đoán loại nội dung + giọng)' : 'RECENT MESSAGES';

  const name = (input.name ?? '').trim() || (isForum ? `subforum-${externalId}` : `channel-${externalId.slice(-6)}`);
  const topic = (input.topic ?? '').trim();
  const rulesSamples = (input.rulesSamples ?? []).filter(Boolean).slice(0, 30);
  const recentSamples = (input.recentSamples ?? []).filter(Boolean).slice(0, 80);

  let pinnedSummary: Record<string, unknown> | null = null;
  let recentSummary: Record<string, unknown> | null = null;
  let contentTypes: string[] = [];
  let detectedLang = '';
  let aiError: string | null = null;

  const hasData = !!topic || rulesSamples.length > 0 || recentSamples.length > 0;
  if (hasData) {
    const openai = getOpenAI();
    if (!openai) throw new Error('OpenAI client init fail');
    const summaryPrompt = `Bạn là community analyst review 1 ${noun} để extract rules + loại nội dung + giọng.

${isForum ? 'Sub-forum' : 'Channel'}: ${name}
${isForum ? 'Mô tả' : 'Topic'}: ${topic || '(empty)'}

${rulesLabel} (${rulesSamples.length}):
${rulesSamples.map((p, i) => `[#${i + 1}]\n${p.slice(0, 1500)}`).join('\n---\n') || '(không có)'}

${recentLabel} (${recentSamples.length}):
${recentSamples.slice(0, 50).map((m) => m.slice(0, 300)).join('\n') || '(không có)'}

Trả JSON shape:
{
  "rules": ["rule 1 dạng imperative", ...],
  "banned": ["topic/word cấm 1", ...],
  "do": ["best practice 1", ...],
  "dont": ["anti-pattern 1", ...],
  "voiceHint": "tone style ngắn (1-2 sentences)",
  "commonTopics": ["chủ đề CỤ THỂ đang được thảo luận, paraphrase từ thread/message thật (vd 'Tranh luận phim hay nhất của Schwarzenegger', 'OT về series AppleTV')", ...],
  "contentTypes": ["loại bài phù hợp ở đây (vd: discussion, question, showcase, news, guide, meme)", ...],
  "postIdeas": ["2-4 ĐỀ XUẤT bài/góc tiếp cận CỤ THỂ mình có thể đăng vào đây — actionable, hợp rules + contentTypes + giọng, ăn theo chủ đề đang hot (vd 'Hỏi cộng đồng top 3 phim action thập niên 80', 'Chia sẻ trải nghiệm xem series mới + mời thảo luận')", ...],
  "language": "ISO 2 ký tự ngôn ngữ chính (en/vi/...). Empty nếu không rõ."
}

KHÔNG bịa rule không có trong source. commonTopics PHẢI lấy từ thread/message thật ở trên (không bịa chủ đề). postIdeas suy từ chủ đề+rules thật. Nếu không có rules rõ → rules rỗng (vẫn suy contentTypes/voiceHint/commonTopics/postIdeas từ chủ đề).`;
    try {
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Bạn là community analyst. Output JSON ngắn gọn, không bịa.' },
          { role: 'user', content: summaryPrompt },
        ],
        temperature: 0.3,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as Record<string, unknown>;
      pinnedSummary = {
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        banned: Array.isArray(parsed.banned) ? parsed.banned : [],
        do: Array.isArray(parsed.do) ? parsed.do : [],
        dont: Array.isArray(parsed.dont) ? parsed.dont : [],
        voiceHint: typeof parsed.voiceHint === 'string' ? parsed.voiceHint : '',
      };
      contentTypes = Array.isArray(parsed.contentTypes) ? (parsed.contentTypes as unknown[]).map(String).filter(Boolean).slice(0, 8) : [];
      recentSummary = {
        commonTopics: Array.isArray(parsed.commonTopics) ? (parsed.commonTopics as unknown[]).map(String).filter(Boolean).slice(0, 8) : [],
        postIdeas: Array.isArray(parsed.postIdeas) ? (parsed.postIdeas as unknown[]).map(String).filter(Boolean).slice(0, 6) : [],
        exampleStyles: Array.isArray(parsed.exampleStyles) ? parsed.exampleStyles : [],
        contentTypes,
      };
      if (typeof parsed.language === 'string') {
        const lang = parsed.language.trim().toLowerCase();
        if (/^[a-z]{2}$/.test(lang)) detectedLang = lang;
      }
    } catch (e) {
      aiError = (e as Error).message;
    }
  }

  const ps = (pinnedSummary as { rules?: string[]; banned?: string[]; do?: string[]; dont?: string[]; voiceHint?: string } | null) || {};
  const rs = (recentSummary as { commonTopics?: string[]; postIdeas?: string[] } | null) || {};
  const rulesMarkdown = [
    topic ? `**${isForum ? 'Mô tả' : 'Topic'}:** ${topic}` : '',
    Array.isArray(ps.rules) && ps.rules.length > 0 ? `**Rules:**\n${ps.rules.map((r) => `- ${r}`).join('\n')}` : '',
    contentTypes.length > 0 ? `**Loại nội dung phù hợp:** ${contentTypes.join(', ')}` : '',
    Array.isArray(rs.commonTopics) && rs.commonTopics.length > 0 ? `**Đang thảo luận (ví dụ):**\n${rs.commonTopics.map((t) => `- ${t}`).join('\n')}` : '',
    Array.isArray(rs.postIdeas) && rs.postIdeas.length > 0 ? `**Gợi ý bài để đăng:**\n${rs.postIdeas.map((t) => `- ${t}`).join('\n')}` : '',
    Array.isArray(ps.do) && ps.do.length > 0 ? `**Do:**\n${ps.do.map((d) => `- ${d}`).join('\n')}` : '',
    Array.isArray(ps.dont) && ps.dont.length > 0 ? `**Don't:**\n${ps.dont.map((d) => `- ${d}`).join('\n')}` : '',
    Array.isArray(ps.banned) && ps.banned.length > 0 ? `**Banned topics:** ${ps.banned.join(', ')}` : '',
    ps.voiceHint ? `**Voice hint:** ${ps.voiceHint}` : '',
  ].filter(Boolean).join('\n\n') || '(no summary yet)';

  // Upsert — tier 1: external_id; tier 2: normalized name (channel chưa có external_id).
  let existing = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), eq(habitatChannels.externalId, externalId)))
    .limit(1);
  if (existing.length === 0 && name) {
    const candidates = await db.select({ id: habitatChannels.id, name: habitatChannels.name })
      .from(habitatChannels)
      .where(and(
        eq(habitatChannels.habitatId, habitatId),
        sql`(${habitatChannels.externalId} IS NULL OR ${habitatChannels.externalId} = '')`,
      ));
    const key = normalizeChannelName(name);
    const match = candidates.find((c) => normalizeChannelName(c.name) === key);
    if (match) existing = [{ id: match.id }];
  }

  let channelDbId: number;
  if (existing[0]) {
    channelDbId = existing[0].id;
    const updateSet: Record<string, unknown> = {
      name, externalId, url, topic, rules: rulesMarkdown,
      pinnedSummary, recentSummary, syncedAt: new Date(), updatedAt: new Date(),
    };
    if (detectedLang) updateSet.language = detectedLang;
    await db.update(habitatChannels).set(updateSet).where(eq(habitatChannels.id, channelDbId));
  } else {
    const inserted = await db.insert(habitatChannels).values({
      habitatId, name, externalId, url, topic, rules: rulesMarkdown,
      pinnedSummary, recentSummary, syncedAt: new Date(), language: detectedLang,
    }).returning({ id: habitatChannels.id });
    channelDbId = inserted[0]!.id;
  }

  return { channelDbId, channelName: name, url, topic, rulesMarkdown, pinnedSummary, recentSummary, contentTypes, language: detectedLang, aiError };
}
