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
      externalId: c.externalId,
      topic: c.topic,
      rules: c.rules,
      pinnedSummary: c.pinnedSummary,
      recentSummary: c.recentSummary,
      syncedAt: c.syncedAt,
    },
  });
}
