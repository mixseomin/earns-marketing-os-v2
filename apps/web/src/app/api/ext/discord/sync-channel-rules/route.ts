import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitats, habitatChannels } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

// POST /api/ext/discord/sync-channel-rules
// Body: {
//   habitatId: number,
//   channelId: string (snowflake),
//   channelName?: string,
//   topic?: string,
//   pinnedMessages?: string[],     // pinned content (text only)
//   recentMessages?: string[],     // recent 30-50 messages text
// }
//
// KHÔNG dùng Discord Bot API nữa (bot invite gần như không khả thi).
// Ext scrape DOM tại tab user đang mở rồi POST payload sẵn → server chỉ
// AI summarize + save habitat_channels.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;
  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OpenAI chưa cấu hình' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    habitatId?: number;
    channelId?: string;
    channelName?: string;
    topic?: string;
    pinnedMessages?: string[];
    recentMessages?: string[];
  };
  const habitatId = Number(body.habitatId ?? 0);
  const channelId = String(body.channelId ?? '').trim();
  if (!habitatId || !channelId || !/^\d{15,25}$/.test(channelId)) {
    return NextResponse.json({ ok: false, error: 'habitatId + channelId (snowflake) required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // 1. Verify habitat
  const habRows = await db.select({
    id: habitats.id, name: habitats.name, kind: habitats.kind,
    scrapedMeta: habitats.scrapedMeta,
  }).from(habitats).where(eq(habitats.id, habitatId)).limit(1);
  const hab = habRows[0];
  if (!hab) return NextResponse.json({ ok: false, error: 'habitat not found' }, { status: 404 });
  // Sau migration 0079: kind chuẩn hoá về 'discord' (1 từ).
  if (hab.kind !== 'discord') {
    return NextResponse.json({ ok: false, error: `habitat kind=${hab.kind}, không phải Discord` }, { status: 400 });
  }
  const guildId = (hab.scrapedMeta as Record<string, unknown> | null)?.discord_guild_id;
  const channelUrl = (typeof guildId === 'string' && guildId)
    ? `https://discord.com/channels/${guildId}/${channelId}`
    : null;

  const channelName = (body.channelName ?? '').trim() || `channel-${channelId.slice(-6)}`;
  const topic = (body.topic ?? '').trim();
  const pinned = Array.isArray(body.pinnedMessages) ? body.pinnedMessages.filter(Boolean).slice(0, 30) : [];
  const recent = Array.isArray(body.recentMessages) ? body.recentMessages.filter(Boolean).slice(0, 80) : [];

  // 2. AI summarize. Nếu KHÔNG có data đủ (no topic + no pinned + no recent) → save metadata only.
  const hasData = topic || pinned.length > 0 || recent.length > 0;
  let pinnedSummary: Record<string, unknown> | null = null;
  let recentSummary: Record<string, unknown> | null = null;
  let aiError: string | null = null;
  let detectedLang = '';

  if (hasData) {
    const openai = getOpenAI();
    if (!openai) return NextResponse.json({ ok: false, error: 'OpenAI client init fail' }, { status: 503 });

    const summaryPrompt = `Bạn là community analyst review Discord channel để extract rules + tone.

Channel: #${channelName}
Topic: ${topic || '(empty)'}

PINNED MESSAGES (rules thường ở đây, ${pinned.length} bài):
${pinned.map((p, i) => `[#${i+1}]\n${p.slice(0, 1500)}`).join('\n---\n') || '(không có pinned)'}

RECENT MESSAGES (${recent.length} bài gần nhất):
${recent.slice(0, 50).map((m) => m.slice(0, 300)).join('\n') || '(không có recent)'}

Trả JSON shape:
{
  "rules": ["rule 1 dạng imperative", ...],
  "banned": ["topic/word cấm 1", ...],
  "do": ["best practice 1", ...],
  "dont": ["anti-pattern 1", ...],
  "voiceHint": "tone style ngắn (1-2 sentences)",
  "commonTopics": ["topic chính 1", ...],
  "exampleStyles": ["1 ví dụ tin nhắn tiêu biểu (paraphrase)", ...],
  "language": "ISO code 2 ký tự của ngôn ngữ chính dùng trong recent messages (en/vi/hi/zh/ja/ko/es/...). Empty nếu không xác định được."
}

KHÔNG bịa rule không có trong source. Nếu pinned trống → rules rỗng.`;

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
      const text = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(text) as Record<string, unknown>;
      pinnedSummary = {
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        banned: Array.isArray(parsed.banned) ? parsed.banned : [],
        do: Array.isArray(parsed.do) ? parsed.do : [],
        dont: Array.isArray(parsed.dont) ? parsed.dont : [],
        voiceHint: typeof parsed.voiceHint === 'string' ? parsed.voiceHint : '',
      };
      recentSummary = {
        commonTopics: Array.isArray(parsed.commonTopics) ? parsed.commonTopics : [],
        exampleStyles: Array.isArray(parsed.exampleStyles) ? parsed.exampleStyles : [],
      };
      // Validate language: 2 ký tự ISO, lowercase.
      if (typeof parsed.language === 'string') {
        const lang = parsed.language.trim().toLowerCase();
        if (/^[a-z]{2}$/.test(lang)) detectedLang = lang;
      }
    } catch (e) {
      aiError = (e as Error).message;
    }
  }

  // 3. Build rules markdown
  const ps = (pinnedSummary as { rules?: string[]; banned?: string[]; do?: string[]; dont?: string[]; voiceHint?: string } | null) || {};
  const rulesMarkdown = [
    topic ? `**Topic:** ${topic}` : '',
    Array.isArray(ps.rules) && ps.rules.length > 0 ? `**Rules:**\n${ps.rules.map((r) => `- ${r}`).join('\n')}` : '',
    Array.isArray(ps.do) && ps.do.length > 0 ? `**Do:**\n${ps.do.map((d) => `- ${d}`).join('\n')}` : '',
    Array.isArray(ps.dont) && ps.dont.length > 0 ? `**Don't:**\n${ps.dont.map((d) => `- ${d}`).join('\n')}` : '',
    Array.isArray(ps.banned) && ps.banned.length > 0 ? `**Banned topics:** ${ps.banned.join(', ')}` : '',
    ps.voiceHint ? `**Voice hint:** ${ps.voiceHint}` : '',
  ].filter(Boolean).join('\n\n') || '(no summary yet)';

  // 4. Upsert habitat_channels — 2 tầng match:
  //   a. external_id = channelId (chính xác, sau khi đã sync 1 lần)
  //   b. Fallback name match (case-insensitive) — channels tạo qua
  //      ChannelBulkParser KHÔNG có external_id → tránh duplicate khi sync.
  //      Sau update, set external_id để lần sau match tier a.
  let existing = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), eq(habitatChannels.externalId, channelId)))
    .limit(1);
  if (existing.length === 0 && channelName) {
    existing = await db.select({ id: habitatChannels.id }).from(habitatChannels)
      .where(and(
        eq(habitatChannels.habitatId, habitatId),
        sql`LOWER(${habitatChannels.name}) = LOWER(${channelName})`,
        sql`(${habitatChannels.externalId} IS NULL OR ${habitatChannels.externalId} = '')`,
      ))
      .limit(1);
  }

  let channelDbId: number;
  if (existing[0]) {
    channelDbId = existing[0].id;
    const updateSet: Record<string, unknown> = {
      name: channelName,
      externalId: channelId,    // backfill nếu match qua name fallback
      url: channelUrl,           // auto-build từ guild_id + channel_id
      topic,
      rules: rulesMarkdown,
      pinnedSummary,
      recentSummary,
      syncedAt: new Date(),
      updatedAt: new Date(),
    };
    // KHÔNG overwrite language nếu user đã set manual. AI detect chỉ điền
    // khi rỗng (initial sync).
    if (detectedLang) updateSet.language = detectedLang;
    await db.update(habitatChannels).set(updateSet).where(eq(habitatChannels.id, channelDbId));
  } else {
    const inserted = await db.insert(habitatChannels).values({
      habitatId,
      name: channelName,
      externalId: channelId,
      url: channelUrl,
      topic,
      rules: rulesMarkdown,
      pinnedSummary,
      recentSummary,
      syncedAt: new Date(),
      language: detectedLang,
    }).returning({ id: habitatChannels.id });
    channelDbId = inserted[0]!.id;
  }

  return NextResponse.json({
    ok: true,
    channelDbId,
    channelName,
    channelUrl,
    topic,
    rulesMarkdown,
    pinnedSummary,
    recentSummary,
    language: detectedLang,
    pinnedCount: pinned.length,
    recentCount: recent.length,
    aiError,
  });
}
