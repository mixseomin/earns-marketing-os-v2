import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { validateSelector } from '@/lib/selector-validate';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// LLM-suggest selector for picked region.
// Khác /train-selector ở chỗ: train-selector LƯU ngay, suggest-selector chỉ
// đề xuất + trả về để user preview/tweak trong manual panel rồi mới /save-selector.
// Cho phép intent free-form (vd "extract every rule title h2") thay vì field
// schema hint, để user pick 1 vùng rồi yêu cầu rút trích.

interface AnchorEntry {
  tag: string;
  attrs: Record<string, string>;
  signal: string;
  depth: number;
}
interface SuggestReq {
  platform_key: string;
  page_kind: string;
  field_name: string;
  intent?: string;             // free-form yêu cầu (vd "all rule titles")
  kind?: 'css' | 'xpath';
  element_html: string;        // outerHTML element user pick
  parent_html?: string;
  element_text?: string;
  // Ancestors stable (aria-label/role/landmark/heading) — LLM dùng làm
  // gốc selector ổn định thay vì class hash. Array từ closest → root.
  anchor_chain?: AnchorEntry[];
}

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  }

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);
  const body = (await req.json()) as SuggestReq;

  if (!body.platform_key || !body.field_name || !body.element_html) {
    return NextResponse.json({
      ok: false,
      error: 'platform_key + field_name + element_html required',
    }, { status: 400 });
  }

  const kind = body.kind || 'css';
  const intent = body.intent?.trim() || `extract value for field "${body.field_name}"`;

  const sysPrompt = `Bạn là CSS/XPath selector engineer cho ${body.platform_key} ${body.page_kind} page.

Output kind YÊU CẦU: ${kind.toUpperCase()}.
User intent: ${intent}
Field: ${body.field_name}

Nhiệm vụ: sinh ${kind === 'css' ? 'CSS selector' : 'XPath expression'} trỏ tới element(s) phù hợp với intent trong HTML user đã pick.

RULES CHUNG (vi phạm = reject server-side):
1. Selector phải work với ${kind === 'css' ? 'document.querySelectorAll (light DOM hoặc shadow DOM với deep-walker)' : 'document.evaluate (light DOM only)'}.
2. CẤM hardcode subreddit-specific values:
   - Sub IDs: t5_xxxxx
   - Tên subreddit cụ thể (r/AstrologyChartShare, "Astrology Memes"…)
   - URL paths chứa sub name / sub ID
   - Số/hash UUID specific (rule-0bc3856f-…, /rule-xxx-id)
   → Selector phải generic, dùng được cho MỌI subreddit khác.
3. CẤM nth-of-type / nth-child / direct-child chain >3 levels (DOM re-render = vỡ).
4. CẤM class hash random (.css-1abc23d) hoặc utility class chỉ visual (.mt-sm, .px-md có thể OK nếu kết hợp với semantic class).
5. Ưu tiên TUYỆT ĐỐI: custom element tags (faceplate-*, shreddit-*), data-testid, slot, aria-label, semantic class names.
6. Nếu intent yêu cầu MULTI element (vd "all rule titles") → selector phải match tất cả; nếu intent SINGLE → selector unique cho element đó.
${kind === 'css' ? '7. Class BEM phải có dấu chấm trước (.tag.class hoặc .class). :has() OK (Chrome-only runtime).' : `7. XPath patterns ƯU TIÊN cho semantic anchoring:
   - contains(@class, " name ") thay vì equality để khớp khi class multi-token.
   - Anchor block qua heading text: //div[contains(@class,"px-md")][.//h2[contains(.,"Links")]]//a
   - Anchor qua aria-label: //*[@aria-label="Community details"]//...
   - normalize-space() khi match text có thừa whitespace.
   - Tránh absolute path /html/body/div[3] (fragile).
   - Tránh text() equality cứng; dùng contains(., "X") hoặc normalize-space()="X".`}
8. ⚠ ATTR SELECTION (CRITICAL — shadow DOM workaround): Nhiều custom element Reddit/Faceplate lưu data dưới dạng HTML attribute thay vì textContent. Khi element user pick nằm TRONG shadow root của 1 shadow host (vd <shreddit-subreddit-header>), JS không pierce được closed shadow → selector pierce shadow có thể miss. ƯU TIÊN selector trỏ tới shadow host + lấy attr trên đó:
   - <shreddit-subreddit-header description="..." subscribers="239733" weekly-active-users="13287" subreddit-id="t5_..."> → field=description → selector="shreddit-subreddit-header" + attr="description"; field=members → attr="subscribers" parse=number; field=weekly_visitors → attr="weekly-active-users" parse=number.
   - <faceplate-number number="2300"> → attr="number" parse=number (số gốc, không phải text "2.3K").
   - <time datetime="2017-08-14T..."> → attr="datetime" parse=date (date chuẩn, không phải text "Aug 14, 2017").
   → Selector ngoài shadow + attr clean data ƯU TIÊN HƠN selector pierce shadow + textContent. KHÔNG hardcode attr value vào selector (vd CẤM [description="..."]).

Output JSON shape:
{
  "spec": {
    "css": "<${kind === 'css' ? 'css' : 'xpath'} expression>",
    "attr": "textContent" | "src" | "href" | "datetime" | "title" | "description" | "subscribers" | "<bất kỳ attr nào trên element>",
    "parse": "none" | "number" | "number-suffix" | "date" | "enum",
    "notes": "<lý do chọn selector + lý do chọn attr này thay vì textContent>"
  },
  "confidence": <0-100>,
  "expected_count": <số element selector khả năng match — 1 nếu unique, >1 nếu list>
}`;

  // Anchor chain summary cho LLM. Format gốc → element để LLM hiểu
  // descendant relationship + dùng anchor stable làm root cho selector.
  const anchorSummary = Array.isArray(body.anchor_chain) && body.anchor_chain.length > 0
    ? body.anchor_chain.slice().reverse().map((a, i) => {
        const indent = '  '.repeat(i);
        const attrPairs = Object.entries(a.attrs || {})
          .map(([k, v]) => `${k}="${String(v).slice(0, 60)}"`)
          .join(' ');
        return `${indent}└─ <${a.tag}${attrPairs ? ' ' + attrPairs : ''}>  // ${a.signal}`;
      }).join('\n')
    : '';

  const userPrompt = `INTENT: ${intent}

PICKED ELEMENT (outerHTML, có thể là vùng wrap nhiều child cần extract):
\`\`\`html
${body.element_html.slice(0, 12_000)}
\`\`\`
${body.parent_html ? `\nPARENT CONTEXT (3 levels up):\n\`\`\`html\n${body.parent_html.slice(0, 8_000)}\n\`\`\`` : ''}
${body.element_text ? `\nSample text (text user thấy): "${body.element_text.slice(0, 300)}"` : ''}
${anchorSummary ? `\nSTABLE ANCESTORS CHAIN (gốc → element) — dùng làm root cho selector ổn định:\n\`\`\`\n${anchorSummary}\n  └─ <PICKED ELEMENT>\n\`\`\`\nQUAN TRỌNG: ưu tiên xây selector từ 1 ancestor có aria-label / role / data-testid / heading text / landmark tag → descendant tới element. KHÔNG hardcode class hash random (.css-1abc, utility classes Tailwind dài).` : ''}

Sinh ${kind === 'css' ? 'CSS selector' : 'XPath'} thoả intent + rules.`;

  const ai = getOpenAI();
  if (!ai) return NextResponse.json({ ok: false, error: 'OpenAI client unavailable' }, { status: 503 });
  const model = 'gpt-4.1-mini';

  let spec: Record<string, unknown> | null = null;
  let confidence = 0;
  let expectedCount = 0;
  let rawLlm = '';
  try {
    const completion = await ai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    rawLlm = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(rawLlm);
    spec = parsed.spec ?? parsed;
    confidence = Number(parsed.confidence ?? 70);
    expectedCount = Number(parsed.expected_count ?? 1);
  } catch (e) {
    await logExtCall({
      endpoint: 'suggest-selector', method: 'POST',
      extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
      payloadMeta: { field_name: body.field_name, intent, kind, element_html_size: body.element_html.length },
      responseMeta: { raw_llm: rawLlm.slice(0, 500) },
      status: 502, durationMs: Date.now() - startedAt,
      errorMsg: (e as Error).message,
    });
    return NextResponse.json({ ok: false, error: (e as Error).message, raw_llm: rawLlm.slice(0, 500) }, { status: 502 });
  }

  if (!spec || typeof spec.css !== 'string') {
    return NextResponse.json({ ok: false, error: 'LLM no valid spec', raw_llm: rawLlm.slice(0, 500) }, { status: 502 });
  }

  // Validate (CSS = full FORBIDDEN_PATTERNS, XPath = minimal — chỉ sub IDs).
  if (kind === 'css') {
    const v = validateSelector(spec.css as string);
    if (!v.ok) {
      await logExtCall({
        endpoint: 'suggest-selector', method: 'POST',
        extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
        payloadMeta: { field_name: body.field_name, intent, kind },
        responseMeta: { ok: false, css: spec.css, validation_error: v.error, raw_llm: rawLlm.slice(0, 500) },
        status: 422, durationMs: Date.now() - startedAt,
        errorMsg: v.error,
      });
      return NextResponse.json({
        ok: false,
        error: `Selector rejected: ${v.error}`,
        rejected_css: spec.css,
        raw_llm: rawLlm.slice(0, 500),
      }, { status: 422 });
    }
  } else {
    const xp = spec.css as string;
    if (/\bt5_[a-z0-9]+/i.test(xp) || /styles\.redditmedia\.com\/t5_/i.test(xp)) {
      return NextResponse.json({
        ok: false,
        error: 'XPath chứa sub ID t5_xxx (Reddit-specific)',
        rejected_css: xp,
      }, { status: 422 });
    }
  }

  await logExtCall({
    endpoint: 'suggest-selector', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: {
      field_name: body.field_name, intent, kind,
      element_html_size: body.element_html.length,
    },
    responseMeta: {
      ok: true, css: spec.css, attr: spec.attr, parse: spec.parse,
      confidence, expected_count: expectedCount,
      raw_llm: rawLlm.slice(0, 500), model,
    },
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    field: body.field_name,
    kind,
    spec,                  // KHÔNG save — ext sẽ preview rồi user mới /save-selector
    confidence,
    expected_count: expectedCount,
    model,
  });
}
