import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Shared cross-project approach library (reusable seeding playbooks). See decision 2026-06-22-seeding-radar.
//   GET  ?q=&platformKey=     → list (platform-relevant first; angle is reusable across projects)
//   POST { title, angle, category?, tags?, sourceProjectId?, platformKey? } → create
//   DELETE ?id=               → remove a playbook
export async function GET(req: Request) {
  const authErr = await checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim().toLowerCase();
  const platformKey = (p.get('platformKey') || '').trim() || null;
  const like = q ? `%${q}%` : null;
  const rows = (await db.execute(sql`
    SELECT id, title, angle, category, tags, source_project_id, platform_key, uses, last_used_at
    FROM approach_playbooks
    WHERE tenant_id = 'self'
      ${platformKey ? sql`AND (platform_key = ${platformKey} OR platform_key IS NULL)` : sql``}
      ${like ? sql`AND (lower(title) LIKE ${like} OR lower(angle) LIKE ${like} OR lower(category) LIKE ${like})` : sql``}
    ORDER BY ${platformKey ? sql`(platform_key = ${platformKey}) DESC,` : sql``} uses DESC, updated_at DESC
    LIMIT 100`)) as Array<Record<string, unknown>>;
  return okResponse({ playbooks: rows.map(mapRow) });
}

export async function POST(req: Request) {
  const authErr = await checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const b = (await req.json().catch(() => ({}))) as { title?: string; angle?: string; category?: string; tags?: string[]; sourceProjectId?: string; platformKey?: string };
  const title = String(b.title ?? '').trim().slice(0, 160);
  const angle = String(b.angle ?? '').trim().slice(0, 1000);
  if (!title) return errorResponse('title required', 400);
  if (!angle) return errorResponse('angle required', 400);
  const category = String(b.category ?? '').trim().slice(0, 80);
  const tags = Array.isArray(b.tags) ? b.tags.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20) : [];
  const sourceProjectId = String(b.sourceProjectId ?? '').trim() || null;
  const platformKey = String(b.platformKey ?? '').trim() || null;
  const ins = (await db.execute(sql`
    INSERT INTO approach_playbooks (tenant_id, title, angle, category, tags, source_project_id, platform_key)
    VALUES ('self', ${title}, ${angle}, ${category}, ${JSON.stringify(tags)}::jsonb, ${sourceProjectId}, ${platformKey})
    RETURNING id, title, angle, category, tags, source_project_id, platform_key, uses, last_used_at`)) as Array<Record<string, unknown>>;
  if (!ins[0]) return errorResponse('insert failed', 500);
  return okResponse({ playbook: mapRow(ins[0]) });
}

export async function DELETE(req: Request) {
  const authErr = await checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isFinite(id)) return errorResponse('id required', 400);
  await db.execute(sql`DELETE FROM approach_playbooks WHERE id = ${id} AND tenant_id = 'self'`);
  return okResponse({ ok: true });
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: Number(r.id), title: String(r.title ?? ''), angle: String(r.angle ?? ''),
    category: String(r.category ?? ''), tags: Array.isArray(r.tags) ? r.tags.map((x) => String(x)) : [],
    sourceProjectId: r.source_project_id != null ? String(r.source_project_id) : null,
    platformKey: r.platform_key != null ? String(r.platform_key) : null,
    uses: Number(r.uses ?? 0), lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
  };
}
