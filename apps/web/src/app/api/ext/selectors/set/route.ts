import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';
import { setOverride } from '@/lib/actions/habitat-selectors';

export const dynamic = 'force-dynamic';

// POST /api/ext/selectors/set — lưu THỦ CÔNG 1 selector từ picker on-page (khác learn-selectors = LLM).
// Đi qua setOverride = WRITE-PATH DUY NHẤT (giống save-selector): canonField giữ dotted field
// (post.author/viewer.handle… qua PRESERVE_DOTTED) + fold FIELD_ALIASES theo page_kind (signup
// bio→about, website→profile_website) + CSS-identity adopt guard. Trước đây route này hand-roll
// INSERT bỏ qua canon → signup ghi raw bio/website/pronouns = rows TRÙNG cho 1 element (bug P0).
// Trả canonicalField để ext key cache theo tên server echo (tránh drift _selDbMap).
// Body: { scopeKind:'platform'|'technology'|'habitat', scopeKey, pageKind, fieldName, css, attr?, via?, parse? }
//        (legacy 'engine' accepted; setOverride/normScopeKind → 'technology').
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const b = (await req.json().catch(() => ({}))) as {
    scopeKind?: string; scopeKey?: string; pageKind?: string; fieldName?: string; css?: string; attr?: string | null;
    // Metric selectors (page_kind='post-metrics'): cách đọc số (via) + parse hint.
    via?: string | null; parse?: string | null;
  };
  // legacy 'engine' → 'technology'; anything but technology/habitat falls back to platform.
  const scopeKind = (b.scopeKind === 'engine' || b.scopeKind === 'technology' ? 'technology'
    : b.scopeKind === 'habitat' ? 'habitat' : 'platform') as 'platform' | 'technology' | 'habitat';
  const scopeKey = String(b.scopeKey || '').trim();
  const pageKind = String(b.pageKind || '').trim();
  const fieldName = String(b.fieldName || '').trim();
  const css = String(b.css || '').trim();
  if (!scopeKey || !pageKind || !fieldName || !css) {
    return errorResponse('scopeKey + pageKind + fieldName + css required', 400);
  }

  const spec: { css: string; attr?: string; via?: string; parse?: string } = { css };
  if (b.attr) spec.attr = String(b.attr);
  // via chỉ valid cho metric extraction — whitelist khớp branch MOS2.sel.metrics().
  const VIA = new Set(['text', 'attr', 'count', 'depthCount', 'aria']);
  if (b.via && VIA.has(String(b.via))) spec.via = String(b.via);
  if (b.parse) spec.parse = String(b.parse);

  const res = await setOverride({
    scopeKind, scopeKey, pageKind, fieldName,
    spec: spec as unknown as Parameters<typeof setOverride>[0]['spec'],
    source: 'manual',
  });
  if (!res.ok) return errorResponse(res.error || 'save failed', 500);
  // Tên thật sau canon/adopt — echo cho ext key cache theo server (no silent divergence).
  const savedField = res.canonicalField ?? fieldName;
  return NextResponse.json({ ok: true, fieldName: savedField, requested: fieldName, canonicalField: savedField, adopted: !!res.adopted });
}
