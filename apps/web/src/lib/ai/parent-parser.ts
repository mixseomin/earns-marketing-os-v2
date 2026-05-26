'use server';

// parseParentContext — LLM extract title/body/author/snippets từ raw paste
// (HTML hoặc plain text user copy từ thread/post page).
//
// Use case: user mở Reddit thread → Ctrl+A copy whole page → paste vào textarea
// → AI parse ra structured object → save vào cards.parent_*.
//
// Khác lib/ai/post-draft.ts ở chỗ: đây là 1-shot extraction (cheap model, ngắn).

import { getOpenAI, aiEnabled } from './openai';
import { isValidTextModel } from './model-options';

const DEFAULT_PARSE_MODEL = 'gpt-4o-mini';   // cheap + structured-output OK

export interface ParsedParent {
  title: string;
  body: string;
  author: string;
  snippets: Array<{ author?: string; text: string }>;
}

export async function parseParentContext(
  rawText: string,
  opts?: { modelId?: string },
): Promise<{ ok: boolean; data?: ParsedParent; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  if (!rawText.trim()) return { ok: false, error: 'Paste content trống' };

  const client = getOpenAI()!;
  const model = opts?.modelId && isValidTextModel(opts.modelId) ? opts.modelId : DEFAULT_PARSE_MODEL;

  // Cap input để không quá tốn token (1 thread post Reddit ~ 5k chars).
  const capped = rawText.slice(0, 20000);

  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Bạn là content extractor. Input: raw copy-paste từ thread/post page (Reddit/FB/Forum/Discord/Twitter).
Output STRICT JSON:
{
  "title": "...",      // tiêu đề thread/post gốc (1 dòng, plain text)
  "body": "...",       // body chính của post gốc (markdown OK)
  "author": "...",     // handle author (vd "u/SomeUser", "@john_doe", "John Smith")
  "snippets": [        // 0-3 top comments / quotes liên quan
    { "author": "u/X", "text": "comment body" }
  ]
}

Rules:
- BỎ navigation/sidebar/ads/related-links chrome khỏi extraction
- Title: lấy đúng tiêu đề post chính (không phải sub name / page title)
- Author: prefix theo platform convention (u/ cho Reddit, @ cho Twitter/FB, etc.)
- Body: giữ markdown gốc nếu có; convert HTML → markdown đơn giản
- Snippets: chỉ top 2-3 comment quan trọng (top-voted hoặc OP-confirmed). KHÔNG copy hết comment thread.
- Nếu không tìm thấy field nào → trả empty string "".
- Snippets không bắt buộc → trả [] nếu không có comment.`,
        },
        { role: 'user', content: capped },
      ],
      temperature: 0.1,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as Partial<ParsedParent>;
    return {
      ok: true,
      data: {
        title: String(parsed.title ?? '').trim(),
        body: String(parsed.body ?? '').trim(),
        author: String(parsed.author ?? '').trim(),
        snippets: Array.isArray(parsed.snippets)
          ? parsed.snippets.slice(0, 5).map((s) => ({
              author: typeof s.author === 'string' ? s.author : undefined,
              text: String((s as Record<string, unknown>).text ?? '').trim(),
            })).filter((s) => s.text)
          : [],
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
