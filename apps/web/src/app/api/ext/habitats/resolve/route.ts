import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';   // disable static optimization
export const revalidate = 0;              // disable ISR

// GET /api/ext/habitats/resolve?url=https://reddit.com/r/Astrologia/comments/xxx
// Trả habitat info + brief active đang seed để side panel ext biết context.
// Match URL theo:
//   1. Reddit /r/<sub>/...   → habitat WHERE kind=subreddit + LOWER(name)=r/<sub>
//   2. Facebook group/...    → habitat WHERE kind=fb-group + url LIKE
//   3. Generic               → habitat WHERE url LIKE '%<host>%'

// Helper: response với Cache-Control no-store để Chrome/browser KHÔNG cache.
// Symptom v1.5.71: ext cached response of previous URL leaks → habitat sai.
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const params = new URL(req.url).searchParams;
  const url = params.get('url') || '';
  if (!url) return NextResponse.json({ habitat: null }, { headers: noStoreHeaders });

  // projectId (optional) — disambiguate khi 1 URL/subreddit map nhiều project.
  // PREFER project đang chọn ở ext nhưng KHÔNG hard-filter: nếu habitat chỉ
  // tồn tại ở project khác vẫn trả về (URL là sự thật) — ext sẽ cảnh báo lệch.
  const projectId = (params.get('projectId') ?? '').trim();
  const projectPref = projectId ? sql`(h.project_id = ${projectId}) DESC, ` : sql``;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503, headers: noStoreHeaders });

  let parsedUrl: URL;
  try { parsedUrl = new URL(url); }
  catch { return NextResponse.json({ habitat: null }, { headers: noStoreHeaders }); }

  const host = parsedUrl.hostname.replace(/^www\./, '');
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

  // Reddit subreddit
  if (host.endsWith('reddit.com') && pathParts[0] === 'r' && pathParts[1]) {
    const subName = `r/${pathParts[1]}`;
    const rows = await db.execute(sql`
      SELECT h.id, h.name, h.kind, h.language, h.project_id, h.platform_key, h.technology_key, h.url,
             (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
      FROM habitats h
      WHERE LOWER(h.name) = LOWER(${subName})
      ORDER BY ${projectPref} h.id
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
          platformKey: r.platform_key ? String(r.platform_key) : null,
          technologyKey: r.technology_key ? String(r.technology_key) : null,
          url: r.url ? String(r.url) : null,
          briefId: r.brief_id ? Number(r.brief_id) : null,
        },
      }, { headers: noStoreHeaders });
    }
    // RETURN SỚM: subreddit chưa map → null. KHÔNG rơi xuống generic fallback
    // bên dưới vì ILIKE '%reddit.com%' khớp NHẦM bất kỳ subreddit nào khác
    // (URL dài nhất thắng) → habitat sai. r/<sub> chỉ match đúng theo tên.
    return NextResponse.json({ habitat: null }, { headers: noStoreHeaders });
  }

  // Discord channel page: /channels/<guild_id>/<channel_id>
  // 3-tier match:
  //   1. scraped_meta.discord_guild_id = guildId (direct)
  //   2. Habitat có URL invite discord.gg/<code> → fetch invite API
  //      → match guild_id → BACKFILL scraped_meta cho habitat đó (next time tier 1)
  //   3. Fallback: generic URL substring (last resort)
  if (host.endsWith('discord.com') && pathParts[0] === 'channels' && pathParts[1]) {
    const guildId = pathParts[1];
    if (/^\d{15,25}$/.test(guildId)) {
      // TIER 1: direct guild_id match
      const rows = await db.execute(sql`
        SELECT h.id, h.name, h.kind, h.language, h.project_id, h.platform_key, h.technology_key, h.url,
               (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
        FROM habitats h
        WHERE h.scraped_meta->>'discord_guild_id' = ${guildId}
        ORDER BY ${projectPref} h.id
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
            platformKey: r.platform_key ? String(r.platform_key) : null,
          technologyKey: r.technology_key ? String(r.technology_key) : null,
            url: r.url ? String(r.url) : null,
            briefId: r.brief_id ? Number(r.brief_id) : null,
          },
        });
      }
      // TIER 2: resolve invite URLs trong Discord habitats chưa có guild_id
      const inviteCandidates = await db.execute(sql`
        SELECT h.id, h.name, h.kind, h.language, h.project_id, h.platform_key, h.technology_key, h.url,
               (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
        FROM habitats h
        WHERE h.kind = 'discord'
          AND h.url LIKE 'https://discord.gg/%'
          AND (h.scraped_meta->>'discord_guild_id' IS NULL OR h.scraped_meta->>'discord_guild_id' = '')
      `) as unknown as Array<Record<string, unknown>>;
      for (const c of inviteCandidates) {
        const inviteUrl = String(c.url ?? '');
        const m = inviteUrl.match(/discord\.gg\/([A-Za-z0-9-]+)/);
        if (!m) continue;
        const inviteCode = m[1];
        try {
          const inviteRes = await fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=false`, {
            headers: { 'User-Agent': 'MOS2/1.0 (https://mos2.on.tc)' },
          });
          if (!inviteRes.ok) continue;
          const inviteData = await inviteRes.json() as { guild?: { id?: string } };
          const resolvedGuildId = inviteData.guild?.id;
          if (resolvedGuildId === guildId) {
            // Match! Backfill scraped_meta cho habitat này → tier 1 sau này
            await db.execute(sql`
              UPDATE habitats
              SET scraped_meta = COALESCE(scraped_meta, '{}'::jsonb)
                || jsonb_build_object('discord_guild_id', ${guildId}::text)
              WHERE id = ${Number(c.id)}
            `);
            return NextResponse.json({
              habitat: {
                id: Number(c.id),
                name: String(c.name),
                kind: String(c.kind),
                language: String(c.language ?? ''),
                projectId: String(c.project_id),
                platformKey: c.platform_key ? String(c.platform_key) : null,
                technologyKey: c.technology_key ? String(c.technology_key) : null,
                url: inviteUrl,
                briefId: c.brief_id ? Number(c.brief_id) : null,
              },
            }, { headers: noStoreHeaders });
          } else if (resolvedGuildId) {
            // Lỡ cơ hội backfill cho candidate KHÁC guild — vẫn cache để
            // lần resolve khác đỡ phải fetch
            await db.execute(sql`
              UPDATE habitats
              SET scraped_meta = COALESCE(scraped_meta, '{}'::jsonb)
                || jsonb_build_object('discord_guild_id', ${resolvedGuildId}::text)
              WHERE id = ${Number(c.id)}
            `);
          }
        } catch { /* skip on fetch fail / rate limit */ }
      }
    }
  }

  // Community-discriminator match — known platform nhiều community CÙNG host
  // (FB group/page, LinkedIn group/company, X community, YouTube channel). Khớp
  // theo phần ĐỊNH DANH trong path (group id / vanity), KHÔNG chỉ host → tránh
  // generic host-match trả nhầm community khác. Xem wiki/mos/habitat-taxonomy.
  const discrim = (() => {
    const m = host.endsWith('facebook.com') || host.endsWith('fb.com');
    if (m) {
      if (pathParts[0] === 'groups' && pathParts[1]) return `/groups/${pathParts[1]}`;
      if (pathParts[0] === 'profile.php') { const id = parsedUrl.searchParams.get('id'); if (id) return `profile.php?id=${id}`; }
      if (pathParts[0] === 'pages' && pathParts[1]) return `/pages/${pathParts.slice(1).join('/')}`;
      if (pathParts.length === 1) return `/${pathParts[0]}`;
    }
    if (host.endsWith('linkedin.com')) {
      if (pathParts[0] === 'groups' && pathParts[1]) return `/groups/${pathParts[1]}`;
      if (pathParts[0] === 'company' && pathParts[1]) return `/company/${pathParts[1]}`;
    }
    if ((host.endsWith('twitter.com') || host.endsWith('x.com')) && pathParts[0] === 'i' && pathParts[1] === 'communities' && pathParts[2]) return `/i/communities/${pathParts[2]}`;
    if (host.endsWith('youtube.com')) {
      if (pathParts[0] && pathParts[0].startsWith('@')) return `/${pathParts[0]}`;
      if ((pathParts[0] === 'channel' || pathParts[0] === 'c' || pathParts[0] === 'user') && pathParts[1]) return `/${pathParts[0]}/${pathParts[1]}`;
    }
    return null;
  })();
  if (discrim) {
    const drows = await db.execute(sql`
      SELECT h.id, h.name, h.kind, h.language, h.project_id, h.platform_key, h.technology_key, h.url,
             (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
      FROM habitats h
      WHERE h.url ILIKE ${'%' + discrim + '%'}
      ORDER BY ${projectPref} LENGTH(h.url) DESC
      LIMIT 1
    `);
    const dr = (drows as unknown as Array<Record<string, unknown>>)[0];
    if (dr) {
      return NextResponse.json({
        habitat: {
          id: Number(dr.id), name: String(dr.name), kind: String(dr.kind),
          language: String(dr.language ?? ''), projectId: String(dr.project_id),
          platformKey: dr.platform_key ? String(dr.platform_key) : null,
          technologyKey: dr.technology_key ? String(dr.technology_key) : null,
          url: dr.url ? String(dr.url) : null,
          briefId: dr.brief_id ? Number(dr.brief_id) : null,
        },
      }, { headers: noStoreHeaders });
    }
    // discriminator có nhưng chưa map → KHÔNG fallback host-match (tránh nhầm
    // community khác cùng host) → trả null để ext hiện "thêm habitat".
    return NextResponse.json({ habitat: null }, { headers: noStoreHeaders });
  }

  // Generic URL substring match — fallback cho forum / host = 1 cộng đồng
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.language, h.project_id, h.platform_key, h.technology_key, h.url,
           (SELECT b.id FROM community_briefs b WHERE b.habitat_id = h.id ORDER BY b.updated_at DESC LIMIT 1) AS brief_id
    FROM habitats h
    WHERE h.url ILIKE ${'%' + host + '%'}
    ORDER BY ${projectPref} LENGTH(h.url) DESC
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
        platformKey: r.platform_key ? String(r.platform_key) : null,
        url: r.url ? String(r.url) : null,
        briefId: r.brief_id ? Number(r.brief_id) : null,
      },
    }, { headers: noStoreHeaders });
  }

  return NextResponse.json({ habitat: null }, { headers: noStoreHeaders });
}
