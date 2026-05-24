import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { getDb, knowledgeItems } from '@mos2/db';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// LLM = SELECTOR DISCOVERY, không phải DATA EXTRACTION (user feedback).
//
// Flow:
//   1. Ext POST sidebar HTML + missing fields (vd ['members', 'weekly_visitors'])
//   2. Server gọi gpt-4.1-mini → trả về CSS selectors map cho từng field
//   3. Lưu selectors vào knowledge_items (title='ext-habitat-selectors-{key}')
//      qua existing endpoint /api/ext/platform-fields pattern
//   4. Ext apply selectors local mỗi lần sau → 0 LLM call
//   5. Khi Reddit redesign → ext query selectors → applied trả null →
//      ext fallback POST HTML lại → update selectors
//
// Cost: ~$0.001 per Reddit redesign (vài tháng/lần), không phải per page.

interface LearnReq {
  platform_key: string;        // 'reddit'
  page_kind: string;           // 'subreddit-about'
  fields: string[];            // ['members', 'weekly_visitors', 'privacy', 'created_at']
  html: string;                // raw sidebar HTML
}

interface LearnResp {
  ok: boolean;
  selectors?: Record<string, SelectorSpec>;
  error?: string;
  model?: string;
}

interface SelectorSpec {
  css: string;                     // CSS selector
  attr?: string;                   // attribute to extract ('textContent' default, 'src', 'datetime', 'number')
  parse?: 'number' | 'date' | 'number-suffix' | 'enum';  // post-process hint
  enum_values?: string[];          // for parse=enum
  notes?: string;                  // why this selector
}

const FIELD_HINTS: Record<string, string> = {
  members: 'Tổng số subscribers/members ("2.3K Members" → 2300). parse=number-suffix.',
  weekly_visitors: 'Weekly unique visitors ("2K Weekly visitors"). parse=number-suffix.',
  weekly_contributions: 'Weekly posts+comments ("280 Weekly contributions"). parse=number-suffix.',
  privacy: 'Community type: "public" | "restricted" | "private". parse=enum.',
  created_at: 'Date community được tạo (vd "Created Aug 14, 2017" hoặc <time datetime>). parse=date.',
  description: 'Mô tả community (paragraph). attr=textContent.',
  icon_url: 'Subreddit icon image URL. attr=src.',
};

const SELECTOR_KEY = (platform: string, pageKind: string) =>
  `ext-habitat-selectors-${platform}-${pageKind}`;

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  }

  const body = (await req.json()) as LearnReq;
  if (!body.html || !body.platform_key || !body.page_kind || !body.fields?.length) {
    return NextResponse.json({ ok: false, error: 'platform_key + page_kind + fields[] + html required' }, { status: 400 });
  }

  const html = body.html.slice(0, 30_000);

  const fieldsList = body.fields
    .map((f) => `- "${f}": ${FIELD_HINTS[f] ?? 'extract value'}`)
    .join('\n');

  const sysPrompt = `Bạn là CSS selector discovery agent. Cho HTML của ${body.platform_key} ${body.page_kind} page, sinh CSS selectors STABLE (ưu tiên data-testid, faceplate-*, shreddit-*, semantic tags; tránh class hash random).

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
- Nếu KHÔNG tìm được field trong HTML → bỏ field đó khỏi selectors map (KHÔNG return null).
- CSS phải work với document.querySelector (no jQuery, no :contains).
- Cho "number-suffix": ext sẽ tự parse "2K" → 2000 sau khi extract textContent.
- Cho "enum" privacy: ext check textContent.toLowerCase() match enum_values[i].`;

  const ai = getOpenAI();
  if (!ai) return NextResponse.json({ ok: false, error: 'OpenAI client unavailable' }, { status: 503 });
  const model = 'gpt-4.1-mini';

  let selectors: Record<string, SelectorSpec> = {};
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
    selectors = parsed.selectors ?? parsed;  // accept both wrapped + unwrapped
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, model } satisfies LearnResp, { status: 502 });
  }

  // Persist selectors vào knowledge_items (reuse pattern endpoint platform-fields).
  // Title key = SELECTOR_KEY → unique per (platform, page_kind).
  const db = getDb();
  if (db) {
    const title = SELECTOR_KEY(body.platform_key, body.page_kind);
    const content = JSON.stringify(selectors, null, 2);
    try {
      const [existing] = await db
        .select({ id: knowledgeItems.id })
        .from(knowledgeItems)
        .where(and(eq(knowledgeItems.title, title), eq(knowledgeItems.kind, 'template')))
        .limit(1);
      if (existing) {
        await db.update(knowledgeItems)
          .set({ content, updatedAt: new Date() })
          .where(eq(knowledgeItems.id, existing.id));
      } else {
        await db.insert(knowledgeItems).values({
          kind: 'template',
          title,
          content,
          tags: ['ext', 'habitat-selectors', body.platform_key, body.page_kind],
        });
      }
    } catch (e) {
      console.warn('[learn-selectors] persist failed:', e);
    }
  }

  return NextResponse.json({ ok: true, selectors, model } satisfies LearnResp);
}

// GET /api/ext/learn-selectors?platform_key=reddit&page_kind=subreddit-about
//   → return saved selectors (ext fetch trước, apply local, không cần LLM).
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const platformKey = searchParams.get('platform_key');
  const pageKind = searchParams.get('page_kind');
  if (!platformKey || !pageKind) {
    return NextResponse.json({ ok: false, error: 'platform_key + page_kind required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: true, selectors: null });

  const title = SELECTOR_KEY(platformKey, pageKind);
  const [row] = await db
    .select({ content: knowledgeItems.content, updatedAt: knowledgeItems.updatedAt })
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.title, title), eq(knowledgeItems.kind, 'template')))
    .limit(1);

  if (!row) return NextResponse.json({ ok: true, selectors: null });

  let selectors: Record<string, SelectorSpec> | null = null;
  try { selectors = JSON.parse(row.content); } catch { selectors = null; }

  return NextResponse.json({
    ok: true,
    selectors,
    updated_at: row.updatedAt,
  });
}
