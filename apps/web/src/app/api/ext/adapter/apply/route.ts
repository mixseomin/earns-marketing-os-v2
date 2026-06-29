import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';
import { setMap, type SelectorMap } from '@/lib/actions/habitat-selectors';
import { validateSelector } from '@/lib/selector-validate';
import { normScopeKind } from '@/lib/scope-kind';

export const dynamic = 'force-dynamic';

// Ghi adapter đã duyệt (từ suggest-adapter) vào selector_overrides. Admin-only.
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const platformKey = String(body.platformKey ?? '').trim();
  const pageKind = String(body.pageKind ?? '').trim();
  const scopeKind = normScopeKind((body.scope as string) || 'platform');
  const scopeKey = String(body.scopeKey ?? platformKey).trim();
  const selectors = (body.selectors ?? {}) as SelectorMap;
  if (!pageKind || !scopeKey || !Object.keys(selectors).length) {
    return errorResponse('pageKind + scopeKey + selectors required', 400);
  }
  const valid: SelectorMap = {};
  for (const [f, spec] of Object.entries(selectors)) {
    if (spec?.css && validateSelector(spec.css).ok) valid[f] = spec;
  }
  if (!Object.keys(valid).length) return errorResponse('no valid selectors', 400);
  const save = await setMap({ scopeKind, scopeKey, pageKind, selectors: valid, source: 'llm' });
  return NextResponse.json({ ok: save.ok, saved: save.saved, skipped: save.skipped, scope: scopeKind, scopeKey });
}
