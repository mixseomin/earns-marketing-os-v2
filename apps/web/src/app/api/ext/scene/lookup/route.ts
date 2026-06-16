import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse, rows } from '@/lib/ext-route';

// GET /api/ext/scene/lookup?platformKey=x&handle=nmtd8
// CROSS-PROJECT person lookup cho badge trên TRANG PROFILE (ko có project/habitat context như
// feed). Trả familiarity của MÌNH với 1 người trên MỌI project (tenant 'self') — row engaged
// nhất lên đầu + list per-project. Khác /scene/people (per-project, theo handles[] trong feed).
export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const pk = (url.searchParams.get('platformKey') ?? '').trim();
  const handle = (url.searchParams.get('handle') ?? '').replace(/^@/, '').trim().toLowerCase();
  if (!handle) return errorResponse('handle required', 400);

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // x/twitter duality: ext gửi 'x' nhưng habitat/feed lưu canonical 'twitter' → match CẢ HAI.
  // (drizzle bind JS array thành RECORD → `ANY(${arr}::text[])` lỗi 42846 → dùng OR tường minh.)
  const pkAlt = pk === 'x' ? 'twitter' : pk === 'twitter' ? 'x' : pk;
  const list = rows(await db.execute(pk
    ? sql`SELECT project_id, familiarity_score, status, interaction_count, they_replied_back
            FROM people WHERE tenant_id = 'self' AND handle = ${handle} AND (platform_key = ${pk} OR platform_key = ${pkAlt})
            ORDER BY familiarity_score DESC NULLS LAST`
    : sql`SELECT project_id, familiarity_score, status, interaction_count, they_replied_back
            FROM people WHERE tenant_id = 'self' AND handle = ${handle}
            ORDER BY familiarity_score DESC NULLS LAST`));

  if (!list.length) return NextResponse.json({ ok: true, person: null });
  const top = list[0] as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    person: {
      handle,
      familiarity: Number(top.familiarity_score ?? 0),
      status: String(top.status ?? 'observed'),
      interactions: Number(top.interaction_count ?? 0),
      repliedBack: top.they_replied_back === true,
      projectId: String(top.project_id ?? ''),
      projects: list.map((r) => ({
        projectId: String((r as Record<string, unknown>).project_id ?? ''),
        familiarity: Number((r as Record<string, unknown>).familiarity_score ?? 0),
        status: String((r as Record<string, unknown>).status ?? 'observed'),
      })),
    },
  });
}
