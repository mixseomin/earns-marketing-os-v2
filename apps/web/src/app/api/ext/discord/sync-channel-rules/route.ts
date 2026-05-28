import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitats, habitatChannels, platformAccounts } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { decryptValue, cryptoEnabled } from '@/lib/crypto';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

// POST /api/ext/discord/sync-channel-rules
// Body: { habitatId: number, channelId: string (Discord snowflake), accountId?: number }
//
// Flow:
//   1. Verify habitat is Discord (kind=discord-server)
//   2. Resolve bot token: dùng account_id explicit, OR auto-pick account_kind='bot'
//      same project trên Discord. Decrypt bot_token_enc.
//   3. Discord API:
//      - GET /channels/<id>            → name, topic, type, rate_limit
//      - GET /channels/<id>/pins       → array pinned messages (full content)
//      - GET /channels/<id>/messages?limit=50 → recent
//   4. AI summarize: pinned → {rules, banned, voiceHint}; recent → {tone, commonTopics, exampleStyles}
//   5. Upsert vào habitat_channels (match qua external_id=channelId, fallback name).
//      Set posting_rules text từ AI summary + topic.

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordChannel {
  id: string;
  name: string;
  topic: string | null;
  type: number;
  guild_id: string;
  rate_limit_per_user?: number;
}
interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  pinned?: boolean;
  timestamp: string;
}

async function discordFetch<T>(path: string, botToken: string): Promise<{ ok: boolean; data?: T; error?: string; status?: number }> {
  try {
    const res = await fetch(`${DISCORD_API}${path}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
        'User-Agent': 'MOS2-Sync/1.0',
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `Discord ${path} ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = await res.json() as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;
  if (!cryptoEnabled()) {
    return NextResponse.json({ ok: false, error: 'MOS2_SECRET_KEY chưa cấu hình' }, { status: 503 });
  }
  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OpenAI chưa cấu hình' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    habitatId?: number; channelId?: string; accountId?: number;
  };
  const habitatId = Number(body.habitatId ?? 0);
  const channelId = String(body.channelId ?? '').trim();
  if (!habitatId || !channelId || !/^\d{15,25}$/.test(channelId)) {
    return NextResponse.json({ ok: false, error: 'habitatId + channelId (snowflake) required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // 1. Verify habitat exists + is Discord
  const habRows = await db.select({
    id: habitats.id, name: habitats.name, kind: habitats.kind,
    projectId: habitats.projectId,
    scrapedMeta: habitats.scrapedMeta,
  }).from(habitats).where(eq(habitats.id, habitatId)).limit(1);
  const hab = habRows[0];
  if (!hab) return NextResponse.json({ ok: false, error: 'habitat not found' }, { status: 404 });
  if (hab.kind !== 'discord-server') {
    return NextResponse.json({ ok: false, error: `habitat kind=${hab.kind}, không phải discord-server` }, { status: 400 });
  }

  // 2. Resolve bot token
  let botToken: string | null = null;
  if (body.accountId) {
    const acc = await db.select({ enc: platformAccounts.botTokenEnc, kind: platformAccounts.accountKind })
      .from(platformAccounts).where(eq(platformAccounts.id, body.accountId)).limit(1);
    if (acc[0]?.enc) botToken = await decryptValue(acc[0].enc);
  } else {
    // Auto-pick: bot account same project trên Discord
    const rows = await db.select({ enc: platformAccounts.botTokenEnc, id: platformAccounts.id })
      .from(platformAccounts)
      .where(and(
        eq(platformAccounts.platformKey, 'discord'),
        eq(platformAccounts.accountKind, 'bot'),
        eq(platformAccounts.projectId, hab.projectId),
      ))
      .limit(1);
    if (rows[0]?.enc) botToken = await decryptValue(rows[0].enc);
  }
  if (!botToken) {
    return NextResponse.json({
      ok: false,
      error: 'Không tìm thấy bot token Discord trong project. Set bot_token cho 1 account_kind=bot trong project.',
    }, { status: 400 });
  }

  // 3. Fetch Discord API
  const chRes = await discordFetch<DiscordChannel>(`/channels/${channelId}`, botToken);
  if (!chRes.ok || !chRes.data) {
    return NextResponse.json({ ok: false, error: chRes.error ?? 'Discord channel fetch fail', status: chRes.status }, { status: 502 });
  }
  const ch = chRes.data;

  const pinsRes = await discordFetch<DiscordMessage[]>(`/channels/${channelId}/pins`, botToken);
  const pins = pinsRes.ok && Array.isArray(pinsRes.data) ? pinsRes.data : [];

  const recentRes = await discordFetch<DiscordMessage[]>(`/channels/${channelId}/messages?limit=50`, botToken);
  const recent = recentRes.ok && Array.isArray(recentRes.data) ? recentRes.data : [];

  // 4. AI summarize
  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ ok: false, error: 'OpenAI client init fail' }, { status: 503 });
  const pinnedText = pins.map((m, i) => `[#${i+1} ${m.author.username}]\n${m.content}`).join('\n---\n').slice(0, 8000);
  const recentText = recent
    .filter((m) => !m.author.bot)
    .slice(0, 30)
    .map((m) => `[${m.author.username}] ${m.content.slice(0, 300)}`)
    .join('\n')
    .slice(0, 8000);

  const summaryPrompt = `Bạn là analyst review Discord channel để extract rules + tone cho operator engage cộng đồng.

Channel: #${ch.name}
Topic: ${ch.topic ?? '(empty)'}
Rate limit per user: ${ch.rate_limit_per_user ?? 0}s

PINNED MESSAGES (rules thường ở đây):
${pinnedText || '(không có pinned)'}

RECENT MESSAGES (50 cái gần nhất, exclude bot):
${recentText || '(không có recent)'}

Trả JSON shape:
{
  "rules": ["rule 1 dạng imperative", "rule 2", ...],
  "banned": ["topic/word cấm 1", ...],
  "do": ["best practice 1", ...],
  "dont": ["anti-pattern 1", ...],
  "voiceHint": "tone style ngắn (1-2 sentences)",
  "commonTopics": ["topic chính 1", ...],
  "exampleStyles": ["1 ví dụ message tiêu biểu (paraphrase)", ...]
}

Nếu không có data → trả arrays rỗng. KHÔNG bịa rule không có trong source.`;

  let aiResult: {
    rules?: string[]; banned?: string[]; do?: string[]; dont?: string[];
    voiceHint?: string; commonTopics?: string[]; exampleStyles?: string[];
  } = {};
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
    aiResult = JSON.parse(text);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `AI summary fail: ${(e as Error).message}` }, { status: 502 });
  }

  const pinnedSummary = {
    rules: Array.isArray(aiResult.rules) ? aiResult.rules : [],
    banned: Array.isArray(aiResult.banned) ? aiResult.banned : [],
    do: Array.isArray(aiResult.do) ? aiResult.do : [],
    dont: Array.isArray(aiResult.dont) ? aiResult.dont : [],
    voiceHint: aiResult.voiceHint ?? '',
  };
  const recentSummary = {
    commonTopics: Array.isArray(aiResult.commonTopics) ? aiResult.commonTopics : [],
    exampleStyles: Array.isArray(aiResult.exampleStyles) ? aiResult.exampleStyles : [],
  };

  // 5. Upsert habitat_channels. Match qua (habitatId, externalId).
  const rulesMarkdown = [
    pinnedSummary.rules.length > 0 ? `**Rules:**\n${pinnedSummary.rules.map((r) => `- ${r}`).join('\n')}` : '',
    pinnedSummary.do.length > 0 ? `**Do:**\n${pinnedSummary.do.map((d) => `- ${d}`).join('\n')}` : '',
    pinnedSummary.dont.length > 0 ? `**Don't:**\n${pinnedSummary.dont.map((d) => `- ${d}`).join('\n')}` : '',
    pinnedSummary.banned.length > 0 ? `**Banned topics:** ${pinnedSummary.banned.join(', ')}` : '',
    pinnedSummary.voiceHint ? `**Voice hint:** ${pinnedSummary.voiceHint}` : '',
  ].filter(Boolean).join('\n\n');

  const existing = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), eq(habitatChannels.externalId, channelId)))
    .limit(1);

  let channelDbId: number;
  if (existing[0]) {
    channelDbId = existing[0].id;
    await db.update(habitatChannels).set({
      name: ch.name,
      topic: ch.topic ?? '',
      rules: rulesMarkdown,
      pinnedSummary,
      recentSummary,
      syncedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(habitatChannels.id, channelDbId));
  } else {
    const inserted = await db.insert(habitatChannels).values({
      habitatId,
      name: ch.name,
      externalId: channelId,
      topic: ch.topic ?? '',
      rules: rulesMarkdown,
      pinnedSummary,
      recentSummary,
      syncedAt: new Date(),
    }).returning({ id: habitatChannels.id });
    channelDbId = inserted[0]!.id;
  }

  // Defensive: ensure habitat.scraped_meta.discord_guild_id set (giữ habit của
  // detector flow — không phụ thuộc ext đã POST trước hay chưa).
  if (ch.guild_id) {
    const meta = (hab.scrapedMeta as Record<string, unknown>) || {};
    if (meta.discord_guild_id !== ch.guild_id) {
      await db.update(habitats).set({
        scrapedMeta: { ...meta, discord_guild_id: ch.guild_id },
        updatedAt: new Date(),
      }).where(eq(habitats.id, habitatId));
    }
  }

  return NextResponse.json({
    ok: true,
    channelDbId,
    channelName: ch.name,
    rulesMarkdown,
    pinnedSummary,
    recentSummary,
    pinnedCount: pins.length,
    recentCount: recent.length,
  });
}
