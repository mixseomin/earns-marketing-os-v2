import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/selectors/list?platformKey=&technologyKey=
// Mọi field selector HỆ THỐNG đã detect/train cho 1 platform (+ technology kế thừa).
// Ext FAB "Field đã detect" mở list này — group theo page_kind, mỗi field kèm css/attr/scope/health.
export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;
  const p = new URL(req.url).searchParams;
  const platformKey = p.get('platformKey') ? canonPlatformKey(String(p.get('platformKey'))) : null;
  const technologyKey = p.get('technologyKey') ? String(p.get('technologyKey')).trim() : null;
  if (!platformKey && !technologyKey) return errorResponse('platformKey or technologyKey required', 400);
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  try {
    const rows = await db.execute(sql`
      SELECT scope_kind, scope_key, page_kind, field_name,
             spec->>'css' AS css, spec->>'attr' AS attr, source,
             miss_streak, last_ok_at, last_miss_at
      FROM selector_overrides
      WHERE (scope_kind = 'platform' AND scope_key = ${platformKey})
         OR (scope_kind IN ('technology','engine') AND scope_key = ${technologyKey})
      ORDER BY page_kind, field_name`);
    const fields = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      scopeKind: String(r.scope_kind),
      scopeKey: (r.scope_key as string | null) ?? null,
      pageKind: String(r.page_kind ?? 'page'),
      field: String(r.field_name ?? ''),
      css: (r.css as string | null) ?? null,
      attr: (r.attr as string | null) ?? null,
      source: (r.source as string | null) ?? null,
      missStreak: Number(r.miss_streak) || 0,
      broken: (Number(r.miss_streak) || 0) >= 3,
    }));
    return NextResponse.json({ ok: true, platformKey, technologyKey, count: fields.length, fields });
  } catch (e) {
    return errorResponse('query failed: ' + (e instanceof Error ? e.message : String(e)), 500);
  }
}
