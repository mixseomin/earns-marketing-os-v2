import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitatChannels, habitats } from '@mos2/db';
import { checkAuth } from '../../_auth';

// Helper: derive noPosting boolean từ postingGates.skip_for_post (JSONB key
// đã được modal habitat-form-modal dùng từ trước → đồng bộ 1 source of truth).
function readNoPosting(gates: unknown): boolean {
  return gates != null && typeof gates === 'object' && !Array.isArray(gates)
    && (gates as Record<string, unknown>).skip_for_post === true;
}
function buildGates(prev: unknown, noPosting: boolean): Record<string, unknown> | null {
  const base = (prev != null && typeof prev === 'object' && !Array.isArray(prev))
    ? { ...(prev as Record<string, unknown>) } : {};
  if (noPosting) {
    base.skip_for_post = true;
    if (!base.reason) base.reason = 'ext';
  } else {
    delete base.skip_for_post;
    if (base.reason === 'ext') delete base.reason;
  }
  return Object.keys(base).length > 0 ? base : null;
}

// GET /api/ext/habitats/channel-info?habitatId=18&channelId=1069825483178520607
// Trả channel info đã sync (nếu có) để sidepanel hiển thị rules + topic + noPosting.
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
      noPosting: readNoPosting(c.postingGates),
      pinnedSummary: c.pinnedSummary,
      recentSummary: c.recentSummary,
      syncedAt: c.syncedAt,
    },
  });
}

// PATCH — upsert channel với noPosting flag (ghi vào postingGates.skip_for_post
// để đồng bộ với modal habitat-form-modal). Auto-create channel nếu chưa có.
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

  const existing = await db.select().from(habitatChannels)
    .where(and(
      eq(habitatChannels.habitatId, body.habitatId),
      eq(habitatChannels.externalId, body.channelId),
    ))
    .limit(1);

  if (existing.length > 0) {
    const newGates = buildGates(existing[0]!.postingGates, body.noPosting);
    const updated = await db.update(habitatChannels)
      .set({ postingGates: newGates, updatedAt: new Date() })
      .where(eq(habitatChannels.id, existing[0]!.id))
      .returning({ id: habitatChannels.id, postingGates: habitatChannels.postingGates });
    return NextResponse.json({
      ok: true,
      channel: { id: updated[0]!.id, noPosting: readNoPosting(updated[0]!.postingGates) },
      created: false,
    });
  }

  const fallbackName = `#${body.channelId.slice(-8)}`;
  const newGates = buildGates(null, body.noPosting);
  const inserted = await db.insert(habitatChannels).values({
    habitatId: body.habitatId,
    name: body.channelName?.trim() || fallbackName,
    externalId: body.channelId,
    url: body.channelUrl ?? null,
    postingGates: newGates,
  }).returning({ id: habitatChannels.id, postingGates: habitatChannels.postingGates });

  return NextResponse.json({
    ok: true,
    channel: { id: inserted[0]!.id, noPosting: readNoPosting(inserted[0]!.postingGates) },
    created: true,
  });
}

// POST — atomic create habitat (Discord guild) + channel với noPosting flag.
// Body: { projectId, guildId, channelId, guildName?, channelName?,
//         channelUrl?, noPosting?, language? }
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

  const noPosting = body.noPosting ?? true;
  const existingChannel = await db.select().from(habitatChannels)
    .where(and(
      eq(habitatChannels.habitatId, habitatId),
      eq(habitatChannels.externalId, body.channelId),
    ))
    .limit(1);

  if (existingChannel.length > 0) {
    const newGates = buildGates(existingChannel[0]!.postingGates, noPosting);
    const updated = await db.update(habitatChannels)
      .set({ postingGates: newGates, updatedAt: new Date() })
      .where(eq(habitatChannels.id, existingChannel[0]!.id))
      .returning({ id: habitatChannels.id, postingGates: habitatChannels.postingGates });
    return NextResponse.json({
      ok: true,
      habitatId,
      channel: { id: updated[0]!.id, noPosting: readNoPosting(updated[0]!.postingGates) },
      created: false,
    });
  }

  const fallbackName = `#${body.channelId.slice(-8)}`;
  const newGates = buildGates(null, noPosting);
  const inserted = await db.insert(habitatChannels).values({
    habitatId,
    name: body.channelName?.trim() || fallbackName,
    externalId: body.channelId,
    url: body.channelUrl ?? null,
    postingGates: newGates,
    language: body.language ?? '',
  }).returning({ id: habitatChannels.id, postingGates: habitatChannels.postingGates });

  return NextResponse.json({
    ok: true,
    habitatId,
    channel: { id: inserted[0]!.id, noPosting: readNoPosting(inserted[0]!.postingGates) },
    created: true,
  });
}
