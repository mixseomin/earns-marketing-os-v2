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
    fields = getFieldSchema(pageKind).map((f) => f.key);          // ext gửi page_kind ĐÃ BIẾT → field từ schema (0 LLM)
  } else {
    // Tự phân loại trang THẬT của platform này (KHÔNG ép vào kind Reddit) + đọc field thực tế trên trang.
    const cls = await classify(html, platformKey);
    if (!pageKind) pageKind = cls.pageKind;
    // Ưu tiên field AI đọc được trên trang; chỉ fallback schema nếu trùng đúng known-kind mà AI ko trả field.
    fields = cls.fields.length ? cls.fields : getFieldSchema(pageKind).map((f) => f.key);
  }
  if (!fields.length) return errorResponse('Không đọc được field nào trên trang — thử trang có nội dung (profile/feed/thread/about)', 422, { pageKind });

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
  const sys = `Bạn phân loại MỘT trang web của platform "${platformKey}" và liệt kê field dữ liệu THỰC SỰ HIỂN THỊ trên trang đó (đọc HTML, đừng đoán).

page_kind = tên ngắn kebab-case mô tả ĐÚNG loại trang. Ví dụ generic: profile, feed, post, thread, composer, signup, community-about, member-list, settings.
⚠ CHỈ dùng tên "subreddit-*" khi platform THẬT SỰ là Reddit. "${platformKey}" KHÁC Reddit thì TUYỆT ĐỐI không trả subreddit-*; đặt tên hợp với chính platform này (vd dev.to profile → "profile").
Known-kind có schema sẵn (dùng LẠI nếu trang đúng loại): ${KNOWN_KINDS.join(', ')}.

fields = danh sách field CÓ TRÊN TRANG NÀY (theo HTML thực tế), tên ngắn snake/dot-case. Ví dụ tùy trang: display_name, bio, followers, following, post_count, joined_date, post.title, post.author, post.body, post.permalink, composer.editor, composer.postBtn. KHÔNG bịa field không có trên trang.

Trả JSON {"page_kind":"...","fields":["..."]}.`;
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
