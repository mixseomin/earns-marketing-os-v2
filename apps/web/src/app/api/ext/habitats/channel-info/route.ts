import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb, habitatChannels } from '@mos2/db';
import { checkAuth } from '../../_auth';

// GET /api/ext/habitats/channel-info?habitatId=18&channelId=1069825483178520607
// Trả channel info đã sync (nếu có) để sidepanel hiển thị rules + topic.

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const sp = new URL(req.url).searchParams;
  const habitatId = Number(sp.get('habitatId') ?? 0);
  const channelId = String(sp.get('channelId') ?? '').trim();
  if (!habitatId || !channelId) {
    return NextResponse.json({ channel: null });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const rows = await db.select().from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), eq(habitatChannels.externalId, channelId)))
    .limit(1);
  const c = rows[0];
  if (!c) return NextResponse.json({ channel: null });

  return NextResponse.json({
    channel: {
      id: c.id,
      name: c.name,
      url: c.url,
      externalId: c.externalId,
      topic: c.topic,
      rules: c.rules,
      language: c.language,
      noPosting: c.noPosting,
      pinnedSummary: c.pinnedSummary,
      recentSummary: c.recentSummary,
      syncedAt: c.syncedAt,
    },
  });
}

// PATCH /api/ext/habitats/channel-info
// Body: { habitatId, channelId (externalId), noPosting?: boolean }
// User toggle no-posting trên ext sidepanel cho channel cụ thể.
export async function PATCH(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const body = await req.json() as {
    habitatId?: number;
    channelId?: string;
    noPosting?: boolean;
  };
  if (!body.habitatId || !body.channelId) {
    return NextResponse.json({ error: 'habitatId + channelId required' }, { status: 400 });
  }
  if (typeof body.noPosting !== 'boolean') {
    return NextResponse.json({ error: 'noPosting must be boolean' }, { status: 400 });
  }

  const updated = await db.update(habitatChannels)
    .set({ noPosting: body.noPosting, updatedAt: new Date() })
    .where(and(
      eq(habitatChannels.habitatId, body.habitatId),
      eq(habitatChannels.externalId, body.channelId),
    ))
    .returning({ id: habitatChannels.id, noPosting: habitatChannels.noPosting });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'channel not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, channel: updated[0] });
}
