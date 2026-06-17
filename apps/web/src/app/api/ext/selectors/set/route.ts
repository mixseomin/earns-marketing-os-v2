import { NextResponse } from 'next/server';
import { setMap } from '@/lib/actions/habitat-selectors';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

// POST /api/ext/selectors/set — lưu THỦ CÔNG 1 selector từ picker on-page (khác learn-selectors = LLM).
// Body: { scopeKind:'platform'|'engine'|'habitat', scopeKey, pageKind, fieldName, css, attr? }
// Ghi vào selector_overrides (source='manual') → cascade + ext MOS2.sel dùng ngay.
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const b = (await req.json().catch(() => ({}))) as {
    scopeKind?: string; scopeKey?: string; pageKind?: string; fieldName?: string; css?: string; attr?: string | null;
  };
  const scopeKind = b.scopeKind === 'engine' || b.scopeKind === 'habitat' ? b.scopeKind : 'platform';
  const scopeKey = String(b.scopeKey || '').trim();
  const pageKind = String(b.pageKind || '').trim();
  const fieldName = String(b.fieldName || '').trim();
  const css = String(b.css || '').trim();
  if (!scopeKey || !pageKind || !fieldName || !css) {
    return errorResponse('scopeKey + pageKind + fieldName + css required', 400);
  }

  try {
    const spec: { css: string; attr?: string } = { css };
    if (b.attr) spec.attr = String(b.attr);
    const res = await setMap({ scopeKind, scopeKey, pageKind, selectors: { [fieldName]: spec }, source: 'manual' });
    return NextResponse.json({ ok: true, result: res });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'save failed', 500);
  }
}
