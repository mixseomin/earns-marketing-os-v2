import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, habitats } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { aiEnabled } from '@/lib/ai/openai';
import { summarizeAndSaveChannelRules, normalizeChannelName } from '@/lib/actions/sync-channel-core';

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

  // Channel name normalize — Discord new UI có prefix `»「emoji」slug` → strip để
  // KHÔNG tạo duplicate. Khớp cleanChannelName của ext scrape.
  const rawName = (body.channelName ?? '').trim();
  const channelName = normalizeChannelName(rawName) || rawName || `channel-${channelId.slice(-6)}`;
  const topic = (body.topic ?? '').trim();
  const pinned = Array.isArray(body.pinnedMessages) ? body.pinnedMessages.filter(Boolean).slice(0, 30) : [];
  const recent = Array.isArray(body.recentMessages) ? body.recentMessages.filter(Boolean).slice(0, 80) : [];

  // AI summarize + upsert habitat_channels qua core dùng chung (Discord + forum).
  try {
    const r = await summarizeAndSaveChannelRules({
      habitatId, externalId: channelId, url: channelUrl, name: channelName, topic,
      rulesSamples: pinned, recentSamples: recent, platformHint: 'discord',
    });
    return NextResponse.json({
      ok: true,
      channelDbId: r.channelDbId,
      channelName: r.channelName,
      channelUrl: r.url,
      topic: r.topic,
      rulesMarkdown: r.rulesMarkdown,
      pinnedSummary: r.pinnedSummary,
      recentSummary: r.recentSummary,
      language: r.language,
      pinnedCount: pinned.length,
      recentCount: recent.length,
      aiError: r.aiError,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}
