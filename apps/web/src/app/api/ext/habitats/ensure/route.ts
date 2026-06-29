import { NextResponse } from 'next/server';
import { sql, eq } from 'drizzle-orm';
import { getDb, platforms } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';

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
  const err = await checkAuth(req); if (err) return err;
  const db = getDb();
  if (!db) return errorResponse('DB not configured', 503);

  const b = (await req.json()) as {
    projectId?: string; platformKey?: string; kind?: string;
    name?: string; externalId?: string; url?: string; title?: string;
    members?: number; description?: string; weeklyVisitors?: number;
    weeklyContributions?: number; iconUrl?: string; isOwn?: boolean;
  };
  const projectId = (b.projectId || '').trim();
  const platformKey = (b.platformKey || '').trim();
  const name = (b.name || '').trim();
  const kind = (b.kind || 'profile').trim();
  const externalId = (b.externalId || '').trim();
  if (!projectId || !name) return errorResponse('projectId + name required', 400);

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
  const hit = firstRow(found);
  if (hit) {
    // Owned toggle (mark "site của tôi") — set thẳng nếu gửi.
    if (typeof b.isOwn === 'boolean') {
      await db.execute(sql`UPDATE habitats SET is_own = ${b.isOwn}, updated_at = NOW() WHERE id = ${Number(hit.id)}`);
    }
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
  // ON CONFLICT chống double-fire race: check-then-insert KHÔNG atomic → 2 request
  // gần đồng thời cùng qua SELECT thấy trống rồi cùng INSERT. Unique index
  // (project_id, platform_key, lower(name)) + DO NOTHING → bản thua không tạo trùng.
  const ins = await db.execute(sql`
    INSERT INTO habitats (project_id, platform_key, kind, name, url, scraped_meta, imported_from,
                          members, description, weekly_visitors, weekly_contributions, icon_url, is_own)
    VALUES (${projectId}, ${platformKey || null}, ${kind}, ${name}, ${b.url || null},
            ${JSON.stringify(meta)}::jsonb, 'ext-widget',
            ${members ?? 0}, ${description ?? ''}, ${weeklyVisitors ?? 0}, ${weeklyContributions ?? 0}, ${iconUrl}, ${b.isOwn === true})
    ON CONFLICT (project_id, platform_key, lower(name)) DO NOTHING
    RETURNING id, name, kind, project_id, platform_key
  `);
  let row = firstRow(ins);
  // Conflict (bản khác thắng race) → re-select bản đã tồn tại, trả created:false (idempotent).
  if (!row) {
    const ex = await db.execute(sql`
      SELECT id, name, kind, project_id, platform_key FROM habitats
      WHERE project_id = ${projectId}
        AND platform_key IS NOT DISTINCT FROM ${platformKey || null}
        AND lower(name) = lower(${name})
      ORDER BY id LIMIT 1
    `);
    row = firstRow(ex);
    if (!row) return errorResponse('insert failed', 500);
    return NextResponse.json({
      ok: true, created: false,
      habitat: {
        id: Number(row.id), name: String(row.name), kind: String(row.kind),
        projectId: String(row.project_id), platformKey: row.platform_key ? String(row.platform_key) : null,
        briefId: null,
      },
    });
  }
  return NextResponse.json({
    ok: true, created: true,
    habitat: {
      id: Number(row.id), name: String(row.name), kind: String(row.kind),
      projectId: String(row.project_id), platformKey: row.platform_key ? String(row.platform_key) : null,
      briefId: null,
    },
  });
}
