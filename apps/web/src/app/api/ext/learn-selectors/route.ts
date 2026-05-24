import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { resolveSelectors, resolveSelectorsForHabitat, setMap, type SelectorSpec, type SelectorMap } from '@/lib/actions/habitat-selectors';
import { getFieldHint } from '@/lib/habitat-field-schema';

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
    return NextResponse.json({
      ok: false,
      error: 'page_kind + at least one of platform_key/habitat_id/technology_key required',
    }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  }

  const body = (await req.json()) as LearnReq;
  if (!body.html || !body.platform_key || !body.page_kind || !body.fields?.length) {
    return NextResponse.json({
      ok: false, error: 'platform_key + page_kind + fields[] + html required',
    }, { status: 400 });
  }

  const html = body.html.slice(0, 30_000);
  const fieldsList = body.fields
    .map((f) => `- "${f}": ${getFieldHint(body.page_kind, f)}`)
    .join('\n');

  // Engine detection note injected vào prompt nếu có (giúp LLM ưu tiên
  // selector chứa engine marker).
  const engineHint = body.detected_engine
    ? `\nEngine detected: ${body.detected_engine}. Ưu tiên selectors generic engine (vd 'shreddit-*' cho Reddit, '.vbulletin-*' cho vBulletin).`
    : '';

  const sysPrompt = `Bạn là CSS selector discovery agent. Cho HTML của ${body.platform_key} ${body.page_kind} page, sinh CSS selectors STABLE (ưu tiên data-testid, faceplate-*, shreddit-*, semantic tags; tránh class hash random).${engineHint}

Trả về JSON CHỈ với shape:
{
  "selectors": {
    "<fieldName>": {
      "css": "<css selector>",
      "attr": "textContent" | "src" | "datetime" | "number" (optional, default textContent),
      "parse": "number" | "date" | "number-suffix" | "enum" (optional),
      "enum_values": ["public","restricted","private"] (chỉ khi parse=enum),
      "notes": "<1 dòng giải thích chọn selector này>"
    }
  }
}

Fields cần tìm:
${fieldsList}

QUAN TRỌNG:
- Nếu KHÔNG tìm được field → bỏ field khỏi map (KHÔNG return null).
- CSS phải work với document.querySelector (no jQuery, no :contains).
- Cho "number-suffix": ext sẽ tự parse "2K" → 2000.`;

  const ai = getOpenAI();
  if (!ai) return NextResponse.json({ ok: false, error: 'OpenAI client unavailable' }, { status: 503 });
  const model = 'gpt-4.1-mini';

  let selectors: SelectorMap = {};
  try {
    const completion = await ai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: `HTML:\n\`\`\`html\n${html}\n\`\`\`` },
      ],
    });
    const txt = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(txt);
    selectors = parsed.selectors ?? parsed;
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, model }, { status: 502 });
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
    return NextResponse.json({ ok: false, error: `target_key required for scope ${targetScope}`, selectors, model }, { status: 400 });
  }

  const save = await setMap({
    scopeKind: targetScope,
    scopeKey: targetKey,
    pageKind: body.page_kind,
    selectors,
    source: 'llm',
  });

  return NextResponse.json({
    ok: true,
    selectors,
    model,
    saved_to: { scope: targetScope, key: targetKey, count: save.saved },
  });
}

// Local type alias to avoid leaking ResolvedField from action; we only
// need the shape `source` object inline.
interface ResolvedField {
  source: { scope: string; key: string; source: string; updated_at: string };
}
