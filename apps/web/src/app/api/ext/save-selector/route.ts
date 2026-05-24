import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { setOverride } from '@/lib/actions/habitat-selectors';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { getFieldSchema } from '@/lib/habitat-field-schema';
import { validateSelector } from '@/lib/selector-validate';

export const dynamic = 'force-dynamic';

// MANUAL CSS selector save (skip LLM).
// User gõ tay CSS trên ext train UI, ext live-preview → click Save → POST đây.
// Server validate (FORBIDDEN_PATTERNS) + infer attr/parse từ schema → setOverride.

interface SaveReq {
  platform_key: string;
  page_kind: string;
  field_name: string;
  css: string;
  attr?: string;
  parse?: string;
  target_scope?: 'engine' | 'platform' | 'habitat';
  target_key?: string;
  habitat_id?: number;
  technology_key?: string;
}

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);
  const body = (await req.json()) as SaveReq;

  if (!body.platform_key || !body.page_kind || !body.field_name || !body.css) {
    return NextResponse.json({
      ok: false,
      error: 'platform_key + page_kind + field_name + css required',
    }, { status: 400 });
  }

  const validation = validateSelector(body.css);
  if (!validation.ok) {
    await logExtCall({
      endpoint: 'save-selector', method: 'POST',
      extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
      payloadMeta: { field_name: body.field_name, css: body.css },
      responseMeta: { ok: false, validation_error: validation.error },
      status: 422, durationMs: Date.now() - startedAt,
      errorMsg: validation.error,
    });
    return NextResponse.json({
      ok: false,
      error: `Selector rejected: ${validation.error}`,
      rejected_css: body.css,
    }, { status: 422 });
  }

  // Infer attr + parse từ schema nếu user không truyền (ext auto-fill từ
  // hint khi mở manual UI, nhưng fallback ở server cho an toàn).
  const schema = getFieldSchema(body.page_kind).find((f) => f.key === body.field_name);
  const parse = body.parse ?? schema?.parse ?? 'none';
  // icon_url default attr=src; created_at default attr=datetime; còn lại textContent.
  let attr = body.attr;
  if (!attr) {
    if (body.field_name === 'icon_url') attr = 'src';
    else if (body.field_name === 'created_at') attr = 'datetime';
    else attr = 'textContent';
  }

  const spec: Record<string, unknown> = { css: body.css, attr, parse };
  if (schema?.enumValues && parse === 'enum') spec.enum_values = schema.enumValues;

  const targetScope = body.target_scope ?? 'platform';
  const targetKey = body.target_key
    ?? (targetScope === 'engine' ? (body.technology_key || '') :
        targetScope === 'habitat' ? String(body.habitat_id || '') :
        body.platform_key);

  if (!targetKey) {
    return NextResponse.json({ ok: false, error: `target_key required for scope ${targetScope}` }, { status: 400 });
  }

  await setOverride({
    scopeKind: targetScope,
    scopeKey: targetKey,
    pageKind: body.page_kind,
    fieldName: body.field_name,
    spec: spec as unknown as Parameters<typeof setOverride>[0]['spec'],
    source: 'manual',
  });

  await logExtCall({
    endpoint: 'save-selector', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: {
      field_name: body.field_name, css: body.css, attr, parse,
      target_scope: targetScope, target_key: targetKey,
    },
    responseMeta: { ok: true, spec },
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    field: body.field_name,
    spec,
    saved_to: { scope: targetScope, key: targetKey },
  });
}
