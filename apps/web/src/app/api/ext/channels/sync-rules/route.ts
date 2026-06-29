import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, habitats } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { aiEnabled } from '@/lib/ai/openai';
import { summarizeAndSaveChannelRules } from '@/lib/actions/sync-channel-core';
import { platformSupportsChannels, forumSubForumKey } from '@/lib/channel-support';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/ext/channels/sync-rules — đọc 1 SUB-FORUM (forum board) → AI tóm tắt rules /
// loại nội dung / phương án → upsert habitat_channels (find-or-create theo externalId
// derive từ url). Ext scrape DOM trang sub-forum rồi POST. Tổng quát từ Discord
// sync-channel-rules (dùng chung sync-channel-core). Channel.rules có → draft tự áp.
// Body: { habitatId, url, name, description?, stickyThreads?: string[], recentThreads?: string[], notice? }
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('OpenAI chưa cấu hình', 503);
  const db = getDb(); if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const body = await req.json().catch(() => ({})) as {
    habitatId?: number; url?: string; name?: string; description?: string;
    stickyThreads?: string[]; recentThreads?: string[]; notice?: string;
  };
  const habitatId = Number(body.habitatId ?? 0);
  const url = (body.url ?? '').trim();
  if (!habitatId || !url) return errorResponse('habitatId + url required', 400);

  // Verify habitat là forum-type (có sub-area).
  const [hab] = await db.select({ id: habitats.id, kind: habitats.kind, technologyKey: habitats.technologyKey, platformKey: habitats.platformKey })
    .from(habitats).where(eq(habitats.id, habitatId)).limit(1);
  if (!hab) return errorResponse('habitat not found', 404);
  if (!platformSupportsChannels({ kind: hab.kind, technologyKey: hab.technologyKey, platformKey: hab.platformKey })) {
    return errorResponse(`habitat kind=${hab.kind} không hỗ trợ sub-forum/channel`, 400);
  }

  const externalId = forumSubForumKey(url) || url.slice(0, 120);
  const name = (body.name ?? '').trim();
  const notice = (body.notice ?? '').trim();
  const sticky = Array.isArray(body.stickyThreads) ? body.stickyThreads.filter(Boolean) : [];
  const recent = Array.isArray(body.recentThreads) ? body.recentThreads.filter(Boolean) : [];
  // rules thường ở notice + sticky thread; recent thread titles → đoán loại nội dung.
  const rulesSamples = [notice, ...sticky].filter(Boolean);

  try {
    const r = await summarizeAndSaveChannelRules({
      habitatId, externalId, url, name, topic: (body.description ?? '').trim(),
      rulesSamples, recentSamples: recent, platformHint: 'forum',
    });
    return NextResponse.json({
      ok: true,
      channelDbId: r.channelDbId,
      channelName: r.channelName,
      url: r.url,
      rulesMarkdown: r.rulesMarkdown,
      contentTypes: r.contentTypes,
      pinnedSummary: r.pinnedSummary,
      recentSummary: r.recentSummary,
      language: r.language,
      externalId,
      aiError: r.aiError,
    });
  } catch (e) {
    return errorResponse((e as Error).message, 503);
  }
}
