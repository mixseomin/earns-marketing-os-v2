import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

// GET /api/ext/habitats/resolve?url=https://reddit.com/r/Astrologia/comments/xxx
// Trả habitat info + brief active đang seed để side panel ext biết context.
// Match URL theo:
//   1. Reddit /r/<sub>/...   → habitat WHERE kind=subreddit + LOWER(name)=r/<sub>
//   2. Facebook group/...    → habitat WHERE kind=fb-group + url LIKE
//   3. Generic               → habitat WHERE url LIKE '%<host>%'

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url).searchParams.get('url') || '';
  if (!url) return NextResponse.json({ habitat: null });

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  let parsedUrl: URL;
  try { parsedUrl = new URL(url); }
  catch { return NextResponse.json({ habitat: null }); }

  const host = parsedUrl.hostname.replace(/^www\./, '');
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

  // Reddit subreddit
  if (host.endsWith('reddit.com') && pathParts[0] === 'r' && pathParts[1]) {
    const subName = `r/${pathParts[1]}`;
    const rows = await db.execute(sql`
      SELECT h.id, h.name, h.kind, h.language, h.project_id, h.url,
             (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
      FROM habitats h
      WHERE LOWER(h.name) = LOWER(${subName})
      LIMIT 1
    `);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (r) {
      return NextResponse.json({
        habitat: {
          id: Number(r.id),
          name: String(r.name),
          kind: String(r.kind),
          language: String(r.language ?? ''),
          projectId: String(r.project_id),
          url: r.url ? String(r.url) : null,
          briefId: r.brief_id ? Number(r.brief_id) : null,
        },
      });
    }
  }

  // Discord channel page: /channels/<guild_id>/<channel_id>
  // KEY match: scraped_meta.discord_guild_id (snowflake). Cùng server dù URL
  // invite (discord.gg/xxx) hay channel page → cùng guild_id.
  if (host.endsWith('discord.com') && pathParts[0] === 'channels' && pathParts[1]) {
    const guildId = pathParts[1];
    if (/^\d{15,25}$/.test(guildId)) {
      const rows = await db.execute(sql`
        SELECT h.id, h.name, h.kind, h.language, h.project_id, h.url,
               (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
        FROM habitats h
        WHERE h.scraped_meta->>'discord_guild_id' = ${guildId}
        LIMIT 1
      `);
      const r = (rows as unknown as Array<Record<string, unknown>>)[0];
      if (r) {
        return NextResponse.json({
          habitat: {
            id: Number(r.id),
            name: String(r.name),
            kind: String(r.kind),
            language: String(r.language ?? ''),
            projectId: String(r.project_id),
            url: r.url ? String(r.url) : null,
            briefId: r.brief_id ? Number(r.brief_id) : null,
          },
        });
      }
    }
  }

  // Generic URL substring match — fallback cho FB group / forum / Discord
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.language, h.project_id, h.url,
           (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
    FROM habitats h
    WHERE h.url ILIKE ${'%' + host + '%'}
    ORDER BY LENGTH(h.url) DESC
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (r) {
    return NextResponse.json({
      habitat: {
        id: Number(r.id),
        name: String(r.name),
        kind: String(r.kind),
        language: String(r.language ?? ''),
        projectId: String(r.project_id),
        url: r.url ? String(r.url) : null,
        briefId: r.brief_id ? Number(r.brief_id) : null,
      },
    });
  }

  return NextResponse.json({ habitat: null });
}
