import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { aiEnabled, getOpenAI } from '@/lib/ai/openai';
import { getFieldSchema, FIELD_SCHEMAS } from '@/lib/habitat-field-schema';
import { discoverSelectors } from '@/lib/ai/selector-discovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const KNOWN_KINDS = Object.keys(FIELD_SCHEMAS);

// Orchestrator 1-click: HTML 1 trang → tự nhận page_kind + tự suy field + sinh selector → ĐỀ XUẤT (chưa lưu).
// Ext review thẻ rồi gọi /adapter/apply để ghi. Admin-only (STAFF_DENY chặn staff token).
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const platformKey = String(body.platformKey ?? '').trim();
  const html = String(body.html ?? '');
  const detectedEngine = body.detectedEngine ? String(body.detectedEngine) : undefined;
  if (!platformKey || !html) return errorResponse('platformKey + html required', 400);

  let pageKind = String(body.pageKind ?? '').trim();
  let fields: string[] = [];

  if (pageKind && getFieldSchema(pageKind).length) {
    fields = getFieldSchema(pageKind).map((f) => f.key);          // page_kind đã biết → field từ schema (0 LLM)
  } else {
    const cls = await classify(html, platformKey);                // page_kind lạ → 1 LLM call phân loại + suy field
    if (!pageKind) pageKind = cls.pageKind;
    fields = getFieldSchema(pageKind).length ? getFieldSchema(pageKind).map((f) => f.key) : cls.fields;
  }
  if (!fields.length) return errorResponse('Không suy được field — thử trang about/composer/thread-list', 422, { pageKind });

  const r = await discoverSelectors({ platformKey, pageKind, fields, html, detectedEngine });
  return NextResponse.json({
    ok: true,
    pageKind,
    scope: 'platform',
    scopeKey: platformKey,
    fields,
    selectors: r.selectors,
    rejected: r.rejected,
    missing: fields.filter((f) => !r.selectors[f]),
    htmlEmpty: r.htmlEmpty,
    model: r.model,
  });
}

async function classify(html: string, platformKey: string): Promise<{ pageKind: string; fields: string[] }> {
  const ai = getOpenAI();
  if (!ai) return { pageKind: 'unknown', fields: [] };
  const sys = `Phân loại trang web của platform "${platformKey}" + liệt kê field hữu ích để scrape.
page_kind ưu tiên 1 trong: ${KNOWN_KINDS.join(', ')}; không khớp thì đặt tên mới ngắn (kebab-case).
Trả JSON {"page_kind":"...","fields":["..."]}. fields = tên ngắn cho dữ liệu CHÍNH trên trang
(vd: title, members, description, privacy, post.body, post.author, post.permalink, composer.editor, composer.postBtn).`;
  try {
    const c = await ai.chat.completions.create({
      model: 'gpt-4.1-mini', temperature: 0, max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: html.slice(0, 40_000) }],
    });
    const p = JSON.parse(c.choices[0]?.message?.content || '{}');
    return { pageKind: String(p.page_kind || 'unknown'), fields: Array.isArray(p.fields) ? p.fields.map(String) : [] };
  } catch { return { pageKind: 'unknown', fields: [] }; }
}
