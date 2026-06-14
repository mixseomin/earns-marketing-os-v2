import { NextResponse } from 'next/server';
import { sql, eq } from 'drizzle-orm';
import { getDb, platforms } from '@mos2/db';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/ext/habitats/ensure
// Resolve-or-create 1 habitat THEO IDENTITY (không theo URL community) — dùng cho
// nền tảng mà habitat = profile/hashtag (X, Threads…), nơi /habitats/resolve?url=
// không match được. Idempotent: prefer match externalId (scraped_meta.ext_external_id)
// rồi (project + platform + LOWER(name)). Tạo mới tối thiểu nếu chưa có.
// Body: { projectId, platformKey, kind, name, externalId?, url?, title? }
// → { ok, created, habitat: { id, name, kind, projectId, platformKey, briefId } }
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB not configured' }, { status: 503 });

  const b = (await req.json()) as {
    projectId?: string; platformKey?: string; kind?: string;
    name?: string; externalId?: string; url?: string; title?: string;
    members?: number; description?: string; weeklyVisitors?: number;
    weeklyContributions?: number; iconUrl?: string;
  };
  const projectId = (b.projectId || '').trim();
  const platformKey = (b.platformKey || '').trim();
  const name = (b.name || '').trim();
  const kind = (b.kind || 'profile').trim();
  const externalId = (b.externalId || '').trim();
  if (!projectId || !name) return NextResponse.json({ ok: false, error: 'projectId + name required' }, { status: 400 });

  // Metadata bắt từ trang search communities (DOM logged-in). Chỉ điền field còn trống (COALESCE).
  const members = Number.isFinite(b.members as number) ? Math.round(b.members as number) : null;
  const description = (b.description || '').trim() || null;
  const weeklyVisitors = Number.isFinite(b.weeklyVisitors as number) ? Math.round(b.weeklyVisitors as number) : null;
  const weeklyContributions = Number.isFinite(b.weeklyContributions as number) ? Math.round(b.weeklyContributions as number) : null;
  const iconUrl = (b.iconUrl || '').trim() || null;

  // platform FK guard (mirror /habitats POST)
  if (platformKey) {
    const ex = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, platformKey)).limit(1);
    if (ex.length === 0) {
      await db.insert(platforms).values({ key: platformKey, label: b.title || name, signupUrl: b.url || '', priority: 'medium' }).onConflictDoNothing();
    }
  }

  const briefSub = sql`(SELECT bx.id FROM community_briefs bx WHERE bx.habitat_id = h.id ORDER BY bx.updated_at DESC LIMIT 1)`;
  // Resolve: externalId trước (chắc chắn nhất), rồi name trong cùng project+platform.
  const found = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.project_id, h.platform_key, ${briefSub} AS brief_id
    FROM habitats h
    WHERE h.project_id = ${projectId}
      AND (${platformKey ? sql`h.platform_key = ${platformKey}` : sql`TRUE`})
      AND (
        ${externalId ? sql`h.scraped_meta->>'ext_external_id' = ${externalId} OR` : sql``}
        LOWER(h.name) = LOWER(${name})
      )
    ORDER BY (h.scraped_meta->>'ext_external_id' = ${externalId || '___none___'}) DESC, h.id
    LIMIT 1
  `);
  const hit = (found as unknown as Array<Record<string, unknown>>)[0];
  if (hit) {
    // Backfill chỉ field còn trống — không ghi đè data đã có.
    if (members != null || description || weeklyVisitors != null || weeklyContributions != null || iconUrl) {
      await db.execute(sql`
        UPDATE habitats SET
          members = COALESCE(members, ${members}),
          description = COALESCE(NULLIF(description, ''), ${description}),
          weekly_visitors = COALESCE(weekly_visitors, ${weeklyVisitors}),
          weekly_contributions = COALESCE(weekly_contributions, ${weeklyContributions}),
          icon_url = COALESCE(NULLIF(icon_url, ''), ${iconUrl}),
          updated_at = NOW()
        WHERE id = ${Number(hit.id)}
      `);
    }
    return NextResponse.json({
      ok: true, created: false,
      habitat: {
        id: Number(hit.id), name: String(hit.name), kind: String(hit.kind),
        projectId: String(hit.project_id), platformKey: hit.platform_key ? String(hit.platform_key) : null,
        briefId: hit.brief_id ? Number(hit.brief_id) : null,
      },
    });
  }

  // Create minimal — chỉ field bắt buộc + externalId vào scraped_meta để resolve sau.
  const meta = externalId ? { ext_external_id: externalId } : {};
  const ins = await db.execute(sql`
    INSERT INTO habitats (project_id, platform_key, kind, name, url, scraped_meta, imported_from,
                          members, description, weekly_visitors, weekly_contributions, icon_url)
    VALUES (${projectId}, ${platformKey || null}, ${kind}, ${name}, ${b.url || null},
            ${JSON.stringify(meta)}::jsonb, 'ext-widget',
            ${members ?? 0}, ${description}, ${weeklyVisitors}, ${weeklyContributions}, ${iconUrl})
    RETURNING id, name, kind, project_id, platform_key
  `);
  const row = (ins as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return NextResponse.json({ ok: false, error: 'insert failed' }, { status: 500 });
  return NextResponse.json({
    ok: true, created: true,
    habitat: {
      id: Number(row.id), name: String(row.name), kind: String(row.kind),
      projectId: String(row.project_id), platformKey: row.platform_key ? String(row.platform_key) : null,
      briefId: null,
    },
  });
}
