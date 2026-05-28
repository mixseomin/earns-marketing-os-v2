import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { setOverride } from '@/lib/actions/habitat-selectors';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { getFieldSchema } from '@/lib/habitat-field-schema';
import { getBriefFieldSchema, parseBriefFieldName } from '@/lib/brief-field-schema';
import { getViewerFieldSchema, parseViewerFieldName } from '@/lib/viewer-field-schema';
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
  kind?: 'css' | 'xpath';
  attr?: string;
  parse?: string;
  target_scope?: 'engine' | 'platform' | 'habitat';
  target_key?: string;
  habitat_id?: number;
  technology_key?: string;
  // User-defined post-extract transform — chạy trên raw value trước parse.
  // 2 modes:
  //   - single: transform_regex (+ optional transform_replace)
  //   - chain: transform_chain = [{rx, rp}, ...] apply tuần tự
  transform_regex?: string;
  transform_replace?: string;
  transform_chain?: Array<{ rx: string; rp?: string }>;
}

// Minimal XPath validation — chỉ check non-empty + reject ID t5_xxx
// (Reddit-specific sub IDs vẫn không stable cho dù CSS hay XPath).
function validateXPath(xpath: string): { ok: boolean; error?: string } {
  if (!xpath || typeof xpath !== 'string') return { ok: false, error: 'xpath empty' };
  const trimmed = xpath.trim();
  if (trimmed.length < 2) return { ok: false, error: 'xpath quá ngắn' };
  if (trimmed.length > 500) return { ok: false, error: 'xpath quá dài' };
  if (/\bt5_[a-z0-9]+/i.test(trimmed)) return { ok: false, error: 'Sub ID t5_xxx (Reddit-specific)' };
  if (/styles\.redditmedia\.com\/t5_/i.test(trimmed)) return { ok: false, error: 'Reddit CDN path chứa sub ID' };
  return { ok: true };
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

  const kind = body.kind || 'css';
  const validation = kind === 'xpath' ? validateXPath(body.css) : validateSelector(body.css);
  if (!validation.ok) {
    await logExtCall({
      endpoint: 'save-selector', method: 'POST',
      extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
      payloadMeta: { field_name: body.field_name, css: body.css, kind },
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

  // Infer attr + parse từ schema nếu user không truyền. 3 prefixes:
  //  - "brief.<key>" → brief schema (per-habitat-per-account)
  //  - "viewer.<key>" → viewer schema (per-platform, page_kind='platform-any')
  //  - "<key>" → habitat schema (per-habitat per page_kind)
  const briefKey = parseBriefFieldName(body.field_name);
  const viewerKey = parseViewerFieldName(body.field_name);
  const schema = briefKey
    ? getBriefFieldSchema(body.page_kind).find((f) => f.key === briefKey)
    : viewerKey
    ? getViewerFieldSchema('platform-any').find((f) => f.key === viewerKey)
    : getFieldSchema(body.page_kind).find((f) => f.key === body.field_name);
  const parse = body.parse ?? schema?.parse ?? 'none';
  // icon_url default attr=src; created_at default attr=datetime; còn lại textContent.
  let attr = body.attr;
  if (!attr) {
    if (body.field_name === 'icon_url') attr = 'src';
    else if (body.field_name === 'created_at') attr = 'datetime';
    else attr = 'textContent';
  }

  const spec: Record<string, unknown> = { css: body.css, attr, parse, kind };
  if (schema?.enumValues && parse === 'enum') spec.enum_values = schema.enumValues;
  // Persist user transform — chain ưu tiên nếu có (multi-step), fallback
  // single regex/replace. Consumer (applySelector) handle cả 2 modes.
  if (Array.isArray(body.transform_chain) && body.transform_chain.length > 0) {
    spec.transform_chain = body.transform_chain;
  } else {
    if (body.transform_regex) spec.transform_regex = body.transform_regex;
    if (body.transform_replace != null) spec.transform_replace = body.transform_replace;
  }

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
