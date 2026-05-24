import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { setOverride } from '@/lib/actions/habitat-selectors';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { getFieldSchema } from '@/lib/habitat-field-schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// HUMAN-ASSISTED SELECTOR TRAINING
//
// User flow:
//   1. User mở subreddit page, bật ext "Train mode"
//   2. Click element trên page (vd paragraph "All Things Astrology Charts!")
//   3. Chọn field tương ứng (vd "description")
//   4. Ext POST endpoint này với:
//      - element_html: outerHTML của element user click
//      - parent_html: outerHTML wrap 3 cấp cha (cho context selector chain)
//      - element_text: textContent đầu của element (sample)
//      - field_name: 'description'
//      - platform_key + page_kind + target_scope (default 'platform')
//   5. LLM nhận: "Đây CHÍNH XÁC là element user tag là <field>. Sinh CSS
//      selector STABLE trỏ tới element này từ document root."
//   6. Save vào selector_overrides source='trained' (priority cao hơn 'llm').

interface TrainReq {
  platform_key: string;
  page_kind: string;
  field_name: string;
  element_html: string;        // outerHTML element user click
  parent_html?: string;        // wrap 3-cấp parent for context
  element_text?: string;       // sample text để LLM verify
  target_scope?: 'engine' | 'platform' | 'habitat';
  target_key?: string;
  habitat_id?: number;
  technology_key?: string;
}

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  }

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);
  const body = (await req.json()) as TrainReq;

  if (!body.platform_key || !body.page_kind || !body.field_name || !body.element_html) {
    return NextResponse.json({
      ok: false,
      error: 'platform_key + page_kind + field_name + element_html required',
    }, { status: 400 });
  }

  // Field hint từ schema (helps LLM verify semantic match)
  const schema = getFieldSchema(body.page_kind).find((f) => f.key === body.field_name);
  const fieldHint = schema?.hint ?? 'extract value';
  const parseHint = schema?.parse;

  const sysPrompt = `Bạn nhận element HTML mà user ĐÃ TAG là field "${body.field_name}" trên ${body.platform_key} ${body.page_kind} page.

Field meaning: ${fieldHint}
${parseHint ? `Expected parse type: ${parseHint}` : ''}

Nhiệm vụ: sinh CSS selector STABLE trỏ ĐÚNG tới element user đã tag (NOT element khác giống nhau).

RULES:
1. Selector phải work với document.querySelector từ document root.
2. Ưu tiên TUYỆT ĐỐI: data-testid, aria-label, id, slot, semantic tag names (faceplate-number, shreddit-subreddit-icon).
3. CẤM nth-of-type / nth-child / direct-child chains >3 levels (re-render = break).
4. KHÔNG dùng class hash random (.css-1abc23d).
5. Selector PHẢI specific đủ để KHÔNG bắt nhầm element khác cùng platform (vd nếu element là <p> đầu trong sidebar, selector "p" sẽ bắt mọi <p> trên page → SAI).

Output JSON shape:
{
  "spec": {
    "css": "<selector>",
    "attr": "textContent" | "src" | "datetime" | "number" | "<attr-name>",
    "parse": "${parseHint ?? 'none'}",
    "notes": "<lý do chọn selector>"
  },
  "confidence": <0-100>
}`;

  const userPrompt = `ELEMENT user clicked (outerHTML):
\`\`\`html
${body.element_html.slice(0, 5000)}
\`\`\`
${body.parent_html ? `\nPARENT CONTEXT (3 levels up):\n\`\`\`html\n${body.parent_html.slice(0, 15_000)}\n\`\`\`` : ''}
${body.element_text ? `\nSample text content: "${body.element_text.slice(0, 200)}"` : ''}

Sinh selector trỏ chính xác element này.`;

  const ai = getOpenAI();
  if (!ai) return NextResponse.json({ ok: false, error: 'OpenAI client unavailable' }, { status: 503 });
  const model = 'gpt-4.1-mini';

  let spec: Record<string, unknown> | null = null;
  let confidence = 0;
  let rawLlm = '';
  try {
    const completion = await ai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    rawLlm = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(rawLlm);
    spec = parsed.spec ?? parsed;
    confidence = Number(parsed.confidence ?? 80);
  } catch (e) {
    await logExtCall({
      endpoint: 'train-selector', method: 'POST',
      extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
      payloadMeta: { field_name: body.field_name, element_html_size: body.element_html.length },
      responseMeta: { raw_llm: rawLlm.slice(0, 500) },
      status: 502, durationMs: Date.now() - startedAt,
      errorMsg: (e as Error).message,
    });
    return NextResponse.json({ ok: false, error: (e as Error).message, raw_llm: rawLlm.slice(0, 500) }, { status: 502 });
  }

  if (!spec || typeof spec.css !== 'string') {
    return NextResponse.json({ ok: false, error: 'LLM returned no valid spec', raw_llm: rawLlm.slice(0, 500) }, { status: 502 });
  }

  // Save - source='trained' priority cao hơn 'llm' (user explicitly tag).
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
    source: 'manual',  // user-trained = manual priority
  });

  await logExtCall({
    endpoint: 'train-selector', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: {
      field_name: body.field_name,
      element_html_size: body.element_html.length,
      parent_html_size: body.parent_html?.length ?? 0,
      element_text: body.element_text?.slice(0, 100),
      target_scope: targetScope, target_key: targetKey,
    },
    responseMeta: {
      ok: true, css: spec.css, confidence,
      raw_llm: rawLlm.slice(0, 500), model,
    },
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    field: body.field_name,
    spec,
    confidence,
    saved_to: { scope: targetScope, key: targetKey },
    model,
  });
}
