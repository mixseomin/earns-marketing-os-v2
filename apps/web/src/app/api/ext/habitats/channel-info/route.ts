import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitatChannels, habitats } from '@mos2/db';
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
// Body: { habitatId, channelId (externalId), noPosting?, channelName?, channelUrl? }
//
// Upsert pattern: nếu channel chưa có DB → auto-create (cần channelName từ ext
// scrape, fallback "#<channelId-suffix>"). User KHÔNG cần sync rules trước
// để toggle no_posting.
export async function PATCH(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const body = await req.json() as {
    habitatId?: number;
    channelId?: string;
    noPosting?: boolean;
    channelName?: string;
    channelUrl?: string;
  };
  if (!body.habitatId || !body.channelId) {
    return NextResponse.json({ error: 'habitatId + channelId required' }, { status: 400 });
  }
  if (typeof body.noPosting !== 'boolean') {
    return NextResponse.json({ error: 'noPosting must be boolean' }, { status: 400 });
  }

  // Check tồn tại
  const existing = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(
      eq(habitatChannels.habitatId, body.habitatId),
      eq(habitatChannels.externalId, body.channelId),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    const updated = await db.update(habitatChannels)
      .set({ noPosting: body.noPosting, updatedAt: new Date() })
      .where(eq(habitatChannels.id, existing[0]!.id))
      .returning({ id: habitatChannels.id, noPosting: habitatChannels.noPosting });
    return NextResponse.json({ ok: true, channel: updated[0], created: false });
  }

  // Auto-create channel record (chưa sync rules nhưng user muốn block ngay).
  // Name fallback: '#<last8 of channelId>' khi ext không gửi tên.
  const fallbackName = `#${body.channelId.slice(-8)}`;
  const inserted = await db.insert(habitatChannels).values({
    habitatId: body.habitatId,
    name: body.channelName?.trim() || fallbackName,
    externalId: body.channelId,
    url: body.channelUrl ?? null,
    noPosting: body.noPosting,
  }).returning({ id: habitatChannels.id, noPosting: habitatChannels.noPosting });

  return NextResponse.json({ ok: true, channel: inserted[0], created: true });
}

// POST /api/ext/habitats/channel-info
// Body: { projectId, guildId, channelId, guildName?, channelName?,
//         channelUrl?, noPosting?, language? }
// Atomic: create habitat (Discord guild) + channel với no_posting=true.
// Dùng khi user click Block trên channel chưa có habitat → ext gửi project_id
// từ inline picker.
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const body = await req.json() as {
    projectId?: string;
    guildId?: string;
    channelId?: string;
    guildName?: string;
    channelName?: string;
    channelUrl?: string;
    noPosting?: boolean;
    language?: string;
  };
  if (!body.projectId || !body.guildId || !body.channelId) {
    return NextResponse.json({ error: 'projectId + guildId + channelId required' }, { status: 400 });
  }

  // Check habitat tồn tại trước theo guildId (idempotent — nếu race
  // condition tạo 2 nơi cùng lúc, lần 2 dùng habitat cũ).
  const existingHabitat = await db.execute(sql`
    SELECT id FROM habitats WHERE scraped_meta->>'discord_guild_id' = ${body.guildId} LIMIT 1
  `);
  let habitatId: number;
  if ((existingHabitat as unknown as Array<{ id: number }>).length > 0) {
    habitatId = Number((existingHabitat as unknown as Array<{ id: number }>)[0]!.id);
  } else {
    const habitatName = body.guildName?.trim() || `Discord Guild ${body.guildId.slice(-6)}`;
    const inserted = await db.insert(habitats).values({
      projectId: body.projectId,
      name: habitatName,
      kind: 'discord',
      url: body.channelUrl?.split('/channels/')[0] + '/channels/' + body.guildId,
      language: body.language ?? '',
      scrapedMeta: { discord_guild_id: body.guildId } as Record<string, unknown>,
    }).returning({ id: habitats.id });
    habitatId = inserted[0]!.id;
  }

  // Check channel tồn tại
  const existingChannel = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(
      eq(habitatChannels.habitatId, habitatId),
      eq(habitatChannels.externalId, body.channelId),
    ))
    .limit(1);

  if (existingChannel.length > 0) {
    const updated = await db.update(habitatChannels)
      .set({ noPosting: body.noPosting ?? true, updatedAt: new Date() })
      .where(eq(habitatChannels.id, existingChannel[0]!.id))
      .returning({ id: habitatChannels.id, noPosting: habitatChannels.noPosting });
    return NextResponse.json({ ok: true, habitatId, channel: updated[0], created: false });
  }

  const fallbackName = `#${body.channelId.slice(-8)}`;
  const inserted = await db.insert(habitatChannels).values({
    habitatId,
    name: body.channelName?.trim() || fallbackName,
    externalId: body.channelId,
    url: body.channelUrl ?? null,
    noPosting: body.noPosting ?? true,
    language: body.language ?? '',
  }).returning({ id: habitatChannels.id, noPosting: habitatChannels.noPosting });

  return NextResponse.json({ ok: true, habitatId, channel: inserted[0], created: true });
}
