import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

// POST /api/ext/selectors/set — lưu THỦ CÔNG 1 selector từ picker on-page (khác learn-selectors = LLM).
// Ghi TRỰC TIẾP field_name as-is (vd 'post.author') — KHÔNG qua setMap/canonField vì canonField biến
// '.' → '_' (post.author → post_author) SAI convention dot mà resolve + buildDbAdapter dùng.
// source='manual' → cascade habitat>platform>engine + ext MOS2.sel dùng ngay.
// Body: { scopeKind:'platform'|'engine'|'habitat', scopeKey, pageKind, fieldName, css, attr? }
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const b = (await req.json().catch(() => ({}))) as {
    scopeKind?: string; scopeKey?: string; pageKind?: string; fieldName?: string; css?: string; attr?: string | null;
    // Metric selectors (page_kind='post-metrics'): cách đọc số (via) + parse hint.
    via?: string | null; parse?: string | null;
  };
  const scopeKind = b.scopeKind === 'engine' || b.scopeKind === 'habitat' ? b.scopeKind : 'platform';
  const scopeKey = String(b.scopeKey || '').trim();
  const pageKind = String(b.pageKind || '').trim();
  const fieldName = String(b.fieldName || '').trim();
  const css = String(b.css || '').trim();
  if (!scopeKey || !pageKind || !fieldName || !css) {
    return errorResponse('scopeKey + pageKind + fieldName + css required', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  const spec: { css: string; attr?: string; via?: string; parse?: string } = { css };
  if (b.attr) spec.attr = String(b.attr);
  // via chỉ valid cho metric extraction — whitelist khớp branch MOS2.sel.metrics().
  const VIA = new Set(['text', 'attr', 'count', 'depthCount', 'aria']);
  if (b.via && VIA.has(String(b.via))) spec.via = String(b.via);
  if (b.parse) spec.parse = String(b.parse);

  try {
    await db.execute(sql`
      INSERT INTO selector_overrides (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, updated_at)
      VALUES ('self', ${scopeKind}, ${scopeKey}, ${pageKind}, ${fieldName}, ${JSON.stringify(spec)}::jsonb, 'manual', NOW())
      ON CONFLICT (tenant_id, scope_kind, scope_key, page_kind, field_name)
      DO UPDATE SET spec = EXCLUDED.spec, source = 'manual', updated_at = NOW()`);
    return NextResponse.json({ ok: true, fieldName });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'save failed', 500);
  }
}
