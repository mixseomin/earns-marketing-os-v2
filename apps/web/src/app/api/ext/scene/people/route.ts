import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

// GET /api/ext/scene/people?projectId=X&handles=a,b,c
// WHO-THEM familiarity lookup for the Crew ext — enrich replier rows in-context
// (badge familiarity/status next to each handle). migration 0099.
export async function GET(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const projectId = (url.searchParams.get('projectId') ?? '').trim();
  if (!projectId) return errorResponse('projectId required', 400);

  const handlesRaw = (url.searchParams.get('handles') ?? '').trim();
  const handles = handlesRaw
    ? handlesRaw.split(',').map((h) => h.replace(/^@/, '').trim().toLowerCase()).filter(Boolean).slice(0, 50)
    : [];

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // 2-tier: handle ở scene_identities (global); familiarity ở people (relationship per account).
  // Badge = mức THÂN NHẤT của mình với người đó trong project. DISTINCT ON (handle) cần ORDER BY handle
  // TRƯỚC → wrap subquery để vẫn sort theo familiarity (top-200) + limit. (drizzle bind ANY(array)
  // lỗi 42846 → dùng IN-list tường minh qua sql.join.)
  const handleFilter = handles.length
    ? sql` AND i.handle IN (${sql.join(handles.map((h) => sql`${h}`), sql`, `)})`
    : sql``;
  const res = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (i.handle) i.handle, p.familiarity_score, p.status, p.interaction_count, p.they_replied_back
      FROM people p JOIN scene_identities i ON i.id = p.identity_id
      WHERE p.project_id = ${projectId}${handleFilter}
      ORDER BY i.handle, p.familiarity_score DESC NULLS LAST
    ) t ORDER BY familiarity_score DESC NULLS LAST LIMIT 200`);
  const rows = res as unknown as Array<Record<string, unknown>>;

  const people: Record<string, { familiarity: number; status: string; interactions: number; repliedBack: boolean }> = {};
  for (const r of rows) {
    people[String(r.handle)] = {
      familiarity: Number(r.familiarity_score ?? 0),
      status: String(r.status ?? 'observed'),
      interactions: Number(r.interaction_count ?? 0),
      repliedBack: r.they_replied_back === true,
    };
  }
  return NextResponse.json({ ok: true, people, count: rows.length });
}
