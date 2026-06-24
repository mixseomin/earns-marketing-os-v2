import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/ext/selectors/health — ext báo kết quả resolve 1 field trên trang THẬT.
// matched=true → selector còn sống (last_ok_at, reset streak); matched=false → DOM đổi (last_miss_at,
// miss_streak++). Studio đọc miss_streak>=3 = "có thể hỏng" → cảnh báo chủ động.
// Update CẢ 2 scope khả dĩ (platform của host + technology engine) vì ext không biết row nào thắng cascade.
// Body: { reports: [{ platformKey?, technologyKey?, pageKind, fieldName, matched, url? }] }
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;
  const b = (await req.json().catch(() => ({}))) as {
    reports?: Array<{ platformKey?: string; technologyKey?: string; pageKind?: string; fieldName?: string; matched?: boolean; url?: string }>;
  };
  const reports = Array.isArray(b.reports) ? b.reports.slice(0, 50) : [];
  if (!reports.length) return errorResponse('reports[] required', 400);
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  let updated = 0;
  for (const r of reports) {
    const pageKind = String(r.pageKind || '').trim();
    const fieldName = String(r.fieldName || '').trim();
    if (!pageKind || !fieldName) continue;
    const platformKey = r.platformKey ? canonPlatformKey(String(r.platformKey)) : null;
    const technologyKey = r.technologyKey ? String(r.technologyKey) : null;
    const url = r.url ? String(r.url).slice(0, 300) : null;
    // scope keys khả dĩ: platform (host canon) + technology (engine). NULL bị lọc qua = ''.
    const scopeKeys = [platformKey, technologyKey].filter(Boolean) as string[];
    if (!scopeKeys.length) continue;
    const setSql = r.matched
      ? sql`last_ok_at = NOW(), miss_streak = 0`
      : sql`last_miss_at = NOW(), miss_streak = miss_streak + 1, last_url = ${url}`;
    try {
      const res = await db.execute(sql`
        UPDATE selector_overrides SET ${setSql}
        WHERE page_kind = ${pageKind} AND field_name = ${fieldName}
          AND ((scope_kind = 'platform' AND scope_key = ANY(${scopeKeys}))
            OR (scope_kind IN ('technology','engine') AND scope_key = ANY(${scopeKeys})))`);
      updated += (res as unknown as { rowCount?: number }).rowCount || 0;
    } catch { /* skip bad row */ }
  }
  return NextResponse.json({ ok: true, updated });
}
