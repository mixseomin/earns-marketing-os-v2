import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { resolveSelectors, resolveSelectorsForHabitat, setMap, type SelectorSpec, type SelectorMap } from '@/lib/actions/habitat-selectors';
import { getFieldHint } from '@/lib/habitat-field-schema';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { validateSelector } from '@/lib/selector-validate';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// LLM = SELECTOR DISCOVERY, không phải DATA EXTRACTION.
// 3-tier inheritance (mig 0061): habitat > platform > engine.

interface LearnReq {
  platform_key: string;
  page_kind: string;
  fields: string[];                       // ['members', 'weekly_visitors', ...]
  html: string;
  habitat_id?: number;                    // optional - nếu có sẽ check habitat scope
  technology_key?: string;                // optional - engine fallback (vbulletin, xenforo)
  detected_engine?: string;               // ext sniff engine markers (shreddit, discourse)
  target_scope?: 'engine' | 'platform' | 'habitat';  // default 'platform'
  target_key?: string;                    // override scope_key (vd habitat_id)
}

// FIELD_HINTS centralized ở @/lib/habitat-field-schema. Endpoint chỉ
// dùng getFieldHint() bên dưới khi build LLM prompt.

// GET /api/ext/learn-selectors?platform_key=reddit&page_kind=subreddit-about
//   &habitat_id=6&technology_key=shreddit (optional cho cascade)
// → trả về resolved map + source-of-truth per field.
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const platformKey = searchParams.get('platform_key');
  const pageKind = searchParams.get('page_kind');
  const habitatIdRaw = searchParams.get('habitat_id');
  const technologyKey = searchParams.get('technology_key');

  if (!pageKind || (!platformKey && !habitatIdRaw && !technologyKey)) {
    return errorResponse('page_kind + at least one of platform_key/habitat_id/technology_key required', 400);
  }

  // Nếu chỉ có habitat_id → resolve via lookup (auto derive platform+tech).
  let resolved;
  if (habitatIdRaw && !platformKey && !technologyKey) {
    const r = await resolveSelectorsForHabitat(Number(habitatIdRaw), pageKind);
    resolved = r.resolved;
  } else {
    resolved = await resolveSelectors({
      habitatId: habitatIdRaw ? Number(habitatIdRaw) : null,
      platformKey,
      technologyKey,
      pageKind,
    });
  }

  // Back-compat: ext v1.4.13 expect shape { ok, selectors: {field: spec}, updated_at }.
  // New shape thêm `sources: {field: {scope, key, source, updated_at}}`.
  const selectors: SelectorMap = {};
  const sources: Record<string, ResolvedField['source']> = {};
  let mostRecent: string | null = null;
  for (const [field, rf] of Object.entries(resolved)) {
    selectors[field] = rf.spec;
    sources[field] = rf.source;
    if (!mostRecent || rf.source.updated_at > mostRecent) mostRecent = rf.source.updated_at;
  }

  return NextResponse.json({
    ok: true,
    selectors: Object.keys(selectors).length > 0 ? selectors : null,
    sources,
    updated_at: mostRecent,
  });
}

// POST: LLM discover selectors → lưu vào target_scope (default platform).
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!aiEnabled()) {
    return errorResponse('OPENAI_API_KEY not set', 503);
  }

  const body = (await req.json()) as LearnReq;
  if (!body.html || !body.platform_key || !body.page_kind || !body.fields?.length) {
    return errorResponse('platform_key + page_kind + fields[] + html required', 400);
  }

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);
  // v1.4.17+: tăng 100KB → 200KB. Reddit page full ~500KB-1MB, 100KB
  // miss description + icon_url section. 200KB cover header + sidebar.
  // gpt-4.1-mini context 1M tokens, dư sức xử lý ~50k tokens HTML.
  const html = body.html.slice(0, 200_000);
  const fieldsList = body.fields
    .map((f) => `- "${f}": ${getFieldHint(body.page_kind, f)}`)
    .join('\n');

  // Engine detection note injected vào prompt nếu có (giúp LLM ưu tiên
  // selector chứa engine marker).
  const engineHint = body.detected_engine
    ? `\nEngine detected: ${body.detected_engine}. Ưu tiên selectors generic engine (vd 'shreddit-*' cho Reddit, '.vbulletin-*' cho vBulletin).`
    : '';

  const sysPrompt = `Bạn là CSS selector discovery agent cho ${body.platform_key} ${body.page_kind} page. User gửi FULL document.body của page Reddit → bạn phải:
  STEP 1: LOCATE panel "About community" trong HTML (Reddit có nhiều aside: Promotion/Right-rail/About — chỉ pick About).
  STEP 2: Cho mỗi field trong list, sinh CSS selector STABLE trỏ trực tiếp tới element chứa data.

Selector STABLE = ưu tiên: data-testid, aria-label, faceplate-*, shreddit-*, semantic tags. Tránh: class hash random (vd ".css-1abc23d"), nth-child, deep descendant.${engineHint}

Field cần discover:
${fieldsList}

REDDIT 2026 PATTERNS đã verify:
- About panel thường wrap trong <shreddit-subreddit-about> hoặc <aside aria-label="Community Details"> hoặc <faceplate-tracker source="community_widget">
- "2K Members" → text trong <faceplate-number number="2000"> bên trong about panel
- "Created Aug 14, 2017" → <time datetime="2017-08-14T...">
- Privacy "Public"/"Private community" → span/li/text trong about panel cạnh icon globe/lock

CẢNH BÁO 2 FIELDS NÀY HAY BỊ MISS — phải scope RỘNG HƠN shreddit-subreddit-about:
- description: paragraph mô tả SỞ TRƯỜNG community (vd "All Things Astrology Charts!" / "A subreddit for sharing natal charts...").
  ⚠ CẤM TUYỆT ĐỐI nhầm với:
    - Privacy hint: "Anyone can view, post, and comment to this community" (đó là privacy text, không phải description)
    - Subscriber count tooltip: "2K members"
    - Generic Reddit footer text
  Description thật: thường là 1 đoạn 50-500 chars, mô tả CHỦ ĐỀ/PURPOSE sub.
  Có thể ở:
    (a) <h2> trong about + <p> kế bên chứa "All Things X!" → wrapper id="description" hoặc data-testid="subreddit-description"
    (b) <shreddit-subreddit-header> tag (separate)
    (c) <faceplate-screen-reader-content> mô tả for accessibility
  → Selector ưu tiên: [data-testid='subreddit-description'], shreddit-subreddit-header p, shreddit-subreddit-about h2 + p.
  → KHÔNG dùng 'shreddit-subreddit-about p:first-child' vì sẽ bắt privacy hint.
- icon_url: subreddit icon image (NOT user avatar, NOT banner). Có thể ở 3 chỗ:
  (a) <shreddit-subreddit-icon> wrapping <img src="...">
  (b) <faceplate-img> trong header có src styles.redditmedia.com hoặc redditstatic
  (c) <img alt*="r/<sub>"> trong header
  → Selector ưu tiên: shreddit-subreddit-icon img. Fallback: img[alt*='r/' i][src*='redditmedia'].
  → Attr LUÔN PHẢI là "src" (không phải textContent).

OUTPUT JSON shape:
{"selectors": {"members": {"css": "<selector>", "attr": "textContent"|"src"|"datetime"|"number", "parse": "number-suffix"|"date"|"enum", "enum_values": [...], "notes": "..."}, ...}}

RULES:
1. NEVER return {} nếu HTML có About panel với data. Trả best-guess selector với notes "low confidence".
2. Nếu HTML KHÔNG có About panel (vd captcha page, login wall, full body chỉ có header) → trả {"selectors": {}, "html_empty": true, "reason": "..."}.
3. Selector phải work với document.querySelector. KHÔNG dùng jQuery/contains/has.
4. Test trong đầu: selector này select element nào trong HTML user gửi? Nếu không chắc chắn → bỏ field.
5. CẤM TUYỆT ĐỐI: nth-of-type, nth-child, > direct-child chains dài (>3 levels). Reddit re-render thay đổi DOM order liên tục → selectors này break ngay tuần sau.
6. CẤM cross-field aliasing: nếu css 'faceplate-timeago' trỏ tới element TIME, KHÔNG được dùng cho field 'members' (số). Verify SEMANTIC match (members = number element, created_at = time element, description = paragraph element). Members ≠ weekly_visitors ≠ weekly_contributions (3 số riêng biệt).
7. ⚠ CẤM TUYỆT ĐỐI hardcode subreddit-specific values:
   - Sub IDs: t5_xxxxx (vd t5_3nnef CHỈ cho 1 sub)
   - Subreddit names trong selector: /r/AstrologyChartShare, [href*="AstrologyChart"]
   - URL paths: src^='https://styles.redditmedia.com/t5_xxx/...'
   → Selector PHẢI generic cho mọi r/X. Test: "Selector này work cho r/A, r/B, r/anything?"
8. CẤM :has() pseudo (Safari <15.4 không support).
9. Ưu tiên TUYỆT ĐỐI: data-testid, aria-label, slot, semantic tag names (faceplate-number, faceplate-timeago, shreddit-subreddit-icon). Tránh parent chains dài.
10. ⚠ Class selector LUÔN có dấu chấm "." trước: ".shreddit-subreddit-icon__icon" hoặc "img.shreddit-subreddit-icon__icon" — KHÔNG được "shreddit-subreddit-icon__icon" (cái này là tag selector, sẽ search custom element không tồn tại).`;

  const ai = getOpenAI();
  if (!ai) return errorResponse('OpenAI client unavailable', 503);
  const model = 'gpt-4.1-mini';

  let selectors: SelectorMap = {};
  let rawLlmResponse = '';
  let htmlEmpty = false;
  try {
    const completion = await ai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: `HTML (${html.length} chars):\n\`\`\`html\n${html}\n\`\`\`` },
      ],
    });
    rawLlmResponse = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(rawLlmResponse);
    selectors = parsed.selectors ?? parsed;
    htmlEmpty = parsed.html_empty === true;
  } catch (e) {
    await logExtCall({
      endpoint: 'learn-selectors', method: 'POST',
      extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
      payloadMeta: {
        platform_key: body.platform_key, page_kind: body.page_kind,
        fields: body.fields, html_size: body.html.length,
        html_preview: body.html.slice(0, 200),
        detected_engine: body.detected_engine,
      },
      responseMeta: { raw_llm: rawLlmResponse.slice(0, 500) },
      status: 502, durationMs: Date.now() - startedAt,
      errorMsg: (e as Error).message,
    });
    return errorResponse((e as Error).message, 502, { model, raw_llm: rawLlmResponse.slice(0, 500) });
  }

  // Default scope = platform (broadest). Ext có thể override gửi 'habitat'
  // nếu muốn site-specific (chưa wire). Engine tier reserved cho future
  // (cần technologyKey + LLM phải detect engine-generic selectors).
  const targetScope = body.target_scope ?? 'platform';
  const targetKey = body.target_key
    ?? (targetScope === 'engine' ? (body.technology_key || '') :
        targetScope === 'habitat' ? String(body.habitat_id || '') :
        body.platform_key);

  if (!targetKey) {
    return errorResponse(`target_key required for scope ${targetScope}`, 400, { selectors, model });
  }

  // Validate từng selector trước khi save - reject bad ones.
  const validSelectors: SelectorMap = {};
  const rejected: Array<{ field: string; css: string; reason: string }> = [];
  for (const [field, spec] of Object.entries(selectors)) {
    const v = validateSelector(spec.css);
    if (v.ok) validSelectors[field] = spec;
    else rejected.push({ field, css: spec.css, reason: v.error || 'unknown' });
  }

  const save = await setMap({
    scopeKind: targetScope,
    scopeKey: targetKey,
    pageKind: body.page_kind,
    selectors: validSelectors,
    source: 'llm',
  });

  // Log success — selectors_count = 0 = LLM trả {} = signal cần debug
  await logExtCall({
    endpoint: 'learn-selectors', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: {
      platform_key: body.platform_key, page_kind: body.page_kind,
      fields: body.fields, html_size: body.html.length,
      html_preview: body.html.slice(0, 500),
      detected_engine: body.detected_engine,
      target_scope: targetScope, target_key: targetKey,
    },
    responseMeta: {
      ok: true,
      selectors_count: Object.keys(selectors).length,
      valid_count: Object.keys(validSelectors).length,
      rejected_count: rejected.length,
      rejected,
      selectors_keys: Object.keys(validSelectors),
      html_empty: htmlEmpty,
      raw_llm: rawLlmResponse.slice(0, 500),
      saved: save.saved,
      skipped: save.skipped,  // skipped vì spec đã có source='manual'
      model,
    },
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    selectors: validSelectors,
    rejected,
    model,
    saved_to: { scope: targetScope, key: targetKey, count: save.saved, skipped_manual: save.skipped },
  });
}

// Local type alias to avoid leaking ResolvedField from action; we only
// need the shape `source` object inline.
interface ResolvedField {
  source: { scope: string; key: string; source: string; updated_at: string };
}
