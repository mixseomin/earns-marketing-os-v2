import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { clearOverride, normScopeKind, type ScopeKind } from '@/lib/actions/habitat-selectors';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';

export const dynamic = 'force-dynamic';

// Clear (delete) 1 selector row qua ext (HL mode label menu click).
// Mặc định scope='platform' để xóa selector chung; user có thể pass
// scope='habitat'/'technology' để clear scope hẹp/rộng hơn (legacy 'engine' OK).

interface ClearReq {
  platform_key: string;     // dùng làm scope_key default
  page_kind: string;
  field_name: string;
  scope?: ScopeKind | 'engine';
  scope_key?: string;
}

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);
  const body = (await req.json()) as ClearReq;

  if (!body.platform_key || !body.page_kind || !body.field_name) {
    return NextResponse.json({
      ok: false,
      error: 'platform_key + page_kind + field_name required',
    }, { status: 400 });
  }

  const scope = normScopeKind(body.scope ?? 'platform');
  const key = body.scope_key ?? body.platform_key;

  const res = await clearOverride({
    scopeKind: scope,
    scopeKey: key,
    pageKind: body.page_kind,
    fieldName: body.field_name,
  });

  await logExtCall({
    endpoint: 'clear-selector', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: { platform_key: body.platform_key, page_kind: body.page_kind, field: body.field_name, scope, key },
    responseMeta: { ok: res.ok },
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({ ok: res.ok, scope, key, field: body.field_name });
}
